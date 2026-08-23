#!/usr/bin/env python3
"""Validate city-state.json against its checked-in JSON Schema without dependencies."""

from __future__ import annotations

import argparse
import json
import math
import re
from datetime import date, datetime
from pathlib import Path


TYPE_MAP = {
    "array": list,
    "boolean": bool,
    "integer": int,
    "null": type(None),
    "number": (int, float),
    "object": dict,
    "string": str,
}


def _matches_type(value, expected):
    allowed = expected if isinstance(expected, list) else [expected]
    for item in allowed:
        py_type = TYPE_MAP[item]
        if item in ("integer", "number") and isinstance(value, bool):
            continue
        if isinstance(value, py_type):
            return True
    return False


def _format_ok(value, fmt):
    try:
        if fmt == "date":
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value) is None:
                return False
            date.fromisoformat(value)
        elif fmt == "date-time":
            if re.fullmatch(
                r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})",
                value,
            ) is None:
                return False
            if datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is None:
                return False
        return True
    except (TypeError, ValueError):
        return False


def validate(instance, schema, path="$"):
    errors = []
    expected = schema.get("type")
    if expected is not None and not _matches_type(instance, expected):
        return [f"{path}: expected {expected}, got {type(instance).__name__}"]
    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: expected constant {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: expected one of {schema['enum']!r}")

    if isinstance(instance, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in instance:
                errors.append(f"{path}: missing required property {key!r}")
        properties = schema.get("properties", {})
        for key, value in instance.items():
            child = properties.get(key)
            if child is None:
                if schema.get("additionalProperties") is False:
                    errors.append(f"{path}: unexpected property {key!r}")
                continue
            errors.extend(validate(value, child, f"{path}.{key}"))

    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            errors.append(f"{path}: expected at least {schema['minItems']} items")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            errors.append(f"{path}: expected at most {schema['maxItems']} items")
        item_schema = schema.get("items")
        if item_schema:
            for index, value in enumerate(instance):
                errors.extend(validate(value, item_schema, f"{path}[{index}]"))

    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0):
            errors.append(f"{path}: string is shorter than {schema['minLength']}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: string is longer than {schema['maxLength']}")
        if "pattern" in schema and re.search(schema["pattern"], instance) is None:
            errors.append(f"{path}: does not match {schema['pattern']!r}")
        if "format" in schema and not _format_ok(instance, schema["format"]):
            errors.append(f"{path}: invalid {schema['format']}")

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if not math.isfinite(instance):
            return [f"{path}: number must be finite"]
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: must be >= {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: must be <= {schema['maximum']}")
    return errors


def load_and_validate(data_path, schema_path):
    def reject_non_finite(value):
        raise ValueError(f"non-finite number {value}")

    try:
        data = json.loads(
            Path(data_path).read_text(encoding="utf-8"),
            parse_constant=reject_non_finite,
        )
    except (json.JSONDecodeError, ValueError) as error:
        return [f"$: invalid JSON: {error}"]
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    return validate(data, schema)


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("data", nargs="?", default=root / "data" / "city-state.json", type=Path)
    parser.add_argument("--schema", default=root / "data" / "city-state.schema.json", type=Path)
    args = parser.parse_args()
    errors = load_and_validate(args.data, args.schema)
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print(f"valid city state: {args.data}")


if __name__ == "__main__":
    main()
