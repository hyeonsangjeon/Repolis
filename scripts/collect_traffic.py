#!/usr/bin/env python3
"""Collect GitHub traffic for every PUBLIC, non-fork repo you own and
accumulate it into ``data/logs/*.csv``.

GitHub's traffic API only exposes the last 14 days, so this script appends the
latest data point on each run — building a permanent history that powers the
Repolis 3D city. The collector logic is ported from ``github-traffic-monitor``
so Repolis is fully self-contained: fork it, add a ``GH_PAT`` secret, and the
daily Action grows YOUR own city.

Only PUBLIC, non-fork repos are collected, so this public repository never
stores private repository names.

Uses the GitHub CLI (``gh``, preinstalled on GitHub runners) for every API
call — no external Python packages required.

Env vars:
  GH_PAT / GH_TOKEN   PAT with `repo` scope (grants the traffic API for repos
                      you own)
  LOGS_DIR            output base directory (default: data/logs)
"""
import csv
import datetime
import json
import os
import subprocess
import sys

TOKEN = os.environ.get("GH_PAT") or os.environ.get("GH_TOKEN")
if not TOKEN:
    sys.exit("GH_PAT (or GH_TOKEN) is required")

LOGS = os.environ.get("LOGS_DIR", "data/logs")
RUN_DATE = datetime.date.today().isoformat()
ENV = {**os.environ, "GH_TOKEN": TOKEN}

for d in (LOGS, f"{LOGS}/clones", f"{LOGS}/metadata"):
    os.makedirs(d, exist_ok=True)


def gh_json(path, paginate=False):
    """Call the GitHub REST API via gh. Returns parsed JSON, or None on any
    HTTP/permission error (e.g. 403 when the token can't read a repo's traffic)."""
    cmd = ["gh", "api"] + (["--paginate"] if paginate else []) + [path]
    try:
        out = subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, env=ENV)
        return json.loads(out)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def existing_dates(path):
    if not os.path.isfile(path):
        return set()
    with open(path, newline="") as f:
        return {row["date"] for row in csv.DictReader(f)}


def append_row(path, header, row):
    new = not os.path.isfile(path)
    with open(path, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(header)
        w.writerow(row)


def latest_point(items):
    if not items:
        return None
    p = max(items, key=lambda x: x["timestamp"])
    return p["timestamp"][:10], p["count"], p["uniques"]


def main():
    repos = gh_json("/user/repos?per_page=100&affiliation=owner&sort=full_name",
                    paginate=True) or []
    repos = [r for r in repos if not r.get("fork") and not r.get("private")]
    print(f"collecting traffic for {len(repos)} public non-fork repos on {RUN_DATE}")
    seen = 0
    for r in repos:
        owner, name = r["owner"]["login"], r["name"]

        views = gh_json(f"/repos/{owner}/{name}/traffic/views")
        if views is not None:
            lp = latest_point(views.get("views"))
            date, cnt, uniq = lp if lp else (RUN_DATE, 0, 0)
            path = f"{LOGS}/{name}.csv"
            if date not in existing_dates(path):
                append_row(path, ["date", "views", "uniques", "views_7d", "uniques_7d"],
                           [date, cnt, uniq, views.get("count", 0), views.get("uniques", 0)])
            seen += 1

        clones = gh_json(f"/repos/{owner}/{name}/traffic/clones")
        if clones is not None:
            lp = latest_point(clones.get("clones"))
            date, cnt, uniq = lp if lp else (RUN_DATE, 0, 0)
            path = f"{LOGS}/clones/{name}.csv"
            if date not in existing_dates(path):
                append_row(path, ["date", "clones", "uniques", "clones_14d", "uniques_14d"],
                           [date, cnt, uniq, clones.get("count", 0), clones.get("uniques", 0)])

        # metadata comes from the repo list payload — no extra request needed
        path = f"{LOGS}/metadata/{name}.csv"
        if RUN_DATE not in existing_dates(path):
            append_row(path, ["date", "stars", "forks", "watchers", "language"],
                       [RUN_DATE, r.get("stargazers_count", 0), r.get("forks_count", 0),
                        r.get("watchers_count", 0), r.get("language") or ""])

    print(f"done \u00b7 {seen} repos returned traffic")


if __name__ == "__main__":
    main()
