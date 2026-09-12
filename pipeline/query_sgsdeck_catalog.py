"""Validate and query the normalized private SGSDeck snapshot without network access."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import unicodedata
from datetime import datetime
from pathlib import Path

from .sgsdeck_identity import canonical_corpus, validate_record_ref
from .sgsdeck_source import validate_source_url


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CATEGORIES = ("generals", "tactics", "equipment", "advisors", "troop-mods", "buildings")


def _search_key(value):
    normalized = unicodedata.normalize("NFD", str(value or "").lower().replace("đ", "d"))
    return "".join(char for char in normalized if not unicodedata.combining(char) and char.isalnum())


def _read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid SGSDeck JSON: {path}") from error


def _validated_manifest(catalog_dir: Path):
    manifest = _read_json(catalog_dir / "manifest.json")
    if (manifest.get("schemaVersion") != 1 or manifest.get("provider") != "sgsdeck"
            or manifest.get("region") != "TW" or not isinstance(manifest.get("fetchedAt"), str)):
        raise ValueError("invalid SGSDeck normalized manifest contract")
    try:
        fetched_at = datetime.fromisoformat(manifest["fetchedAt"])
    except ValueError as error:
        raise ValueError("invalid SGSDeck normalized manifest fetchedAt") from error
    if fetched_at.tzinfo is None:
        raise ValueError("SGSDeck normalized manifest fetchedAt needs a timezone")
    files = manifest.get("files")
    inventory = manifest.get("inventory")
    if not isinstance(files, dict) or set(files) != set(CATEGORIES):
        raise ValueError("SGSDeck normalized manifest must contain all six categories")
    if not isinstance(inventory, dict) or set(inventory) != set(CATEGORIES):
        raise ValueError("SGSDeck normalized manifest inventory is incomplete")
    for category, digest in files.items():
        if not isinstance(digest, str) or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
            raise ValueError(f"invalid SGSDeck catalog digest: {category}")
    return manifest


def _validate_record_shape(record):
    required = {
        "id", "sourceId", "nameZh", "nameVi", "canonicalRef", "attributes",
        "provenance", "sourceSeason", "verification", "missingFields",
    }
    if not isinstance(record, dict):
        raise ValueError("SGSDeck record must be an object")
    missing = required - set(record)
    if missing:
        raise ValueError(f"SGSDeck record is missing required fields: {sorted(missing)}")


def _child_count(category, records, children=()):
    if category == "equipment":
        return len(children)
    field = "options" if category == "troop-mods" else "levels" if category == "buildings" else None
    if field is None:
        return 0
    return sum(len(record["attributes"].get(field, [])) for record in records)


def _validate_equipment_children(children, records, fetched_at):
    if not isinstance(children, list):
        raise ValueError("SGSDeck equipment children must be a list")
    parent_ids = {record["sourceId"] for record in records}
    seen = set()
    for child in children:
        if not isinstance(child, dict):
            raise ValueError("SGSDeck equipment child must be an object")
        source_id = child.get("sourceId")
        if child.get("id") != f"sgsdeck:equipment-special:{source_id}":
            raise ValueError("SGSDeck equipment child ID does not match source identity")
        if not isinstance(source_id, str) or not source_id or source_id in seen:
            raise ValueError("invalid or duplicate SGSDeck equipment child sourceId")
        seen.add(source_id)
        if not isinstance(child.get("nameZh"), str) or not child["nameZh"].strip():
            raise ValueError("SGSDeck equipment child nameZh is required")
        if child.get("parentSourceId") is not None and child["parentSourceId"] not in parent_ids:
            raise ValueError("SGSDeck equipment child parent does not exist")
        if not isinstance(child.get("attributes"), dict):
            raise ValueError("SGSDeck equipment child attributes must be an object")
        attributes = child["attributes"]
        for field in ("tier", "description"):
            if not _nonempty_string(attributes.get(field)):
                raise ValueError(f"invalid SGSDeck equipment child {field}")
        for field in ("slot", "exclusiveEquipmentName", "exclusiveGeneralName"):
            if attributes.get(field) is not None and not _nonempty_string(attributes[field]):
                raise ValueError(f"invalid SGSDeck equipment child {field}")
        acquisition_sources = attributes.get("acquisitionSources")
        if not isinstance(acquisition_sources, list) or not all(
                _nonempty_string(value) for value in acquisition_sources):
            raise ValueError("invalid SGSDeck equipment child acquisitionSources")
        provenance = child.get("provenance")
        if (not isinstance(provenance, dict) or provenance.get("provider") != "sgsdeck"
                or provenance.get("region") != "TW" or provenance.get("fetchedAt") != fetched_at):
            raise ValueError("invalid SGSDeck equipment child provenance")
        validate_source_url(provenance.get("sourceUrl"), "equipment")


def _validate_record_contract(category, record, fetched_at):
    _validate_record_shape(record)
    source_id = record["sourceId"]
    if not isinstance(source_id, str) or not source_id.strip():
        raise ValueError("SGSDeck sourceId must be a non-empty string")
    if record["id"] != f"sgsdeck:{category}:{source_id}":
        raise ValueError("SGSDeck record ID does not match its source identity")
    if not isinstance(record["nameZh"], str) or not record["nameZh"].strip():
        raise ValueError("SGSDeck nameZh must be a non-empty string")
    if record["nameVi"] is not None and not isinstance(record["nameVi"], str):
        raise ValueError("SGSDeck nameVi must be null or a string")
    if not isinstance(record["attributes"], dict):
        raise ValueError("SGSDeck attributes must be an object")
    if record["sourceSeason"] is not None and not isinstance(record["sourceSeason"], dict):
        raise ValueError("SGSDeck sourceSeason must be null or an object")
    if not isinstance(record["missingFields"], list) or not all(
            isinstance(value, str) for value in record["missingFields"]):
        raise ValueError("SGSDeck missingFields must be a string list")
    verification = record["verification"]
    if (not isinstance(verification, dict)
            or verification.get("identity") not in {"matched", "ambiguous", "unmapped"}
            or verification.get("vnAvailability") not in {"unverified", "verified", "unavailable"}):
        raise ValueError("invalid SGSDeck verification state")
    if verification["identity"] == "matched" and (
            record["canonicalRef"] is None or not record["nameVi"]):
        raise ValueError("matched SGSDeck identity requires canonicalRef and nameVi")
    if verification["identity"] != "matched" and record["canonicalRef"] is not None:
        raise ValueError("unmatched SGSDeck identity cannot own canonicalRef")
    provenance = record["provenance"]
    if (not isinstance(provenance, dict) or provenance.get("provider") != "sgsdeck"
            or provenance.get("region") != "TW" or provenance.get("fetchedAt") != fetched_at):
        raise ValueError("invalid SGSDeck provenance")
    validate_source_url(provenance.get("sourceUrl"), category)
    source_updated_at = provenance.get("sourceUpdatedAt")
    if source_updated_at is not None:
        if not isinstance(source_updated_at, str):
            raise ValueError("invalid SGSDeck provenance sourceUpdatedAt")
        try:
            parsed_source_updated_at = datetime.fromisoformat(
                source_updated_at[:-1] + "+00:00"
                if source_updated_at.endswith("Z") else source_updated_at
            )
        except ValueError as error:
            raise ValueError("invalid SGSDeck provenance sourceUpdatedAt") from error
        if parsed_source_updated_at.tzinfo is None:
            raise ValueError("SGSDeck provenance sourceUpdatedAt needs a timezone")
    _validate_category_attributes(category, record)


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def _validate_category_attributes(category, record):
    attributes = record["attributes"]
    season = record["sourceSeason"]
    if season is not None:
        if set(season) != {"label", "number", "scenarioName"}:
            raise ValueError("invalid SGSDeck sourceSeason shape")
        if season["label"] is not None and not _nonempty_string(season["label"]):
            raise ValueError("invalid SGSDeck sourceSeason label")
        if season["number"] is not None and (
                not isinstance(season["number"], int) or isinstance(season["number"], bool)):
            raise ValueError("invalid SGSDeck sourceSeason number")
        if season["scenarioName"] is not None and not _nonempty_string(season["scenarioName"]):
            raise ValueError("invalid SGSDeck sourceSeason scenarioName")
    if category == "generals":
        for field in ("category", "variant", "faction"):
            if not _nonempty_string(attributes.get(field)):
                raise ValueError(f"invalid SGSDeck general {field}")
        stars = attributes.get("stars")
        if not isinstance(stars, int) or isinstance(stars, bool) or stars < 1:
            raise ValueError("invalid SGSDeck general stars")
        if not _number(attributes.get("cost")):
            raise ValueError("invalid SGSDeck general cost")
        for field in (
            "baseCommand", "baseForce", "baseWisdom", "basePolitics", "baseCharm", "baseSpeed",
            "growCommand", "growForce", "growWisdom", "growPolitics", "growCharm", "growSpeed",
        ):
            if field in attributes and attributes[field] is not None and not _number(attributes[field]):
                raise ValueError(f"invalid SGSDeck general numeric attribute: {field}")
    elif category == "tactics":
        for field in ("quality", "kind", "source", "effectText"):
            if not _nonempty_string(attributes.get(field)):
                raise ValueError(f"invalid SGSDeck tactic {field}")
        troop_limit = attributes.get("troopLimit")
        if not isinstance(troop_limit, list) or not all(_nonempty_string(value) for value in troop_limit):
            raise ValueError("invalid SGSDeck tactic troopLimit")
        max_users = attributes.get("maxUsers")
        if not isinstance(max_users, int) or isinstance(max_users, bool) or max_users < 1:
            raise ValueError("invalid SGSDeck tactic maxUsers")
        for field in ("activationRate", "cooldown", "pointCost", "releaseSeason"):
            if attributes.get(field) is not None and not _number(attributes[field]):
                raise ValueError(f"invalid SGSDeck tactic numeric attribute: {field}")
    elif category == "equipment":
        for field in ("quality", "slot"):
            value = attributes.get(field)
            if value is not None and not _nonempty_string(value):
                raise ValueError(f"invalid SGSDeck equipment {field}")
            if (value is None) != (field in record["missingFields"]):
                raise ValueError(f"SGSDeck equipment missingFields disagrees with {field}")
    elif category == "advisors":
        for field in ("element", "effectText"):
            if not _nonempty_string(attributes.get(field)):
                raise ValueError(f"invalid SGSDeck advisor {field}")
        if not _number(attributes.get("tacticPoints")) or attributes["tacticPoints"] < 0:
            raise ValueError("invalid SGSDeck advisor tacticPoints")
        generals = attributes.get("generals")
        if not isinstance(generals, list) or not all(
                isinstance(value, dict) and _nonempty_string(value.get("nameZh")) for value in generals):
            raise ValueError("invalid SGSDeck advisor generals")
    elif category == "troop-mods":
        if not _nonempty_string(attributes.get("effectText")):
            raise ValueError("invalid SGSDeck troop-mod effectText")
        troop_limit = attributes.get("troopLimit")
        if not isinstance(troop_limit, list) or not all(_nonempty_string(value) for value in troop_limit):
            raise ValueError("invalid SGSDeck troop-mod troopLimit")
        options = attributes.get("options")
        if not isinstance(options, list) or not options:
            raise ValueError("invalid SGSDeck troop-mod options")
        for option in options:
            if (not isinstance(option, dict)
                    or any(not _nonempty_string(option.get(field)) for field in ("tier", "traitName", "description"))
                    or (option.get("convertsTo") is not None and not _nonempty_string(option["convertsTo"]))):
                raise ValueError("invalid SGSDeck troop-mod option")
    elif category == "buildings":
        max_level = attributes.get("maxLevel")
        if not isinstance(max_level, int) or isinstance(max_level, bool) or max_level < 1:
            raise ValueError("invalid SGSDeck building maxLevel")
        if not isinstance(attributes.get("mainCityOnly"), bool):
            raise ValueError("invalid SGSDeck building mainCityOnly")
        levels = attributes.get("levels")
        if not isinstance(levels, list) or not levels:
            raise ValueError("invalid SGSDeck building levels")
        seen = set()
        for level in levels:
            number = level.get("level") if isinstance(level, dict) else None
            costs = level.get("costs") if isinstance(level, dict) else None
            if (not isinstance(number, int) or isinstance(number, bool) or number < 1
                    or number > max_level or number in seen or not isinstance(costs, dict)):
                raise ValueError("invalid SGSDeck building level")
            seen.add(number)
            if set(costs) != {"wood", "iron", "stone"} or any(
                    value is not None and (
                        not isinstance(value, int) or isinstance(value, bool) or value < 0
                    ) for value in costs.values()):
                raise ValueError("invalid SGSDeck building costs")
            for field in ("duration", "effect"):
                if level.get(field) is not None and not _nonempty_string(level[field]):
                    raise ValueError(f"invalid SGSDeck building {field}")


def load_catalog(catalog_dir: Path, category: str, hero_path=None, tactic_path=None):
    catalog_dir = Path(catalog_dir)
    manifest = _validated_manifest(catalog_dir)
    digest = manifest.get("files", {}).get(category)
    if not isinstance(digest, str):
        raise ValueError(f"SGSDeck manifest does not own category: {category}")
    path = catalog_dir / f"{category}.json"
    if path.parent != catalog_dir or not path.is_file() or path.is_symlink():
        raise ValueError(f"SGSDeck catalog is missing or unsafe: {category}")
    body = path.read_bytes()
    if hashlib.sha256(body).hexdigest() != digest:
        raise ValueError(f"SGSDeck catalog checksum mismatch: {category}")
    catalog = json.loads(body)
    records = catalog.get("records")
    if catalog.get("provider") != "sgsdeck" or catalog.get("region") != "TW" or not isinstance(records, list):
        raise ValueError(f"invalid SGSDeck catalog contract: {category}")
    if catalog.get("schemaVersion") != 1 or catalog.get("fetchedAt") != manifest["fetchedAt"]:
        raise ValueError(f"SGSDeck catalog metadata mismatch: {category}")
    if not records:
        raise ValueError(f"SGSDeck snapshot has an empty category: {category}")
    children = catalog.get("children", [])
    if category != "equipment" and children:
        raise ValueError(f"unexpected SGSDeck catalog children: {category}")
    if category == "equipment":
        _validate_equipment_children(children, records, manifest["fetchedAt"])
    expected_inventory = {
        "recordCount": len(records),
        "childCount": _child_count(category, records, children),
    }
    if catalog.get("inventory") != expected_inventory:
        raise ValueError(f"SGSDeck catalog count mismatch: {category}")
    if manifest["inventory"].get(category) != expected_inventory:
        raise ValueError(f"SGSDeck manifest inventory mismatch: {category}")

    hero_path = Path(hero_path or PROJECT_ROOT / "data" / "heroes-dict.json")
    tactic_path = Path(tactic_path or PROJECT_ROOT / "data" / "tactics.json")
    corpus = canonical_corpus(_read_json(hero_path), _read_json(tactic_path))
    seen = set()
    for record in records:
        _validate_record_contract(category, record, manifest["fetchedAt"])
        if record.get("id") in seen:
            raise ValueError(f"duplicate SGSDeck record ID: {record.get('id')}")
        seen.add(record.get("id"))
        validate_record_ref(category, record, corpus)
    return catalog


def query(catalog_dir: Path, category: str, name: str, limit: int = 20):
    if limit < 1 or limit > 100:
        raise ValueError("query limit must be between 1 and 100")
    needle = _search_key(name)
    if not needle:
        raise ValueError("query name must not be empty")
    records = load_catalog(catalog_dir, category)["records"]
    result = []
    for record in records:
        names = [record.get("nameZh"), record.get("nameVi")]
        if any(needle in _search_key(value) for value in names if value):
            result.append(record)
            if len(result) == limit:
                break
    return result


def validate_snapshot(catalog_dir: Path, hero_path=None, tactic_path=None):
    manifest = _validated_manifest(Path(catalog_dir))
    for category in sorted(manifest.get("files", {})):
        load_catalog(
            catalog_dir,
            category,
            hero_path=hero_path,
            tactic_path=tactic_path,
        )
    return {"valid": True, "categories": sorted(manifest.get("files", {}))}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=Path("data/sgsdeck"))
    subparsers = parser.add_subparsers(dest="command", required=True)
    query_parser = subparsers.add_parser("query")
    query_parser.add_argument("--group", required=True)
    query_parser.add_argument("--name", required=True)
    query_parser.add_argument("--limit", type=int, default=20)
    subparsers.add_parser("validate")
    args = parser.parse_args(argv)
    result = (query(args.catalog, args.group, args.name, args.limit)
              if args.command == "query" else validate_snapshot(args.catalog))
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
