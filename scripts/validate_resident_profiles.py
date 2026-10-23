#!/usr/bin/env python3
"""Validate generated resident profiles, manifest hashes, schemas, and Worker registry drift."""

import argparse
import json
from pathlib import Path

from resident_profiles import validate_artifact_tree
from validate_city_state import validate as schema_errors


def artifact_schema_errors(directory, manifest, schema_dir=None):
    """Check the manifest and every profile against the checked-in JSON Schemas."""
    directory = Path(directory)
    schema_dir = Path(schema_dir) if schema_dir is not None else directory
    schemas = {
        name: json.loads((schema_dir / f"{name}.schema.json").read_text(encoding="utf-8"))
        for name in ("manifest", "profile")
    }
    errors = [f"index.json {error}" for error in schema_errors(manifest, schemas["manifest"])]
    for entry in manifest["profiles"]:
        profile = json.loads((directory / f"{entry['slug']}.json").read_text(encoding="utf-8"))
        errors.extend(
            f"{entry['slug']}.json {error}" for error in schema_errors(profile, schemas["profile"])
        )
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", nargs="?", default="data/residents")
    parser.add_argument(
        "--registry",
        default="cloudflare-taxi/src/generated/resident-registry.js",
    )
    args = parser.parse_args()
    manifest = validate_artifact_tree(Path(args.directory), Path(args.registry))
    errors = artifact_schema_errors(args.directory, manifest)
    if errors:
        raise SystemExit("resident schema invalid:\n" + "\n".join(errors[:20]))
    details = sum(
        (Path(args.directory) / f"{entry['slug']}.json").stat().st_size
        for entry in manifest["profiles"]
    )
    print(
        f"resident artifacts valid: profiles={manifest['profile_count']} "
        f"active={manifest['active_count']} "
        f"as_of={manifest['shared']['city_state']['as_of']} "
        f"manifest={(Path(args.directory) / 'index.json').stat().st_size}B "
        f"details={details}B"
    )


if __name__ == "__main__":
    main()
