"""Exact hero-and-assigned-tactic deduplication for Team khác."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
from pathlib import Path


from pipeline.recommended_identity import build_mapping, resolve_identity

DEDUP_KEY_VERSION = 1


def _canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def dedup_key(config):
    holders = []
    for holder in config.get("holders", []):
        hero = holder.get("heroIdentityId")
        tactics = holder.get("tacticIdentityIds")
        if not hero or tactics is None or any(not tactic for tactic in tactics):
            raise ValueError("Resolved hero and tactic ownership is required")
        holders.append((hero, sorted(tactics)))
    if len(holders) != 3 or len({hero for hero, _ in holders}) != 3:
        raise ValueError("One explicit three-holder configuration is required")
    payload = {"version": DEDUP_KEY_VERSION, "holders": sorted(holders)}
    return "sha256:" + hashlib.sha256(_canonical(payload).encode()).hexdigest()


def classify_candidates(candidates, recommended_corpus):
    corpus = {}
    for item in recommended_corpus:
        corpus.setdefault(dedup_key(item), []).append(item.get("sourceConfigId") or item.get("legacyTeamId"))
    admitted, decisions = [], []
    for candidate in candidates:
        base = {"legacyTeamId": candidate["legacyTeamId"], "legacyVariantId": candidate["legacyVariantId"]}
        try:
            key = dedup_key(candidate)
        except ValueError as error:
            decisions.append({**base, "classification": "pendingIdentity", "reason": str(error)})
            continue
        if key in corpus:
            decisions.append({**base, "classification": "duplicate", "dedupKey": key,
                              "matchingRecommended": sorted(corpus[key])})
        elif candidate.get("origin") == "external" and not candidate.get("sourceEvidence"):
            decisions.append({**base, "classification": "pendingSource", "dedupKey": key})
        else:
            public = dict(candidate)
            public["dedupKeyVersion"] = DEDUP_KEY_VERSION
            public.setdefault("sourceState", "unknown")
            public.setdefault("sourceLabel", "Nguồn chưa xác định")
            public.setdefault("sourceSeasonIds", None)
            public.setdefault("seasonAttribution", [])
            admitted.append(public)
            decisions.append({**base, "classification": "distinct", "dedupKey": key})
    return {"schemaVersion": 1, "dedupKeyVersion": DEDUP_KEY_VERSION,
            "admitted": admitted, "decisions": decisions,
            "counts": {name: sum(item["classification"] == name for item in decisions)
                       for name in ("distinct", "duplicate", "pendingIdentity", "pendingSource")}}

def _resolved_holder(hero, mapping, source=False):
    name = hero.get("nameRaw") if source else hero.get("name")
    tactics = hero.get("tacticSlotsRaw") if source else [item.get("name") for item in hero.get("tactics", [])]
    hero_identity = resolve_identity("hero", name, mapping)
    tactic_identities = [resolve_identity("tactic", value, mapping) for value in tactics if value]
    if hero_identity["status"] != "resolved" or len(tactic_identities) != len([value for value in tactics if value]) or any(item["status"] != "resolved" for item in tactic_identities):
        return None
    books = hero.get("bookSlotsRaw") if source else [item.get("name") for item in hero.get("books", [])]
    return {
        "heroIdentityId": hero_identity["stableId"],
        "tacticIdentityIds": [item["stableId"] for item in tactic_identities],
        "nameRaw": name,
        "faction": hero_identity.get("faction"),
        "displayNameVi": hero_identity.get("displayNameVi"),
        "tacticSlotsRaw": tactics,
        "bookSlotsRaw": books,
        "statFocusRaw": hero.get("statFocusRaw", ""),
        "notesRaw": hero.get("notesRaw") or hero.get("note") or "",
    }



def _partial_source_holders(row, mapping):
    holders = []
    for hero in row.get("heroes", []):
        hero_hit = resolve_identity("hero", hero["nameRaw"], mapping)
        tactic_hits = [resolve_identity("tactic", value, mapping) for value in hero.get("tacticSlotsRaw", [])]
        holders.append({
            "heroIdentityId": hero_hit.get("stableId") if hero_hit["status"] == "resolved" else None,
            "tacticIdentityIds": [hit.get("stableId") if hit["status"] == "resolved" else None for hit in tactic_hits],
        })
    return holders if len(holders) == 3 else None


def _holder_compatible(source, candidate):
    if source["heroIdentityId"] and source["heroIdentityId"] != candidate["heroIdentityId"]:
        return False
    candidate_tactics = list(candidate["tacticIdentityIds"])
    for tactic in source["tacticIdentityIds"]:
        if tactic is None:
            continue
        if tactic not in candidate_tactics:
            return False
        candidate_tactics.remove(tactic)
    return True


def _possibly_duplicate(partial_holders, candidate):
    return any(all(_holder_compatible(source, target) for source, target in zip(partial_holders, ordering))
               for ordering in itertools.permutations(candidate["holders"]))


def build_other_team_ledger(teams, recommended_records, mapping_descriptor, team_tiers=()):
    mapping = build_mapping(mapping_descriptor["entries"])
    corpus = []
    unresolved_source = set()
    tier_rows = {item["teamId"]: item.get("rankings", []) for item in team_tiers}
    partial_source = []
    for row in recommended_records:
        variants = [(row["sourceConfigId"], row.get("heroes", []))]
        alternatives = row.get("alternativeHoldersRaw", [])
        for index in range(0, len(alternatives), 3):
            group = alternatives[index:index + 3]
            if len(group) == 3:
                variants.append((f'{row["sourceConfigId"]}#alternative-{index // 3 + 1}', group))
        for source_id, heroes in variants:
            holders = [_resolved_holder(hero, mapping, True) for hero in heroes if hero.get("nameRaw")]
            if len(holders) == 3 and all(holder is not None for holder in holders):
                corpus.append({"sourceConfigId": source_id, "holders": holders})
                continue
            unresolved_source.add(row["sourceConfigId"])
            partial = _partial_source_holders({"heroes": heroes}, mapping)
            if partial is not None:
                partial_source.append((source_id, partial))
    candidates = []
    preliminary = []
    pending_branches = []
    for row in teams:
        holders = [_resolved_holder(hero, mapping) for hero in row.get("heroes", [])]
        raw = {"legacyTeamId": row["id"], "teamName": row.get("name"), "holders": holders}
        variant_id = "v-" + hashlib.sha256(_canonical(raw).encode()).hexdigest()
        base = {"legacyTeamId": row["id"], "legacyVariantId": variant_id}
        has_alternatives = any(hero.get("alternatives") or any(item.get("alternatives") for item in hero.get("tactics", [])) for hero in row.get("heroes", []))
        if has_alternatives:
            pending_branches.append({**base, "classification": "pendingAlternative"})
        if len(holders) != 3 or any(holder is None for holder in holders):
            preliminary.append({**base, "classification": "pendingIdentity", "reason": "unresolved-local-primary"})
            continue
        candidates.append({
            "holders": holders,
            **base,
            "name": row.get("name"),
            "nickname": row.get("nickname"),
            "unit": row.get("unitType") or [],
            "faction": row.get("faction") or (next(iter({holder["faction"] for holder in holders if holder.get("faction")})) if len({holder["faction"] for holder in holders if holder.get("faction")}) == 1 else "Hỗn hợp"),
            "source": row.get("source"),
            "historicalRankings": tier_rows.get(row["id"], []),
            "historicalTier": min((ranking.get("tier") for ranking in tier_rows.get(row["id"], []) if ranking.get("tier")), key=lambda tier: {"T0": 0, "T0.5": 1, "T1": 2, "T1.5": 3, "T2": 4, "T3": 5}.get(tier, 999), default=None),
            "origin": "existing-local",
            "sourceState": "known" if row.get("source") else "unknown",
            "sourceLabel": row.get("source") or "Nguồn chưa xác định",
            "sourceSeasonIds": None,
            "seasonAttribution": [],
        })
    result = classify_candidates(candidates, corpus)
    decisions = result["decisions"] + preliminary
    retained = []
    for item in result["admitted"]:
        possible = [source_id for source_id, partial in partial_source if _possibly_duplicate(partial, item)]
        if possible:
            decision = next(row for row in decisions if row["legacyTeamId"] == item["legacyTeamId"])
            decision.update({"classification": "pendingIdentity", "reason": "possibly-matches-unresolved-recommended", "possibleRecommended": possible})
        else:
            retained.append(item)
    decisions.sort(key=lambda item: item["legacyTeamId"])
    if len(decisions) != len(teams):
        raise ValueError("Every local team needs one final primary classification")
    result["admitted"] = retained
    result["decisions"] = decisions
    result["counts"] = {name: sum(item["classification"] == name for item in decisions)
                        for name in ("distinct", "duplicate", "pendingIdentity", "pendingSource")}
    result["unresolvedRecommended"] = sorted(unresolved_source)
    result["pending"] = [item for item in decisions if item["classification"].startswith("pending")]
    result["pendingBranches"] = pending_branches
    result["inputTeamRows"] = len(teams)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--teams", required=True)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--cache", help="verified crawler cache of Recommended pages")
    source.add_argument("--pack", help="captured source pack (repository-relative), verified against the reviewed pins")
    parser.add_argument("--root", default=".", help="repository root holding the policy and the --pack file")
    parser.add_argument("--identity-map", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--team-tier", required=True)
    args = parser.parse_args()
    if args.pack:
        # The pack was captured once from the crawler cache; it is the locked Recommended source when no cache
        # is on disk. `load_source_pack` refuses a pack that differs from the policy's reviewed source pins.
        from pipeline.site_localization import load_source_pack, pack_corpus
        pack = load_source_pack(Path(args.root), args.pack)
        recommended = pack_corpus(pack)
        inventory_hash = pack["inventory"]["inventoryHash"]
    else:
        from pipeline.build_recommended_reference import inputs_from_cache
        inputs = inputs_from_cache(args.cache)
        recommended = [item for scope in inputs["details"].values() for item in scope]
        inventory_hash = inputs["inventory"]["inventoryHash"]
    teams_bytes = Path(args.teams).read_bytes()
    tiers_bytes = Path(args.team_tier).read_bytes()
    mapping_bytes = Path(args.identity_map).read_bytes()
    teams = json.loads(teams_bytes)
    team_tiers = json.loads(tiers_bytes)
    mapping = json.loads(mapping_bytes)
    result = build_other_team_ledger(teams, recommended, mapping, team_tiers)
    result.update({
        "sourceInventoryHash": inventory_hash,
        "recommendedCorpusHash": "sha256:" + hashlib.sha256(_canonical(recommended).encode()).hexdigest(),
        "mappingFileSha256": "sha256:" + hashlib.sha256(mapping_bytes).hexdigest(),
        "localTeamsSha256": "sha256:" + hashlib.sha256(teams_bytes).hexdigest(),
        "teamTierSha256": "sha256:" + hashlib.sha256(tiers_bytes).hexdigest(),
    })
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(path), "inputTeamRows": result["inputTeamRows"],
                      "admitted": len(result["admitted"]), "unresolvedRecommended": len(result["unresolvedRecommended"])},
                     ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
