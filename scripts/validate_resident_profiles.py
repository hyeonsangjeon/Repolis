#!/usr/bin/env python3
"""Validate generated resident profiles, manifest hashes, and Worker registry drift."""

import argparse
from pathlib import Path

from resident_profiles import validate_artifact_tree


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", nargs="?", default="data/residents")
    parser.add_argument(
        "--registry",
        default="cloudflare-taxi/src/generated/resident-registry.js",
    )
    args = parser.parse_args()
    manifest = validate_artifact_tree(Path(args.directory), Path(args.registry))
    details = sum(
        (Path(args.directory) / f"{entry['slug']}.json").stat().st_size
        for entry in manifest["profiles"]
    )
    print(
        f"resident artifacts valid: profiles={manifest['profile_count']} "
        f"active={manifest['active_count']} "
        f"manifest={(Path(args.directory) / 'index.json').stat().st_size}B "
        f"details={details}B"
    )


if __name__ == "__main__":
    main()
