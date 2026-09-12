"""Build deterministic private SGSDeck catalogs from a verified offline cache."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

from .query_sgsdeck_catalog import validate_snapshot
from .sgsdeck_identity import apply_reviewed_mappings
from .sgsdeck_source import (
    discover_detail_urls,
    load_offline_cache,
    parse_building_levels,
    parse_category_page,
    parse_equipment_specials,
    parse_general_detail,
)


CATEGORIES = ("generals", "tactics", "equipment", "advisors", "troop-mods", "buildings")
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def _catalog_record(category, raw, fetched_at, source_url):
    source_id = str(raw.get("sourceId") or raw.get("id") or raw.get("slug") or "").strip()
    name = str(raw.get("nameZh") or "").strip()
    if not source_id or not name:
        raise ValueError(f"{category} record is missing source identity")
    attributes = raw.get("attributes")
    if attributes is None:
        attributes = {key: value for key, value in raw.items()
                      if key not in {"id", "slug", "sourceId", "sourceSlug", "nameZh", "sourceSeason"}}
    provenance = {
        "provider": "sgsdeck",
        "region": "TW",
        "sourceUrl": raw.get("sourceUrl") or source_url,
        "fetchedAt": fetched_at,
    }
    if raw.get("sourceUpdatedAt"):
        provenance["sourceUpdatedAt"] = raw["sourceUpdatedAt"]
    return {
        "id": f"sgsdeck:{category}:{source_id}",
        "sourceId": source_id,
        "nameZh": name,
        "nameVi": None,
        "canonicalRef": None,
        "attributes": attributes,
        "provenance": provenance,
        "sourceSeason": raw.get("sourceSeason"),
        "verification": {"identity": "unmapped", "vnAvailability": "unverified"},
        "missingFields": raw.get("missingFields", []),
    }


def _child_count(category, records, children=()):
    if category == "equipment":
        return len(children)
    field = "options" if category == "troop-mods" else "levels" if category == "buildings" else None
    if not field:
        return 0
    return sum(len(record.get("attributes", {}).get(field, [])) for record in records)


def _detail_resources(resources, category):
    details = {}
    for (resource_category, key), resource in resources.items():
        if resource_category != category or not key.startswith("detail-"):
            continue
        url = resource["metadata"]["url"]
        if url in details:
            raise ValueError(f"duplicate SGSDeck {category} detail URL: {url}")
        details[url] = resource
    return details


def _compose_list_records(category, source_records, list_body, resources):
    children = []
    if category in {"generals", "buildings"}:
        expected_urls = set(discover_detail_urls(category, list_body.decode("utf-8")))
        details = _detail_resources(resources, category)
        if set(details) != expected_urls:
            missing = sorted(expected_urls - set(details))
            extra = sorted(set(details) - expected_urls)
            raise ValueError(
                f"{category} detail cache coverage mismatch: missing={missing}, extra={extra}"
            )
        if category == "generals":
            parsed = {}
            for url, resource in details.items():
                detail = parse_general_detail(resource["body"].decode("utf-8"))
                if detail["sourceId"] in parsed:
                    raise ValueError(f"duplicate SGSDeck general detail: {detail['sourceId']}")
                detail["sourceUrl"] = url
                parsed[detail["sourceId"]] = detail
            source_ids = {record["sourceId"] for record in source_records}
            if not set(parsed).issubset(source_ids):
                raise ValueError("SGSDeck general detail does not belong to the list snapshot")
            for record in source_records:
                detail = parsed.get(record["sourceId"])
                if detail:
                    if detail["nameZh"] != record["nameZh"]:
                        raise ValueError(
                            f"SGSDeck general detail name does not match list: {record['sourceId']}"
                        )
                    source_slug = record.get("sourceSlug")
                    url_slug = unquote(urlparse(detail["sourceUrl"]).path.rsplit("/", 1)[-1])
                    if not source_slug or url_slug != source_slug:
                        raise ValueError(
                            f"SGSDeck general detail URL does not match list slug: {record['sourceId']}"
                        )
                    record["attributes"].update(detail["attributes"])
                    record["sourceUpdatedAt"] = detail["sourceUpdatedAt"]
                    record["sourceUrl"] = detail["sourceUrl"]
        else:
            by_slug = {
                url.rsplit("/", 1)[-1]: parse_building_levels(resource["body"].decode("utf-8"))
                for url, resource in details.items()
            }
            source_ids = {record["sourceId"] for record in source_records}
            if set(by_slug) != source_ids:
                raise ValueError("SGSDeck building detail coverage does not match the list snapshot")
            for record in source_records:
                record["attributes"]["levels"] = by_slug[record["sourceId"]]
                record["sourceUrl"] = next(
                    url for url in details if url.endswith(f"/{record['sourceId']}")
                )
    elif category == "equipment":
        resource = resources.get(("equipment", "specials"))
        if resource is None:
            raise ValueError("missing required cache resource: [('equipment', 'specials')]")
        parent_ids = {record["nameZh"]: record["sourceId"] for record in source_records}
        for raw in parse_equipment_specials(resource["body"].decode("utf-8")):
            children.append({
                "id": f"sgsdeck:equipment-special:{raw['sourceId']}",
                "sourceId": raw["sourceId"],
                "nameZh": raw["nameZh"],
                "parentSourceId": parent_ids.get(raw["exclusiveEquipmentName"]),
                "attributes": {
                    key: raw[key]
                    for key in (
                        "tier", "slot", "description", "exclusiveEquipmentName",
                        "exclusiveGeneralName", "acquisitionSources",
                    )
                },
                "provenance": {
                    "provider": "sgsdeck",
                    "region": "TW",
                    "sourceUrl": resource["metadata"]["url"],
                    "fetchedAt": resource["metadata"].get("fetchedAt"),
                },
            })
    return source_records, children


def _promote(staging: Path, output_dir: Path) -> None:
    backup = output_dir.with_name(output_dir.name + ".previous")
    if backup.exists():
        shutil.rmtree(backup)
    if output_dir.exists():
        os.replace(output_dir, backup)
    try:
        os.replace(staging, output_dir)
    except BaseException:
        if backup.exists() and not output_dir.exists():
            os.replace(backup, output_dir)
        raise
    if backup.exists():
        try:
            shutil.rmtree(backup)
        except OSError:
            pass


_CRITICAL_ATTRIBUTES = {
    "generals": {"category", "variant", "faction", "stars", "cost", "baseCommand", "baseForce", "baseWisdom", "basePolitics", "baseCharm", "baseSpeed"},
    "tactics": {"quality", "kind", "source", "effectText", "troopLimit", "maxUsers"},
    "equipment": {"quality", "slot"},
    "advisors": {"element", "effectText", "generals", "tacticPoints"},
    "troop-mods": {"effectText", "troopLimit", "options"},
    "buildings": {"maxLevel", "mainCityOnly", "levels"},
}


def _reject_snapshot_shrink(output_dir: Path, candidate_inventory, catalogs=None) -> None:
    output_dir = Path(output_dir)
    if not (output_dir / "manifest.json").exists():
        return
    validate_snapshot(output_dir)
    previous_manifest = json.loads((output_dir / "manifest.json").read_text(encoding="utf-8"))
    previous_inventory = previous_manifest.get("inventory", {})
    for category in CATEGORIES:
        before = previous_inventory.get(category, {})
        after = candidate_inventory.get(category, {})
        for field in ("recordCount", "childCount"):
            if after.get(field, -1) < before.get(field, 0):
                raise ValueError(
                    f"SGSDeck snapshot shrink: {category} {field} "
                    f"{before.get(field)} -> {after.get(field)}"
                )
    if catalogs is None:
        return
    for category in CATEGORIES:
        previous = json.loads((output_dir / f"{category}.json").read_text(encoding="utf-8"))
        current_records = catalogs[category]["records"]
        identity = lambda record: record["sourceId"]
        current_by_identity = {identity(record): record for record in current_records}
        if len(current_by_identity) != len(current_records):
            raise ValueError(f"duplicate SGSDeck comparison identity: {category}")
        for old_record in previous["records"]:
            key = identity(old_record)
            current = current_by_identity.get(key)
            if current is None:
                raise ValueError(f"SGSDeck snapshot lost existing identity: {category}/{key}")
            old_attributes = old_record["attributes"]
            new_attributes = current["attributes"]
            for field in _CRITICAL_ATTRIBUTES[category]:
                if old_attributes.get(field) is not None and new_attributes.get(field) is None:
                    raise ValueError(f"SGSDeck snapshot lost critical field: {category}/{key}/{field}")
            child_field = "options" if category == "troop-mods" else "levels" if category == "buildings" else None
            if child_field and len(new_attributes.get(child_field, [])) < len(old_attributes.get(child_field, [])):
                raise ValueError(f"SGSDeck snapshot lost nested records: {category}/{key}/{child_field}")


def build_from_cache(
    cache_dir: Path,
    output_dir: Path,
    resource_key: str = "list",
    mapping_path: Path = PROJECT_ROOT / "pipeline" / "sgsdeck-name-map.json",
    hero_path: Path = PROJECT_ROOT / "data" / "heroes-dict.json",
    tactic_path: Path = PROJECT_ROOT / "data" / "tactics.json",
):
    cache_dir = Path(cache_dir)
    output_dir = Path(output_dir)
    required = {(category, resource_key) for category in CATEGORIES}
    manifest, resources = load_offline_cache(cache_dir, required)
    fetched_at = manifest.get("fetchedAt")
    if not isinstance(fetched_at, str) or not fetched_at:
        raise ValueError("cache manifest is missing fetchedAt")
    mapping_body = Path(mapping_path).read_bytes()
    hero_body = Path(hero_path).read_bytes()
    tactic_body = Path(tactic_path).read_bytes()
    mapping_document = json.loads(mapping_body)
    if mapping_document.get("schemaVersion") != 1 or not isinstance(mapping_document.get("mappings"), list):
        raise ValueError("invalid SGSDeck reviewed mapping document")
    heroes = json.loads(hero_body)
    tactics = json.loads(tactic_body)

    catalogs = {}
    inventory = {}
    for category in CATEGORIES:
        resource = resources[(category, resource_key)]
        body = resource["body"]
        if resource_key == "normalized-source":
            source_records = json.loads(body.decode("utf-8"))
            children = []
        else:
            source_records = parse_category_page(category, body.decode("utf-8"))
            source_records, children = _compose_list_records(
                category, source_records, body, resources
            )
        records = [
            _catalog_record(category, raw, fetched_at, resource["metadata"]["url"])
            for raw in source_records
        ]
        if category in {"generals", "tactics"}:
            apply_reviewed_mappings(
                category,
                records,
                mapping_document["mappings"],
                heroes,
                tactics,
            )
        ids = [record["id"] for record in records]
        if len(ids) != len(set(ids)):
            raise ValueError(f"duplicate SGSDeck IDs in {category}")
        records.sort(key=lambda item: item["id"])
        child_count = _child_count(category, records, children)
        catalogs[category] = {
            "schemaVersion": 1,
            "provider": "sgsdeck",
            "region": "TW",
            "fetchedAt": fetched_at,
            "inventory": {"recordCount": len(records), "childCount": child_count},
            "records": records,
        }
        if children:
            for child in children:
                child["provenance"]["fetchedAt"] = fetched_at
            children.sort(key=lambda item: item["id"])
            catalogs[category]["children"] = children

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}-", dir=output_dir.parent))
    try:
        files = {}
        for category, catalog in catalogs.items():
            body = _json_bytes(catalog)
            (staging / f"{category}.json").write_bytes(body)
            files[category] = hashlib.sha256(body).hexdigest()
            inventory[category] = catalog["inventory"]
        result_manifest = {
            "schemaVersion": 1,
            "provider": "sgsdeck",
            "region": "TW",
            "fetchedAt": fetched_at,
            "sourceManifestHash": hashlib.sha256((cache_dir / "manifest.json").read_bytes()).hexdigest(),
            "inputHashes": {
                "mapping": hashlib.sha256(mapping_body).hexdigest(),
                "heroes": hashlib.sha256(hero_body).hexdigest(),
                "tactics": hashlib.sha256(tactic_body).hexdigest(),
            },
            "inventory": inventory,
            "files": files,
        }
        (staging / "manifest.json").write_bytes(_json_bytes(result_manifest))
        validate_snapshot(staging, hero_path=hero_path, tactic_path=tactic_path)
        _reject_snapshot_shrink(output_dir, inventory, catalogs)
        _promote(staging, output_dir)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    return result_manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/sgsdeck"))
    args = parser.parse_args(argv)
    build_from_cache(args.cache, args.output)


if __name__ == "__main__":
    main()
