#!/usr/bin/env python3
"""Repolis data builder.

Aggregates the GitHub traffic history collected by ``scripts/collect_traffic.py``
(stored in ``data/logs/``) with live repo metadata, and writes ``repos.json`` and
``data/city-state.json`` — the data that powers the Repolis 3D city.

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
  CITY_STATE_AS_OF  Optional ISO-8601 city reference time. The daily workflow
                   supplies its UTC run day; local builds fall back to the
                   newest reproducible public source timestamp.
  FORK_LINEAGE_ONLY  Set to 1 to enrich an existing generated snapshot without
                    refreshing unrelated repository fields.
  FORK_LINEAGE_INPUT  Optional input snapshot for FORK_LINEAGE_ONLY (default: OUT).
  GH_TOKEN    Token used by `gh` (PAT that can list the repos)
"""
import csv
import json
import math
import os
import subprocess
from pathlib import Path

from city_state import build_city_state, write_city_state
from fork_lineage import public_fork_lineage
from resident_profiles import write_resident_artifacts

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
FORK_LINEAGE_ONLY = os.environ.get("FORK_LINEAGE_ONLY", "").strip() == "1"
FORK_LINEAGE_INPUT = Path(os.environ.get("FORK_LINEAGE_INPUT", str(OUT)))
CITY_STATE_OUT = Path(os.environ.get("CITY_STATE_OUT", "data/city-state.json"))
CITY_STATE_AS_OF = os.environ.get("CITY_STATE_AS_OF", "").strip() or None
RESIDENTS_OUT = Path(os.environ.get("RESIDENTS_OUT", "data/residents"))
RESIDENT_REGISTRY_OUT = Path(
    os.environ.get(
        "RESIDENT_REGISTRY_OUT",
        "cloudflare-taxi/src/generated/resident-registry.js",
    )
)


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


