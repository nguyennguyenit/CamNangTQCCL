"""Số liệu "Trong cẩm nang" theo tướng, tính lúc build từ generation Recommended đang pin.

Phase 7 (plan.md quyết định #12): spike đo tải ở 390px/Fast 3G/CPU ×4 cho trung vị **2058 ms** > ngân sách
2 s, nên đường tính lúc chạy bị dừng (quyết định uỷ quyền của Kongming P06b). Phương án được duyệt: tính
sẵn một file nhỏ theo tướng, phát qua đúng bộ manifest/hash + header `/data/*` đã có, kèm provenance để
kho Tra cứu (khóa nối) hoặc nguồn Recommended đổi thì không thể còn số liệu cũ.

Khóa nối là **so khớp chính xác theo từng nguồn** (plan.md quyết định #12), không nối ID danh tính:

- Đội chuẩn (`index.json`, `heroes[].nameRaw` chữ Hán) ↔ `chinese`/`aliases[]` của `data/heroes-dict.json`,
  chỉ bỏ khoảng trắng (`SP荀彧` ≡ `SP 荀彧`).
- Đội khác (`other-teams.json`, `holders[].nameRaw` tên Việt) ↔ `hanViet` (bỏ khoảng trắng hai đầu).

Ô không khớp không tính cho tướng nào; một khóa khớp ≥ 2 ID bị loại và ghi cảnh báo ra stderr. Chỉ đếm
`heroes`/`holders` chính (không tính `alternativeHoldersRaw`) — đúng 4098 ô Đội chuẩn và 120 ô Đội khác.
Chiến pháp/binh thư/hướng điểm đếm trên **cả hai họ** (khối ghi rõ "đội chuẩn và đội khác"), mỗi đội một lần;
nguồn phải là chính danh sách bản ghi đã sắp theo thứ tự phát (`index.json`) để thứ tự đồng hạng khớp bản phát.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import defaultdict

SCHEMA_VERSION = 1
TOP_ITEMS = 3
POSITIONS = 3
CATALOG_PREFIX = "hero:"
WHITESPACE = re.compile(r"\s+")


def _stripped(value):
    return WHITESPACE.sub("", value) if isinstance(value, str) else ""


def _trimmed(value):
    return value.strip() if isinstance(value, str) else ""


def build_join_indexes(catalog):
    """Khóa nối từ kho Tra cứu đang phát: chữ Hán (bỏ khoảng trắng) và tên Việt của từng ID tướng."""
    chinese = defaultdict(set)
    vietnamese = defaultdict(set)
    for hero in catalog:
        identifier = hero.get("id")
        if not isinstance(identifier, str) or not identifier.startswith(CATALOG_PREFIX):
            raise ValueError("ID tướng Tra cứu không hợp lệ")
        for value in [hero.get("chinese"), *(hero.get("aliases") or [])]:
            key = _stripped(value)
            if key:
                chinese[key].add(identifier)
        name_vi = _trimmed(hero.get("hanViet"))
        if name_vi:
            vietnamese[name_vi].add(identifier)
    return chinese, vietnamese


def match_identity(index, key):
    """Khớp chính xác: `(id, None)` khi duy nhất, `(None, 'unmatched')`/`(None, 'ambiguous')` khi không."""
    matches = index.get(key)
    if not matches:
        return None, "unmatched"
    if len(matches) > 1:
        return None, "ambiguous"
    return next(iter(matches)), None


class _Tally:
    """Bộ đếm của một tướng: vị trí theo họ, chiến pháp/binh thư/hướng điểm, đội tiêu biểu."""

    def __init__(self, identifier, search_name):
        self.id = identifier
        self.search_name = search_name
        self.positions = {"recommended": [0] * POSITIONS, "other": [0] * POSITIONS}
        self.tactics = defaultdict(int)
        self.books = defaultdict(int)
        self.stat_focus = defaultdict(int)
        self.book_teams = 0
        self.stat_focus_teams = 0
        self.teams = []


def _tactic_slots(holder, name_field):
    """Ô chiến pháp thật: ô có `tacticSlotKinds` là `bond` (duyên phận) không phải chiến pháp — cùng quy tắc
    với `js/recommended-reference-render.js` (tách riêng và gắn nhãn "Duyên phận"). `name_field` là trường
    tên của chính họ đó (Đội chuẩn: bản Việt, Đội khác: bản nguồn) — không trộn hai không gian tên."""
    names = holder.get(name_field) or []
    kinds = holder.get("tacticSlotKinds") or []
    return [name for index, name in enumerate(names) if (kinds[index] if index < len(kinds) else "tactic") == "tactic"]


def _stat_focus(holder, name_field):
    """Hướng điểm thật: `statFocusKind == 'note'` là ghi chú (UI in "Lưu ý:"), không phải hướng điểm."""
    if holder.get("statFocusKind", "stat") != "stat":
        return None
    return holder.get(name_field)


def _count_items(target, values):
    """Đếm mỗi tên một lần cho mỗi đội, giữ thứ tự xuất hiện (thứ tự quyết định khi số đội bằng nhau)."""
    seen = set()
    for value in values or []:
        name = _trimmed(value)
        if name and name not in seen:
            seen.add(name)
            target[name] += 1
    return bool(seen)


def _rank_teams(teams):
    """Điểm giảm dần rồi thứ tự nguồn; Đội chuẩn xếp trước Đội khác khi cùng hạng."""
    family_order = {"recommended": 0, "other": 1}
    return sorted(teams, key=lambda item: (
        item["score"] is None,
        -(item["score"] or 0),
        family_order[item["family"]],
        item["sourceIndex"],
    ))


def _top(items):
    if not items:
        return []
    order = {name: at for at, name in enumerate(items)}
    ranked = sorted(items.items(), key=lambda pair: (-pair[1], order[pair[0]]))
    return [{"name": name, "teams": count} for name, count in ranked[:TOP_ITEMS]]


def build_hero_summaries(*, catalog_bytes, records, other_records):
    """Payload `hero-summaries.json` từ nguồn Recommended đã xác minh và kho Tra cứu đã phát."""
    try:
        catalog = json.loads(bytes(catalog_bytes))
    except (TypeError, ValueError) as error:
        raise ValueError("Kho Tra cứu không đọc được") from error
    if not isinstance(catalog, list) or not catalog:
        raise ValueError("Kho Tra cứu rỗng: không dựng được khóa nối")
    if not isinstance(records, list) or not isinstance(other_records, list):
        raise ValueError("Nguồn Recommended thiếu bản ghi")
    chinese, vietnamese = build_join_indexes(catalog)
    by_id = {hero["id"]: hero for hero in catalog}
    tallies = {}
    ambiguous = {"recommended": 0, "other": 0}
    unmatched = {"recommended": 0, "other": 0}

    def tally(identifier):
        found = tallies.get(identifier)
        if found is None:
            hero = by_id[identifier]
            found = _Tally(identifier, _trimmed(hero.get("viet")) or _trimmed(hero.get("hanViet")))
            tallies[identifier] = found
        return found

    for source_index, record in enumerate(records):
        for position, hero in enumerate((record.get("heroes") or [])[:POSITIONS]):
            identifier, problem = match_identity(chinese, _stripped(hero.get("nameRaw")))
            if problem:
                (unmatched if problem == "unmatched" else ambiguous)["recommended"] += 1
                continue
            item = tally(identifier)
            item.positions["recommended"][position] += 1
            _count_items(item.tactics, _tactic_slots(hero, "tacticSlotsVi"))
            if _count_items(item.books, hero.get("bookSlotsVi")):
                item.book_teams += 1
            if _count_items(item.stat_focus, [_stat_focus(hero, "statFocusVi")]):
                item.stat_focus_teams += 1
            item.teams.append({
                "family": "recommended",
                "name": _trimmed(record.get("displayNameVi")),
                "seasonLabel": _trimmed(record.get("sourceSeasonLabel")),
                "score": record.get("value"),
                "position": position,
                "sourceConfigId": record.get("sourceConfigId"),
                "sourceIndex": source_index,
            })

    for source_index, record in enumerate(other_records):
        for position, holder in enumerate((record.get("holders") or [])[:POSITIONS]):
            identifier, problem = match_identity(vietnamese, _trimmed(holder.get("nameRaw")))
            if problem:
                (unmatched if problem == "unmatched" else ambiguous)["other"] += 1
                continue
            item = tally(identifier)
            item.positions["other"][position] += 1
            # Chiến pháp của Đội khác cũng thuộc phạm vi khối ("đội chuẩn và đội khác"), đếm một lần mỗi đội.
            _count_items(item.tactics, _tactic_slots(holder, "tacticSlotsRaw"))
            if _count_items(item.books, holder.get("bookSlotsRaw")):
                item.book_teams += 1
            if _count_items(item.stat_focus, [_stat_focus(holder, "statFocusRaw")]):
                item.stat_focus_teams += 1
            item.teams.append({
                "family": "other",
                "name": _trimmed(record.get("name")),
                "seasonLabel": "",
                "score": None,
                "position": position,
                "legacyTeamId": record.get("legacyTeamId"),
                "legacyVariantId": record.get("legacyVariantId"),
                "sourceIndex": source_index,
            })

    for family, count in ambiguous.items():
        if count:
            print(f"hero-summaries: bỏ {count} ô khớp nhiều ID ({family})", file=sys.stderr)

    summaries = {}
    for identifier in sorted(tallies):
        item = tallies[identifier]
        summaries[identifier] = {
            "searchName": item.search_name,
            "standard": {"teams": sum(item.positions["recommended"]), "positions": list(item.positions["recommended"])},
            "other": {"teams": sum(item.positions["other"]), "positions": list(item.positions["other"])},
            "tactics": _top(item.tactics),
            "books": {"teams": item.book_teams, "items": _top(item.books)},
            "statFocus": {"teams": item.stat_focus_teams, "items": _top(item.stat_focus)},
            "representative": [
                {key: value for key, value in team.items() if key != "sourceIndex"}
                for team in _rank_teams(item.teams)[:TOP_ITEMS]
            ],
        }
    return {
        "schemaVersion": SCHEMA_VERSION,
        "provenance": {
            "catalogSha256": "sha256:" + hashlib.sha256(bytes(catalog_bytes)).hexdigest(),
            "recommendedJoin": "heroes[].nameRaw ↔ chinese|aliases (bỏ khoảng trắng)",
            "otherJoin": "holders[].nameRaw ↔ hanViet (bỏ khoảng trắng hai đầu)",
            "unmatchedSlots": unmatched,
            "ambiguousSlots": ambiguous,
        },
        "summaries": summaries,
    }


def validate_hero_summaries(payload, *, catalog_bytes, records, other_records):
    """So payload đã dựng với nguồn: mọi field hứa phải khớp phép dựng lại tất định."""
    expected = build_hero_summaries(catalog_bytes=catalog_bytes, records=records, other_records=other_records)
    if payload != expected:
        raise ValueError("hero-summaries khác phép dựng lại tất định")
    validate_hero_summaries_shape(payload, records=records, other_records=other_records)
    return None


def _require(condition, message):
    if not condition:
        raise ValueError(message)


def _shaped_items(value, where, cap):
    _require(isinstance(value, dict) and set(value) == {"teams", "items"}, f"{where} sai cấu trúc")
    _require(isinstance(value["teams"], int) and value["teams"] >= 0, f"{where}.teams không hợp lệ")
    items = value["items"]
    _require(isinstance(items, list) and len(items) <= cap, f"{where}.items vượt trần")
    for item in items:
        _require(isinstance(item, dict) and set(item) == {"name", "teams"}, f"{where}.items sai cấu trúc")
        _require(isinstance(item["name"], str) and item["name"].strip(), f"{where}.items thiếu tên")
        _require(isinstance(item["teams"], int) and 0 < item["teams"] <= value["teams"], f"{where}.items sai số đội")
    return items


def validate_hero_summaries_shape(payload, *, records, other_records):
    """Kiểm cấu trúc + tham chiếu chéo của payload, độc lập với phép dựng (dùng ở cổng publication)."""
    _require(isinstance(payload, dict) and set(payload) == {"schemaVersion", "provenance", "summaries"},
             "hero-summaries sai cấu trúc gốc")
    _require(payload["schemaVersion"] == SCHEMA_VERSION, "hero-summaries sai schemaVersion")
    provenance = payload["provenance"]
    _require(isinstance(provenance, dict)
             and set(provenance) == {"catalogSha256", "recommendedJoin", "otherJoin", "unmatchedSlots", "ambiguousSlots"},
             "hero-summaries sai provenance")
    _require(re.fullmatch(r"sha256:[0-9a-f]{64}", str(provenance["catalogSha256"] or "")), "thiếu hash kho Tra cứu")
    for key in ("unmatchedSlots", "ambiguousSlots"):
        counts = provenance[key]
        _require(isinstance(counts, dict) and set(counts) == {"recommended", "other"}
                 and all(isinstance(value, int) and value >= 0 for value in counts.values()),
                 f"hero-summaries sai {key}")
    recommended_ids = {record.get("sourceConfigId") for record in records}
    legacy_locators = {(record.get("legacyTeamId"), record.get("legacyVariantId")) for record in other_records}
    summaries = payload["summaries"]
    _require(isinstance(summaries, dict), "hero-summaries thiếu bảng theo tướng")
    _require(list(summaries) == sorted(summaries), "hero-summaries không sắp theo ID")
    for identifier, entry in summaries.items():
        _require(isinstance(identifier, str) and identifier.startswith(CATALOG_PREFIX), "ID tướng không hợp lệ")
        _require(isinstance(entry, dict)
                 and set(entry) == {"searchName", "standard", "other", "tactics", "books", "statFocus", "representative"},
                 f"{identifier} sai cấu trúc")
        _require(isinstance(entry["searchName"], str) and entry["searchName"].strip(), f"{identifier} thiếu tên tìm")
        for family in ("standard", "other"):
            block = entry[family]
            _require(isinstance(block, dict) and set(block) == {"teams", "positions"}, f"{identifier}.{family} sai cấu trúc")
            positions = block["positions"]
            _require(isinstance(positions, list) and len(positions) == POSITIONS
                     and all(isinstance(value, int) and value >= 0 for value in positions),
                     f"{identifier}.{family} sai vị trí")
            _require(isinstance(block["teams"], int) and block["teams"] == sum(positions), f"{identifier}.{family} lệch tổng")
        _require(entry["standard"]["teams"] + entry["other"]["teams"] > 0, f"{identifier} không có đội nào")
        tactics = entry["tactics"]
        _require(isinstance(tactics, list) and len(tactics) <= TOP_ITEMS, f"{identifier}.tactics vượt trần")
        for item in tactics:
            _require(isinstance(item, dict) and set(item) == {"name", "teams"}
                     and isinstance(item["name"], str) and item["name"].strip()
                     and isinstance(item["teams"], int) and item["teams"] >= 1, f"{identifier}.tactics sai mục")
        _shaped_items(entry["books"], f"{identifier}.books", TOP_ITEMS)
        _shaped_items(entry["statFocus"], f"{identifier}.statFocus", TOP_ITEMS)
        teams = entry["representative"]
        _require(isinstance(teams, list) and 0 < len(teams) <= TOP_ITEMS, f"{identifier}.representative sai số đội")
        for team in teams:
            _require(isinstance(team, dict) and isinstance(team.get("position"), int)
                     and 0 <= team["position"] < POSITIONS
                     and isinstance(team.get("name"), str) and team["name"].strip()
                     and isinstance(team.get("seasonLabel"), str)
                     and (team.get("score") is None or isinstance(team.get("score"), (int, float))),
                     f"{identifier}.representative sai mục")
            if team.get("family") == "recommended":
                _require(set(team) == {"family", "name", "seasonLabel", "score", "position", "sourceConfigId"}
                         and team["sourceConfigId"] in recommended_ids,
                         f"{identifier}.representative trỏ ngoài nguồn Đội chuẩn")
            elif team.get("family") == "other":
                _require(set(team) == {"family", "name", "seasonLabel", "score", "position", "legacyTeamId", "legacyVariantId"}
                         and (team["legacyTeamId"], team["legacyVariantId"]) in legacy_locators,
                         f"{identifier}.representative trỏ ngoài nguồn Đội khác")
            else:
                raise ValueError(f"{identifier}.representative sai họ đội")
    for index in (records, other_records):
        for record in index:
            _require(isinstance(record, dict), "nguồn Recommended sai bản ghi")
    return None
