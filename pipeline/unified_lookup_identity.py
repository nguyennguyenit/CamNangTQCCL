"""Private identity registry for the unified lookup build."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path


SOURCE_FILES = {
    "generals": "generals.json",
    "tactics": "tactics.json",
    "equipment": "equipment.json",
    "advisors": "advisors.json",
    "troop-mods": "troop-mods.json",
    "buildings": "buildings.json",
}
NAMESPACES = {
    "generals": "hero",
    "tactics": "tactic",
    "equipment": "equipment",
    "equipment-special": "equipment-special",
    "advisors": "advisor",
    "troop-mods": "troop-mod",
    "buildings": "building",
}
VARIANTS = {"base", "sp", "co", "40y"}
CJK = re.compile(r"[\u3400-\u9fff]")
HASH = re.compile(r"^[0-9a-f]{64}$")
SAFE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)+$")
REGISTRY_KEYS = {
    "schemaVersion",
    "baselineManifestHash",
    "sourceManifestHash",
    "existingMap",
    "decisions",
    "childIds",
    "relationDecisions",
}
DECISION_KEYS = {
    "category",
    "sourceId",
    "sourceName",
    "inputFingerprint",
    "disposition",
    "canonicalId",
    "nameVi",
    "variant",
    "aliasesVi",
    "aliasesZh",
    "reasonVi",
    "evidence",
    "reviewer",
    "reviewedAt",
}
RELATION_KEYS = {
    "ownerId",
    "fieldPath",
    "inputFingerprint",
    "targetId",
    "reasonVi",
    "evidence",
}


def canonical_json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _fingerprint(value) -> str:
    return sha256_bytes(canonical_json_bytes(value))


def _read_json(path: Path):
    return json.loads(path.read_bytes())


def _source_row(category: str, record: dict) -> dict:
    source_id = record.get("sourceId")
    if not isinstance(source_id, str) or not source_id:
        raise ValueError(f"{category} source record has no sourceId")
    reviewed_input = {
        "category": category,
        "sourceId": source_id,
        "nameZh": record.get("nameZh"),
        "attributes": record.get("attributes"),
    }
    return {
        "key": f"{category}:{source_id}",
        "category": category,
        "sourceId": source_id,
        "sourceName": record.get("nameZh"),
        "fingerprint": _fingerprint(reviewed_input),
        "record": record,
    }


def _child_row(parent: dict, kind: str, input_key: str, value: dict) -> dict:
    parent_id = parent["sourceId"]
    reviewed_input = {
        "parentSourceId": parent_id,
        "kind": kind,
        "inputKey": input_key,
        "value": value,
    }
    row = {
        "key": f"{kind}:{parent_id}:{input_key}",
        "parentSourceId": parent_id,
        "kind": kind,
        "inputKey": input_key,
        "fingerprint": _fingerprint(reviewed_input),
        "record": value,
    }
    if kind == "equipment-special":
        row.update({
            "category": kind,
            "sourceId": value["sourceId"],
            "sourceName": value.get("nameZh"),
        })
    return row


def _verified_input_roots(root: Path):
    baseline_root = root / "pipeline" / "lookup-inputs"
    source_root = root / "data" / "sgsdeck"
    baseline_manifest_path = baseline_root / "manifest.json"
    if not baseline_manifest_path.is_file():
        raise ValueError("frozen lookup baseline is missing")
    baseline_manifest = _read_json(baseline_manifest_path)
    if (
        set(baseline_manifest) != {"schemaVersion", "files", "counts"}
        or type(baseline_manifest["schemaVersion"]) is not int
        or baseline_manifest["schemaVersion"] != 1
    ):
        raise ValueError("frozen lookup baseline manifest is invalid")
    for basename, expected_hash in baseline_manifest["files"].items():
        payload = (baseline_root / basename).read_bytes()
        if sha256_bytes(payload) != expected_hash:
            raise ValueError(f"frozen lookup baseline hash changed: {basename}")
    if baseline_manifest["counts"] != {
        "heroes": len(_read_json(baseline_root / "heroes-dict.json")),
        "tactics": len(_read_json(baseline_root / "tactics.json")),
    }:
        raise ValueError("frozen lookup baseline counts changed")

    source_manifest = _read_json(source_root / "manifest.json")
    for category, expected_hash in source_manifest["files"].items():
        if sha256_bytes((source_root / f"{category}.json").read_bytes()) != expected_hash:
            raise ValueError(f"SGSDeck source hash changed: {category}")

    reconciliation = _read_json(
        root / "plans" / "reports" / "analysis-260912-1142-unified-lookup.json"
    )
    approved_inputs = reconciliation["inputHashes"]
    checked_paths = {
        "data/heroes-dict.json": baseline_root / "heroes-dict.json",
        "data/tactics.json": baseline_root / "tactics.json",
        **{
            f"data/sgsdeck/{basename}": source_root / basename
            for basename in [*SOURCE_FILES.values(), "manifest.json"]
        },
    }
    for evidence_path, actual_path in checked_paths.items():
        if sha256_bytes(actual_path.read_bytes()) != approved_inputs[evidence_path]:
            raise ValueError(f"reviewed reconciliation input changed: {evidence_path}")

    from pipeline.query_sgsdeck_catalog import validate_snapshot

    validate_snapshot(
        source_root,
        hero_path=baseline_root / "heroes-dict.json",
        tactic_path=baseline_root / "tactics.json",
    )
    return baseline_root, source_root


def inventory_from_sources(project_root):
    """Return every source parent/child and every immutable local dictionary row."""
    root = Path(project_root)
    baseline_root, source_root = _verified_input_roots(root)
    parents = []
    children = []
    for category, basename in SOURCE_FILES.items():
        document = _read_json(source_root / basename)
        category_parents = [_source_row(category, record) for record in document["records"]]
        parents.extend(category_parents)
        if category == "equipment":
            parent_by_source = {row["sourceId"]: row for row in category_parents}
            for child in document["children"]:
                parent = parent_by_source.get(child.get("parentSourceId"))
                if parent is None:
                    parent = {"sourceId": child.get("parentSourceId") or "unresolved"}
                children.append(_child_row(parent, "equipment-special", child["sourceId"], child))
        elif category == "troop-mods":
            for parent in category_parents:
                for option in parent["record"]["attributes"]["options"]:
                    input_key = "|".join(
                        str(option.get(field) or "") for field in ("tier", "traitName", "convertsTo")
                    )
                    children.append(_child_row(parent, "troop-option", input_key, option))
        elif category == "buildings":
            for parent in category_parents:
                for level in parent["record"]["attributes"]["levels"]:
                    children.append(_child_row(parent, "building-level", str(level["level"]), level))

    local = []
    for kind, basename in (("hero", "heroes-dict.json"), ("tactic", "tactics.json")):
        for record in _read_json(baseline_root / basename):
            name = record.get("viet")
            local.append({
                "key": f"{kind}:{_slug(name)}",
                "kind": kind,
                "nameVi": name,
                "fingerprint": _fingerprint({"kind": kind, "record": record}),
                "record": record,
            })

    for group, rows in (("parents", parents), ("children", children), ("local", local)):
        keys = [row["key"] for row in rows]
        if len(keys) != len(set(keys)):
            raise ValueError(f"duplicate {group} inventory key")
    return {"parents": parents, "children": children, "local": local}

def freeze_baseline(project_root, output_dir):
    """Create immutable dictionary inputs, or verify an identical prior freeze."""
    root = Path(project_root)
    output = Path(output_dir)
    payloads = {
        basename: (root / "data" / basename).read_bytes()
        for basename in ("heroes-dict.json", "tactics.json")
    }
    manifest = {
        "schemaVersion": 1,
        "files": {basename: sha256_bytes(payload) for basename, payload in payloads.items()},
        "counts": {
            "heroes": len(json.loads(payloads["heroes-dict.json"])),
            "tactics": len(json.loads(payloads["tactics.json"])),
        },
    }
    payloads["manifest.json"] = canonical_json_bytes(manifest)

    try:
        output.mkdir(parents=False)
    except FileExistsError:
        if output.is_symlink() or not output.is_dir():
            raise FileExistsError(f"frozen baseline differs: {output}")
        for basename, expected in payloads.items():
            path = output / basename
            if path.is_symlink() or not path.is_file() or path.read_bytes() != expected:
                raise FileExistsError(f"frozen baseline differs: {path}")
        return manifest

    for basename, payload in payloads.items():
        with (output / basename).open("xb") as destination:
            destination.write(payload)
    return manifest


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower().replace("đ", "d"))
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    slug = re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_text))
    if not slug:
        raise ValueError("identity name produces an empty slug")
    return slug


def _variant(value: str) -> str:
    normalized = value.strip().upper()
    if normalized.startswith("40Y"):
        return "40y"
    if normalized.startswith("SP"):
        return "sp"
    if normalized.startswith("CO") or value.strip().startswith("無雙"):
        return "co"
    return "base"

def _name_variant(value: str) -> str:
    normalized = value.strip().upper()
    if normalized.startswith("40Y "):
        return "40y"
    if normalized.startswith("SP "):
        return "sp"
    if normalized.startswith("CO "):
        return "co"
    return "base"


def _canonical_id(category: str, name_vi: str) -> str:
    namespace = NAMESPACES[category]
    return f"{namespace}:{_slug(name_vi)}"


def _require_hash(value, field):
    if not isinstance(value, str) or not HASH.fullmatch(value):
        raise ValueError(f"{field} must be a lowercase SHA-256")


def expected_relation_inputs(inventory, owner_by_source):
    """Derive the exact name-only relationship ledger required by source bytes."""
    expected = {}

    def add(owner_id, field_path, raw_value, target_namespace):
        if owner_id is None or not isinstance(raw_value, str) or not raw_value.strip():
            return
        key = (owner_id, field_path)
        if key in expected:
            raise ValueError(f"duplicate source relation input: {key}")
        expected[key] = {
            "inputFingerprint": _fingerprint({
                "ownerId": owner_id,
                "fieldPath": field_path,
                "raw": raw_value,
            }),
            "targetNamespace": target_namespace,
        }

    for source in inventory["parents"]:
        category = source["category"]
        owner = owner_by_source.get(f"{category}:{source['sourceId']}")
        attributes = source["record"].get("attributes", {})
        if category == "generals":
            add(owner, "lookup.inheritTacticId", attributes.get("inheritedTacticName"), "tactic")
        elif category == "tactics":
            inherited_from = attributes.get("inheritedFrom")
            if isinstance(inherited_from, str):
                names = [name.strip() for name in re.split(r"[、,]", inherited_from) if name.strip()]
                for index, name in enumerate(names):
                    add(owner, f"lookup.inheritedFromIds[{index}]", name, "hero")

    for source in inventory["children"]:
        if source["kind"] != "equipment-special":
            continue
        owner = owner_by_source.get(f"equipment-special:{source['sourceId']}")
        attributes = source["record"].get("attributes", {})
        parent_source_id = source.get("parentSourceId")
        if parent_source_id and parent_source_id != "unresolved":
            if owner_by_source.get(f"equipment:{parent_source_id}") is None:
                raise ValueError(f"equipment special has an unknown direct parent: {source['sourceId']}")
        else:
            add(owner, "equipmentId", attributes.get("exclusiveEquipmentName"), "equipment")
        add(owner, "exclusiveHeroId", attributes.get("exclusiveGeneralName"), "hero")
    return expected

def validate_registry(
    registry,
    inventory,
    *,
    expected_hashes,
    legacy_source_keys=(),
    previous_registry=None,
):
    """Validate strict registry shape, input binding, coverage, and uniqueness."""
    if not isinstance(registry, dict) or set(registry) != REGISTRY_KEYS:
        raise ValueError("registry must use the exact schema")
    if type(registry["schemaVersion"]) is not int or registry["schemaVersion"] != 1:
        raise ValueError("unsupported registry schemaVersion")
    for registry_field, expected_field in (
        ("baselineManifestHash", "baseline"),
        ("sourceManifestHash", "source"),

    ):
        _require_hash(registry.get(registry_field), registry_field)
        if registry[registry_field] != expected_hashes[expected_field]:
            raise ValueError(f"{registry_field} does not match reviewed input")
    existing_map = registry.get("existingMap")
    if (
        not isinstance(existing_map, dict)
        or set(existing_map) != {"path", "sha256"}
        or existing_map["path"] != "pipeline/sgsdeck-name-map.json"
    ):
        raise ValueError("existingMap must bind the immutable reviewed map")
    _require_hash(existing_map["sha256"], "existingMap.sha256")
    if existing_map["sha256"] != expected_hashes["mapping"]:
        raise ValueError("existingMap hash does not match reviewed input")

    identity_sources = list(inventory["parents"]) + [
        row for row in inventory["children"] if row["kind"] == "equipment-special"
    ]
    parent_by_key = {
        f"{row['category']}:{row['sourceId']}": row
        for row in identity_sources
    }
    local_by_id = {row["key"]: row for row in inventory["local"]}
    local_ids = set(local_by_id)
    legacy_owners = dict(legacy_source_keys) if isinstance(legacy_source_keys, dict) else {}
    legacy_source_keys = set(legacy_source_keys)
    decision_keys = set()
    owner_sources = {}
    for source_key, owner in legacy_owners.items():
        owner_sources.setdefault(owner, []).append(source_key)
    prior_decisions = {
        f"{row['category']}:{row['sourceId']}": row
        for row in (previous_registry or {}).get("decisions", [])
    }
    for decision in registry["decisions"]:
        if not isinstance(decision, dict) or set(decision) != DECISION_KEYS:
            raise ValueError("identity decision must use the exact schema")
        category = decision["category"]
        source_id = decision["sourceId"]
        key = f"{category}:{source_id}"
        if key in decision_keys:
            raise ValueError(f"duplicate source decision: {key}")
        if key in legacy_source_keys:
            raise ValueError(f"registry shadows existing mapping: {key}")
        source = parent_by_key.get(key)
        if source is None:
            raise ValueError(f"orphan identity decision: {key}")
        decision_keys.add(key)
        if decision["sourceName"] != source.get("sourceName"):
            raise ValueError(f"source name changed: {key}")
        if decision["inputFingerprint"] != source["fingerprint"]:
            raise ValueError(f"obsolete fingerprint: {key}")
        if decision["disposition"] not in {"matched", "new", "unresolved"}:
            raise ValueError(f"invalid disposition: {key}")
        for field in ("aliasesVi", "aliasesZh"):
            if not isinstance(decision[field], list) or not all(
                isinstance(item, str) and item.strip() for item in decision[field]
            ):
                raise ValueError(f"invalid {field}: {key}")
        if not isinstance(decision["evidence"], list) or not decision["evidence"] or not all(
            isinstance(item, str) and item.strip() for item in decision["evidence"]
        ):
            raise ValueError(f"invalid evidence: {key}")
        for field in ("reasonVi", "reviewer", "reviewedAt"):
            if not isinstance(decision[field], str) or not decision[field].strip():
                raise ValueError(f"missing {field}: {key}")
        try:
            datetime.fromisoformat(decision["reviewedAt"])
        except ValueError as error:
            raise ValueError(f"invalid reviewedAt: {key}") from error

        if decision["disposition"] == "unresolved":
            if any(decision[field] is not None for field in ("canonicalId", "nameVi", "variant")):
                raise ValueError(f"unresolved decision owns an identity: {key}")
            continue
        namespace = NAMESPACES.get(category)
        if namespace is None or not isinstance(decision["canonicalId"], str):
            raise ValueError(f"invalid canonical namespace: {key}")
        if not isinstance(decision["nameVi"], str) or not decision["nameVi"].strip():
            raise ValueError(f"resolved decision needs nameVi: {key}")
        if not SAFE_ID.fullmatch(decision["canonicalId"]):
            raise ValueError(f"canonical ID is not path-safe: {key}")
        if CJK.search(decision["nameVi"]):
            raise ValueError(f"resolved Vietnamese name contains CJK: {key}")
        prior_id = (prior_decisions.get(key) or {}).get("canonicalId")
        if prior_id is not None:
            if decision["canonicalId"] != prior_id:
                raise ValueError(f"issued canonical ID changed: {key}")
        elif decision["canonicalId"] != _canonical_id(category, decision["nameVi"]):
            raise ValueError(f"canonical ID does not match reviewed Vietnamese name: {key}")
        expected_variant = decision["variant"]
        if category == "generals":
            source_variant = _variant(source.get("sourceName") or "")
            if (
                expected_variant not in VARIANTS
                or expected_variant != source_variant
                or _name_variant(decision["nameVi"]) != source_variant
            ):
                raise ValueError(f"invalid hero variant: {key}")
        elif expected_variant is not None:
            raise ValueError(f"non-hero identity cannot have a variant: {key}")
        if category in {"generals", "tactics"}:
            if decision["disposition"] == "matched" and decision["canonicalId"] not in local_ids:
                raise ValueError(f"matched identity does not resolve to frozen baseline: {key}")
            if decision["disposition"] == "matched" and (
                local_by_id[decision["canonicalId"]]["nameVi"] != decision["nameVi"]
            ):
                raise ValueError(f"matched display name differs from frozen baseline: {key}")
            if decision["disposition"] == "new" and decision["canonicalId"] in local_ids:
                raise ValueError(f"new identity collides with frozen baseline: {key}")
        owner_sources.setdefault(decision["canonicalId"], []).append(key)

    for owner, sources in owner_sources.items():
        if len(sources) > 1:
            raise ValueError(f"two source entities resolve to one owner: {owner}")

    expected_decisions = set(parent_by_key) - legacy_source_keys
    if decision_keys != expected_decisions:
        missing = sorted(expected_decisions - decision_keys)
        extra = sorted(decision_keys - expected_decisions)
        raise ValueError(f"identity inventory coverage mismatch: missing={missing[:1]}, extra={extra[:1]}")

    expected_children = {
        (row["parentSourceId"], row["kind"], row["inputKey"]): row
        for row in inventory["children"]
        if row["kind"] != "equipment-special"
    }
    child_keys = set()
    child_ids = set()
    prior_child_ids = {
        (row["parentId"], row["kind"], row["inputKey"]): row["id"]
        for row in (previous_registry or {}).get("childIds", [])
    }
    for child in registry["childIds"]:
        if not isinstance(child, dict) or set(child) != {
            "parentId", "kind", "inputKey", "inputFingerprint", "id"
        }:
            raise ValueError("child identity must use the exact schema")
        matches = [
            (key, source)
            for key, source in expected_children.items()
            if key[1:] == (child["kind"], child["inputKey"])
            and source["fingerprint"] == child["inputFingerprint"]
        ]
        if len(matches) != 1:
            raise ValueError(f"orphan or obsolete child identity: {child.get('id')}")
        source_key, _ = matches[0]
        parent_category = "troop-mods" if child["kind"] == "troop-option" else "buildings"
        owner = next(
            (
                decision["canonicalId"]
                for decision in registry["decisions"]
                if decision["category"] == parent_category
                and decision["sourceId"] == source_key[0]
            ),
            None,
        )
        prior_child_id = prior_child_ids.get((child["parentId"], child["kind"], child["inputKey"]))
        if prior_child_id is not None and child["id"] != prior_child_id:
            raise ValueError(f"issued child ID changed: {child['id']}")
        if not isinstance(child["id"], str) or not SAFE_ID.fullmatch(child["id"]):
            raise ValueError(f"child ID is not path-safe: {child['id']}")
        if child["parentId"] != owner:
            raise ValueError(f"child parent identity changed: {child['id']}")
        if source_key in child_keys or child["id"] in child_ids:
            raise ValueError(f"duplicate child identity: {child['id']}")
        if child["kind"] == "building-level":
            expected_id = f"building-level:{owner.removeprefix('building:')}:{child['inputKey']}"
            if child["id"] != expected_id:
                raise ValueError(f"building level ID changed: {child['id']}")
        else:
            prefix = f"troop-option:{owner.removeprefix('troop-mod:')}:"
            if not isinstance(child["id"], str) or not child["id"].startswith(prefix) or child["id"] == prefix:
                raise ValueError(f"troop option ID has the wrong owner: {child['id']}")
        child_keys.add(source_key)
        child_ids.add(child["id"])
    if child_keys != set(expected_children):
        raise ValueError("child identity inventory coverage mismatch")

    owner_by_source = {
        **legacy_owners,
        **{
            f"{decision['category']}:{decision['sourceId']}": decision["canonicalId"]
            for decision in registry["decisions"]
            if decision["canonicalId"] is not None
        },
    }
    expected_relations = expected_relation_inputs(inventory, owner_by_source)
    relation_keys = set()
    valid_owners = local_ids | {
        decision["canonicalId"]
        for decision in registry["decisions"]
        if decision["canonicalId"] is not None
    }
    for relation in registry["relationDecisions"]:
        if not isinstance(relation, dict) or set(relation) != RELATION_KEYS:
            raise ValueError("relation decision must use the exact schema")
        key = (relation["ownerId"], relation["fieldPath"])
        expected = expected_relations.get(key)
        if expected is None:
            raise ValueError(f"unexpected relation decision: {key}")
        if key in relation_keys:
            raise ValueError(f"duplicate relation decision: {key}")
        relation_keys.add(key)
        if relation["ownerId"] not in valid_owners:
            raise ValueError(f"relation owner does not resolve: {key}")
        if relation["inputFingerprint"] != expected["inputFingerprint"]:
            raise ValueError(f"obsolete relation fingerprint: {key}")
        target = relation["targetId"]
        if target is not None and (
            target not in valid_owners
            or not target.startswith(expected["targetNamespace"] + ":")
        ):
            raise ValueError(f"relation target has the wrong identity kind: {key}")
        if not isinstance(relation["reasonVi"], str) or not relation["reasonVi"].strip():
            raise ValueError(f"relation decision has no reason: {key}")
        if not isinstance(relation["evidence"], list) or not relation["evidence"] or not all(
            isinstance(item, str) and item.strip() for item in relation["evidence"]
        ):
            raise ValueError(f"relation decision has no evidence: {key}")
    if relation_keys != set(expected_relations):
        raise ValueError("relation decision inventory coverage mismatch")
    return registry
