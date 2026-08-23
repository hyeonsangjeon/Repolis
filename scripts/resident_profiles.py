#!/usr/bin/env python3
"""Deterministic, public-safe repository resident profile artifacts."""

from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

PROFILE_SCHEMA = "repolis.resident-profile"
PROFILE_VERSION = 1
MANIFEST_SCHEMA = "repolis.resident-manifest"
MANIFEST_VERSION = 1
REGISTRY_SCHEMA = "repolis.resident-registry"
REGISTRY_VERSION = 1
PROFILE_MAX_BYTES = 12_000
MANIFEST_MAX_BYTES = 64_000
MAX_CONCERNS = 3
MAX_BOUND_MEMORIES = 4

ACTIVE_RESIDENT_SLOTS = (
    {"resident_id": "sol", "name": {"ko": "\uc194", "en": "Sol"}},
    {"resident_id": "jun", "name": {"ko": "\uc900", "en": "Jun"}},
    {"resident_id": "nari", "name": {"ko": "\ub098\ub9ac", "en": "Nari"}},
    {"resident_id": "tae", "name": {"ko": "\ud0dc", "en": "Tae"}},
    {"resident_id": "rin", "name": {"ko": "\ub9b0", "en": "Rin"}},
    {"resident_id": "mira", "name": {"ko": "\ubbf8\ub77c", "en": "Mira"}},
    {"resident_id": "kai", "name": {"ko": "\uce74\uc774", "en": "Kai"}},
    {"resident_id": "noa", "name": {"ko": "\ub178\uc544", "en": "Noa"}},
    {"resident_id": "auri", "name": {"ko": "\uc544\uc6b0\ub9ac", "en": "AURI"}},
)

JOB_RULES = (
    {
        "key": "model_smith",
        "labels": {"ko": "AI \ubaa8\ub378 \uc7a5\uc778", "en": "AI model smith"},
        "color": "#8faef5",
        "prop": "orb",
        "languages": {"jupyter notebook"},
        "topics": {"ai", "agent", "agents", "llm", "machine-learning", "rag"},
    },
    {
        "key": "harbor_engineer",
        "labels": {"ko": "\ud56d\uad6c \uc2dc\uc2a4\ud15c \uae30\uc220\uc790", "en": "harbor systems engineer"},
        "color": "#4fbfae",
        "prop": "toolbox",
        "languages": {"dockerfile", "powershell", "shell"},
        "topics": {"automation", "ci", "devops", "docker", "homelab", "nas", "server"},
    },
    {
        "key": "interface_gardener",
        "labels": {"ko": "\uc778\ud130\ud398\uc774\uc2a4 \uc815\uc6d0\uc0ac", "en": "interface gardener"},
        "color": "#e8a956",
        "prop": "sprout",
        "languages": {"html", "javascript", "typescript"},
        "topics": {"app", "dashboard", "frontend", "pwa", "ui", "web"},
    },
    {
        "key": "archive_curator",
        "labels": {"ko": "\uae30\ub85d \ubcf4\uad00\uad00", "en": "archive curator"},
        "color": "#62b979",
        "prop": "book",
        "languages": set(),
        "topics": {"docs", "documentation", "education", "knowledge", "readme", "tutorial"},
    },
    {
        "key": "data_cartographer",
        "labels": {"ko": "\ub370\uc774\ud130 \uc9c0\ub3c4\uc81c\uc791\uc790", "en": "data cartographer"},
        "color": "#a98ce3",
        "prop": "ledger",
        "languages": {"python", "r"},
        "topics": {"analytics", "csv", "data", "dataset", "etl", "pipeline", "scraping"},
    },
    {
        "key": "repo_steward",
        "labels": {"ko": "\ub808\ud3ec \uad00\ub9ac\uc778", "en": "repository steward"},
        "color": "#d7af62",
        "prop": "badge",
        "languages": set(),
        "topics": set(),
    },
)

