"""Số liệu "Trong cẩm nang" theo chiến pháp, tính lúc build từ generation Recommended đang pin.

Cùng lý do với `pipeline/hero_summaries.py` (tính lúc chạy vượt ngân sách tải): tính sẵn một file nhỏ theo
chiến pháp, phát qua đúng bộ manifest/hash, kèm provenance hash của hai kho Tra cứu làm khóa nối.

Khóa nối là **so khớp chính xác theo từng nguồn**, không nối ID danh tính:

- Đội chuẩn (`index.json`, `heroes[].tacticSlotsRaw` chữ Hán) ↔ `chinese`/`aliases[]` của `data/tactics.json`,
  chỉ bỏ khoảng trắng.
- Đội khác (`other-teams.json`, `holders[].tacticSlotsRaw` tên Việt) ↔ `viet`/`hanViet` (bỏ khoảng trắng hai đầu).
- Tướng mang chiến pháp nối như `hero_summaries` (chữ Hán ↔ `heroes-dict`, tên Việt ↔ `hanViet`); ô tướng không
  khớp vẫn đếm cho chiến pháp nhưng không có tướng mang.

Chỉ đếm ô chiến pháp thật (bỏ ô duyên phận) của `heroes`/`holders` chính. Mỗi đội đếm một chiến pháp một lần,
ở vị trí đầu tiên mang nó. Số liệu trả **ID** (tướng, chiến pháp) để trang tự lấy tên theo ngôn ngữ từ kho Tra cứu.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict

from pipeline.hero_summaries import (
    POSITIONS,
    _rank_teams,
    _stripped,
    _tactic_slots,
    _trimmed,
    build_join_indexes,
    match_identity,
)

SCHEMA_VERSION = 1
TOP_CARRIERS = 4
TOP_COMPANIONS = 3
TOP_TEAMS = 3
TACTIC_PREFIX = "tactic:"
HERO_PREFIX = "hero:"


def _catalog(catalog_bytes, label):
    try:
        catalog = json.loads(bytes(catalog_bytes))
    except (TypeError, ValueError) as error:
        raise ValueError(f"Kho {label} không đọc được") from error
    if not isinstance(catalog, list) or not catalog:
        raise ValueError(f"Kho {label} rỗng: không dựng được khóa nối")
    return catalog


def build_tactic_join_indexes(catalog):
    """Khóa nối chiến pháp: chữ Hán (bỏ khoảng trắng) và tên Việt (`viet`, `hanViet`) của từng ID."""
    chinese = defaultdict(set)
    vietnamese = defaultdict(set)
    for tactic in catalog:
        identifier = tactic.get("id")
        if not isinstance(identifier, str) or not identifier.startswith(TACTIC_PREFIX):
            raise ValueError("ID chiến pháp Tra cứu không hợp lệ")
        for value in [tactic.get("chinese"), *(tactic.get("aliases") or [])]:
            key = _stripped(value)
            if key:
                chinese[key].add(identifier)
        for value in (tactic.get("viet"), tactic.get("hanViet")):
            key = _trimmed(value)
            if key:
                vietnamese[key].add(identifier)
    return chinese, vietnamese


class _Tally:
    """Bộ đếm của một chiến pháp: vị trí theo họ, tướng mang, chiến pháp đi cùng, đội tiêu biểu."""

    def __init__(self):
        self.positions = {"recommended": [0] * POSITIONS, "other": [0] * POSITIONS}
        self.carriers = defaultdict(int)
        self.companions = defaultdict(int)
        self.teams = []


def _top(counts, key, cap):
    """Số đội giảm dần, đồng hạng giữ thứ tự xuất hiện đầu tiên."""
    order = {identifier: at for at, identifier in enumerate(counts)}
    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], order[pair[0]]))
    return [{key: identifier, "teams": count} for identifier, count in ranked[:cap]]


def build_tactic_summaries(*, tactic_catalog_bytes, hero_catalog_bytes, records, other_records):
    """Payload `tactic-summaries.json` từ nguồn Recommended đã xác minh và hai kho Tra cứu đã phát."""
    tactics = _catalog(tactic_catalog_bytes, "chiến pháp")
    heroes = _catalog(hero_catalog_bytes, "tướng")
    if not isinstance(records, list) or not isinstance(other_records, list):
        raise ValueError("Nguồn Recommended thiếu bản ghi")
    tactic_zh, tactic_vi = build_tactic_join_indexes(tactics)
    hero_zh, hero_vi = build_join_indexes(heroes)
    tallies = defaultdict(_Tally)
    unmatched = {"recommended": 0, "other": 0}
    ambiguous = {"recommended": 0, "other": 0}

    def scan(family, members, tactic_index, hero_index, slot_field):
        """Chiến pháp của một đội: `{id: (vị trí, id tướng|None)}` theo thứ tự xuất hiện, mỗi ID một lần."""
        found = {}
        for position, member in enumerate(members[:POSITIONS]):
            hero_id, _ = match_identity(hero_index, _stripped(member.get("nameRaw")) if family == "recommended" else _trimmed(member.get("nameRaw")))
            for name in _tactic_slots(member, slot_field):
                key = _stripped(name) if family == "recommended" else _trimmed(name)
                identifier, problem = match_identity(tactic_index, key)
                if problem:
                    (unmatched if problem == "unmatched" else ambiguous)[family] += 1
                    continue
                found.setdefault(identifier, (position, hero_id))
        return found

    def count(found, team):
        for identifier, (position, hero_id) in found.items():
            item = tallies[identifier]
            item.positions[team["family"]][position] += 1
            if hero_id:
                item.carriers[hero_id] += 1
            for other in found:
                if other != identifier:
                    item.companions[other] += 1
            item.teams.append({**team, "position": position, "heroId": hero_id})

    for source_index, record in enumerate(records):
        found = scan("recommended", record.get("heroes") or [], tactic_zh, hero_zh, "tacticSlotsRaw")
        count(found, {
            "family": "recommended",
            "name": _trimmed(record.get("displayNameVi")),
            "seasonLabel": _trimmed(record.get("sourceSeasonLabel")),
            "score": record.get("value"),
            "sourceConfigId": record.get("sourceConfigId"),
            "sourceIndex": source_index,
        })

    for source_index, record in enumerate(other_records):
        found = scan("other", record.get("holders") or [], tactic_vi, hero_vi, "tacticSlotsRaw")
        count(found, {
            "family": "other",
            "name": _trimmed(record.get("name")),
            "seasonLabel": "",
            "score": None,
            "legacyTeamId": record.get("legacyTeamId"),
            "legacyVariantId": record.get("legacyVariantId"),
            "sourceIndex": source_index,
        })

    for family, value in ambiguous.items():
        if value:
            print(f"tactic-summaries: bỏ {value} ô khớp nhiều ID ({family})", file=sys.stderr)

    summaries = {}
    for identifier in sorted(tallies):
        item = tallies[identifier]
        summaries[identifier] = {
            "standard": {"teams": sum(item.positions["recommended"]), "positions": list(item.positions["recommended"])},
            "other": {"teams": sum(item.positions["other"]), "positions": list(item.positions["other"])},
            "carriers": _top(item.carriers, "heroId", TOP_CARRIERS),
            "companions": _top(item.companions, "tacticId", TOP_COMPANIONS),
            "representative": [
                {key: value for key, value in team.items() if key != "sourceIndex"}
                for team in _rank_teams(item.teams)[:TOP_TEAMS]
            ],
        }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "provenance": {
            "tacticCatalogSha256": "sha256:" + hashlib.sha256(bytes(tactic_catalog_bytes)).hexdigest(),
            "heroCatalogSha256": "sha256:" + hashlib.sha256(bytes(hero_catalog_bytes)).hexdigest(),
            "recommendedJoin": "heroes[].tacticSlotsRaw ↔ chinese|aliases (bỏ khoảng trắng)",
            "otherJoin": "holders[].tacticSlotsRaw ↔ viet|hanViet (bỏ khoảng trắng hai đầu)",
            "unmatchedSlots": unmatched,
            "ambiguousSlots": ambiguous,
        },
        "summaries": summaries,
    }


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _counts(value, where):
    _require(isinstance(value, dict) and set(value) == {"recommended", "other"}
             and all(isinstance(number, int) and number >= 0 for number in value.values()), f"tactic-summaries sai {where}")


def _ranked(items, key, prefix, cap, total, where):
    _require(isinstance(items, list) and len(items) <= cap, f"{where} vượt trần")
    for item in items:
        _require(isinstance(item, dict) and set(item) == {key, "teams"}
                 and isinstance(item[key], str) and item[key].startswith(prefix)
                 and isinstance(item["teams"], int) and 0 < item["teams"] <= total, f"{where} sai mục")


def validate_tactic_summaries_shape(payload, *, records, other_records):
    """Kiểm cấu trúc + tham chiếu chéo của payload, độc lập với phép dựng (dùng ở cổng publication)."""
    _require(isinstance(payload, dict) and set(payload) == {"schemaVersion", "provenance", "summaries"},
             "tactic-summaries sai cấu trúc gốc")
    _require(payload["schemaVersion"] == SCHEMA_VERSION, "tactic-summaries sai schemaVersion")
    provenance = payload["provenance"]
    _require(isinstance(provenance, dict) and set(provenance) == {
        "tacticCatalogSha256", "heroCatalogSha256", "recommendedJoin", "otherJoin", "unmatchedSlots", "ambiguousSlots",
    }, "tactic-summaries sai provenance")
    for key in ("tacticCatalogSha256", "heroCatalogSha256"):
        _require(re.fullmatch(r"sha256:[0-9a-f]{64}", str(provenance[key] or "")), f"thiếu {key}")
    _counts(provenance["unmatchedSlots"], "unmatchedSlots")
    _counts(provenance["ambiguousSlots"], "ambiguousSlots")
    recommended_ids = {record.get("sourceConfigId") for record in records}
    legacy_locators = {(record.get("legacyTeamId"), record.get("legacyVariantId")) for record in other_records}
    summaries = payload["summaries"]
    _require(isinstance(summaries, dict) and list(summaries) == sorted(summaries), "tactic-summaries không sắp theo ID")
    for identifier, entry in summaries.items():
        _require(identifier.startswith(TACTIC_PREFIX), "ID chiến pháp không hợp lệ")
        _require(isinstance(entry, dict)
                 and set(entry) == {"standard", "other", "carriers", "companions", "representative"},
                 f"{identifier} sai cấu trúc")
        for family in ("standard", "other"):
            block = entry[family]
            _require(isinstance(block, dict) and set(block) == {"teams", "positions"}, f"{identifier}.{family} sai cấu trúc")
            positions = block["positions"]
            _require(isinstance(positions, list) and len(positions) == POSITIONS
                     and all(isinstance(value, int) and value >= 0 for value in positions), f"{identifier}.{family} sai vị trí")
            _require(block["teams"] == sum(positions), f"{identifier}.{family} lệch tổng")
        total = entry["standard"]["teams"] + entry["other"]["teams"]
        _require(total > 0, f"{identifier} không có đội nào")
        _ranked(entry["carriers"], "heroId", HERO_PREFIX, TOP_CARRIERS, total, f"{identifier}.carriers")
        _ranked(entry["companions"], "tacticId", TACTIC_PREFIX, TOP_COMPANIONS, total, f"{identifier}.companions")
        _require(all(item["tacticId"] != identifier for item in entry["companions"]), f"{identifier} tự đi cùng chính nó")
        teams = entry["representative"]
        _require(isinstance(teams, list) and 0 < len(teams) <= TOP_TEAMS, f"{identifier}.representative sai số đội")
        for team in teams:
            _require(isinstance(team, dict) and isinstance(team.get("position"), int)
                     and 0 <= team["position"] < POSITIONS
                     and isinstance(team.get("name"), str) and team["name"].strip()
                     and isinstance(team.get("seasonLabel"), str)
                     and (team.get("heroId") is None or (isinstance(team["heroId"], str) and team["heroId"].startswith(HERO_PREFIX)))
                     and (team.get("score") is None or isinstance(team.get("score"), (int, float))),
                     f"{identifier}.representative sai mục")
            if team.get("family") == "recommended":
                _require(set(team) == {"family", "name", "seasonLabel", "score", "position", "heroId", "sourceConfigId"}
                         and team["sourceConfigId"] in recommended_ids, f"{identifier}.representative trỏ ngoài nguồn Đội chuẩn")
            elif team.get("family") == "other":
                _require(set(team) == {"family", "name", "seasonLabel", "score", "position", "heroId", "legacyTeamId", "legacyVariantId"}
                         and (team["legacyTeamId"], team["legacyVariantId"]) in legacy_locators,
                         f"{identifier}.representative trỏ ngoài nguồn Đội khác")
            else:
                raise ValueError(f"{identifier}.representative sai họ đội")
    return None


def validate_tactic_summaries(payload, *, tactic_catalog_bytes, hero_catalog_bytes, records, other_records):
    """So payload đã dựng với nguồn: mọi field hứa phải khớp phép dựng lại tất định."""
    expected = build_tactic_summaries(
        tactic_catalog_bytes=tactic_catalog_bytes, hero_catalog_bytes=hero_catalog_bytes,
        records=records, other_records=other_records,
    )
    if payload != expected:
        raise ValueError("tactic-summaries khác phép dựng lại tất định")
    validate_tactic_summaries_shape(payload, records=records, other_records=other_records)
    return None
