"""Build and atomically select an immutable Recommended reference generation."""
from __future__ import annotations

import copy
import argparse
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from pipeline.recommended_identity import (
    build_display_mapping,
    resolve_display_kind,
    resolve_display_name,
    resolve_team_display_name,
)
from pipeline.sgsdeck_recommended import (
    join_recommended_evidence,
    parse_recommended_detail,
    parse_recommended_detail_with_display_notes,
    parse_recommended_list,
)


SCHEMA_VERSION = 1
SAFE_SCOPE = re.compile(r"s-[0-9a-f]{64}$")
TIER_ORDER = {"T0": 0, "T0.5": 1, "T1": 2, "T1.5": 3, "T2": 4, "T3": 5, "FUNC": 6, "功能隊": 6}
DISPLAY_SCHEMA_VERSION = 1
TRANSLATION_STATUSES = ("existing-project-name", "reference-translation")


def canonical_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()



def canonical_object_hash(value):
    data = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    return "sha256:" + sha(data)



def raw_source_record(row):
    """Project one published/localized detail back to its raw joined-source contract."""
    display_fields = {
        "displayNameVi",
        "displayNotes",
        "legacyReferences",
        "sourceSeasonNameVi",
        "sourceSeasonCode",
        "sourceSeasonTranslationStatus",
        "sourceCategoryNameVi",
        "safeScopeKey",
        "sourceScopeId",
        "sourceSeasonId",
        "sourceSeasonLabel",
        "sourceCategoryId",
        "listIndex",
        "tierOrder",
        "subcategoryRaw",
    }
    holder_display_fields = {"displayNameVi", "tacticSlotsVi", "tacticSlotKinds", "bookSlotsVi"}
    raw = {key: copy.deepcopy(value) for key, value in row.items() if key not in display_fields}
    for field in ("heroes", "alternativeHoldersRaw"):
        if isinstance(raw.get(field), list):
            raw[field] = [
                {key: value for key, value in holder.items() if key not in holder_display_fields}
                if isinstance(holder, dict) else holder
                for holder in raw[field]
            ]
    return raw
def _validated_display_notes(value, row):
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or not isinstance(value.get("blocks"), list):
        raise ValueError("Recommended displayNotes projection is invalid")
    seen = set()
    limits = {
        "primary": len(row.get("heroes") or []),
        "alternative": len(row.get("alternativeHoldersRaw") or []),
    }
    for block in value["blocks"]:
        if not isinstance(block, dict) or not isinstance(block.get("id"), str) or not block["id"]:
            raise ValueError("Recommended displayNotes block is invalid")
        if block["id"] in seen:
            raise ValueError("Recommended displayNotes occurrence ids must be unique")
        seen.add(block["id"])
        owner = block.get("owner")
        if owner == "team":
            if "holderIndex" in block:
                raise ValueError("Team displayNotes block cannot have holderIndex")
        elif owner in limits:
            index = block.get("holderIndex")
            if not isinstance(index, int) or isinstance(index, bool) or not 0 <= index < limits[owner]:
                raise ValueError("Recommended displayNotes holder index is invalid")
        else:
            raise ValueError("Recommended displayNotes owner is invalid")
        if not isinstance(block.get("textRaw"), str) or not block["textRaw"].strip():
            raise ValueError("Recommended displayNotes text is invalid")
    return value


