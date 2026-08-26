#!/usr/bin/env python3
"""Hermetic fork-lineage sanitizer and daily-build fixture tests."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock


os.environ.setdefault("REPO_OWNER", "fixture-owner")

import build_repos  # noqa: E402
from fork_lineage import public_fork_lineage, sanitize_fork_lineage  # noqa: E402


def source_payload(**source_overrides):
    source = {
        "full_name": "source-owner/source-repo",
        "html_url": "https://github.com/source-owner/source-repo",
        "private": False,
        "visibility": "public",
    }
    source.update(source_overrides)
    return {"fork": True, "source": source}


def raw_repo(name, *, fork=False):
    return {
        "name": name,
        "full_name": f"fixture-owner/{name}",
        "private": False,
        "fork": fork,
        "description": "",
        "language": "Python",
        "topics": [],
        "html_url": f"https://github.com/fixture-owner/{name}",
        "homepage": "",
        "stargazers_count": 1,
        "forks_count": 0,
        "size": 1,
        "open_issues_count": 0,
        "license": {"spdx_id": "MIT"},
        "archived": False,
        "default_branch": "main",
        "created_at": "2020-01-01T00:00:00Z",
        "pushed_at": "2026-08-24T00:00:00Z",
        "updated_at": "2026-08-24T00:00:00Z",
    }


class ForkLineageTests(unittest.TestCase):
    def test_public_source_is_minimal_and_canonical(self):
        self.assertEqual(
            sanitize_fork_lineage(source_payload(), "fixture-owner/child"),
            {
                "source": "source-owner/source-repo",
                "url": "https://github.com/source-owner/source-repo",
            },
        )
        parent = source_payload()
        parent["parent"] = parent.pop("source")
        self.assertEqual(
            sanitize_fork_lineage(parent, "fixture-owner/child")["source"],
            "source-owner/source-repo",
        )

    def test_private_deleted_and_malformed_sources_fail_soft(self):
        self.assertIsNone(sanitize_fork_lineage(source_payload(private=True), "fixture-owner/child"))
        self.assertIsNone(sanitize_fork_lineage(source_payload(visibility="private"), "fixture-owner/child"))
        self.assertIsNone(sanitize_fork_lineage({"fork": True}, "fixture-owner/child"))
        self.assertIsNone(sanitize_fork_lineage(source_payload(full_name="bad source"), "fixture-owner/child"))
        self.assertIsNone(sanitize_fork_lineage(source_payload(html_url="https://example.com/source-owner/source-repo"), "fixture-owner/child"))
        self.assertIsNone(sanitize_fork_lineage(source_payload(html_url="https://github.com:bad/source-owner/source-repo"), "fixture-owner/child"))
        self.assertIsNone(sanitize_fork_lineage(source_payload(full_name="fixture-owner/child", html_url="https://github.com/fixture-owner/child"), "fixture-owner/child"))
        with mock.patch("fork_lineage.subprocess.check_output", side_effect=subprocess.CalledProcessError(1, ["gh"])):
            self.assertIsNone(public_fork_lineage("fixture-owner/deleted"))

    def test_daily_build_fixture_is_bounded_and_byte_stable(self):
        fixtures = [raw_repo("original"), raw_repo("worked-fork", fork=True), raw_repo("mirror", fork=True)]
        lineage_calls = []

        def committed(full_name):
            return not full_name.endswith("/mirror")

        def lineage(full_name):
            lineage_calls.append(full_name)
            return {
                "source": "source-owner/source-repo",
                "url": "https://github.com/source-owner/source-repo",
            }

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            settings = {
                "OUT": root / "repos.json",
                "CITY_STATE_OUT": root / "city-state.json",
                "RESIDENTS_OUT": root / "residents",
                "RESIDENT_REGISTRY_OUT": root / "resident-registry.js",
                "GTM_DIR": root / "data",
                "CITY_STATE_AS_OF": "2026-08-24T00:00:00Z",
            }
            patches = [
                mock.patch.object(build_repos, key, value)
                for key, value in settings.items()
            ]
            with patches[0], patches[1], patches[2], patches[3], patches[4], patches[5], \
                    mock.patch.object(build_repos, "gh_api", return_value=fixtures), \
                    mock.patch.object(build_repos, "social_map", return_value={}), \
                    mock.patch.object(build_repos, "latest_release", return_value=None), \
                    mock.patch.object(build_repos, "resident_history", return_value={"available": False}), \
                    mock.patch.object(build_repos, "i_committed", side_effect=committed), \
                    mock.patch.object(build_repos, "public_fork_lineage", side_effect=lineage):
                build_repos.build()
                first = settings["OUT"].read_bytes()
                first_city = settings["CITY_STATE_OUT"].read_bytes()
                build_repos.build()
                second = settings["OUT"].read_bytes()
                second_city = settings["CITY_STATE_OUT"].read_bytes()
                build_repos.CITY_STATE_AS_OF = "2026-08-25T00:00:00Z"
                build_repos.build()
                third_city = json.loads(settings["CITY_STATE_OUT"].read_text(encoding="utf-8"))

            output = json.loads(first)
            self.assertEqual(first, second)
            self.assertEqual(first_city, second_city)
            self.assertEqual(len(json.loads(first_city)["sap_ledger"]["entries"]), 1)
            self.assertEqual(len(third_city["sap_ledger"]["entries"]), 2)
            self.assertEqual(
                [entry["reference_date"] for entry in third_city["sap_ledger"]["entries"]],
                ["2026-08-24", "2026-08-25"],
            )
            self.assertEqual([repo["repo"] for repo in output], ["original", "worked-fork"])
            self.assertNotIn("lineage", output[0])
            self.assertEqual(output[1]["lineage"]["source"], "source-owner/source-repo")
            self.assertEqual(
                lineage_calls,
                ["fixture-owner/worked-fork", "fixture-owner/worked-fork", "fixture-owner/worked-fork"],
            )

    def test_lineage_only_refresh_preserves_unrelated_generated_fields(self):
        records = [
            {"repo": "original", "fork": False, "size": 7, "rank": 0},
            {"repo": "worked-fork", "fork": True, "size": 11, "lineage": {"source": "stale/source"}, "rank": 1},
        ]
        lineage = {
            "source": "source-owner/source-repo",
            "url": "https://github.com/source-owner/source-repo",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input.json"
            output = root / "output.json"
            source.write_text(json.dumps(records), encoding="utf-8")
            with mock.patch.object(build_repos, "FORK_LINEAGE_INPUT", source), \
                    mock.patch.object(build_repos, "OUT", output), \
                    mock.patch.object(build_repos, "public_fork_lineage", return_value=lineage) as lookup:
                build_repos.refresh_fork_lineage()
                first = output.read_bytes()
                build_repos.FORK_LINEAGE_INPUT = output
                build_repos.refresh_fork_lineage()
                second = output.read_bytes()
            refreshed = json.loads(first)
            self.assertEqual(first, second)
            self.assertEqual(refreshed[0], records[0])
            self.assertEqual(refreshed[1]["size"], 11)
            self.assertEqual(refreshed[1]["lineage"], lineage)
            self.assertEqual(list(refreshed[1]), ["repo", "fork", "size", "lineage", "rank"])
            self.assertEqual(lookup.call_count, 2)


if __name__ == "__main__":
    unittest.main()
