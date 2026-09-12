"""Evidence-backed exact identity resolution for Recommended data."""
from __future__ import annotations

import hashlib
import json
import argparse
from pathlib import Path



def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def alias_key(raw):
    value = " ".join(raw.strip().split())
    for prefix in ("SP", "CO", "40Y"):
        if value.startswith(prefix + " "):
            return prefix + value[len(prefix) + 1:]
    return value


def build_mapping(entries):
    aliases = {}
    accepted = []
    for entry in entries:
        if entry.get("reviewStatus") != "reviewed" or not entry.get("evidenceRef"):
            continue
        item = dict(entry)
        item["aliases"] = sorted(set(item.get("aliases", [])))
        accepted.append(item)
        for alias in item["aliases"]:
            aliases.setdefault((item["kind"], alias_key(alias)), []).append(item)
    accepted.sort(key=lambda item: (item["kind"], item["stableId"]))
    return {"schemaVersion": 1, "entries": accepted, "aliases": aliases,
            "mappingHash": "sha256:" + hashlib.sha256(canonical_json(accepted).encode()).hexdigest()}


def resolve_identity(kind, raw, mapping):
    candidates = mapping.get("aliases", {}).get((kind, alias_key(raw)), []) if isinstance(raw, str) else []
    if not candidates:
        return {"status": "missing", "reason": "no-reviewed-exact-alias", "raw": raw}
    identities = {(item["stableId"], item.get("variant")) for item in candidates}
    if len(identities) != 1:
        return {"status": "ambiguous", "reason": "conflicting-reviewed-aliases",
                "raw": raw, "candidates": sorted(item["stableId"] for item in candidates)}
    item = candidates[0]
    return {"status": "resolved", "stableId": item["stableId"], "variant": item.get("variant"),
            "displayNameVi": item.get("displayNameVi"), "faction": item.get("faction"), "evidenceRef": item["evidenceRef"]}

def descriptor_from_dictionaries(heroes_path, tactics_path, books_path):
    inputs = {}
    entries = []
    for kind, path in (("hero", Path(heroes_path)), ("tactic", Path(tactics_path)), ("book", Path(books_path))):
        body = path.read_bytes()
        inputs[path.name] = "sha256:" + hashlib.sha256(body).hexdigest()
        for index, row in enumerate(json.loads(body)):
            chinese = row.get("chinese")
            aliases = [value for value in (chinese, row.get("hanViet"), row.get("viet")) if value]
            if not chinese or not aliases:
                continue
            stable = f"{kind}:" + hashlib.sha256(chinese.encode()).hexdigest()[:24]
            variant = next((name for name in ("40Y", "SP", "CO") if any(alias.startswith(name) for alias in aliases)), "base") if kind == "hero" else None
            entries.append({
                "kind": kind,
                "stableId": stable,
                "variant": variant,
                "aliases": sorted(set(aliases)),
                "displayNameVi": row.get("viet") or row.get("hanViet"),
                "faction": row.get("faction") if kind == "hero" else None,
                "reviewStatus": "reviewed",
                "evidenceRef": f"{path.name}#{index}",
            })
    entries.sort(key=lambda item: (item["kind"], item["stableId"]))
    descriptor = {"schemaVersion": 1, "evidenceInputs": inputs, "entries": entries}
    descriptor["mappingHash"] = "sha256:" + hashlib.sha256(canonical_json(descriptor).encode()).hexdigest()
    return descriptor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--heroes", type=Path, required=True)
    parser.add_argument("--tactics", type=Path, required=True)
    parser.add_argument("--books", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    descriptor = descriptor_from_dictionaries(args.heroes, args.tactics, args.books)
    args.output.write_text(json.dumps(descriptor, ensure_ascii=False, sort_keys=True, indent=2) + "\n")


if __name__ == "__main__":
    main()
