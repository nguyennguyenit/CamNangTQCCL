"""Freeze reviewed route handles for the Recommended (Đội chuẩn), legacy (Đội khác) and Khai hoang
team pages.

`--write` derives the initial ledger once from the pinned generation and refuses to reassign an
existing ledger, so a later `displayNameVi` translation can never move a published URL. `--check`
only validates the frozen ledger (publication integrity, generation/hash pin, exact key sets,
routability, season-prefix rule and final-segment uniqueness) and never rebuilds assignments from
the current display names or titles.

The ledger schema version is independent of the Recommended publication schema version: the ledger
is v2 (adding `khaihoangSha256` and `handles.khaihoang`), while the Recommended selector, manifest
and index payloads stay v1.

    python3 -m pipeline.team_route_handles --write
    python3 -m pipeline.team_route_handles --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import statistics
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

PUBLICATION_SCHEMA_VERSION = 1
LEDGER_SCHEMA_VERSION = 2
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEDGER_PATH = REPO_ROOT / "pipeline" / "team-route-handles.json"
DEFAULT_GENERATION_ROOT = REPO_ROOT / "src" / "data" / "recommended-reference"
DEFAULT_TEAMS_PATH = REPO_ROOT / "data" / "teams.json"
DEFAULT_KHAIHOANG_PATH = REPO_ROOT / "data" / "khaihoang.json"
DEFAULT_DISPLAY_MAP_PATH = REPO_ROOT / "pipeline" / "recommended-display-map.json"

LEDGER_NOTE = "Handle URL đã review; gán một lần, không suy lại từ displayNameVi."
LEDGER_KEYS = ("schemaVersion", "generationId", "legacyTeamsSha256", "khaihoangSha256", "note", "handles")
HANDLE_GROUPS = ("recommended", "legacy", "khaihoang")

HEX64 = re.compile(r"[0-9a-f]{64}")
SELECTOR_KEYS = ["generationId", "manifestSha256", "schemaVersion"]
ARTIFACT_NAME = re.compile(r"^(?:manifest|seasons|index|other-teams|hero-summaries|details-s-[0-9a-f]{64})\.json$")
REQUIRED_ARTIFACTS = ("index.json", "other-teams.json", "seasons.json", "hero-summaries.json")

DIAGNOSTIC_LIMIT = 20
MIXED_FACTION = "混"
NUMBER_FIELDS = ("tierOrder", "value", "listIndex")
DELTA_TAGS = {"zhuanyou": "chuyen-huu", "qun": "quan", "hun": "hon-hop"}
LEGACY_ID_SUFFIX = re.compile(r"(\d+)$")
ASCII_PART = re.compile(r"[^A-Za-z0-9-]")
NON_SLUG = re.compile(r"[^a-z0-9]+")
NON_SEASON_CHAR = re.compile(r"[^a-z0-9]")
TRAILING_PARENTHETICAL = re.compile(r"\s*[\(（]([^()（）]*)[\)）]\s*$")
PARENTHETICAL_SEPARATOR = re.compile(r"[,，]")

# ECMAScript `\s` is WhiteSpace ∪ LineTerminator: U+FEFF is whitespace, U+0085 and U+180E are not.
# Python's own `\s` disagrees on exactly those code points, so the class is spelled out to keep
# parity with `isRoutableIdentifier` in src/lib/team-detail-routes.ts.
ECMASCRIPT_WHITESPACE = (
    "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680"
    "\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
)
UNSAFE_IDENTIFIER = re.compile('[\u0000-\u001f\u007f/\\\\?#%:*"<>|' + ECMASCRIPT_WHITESPACE + "]")

# Baselines measured on the pinned generation (brainstorm 5c–5d, plan phase 1). `--write` prints
# them and stops when the generated ledger deviates instead of freezing a different set of URLs.
PINNED_BASELINE = {
    "7f02c639abaeab6bcd7249eb0b5cfc469a130a071cb13576abf2648a0ebf066b": {
        "stats": {
            "keys": 1366,
            "groupKeys": 1264,
            "collisionGroups": 83,
            "collisionRows": 185,
            "taggedRows": 166,
            "distinctHandles": 638,
            "distinctSegments": 1366,
            "averageSegmentLength": 22.83,
            "maxSegmentLength": 55,
        },
        "legacyKeys": 166,
        "legacyCollisionGroups": 14,
        "ambiguousHandles": {
            "pk-s11-do-doc-cung": {"s11-wu-dudu-gong": "do-doc-cung", "s11-wu-dudu-zhuanyou": "do-doc-cung-chuyen-huu"},
            "pk-s25-hoang-ma": {"s25-huangma-hun": "hoang-ma-hon-hop", "s25-huangma-qun": "hoang-ma"},
            "pk-s25-on-hau-cung": {"s25-wenhou-gong": "on-hau-cung-quan", "s25-wenhou-gong-hun": "on-hau-cung"},
            "pk-s26-don-don-thuan": {"s26-dundun-dun": "don-don-thuan", "yxms-031-惇惇盾": "don-don-thuan-yxms-031"},
            "pk-s27-hoang-ma": {"s27-huangma-hun": "hoang-ma-hon-hop", "s27-huangma-qun": "hoang-ma"},
            "pk-s27-on-hau-cung": {"s27-wenhou-gong-hun": "on-hau-cung", "s27-wenhou-gong-qun": "on-hau-cung-quan"},
            "pk-s28-hoang-ma": {"s28-huangma-hun": "hoang-ma-hon-hop", "s28-huangma-qun": "hoang-ma"},
            "pk-s28-on-hau-cung": {"s28-wenhou-gong": "on-hau-cung-quan", "s28-wenhou-gong-hun": "on-hau-cung"},
        },
    },
}


class TeamRouteHandleError(Exception):
    """A handle could not be derived, or the frozen ledger failed validation."""


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_routable_identifier(value: object) -> bool:
    """Mirror of `isRoutableIdentifier` in src/lib/team-detail-routes.ts."""
    return (
        isinstance(value, str)
        and value != ""
        and len(value.encode("utf-8", "surrogatepass")) <= 128
        and UNSAFE_IDENTIFIER.search(value) is None
        and not value.startswith(".")
        and not value.endswith(".")
    )


def slug(value: str) -> str:
    """`S(x)`: strip diacritics, fold `đ`, lowercase, collapse non `[a-z0-9]` runs into `-`."""
    decomposed = unicodedata.normalize("NFD", value)
    folded = "".join(char for char in decomposed if not unicodedata.combining(char))
    return NON_SLUG.sub("-", folded.lower().replace("đ", "d")).strip("-")


def season_code(record: dict) -> str:
    """`SC(r)`: the season code lowercased with every non `[a-z0-9]` character turned into `-`."""
    code = record.get("sourceSeasonCode")
    if not isinstance(code, str) or not code.strip():
        raise TeamRouteHandleError(f"Recommended row {record.get('sourceConfigId')!r} has no sourceSeasonCode")
    return NON_SEASON_CHAR.sub("-", code.lower())


def split_parenthetical(name: str) -> tuple[str, str | None]:
    """Split a trailing `(...)`/`（...）` suffix off a display name."""
    match = TRAILING_PARENTHETICAL.search(name)
    if match is None:
        return name.strip(), None
    return name[: match.start()].strip(), match.group(1).strip()


def common_prefix(values) -> str:
    values = list(values)
    if not values:
        return ""
    prefix = values[0]
    for value in values[1:]:
        while prefix and not value.startswith(prefix):
            prefix = prefix[:-1]
    return prefix


def ascii_part(identifier: str) -> str:
    return ASCII_PART.sub("", identifier).strip("-")


def _require_ranking_fields(record: dict) -> None:
    for field in NUMBER_FIELDS:
        value = record.get(field)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise TeamRouteHandleError(
                f"Recommended row {record.get('sourceConfigId')!r} needs a numeric {field} to rank its "
                "(season, name) collision group"
            )


def _rank(record: dict):
    _require_ranking_fields(record)
    return (
        record["tierOrder"],
        -record["value"],
        0 if record.get("factionRaw") != MIXED_FACTION else 1,
        record["listIndex"],
        str(record["sourceConfigId"]),
    )


def _season_tokens(record: dict) -> set[str]:
    """Every spelling of a row's season that can prefix a `sourceConfigId` (`PK-S26`, `s26`)."""
    tokens = {season_code(record)}
    for value in (record.get("sourceSeasonId"), record.get("sourceSeasonCode")):
        if isinstance(value, str) and value.strip():
            lowered = value.lower()
            tokens.update((lowered, lowered.rsplit("-", 1)[-1]))
    return {token for token in tokens if token}


