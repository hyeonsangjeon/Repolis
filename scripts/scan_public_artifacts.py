#!/usr/bin/env python3
"""Fail publishing on high-confidence tracked secrets or private resident data."""

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_EXCLUSIONS = {
    "scripts/resident_profiles.py",
    "scripts/scan_public_artifacts.py",
    "scripts/test_resident_profiles.py",
}
GLOBAL_PATTERNS = (
    ("github token", re.compile(rb"\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b", re.I)),
    ("aws access key", re.compile(rb"\bAKIA[0-9A-Z]{16}\b")),
    ("private key", re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----", re.I)),
    ("jwt", re.compile(rb"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b")),
)
RESIDENT_PATTERNS = (
    ("private visibility", re.compile(rb'"(?:private|visibility)"\s*:\s*(?:true|"private")', re.I)),
    ("email identity", re.compile(rb"\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b")),
    ("control character", re.compile(rb"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")),
)
LORE_PATTERNS = (
    ("html content", re.compile(rb"<[^>]+>")),
    ("instruction-shaped content", re.compile(
        rb"ignore (?:all|any|previous)|follow (?:these|the) instructions|"
        rb"reveal (?:the )?(?:prompt|secret)|system\s*:",
        re.I,
    )),
    ("internal infrastructure term", re.compile(
        rb"\b(?:openai|anthropic|gemini|cloudflare|azure|worker|api|tokens?|provider|llm|chatgpt)\b",
        re.I,
    )),
    ("control character", re.compile(rb"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")),
)


def tracked_files():
    raw = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
    )
    return [item.decode("utf-8") for item in raw.split(b"\0") if item]


def main():
    findings = []
    scanned = 0
    for relative in tracked_files():
        path = ROOT / relative
        if not path.is_file() or path.stat().st_size > 2_000_000:
            continue
        data = path.read_bytes()
        if b"\0" in data:
            continue
        scanned += 1
        if relative not in SOURCE_EXCLUSIONS:
            for label, pattern in GLOBAL_PATTERNS:
                if pattern.search(data):
                    findings.append(f"{relative}: {label}")
        if relative.startswith("data/residents/") or relative.endswith("resident-registry.js"):
            for label, pattern in RESIDENT_PATTERNS:
                if pattern.search(data):
                    findings.append(f"{relative}: {label}")
        if relative == "data/lore/fragments.json":
            for label, pattern in LORE_PATTERNS:
                if pattern.search(data):
                    findings.append(f"{relative}: {label}")
    if findings:
        raise SystemExit("public artifact scan failed:\n" + "\n".join(sorted(set(findings))))
    print(f"public artifact scan clean: tracked_text_files={scanned}")


if __name__ == "__main__":
    main()