def resident_history(full_name):
    """Bounded public issue/PR/release/commit evidence for one public repo."""
    owner, name = full_name.split("/", 1)
    query = """
query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){
    issues(first:3,states:OPEN,orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes{number title url updatedAt}
    }
    pullRequests(first:3,states:OPEN,orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes{number title url updatedAt}
    }
    historyIssues:issues(first:2,states:[OPEN,CLOSED],orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes{number title url updatedAt}
    }
    historyPullRequests:pullRequests(first:2,states:[MERGED,CLOSED],orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes{number title url updatedAt}
    }
    releases(first:2,orderBy:{field:CREATED_AT,direction:DESC}){
      nodes{name tagName url publishedAt createdAt}
    }
    defaultBranchRef{
      target{
        ... on Commit{
          history(first:3){nodes{oid messageHeadline committedDate url}}
        }
      }
    }
  }
}"""
    try:
        raw = subprocess.check_output(
            [
                "gh", "api", "graphql",
                "-f", "query=" + query,
                "-F", "owner=" + owner,
                "-F", "name=" + name,
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        repository = ((json.loads(raw).get("data") or {}).get("repository")) or {}
    except (subprocess.CalledProcessError, json.JSONDecodeError, ValueError):
        return {"available": False}

    def nodes(key):
        return ((repository.get(key) or {}).get("nodes")) or []

    return {
        "available": True,
        "issues": [
            {
                "number": item.get("number"),
                "title": item.get("title"),
                "url": item.get("url"),
                "updated_at": item.get("updatedAt"),
            }
            for item in nodes("issues")
        ],
        "pull_requests": [
            {
                "number": item.get("number"),
                "title": item.get("title"),
                "url": item.get("url"),
                "updated_at": item.get("updatedAt"),
            }
            for item in nodes("pullRequests")
        ],
        "history_issues": [
            {
                "number": item.get("number"),
                "title": item.get("title"),
                "url": item.get("url"),
                "updated_at": item.get("updatedAt"),
            }
            for item in nodes("historyIssues")
        ],
        "history_pull_requests": [
            {
                "number": item.get("number"),
                "title": item.get("title"),
                "url": item.get("url"),
                "updated_at": item.get("updatedAt"),
            }
            for item in nodes("historyPullRequests")
        ],
        "releases": [
            {
                "name": item.get("name") or item.get("tagName"),
                "tag_name": item.get("tagName"),
                "url": item.get("url"),
                "published_at": item.get("publishedAt") or item.get("createdAt"),
            }
            for item in nodes("releases")
        ],
        "commits": [
            {
                "oid": item.get("oid"),
                "message": item.get("messageHeadline"),
                "url": item.get("url"),
                "committed_at": item.get("committedDate"),
            }
            for item in (
                (((repository.get("defaultBranchRef") or {}).get("target") or {})
                 .get("history") or {}).get("nodes") or []
            )
        ],
    }


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


def record_with_lineage(record, lineage):
    output = {}
    for key, value in record.items():
        if key == "lineage":
            continue
        if key == "rank" and lineage:
            output["lineage"] = lineage
        output[key] = value
    if lineage and "lineage" not in output:
        output["lineage"] = lineage
    return output


def refresh_fork_lineage():
    records = json.loads(FORK_LINEAGE_INPUT.read_text(encoding="utf-8"))
    if not isinstance(records, list):
        raise ValueError("fork lineage input must be a repository array")
    output = []
    lookups = 0
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("fork lineage input contains a non-object")
        lineage = None
        if record.get("fork") is True:
            lookups += 1
            lineage = public_fork_lineage(f"{OWNER}/{record.get('repo', '')}")
        output.append(record_with_lineage(record, lineage))
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    included = sum(1 for record in output if record.get("lineage"))
    print(f"wrote {OUT} with {included} public fork lineages ({lookups} bounded lookups)")


def build():
    # Public owner endpoint works with the built-in Actions token, so a fork can
    # build its first city without a PAT. A PAT is only needed for traffic data.
    repos = gh_api(f"/users/{OWNER}/repos?per_page=100&type=owner&sort=full_name")
    social = social_map(OWNER)
    out = []
    source_timestamps = {}
    resident_histories = {}
    for r in repos:
        if r.get("private"):
            continue
        name = r["name"]
        full = r.get("full_name") or f"{OWNER}/{name}"
        if r.get("fork") and not i_committed(full):
            continue
        views = sum_col(GTM_DIR / "logs" / f"{name}.csv", "views")
        visitors = sum_col(GTM_DIR / "logs" / f"{name}.csv", "uniques")
        clones = sum_col(GTM_DIR / "logs" / "clones" / f"{name}.csv", "clones")
        tracked = (GTM_DIR / "logs" / f"{name}.csv").exists()
        first_seen = (first_date(GTM_DIR / "logs" / f"{name}.csv")
                      or first_date(GTM_DIR / "logs" / "clones" / f"{name}.csv"))
        stars = r.get("stargazers_count", 0) or 0
        forks = r.get("forks_count", 0) or 0
        lineage = public_fork_lineage(full) if r.get("fork") else None
        lic = r.get("license") or {}
        lic_name = lic.get("spdx_id") or lic.get("name") or ""
        if lic_name in ("NOASSERTION", "NONE"):
            lic_name = ""
        rel = latest_release(full)
        resident_histories[name] = resident_history(full)
        source_timestamps[name] = max(
            (value for value in (r.get("updated_at"), r.get("pushed_at"), r.get("created_at")) if value),
            default="",
        )
        score = (
            math.log1p(visitors) * 1.0
            + math.log1p(clones) * 0.7
            + math.log1p(forks) * 0.6
            + math.log1p(stars) * 0.5
        )
        record = {
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
        out.append(record_with_lineage(record, lineage))

    out.sort(key=lambda x: x["score"], reverse=True)
    for i, o in enumerate(out):
        o["rank"] = i

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    city_state = build_city_state(out, source_timestamps, as_of=CITY_STATE_AS_OF)
    write_city_state(CITY_STATE_OUT, city_state)
    resident_summary = write_resident_artifacts(
        out,
        resident_histories,
        OWNER,
        city_state,
        output_dir=RESIDENTS_OUT,
        registry_path=RESIDENT_REGISTRY_OUT,
    )

    downtown = sum(1 for o in out if o["rank"] < 14)
    tracked_n = sum(1 for o in out if o["tracked"])
    forks_n = sum(1 for o in out if o.get("fork"))
    print(f"wrote {OUT} with {len(out)} public repos ({forks_n} forks I committed to)")
    print(
        f"wrote {CITY_STATE_OUT} schema={city_state['version']} "
        f"season={city_state['season']['value']} roots={len(city_state['roots'])}"
    )
    print(
        f"wrote {RESIDENTS_OUT} profiles={resident_summary['profiles']} "
        f"active={resident_summary['active']} manifest={resident_summary['manifest_bytes']}B"
    )
    print(f"  downtown(rank<14)={downtown} hometown={len(out) - downtown} tracked={tracked_n}")


if __name__ == "__main__":
    if FORK_LINEAGE_ONLY:
        refresh_fork_lineage()
    else:
        build()