def prepare_publication_inputs(inputs, *, teams_bytes, content_links_bytes, ledger_bytes):
    """Re-derive display lineage from authoritative raw inputs at the publication boundary."""
    if not all(isinstance(value, (bytes, bytearray)) for value in (teams_bytes, content_links_bytes, ledger_bytes)):
        raise ValueError("Publication requires authoritative teams, content links and ledger bytes")
    candidate = copy.deepcopy(inputs)
    teams = json.loads(bytes(teams_bytes))
    links = json.loads(bytes(content_links_bytes))
    ledger = json.loads(bytes(ledger_bytes))
    if not isinstance(teams, list) or any(not isinstance(team, dict) for team in teams):
        raise ValueError("Legacy teams input must be an array")
    teams_by_id = {}
    for team in teams:
        identifier = team.get("id")
        if not isinstance(identifier, str) or not identifier or identifier in teams_by_id:
            raise ValueError("Legacy team ids must be unique and non-empty")
        teams_by_id[identifier] = team
    teams_hash = "sha256:" + sha(bytes(teams_bytes))
    if ledger.get("localTeamsSha256") != teams_hash:
        raise ValueError("Team khác ledger legacy teams bytes differ")
    if links.get("schemaVersion") != 1 or not isinstance(links.get("entries"), list):
        raise ValueError("Unsupported Recommended content-link ledger")
    admitted = ledger.get("admitted")
    if not isinstance(admitted, list):
        raise ValueError("Team khác ledger admitted rows are missing")
    ledger_decisions = ledger.get("decisions")
    if not isinstance(ledger_decisions, list):
        raise ValueError("Team khác ledger decisions are missing")
    distinct_pairs = {
        (item.get("legacyTeamId"), item.get("legacyVariantId"))
        for item in ledger_decisions
        if isinstance(item, dict) and item.get("classification") == "distinct"
    }
    enriched_admitted = []
    admitted_pairs = set()
    for row in admitted:
        team_id = row.get("legacyTeamId")
        variant_id = row.get("legacyVariantId")
        pair = (team_id, variant_id)
        if pair in admitted_pairs or pair not in distinct_pairs or team_id not in teams_by_id:
            raise ValueError("Team khác admitted legacy locator is invalid")
        admitted_pairs.add(pair)
        legacy = teams_by_id[team_id]
        enriched_admitted.append({
            **row,
            "classification": "distinct",
            "legacyContent": copy.deepcopy(legacy),
            "legacyContentSha256": canonical_object_hash(legacy),
        })
    if candidate.get("otherTeams") not in (None, [], admitted):
        raise ValueError("Publication Team khác rows differ from authoritative ledger")
    candidate["otherTeams"] = enriched_admitted

    details_by_id = {}
    detail_scope = {}
    for scope_key, rows in (candidate.get("details") or {}).items():
        for row in rows:
            identifier = row.get("sourceConfigId")
            if not isinstance(identifier, str) or not identifier or identifier in details_by_id:
                raise ValueError("Recommended detail ids must be globally unique")
            details_by_id[identifier] = row
            detail_scope[identifier] = scope_key
    records_by_id = {}
    for row in candidate.get("records") or []:
        identifier = row.get("sourceConfigId")
        if identifier in records_by_id or identifier not in details_by_id:
            raise ValueError("Recommended index lineage is invalid")
        records_by_id[identifier] = row
        detail = details_by_id[identifier]
        if raw_source_record(row) != raw_source_record(detail):
            raise ValueError("Recommended index/detail raw lineage differs: " + identifier)
        if row.get("safeScopeKey") != detail_scope[identifier]:
            raise ValueError("Recommended index/detail scope lineage differs")
        index_notes = row.get("displayNotes")
        detail_notes = detail.get("displayNotes")
        if index_notes is not None or detail_notes is not None:
            _validated_display_notes(index_notes, row)
            _validated_display_notes(detail_notes, detail)
            if index_notes != detail_notes:
                raise ValueError("Recommended index/detail displayNotes differ")

    if ledger.get("dedupKeyVersion") != 1 or candidate.get("dedupKeyVersion") != 1:
        raise ValueError("Unsupported Team khác dedup key version")
    if ledger.get("sourceInventoryHash") != candidate.get("inventory", {}).get("inventoryHash"):
        raise ValueError("Team khác ledger source inventory differs")
    if ledger.get("mappingFileSha256") != candidate.get("mappingHash"):
        raise ValueError("Team khác ledger identity map differs")
    if candidate.get("decisionSnapshotHash") != "sha256:" + sha(bytes(ledger_bytes)):
        raise ValueError("Team khác decision snapshot differs")
    decisions = ledger_decisions
    if len(decisions) != ledger.get("inputTeamRows"):
        raise ValueError("Team khác ledger decision cardinality differs")
    counts = {
        name: sum(item.get("classification") == name for item in decisions)
        for name in ("distinct", "duplicate", "pendingIdentity", "pendingSource")
    }
    if counts != ledger.get("counts") or len(admitted) != counts["distinct"]:
        raise ValueError("Team khác ledger counts differ")
    raw_corpus = [
        raw_source_record(row)
        for scope in candidate.get("inventory", {}).get("scopes", [])
        for row in (candidate.get("details") or {}).get(scope.get("safeScopeKey"), [])
    ]
    if ledger.get("recommendedCorpusHash") != canonical_object_hash(raw_corpus):
        raise ValueError("Team khác ledger Recommended corpus differs")

    decision_pairs = {
        (item.get("legacyTeamId"), item.get("legacyVariantId"))
        for item in ledger_decisions
        if isinstance(item, dict)
    }
    references = {}
    seen_links = set()
    for entry in links["entries"]:
        if entry.get("reviewStatus") != "reviewed":
            continue
        required = ("sourceConfigId", "legacyTeamId", "sourceContentSha256", "legacyContentSha256", "evidenceRef")
        if any(not isinstance(entry.get(key), str) or not entry[key] for key in required):
            raise ValueError("Reviewed Recommended content link is incomplete")
        source_id = entry["sourceConfigId"]
        team_id = entry["legacyTeamId"]
        variant_id = entry.get("legacyVariantId")
        link_key = (source_id, team_id, variant_id)
        if link_key in seen_links or source_id not in details_by_id or team_id not in teams_by_id:
            raise ValueError("Reviewed Recommended content link locator is invalid")
        seen_links.add(link_key)
        if variant_id is not None and (team_id, variant_id) not in decision_pairs:
            raise ValueError("Reviewed Recommended content link variant is invalid")
        if entry["sourceContentSha256"] != canonical_object_hash(raw_source_record(details_by_id[source_id])):
            raise ValueError("Reviewed Recommended source fingerprint is stale")
        legacy = teams_by_id[team_id]
        legacy_hash = canonical_object_hash(legacy)
        if entry["legacyContentSha256"] != legacy_hash:
            raise ValueError("Reviewed Recommended legacy fingerprint is stale")
        references.setdefault(source_id, []).append({
            "legacyTeamId": team_id,
            **({"legacyVariantId": variant_id} if variant_id is not None else {}),
            "sourceContentSha256": entry["sourceContentSha256"],
            "legacyContentSha256": legacy_hash,
            "evidenceRef": entry["evidenceRef"],
            "legacyContent": copy.deepcopy(legacy),
        })

    candidate["records"] = [
        {**row, "legacyReferences": references.get(row["sourceConfigId"], [])}
        for row in candidate.get("records") or []
    ]
    candidate["details"] = {
        key: [{**row, "legacyReferences": references.get(row["sourceConfigId"], [])} for row in rows]
        for key, rows in (candidate.get("details") or {}).items()
    }
    candidate["legacyTeamsHash"] = teams_hash
    candidate["contentLinksHash"] = "sha256:" + sha(bytes(content_links_bytes))
    return candidate
