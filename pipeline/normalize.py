"""Chuẩn hóa team thô (team-intro) -> model Team cuối.

Gồm: apply alias (sửa typo), tách biến thể "/" + tiền tố Tinh·/Thác·,
parse tướng (SP/CO/variant), split counter Chạm/Tránh + tách rating-điều-kiện,
classify (unitType/stars/faction/status).

Chỉ Python stdlib.
"""

from __future__ import annotations

import json
import os
import re
from typing import List, Optional, Tuple

_ALIASES_PATH = os.path.join(os.path.dirname(__file__), "aliases.json")
_NICKNAMES_PATH = os.path.join(os.path.dirname(__file__), "team-nicknames.json")

# Whitelist phe — tránh nhiễu "Tam Thế"/"Bạch Mã" bị nhận nhầm là phe.
_FACTIONS = ("Ngụy", "Thục", "Ngô", "Quần")
_UNIT_TYPES = ("Kỵ", "Cung", "Thương", "Khiên")
# Trận pháp cho phép trộn phe -> team gắn phe "Hỗn hợp" (ưu tiên hơn banner).
_MIX_FACTION = "Hỗn hợp"
_MIX_FORMATIONS = ("Tam Thế Trận", "Tiềm Long Trận")
_BOOK_PREFIX_RE = re.compile(r"^(?:Tinh|Thác)·\s*")
# Rating điều kiện trong cột Thêm, vd "Có Gian Hùng, Viễn Trợ-★★★★★".
_COND_RATING_RE = re.compile(r"Có[^★]*-?[★☆]{2,}")
_COUNTER_SPLIT_RE = re.compile(r"(Chạm|Tránh)\s*:")
_STAR_RE = re.compile(r"[★☆]+")


def load_aliases(path: str = _ALIASES_PATH) -> dict:
    if not os.path.exists(path):
        return {"tactics": {}, "books": {}, "heroes": {}}
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    for key in ("tactics", "books", "heroes"):
        data.setdefault(key, {})
    return data


def apply_alias(name: str, table: dict) -> str:
    return table.get(name.strip(), name.strip())


def _nickname_key(base_names: List[str]) -> str:
    """Key định danh team theo bộ tướng (không phụ thuộc thứ tự)."""
    return "|".join(sorted(n.strip() for n in base_names if n.strip()))


def load_nicknames(path: str = _NICKNAMES_PATH) -> dict:
    """Map thủ công bộ-3-tướng -> tên gọi khác. Key chuẩn hóa theo _nickname_key.

    File rỗng/không tồn tại -> {}. Chỉ một số team có nickname.
    LƯU Ý: key trong file phải dùng tên tướng CHUẨN (sau alias), vì lookup so khớp
    với baseName đã rewrite alias — nếu thêm alias cho tướng trong key, nickname sẽ
    lặng lẽ không match.
    """
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return {_nickname_key(k.split("|")): v.strip() for k, v in data.items() if v and v.strip()}


def auto_team_name(base_names: List[str]) -> str:
    """Ghép âm tiết cuối mỗi tên tướng. Vd Cam Ninh + Thái Sử Từ + Chu Thái -> "Ninh Từ Thái"."""
    return " ".join(n.strip().split()[-1] for n in base_names if n.strip())


def split_variants(cell: str, alias_table: Optional[dict] = None, strip_book_prefix: bool = False) -> Optional[dict]:
    """Tách "A/B/C" -> {name, alternatives}. Bỏ tiền tố Tinh·/Thác· nếu là binh thư.

    Trả None nếu rỗng.
    """
    cell = (cell or "").strip()
    if not cell:
        return None
    parts = [p.strip() for p in cell.split("/") if p.strip()]
    cleaned = []
    for p in parts:
        if strip_book_prefix:
            p = _BOOK_PREFIX_RE.sub("", p).strip()
        if alias_table is not None:
            p = apply_alias(p, alias_table)
        cleaned.append(p)
    if not cleaned:
        return None
    return {"name": cleaned[0], "alternatives": cleaned[1:]}


def parse_hero(name_raw: str) -> dict:
    """Tách tên tướng -> baseName, alternatives ("/"), variant (ngoặc), cờ SP/CO, note."""
    raw = (name_raw or "").strip()
    is_sp = raw.startswith("SP ")
    is_co = raw.startswith("CO ")
    work = raw
    if is_sp or is_co:
        work = work[3:].strip()
    variant = None
    m = re.search(r"\(([^)]*)\)", work)
    if m:
        variant = m.group(1).strip()
        work = (work[: m.start()] + work[m.end():]).strip()
    # Hero slot nhiều lựa chọn "A/B" -> baseName + alternatives (để filter khớp từng tên).
    alt_parts = [p.strip() for p in work.split("/") if p.strip()]
    base = alt_parts[0] if alt_parts else work
    alternatives = alt_parts[1:]
    return {
        "name": raw,
        "baseName": base,
        "alternatives": alternatives,
        "variant": variant,
        "isSP": is_sp,
        "isCO": is_co,
    }


