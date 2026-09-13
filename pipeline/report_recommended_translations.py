"""Report Recommended source names that still lack a reviewed Vietnamese display name."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from pipeline.build_recommended_reference import canonical_bytes, sha
from pipeline.recommended_identity import (
    alias_key,
    build_display_mapping,
    resolve_display_kind,
    resolve_display_name,
    resolve_identity,
    resolve_team_display_name,
)


SCHEMA_VERSION = 1
HEX64 = re.compile(r"[0-9a-f]{64}")
SELECTOR_KEYS = ["generationId", "manifestSha256", "schemaVersion"]
PLACEHOLDERS = {"-", "--", "–", "—", "n/a", "N/A"}
KINDS = ("team", "hero", "tactic", "book")
HOLDER_FIELDS = (("heroes", "primary"), ("alternativeHoldersRaw", "alternative"))
CONTEXT_LIMIT = 3


def read_generation(reference_dir):
    """Read the selected generation index offline, refusing any checksum drift."""
    root = Path(reference_dir)
    selector = json.loads((root / "current.json").read_bytes())
    if (selector.get("schemaVersion") != SCHEMA_VERSION or sorted(selector) != SELECTOR_KEYS
            or not HEX64.fullmatch(str(selector["generationId"])) or not HEX64.fullmatch(str(selector["manifestSha256"]))):
        raise ValueError("Invalid Recommended current selector")
    generation = root / selector["generationId"]
    if generation.is_symlink() or not generation.is_dir():
        raise ValueError("Invalid Recommended generation directory")
    manifest_path = generation / "manifest.json"
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ValueError("Invalid Recommended manifest file")
    manifest_bytes = manifest_path.read_bytes()
    if sha(manifest_bytes) != selector["manifestSha256"]:
        raise ValueError("Recommended manifest hash mismatch")
    manifest = json.loads(manifest_bytes)
    if manifest.get("schemaVersion") != SCHEMA_VERSION or manifest.get("generationId") != selector["generationId"]:
        raise ValueError("Recommended manifest identity mismatch")
    index_path = generation / "index.json"
    if index_path.is_symlink() or not index_path.is_file():
        raise ValueError("Invalid Recommended index file")
    index_bytes = index_path.read_bytes()
    declared = (manifest.get("files") or {}).get("index.json")
    if not isinstance(declared, dict) or declared.get("sha256") != sha(index_bytes) or declared.get("bytes") != len(index_bytes):
        raise ValueError("Recommended index payload differs from manifest")
    index = json.loads(index_bytes)
    if index.get("schemaVersion") != SCHEMA_VERSION or not isinstance(index.get("records"), list):
        raise ValueError("Unsupported Recommended index payload")
    return {"generationId": selector["generationId"], "manifestSha256": selector["manifestSha256"],
            "indexSha256": sha(index_bytes), "records": index["records"]}


def _observations(records):
    """Every raw source name occurrence, in deterministic record order."""
    for row in records:
        context = {"sourceConfigId": row.get("sourceConfigId"), "teamNameRaw": row.get("nameZh"),
                   "sourceUrl": row.get("sourceUrl")}
        yield "team", row.get("nameZh"), "team", context
        for field, holderKind in HOLDER_FIELDS:
            for holder in row.get(field) or []:
                yield "hero", holder.get("nameRaw"), holderKind, context
                for raw in holder.get("tacticSlotsRaw") or []:
                    yield "tactic", raw, holderKind, context
                for raw in holder.get("bookSlotsRaw") or []:
                    yield "book", raw, holderKind, context


def _item_id(kind, key):
    return kind + ":" + hashlib.sha256(canonical_bytes([kind, key])).hexdigest()[:24]


def collect_missing(records, mapping):
    """Group raw names without a reviewed Vietnamese display name by kind and alias key."""
    groups = {}
    resolutions = {}
    for kind, raw, holderKind, context in _observations(records):
        if not isinstance(raw, str):
            continue
        value = " ".join(raw.split())
        if not value or value in PLACEHOLDERS:
            continue
        kind = resolve_display_kind(kind, value, mapping)
        source_config_id = context.get("sourceConfigId") if kind == "team" else None
        cache_key = (kind, source_config_id, value)
        cached = resolutions.get(cache_key)
        if cached is None:
            if kind == "team":
                display = resolve_team_display_name(
                    {"sourceConfigId": source_config_id, "nameZh": value},
                    mapping,
                )
                cached = {"status": "resolved"} if isinstance(display, str) and display.strip() else {
                    "status": "missing",
                    "reason": "no-reviewed-vietnamese-name",
                }
            else:
                resolved = resolve_identity(kind, value, mapping)
                display = resolve_display_name(kind, value, mapping)
                if isinstance(display, str) and display.strip():
                    cached = {"status": "resolved"}
                elif resolved.get("status") == "ambiguous":
                    cached = {"status": "ambiguous", "reason": resolved.get("reason"),
                              "candidates": sorted(resolved.get("candidates") or [])}
                else:
                    cached = {"status": "missing",
                              "reason": "no-reviewed-vietnamese-name" if resolved.get("status") == "resolved" else resolved.get("reason")}
            resolutions[cache_key] = cached
        if cached["status"] == "resolved":
            continue
        key = alias_key(value)
        group_key = (kind, key, None)
        group = groups.setdefault(group_key, {"variants": {}, "contexts": [], "occurrences": 0,
                                               "holderKinds": set(), "sourceConfigIds": set()})
        group["occurrences"] += 1
        group["holderKinds"].add(holderKind)
        if kind == "team" and source_config_id:
            group["sourceConfigIds"].add(source_config_id)
        variant = group["variants"].setdefault(value, {"raw": value, "occurrences": 0, "status": cached["status"],
                                                       "reason": cached.get("reason")})
        variant["occurrences"] += 1
        if cached["status"] == "ambiguous":
            variant["candidates"] = cached["candidates"]
        if len(group["contexts"]) < CONTEXT_LIMIT and context not in group["contexts"]:
            group["contexts"].append(dict(context))
    items = []
    for (kind, key, source_config_id), group in sorted(groups.items(), key=lambda item: tuple("" if value is None else value for value in item[0])):
        variants = [group["variants"][raw] for raw in sorted(group["variants"])]
        item = {
            "itemId": _item_id(kind, [key, source_config_id] if kind == "team" else key),
            "kind": kind,
            "aliasKey": key,
            "status": "ambiguous" if any(variant["status"] == "ambiguous" for variant in variants) else "missing",
            "occurrences": group["occurrences"],
            "holderKinds": sorted(group["holderKinds"]),
            "rawVariants": variants,
            "contextExamples": group["contexts"],
            "displayNameVi": None,
        }
        if kind == "team":
            source_ids = sorted(group["sourceConfigIds"])
            item["sourceConfigIds"] = source_ids
            if len(source_ids) == 1:
                item["sourceConfigId"] = source_ids[0]
        items.append(item)
    return items


def build_report(reference_dir, identity_map):
    generation = read_generation(reference_dir)
    mapping = build_display_mapping(json.loads(Path(identity_map).read_bytes()).get("entries", []))
    items = collect_missing(generation["records"], mapping)
    counts = {"total": len(items), "occurrences": sum(item["occurrences"] for item in items),
              "ambiguous": sum(1 for item in items if item["status"] == "ambiguous")}
    for kind in KINDS:
        scoped = [item for item in items if item["kind"] == kind]
        counts[kind] = {"missingNames": len(scoped), "occurrences": sum(item["occurrences"] for item in scoped)}
    return {"schemaVersion": SCHEMA_VERSION,
            "note": "Điền displayNameVi cho từng tên gốc còn thiếu, rồi cập nhật pipeline/recommended-identity-map.json.",
            "sourceGeneration": {"generationId": generation["generationId"], "manifestSha256": generation["manifestSha256"],
                                 "indexSha256": generation["indexSha256"], "records": len(generation["records"])},
            "mappingHash": mapping["mappingHash"], "counts": counts, "items": items}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference-dir", type=Path, default=Path("src/data/recommended-reference"))
    parser.add_argument("--identity-map", type=Path, default=Path("pipeline/recommended-identity-map.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = build_report(args.reference_dir, args.identity_map)
    args.output.write_text(json.dumps(report, ensure_ascii=False, sort_keys=True, indent=2) + "\n")
    print(f"{report['counts']['total']} missing names in {report['sourceGeneration']['generationId'][:12]} -> {args.output}")


if __name__ == "__main__":
    main()