def sha(data):
    return hashlib.sha256(data).hexdigest()


def _write(path, value):
    data = canonical_bytes(value)
    path.write_bytes(data)
    return {"sha256": sha(data), "bytes": len(data)}


def _rank(row):
    tier = row.get("tierOrder", TIER_ORDER.get(row.get("tierRaw"), 999))
    score = row.get("value")
    return (tier, score is None, -(score or 0), row.get("listIndex", 0), row["sourceConfigId"])


def validate_generation_inputs(inputs):
    inventory = inputs.get("inventory", {})
    scopes = inventory.get("scopes", [])
    if not scopes or any(scope.get("state") not in ("complete", "empty-category", "uncollected-season") for scope in scopes):
        raise ValueError("Every frozen scope needs complete, empty or uncollected evidence")
    keys = [scope.get("safeScopeKey") for scope in scopes]
    if any(not isinstance(key, str) or not SAFE_SCOPE.fullmatch(key) for key in keys) or len(keys) != len(set(keys)):
        raise ValueError("Unsafe or duplicate scope key")
    details = inputs.get("details", {})
    records = inputs.get("records", [])
    if not isinstance(details, dict) or set(details) != set(keys):
        raise ValueError("Recommended detail scope inventory differs")
    if any(not isinstance(row, dict) or row.get("safeScopeKey") not in set(keys) for row in records):
        raise ValueError("Recommended index scope inventory differs")
    for name in ("legacyTeamsHash", "contentLinksHash"):
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", str(inputs.get(name))):
            raise ValueError("Publication lineage hash is missing: " + name)
    for scope in scopes:
        key = scope["safeScopeKey"]
        scoped_index = [row for row in records if row.get("safeScopeKey") == key]
        scoped_details = details.get(key)
        if scoped_details is None or len(scoped_index) != len(scoped_details):
            raise ValueError("Recommended index/detail membership differs")
        list_indexes = [row.get("listIndex") for row in scoped_index]
        if sorted(list_indexes) != list(range(len(scoped_index))):
            raise ValueError("Recommended source list order metadata differs")
        expected_urls = scope.get("orderedDetailUrls")
        if expected_urls is not None and [
            row.get("sourceUrl") for row in sorted(scoped_index, key=lambda item: item["listIndex"])
        ] != expected_urls:
            raise ValueError("Recommended source URL order differs")
        for field in ("sourceScopeId", "sourceSeasonId", "sourceCategoryId"):
            if not isinstance(scope.get(field), str) or not scope[field]:
                raise ValueError("Recommended scope identity is incomplete: " + field)
            if any(row.get(field) != scope[field] for row in scoped_index):
                raise ValueError("Recommended index scope metadata differs: " + field)
        option = next(
            (item for item in inventory.get("seasonOptions", []) if item.get("sourceSeasonId") == scope["sourceSeasonId"]),
            None,
        )
        if option is None or any(row.get("sourceSeasonLabel") != option.get("label") for row in scoped_index):
            raise ValueError("Recommended index season label differs")
        for row in scoped_index:
            if row.get("tierRaw") is not None and row.get("tierOrder") != TIER_ORDER.get(row["tierRaw"], 999):
                raise ValueError("Recommended index tier order differs")
        if scope["state"] != "complete" and (scoped_index or scoped_details):
            raise ValueError("Empty or uncollected scope contains records")
        if scope["state"] == "complete":
            if [row["sourceConfigId"] for row in scoped_index] != [row["sourceConfigId"] for row in scoped_details]:
                raise ValueError("Recommended index/detail identities differ")
            for index_row, detail_row in zip(scoped_index, scoped_details):
                if index_row.get("displayNameVi") != detail_row.get("displayNameVi"):
                    raise ValueError("Recommended index/detail titles differ")
                if index_row.get("legacyReferences") != detail_row.get("legacyReferences"):
                    raise ValueError("Recommended index/detail references differ")
                if index_row.get("displayNotes") is not None:
                    _validated_display_notes(index_row["displayNotes"], index_row)
                    if index_row["displayNotes"] != detail_row.get("displayNotes"):
                        raise ValueError("Recommended index/detail displayNotes differ")
    admitted = inputs.get("otherTeams", [])
    if any(row.get("classification") != "distinct" for row in admitted):
        raise ValueError("Public Team khác may contain admitted rows only")
    seen_legacy = set()
    for row in admitted:
        locator = (row.get("legacyTeamId"), row.get("legacyVariantId"))
        if locator in seen_legacy or not isinstance(row.get("legacyContent"), dict):
            raise ValueError("Public Team khác legacy lineage is invalid")
        seen_legacy.add(locator)
        if row.get("legacyContent", {}).get("id") != row.get("legacyTeamId"):
            raise ValueError("Public Team khác legacy content identity differs")
        if row.get("legacyContentSha256") != canonical_object_hash(row["legacyContent"]):
            raise ValueError("Public Team khác legacy content fingerprint differs")