def strip_season_prefix(identifier: str, tokens) -> str:
    for token in sorted(tokens, key=len, reverse=True):
        if identifier == token:
            return ""
        if identifier.startswith(token + "-"):
            return identifier[len(token) + 1 :]
    return identifier


def build_recommended_handles(records, faction_labels: dict) -> tuple[dict, dict]:
    """Derive one handle per Recommended row.

    Collision groups are keyed by `(SC, base)` — the season is part of the key, so the same team
    name in another season keeps the plain handle.
    """
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    bases: dict[str, str] = {}
    seasons: dict[str, str] = {}
    for record in records:
        source_config_id = record.get("sourceConfigId")
        if not isinstance(source_config_id, str) or not source_config_id:
            raise TeamRouteHandleError("Recommended row is missing sourceConfigId")
        if source_config_id in bases:
            raise TeamRouteHandleError(f"Duplicate Recommended sourceConfigId {source_config_id}")
        display_name = record.get("displayNameVi")
        if not isinstance(display_name, str) or not display_name.strip():
            raise TeamRouteHandleError(f"Recommended row {source_config_id} has no displayNameVi")
        base = slug(split_parenthetical(display_name)[0])
        if not base:
            raise TeamRouteHandleError(f"Recommended row {source_config_id} has an empty name slug: {display_name!r}")
        seasons[source_config_id] = season_code(record)
        bases[source_config_id] = base
        groups[(seasons[source_config_id], base)].append(record)

    handles: dict[str, str] = {}
    collisions = []
    ambiguous = []
    for (season, base), rows in groups.items():
        if len(rows) == 1:
            row = rows[0]
            handles[row["sourceConfigId"]] = _drop_season_prefix(base, season)
            continue
        # The ranking decides which row keeps the plain handle, so every row of a colliding group
        # must be rankable; an implicit order would silently freeze a different URL.
        for row in rows:
            _require_ranking_fields(row)
        parentheticals = {row["sourceConfigId"]: split_parenthetical(row["displayNameVi"])[1] for row in rows}
        plain = [row for row in rows if parentheticals[row["sourceConfigId"]] is None]
        winner = min(plain, key=_rank)["sourceConfigId"] if plain else None
        stripped = {row["sourceConfigId"]: strip_season_prefix(row["sourceConfigId"], _season_tokens(row)) for row in rows}
        prefix = common_prefix(stripped.values())
        factions = {row.get("factionRaw") for row in rows}

        assigned: dict[str, str] = {}
        for row in rows:
            source_config_id = row["sourceConfigId"]
            inner = parentheticals[source_config_id]
            if inner is not None:
                tag = slug(PARENTHETICAL_SEPARATOR.split(inner, 1)[0])
            elif source_config_id == winner:
                tag = ""
            elif len(factions) > 1:
                label = faction_labels.get(row.get("factionRaw"))
                if not isinstance(label, str) or not label.strip():
                    raise TeamRouteHandleError(
                        f"Collision group ({season}, {base}) mixes factions but {source_config_id} "
                        f"has no reviewed label for factionRaw {row.get('factionRaw')!r}"
                    )
                tag = slug(label)
            else:
                delta = stripped[source_config_id][len(prefix) :]
                if not delta:
                    tag = "goc"
                elif re.search(r"[^a-z0-9-]", delta.lower()):
                    tag = slug(ascii_part(source_config_id))
                else:
                    tag = DELTA_TAGS.get(slug(delta), slug(delta))
            handle = f"{base}-{tag}" if tag else base
            assigned[source_config_id] = _drop_season_prefix(handle, season)

        if len(set(assigned.values())) != len(assigned):
            raise TeamRouteHandleError(
                f"Collision group ({season}, {base}) produced duplicate handles: "
                + ", ".join(f"{source_config_id}={handle}" for source_config_id, handle in sorted(assigned.items()))
            )
        handles.update(assigned)
        group = {"season": season, "base": base, "handles": assigned}
        collisions.append(group)
        if any(parentheticals[row["sourceConfigId"]] is None and assigned[row["sourceConfigId"]] != base for row in rows):
            ambiguous.append(group)

    segments = [f"{seasons[record['sourceConfigId']]}-{handles[record['sourceConfigId']]}" for record in records]
    stats = {
        "keys": len(records),
        "groupKeys": len(groups),
        "collisionGroups": len(collisions),
        "collisionRows": sum(len(group["handles"]) for group in collisions),
        "taggedRows": sum(1 for record in records if handles[record["sourceConfigId"]] != bases[record["sourceConfigId"]]),
        "distinctHandles": len(set(handles.values())),
        "distinctSegments": len(set(segments)),
        "averageSegmentLength": round(statistics.mean(len(segment) for segment in segments), 2),
        "maxSegmentLength": max(len(segment) for segment in segments),
        "collisions": sorted(collisions, key=lambda group: (group["season"], group["base"])),
        "ambiguous": sorted(ambiguous, key=lambda group: (group["season"], group["base"])),
    }
    return handles, stats


