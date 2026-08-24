"""Public-safe fork source projection for generated Repolis repo data."""

from __future__ import annotations

import json
import re
import subprocess
from urllib.parse import urlparse


_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
_REPO_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")


def normalize_repo_name(value):
    if not isinstance(value, str) or value.count("/") != 1:
        return None
    owner, repo = value.strip().split("/", 1)
    if not _OWNER_RE.fullmatch(owner) or not _REPO_RE.fullmatch(repo):
        return None
    return f"{owner}/{repo}"


def canonical_github_repo_url(value, expected_name):
    if not isinstance(value, str):
        return None
    try:
        parsed = urlparse(value)
        invalid = (
            parsed.scheme != "https"
            or parsed.hostname != "github.com"
            or parsed.port is not None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.params
            or parsed.query
            or parsed.fragment
        )
    except ValueError:
        return None
    if invalid:
        return None
    path_name = normalize_repo_name(parsed.path.strip("/"))
    if not path_name or path_name.lower() != expected_name.lower():
        return None
    return f"https://github.com/{expected_name}"


def sanitize_fork_lineage(payload, current_full_name):
    if not isinstance(payload, dict) or payload.get("fork") is not True:
        return None
    current = normalize_repo_name(current_full_name)
    source = payload.get("source") or payload.get("parent")
    if not current or not isinstance(source, dict):
        return None
    if source.get("private") is True or str(source.get("visibility") or "public").lower() != "public":
        return None
    name = normalize_repo_name(source.get("full_name") or source.get("nameWithOwner"))
    if not name or name.lower() == current.lower():
        return None
    url = canonical_github_repo_url(source.get("html_url") or source.get("url"), name)
    if not url:
        return None
    return {"source": name, "url": url}


def public_fork_lineage(full_name):
    """Return a minimal public source record, or None when GitHub cannot prove one."""
    current = normalize_repo_name(full_name)
    if not current:
        return None
    try:
        raw = subprocess.check_output(
            ["gh", "api", f"/repos/{current}"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        payload = json.loads(raw)
    except (subprocess.CalledProcessError, json.JSONDecodeError, ValueError):
        return None
    return sanitize_fork_lineage(payload, current)