def _build_generation_locked(inputs, output):
    inventory = inputs["inventory"]
    records = sorted(inputs.get("records", []), key=_rank)
    seasons = {"schemaVersion": SCHEMA_VERSION, "defaultSourceSeasonId": next((x["sourceSeasonId"] for x in inventory.get("seasonOptions", []) if x.get("status") == "available"), None), "seasonOptions": inventory.get("seasonOptions", []), "scopes": inventory["scopes"]}
    if inventory.get("displayLabels") is not None:
        seasons["displayLabels"] = inventory["displayLabels"]
    index = {"schemaVersion": SCHEMA_VERSION, "records": records}
    other = {"schemaVersion": SCHEMA_VERSION, "note": "Các đội có sẵn, đã đối chiếu với Team chuẩn.", "records": inputs.get("otherTeams", [])}
    details = inputs.get("details", {})
    payloads = {"seasons.json": seasons, "index.json": index, "other-teams.json": other}
    for scope in inventory["scopes"]:
        key = scope["safeScopeKey"]
        payloads["details-" + key + ".json"] = {"schemaVersion": SCHEMA_VERSION, "records": details.get(key, [])}
    descriptor = {"schemaVersion": SCHEMA_VERSION, "inventoryHash": inventory.get("inventoryHash"), "mappingHash": inputs.get("mappingHash"), "decisionSnapshotHash": inputs.get("decisionSnapshotHash"), "dedupKeyVersion": inputs.get("dedupKeyVersion"), "legacyTeamsHash": inputs["legacyTeamsHash"], "contentLinksHash": inputs["contentLinksHash"], "payloadHashes": {name: sha(canonical_bytes(value)) for name, value in sorted(payloads.items())}}
    generation_id = sha(canonical_bytes(descriptor))
    target = output / generation_id
    if not target.exists():
        with tempfile.TemporaryDirectory(prefix=".recommended-generation-", dir=output) as folder:
            staging = Path(folder) / generation_id; staging.mkdir()
            files = {name: _write(staging / name, value) for name, value in sorted(payloads.items())}
            manifest = {**descriptor, "generationId": generation_id, "files": files, "allowedScopeKeys": sorted(scope["safeScopeKey"] for scope in inventory["scopes"]), "counts": {"recommended": len(records), "other": len(inputs.get("otherTeams", []))}}
            _write(staging / "manifest.json", manifest)
            os.replace(staging, target)
    else:
        expected_names = sorted([*payloads, "manifest.json"])
        if target.is_symlink() or not target.is_dir() or sorted(path.name for path in target.iterdir()) != expected_names:
            raise ValueError("Existing Recommended generation inventory changed")
        manifest = json.loads((target / "manifest.json").read_text())
        if manifest.get("generationId") != generation_id or manifest.get("payloadHashes") != descriptor["payloadHashes"]:
            raise ValueError("Existing Recommended manifest changed")
        for name, payload in payloads.items():
            path = target / name
            if path.is_symlink() or not path.is_file() or path.read_bytes() != canonical_bytes(payload):
                raise ValueError("Existing Recommended generation bytes changed: " + name)
    manifest_bytes = (target / "manifest.json").read_bytes()
    selector = {"schemaVersion": SCHEMA_VERSION, "generationId": generation_id, "manifestSha256": sha(manifest_bytes)}
    with tempfile.NamedTemporaryFile(dir=output, delete=False) as handle:
        handle.write(canonical_bytes(selector)); temporary = Path(handle.name)
    os.replace(temporary, output / "current.json")
    return selector

