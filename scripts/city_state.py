#!/usr/bin/env python3
"""Deterministic city-state projection from public repository metadata."""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


SCHEMA_NAME = "repolis.city-state"
SCHEMA_VERSION = 1
SEASONS = ("spring", "summer", "autumn", "winter")
RECENT_WINDOW_DAYS = 30
HISTORICAL_BUCKETS = 6
SILENCE_SCHEMA_NAME = "repolis.silence-ledger"
SILENCE_SCHEMA_VERSION = 1
SILENCE_THRESHOLDS_DAYS = (365, 730)


def _parse_datetime(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        if len(text) == 10:
            return datetime.fromisoformat(text).replace(tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def _iso_z(value):
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _repo_name(repo):
    return str(repo.get("repo") or repo.get("name") or "").strip()


def _public_repositories(repositories):
    projected = []
    for repo in repositories or []:
        if not isinstance(repo, dict) or repo.get("private") is True:
            continue
        name = _repo_name(repo)
        if not name:
            continue
        projected.append(repo)
    return sorted(projected, key=lambda repo: (_repo_name(repo).casefold(), _repo_name(repo)))


def _reference_time(repositories, source_timestamps, as_of=None):
    if as_of is not None:
        parsed = _parse_datetime(as_of)
        if not parsed:
            raise ValueError("city-state as_of must be an ISO-8601 date or timestamp")
        return parsed
    candidates = []
    for value in (source_timestamps or {}).values():
        parsed = _parse_datetime(value)
        if parsed:
            candidates.append(parsed)
    if not candidates:
        for repo in repositories:
            for key in ("updated_at", "pushed", "pushed_at", "created", "created_at"):
                parsed = _parse_datetime(repo.get(key))
                if parsed:
                    candidates.append(parsed)
                    break
    return max(candidates) if candidates else datetime(1970, 1, 1, tzinfo=timezone.utc)


def _season(repositories, reference_day):
    pushed_days = []
    for repo in repositories:
        pushed = _parse_datetime(repo.get("pushed") or repo.get("pushed_at"))
        if pushed:
            pushed_days.append(pushed.date())

    recent_start = reference_day - timedelta(days=RECENT_WINDOW_DAYS - 1)
    recent_count = sum(recent_start <= pushed <= reference_day for pushed in pushed_days)
    historical_counts = []
    for bucket in range(HISTORICAL_BUCKETS):
        end = reference_day - timedelta(days=RECENT_WINDOW_DAYS * (bucket + 1))
        start = end - timedelta(days=RECENT_WINDOW_DAYS - 1)
        historical_counts.append(sum(start <= pushed <= end for pushed in pushed_days))

    historical_average = sum(historical_counts) / HISTORICAL_BUCKETS
    populated_buckets = sum(count > 0 for count in historical_counts)
    history_sufficient = sum(historical_counts) >= HISTORICAL_BUCKETS and populated_buckets >= 3
    ratio = recent_count / historical_average if historical_average > 0 else None
    active_share = recent_count / len(repositories) if repositories else 0

    fallback_rule = (
        "When fewer than six prior latest-push signals span at least three 30-day buckets, "
        "use the share of repositories whose latest push is in the recent 30-day window: "
        "spring >= 0.35, summer >= 0.12, autumn > 0, otherwise winter."
    )
    if history_sufficient:
        if ratio >= 1.35:
            value = "spring"
        elif ratio >= 0.85:
            value = "summer"
        elif ratio >= 0.45:
            value = "autumn"
        else:
            value = "winter"
        reason = (
            f"Recent latest-push count is {ratio:.2f}x the average of the prior "
            f"{HISTORICAL_BUCKETS} 30-day buckets."
        )
        fallback_used = False
    else:
        if recent_count == 0:
            value = "winter"
        elif active_share >= 0.35:
            value = "spring"
        elif active_share >= 0.12:
            value = "summer"
        else:
            value = "autumn"
        reason = (
            "Historical latest-push coverage is insufficient; "
            f"{recent_count} of {len(repositories)} repositories are recent."
        )
        fallback_used = True

    return {
        "value": value,
        "inputs": {
            "reference_date": reference_day.isoformat(),
            "activity_signal": "latest_push_per_repository",
            "recent_window_days": RECENT_WINDOW_DAYS,
            "recent_active_repositories": recent_count,
            "historical_bucket_days": RECENT_WINDOW_DAYS,
            "historical_bucket_counts": historical_counts,
            "historical_average": round(historical_average, 3),
            "recent_to_historical_ratio": round(ratio, 3) if ratio is not None else None,
            "active_repository_share": active_share,
            "repositories_with_push_date": len(pushed_days),
        },
        "reason": reason,
        "fallback": {
            "used": fallback_used,
            "rule": fallback_rule,
        },
    }


def _silence(repositories, reference_day):
    unarchived = [repo for repo in repositories if not bool(repo.get("archived"))]
    dated = []
    for repo in unarchived:
        pushed = _parse_datetime(repo.get("pushed") or repo.get("pushed_at"))
        if not pushed:
            continue
        elapsed_days = max(0, (reference_day - pushed.date()).days)
        dated.append({
            "repo": _repo_name(repo),
            "last_public_push": pushed.date().isoformat(),
            "elapsed_days": elapsed_days,
        })

    dated.sort(key=lambda item: (-item["elapsed_days"], item["repo"].casefold(), item["repo"]))
    quiet_365 = sum(item["elapsed_days"] >= SILENCE_THRESHOLDS_DAYS[0] for item in dated)
    quiet_730 = sum(item["elapsed_days"] >= SILENCE_THRESHOLDS_DAYS[1] for item in dated)
    return {
        "schema": SILENCE_SCHEMA_NAME,
        "version": SILENCE_SCHEMA_VERSION,
        "reference_date": reference_day.isoformat(),
        "scope": "unarchived_public_repositories",
        "activity_signal": "latest_public_push",
        "thresholds_days": list(SILENCE_THRESHOLDS_DAYS),
        "repositories": {
            "total": len(unarchived),
            "with_push_date": len(dated),
            "without_push_date": len(unarchived) - len(dated),
        },
        "quiet": {
            "at_least_365_days": quiet_365,
            "at_least_730_days": quiet_730,
            "longest": dated[0] if dated else None,
        },
    }


def _achievement(repo):
    text = re.sub(r"\s+", " ", str(repo.get("desc") or repo.get("description") or "")).strip()
    if not text:
        language = str(repo.get("lang") or repo.get("language") or "public").strip()
        text = f"A public {language} repository preserved as part of the city's history."
    return text if len(text) <= 180 else text[:177].rstrip() + "..."


def _root(repo):
    created = _parse_datetime(repo.get("created") or repo.get("created_at"))
    pushed = _parse_datetime(repo.get("pushed") or repo.get("pushed_at"))
    start_year = created.year if created else None
    end_year = (pushed or created).year if (pushed or created) else None
    count = (end_year - start_year + 1) if start_year is not None and end_year is not None else None
    return {
        "repo": _repo_name(repo),
        "active_years": {
            "from": start_year,
            "to": end_year,
            "count": max(1, count) if count is not None else None,
        },
        "achievement": _achievement(repo),
    }


def build_city_state(repositories, source_timestamps=None, *, as_of=None):
    public = _public_repositories(repositories)
    reference_time = _reference_time(public, source_timestamps, as_of)
    reference_day = reference_time.date()
    dated = [
        (parsed.date(), _repo_name(repo))
        for repo in public
        if (parsed := _parse_datetime(repo.get("created") or repo.get("created_at")))
    ]
    founded_on, oldest_repo = min(dated) if dated else (reference_day, "")
    age_days = max(0, (reference_day - founded_on).days)

    languages = Counter(str(repo.get("lang") or repo.get("language") or "Other") for repo in public)
    language_distribution = [
        {"language": language, "repositories": count}
        for language, count in sorted(languages.items(), key=lambda item: (-item[1], item[0].casefold(), item[0]))
    ]
    archived = [repo for repo in public if bool(repo.get("archived"))]
    push_count = sum(bool(_parse_datetime(repo.get("pushed") or repo.get("pushed_at"))) for repo in public)

    state = {
        "schema": SCHEMA_NAME,
        "version": SCHEMA_VERSION,
        "era": {
            "founded_on": founded_on.isoformat(),
            "oldest_repository": oldest_repo,
            "as_of": reference_day.isoformat(),
            "city_age_days": age_days,
            "city_age_years": round(age_days / 365.2425, 2),
            "city_year": math.floor(age_days / 365.2425) + 1,
            "basis": "Oldest creation date among the public repositories included in repos.json.",
        },
        "season": _season(public, reference_day),
        "silence": _silence(public, reference_day),
        "stats": {
            "repository_count": len(public),
            "active_repository_count": len(public) - len(archived),
            "archived_repository_count": len(archived),
            "total_stars": sum(max(0, int(repo.get("stars") or 0)) for repo in public),
            "total_forks": sum(max(0, int(repo.get("forks") or 0)) for repo in public),
            "language_distribution": language_distribution,
            "latest_push_signal": {
                "repositories_with_push_date": push_count,
                "recent_30d_repositories": 0,
            },
            "commit_history": {
                "available": False,
                "total": None,
                "limitation": (
                    "The build input exposes each repository's latest push timestamp, not complete commit history; "
                    "no commit total is inferred."
                ),
            },
        },
        "last_sap_flow": _iso_z(reference_time),
        "roots": [_root(repo) for repo in archived],
    }
    state["stats"]["latest_push_signal"]["recent_30d_repositories"] = state["season"]["inputs"][
        "recent_active_repositories"
    ]
    return state


def serialize_city_state(state):
    return json.dumps(state, allow_nan=False, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def write_city_state(path, state):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(serialize_city_state(state), encoding="utf-8")
