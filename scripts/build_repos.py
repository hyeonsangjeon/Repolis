#!/usr/bin/env python3
"""Repolis data builder.

Aggregates the GitHub traffic history collected by ``scripts/collect_traffic.py``
(stored in ``data/logs/``) with live repo metadata, and writes ``repos.json`` —
the data that powers the Repolis 3D city (one building per repo).

Only PUBLIC repos are included, so the public site never exposes private
repository names: every repo the owner created, plus any fork the owner has
actually committed to (pure untouched mirrors are skipped). Traffic totals are
cumulative over the whole period that has been tracked.

Env vars:
  REPO_OWNER  GitHub login that owns the repos (default: authenticated gh user,
              then hyeonsangjeon as the upstream fallback)
  GTM_DIR     Directory holding the collected logs/ tree. Defaults to data for
              upstream and data/towns/<owner> for every other owner.
  OUT         Output path (default: repos.json)
  GH_TOKEN    Token used by `gh` (PAT that can list the repos)
"""
import csv
import json
import math
import os
import subprocess
from pathlib import Path

def resolve_owner():
    configured = os.environ.get("REPO_OWNER", "").strip()
    if configured:
        return configured
    try:
        data = json.loads(subprocess.check_output(
            ["gh", "api", "/user"], text=True, stderr=subprocess.DEVNULL,
        ))
        if data.get("login"):
            return data["login"]
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        pass
    return "hyeonsangjeon"


UPSTREAM_OWNER = "hyeonsangjeon"
OWNER = resolve_owner()
_configured_gtm = os.environ.get("GTM_DIR", "").strip()
GTM_DIR = Path(_configured_gtm) if _configured_gtm else (
    Path("data") if OWNER.lower() == UPSTREAM_OWNER else Path("data") / "towns" / OWNER
)
OUT = Path(os.environ.get("OUT", "repos.json"))


def gh_api(path):
    out = subprocess.check_output(["gh", "api", "--paginate", path], text=True)
    # gh --paginate concatenates pages of a JSON array into a single array.
    return json.loads(out)


def latest_release(full_name):
    """Latest published release tag + date, or None when the repo has none."""
    try:
        out = subprocess.check_output(
            ["gh", "api", f"/repos/{full_name}/releases/latest"],
            text=True, stderr=subprocess.DEVNULL,
        )
        d = json.loads(out)
        return {"tag": d.get("tag_name") or "", "date": (d.get("published_at") or "")[:10]}
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def i_committed(full_name):
    """True when OWNER has authored at least one commit in this repo.

    Used to keep forks that the owner actually worked on while dropping forks
    that were never touched (pure mirrors of someone else's project).
    """
    try:
        out = subprocess.check_output(
            ["gh", "api", f"/repos/{full_name}/commits?author={OWNER}&per_page=1"],
            text=True, stderr=subprocess.DEVNULL,
        )
        data = json.loads(out)
        return isinstance(data, list) and len(data) > 0
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return False


def social_map(owner):
    """Map repo name -> {url, custom} for GitHub social preview (open graph) images.

    REST ``/user/repos`` does not expose the social preview, so we use GraphQL:
      * ``openGraphImageUrl``        the image GitHub serves when the repo is shared.
      * ``usesCustomOpenGraphImage`` True when the owner uploaded a custom preview
        (served from repository-images.githubusercontent.com); False for the
        auto-generated card (served from opengraph.githubassets.com).
    """
    out = {}
    cursor = None
    query = (
        "query($owner:String!,$cursor:String){"
        " repositoryOwner(login:$owner){"
        " ... on User { repositories(first:100, ownerAffiliations:OWNER,"
        " isFork:false, privacy:PUBLIC, after:$cursor){"
        " nodes{ name usesCustomOpenGraphImage openGraphImageUrl }"
        " pageInfo{ hasNextPage endCursor } } } } }"
    )
    while True:
        cmd = ["gh", "api", "graphql", "-f", "query=" + query, "-F", "owner=" + owner]
        if cursor:
            cmd += ["-F", "cursor=" + cursor]
        try:
            data = json.loads(subprocess.check_output(cmd, text=True))
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            break  # graceful: builds still work without social data
        conn = (((data.get("data") or {}).get("repositoryOwner") or {}).get("repositories")) or {}
        for n in conn.get("nodes") or []:
            out[n["name"]] = {
                "url": n.get("openGraphImageUrl") or "",
                "custom": bool(n.get("usesCustomOpenGraphImage")),
            }
        page = conn.get("pageInfo") or {}
        if page.get("hasNextPage"):
            cursor = page.get("endCursor")
        else:
            break
    return out


