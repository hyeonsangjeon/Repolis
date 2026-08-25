#!/usr/bin/env python3
"""Hermetic city-state generation and schema regression tests."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from city_state import build_city_state, serialize_city_state
from validate_city_state import load_and_validate


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "data" / "city-state.schema.json"


def repo(name, created, pushed, *, archived=False, private=False, stars=0, language="Python", desc=""):
    return {
        "repo": name,
        "created": created,
        "pushed": pushed,
        "archived": archived,
        "private": private,
        "stars": stars,
        "forks": stars // 2,
        "lang": language,
        "desc": desc,
    }


class CityStateTests(unittest.TestCase):
    def validate_state(self, state):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "city-state.json"
            target.write_text(serialize_city_state(state), encoding="utf-8")
            self.assertEqual(load_and_validate(target, SCHEMA), [])

    def test_projection_is_public_safe_honest_and_schema_valid(self):
        repos = [
            repo("active", "2020-01-02", "2026-06-28", stars=7, desc="A useful public tool."),
            repo("memory", "2018-03-04", "2022-04-05", archived=True, stars=3, desc="Archived public work."),
            repo("secret", "2017-01-01", "2026-06-30", private=True, stars=999),
        ]
        state = build_city_state(repos, {"active": "2026-06-30T12:00:00Z"})
        self.validate_state(state)
        self.assertEqual(state["era"]["oldest_repository"], "memory")
        self.assertEqual(state["stats"]["repository_count"], 2)
        self.assertEqual(state["stats"]["total_stars"], 10)
        self.assertIsNone(state["stats"]["commit_history"]["total"])
        self.assertFalse(state["stats"]["commit_history"]["available"])
        self.assertEqual([root["repo"] for root in state["roots"]], ["memory"])
        self.assertEqual(state["roots"][0]["active_years"], {"from": 2018, "to": 2022, "count": 5})
        self.assertEqual(state["silence"]["repositories"]["total"], 1)
        self.assertEqual(state["silence"]["repositories"]["with_push_date"], 1)
        self.assertEqual(state["silence"]["quiet"]["at_least_365_days"], 0)
        self.assertNotIn("secret", serialize_city_state(state))

    def test_identical_inputs_are_byte_stable_and_order_independent(self):
        repos = [
            repo("zeta", "2020-01-01", "2026-05-20", stars=2),
            repo("alpha", "2019-01-01", "2026-06-29", stars=4),
        ]
        timestamps = {"zeta": "2026-06-30T08:00:00Z", "alpha": "2026-06-29T09:00:00Z"}
        first = serialize_city_state(build_city_state(repos, timestamps, as_of="2026-06-30T00:00:00Z"))
        second = serialize_city_state(build_city_state(
            list(reversed(repos)),
            dict(reversed(list(timestamps.items()))),
            as_of="2026-06-30T00:00:00Z",
        ))
        self.assertEqual(first, second)
        self.assertEqual(first, serialize_city_state(json.loads(first)))

    def test_silence_ledger_is_unarchived_inclusive_and_stably_tied(self):
        repos = [
            repo("beta-earliest", "2019-01-01", "2020-01-01", stars=40),
            repo("alpha-earliest", "2019-01-01", "2020-01-01", stars=1),
            repo("threshold-730", "2020-01-01", "2024-06-30"),
            repo("threshold-365", "2020-01-01", "2025-06-30"),
            repo("recent", "2020-01-01", "2026-06-29"),
            repo("missing", "2020-01-01", ""),
            repo("invalid", "2020-01-01", "not-a-date"),
            repo("archived-older", "2010-01-01", "2010-01-01", archived=True),
            repo("private-older", "2000-01-01", "2000-01-01", private=True),
        ]
        for index, item in enumerate(repos):
            item["forks"] = 1000 - index
            item["clones"] = 5000 + index

        state = build_city_state(repos, as_of="2026-06-30T00:00:00Z")
        ledger = state["silence"]
        self.validate_state(state)
        self.assertEqual(ledger["schema"], "repolis.silence-ledger")
        self.assertEqual(ledger["version"], 1)
        self.assertEqual(ledger["reference_date"], "2026-06-30")
        self.assertEqual(ledger["scope"], "unarchived_public_repositories")
        self.assertEqual(ledger["activity_signal"], "latest_public_push")
        self.assertEqual(ledger["thresholds_days"], [365, 730])
        self.assertEqual(
            ledger["repositories"],
            {"total": 7, "with_push_date": 5, "without_push_date": 2},
        )
        self.assertEqual(ledger["quiet"]["at_least_365_days"], 4)
        self.assertEqual(ledger["quiet"]["at_least_730_days"], 3)
        self.assertEqual([root["repo"] for root in state["roots"]], ["archived-older"])
        self.assertEqual(
            ledger["quiet"]["longest"],
            {
                "repo": "alpha-earliest",
                "last_public_push": "2020-01-01",
                "elapsed_days": 2372,
            },
        )

        changed_metrics = [dict(item, forks=0, clones=0) for item in reversed(repos)]
        changed = build_city_state(changed_metrics, as_of="2026-06-30T00:00:00Z")
        self.assertEqual(ledger, changed["silence"])

    def test_silence_ledger_fails_soft_for_empty_and_missing_push_dates(self):
        empty = build_city_state([], as_of="2026-06-30T00:00:00Z")
        missing = build_city_state(
            [repo("missing", "2020-01-01", ""), repo("invalid", "2020-01-01", "invalid")],
            as_of="2026-06-30T00:00:00Z",
        )
        self.validate_state(empty)
        self.validate_state(missing)
        self.assertEqual(
            empty["silence"]["repositories"],
            {"total": 0, "with_push_date": 0, "without_push_date": 0},
        )
        self.assertIsNone(empty["silence"]["quiet"]["longest"])
        self.assertEqual(
            missing["silence"]["repositories"],
            {"total": 2, "with_push_date": 0, "without_push_date": 2},
        )
        self.assertEqual(missing["silence"]["quiet"]["at_least_365_days"], 0)
        self.assertEqual(missing["silence"]["quiet"]["at_least_730_days"], 0)
        self.assertIsNone(missing["silence"]["quiet"]["longest"])

    def test_explicit_as_of_advances_a_quiet_city(self):
        state = build_city_state(
            [repo("quiet", "2020-01-01", "2020-01-01")],
            {"quiet": "2020-01-01T12:00:00Z"},
            as_of="2026-06-30T00:00:00Z",
        )
        self.assertEqual(state["era"]["as_of"], "2026-06-30")
        self.assertEqual(state["era"]["city_age_days"], 2372)
        self.assertEqual(state["season"]["value"], "winter")
        self.assertEqual(state["season"]["inputs"]["recent_active_repositories"], 0)
        self.assertEqual(state["last_sap_flow"], "2026-06-30T00:00:00Z")

    def test_moving_average_selects_distinct_spring_and_winter_fixtures(self):
        spring = [
            repo(f"recent-{index}", "2020-01-01", f"2026-06-{27 + index:02d}") for index in range(4)
        ]
        spring += [
            repo(f"history-{index}", "2020-01-01", pushed)
            for index, pushed in enumerate(("2026-05-20", "2026-04-20", "2026-03-20", "2026-02-20", "2026-01-20", "2025-12-20"))
        ]
        winter = [
            repo(f"history-{index}", "2020-01-01", pushed)
            for index, pushed in enumerate(("2026-05-20", "2026-04-20", "2026-03-20", "2026-02-20", "2026-01-20", "2025-12-20"))
        ]
        source = {"source": "2026-06-30T12:00:00Z"}
        spring_state = build_city_state(spring, source)
        winter_state = build_city_state(winter, source)
        self.assertEqual(spring_state["season"]["value"], "spring")
        self.assertEqual(winter_state["season"]["value"], "winter")
        self.assertFalse(spring_state["season"]["fallback"]["used"])
        self.assertFalse(winter_state["season"]["fallback"]["used"])
        self.validate_state(spring_state)
        self.validate_state(winter_state)

    def test_sparse_history_uses_documented_fallback(self):
        state = build_city_state(
            [repo("recent", "2026-01-01", "2026-06-30"), repo("quiet", "2020-01-01", "2020-01-02")],
            {"source": "2026-06-30T12:00:00Z"},
        )
        self.assertEqual(state["season"]["value"], "spring")
        self.assertTrue(state["season"]["fallback"]["used"])
        self.assertIn("insufficient", state["season"]["reason"])

    def test_fallback_records_the_exact_share_used_for_the_decision(self):
        repos = [
            repo(f"recent-{index}", "2020-01-01", "2026-06-30")
            for index in range(11)
        ]
        repos += [
            repo(f"quiet-{index}", "2020-01-01", "2020-01-01")
            for index in range(81)
        ]
        state = build_city_state(repos, {"source": "2026-06-30T00:00:00Z"})
        share = state["season"]["inputs"]["active_repository_share"]
        self.assertEqual(share, 11 / 92)
        self.assertLess(share, 0.12)
        self.assertEqual(state["season"]["value"], "autumn")

    def test_invalid_explicit_as_of_fails_loudly(self):
        with self.assertRaisesRegex(ValueError, "ISO-8601"):
            build_city_state([], as_of="not-a-date")

    def test_validator_rejects_date_without_time_for_last_sap_flow(self):
        state = build_city_state([], as_of="2026-06-30T00:00:00Z")
        state["last_sap_flow"] = "2026-06-30"
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "city-state.json"
            target.write_text(serialize_city_state(state), encoding="utf-8")
            self.assertIn("$.last_sap_flow: invalid date-time", load_and_validate(target, SCHEMA))

    def test_non_finite_numbers_cannot_reach_the_browser(self):
        state = build_city_state([], as_of="2026-06-30T00:00:00Z")
        state["season"]["inputs"]["active_repository_share"] = float("nan")
        with self.assertRaisesRegex(ValueError, "JSON compliant"):
            serialize_city_state(state)
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "city-state.json"
            target.write_text(json.dumps(state), encoding="utf-8")
            self.assertIn("non-finite number NaN", load_and_validate(target, SCHEMA)[0])


if __name__ == "__main__":
    unittest.main()