PERSONALITIES = {
    "quiet_keeper": {
        "labels": {"ko": "\uc870\uc6a9\ud55c \uae30\ub85d\uac00", "en": "quiet keeper"},
        "basis": "The repository is archived, so no ongoing activity is inferred.",
    },
    "release_minded": {
        "labels": {"ko": "\ub9c8\uac10\uc744 \ucc59\uae30\ub294 \uc81c\uc791\uc790", "en": "release-minded maker"},
        "basis": "A public release falls within the bounded recent activity window.",
    },
    "active_tinkerer": {
        "labels": {"ko": "\uc790\uc8fc \uc190\ubcf4\ub294 \uc2e4\ud5d8\uac00", "en": "active tinkerer"},
        "basis": "The latest public push falls within the bounded recent activity window.",
    },
    "patient_triager": {
        "labels": {"ko": "\ucc28\uadfc\ucc28\uadfc \uc815\ub9ac\ud558\ub294 \uc870\uc728\uc790", "en": "patient triager"},
        "basis": "The public repository reports a comparatively large open work queue.",
    },
    "steady_maintainer": {
        "labels": {"ko": "\uafb8\uc900\ud55c \uc720\uc9c0\ubcf4\uc218\uc790", "en": "steady maintainer"},
        "basis": "Public history contains recent bounded maintenance evidence.",
    },
    "reserved_observer": {
        "labels": {"ko": "\uc2e0\uc911\ud55c \uad00\ucc30\uc790", "en": "reserved observer"},
        "basis": "Available public metadata is too limited for a stronger activity claim.",
    },
}