def sum_col(path, col):
    if not path.exists():
        return 0
    total = 0
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            try:
                total += int(float(row.get(col) or 0))
            except (TypeError, ValueError):
                pass
    return total


def first_date(path):
    """Earliest tracked date in a log = the day the repo's 'house' was built."""
    if not path.exists():
        return ""
    earliest = None
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            d = (row.get("date") or "").strip()
            if d and (earliest is None or d < earliest):
                earliest = d
    return earliest or ""


def build():
    # Public owner endpoint works with the built-in Actions token, so a fork can
    # build its first city without a PAT. A PAT is only needed for traffic data.
    repos = gh_api(f"/users/{OWNER}/repos?per_page=100&type=owner&sort=full_name")
    social = social_map(OWNER)
    out = []
    for r in repos:
        if r.get("private"):
            continue
        if r.get("fork") and not i_committed(r.get("full_name") or f"{OWNER}/{r['name']}"):
            continue
        name = r["name"]
        views = sum_col(GTM_DIR / "logs" / f"{name}.csv", "views")
        visitors = sum_col(GTM_DIR / "logs" / f"{name}.csv", "uniques")
        clones = sum_col(GTM_DIR / "logs" / "clones" / f"{name}.csv", "clones")
        tracked = (GTM_DIR / "logs" / f"{name}.csv").exists()
        first_seen = (first_date(GTM_DIR / "logs" / f"{name}.csv")
                      or first_date(GTM_DIR / "logs" / "clones" / f"{name}.csv"))
        stars = r.get("stargazers_count", 0) or 0
        forks = r.get("forks_count", 0) or 0
        full = r.get("full_name") or f"{OWNER}/{name}"
        lic = r.get("license") or {}
        lic_name = lic.get("spdx_id") or lic.get("name") or ""
        if lic_name in ("NOASSERTION", "NONE"):
            lic_name = ""
        rel = latest_release(full)
        score = (
            math.log1p(visitors) * 1.0
            + math.log1p(clones) * 0.7
            + math.log1p(forks) * 0.6
            + math.log1p(stars) * 0.5
        )
        out.append(
            {
                "repo": name,
                "desc": (r.get("description") or "").strip(),
                "lang": r.get("language") or "Other",
                "topics": r.get("topics") or [],
                "url": r.get("html_url"),
                "home": (r.get("homepage") or "").strip(),
                "stars": stars,
                "forks": forks,
                "fork": bool(r.get("fork")),
                "views": views,
                "visitors": visitors,
                "clones": clones,
                "size": r.get("size", 0) or 0,
                "open_issues": r.get("open_issues_count", 0) or 0,
                "license": lic_name,
                "archived": bool(r.get("archived")),
                "default_branch": r.get("default_branch") or "main",
                "release_tag": (rel or {}).get("tag", ""),
                "release_date": (rel or {}).get("date", ""),
                "created": (r.get("created_at") or "")[:10],
                "pushed": (r.get("pushed_at") or "")[:10],
                "tracked": tracked,
                "first_seen": first_seen,
                "social": (social.get(name) or {}).get("url", ""),
                "social_custom": (social.get(name) or {}).get("custom", False),
                "score": round(score, 3),
            }
        )

    out.sort(key=lambda x: x["score"], reverse=True)
    for i, o in enumerate(out):
        o["rank"] = i

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")

    downtown = sum(1 for o in out if o["rank"] < 14)
    tracked_n = sum(1 for o in out if o["tracked"])
    forks_n = sum(1 for o in out if o.get("fork"))
    print(f"wrote {OUT} with {len(out)} public repos ({forks_n} forks I committed to)")
    print(f"  downtown(rank<14)={downtown} hometown={len(out) - downtown} tracked={tracked_n}")


if __name__ == "__main__":
    build()