def split_counters(notes_raw: str) -> Tuple[List[str], List[str], Optional[str]]:
    """Tách cột Thêm -> (good, avoid, notes).

    1. Bóc rating-điều-kiện "Có ...-★★★★★" ra notes TRƯỚC.
    2. Split phần còn lại theo "(Chạm|Tránh):" rồi tách theo dấu phẩy.
    """
    text = (notes_raw or "").strip()
    if not text:
        return [], [], None

    extra_notes = []

    def _grab(m):
        extra_notes.append(m.group(0).strip())
        return " "

    rest = _COND_RATING_RE.sub(_grab, text).strip()

    good: List[str] = []
    avoid: List[str] = []
    # re.split với group bắt -> [prefix, tag1, seg1, tag2, seg2, ...]
    parts = _COUNTER_SPLIT_RE.split(rest)
    leading = parts[0].strip()
    if leading:
        extra_notes.insert(0, leading)
    i = 1
    while i < len(parts) - 1:
        tag = parts[i]
        seg = parts[i + 1]
        items = [s.strip() for s in seg.split(",") if s.strip()]
        if tag == "Chạm":
            good.extend(items)
        else:
            avoid.extend(items)
        i += 2

    notes = " ".join(n for n in extra_notes if n) or None
    return good, avoid, notes


def classify(raw_type: str, status_hint: Optional[str] = None, banner_faction: Optional[str] = None) -> dict:
    """Suy unitType[], stars, faction (whitelist), status từ rawType.

    banner_faction: phe lấy từ hàng banner (Meta mỗi phe) — ưu tiên hơn rawType.
    """
    rt = (raw_type or "").strip()

    unit_type = [u for u in _UNIT_TYPES if u in rt]

    stars = None
    sm = _STAR_RE.search(rt)
    if sm:
        s = sm.group(0)
        stars = s.count("★") + 0.5 * s.count("☆")

    faction = banner_faction or next((f for f in _FACTIONS if f in rt), None)

    status = "meta"
    if status_hint:
        status = status_hint
    low = rt.lower()
    if "youtuber" in low or rt.strip().endswith("T?"):
        status = "youtuber-untested"

    return {
        "rawType": rt,
        "unitType": unit_type,
        "stars": stars,
        "faction": faction,
        "status": status,
    }


def _has_mix_formation(heroes: list) -> bool:
    """True nếu bất kỳ chiến pháp (gồm biến thể) là trận trộn phe."""
    for h in heroes:
        for g in h.get("tactics", []):
            names = [g["name"], *g.get("alternatives", [])]
            if any(n in _MIX_FORMATIONS for n in names):
                return True
    return False


def normalize_team(raw: dict, alias_table: dict, index: int, nicknames: Optional[dict] = None) -> dict:
    """Team thô -> Team model cuối."""
    meta = classify(raw.get("rawType", ""), raw.get("statusHint"), raw.get("bannerFaction"))
    good, avoid, counter_notes = split_counters(raw.get("notesRaw", ""))

    heroes = []
    for h in raw.get("heroesRaw", []):
        info = parse_hero(h["nameRaw"])
        info["alternatives"] = [apply_alias(a, alias_table["heroes"]) for a in info["alternatives"]]
        tactics = []
        for cp in (h.get("cp1Raw"), h.get("cp2Raw")):
            v = split_variants(cp, alias_table["tactics"])
            if v:
                tactics.append(v)
        books = []
        for b in h.get("booksRaw", []):
            v = split_variants(b, alias_table["books"], strip_book_prefix=True)
            if v:
                books.append(v)
        info["baseName"] = apply_alias(info["baseName"], alias_table["heroes"])
        info["tactics"] = tactics
        info["books"] = books
        info["note"] = None
        heroes.append(info)

    # Team dùng trận trộn phe -> "Hỗn hợp" (ưu tiên hơn phe banner).
    faction = meta["faction"]
    if _has_mix_formation(heroes):
        faction = _MIX_FACTION

    base_names = [h["baseName"] for h in heroes]
    nickname = (nicknames or {}).get(_nickname_key(base_names))

    return {
        "id": f"{raw['source']}-{index}",
        "source": raw["source"],
        "name": auto_team_name(base_names),
        "nickname": nickname,
        "rawType": meta["rawType"],
        "unitType": meta["unitType"],
        "faction": faction,
        "stars": meta["stars"],
        "status": meta["status"],
        "heroes": heroes,
        "counters": {"good": good, "avoid": avoid},
        "notes": counter_notes,
    }