_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HTML_RE = re.compile(r"<[^>]{0,512}>")
_SPACE_RE = re.compile(r"\s+")
_SAFE_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$")
_PROMPT_RE = re.compile(
    r"(?i)\b(?:ignore|disregard|override|forget)\b.{0,32}\b(?:instruction|prompt|system|developer)\b"
    r"|\b(?:system|developer|assistant)\s*(?:message|prompt)?\s*:"
    r"|<\s*/?\s*(?:system|assistant|developer|tool)\b"
)
_SECRET_RES = (
    re.compile(r"(?i)\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{16,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"(?i)\b(?:sk|rk|pk)-(?:live-|test-)?[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    re.compile(r"(?i)-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)\b(?:authorization|api[_ -]?key|access[_ -]?token)\s*[:=]\s*\S+"),
    re.compile(r"\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b"),
)


class ResidentArtifactError(ValueError):
    """Raised when public resident artifacts cannot be emitted safely."""


def _stable_bytes(value):
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def _sha256(data):
    return hashlib.sha256(data).hexdigest()


def _parse_time(value):
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if len(text) == 10:
        text += "T00:00:00Z"
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _iso_clock(value):
    parsed = _parse_time(value)
    return parsed.replace(microsecond=0).isoformat().replace("+00:00", "Z") if parsed else ""


def safe_repo_slug(name):
    raw = str(name or "").strip().lower()
    if "/" in raw or "\\" in raw or raw in {".", ".."} or ".." in raw:
        raise ResidentArtifactError("unsafe resident repo name")
    slug = re.sub(r"[^a-z0-9._-]+", "-", raw).strip("._-")
    if not _SAFE_SLUG_RE.fullmatch(slug):
        raise ResidentArtifactError("unsafe resident slug")
    return slug


def _contains_secret(value):
    return any(pattern.search(value) for pattern in _SECRET_RES)


def sanitize_public_text(value, max_chars):
    raw = html.unescape(str(value or ""))
    raw = _CONTROL_RE.sub(" ", raw)
    raw = _HTML_RE.sub(" ", raw)
    raw = raw.replace("<", " ").replace(">", " ")
    cleaned = _SPACE_RE.sub(" ", raw).strip()
    if not cleaned:
        return "", "empty"
    if _PROMPT_RE.search(cleaned):
        return "", "instruction_like"
    if _contains_secret(cleaned):
        return "", "secret_or_identity_like"
    if len(cleaned) > max_chars:
        clipped = cleaned[: max_chars - 1].rstrip()
        return clipped + "\u2026", "truncated"
    return cleaned, None


def _safe_date(value):
    clock = _iso_clock(value)
    if not clock:
        return ""
    return clock if "T" in str(value or "") else clock[:10]


def _safe_github_url(value, owner, repo):
    try:
        parsed = urlsplit(str(value or ""))
    except ValueError:
        return ""
    prefix = f"/{owner}/{repo}".lower()
    if (
        parsed.scheme != "https"
        or parsed.netloc.lower() != "github.com"
        or not parsed.path.lower().startswith(prefix)
    ):
        return ""
    return urlunsplit(("https", "github.com", parsed.path[:512], "", ""))


def _source_clock(repositories, city_state):
    candidates = [
        city_state.get("last_sap_flow"),
        (city_state.get("season") or {}).get("inputs", {}).get("reference_date"),
        (city_state.get("era") or {}).get("as_of"),
    ]
    candidates.extend(
        value
        for repo in repositories
        for value in (repo.get("pushed"), repo.get("created"))
    )
    parsed = [item for item in (_parse_time(value) for value in candidates) if item]
    if not parsed:
        raise ResidentArtifactError("resident source clock unavailable")
    return max(parsed).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _job_for(repo):
    language = str(repo.get("lang") or "Other").strip()
    language_key = language.lower()
    topics = sorted(
        {
            text
            for topic in repo.get("topics") or []
            if (text := sanitize_public_text(topic, 48)[0])
        },
        key=str.lower,
    )[:12]
    topic_keys = {topic.lower() for topic in topics}
    selected = JOB_RULES[-1]
    for rule in JOB_RULES[:-1]:
        if language_key in rule["languages"] or topic_keys.intersection(rule["topics"]):
            selected = rule
            break
    return {
        "key": selected["key"],
        "labels": selected["labels"],
        "color": selected["color"],
        "prop": selected["prop"],
        "basis": {
            "language": language[:48],
            "matched_topics": sorted(topic_keys.intersection(selected["topics"]))[:6],
            "rule": "bounded-language-topic-v1",
        },
    }


def _days_between(earlier, later):
    start, end = _parse_time(earlier), _parse_time(later)
    if not start or not end:
        return None
    return max(0, (end.date() - start.date()).days)


def _personality_for(repo, history, clock):
    pushed_days = _days_between(repo.get("pushed"), clock)
    release_dates = [
        item.get("published_at") or item.get("created_at")
        for item in history.get("releases") or []
    ]
    release_days = min(
        (days for value in release_dates if (days := _days_between(value, clock)) is not None),
        default=None,
    )
    if repo.get("archived"):
        key = "quiet_keeper"
    elif release_days is not None and release_days <= 90:
        key = "release_minded"
    elif pushed_days is not None and pushed_days <= 30:
        key = "active_tinkerer"
    elif int(repo.get("open_issues") or 0) >= 10:
        key = "patient_triager"
    elif any(history.get(kind) for kind in ("commits", "issues", "pull_requests", "releases")):
        key = "steady_maintainer"
    else:
        key = "reserved_observer"
    definition = PERSONALITIES[key]
    return {
        "key": key,
        "labels": definition["labels"],
        "basis": definition["basis"],
        "signals": {
            "days_since_latest_push": pushed_days,
            "days_since_latest_release": release_days,
            "open_issue_count": max(0, int(repo.get("open_issues") or 0)),
        },
    }


def _sanitize_history_item(item, kind, owner, repo_name, title_key, date_key):
    if not isinstance(item, dict):
        return None, "invalid"
    title, reason = sanitize_public_text(item.get(title_key), 120)
    if not title:
        return None, reason or "empty"
    url = _safe_github_url(item.get("url"), owner, repo_name)
    occurred = _safe_date(item.get(date_key))
    if not url or not occurred:
        return None, "invalid_source"
    output = {
        "kind": kind,
        "title": title,
        "url": url,
        "occurred_at": occurred,
    }
    number = item.get("number")
    if isinstance(number, int) and 0 < number < 2_147_483_647:
        output["number"] = number
    sha = str(item.get("oid") or item.get("sha") or "")
    if kind == "commit" and re.fullmatch(r"[a-f0-9]{7,64}", sha, re.I):
        output["commit"] = sha[:12].lower()
    return output, reason


def _recent_concerns(history, owner, repo_name):
    items = []
    dropped = 0
    for kind, key in (("issue", "issues"), ("pull_request", "pull_requests")):
        for raw in history.get(key) or []:
            item, reason = _sanitize_history_item(
                raw, kind, owner, repo_name, "title", "updated_at"
            )
            if item:
                items.append(item)
            elif reason:
                dropped += 1
    items.sort(key=lambda item: (item["occurred_at"], item["kind"], item.get("number", 0)), reverse=True)
    return items[:MAX_CONCERNS], dropped


def _bound_memories(history, owner, repo_name):
    memories = []
    dropped = 0
    plans = (
        ("release", "releases", "name", "published_at", 1),
        ("commit", "commits", "message", "committed_at", 2),
        ("issue", "history_issues", "title", "updated_at", 1),
        ("pull_request", "history_pull_requests", "title", "updated_at", 1),
    )
    for kind, key, title_key, date_key, limit in plans:
        added = 0
        for raw in history.get(key) or []:
            candidate = dict(raw) if isinstance(raw, dict) else raw
            if kind == "release" and isinstance(candidate, dict) and not candidate.get("name"):
                candidate["name"] = candidate.get("tag_name")
            item, reason = _sanitize_history_item(
                candidate, kind, owner, repo_name, title_key, date_key
            )
            if item:
                memories.append(item)
                added += 1
                if added >= limit:
                    break
            elif reason:
                dropped += 1
        if len(memories) >= MAX_BOUND_MEMORIES:
            break
    memories.sort(key=lambda item: (item["occurred_at"], item["kind"], item["title"]), reverse=True)
    return memories[:MAX_BOUND_MEMORIES], dropped


def _shared_reference(city_state):
    season = city_state.get("season") or {}
    era = city_state.get("era") or {}
    return {
        "city_state": {
            "schema": city_state.get("schema"),
            "version": city_state.get("version"),
            "as_of": _safe_date(era.get("as_of")),
            "season": season.get("value"),
            "last_sap_flow": _iso_clock(city_state.get("last_sap_flow")),
        }
    }


def build_resident_profile(repo, history, owner, city_state, generated_at):
    if repo.get("private") is True or str(repo.get("visibility") or "public").lower() == "private":
        raise ResidentArtifactError("private repository rejected")
    repo_name = str(repo.get("repo") or "").strip()
    slug = safe_repo_slug(repo_name)
    created = _safe_date(repo.get("created"))
    age_days = _days_between(created, generated_at)
    if not created or age_days is None:
        raise ResidentArtifactError(f"resident creation date unavailable: {repo_name}")
    summary, summary_reason = sanitize_public_text(repo.get("desc"), 240)
    concerns, concern_dropped = _recent_concerns(history, owner, repo_name)
    memories, memory_dropped = _bound_memories(history, owner, repo_name)
    missing = []
    for key in ("issues", "pull_requests", "commits", "releases"):
        if not history.get(key):
            missing.append(key)
    profile = {
        "schema": PROFILE_SCHEMA,
        "version": PROFILE_VERSION,
        "generated_at": generated_at,
        "repo": {
            "owner": owner,
            "name": repo_name,
            "slug": slug,
            "url": _safe_github_url(repo.get("url"), owner, repo_name)
            or f"https://github.com/{owner}/{repo_name}",
            "summary": summary or None,
            "language": str(repo.get("lang") or "Other")[:48],
            "topics": _job_for(repo)["basis"]["matched_topics"],
        },
        "age": {
            "created_on": created[:10],
            "days": age_days,
            "years": round(age_days / 365.2425, 2),
            "basis": "public_repository_created_at",
        },
        "job": _job_for(repo),
        "personality": _personality_for(repo, history, generated_at),
        "recent_concerns": concerns,
        "bound_memories": memories,
        "shared": _shared_reference(city_state),
        "archived": bool(repo.get("archived")),
        "dialogue_available": not bool(repo.get("archived")),
        "provenance": {
            "repository_visibility": "public",
            "profile_rule": "rules-first-v1",
            "build_time_llm": False,
            "history_available": bool(history.get("available")),
            "unavailable_or_empty": missing,
            "sanitization": {
                "dropped_items": concern_dropped + memory_dropped,
                "summary": summary_reason,
            },
        },
    }
    validate_profile(profile)
    return profile


def _walk_strings(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from _walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_strings(item)
    elif isinstance(value, str):
        yield value


def validate_profile(profile):
    errors = []
    required = {
        "schema", "version", "generated_at", "repo", "age", "job", "personality",
        "recent_concerns", "bound_memories", "shared", "archived",
        "dialogue_available", "provenance",
    }
    if not isinstance(profile, dict) or set(profile) != required:
        errors.append("profile fields invalid")
    if profile.get("schema") != PROFILE_SCHEMA or profile.get("version") != PROFILE_VERSION:
        errors.append("unsupported profile schema")
    repo = profile.get("repo") or {}
    try:
        if repo.get("slug") != safe_repo_slug(repo.get("name")):
            errors.append("repo slug mismatch")
    except ResidentArtifactError as error:
        errors.append(str(error))
    if not re.fullmatch(r"[A-Za-z0-9-]{1,39}", str(repo.get("owner") or "")):
        errors.append("invalid owner")
    if set(repo) != {"owner", "name", "slug", "url", "summary", "language", "topics"}:
        errors.append("repo fields invalid")
    if not isinstance(repo.get("topics"), list) or len(repo["topics"]) > 6:
        errors.append("repo topics invalid")
    if not _DATE_RE.fullmatch(str(profile.get("generated_at") or "")):
        errors.append("invalid generated_at")
    age = profile.get("age")
    if not isinstance(age, dict) or set(age) != {"created_on", "days", "years", "basis"}:
        errors.append("age fields invalid")
    elif (
        not isinstance(age.get("days"), int)
        or age["days"] < 0
        or not isinstance(age.get("years"), (int, float))
        or age["years"] < 0
        or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(age.get("created_on") or ""))
    ):
        errors.append("age values invalid")
    job = profile.get("job")
    if not isinstance(job, dict) or set(job) != {"key", "labels", "color", "prop", "basis"}:
        errors.append("job fields invalid")
    personality = profile.get("personality")
    if not isinstance(personality, dict) or set(personality) != {"key", "labels", "basis", "signals"}:
        errors.append("personality fields invalid")
    concerns = profile.get("recent_concerns")
    memories = profile.get("bound_memories")
    if not isinstance(concerns, list) or len(concerns) > MAX_CONCERNS:
        errors.append("concern cap exceeded")
    if not isinstance(memories, list) or len(memories) > MAX_BOUND_MEMORIES:
        errors.append("memory cap exceeded")
    for item in (concerns if isinstance(concerns, list) else []) + (
        memories if isinstance(memories, list) else []
    ):
        if (
            not isinstance(item, dict)
            or item.get("kind") not in {"issue", "pull_request", "release", "commit"}
            or not isinstance(item.get("title"), str)
            or not item["title"]
            or len(item["title"]) > 120
            or not _DATE_RE.fullmatch(str(item.get("occurred_at") or ""))
            or not str(item.get("url") or "").startswith("https://github.com/")
        ):
            errors.append("history item invalid")
            break
    if not isinstance(profile.get("shared"), dict) or not isinstance(profile["shared"].get("city_state"), dict):
        errors.append("shared reference invalid")
    if not isinstance(profile.get("provenance"), dict):
        errors.append("provenance invalid")
    if not isinstance(profile.get("archived"), bool) or not isinstance(profile.get("dialogue_available"), bool):
        errors.append("archive flags invalid")
    if profile.get("dialogue_available") is not (not bool(profile.get("archived"))):
        errors.append("archive dialogue mismatch")
    for value in _walk_strings(profile):
        if _CONTROL_RE.search(value) or _contains_secret(value):
            errors.append("unsafe emitted string")
            break
    if len(_stable_bytes(profile)) > PROFILE_MAX_BYTES:
        errors.append("profile byte cap exceeded")
    if errors:
        raise ResidentArtifactError("; ".join(errors))
    return True


def profile_authority_digest(profile):
    """Stable Bound authorization digest; excludes the daily age/shared clock."""
    authority = {
        "schema": profile["schema"],
        "version": profile["version"],
        "repo": {
            "owner": profile["repo"]["owner"],
            "name": profile["repo"]["name"],
            "slug": profile["repo"]["slug"],
            "summary": profile["repo"]["summary"],
        },
        "job": profile["job"],
        "personality": profile["personality"],
        "recent_concerns": profile["recent_concerns"],
        "bound_memories": profile["bound_memories"],
        "archived": profile["archived"],
        "dialogue_available": profile["dialogue_available"],
    }
    return _sha256(_stable_bytes(authority))


def validate_manifest(manifest):
    errors = []
    required = {
        "schema", "version", "generated_at", "owner", "profile_schema",
        "profile_version", "profile_count", "active_count", "registry_digest",
        "profiles", "active_roster",
    }
    if not isinstance(manifest, dict) or set(manifest) != required:
        errors.append("manifest fields invalid")
    if manifest.get("schema") != MANIFEST_SCHEMA or manifest.get("version") != MANIFEST_VERSION:
        errors.append("unsupported manifest schema")
    if not re.fullmatch(r"[A-Za-z0-9-]{1,39}", str(manifest.get("owner") or "")):
        errors.append("invalid manifest owner")
    if not _DATE_RE.fullmatch(str(manifest.get("generated_at") or "")):
        errors.append("invalid manifest generated_at")
    if not re.fullmatch(r"[a-f0-9]{64}", str(manifest.get("registry_digest") or "")):
        errors.append("invalid registry digest")
    profiles = manifest.get("profiles")
    roster = manifest.get("active_roster")
    if not isinstance(profiles, list) or not isinstance(roster, list):
        errors.append("manifest arrays missing")
    else:
        slugs = [entry.get("slug") for entry in profiles]
        repos = [entry.get("repo") for entry in profiles]
        ids = [entry.get("resident_id") for entry in roster]
        if len(slugs) != len(set(slugs)) or len(repos) != len(set(repos)):
            errors.append("profile identity collision")
        if len(ids) != len(set(ids)):
            errors.append("resident id collision")
        if len(roster) > len(ACTIVE_RESIDENT_SLOTS):
            errors.append("active roster cap exceeded")
        known = {entry.get("slug"): entry for entry in profiles}
        for entry in profiles:
            path = str(entry.get("path") or "")
            if path != f"data/residents/{entry.get('slug')}.json":
                errors.append("unsafe profile path")
            if not re.fullmatch(r"[a-f0-9]{64}", str(entry.get("digest") or "")):
                errors.append("invalid profile digest")
            if not re.fullmatch(r"[a-f0-9]{64}", str(entry.get("authority_digest") or "")):
                errors.append("invalid authority digest")
        for active in roster:
            profile = known.get(active.get("slug"))
            if not re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", str(active.get("resident_id") or "")):
                errors.append("invalid resident id")
            if not profile or profile.get("archived") or not profile.get("dialogue_available"):
                errors.append("invalid active resident")
            if profile and active.get("profile_digest") != profile.get("digest"):
                errors.append("active profile digest mismatch")
            if profile and active.get("authority_digest") != profile.get("authority_digest"):
                errors.append("active authority digest mismatch")
    if manifest.get("profile_count") != len(profiles or []):
        errors.append("profile count mismatch")
    if manifest.get("active_count") != len(roster or []):
        errors.append("active count mismatch")
    if len(_stable_bytes(manifest)) > MANIFEST_MAX_BYTES:
        errors.append("manifest byte cap exceeded")
    if errors:
        raise ResidentArtifactError("; ".join(sorted(set(errors))))
    return True


def _registry_module(shared, homes, residents, digest):
    shared_json = json.dumps(shared, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    homes_json = json.dumps(homes, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    residents_json = json.dumps(residents, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return (
        "// Generated by scripts/resident_profiles.py. Do not edit by hand.\n"
        f"export const RESIDENT_REGISTRY_SCHEMA = {json.dumps(REGISTRY_SCHEMA)};\n"
        f"export const RESIDENT_REGISTRY_VERSION = {REGISTRY_VERSION};\n"
        f"export const RESIDENT_REGISTRY_DIGEST = {json.dumps(digest)};\n"
        f"export const RESIDENT_SHARED_CITY = Object.freeze({shared_json});\n"
        f"export const RESIDENT_HOME_INDEX = Object.freeze({homes_json});\n"
        f"export const RESIDENT_REGISTRY = Object.freeze({residents_json});\n"
    ).encode("utf-8")


def write_resident_artifacts(
    repositories,
    histories,
    owner,
    city_state,
    output_dir=Path("data/residents"),
    registry_path=Path("cloudflare-taxi/src/generated/resident-registry.js"),
):
    generated_at = _source_clock(repositories, city_state)
    output_dir = Path(output_dir)
    registry_path = Path(registry_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    registry_path.parent.mkdir(parents=True, exist_ok=True)

    profiles = []
    seen_slugs = {}
    for repo in sorted(repositories, key=lambda item: str(item.get("repo") or "").lower()):
        name = str(repo.get("repo") or "")
        profile = build_resident_profile(
            repo, (histories or {}).get(name, {}), owner, city_state, generated_at
        )
        slug = profile["repo"]["slug"]
        if slug in seen_slugs and seen_slugs[slug] != name:
            raise ResidentArtifactError(f"resident slug collision: {seen_slugs[slug]} / {name}")
        seen_slugs[slug] = name
        data = _stable_bytes(profile)
        path = output_dir / f"{slug}.json"
        path.write_bytes(data)
        profiles.append(
            {
                "repo": name,
                "slug": slug,
                "path": f"data/residents/{slug}.json",
                "digest": _sha256(data),
                "authority_digest": profile_authority_digest(profile),
                "archived": profile["archived"],
                "dialogue_available": profile["dialogue_available"],
                "job_key": profile["job"]["key"],
                "job_color": profile["job"]["color"],
                "job_prop": profile["job"]["prop"],
            }
        )

    reserved = {"index.json", "profile.schema.json", "manifest.schema.json"}
    expected = {f"{entry['slug']}.json" for entry in profiles}
    for path in output_dir.glob("*.json"):
        if path.name not in reserved and path.name not in expected:
            path.unlink()

    by_repo = {profile["repo"]["name"]: profile for profile in (
        json.loads((output_dir / f"{entry['slug']}.json").read_text(encoding="utf-8"))
        for entry in profiles
    )}
    profile_meta = {entry["repo"]: entry for entry in profiles}
    eligible = sorted(
        (
            repo for repo in repositories
            if not repo.get("archived") and repo.get("repo") in by_repo
        ),
        key=lambda item: (int(item.get("rank") or 0), str(item.get("repo") or "").lower()),
    )
    active_roster = []
    registry_residents = {}
    for slot, repo in zip(ACTIVE_RESIDENT_SLOTS, eligible):
        name = repo["repo"]
        profile = by_repo[name]
        meta = profile_meta[name]
        active = {
            "resident_id": slot["resident_id"],
            "name": slot["name"],
            "repo": name,
            "slug": meta["slug"],
            "path": meta["path"],
            "profile_digest": meta["digest"],
            "authority_digest": meta["authority_digest"],
            "job_key": profile["job"]["key"],
            "job_color": profile["job"]["color"],
            "job_prop": profile["job"]["prop"],
        }
        active_roster.append(active)
        registry_residents[slot["resident_id"]] = {
            "resident_id": slot["resident_id"],
            "name": slot["name"],
            "repo": name,
            "slug": meta["slug"],
            "profile_digest": meta["digest"],
            "authority_digest": meta["authority_digest"],
            "archived": profile["archived"],
            "dialogue_available": profile["dialogue_available"],
            "age": profile["age"],
            "job": profile["job"],
            "personality": profile["personality"],
            "summary": profile["repo"]["summary"],
            "recent_concerns": profile["recent_concerns"],
            "bound_memories": profile["bound_memories"],
        }

    homes = {
        entry["slug"]: {
            "repo": entry["repo"],
            "slug": entry["slug"],
            "profile_digest": entry["digest"],
            "authority_digest": entry["authority_digest"],
            "resident_id": next(
                (
                    active["resident_id"]
                    for active in active_roster
                    if active["slug"] == entry["slug"]
                ),
                None,
            ),
            "archived": entry["archived"],
            "dialogue_available": entry["dialogue_available"],
        }
        for entry in profiles
    }
    shared = _shared_reference(city_state)
    registry_payload = {
        "schema": REGISTRY_SCHEMA,
        "version": REGISTRY_VERSION,
        "generated_at": generated_at,
        "shared": shared,
        "homes": homes,
        "residents": registry_residents,
    }
    registry_digest = _sha256(_stable_bytes(registry_payload))
    registry_path.write_bytes(
        _registry_module(shared, homes, registry_residents, registry_digest)
    )

    manifest = {
        "schema": MANIFEST_SCHEMA,
        "version": MANIFEST_VERSION,
        "generated_at": generated_at,
        "owner": owner,
        "profile_schema": PROFILE_SCHEMA,
        "profile_version": PROFILE_VERSION,
        "profile_count": len(profiles),
        "active_count": len(active_roster),
        "registry_digest": registry_digest,
        "profiles": profiles,
        "active_roster": active_roster,
    }
    validate_manifest(manifest)
    (output_dir / "index.json").write_bytes(_stable_bytes(manifest))
    validate_artifact_tree(output_dir, registry_path)
    return {
        "generated_at": generated_at,
        "profiles": len(profiles),
        "active": len(active_roster),
        "manifest_bytes": len(_stable_bytes(manifest)),
        "detail_bytes": sum((output_dir / f"{entry['slug']}.json").stat().st_size for entry in profiles),
        "registry_digest": registry_digest,
    }


def validate_artifact_tree(output_dir, registry_path=None):
    output_dir = Path(output_dir)
    manifest = json.loads((output_dir / "index.json").read_text(encoding="utf-8"))
    validate_manifest(manifest)
    for entry in manifest["profiles"]:
        path = output_dir / f"{entry['slug']}.json"
        data = path.read_bytes()
        if _sha256(data) != entry["digest"]:
            raise ResidentArtifactError(f"profile digest mismatch: {entry['slug']}")
        validate_profile(json.loads(data))
    if registry_path is not None:
        registry_path = Path(registry_path)
        if not registry_path.is_file() or manifest["registry_digest"].encode() not in registry_path.read_bytes():
            raise ResidentArtifactError("resident registry drift")
    return manifest
