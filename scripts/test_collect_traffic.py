import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import collect_traffic as traffic


def window(kind, days):
    return {kind: [{"timestamp": f"2026-11-{d:02}T00:00:00Z", "count": n, "uniques": u}
                   for d, n, u in days], "count": 45, "uniques": 18}


class TrafficTests(unittest.TestCase):
    def setUp(self):
        tmp = TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name) / "logs"
        self.repo = dict(name="Repo", owner={"login": "Test"}, private=False, fork=False,
                         stargazers_count=2, forks_count=1, watchers_count=2, language=None)

    def collect(self, views, clones, *, saved=None, dry=False):
        calls = []
        def fetch(path, paginate=False):
            if paginate:
                return [self.repo, dict(self.repo, private=True, name="Hidden"),
                        dict(self.repo, visibility="internal", name="Internal"),
                        dict(self.repo, fork=True, name="Fork"), dict(self.repo, owner={"login":"Other"})]
            calls.append(path)
            return views if path.endswith("views") else clones
        traffic.collect("test", self.root, saved or {}, dry, "2026-11-25", fetch)
        self.assertEqual(calls, ["/repos/test/Repo/traffic/views", "/repos/test/Repo/traffic/clones"])

    def rows(self, kind):
        path = (self.root if kind == "views" else self.root / "clones") / "Repo.csv"
        with path.open(newline="") as f:
            return list(csv.reader(f))

    def test_backfill_correct_and_repeat(self):
        self.collect(window("views", [(1, 4, 1), (16, 2, 1)]), None)
        saved = {"Repo": {"views": [
            {"date":"2026-11-15","count":3,"uniques":2}, {"date":"2026-11-17","count":4,"uniques":2},
            {"date":"2026-11-01","count":1,"uniques":1}]}}
        live = window("views", [(20, 3, 2), (16, 0, 0), (17, 2, 1)])
        self.collect(live, None, saved=saved, dry=True)
        self.assertEqual(len(self.rows("views")), 3)
        self.collect(live, None, saved=saved)
        self.assertEqual(self.rows("views"), [traffic.HEADERS["views"],
            ["2026-11-01","4","1","",""], ["2026-11-15","3","2","",""],
            ["2026-11-16","0","0","45","18"], ["2026-11-17","2","1","",""],
            ["2026-11-20","3","2","45","18"]])
        files = {p:p.read_bytes() for p in self.root.rglob("*.csv")}
        with patch.object(traffic, "write_rows", side_effect=AssertionError("no-op rewrote a file")):
            self.collect(live, None, saved=saved)
        self.assertEqual(files, {p:p.read_bytes() for p in self.root.rglob("*.csv")})

    def test_empty_failure_and_explicit_zero(self):
        self.collect(None, window("clones", [(22, 0, 0)]), dry=True)
        self.assertFalse(self.root.exists())
        self.collect(None, window("clones", [(22, 0, 0)]))
        self.collect(window("views", []), None)
        self.assertFalse((self.root / "Repo.csv").exists())
        self.assertEqual(self.rows("clones")[1], ["2026-11-22","0","0","45","18"])
        self.collect(window("views", [(23, 1, 1)]), window("clones", []))
        self.assertEqual(self.rows("views")[1][1:3], ["1", "1"])
        self.assertEqual(len(self.rows("clones")), 2)

    def test_invalid_daily_values_leave_file_unchanged(self):
        self.collect(window("views", [(15, 3, 2)]), None)
        path = self.root / "Repo.csv"
        contents = path.read_bytes()
        for bad in [[(15, 1, 2)], [(15, 1, 1), (15, 1, 1)]]:
            with self.assertRaises(ValueError):
                self.collect(window("views", bad), None)
            self.assertEqual(path.read_bytes(), contents)
        with patch.object(traffic.os, "replace", side_effect=OSError):
            with self.assertRaises(OSError):
                self.collect(window("views", [(15, 2, 2)]), None)
        self.assertEqual(path.read_bytes(), contents)
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ["Repo.csv", "metadata"])

    def test_recovery_file_is_scoped_to_current_public_owner(self):
        path = self.root.parent / "capture.json"
        path.write_text(json.dumps({"version":1, "owner":"Test", "repos":{
            name:{"views":[{"date":"2026-11-15","count":3,"uniques":2}]} for name in ("Repo","Hidden","Fork","Removed")}}))
        with self.assertRaises(ValueError):
            traffic.load_saved(path, "other")
        self.collect(None, None, saved=traffic.load_saved(path, "test"))
        self.assertEqual(self.rows("views")[1], ["2026-11-15","3","2","",""])
        self.assertEqual(sorted(p.name for p in self.root.rglob("*.csv")), ["Repo.csv","Repo.csv"])


if __name__ == "__main__":
    unittest.main()