def build_generation(inputs, output, *, teams_bytes, content_links_bytes, ledger_bytes):
    candidate = prepare_publication_inputs(
        inputs,
        teams_bytes=teams_bytes,
        content_links_bytes=content_links_bytes,
        ledger_bytes=ledger_bytes,
    )
    validate_generation_inputs(candidate)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".writer-lock"
    try:
        lock.mkdir()
    except FileExistsError as error:
        raise RuntimeError("Another Recommended generation writer is active") from error
    try:
        return _build_generation_locked(candidate, output)
    finally:
        lock.rmdir()

def _display_name(kind, raw, mapping, cache):
    """Reviewed Vietnamese display name for one raw source name, else None."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    key = (kind, raw)
    if key not in cache:
        cache[key] = resolve_display_name(kind, raw, mapping)
    return cache[key]


def _localized_holder(holder, mapping, cache):
    tactics = holder.get("tacticSlotsRaw") or []
    tactic_kinds = [resolve_display_kind("tactic", raw, mapping) for raw in tactics]
    return {
        **holder,
        "displayNameVi": _display_name("hero", holder.get("nameRaw"), mapping, cache),
        "tacticSlotsVi": [_display_name(kind, raw, mapping, cache) for kind, raw in zip(tactic_kinds, tactics)],
        "tacticSlotKinds": tactic_kinds,
        "bookSlotsVi": [_display_name("book", raw, mapping, cache) for raw in holder.get("bookSlotsRaw") or []],
    }


def _localized_holders(holders, mapping, cache, shared):
    """Enrich a holder list once; index and detail rows share the same list object."""
    holders = holders or []
    key = id(holders)
    if key not in shared:
        shared[key] = (holders, [_localized_holder(holder, mapping, cache) for holder in holders])
    return shared[key][1]


def localize_rows(rows, mapping, cache=None, shared=None):
    """Return copies of Recommended rows with display-only Vietnamese sidecars."""
    cache = {} if cache is None else cache
    shared = {} if shared is None else shared
    return [
        {
            **row,
            "displayNameVi": resolve_team_display_name(row, mapping),
            "heroes": _localized_holders(row.get("heroes"), mapping, cache, shared),
            "alternativeHoldersRaw": _localized_holders(row.get("alternativeHoldersRaw"), mapping, cache, shared),
        }
        for row in rows
    ]


def load_display_map(path):
    """Validated display-only label and season name map; never a source of raw data."""
    display = json.loads(Path(path).read_bytes())
    if display.get("schemaVersion") != DISPLAY_SCHEMA_VERSION:
        raise ValueError("Unsupported Recommended display map schema")
    labels = display.get("labels")
    if not isinstance(labels, dict) or set(labels) != {"faction", "unit", "category", "subcategory"}:
        raise ValueError("Recommended display map needs faction, unit, category and subcategory labels")
    for group in labels.values():
        if not isinstance(group, dict) or any(not isinstance(raw, str) or not raw.strip() or not isinstance(vi, str) or not vi.strip()
                                              for raw, vi in group.items()):
            raise ValueError("Recommended display label is not a raw to Vietnamese pair")
    entries = display.get("seasons")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Recommended display map needs season entries")
    seasons = {}
    for entry in entries:
        if any(not isinstance(entry.get(name), str) or not entry[name].strip()
               for name in ("sourceSeasonId", "nameRaw", "displayNameVi", "displayCode", "evidenceRef")):
            raise ValueError("Recommended display season entry is incomplete")
        if entry.get("translationStatus") not in TRANSLATION_STATUSES:
            raise ValueError("Unsupported Recommended season translation status: " + str(entry.get("translationStatus")))
        if entry["sourceSeasonId"] in seasons:
            raise ValueError("Duplicate Recommended display season id: " + entry["sourceSeasonId"])
        seasons[entry["sourceSeasonId"]] = entry
    return {"labels": labels, "seasons": seasons}


def _display_season_options(options, display):
    """Season options with display-only names added; every published season needs a mapping."""
    missing = sorted(option["sourceSeasonId"] for option in options if option["sourceSeasonId"] not in display["seasons"])
    if missing:
        raise ValueError("Recommended display map is missing seasons: " + ", ".join(missing))
    enriched = []
    for option in options:
        entry = display["seasons"][option["sourceSeasonId"]]
        if entry["nameRaw"] != option.get("nameRaw"):
            raise ValueError("Recommended display season name differs from source: " + option["sourceSeasonId"])
        enriched.append({**option, "displayNameVi": entry["displayNameVi"], "displayCode": entry["displayCode"],
                         "translationStatus": entry["translationStatus"]})
    return enriched


def apply_display_map(inputs, display):
    """Publish display-only Vietnamese metadata on inventory, index and detail rows."""
    inventory = inputs["inventory"]
    options = _display_season_options(inventory.get("seasonOptions", []), display)
    by_season = {option["sourceSeasonId"]: option for option in options}
    categories = display["labels"]["category"]
    by_scope = {}
    for scope in inventory.get("scopes", []):
        option = by_season.get(scope.get("sourceSeasonId"))
        if option is None:
            raise ValueError("Recommended scope season is absent from source inventory: " + str(scope.get("sourceScopeId")))
        by_scope[scope["safeScopeKey"]] = {
            "sourceSeasonNameVi": option["displayNameVi"],
            "sourceSeasonCode": option["displayCode"],
            "sourceSeasonTranslationStatus": option["translationStatus"],
            "sourceCategoryNameVi": categories.get(scope.get("sourceCategoryId")),
        }
    inputs["inventory"] = {**inventory, "seasonOptions": options, "displayLabels": display["labels"]}
    inputs["records"] = [{**row, **by_scope[row["safeScopeKey"]]} for row in inputs.get("records", [])]
    inputs["details"] = {key: [{**row, **by_scope[key]} for row in rows] for key, rows in inputs.get("details", {}).items()}
    return inputs


DISPLAY_MAP_PATH = Path(__file__).resolve().parent / "recommended-display-map.json"


def inputs_from_cache(cache, identity_map=None, other_ledger=None, display_map=None):
    cache = Path(cache)
    frozen = json.loads((cache / "scope-inventory.json").read_text())
    manifest = json.loads((cache / "manifest.json").read_text())
    if manifest.get("inventoryHash") != frozen.get("inventoryHash"):
        raise ValueError("Cache does not match frozen Recommended inventory")
    states = {scope["sourceScopeId"]: scope for scope in manifest.get("scopes", [])}
    scopes = []
    records = []
    display_notes = {}
    details = {}

    def page(url):
        item = manifest.get("pages", {}).get(url)
        if not item:
            raise ValueError("Missing cached Recommended page: " + url)
        path = cache / item["path"]
        if path.is_symlink() or not path.is_file():
            raise ValueError("Invalid cached Recommended file")
        data = path.read_bytes()
        if sha(data) != item["sha256"]:
            raise ValueError("Cached Recommended hash mismatch")
        return data.decode("utf-8")

    for frozen_scope in frozen["scopes"]:
        scope = dict(states.get(frozen_scope["sourceScopeId"], frozen_scope))
        scopes.append(scope)
        if scope.get("state") == "uncollected-season":
            option = next(item for item in frozen["seasonOptions"] if item["sourceSeasonId"] == scope["sourceSeasonId"])
            if option.get("status") != "uncollected" or option.get("advertisedCountRaw") != 0:
                raise ValueError("Uncollected Recommended scope lacks source inventory evidence")
            details[scope["safeScopeKey"]] = []
            continue
        if scope.get("state") not in ("complete", "empty-category"):
            raise ValueError("Recommended scope is not publishable: " + scope["sourceScopeId"])
        listing = parse_recommended_list(page(scope["listUrl"]), requested_scope=scope["requestedQuery"])
        listed_urls = [row["sourceUrl"] for row in listing["records"]]
        if listed_urls != scope.get("orderedDetailUrls") or len(listed_urls) != scope.get("observedCardCount"):
            raise ValueError("Recommended list/cache membership differs")
        if scope["state"] == "empty-category":
            if listed_urls or listing["expectedCount"] != 0:
                raise ValueError("Recommended empty scope contains source records")
            details[scope["safeScopeKey"]] = []
            continue
        parsed = [parse_recommended_detail_with_display_notes(page(url), url) for url in listed_urls]
        parsed_details = [item[0] for item in parsed]
        display_notes[scope["safeScopeKey"]] = {
            raw["sourceConfigId"]: projection for raw, projection in parsed
        }
        joined = join_recommended_evidence(listing, parsed_details)
        if joined["inventory"]["missingDetails"] or len(joined["records"]) != len(listed_urls):
            raise ValueError("Recommended complete scope is missing details")
        scoped = []
        for index, detail in enumerate(joined["records"]):
            row = {
                **detail,
                "safeScopeKey": scope["safeScopeKey"],
                "sourceScopeId": scope["sourceScopeId"],
                "sourceSeasonId": scope["sourceSeasonId"],
                "sourceSeasonLabel": next(item["label"] for item in frozen["seasonOptions"] if item["sourceSeasonId"] == scope["sourceSeasonId"]),
                "sourceCategoryId": scope["sourceCategoryId"],
                "listIndex": index,
                "tierOrder": TIER_ORDER.get(detail.get("tierRaw"), 999),
                "subcategoryRaw": None,
            }
            records.append(row)
            scoped.append(detail)
        details[scope["safeScopeKey"]] = scoped
    inventory = {**frozen, "scopes": scopes}
    result = {
        "inventory": inventory,
        "records": records,
        "details": details,
        "otherTeams": [],
    }
    if identity_map is not None and other_ledger is not None:
        map_bytes = Path(identity_map).read_bytes()
        ledger_bytes = bytes(other_ledger) if isinstance(other_ledger, (bytes, bytearray)) else Path(other_ledger).read_bytes()
        ledger = json.loads(ledger_bytes)
        corpus = [item for scoped in details.values() for item in scoped]
        if ledger.get("dedupKeyVersion") != 1:
            raise ValueError("Unsupported Team khác dedup key version")
        if ledger.get("sourceInventoryHash") != inventory["inventoryHash"]:
            raise ValueError("Team khác ledger source inventory differs")
        if ledger.get("mappingFileSha256") != "sha256:" + sha(map_bytes):
            raise ValueError("Team khác ledger identity map differs")
        corpus_bytes = json.dumps(corpus, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
        if ledger.get("recommendedCorpusHash") != "sha256:" + sha(corpus_bytes):
            raise ValueError("Team khác ledger Recommended corpus differs")
        if len(ledger.get("decisions", [])) != ledger.get("inputTeamRows"):
            raise ValueError("Team khác ledger decision cardinality differs")
        counts = {name: sum(item.get("classification") == name for item in ledger["decisions"])
                  for name in ("distinct", "duplicate", "pendingIdentity", "pendingSource")}
        if counts != ledger.get("counts") or len(ledger.get("admitted", [])) != counts["distinct"]:
            raise ValueError("Team khác ledger counts differ")
        mapping = build_display_mapping(json.loads(map_bytes).get("entries", []))
        names, shared = {}, {}
        def attach_display_notes(row):
            projection = display_notes.get(row.get("safeScopeKey"), {}).get(row.get("sourceConfigId"))
            return {**row, "displayNotes": projection} if projection is not None else row

        records_with_notes = [attach_display_notes(row) for row in records]
        details_with_notes = {
            key: [
                {**row, "displayNotes": display_notes.get(key, {}).get(row.get("sourceConfigId"))}
                for row in rows
            ]
            for key, rows in details.items()
        }
        result["records"] = localize_rows(records_with_notes, mapping, names, shared)
        result["details"] = {key: localize_rows(rows, mapping, names, shared) for key, rows in details_with_notes.items()}
        result.update({
            "otherTeams": ledger["admitted"],
            "mappingHash": "sha256:" + sha(map_bytes),
            "decisionSnapshotHash": "sha256:" + sha(ledger_bytes),
            "dedupKeyVersion": ledger["dedupKeyVersion"],
        })
    if display_map is not None:
        apply_display_map(result, load_display_map(display_map))
    return result



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--identity-map", type=Path)
    parser.add_argument("--other-ledger", type=Path)
    parser.add_argument("--teams", type=Path, required=True)
    parser.add_argument("--content-links", type=Path, required=True)
    parser.add_argument("--display-map", type=Path, default=DISPLAY_MAP_PATH)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    teams_bytes = args.teams.read_bytes()
    content_links_bytes = args.content_links.read_bytes()
    ledger_bytes = args.other_ledger.read_bytes() if args.other_ledger else None
    if args.input and ledger_bytes is not None:
        inputs = json.loads(args.input.read_text())
    elif args.cache and args.identity_map and ledger_bytes is not None:
        inputs = inputs_from_cache(args.cache, args.identity_map, ledger_bytes, args.display_map)
    else:
        parser.error("use --input with --other-ledger or all of --cache, --identity-map and --other-ledger")
    build_generation(
        inputs,
        args.output,
        teams_bytes=teams_bytes,
        content_links_bytes=content_links_bytes,
        ledger_bytes=ledger_bytes,
    )


if __name__ == "__main__":
    main()
