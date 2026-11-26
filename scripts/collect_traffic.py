#!/usr/bin/env python3
"""Reconcile daily GitHub traffic for the owner's public, non-fork repos.

No network or filesystem effects at import. See docs/traffic-recovery.md for
previewing and replaying a saved public-only window before the next refresh.
"""
import argparse
import csv
import datetime as dt
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


HEADERS = {
    "views": ["date", "views", "uniques", "views_7d", "uniques_7d"],
    "clones": ["date", "clones", "uniques", "clones_14d", "uniques_14d"],
}
META = ["date", "stars", "forks", "watchers", "language"]


def gh_json(path, paginate=False):
    cmd = ["gh", "api"] + (["--paginate", "--slurp"] if paginate else []) + [path]
    env = os.environ.copy()
    if env.get("GH_PAT"):
        env["GH_TOKEN"] = env["GH_PAT"]
    try:
        result = json.loads(subprocess.check_output(cmd, text=True, env=env, stderr=subprocess.DEVNULL))
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None
    return [repo for page in result for repo in page] if paginate else result


def day(value):
    if dt.date.fromisoformat(value).isoformat() != value:
        raise ValueError("expected an ISO calendar date")
    return value


def counts(count, unique):
    if type(count) is not int or type(unique) is not int or not 0 <= unique <= count:
        raise ValueError("invalid traffic counts")
    return str(count), str(unique)


def points(items, key):
    if not isinstance(items, list):
        raise ValueError("missing daily traffic window")
    result = {}
    for item in items:
        date = day(item[key][:10] if key == "timestamp" else item[key])
        if date in result:
            raise ValueError(f"duplicate daily point: {date}")
        result[date] = counts(item["count"], item["uniques"])
    return result


def read_rows(path, header):
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        if next(reader, None) != header:
            raise ValueError(f"unexpected header: {path}")
        rows = {}
        for row in reader:
            if len(row) != len(header) or day(row[0]) in rows:
                raise ValueError(f"invalid or duplicate row: {path}")
            rows[row[0]] = row
        return rows


def write_rows(path, header, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    expected = [header, *[rows[k] for k in sorted(rows)]]
    buf = io.StringIO(newline="")
    csv.writer(buf).writerows(expected)
    content = buf.getvalue().encode("utf-8")
    fd, name = tempfile.mkstemp(dir=path.parent)
    tmp_path = Path(name)
    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(content)
            tmp.flush()
            os.fsync(tmp.fileno())
        if tmp_path.read_bytes() != content or read_rows(tmp_path, header) != rows:
            raise OSError(f"temporary CSV verification failed: {path}")
        tmp_path.chmod(path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(tmp_path, path)
    finally:
        tmp_path.unlink(missing_ok=True)


def reconcile(path, kind, saved, live, dry_run):
    header = HEADERS[kind]
    old = read_rows(path, header)
    rows = old.copy()
    # Existing history might have been corrected after the snapshot was taken.
    # The snapshot fills gaps; only a current API point revises a recorded day.
    for date, pair in points(saved, "date").items():
        rows.setdefault(date, [date, *pair, "", ""])
    if live is not None:
        daily = points(live[kind], "timestamp")
        last = max(daily, default=None)
        for date, pair in daily.items():
            # The GitHub window totals are not historical daily measurements.
            # Retain legacy snapshots and only stamp a newly seen latest day.
            roll = old[date][3:] if date in old else (
                counts(live["count"], live["uniques"]) if date == last else ("", ""))
            rows[date] = [date, *pair, *roll]
    added = sorted(rows.keys() - old.keys())
    revised = sorted(date for date in old if rows[date] != old[date])
    if (added or revised) and not dry_run:
        write_rows(path, header, rows)
    def totals(table):
        return tuple(sum(int(row[col]) for row in table.values()) for col in (1, 2))
    return added, revised, totals(old), totals(rows)


def load_saved(path, owner):
    if not path:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if (data.get("version") != 1 or data.get("owner", "").lower() != owner.lower()
            or not isinstance(data.get("repos"), dict)):
        raise ValueError("invalid snapshot or different owner")
    return data["repos"]


def collect(owner, root, saved, dry_run, today, fetch=gh_json):
    listed = fetch(f"/users/{owner}/repos?type=owner&per_page=100", paginate=True)
    if listed is None:
        raise RuntimeError("public repository list unavailable; no logs changed")
    unavailable = 0
    for repo in listed:
        if (repo.get("private") is not False or repo.get("visibility", "public") != "public"
                or repo.get("fork") is not False
                or repo.get("owner", {}).get("login", "").lower() != owner.lower()):
            continue
        name = repo["name"]
        if not re.fullmatch(r"[a-zA-Z0-9_.-]+", name) or name in (".", ".."):
            raise ValueError("invalid repository slug")
        for kind in HEADERS:
            live = fetch(f"/repos/{owner}/{name}/traffic/{kind}")
            if live is None:
                unavailable += 1
            path = (root if kind == "views" else root / "clones") / f"{name}.csv"
            add, rev, before, after = reconcile(path, kind, saved.get(name, {}).get(kind, []), live, dry_run)
            print(f"{name} {kind}: added={len(add)} revised={len(rev)} "
                  f"(count,daily_uniques)={before}->{after}" + (" API unavailable" if live is None else ""))
        path = root / "metadata" / f"{name}.csv"
        rows = read_rows(path, META)
        if today not in rows and not dry_run:
            rows[today] = [today, *[str(repo[k]) for k in ("stargazers_count", "forks_count", "watchers_count")],
                           repo.get("language") or ""]
            write_rows(path, META, rows)
    print(f"Unavailable endpoints: {unavailable}; no missing day inferred as zero")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner", default=os.environ.get("REPO_OWNER"))
    parser.add_argument("--recover-from", type=Path, metavar="SNAPSHOT")
    parser.add_argument("--dry-run", action="store_true", help="read and compare without writing any CSVs")
    args = parser.parse_args()
    user = None if args.owner else gh_json("/user")
    owner = args.owner or (user or {}).get("login", "")
    if not re.fullmatch(r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?", owner):
        parser.error("set --owner or REPO_OWNER to the repository owner")
    collect(owner, Path(os.environ.get("LOGS_DIR", "data/logs")), load_saved(args.recover_from, owner),
            args.dry_run, dt.datetime.now(dt.timezone.utc).date().isoformat())


if __name__ == "__main__":
    main()