def _drop_season_prefix(handle: str, season: str) -> str:
    """Step 6: a handle may not repeat the season the route layer already prepends."""
    if handle == season:
        return ""
    if handle.startswith(season + "-"):
        return handle[len(season) + 1 :]
    return handle


def build_legacy_handles(teams) -> tuple[dict, dict]:
    """Derive one handle per legacy team; duplicate labels are tagged with the numeric id suffix."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for team in teams:
        team_id = team.get("id")
        if not isinstance(team_id, str) or not team_id:
            raise TeamRouteHandleError("Legacy team is missing id")
        nickname = team.get("nickname")
        label = nickname if isinstance(nickname, str) and nickname else team.get("name")
        if not isinstance(label, str) or not label.strip():
            raise TeamRouteHandleError(f"Legacy team {team_id} has no nickname or name")
        base = slug(label)
        if not base:
            raise TeamRouteHandleError(f"Legacy team {team_id} has an empty name slug: {label!r}")
        groups[base].append(team)

    handles: dict[str, str] = {}
    collisions = []
    for base, rows in groups.items():
        if len(rows) == 1:
            handles[rows[0]["id"]] = base
            continue
        assigned = {}
        for team in rows:
            suffix = LEGACY_ID_SUFFIX.search(team["id"])
            if suffix is None:
                raise TeamRouteHandleError(
                    f"Legacy team {team['id']} shares the handle {base} but has no numeric id suffix"
                )
            assigned[team["id"]] = f"{base}-{suffix.group(1)}"
        if len(set(assigned.values())) != len(assigned):
            raise TeamRouteHandleError(
                f"Legacy teams sharing the handle {base} produced duplicates: "
                + ", ".join(f"{team_id}={handle}" for team_id, handle in sorted(assigned.items()))
            )
        handles.update(assigned)
        collisions.append({"base": base, "handles": assigned})

    stats = {
        "keys": len(teams),
        "groupKeys": len(groups),
        "collisionGroups": len(collisions),
        "taggedRows": sum(len(group["handles"]) for group in collisions),
        "distinctHandles": len(set(handles.values())),
        "collisions": sorted(collisions, key=lambda group: group["base"]),
    }
    return handles, stats


def khaihoang_ids(teams) -> list[str]:
    """The declared team ids, rejecting a missing or repeated id instead of falling back to an index."""
    ids: list[str] = []
    seen: set[str] = set()
    for team in teams:
        if not isinstance(team, dict):
            raise TeamRouteHandleError(f"Khai hoang team must be an object, got {team!r}")
        team_id = team.get("id")
        if not isinstance(team_id, str) or not team_id:
            raise TeamRouteHandleError(f"Khai hoang team {team.get('title')!r} has no id")
        if team_id in seen:
            raise TeamRouteHandleError(f"Khai hoang source declares the id {team_id!r} more than once")
        seen.add(team_id)
        ids.append(team_id)
    return ids


def build_khaihoang_handles(teams) -> tuple[dict, dict]:
    """One-time assignment: id and handle both start as the ASCII slug of the current title.

    `--check` never re-derives them, so a later title edit or a reorder cannot move a published URL.
    """
    khaihoang_ids(teams)  # reject a missing or repeated id before assigning anything
    handles: dict[str, str] = {}
    for team in teams:
        team_id = team["id"]
        title = team.get("title")
        if not isinstance(title, str) or not title.strip():
            raise TeamRouteHandleError(f"Khai hoang team {team_id!r} has no title to slug")
        handle = slug(title)
        if not handle:
            raise TeamRouteHandleError(f"Khai hoang team {team_id!r} has an empty title slug: {title!r}")
        if not is_routable_identifier(handle):
            raise TeamRouteHandleError(f"Khai hoang team {team_id!r} title slug is not routable: {handle!r}")
        handles[team_id] = handle

    shared: dict[str, list[str]] = defaultdict(list)
    for team_id, handle in handles.items():
        shared[handle].append(team_id)
    duplicates = {handle: ids for handle, ids in shared.items() if len(ids) > 1}
    if duplicates:
        raise TeamRouteHandleError(
            "Khai hoang titles produce duplicate handles: "
            + ", ".join(f"{handle}={', '.join(sorted(ids))}" for handle, ids in sorted(duplicates.items()))
        )
    stats = {"keys": len(handles), "distinctHandles": len(set(handles.values()))}
    return handles, stats


def build_ledger(
    generation_id: str,
    teams_bytes: bytes,
    khaihoang_bytes: bytes,
    recommended: dict,
    legacy: dict,
    khaihoang: dict,
) -> dict:
    return {
        "schemaVersion": LEDGER_SCHEMA_VERSION,
        "generationId": generation_id,
        "legacyTeamsSha256": "sha256:" + sha256_hex(teams_bytes),
        "khaihoangSha256": "sha256:" + sha256_hex(khaihoang_bytes),
        "note": LEDGER_NOTE,
        "handles": {"recommended": dict(recommended), "legacy": dict(legacy), "khaihoang": dict(khaihoang)},
    }


def ledger_bytes(ledger: dict) -> bytes:
    return (json.dumps(ledger, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def _ledger_handles(ledger: dict) -> dict:
    if not isinstance(ledger, dict) or set(ledger) != set(LEDGER_KEYS):
        raise TeamRouteHandleError(f"Ledger must declare exactly {', '.join(LEDGER_KEYS)}")
    if ledger["schemaVersion"] != LEDGER_SCHEMA_VERSION:
        raise TeamRouteHandleError(
            f"Ledger schemaVersion {ledger['schemaVersion']!r} is not {LEDGER_SCHEMA_VERSION}"
        )
    if not isinstance(ledger["generationId"], str) or not HEX64.fullmatch(ledger["generationId"]):
        raise TeamRouteHandleError(f"Ledger generationId {ledger['generationId']!r} is not a generation id")
    if not isinstance(ledger["legacyTeamsSha256"], str):
        raise TeamRouteHandleError("Ledger legacyTeamsSha256 must be a string")
    if not isinstance(ledger["khaihoangSha256"], str):
        raise TeamRouteHandleError("Ledger khaihoangSha256 must be a string")
    if not isinstance(ledger["note"], str) or not ledger["note"].strip():
        raise TeamRouteHandleError("Ledger note must be a non-empty string")
    handles = ledger["handles"]
    if not isinstance(handles, dict) or set(handles) != set(HANDLE_GROUPS):
        raise TeamRouteHandleError(f"Ledger handles must declare exactly {', '.join(HANDLE_GROUPS)}")
    for group in HANDLE_GROUPS:
        if not isinstance(handles[group], dict):
            raise TeamRouteHandleError(f"Ledger handles.{group} must be an object")
    return handles


def _khaihoang_problems(ledger: dict, khaihoang: dict, khaihoang_bytes: bytes, khaihoang_teams, problems: list) -> None:
    """Khai hoang gate: source hash, id set, routability and one handle per team."""
    expected_hash = "sha256:" + sha256_hex(khaihoang_bytes)
    if ledger["khaihoangSha256"] != expected_hash:
        problems.append(
            f"ledger khaihoangSha256 {ledger['khaihoangSha256']!r} is not the current Khai hoang hash {expected_hash!r}"
        )
    try:
        ids = khaihoang_ids(khaihoang_teams)
    except TeamRouteHandleError as error:
        problems.append(str(error))
        return
    missing = sorted(set(ids) - set(khaihoang))
    if missing:
        problems.append(
            f"ledger is missing {len(missing)} Khai hoang handles: {', '.join(missing[:DIAGNOSTIC_LIMIT])}"
        )
    extra = sorted(set(khaihoang) - set(ids))
    if extra:
        problems.append(
            f"ledger declares {len(extra)} unknown Khai hoang handles: {', '.join(extra[:DIAGNOSTIC_LIMIT])}"
        )
    shared: dict[str, list[str]] = defaultdict(list)
    for team_id in ids:
        if team_id not in khaihoang:
            continue
        handle = khaihoang[team_id]
        if not isinstance(handle, str):
            problems.append(f"Khai hoang handle for {team_id} must be a string, got {handle!r}")
            continue
        if not is_routable_identifier(handle):
            problems.append(f"Khai hoang handle {handle!r} for {team_id} is not routable")
        shared[handle].append(team_id)
    for handle, ids_sharing in sorted(shared.items()):
        if len(ids_sharing) > 1:
            problems.append(f"Khai hoang handle {handle!r} is shared by {', '.join(sorted(ids_sharing))}")


def validate_ledger(
    ledger: dict,
    *,
    generation_id: str,
    records,
    teams_bytes: bytes,
    teams,
    khaihoang_bytes: bytes,
    khaihoang_teams,
) -> None:
    """Gate the frozen ledger: pin, exact key sets, routability, season prefix and uniqueness."""
    handles = _ledger_handles(ledger)
    recommended, legacy, khaihoang = handles["recommended"], handles["legacy"], handles["khaihoang"]
    problems = []

    if ledger["generationId"] != generation_id:
        problems.append(f"ledger generationId {ledger['generationId']!r} is not the selected generation {generation_id!r}")
    expected_hash = "sha256:" + sha256_hex(teams_bytes)
    if ledger["legacyTeamsSha256"] != expected_hash:
        problems.append(
            f"ledger legacyTeamsSha256 {ledger['legacyTeamsSha256']!r} is not the current legacy teams hash {expected_hash!r}"
        )
    _khaihoang_problems(ledger, khaihoang, khaihoang_bytes, khaihoang_teams, problems)

    records_by_id: dict[str, dict] = {}
    for record in records:
        source_config_id = record.get("sourceConfigId")
        if not isinstance(source_config_id, str) or not source_config_id:
            problems.append(f"generation row {source_config_id!r} has no sourceConfigId")
            continue
        records_by_id[source_config_id] = record

    missing = sorted(set(records_by_id) - set(recommended))
    if missing:
        problems.append(f"ledger is missing {len(missing)} Recommended handles: {', '.join(missing[:DIAGNOSTIC_LIMIT])}")
    extra = sorted(set(recommended) - set(records_by_id))
    if extra:
        problems.append(f"ledger declares {len(extra)} unknown Recommended handles: {', '.join(extra[:DIAGNOSTIC_LIMIT])}")

    segments: dict[str, list[str]] = defaultdict(list)
    for source_config_id, record in records_by_id.items():
        if source_config_id not in recommended:
            continue
        handle = recommended[source_config_id]
        if not isinstance(handle, str):
            problems.append(f"Recommended handle for {source_config_id} must be a string, got {handle!r}")
            continue
        if not is_routable_identifier(handle):
            problems.append(f"Recommended handle {handle!r} for {source_config_id} is not routable")
        season = season_code(record)
        if handle == season or handle.startswith(season + "-"):
            problems.append(f"Recommended handle {handle!r} for {source_config_id} repeats its season code {season!r}")
        segments[f"{season}-{handle}"].append(source_config_id)
    for segment, ids in sorted(segments.items()):
        if len(ids) > 1:
            problems.append(f"Recommended route segment {segment!r} is shared by {', '.join(sorted(ids))}")

    team_ids = []
    for team in teams:
        team_id = team.get("id")
        if not isinstance(team_id, str) or not team_id:
            problems.append(f"legacy team {team_id!r} has no id")
            continue
        team_ids.append(team_id)
    missing_legacy = sorted(set(team_ids) - set(legacy))
    if missing_legacy:
        problems.append(f"ledger is missing {len(missing_legacy)} legacy handles: {', '.join(missing_legacy[:DIAGNOSTIC_LIMIT])}")
    extra_legacy = sorted(set(legacy) - set(team_ids))
    if extra_legacy:
        problems.append(f"ledger declares {len(extra_legacy)} unknown legacy handles: {', '.join(extra_legacy[:DIAGNOSTIC_LIMIT])}")
    shared: dict[str, list[str]] = defaultdict(list)
    for team_id in team_ids:
        if team_id not in legacy:
            continue
        handle = legacy[team_id]
        if not isinstance(handle, str):
            problems.append(f"legacy handle for {team_id} must be a string, got {handle!r}")
            continue
        if not is_routable_identifier(handle):
            problems.append(f"legacy handle {handle!r} for {team_id} is not routable")
        shared[handle].append(team_id)
    for handle, ids in sorted(shared.items()):
        if len(ids) > 1:
            problems.append(f"legacy handle {handle!r} is shared by {', '.join(sorted(ids))}")

    if problems:
        raise TeamRouteHandleError("ledger failed validation:\n" + "\n".join(problems))


@dataclass(frozen=True)
class Publication:
    generation_id: str
    manifest_sha256: str
    manifest: dict
    records: tuple
    files: dict


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _regular_file(path: Path, parent: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise TeamRouteHandleError(f"Recommended artifact is not a regular file: {path}")
    resolved = path.resolve()
    if resolved.parent != parent.resolve():
        raise TeamRouteHandleError(f"Recommended artifact escapes its generation: {path}")
    return path.read_bytes()


def read_publication(root_dir) -> Publication:
    """Read the selected generation, refusing any checksum or inventory drift."""
    root = Path(root_dir)
    if not root.is_dir():
        raise TeamRouteHandleError(f"Recommended root is not a directory: {root}")
    root = root.resolve()
    current_path = root / "current.json"
    current_bytes = _regular_file(current_path, root)
    current = json.loads(current_bytes)
    if (
        not isinstance(current, dict)
        or sorted(current) != sorted(SELECTOR_KEYS)
        or current.get("schemaVersion") != PUBLICATION_SCHEMA_VERSION
        or not HEX64.fullmatch(str(current.get("generationId")))
        or not HEX64.fullmatch(str(current.get("manifestSha256")))
    ):
        raise TeamRouteHandleError("Invalid Recommended current selector")
    generation = root / current["generationId"]
    if generation.is_symlink() or not generation.is_dir() or not _inside(generation.resolve(), root):
        raise TeamRouteHandleError("Invalid Recommended generation directory")
    manifest_bytes = _regular_file(generation / "manifest.json", generation)
    if sha256_hex(manifest_bytes) != current["manifestSha256"]:
        raise TeamRouteHandleError("Recommended manifest hash mismatch")
    manifest = json.loads(manifest_bytes)
    if (
        not isinstance(manifest, dict)
        or manifest.get("schemaVersion") != PUBLICATION_SCHEMA_VERSION
        or manifest.get("generationId") != current["generationId"]
        or manifest.get("dedupKeyVersion") != 1
    ):
        raise TeamRouteHandleError("Recommended manifest identity mismatch")
    declared = sorted((manifest.get("files") or {}).keys())
    scopes = manifest.get("allowedScopeKeys") if isinstance(manifest.get("allowedScopeKeys"), list) else []
    required = sorted([*REQUIRED_ARTIFACTS, *(f"details-{scope}.json" for scope in scopes)])
    if (
        not declared
        or "manifest.json" in declared
        or any(not ARTIFACT_NAME.fullmatch(name) for name in declared)
        or declared != required
    ):
        raise TeamRouteHandleError("Invalid Recommended file inventory")
    actual = sorted(entry.name for entry in generation.iterdir())
    if actual != sorted([*declared, "manifest.json"]):
        raise TeamRouteHandleError("Recommended generation inventory mismatch")
    files = {"manifest.json": manifest_bytes}
    for name in declared:
        data = _regular_file(generation / name, generation)
        item = manifest["files"][name]
        if not isinstance(item, dict) or len(data) != item.get("bytes") or sha256_hex(data) != item.get("sha256"):
            raise TeamRouteHandleError(f"Recommended artifact hash mismatch: {name}")
        files[name] = data
    if current_path.read_bytes() != current_bytes:
        raise TeamRouteHandleError("Recommended current changed during snapshot")
    index = json.loads(files["index.json"])
    if not isinstance(index, dict) or index.get("schemaVersion") != PUBLICATION_SCHEMA_VERSION or not isinstance(index.get("records"), list):
        raise TeamRouteHandleError("Unsupported Recommended index payload")
    return Publication(
        generation_id=current["generationId"],
        manifest_sha256=current["manifestSha256"],
        manifest=manifest,
        records=tuple(index["records"]),
        files=files,
    )


def load_teams(path) -> tuple[bytes, list]:
    data = Path(path).read_bytes()
    teams = json.loads(data)
    if not isinstance(teams, list) or not teams:
        raise TeamRouteHandleError(f"Legacy teams artifact must contain teams: {path}")
    return data, teams


def load_khaihoang(path) -> tuple[bytes, list]:
    data = Path(path).read_bytes()
    document = json.loads(data)
    teams = document.get("teams") if isinstance(document, dict) else None
    if not isinstance(teams, list) or not teams:
        raise TeamRouteHandleError(f"Khai hoang artifact must contain teams: {path}")
    return data, teams


def load_faction_labels(path) -> dict:
    document = json.loads(Path(path).read_bytes())
    labels = document.get("labels", {}).get("faction") if isinstance(document, dict) else None
    if not isinstance(labels, dict) or not labels:
        raise TeamRouteHandleError(f"Display map has no labels.faction: {path}")
    return labels


def _report_collisions(label: str, groups, out) -> None:
    out(f"{label}: {len(groups)}")
    for group in groups:
        handles = ", ".join(f"{key}={handle}" for key, handle in sorted(group["handles"].items()))
        prefix = f"{group['season']}/" if "season" in group else ""
        out(f"  {prefix}{group['base']}: {handles}")


def _report_baseline(generation_id: str, stats: dict, legacy_stats: dict, recommended: dict, out) -> None:
    out(f"generation: {generation_id}")
    for key in ("keys", "groupKeys", "collisionGroups", "collisionRows", "taggedRows", "distinctHandles", "distinctSegments"):
        out(f"{key}: {stats[key]}")
    out(f"segment length avg/max: {stats['averageSegmentLength']}/{stats['maxSegmentLength']}")
    out(f"legacy handles: {legacy_stats['keys']} (collision groups: {legacy_stats['collisionGroups']}, tagged rows: {legacy_stats['taggedRows']})")
    _report_collisions("collision groups", stats["collisions"], out)
    _report_collisions("ambiguous groups", stats["ambiguous"], out)

    baseline = PINNED_BASELINE.get(generation_id)
    if baseline is None:
        out(f"no reviewed baseline registered for generation {generation_id}; skipping the baseline gate")
        return
    problems = []
    for key, expected in sorted(baseline["stats"].items()):
        if stats[key] != expected:
            problems.append(f"{key}: generated {stats[key]} != reviewed baseline {expected}")
    if legacy_stats["keys"] != baseline["legacyKeys"]:
        problems.append(f"legacyKeys: generated {legacy_stats['keys']} != reviewed baseline {baseline['legacyKeys']}")
    if legacy_stats["collisionGroups"] != baseline["legacyCollisionGroups"]:
        problems.append(
            f"legacyCollisionGroups: generated {legacy_stats['collisionGroups']} != reviewed baseline "
            f"{baseline['legacyCollisionGroups']}"
        )
    for season, expected_handles in sorted(baseline["ambiguousHandles"].items()):
        for source_config_id, expected in sorted(expected_handles.items()):
            actual = recommended.get(source_config_id)
            if actual != expected:
                problems.append(f"ambiguous group {season}: {source_config_id} -> {actual!r} != reviewed {expected!r}")
    if problems:
        raise TeamRouteHandleError(
            "generated handles deviate from the reviewed baseline; refusing to freeze them:\n" + "\n".join(problems)
        )


def _freezes_the_same_assignments(existing: object, candidate: dict) -> bool:
    """Key order and indentation are not assignments: only a changed pin, hash or handle refuses."""
    return (
        isinstance(existing, dict)
        and set(existing) == set(LEDGER_KEYS)
        and all(existing[key] == candidate[key] for key in LEDGER_KEYS)
    )


def write_ledger(*, generation_root, teams_path, khaihoang_path, ledger_path, display_map_path, out=print) -> int:
    publication = read_publication(generation_root)
    teams_bytes, teams = load_teams(teams_path)
    khaihoang_bytes, khaihoang_teams = load_khaihoang(khaihoang_path)
    labels = load_faction_labels(display_map_path)
    recommended, stats = build_recommended_handles(publication.records, labels)
    legacy, legacy_stats = build_legacy_handles(teams)
    khaihoang, khaihoang_stats = build_khaihoang_handles(khaihoang_teams)
    ledger = build_ledger(publication.generation_id, teams_bytes, khaihoang_bytes, recommended, legacy, khaihoang)
    validate_ledger(
        ledger,
        generation_id=publication.generation_id,
        records=publication.records,
        teams_bytes=teams_bytes,
        teams=teams,
        khaihoang_bytes=khaihoang_bytes,
        khaihoang_teams=khaihoang_teams,
    )
    _report_baseline(publication.generation_id, stats, legacy_stats, recommended, out)

    path = Path(ledger_path)
    data = ledger_bytes(ledger)
    if path.exists():
        if path.read_bytes() == data:
            out(f"ledger {path} already matches the generated candidate (no-op)")
            return 0
        if _freezes_the_same_assignments(json.loads(path.read_bytes()), ledger):
            out(f"ledger {path} already freezes the generated assignments (no-op)")
            return 0
        raise TeamRouteHandleError(
            f"refusing to reassign: {path} differs from the generated candidate; a frozen URL must be "
            "reviewed and the ledger replaced deliberately"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_bytes(data)
    os.replace(temporary, path)
    out(
        f"wrote {len(recommended)} recommended + {len(legacy)} legacy + {len(khaihoang)} Khai hoang handles "
        f"({khaihoang_stats['distinctHandles']} distinct Khai hoang slugs) to {path}"
    )
    return 0


def check_ledger(*, generation_root, teams_path, khaihoang_path, ledger_path, display_map_path, diagnose=False, out=print) -> int:
    publication = read_publication(generation_root)
    teams_bytes, teams = load_teams(teams_path)
    khaihoang_bytes, khaihoang_teams = load_khaihoang(khaihoang_path)
    ledger = json.loads(Path(ledger_path).read_bytes())
    validate_ledger(
        ledger,
        generation_id=publication.generation_id,
        records=publication.records,
        teams_bytes=teams_bytes,
        teams=teams,
        khaihoang_bytes=khaihoang_bytes,
        khaihoang_teams=khaihoang_teams,
    )
    out(f"ledger {ledger_path} matches generation {publication.generation_id}")
    out(
        f"recommended handles: {len(ledger['handles']['recommended'])}; legacy handles: "
        f"{len(ledger['handles']['legacy'])}; Khai hoang handles: {len(ledger['handles']['khaihoang'])}"
    )
    if diagnose:
        recommended, stats = build_recommended_handles(publication.records, load_faction_labels(display_map_path))
        differences = sorted(
            source_config_id
            for source_config_id, handle in recommended.items()
            if ledger["handles"]["recommended"].get(source_config_id) != handle
        )
        out(f"name-derived diagnostics: {len(differences)} recommended rows differ from the frozen ledger")
        for source_config_id in differences[:DIAGNOSTIC_LIMIT]:
            out(f"  {source_config_id}: frozen {ledger['handles']['recommended'].get(source_config_id)!r} != name-derived {recommended[source_config_id]!r}")
        out(f"name-derived collision groups: {stats['collisionGroups']}; tagged rows: {stats['taggedRows']}")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m pipeline.team_route_handles", description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="generate the ledger from the selected publication; refuse to reassign an existing ledger")
    mode.add_argument("--check", action="store_true", help="validate the frozen ledger without deriving handles from display names")
    parser.add_argument("--generation-root", type=Path, default=DEFAULT_GENERATION_ROOT, help="Recommended root holding current.json and the generation directory")
    parser.add_argument("--teams", type=Path, default=DEFAULT_TEAMS_PATH, help="legacy teams artifact")
    parser.add_argument("--khaihoang", type=Path, help="Khai hoang artifact; required with custom inputs")
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER_PATH, help="frozen ledger to write or validate")
    parser.add_argument("--display-map", type=Path, default=DEFAULT_DISPLAY_MAP_PATH, help="display map holding labels.faction")
    parser.add_argument("--diagnose", action="store_true", help="with --check: also print name-derived differences without gating on them")
    args = parser.parse_args(argv)
    if args.khaihoang is None:
        if (
            args.generation_root != DEFAULT_GENERATION_ROOT
            or args.teams != DEFAULT_TEAMS_PATH
            or args.ledger != DEFAULT_LEDGER_PATH
            or args.display_map != DEFAULT_DISPLAY_MAP_PATH
        ):
            print("error: custom inputs require an explicit --khaihoang source", file=sys.stderr)
            return 1
        args.khaihoang = DEFAULT_KHAIHOANG_PATH
    try:
        if args.write:
            return write_ledger(
                generation_root=args.generation_root,
                teams_path=args.teams,
                khaihoang_path=args.khaihoang,
                ledger_path=args.ledger,
                display_map_path=args.display_map,
            )
        return check_ledger(
            generation_root=args.generation_root,
            teams_path=args.teams,
            khaihoang_path=args.khaihoang,
            ledger_path=args.ledger,
            display_map_path=args.display_map,
            diagnose=args.diagnose,
        )
    except (TeamRouteHandleError, OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
