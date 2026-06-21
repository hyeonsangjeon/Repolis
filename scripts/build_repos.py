#!/usr/bin/env python3
"""Repolis data builder.

Aggregates the GitHub traffic history collected by ``scripts/collect_traffic.py``
(stored in ``data/logs/``) with live repo metadata, and writes ``repos.json`` —
the data that powers the Repolis 3D city (one building per repo).

Only PUBLIC, non-fork repos are included, so the public site never exposes
private repository names. Traffic totals are cumulative over the whole period
that has been tracked.

Env vars:
  REPO_OWNER  GitHub login that owns the repos (default: hyeonsangjeon)
  GTM_DIR     Directory holding the collected logs/ tree (default: data)
  OUT         Output path (default: repos.json)
  GH_TOKEN    Token used by `gh` (PAT that can list the repos)
"""
import csv
import json
import math
import os
import subprocess
from pathlib import Path

OWNER = os.environ.get("REPO_OWNER", "hyeonsangjeon")
GTM_DIR = Path(os.environ.get("GTM_DIR", "data"))
OUT = Path(os.environ.get("OUT", "repos.json"))


def gh_api(path):
    out = subprocess.check_output(["gh", "api", "--paginate", path], text=True)
    # gh --paginate concatenates pages of a JSON array into a single array.
    return json.loads(out)


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


def build():
    repos = gh_api("/user/repos?per_page=100&affiliation=owner&sort=full_name")
    out = []
    for r in repos:
        if r.get("fork") or r.get("private"):
            continue
        name = r["name"]
        views = sum_col(GTM_DIR / "logs" / f"{name}.csv", "views")
        visitors = sum_col(GTM_DIR / "logs" / f"{name}.csv", "uniques")
        clones = sum_col(GTM_DIR / "logs" / "clones" / f"{name}.csv", "clones")
        tracked = (GTM_DIR / "logs" / f"{name}.csv").exists()
        stars = r.get("stargazers_count", 0) or 0
        forks = r.get("forks_count", 0) or 0
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
                "views": views,
                "visitors": visitors,
                "clones": clones,
                "size": r.get("size", 0) or 0,
                "created": (r.get("created_at") or "")[:10],
                "pushed": (r.get("pushed_at") or "")[:10],
                "tracked": tracked,
                "score": round(score, 3),
            }
        )

    out.sort(key=lambda x: x["score"], reverse=True)
    for i, o in enumerate(out):
        o["rank"] = i

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")

    downtown = sum(1 for o in out if o["rank"] < 14)
    tracked_n = sum(1 for o in out if o["tracked"])
    print(f"wrote {OUT} with {len(out)} public non-fork repos")
    print(f"  downtown(rank<14)={downtown} hometown={len(out) - downtown} tracked={tracked_n}")


if __name__ == "__main__":
    build()
