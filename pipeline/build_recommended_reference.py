"""Build and atomically select an immutable Recommended reference generation."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from pipeline.recommended_identity import build_mapping, resolve_identity
from pipeline.sgsdeck_recommended import join_recommended_evidence, parse_recommended_detail, parse_recommended_list


SCHEMA_VERSION = 1
SAFE_SCOPE = re.compile(r"s-[0-9a-f]{64}$")
TIER_ORDER = {"T0": 0, "T0.5": 1, "T1": 2, "T1.5": 3, "T2": 4, "T3": 5, "FUNC": 6, "功能隊": 6}


def canonical_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode()


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
    for scope in scopes:
        key = scope["safeScopeKey"]
        scoped_index = [row for row in records if row.get("safeScopeKey") == key]
        scoped_details = details.get(key)
        if scoped_details is None or len(scoped_index) != len(scoped_details):
            raise ValueError("Recommended index/detail membership differs")
        if scope["state"] != "complete" and (scoped_index or scoped_details):
            raise ValueError("Empty or uncollected scope contains records")
        if scope["state"] == "complete" and [row["sourceConfigId"] for row in scoped_index] != [row["sourceConfigId"] for row in scoped_details]:
            raise ValueError("Recommended index/detail identities differ")
    admitted = inputs.get("otherTeams", [])
    if any(row.get("classification") in ("duplicate", "pendingIdentity", "pendingSource") for row in admitted):
        raise ValueError("Public Team khác may contain admitted rows only")


def _build_generation_locked(inputs, output):
    inventory = inputs["inventory"]
    records = sorted(inputs.get("records", []), key=_rank)
    seasons = {"schemaVersion": SCHEMA_VERSION, "defaultSourceSeasonId": next((x["sourceSeasonId"] for x in inventory.get("seasonOptions", []) if x.get("status") == "available"), None), "seasonOptions": inventory.get("seasonOptions", []), "scopes": inventory["scopes"]}
    index = {"schemaVersion": SCHEMA_VERSION, "records": records}
    other = {"schemaVersion": SCHEMA_VERSION, "note": "Các đội có sẵn, đã đối chiếu với Team chuẩn.", "records": inputs.get("otherTeams", [])}
    details = inputs.get("details", {})
    payloads = {"seasons.json": seasons, "index.json": index, "other-teams.json": other}
    for scope in inventory["scopes"]:
        key = scope["safeScopeKey"]
        payloads["details-" + key + ".json"] = {"schemaVersion": SCHEMA_VERSION, "records": details.get(key, [])}
    descriptor = {"schemaVersion": SCHEMA_VERSION, "inventoryHash": inventory.get("inventoryHash"), "mappingHash": inputs.get("mappingHash"), "decisionSnapshotHash": inputs.get("decisionSnapshotHash"), "dedupKeyVersion": inputs.get("dedupKeyVersion"), "payloadHashes": {name: sha(canonical_bytes(value)) for name, value in sorted(payloads.items())}}
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

def build_generation(inputs, output):
    validate_generation_inputs(inputs)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    lock = output / ".writer-lock"
    try:
        lock.mkdir()
    except FileExistsError as error:
        raise RuntimeError("Another Recommended generation writer is active") from error
    try:
        return _build_generation_locked(inputs, output)
    finally:
        lock.rmdir()

def _display_name(kind, raw, mapping, cache):
    """Reviewed Vietnamese display name for one raw source name, else None."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    key = (kind, raw)
    if key not in cache:
        resolved = resolve_identity(kind, raw, mapping)
        cache[key] = resolved.get("displayNameVi") if resolved.get("status") == "resolved" else None
    return cache[key]


def _localized_holder(holder, mapping, cache):
    return {
        **holder,
        "displayNameVi": _display_name("hero", holder.get("nameRaw"), mapping, cache),
        "tacticSlotsVi": [_display_name("tactic", raw, mapping, cache) for raw in holder.get("tacticSlotsRaw") or []],
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
    return [{**row,
             "heroes": _localized_holders(row.get("heroes"), mapping, cache, shared),
             "alternativeHoldersRaw": _localized_holders(row.get("alternativeHoldersRaw"), mapping, cache, shared)}
            for row in rows]


def inputs_from_cache(cache, identity_map=None, other_ledger=None):
    cache = Path(cache)
    frozen = json.loads((cache / "scope-inventory.json").read_text())
    manifest = json.loads((cache / "manifest.json").read_text())
    if manifest.get("inventoryHash") != frozen.get("inventoryHash"):
        raise ValueError("Cache does not match frozen Recommended inventory")
    states = {scope["sourceScopeId"]: scope for scope in manifest.get("scopes", [])}
    scopes = []
    records = []
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
        parsed_details = [parse_recommended_detail(page(url), url) for url in listed_urls]
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
        ledger_bytes = Path(other_ledger).read_bytes()
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
        mapping = build_mapping(json.loads(map_bytes).get("entries", []))
        names, shared = {}, {}
        result["records"] = localize_rows(records, mapping, names, shared)
        result["details"] = {key: localize_rows(rows, mapping, names, shared) for key, rows in details.items()}
        result.update({
            "otherTeams": ledger["admitted"],
            "mappingHash": "sha256:" + sha(map_bytes),
            "decisionSnapshotHash": "sha256:" + sha(ledger_bytes),
            "dedupKeyVersion": ledger["dedupKeyVersion"],
        })
    return result



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--cache", type=Path)
    parser.add_argument("--identity-map", type=Path)
    parser.add_argument("--other-ledger", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.input:
        inputs = json.loads(args.input.read_text())
    elif args.cache and args.identity_map and args.other_ledger:
        inputs = inputs_from_cache(args.cache, args.identity_map, args.other_ledger)
    else:
        parser.error("use --input or all of --cache, --identity-map and --other-ledger")
    build_generation(inputs, args.output)


if __name__ == "__main__":
    main()
