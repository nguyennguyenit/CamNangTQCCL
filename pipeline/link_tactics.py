"""Auto-link tên Hán-Việt (crawl) -> tên Việt site đang dùng (facets).

normalize (NFD + đ->d, bỏ dấu/space/hoa) khớp với facets.tactics / facets.heroes:
exact trước, fuzzy (difflib) ngưỡng >=0.8. Phần không khớp -> giữ hán-việt làm
viet, ghi report để review thủ công (đa âm/variant -> aliases.json).

Chỉ Python stdlib. Hàm thuần (test không gọi mạng).
"""

from __future__ import annotations

import difflib
import unicodedata
from typing import List, Optional, Tuple

FUZZY_THRESHOLD = 0.8


def normalize(text: str) -> str:
    """NFD + bỏ dấu + đ->d + lowercase + bỏ ký tự không chữ-số. Khớp logic filters.js."""
    s = (text or "").strip().lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # bỏ dấu thanh
    return "".join(c for c in s if c.isalnum())


def build_index(values: List[str]) -> dict:
    """[tên Việt] -> {normalized: tên gốc} (ưu tiên tên xuất hiện trước nếu trùng norm)."""
    idx = {}
    for v in values:
        idx.setdefault(normalize(v), v)
    return idx


def auto_link(viet: str, index: dict) -> Tuple[Optional[str], float]:
    """Khớp tên hán-việt vào index tên site. Trả (tên_site, score). Không khớp -> (None, 0)."""
    key = normalize(viet)
    if not key:
        return None, 0.0
    if key in index:
        return index[key], 1.0
    best = difflib.get_close_matches(key, index.keys(), n=1, cutoff=FUZZY_THRESHOLD)
    if best:
        score = difflib.SequenceMatcher(None, key, best[0]).ratio()
        return index[best[0]], score
    return None, 0.0


def link_records(records: List[dict], facet_values: List[str], name_field: str = "hanViet") -> dict:
    """Auto-link list record -> report {matched, fuzzy, nomatch}. Gắn record['viet'] + record['linkScore']."""
    index = build_index(facet_values)
    report = {"matched": [], "fuzzy": [], "nomatch": []}
    for rec in records:
        site_name, score = auto_link(rec[name_field], index)
        if score >= 1.0:
            rec["viet"] = site_name
            rec["linkScore"] = 1.0
            report["matched"].append((rec["chinese"], site_name))
        elif site_name is not None:
            # Fuzzy: gợi ý nhưng giữ hán-việt làm viet (review thủ công mới chốt).
            rec["viet"] = rec[name_field]
            rec["linkScore"] = round(score, 3)
            report["fuzzy"].append((rec["chinese"], rec[name_field], site_name, round(score, 3)))
        else:
            rec["viet"] = rec[name_field]
            rec["linkScore"] = 0.0
            report["nomatch"].append((rec["chinese"], rec[name_field]))
    return report
