# Recover a GitHub traffic window

These are visits to GitHub repository pages and repository clones, **not** entries to the
Repolis town. The scheduled collector reads the available UTC daily observations for public,
non-fork repositories owned by the configured owner. It adds missing dates and corrects daily
values reported by the live API. An explicit zero is data; an absent date, an empty window or a
failed endpoint is not. Views and clones are independent.

To preview a saved window from the repository root (use the same owner and log directory as your
refresh workflow, and an existing GitHub CLI login with traffic access):

```sh
LOGS_DIR=data/logs python3 scripts/collect_traffic.py --owner OWNER --recover-from /private/path/capture.json --dry-run
```

The report gives additions, revisions and before/after (count, sum of daily uniques) for each repo
and endpoint. Dry runs do not create or write any logs. Without a saved window, omit
`--recover-from`. To apply **after approval**, repeat the exact command without `--dry-run` on
a current main checkout. Then run the workflow's normal build, public-artifact validation and
hermetic checks and review the generated diff separately. Do not commit the capture.

A capture is a private local JSON file, not credentials or raw GitHub responses:

```json
{"version":1,"owner":"example","captured_at":"2026-11-25T10:00:00Z","repos":{"project":{"views":[{"date":"2026-11-20","count":3,"uniques":2}],"clones":[]}}}
```

Only repos still in the current public, non-fork owner listing are eligible to write.
Old captures fill missing dates; they cannot undo later corrections already on disk.
Live daily observations take precedence over both. Missing dates outside both sources
cannot be recovered. Each changed file is sorted by date and replaced only after verifying
its temporary CSV. With identical inputs a repeat run makes no changes.

The legacy `views_7d` / `uniques_7d` column names are preserved for compatibility; the original
collector wrote GitHub's **14-day** response totals there. They are not seven-day measurements.
Preserve existing period snapshots. Only newly recorded latest days from a live response get its
window totals; newly backfilled older dates have blank period columns. City scoring consumes only
the daily columns. Missing service permissions must not be interpreted as no visits.
