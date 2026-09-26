"""Evidence-backed exact identity resolution for Recommended data."""
from __future__ import annotations

import hashlib
import json
import argparse
import re
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


def build_display_mapping(entries):
    """Accept reviewed translations without promoting them to resolved identities."""
    mapping = build_mapping(entries)
    names = {}
    team_names = {}
    scoped_team_names = {}
    scoped_team_aliases = {}
    translations = []
    for entry in entries:
        if entry.get("reviewStatus") != "translation-reviewed":
            continue
        if (entry.get("kind") not in ("hero", "tactic", "book", "bond", "team") or not entry.get("evidenceRef")
                or not isinstance(entry.get("displayNameVi"), str) or not entry["displayNameVi"].strip()
                or not entry.get("aliases")):
            raise ValueError("Reviewed translation needs a kind, name, aliases and evidence")
        for alias in entry["aliases"]:
            if not isinstance(alias, str) or not alias.strip():
                raise ValueError("Reviewed translation alias must be non-empty")
            alias = alias_key(alias)
            if entry["kind"] == "team":
                if entry.get("stableId") is not None:
                    raise ValueError("Team translations must not define stableId")
                source_config_id = entry.get("sourceConfigId")
                if source_config_id is not None and (not isinstance(source_config_id, str) or not source_config_id.strip()):
                    raise ValueError("Scoped team translation needs a non-empty sourceConfigId")
                target = scoped_team_names if source_config_id is not None else team_names
                key = (source_config_id, alias) if source_config_id is not None else alias
                if source_config_id is not None and key in target:
                    raise ValueError("Duplicate scoped team translation: " + source_config_id + " / " + alias)
                if key in target and target[key] != entry["displayNameVi"]:
                    raise ValueError("Conflicting reviewed team translations: " + alias)
                target[key] = entry["displayNameVi"]
                if source_config_id is not None:
                    scoped_team_aliases.setdefault(source_config_id, set()).add(alias)
                continue
            key = (entry["kind"], alias)
            if key in names and names[key] != entry["displayNameVi"]:
                raise ValueError("Conflicting reviewed translations: " + alias)
            names[key] = entry["displayNameVi"]
        translations.append(entry)
    mapping["displayNames"] = names
    mapping["teamDisplayNames"] = team_names
    mapping["scopedTeamDisplayNames"] = scoped_team_names
    mapping["scopedTeamAliases"] = scoped_team_aliases
    if translations:
        mapping["mappingHash"] = "sha256:" + hashlib.sha256(canonical_json({
            "identities": mapping["entries"], "translations": translations,
        }).encode()).hexdigest()
    return mapping


def resolve_display_name(kind, raw, mapping):
    """Display approval is independent from the identity evidence required by dedup."""
    if not isinstance(raw, str) or not raw.strip():
        return None
    translated = mapping.get("displayNames", {}).get((kind, alias_key(raw)))
    if translated:
        return translated
    identity = resolve_identity(kind, raw, mapping)
    return identity.get("displayNameVi") if identity["status"] == "resolved" else None


HAN_TEXT = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")


def ascii_title_brackets(title):
    """A fully Vietnamese title shows ASCII brackets; titles still carrying Han text keep the source form."""
    if not isinstance(title, str) or HAN_TEXT.search(title) or not re.search("[（）]", title):
        return title
    title = re.sub(r"\s*（\s*", " (", title)
    title = re.sub(r"\s*）", ")", title)
    return " ".join(title.split())


def resolve_team_display_name(row, mapping):
    """Resolve a reviewed team title without changing source identity."""
    if not isinstance(row, dict):
        return None
    raw = row.get("nameZh")
    if not isinstance(raw, str) or not raw.strip():
        return None
    alias = alias_key(raw)
    source_config_id = row.get("sourceConfigId")
    if isinstance(source_config_id, str):
        translated = mapping.get("scopedTeamDisplayNames", {}).get((source_config_id, alias))
        if translated:
            return ascii_title_brackets(translated)
        if source_config_id in mapping.get("scopedTeamAliases", {}):
            raise ValueError("Scoped team translation source title mismatch: " + source_config_id)
    return ascii_title_brackets(mapping.get("teamDisplayNames", {}).get(alias))


def resolve_display_kind(kind, raw, mapping):
    """Correct reviewed source-slot classifications without rewriting source evidence."""
    if kind == "tactic" and resolve_display_name("bond", raw, mapping):
        return "bond"
    return kind

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
