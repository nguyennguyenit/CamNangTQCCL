"""Build từ điển binh thư: bảng map thủ công -> data/books-dict.json.

Khác tướng/chiến pháp: binh thư game VN dùng tên DỊCH NGHĨA (vd 铁甲->"Giáp Sắt",
统军->"Dẫn Quân"), KHÔNG phải Hán-Việt, nên KHÔNG auto-link. Map bằng bảng thủ
công `books-han-viet-map.json`, validate `viet` ∈ facets.json.books; dòng dạng
`{"viet": ..., "outsideTeams": true}` là sách có trong game nhưng không đội nào
dùng (được bỏ qua kiểm facet, và phải KHÔNG có trong facet).

`hanViet` chỉ là field tham khảo hiển thị: sinh best-effort qua hanviet.to_viet,
BỎ field nếu tên có ký tự ngoài bảng (tôn trọng "không ship phiên âm thiếu").

Dùng:
    python3 -m pipeline.build_books_dict
"""

from __future__ import annotations

import json
import os

from . import hanviet

_DIR = os.path.dirname(__file__)
_DATA = os.path.join(_DIR, "..", "data")
_FACETS = os.path.join(_DATA, "facets.json")
_MAP = os.path.join(_DIR, "books-han-viet-map.json")
_OUT = os.path.join(_DATA, "books-dict.json")


def build_books_dict(han_viet_map: dict, facet_books: list) -> list:
    """Bảng {chinese: viet | {viet, outsideTeams}} -> list record {chinese, [hanViet], viet}, sort theo viet.

    - viet thường PHẢI ∈ facet_books, nếu không -> ValueError (fail-loud chống map lệch).
    - viet có cờ outsideTeams PHẢI ∉ facet_books (cờ cũ -> ValueError để gỡ cờ).
    - hanViet: best-effort; bỏ nếu thiếu ký tự.
    """
    facet_set = set(facet_books)
    records = []
    for chinese, entry in han_viet_map.items():
        outside = isinstance(entry, dict) and entry.get("outsideTeams") is True
        viet = entry["viet"] if isinstance(entry, dict) else entry
        if outside and viet in facet_set:
            raise ValueError(f"[fail-loud] viet '{viet}' (Hán '{chinese}') đã có trong facets.json.books, gỡ cờ outsideTeams")
        if not outside and viet not in facet_set:
            raise ValueError(f"[fail-loud] viet '{viet}' (Hán '{chinese}') không thuộc facets.json.books")
        rec = {"chinese": chinese, "viet": viet}
        missing: set = set()
        hv = hanviet.to_viet(chinese, missing)
        if not missing:  # chỉ giữ phiên âm sạch
            rec["hanViet"] = hv
        records.append(rec)
    records.sort(key=lambda r: r["viet"])
    return records


def _load_map() -> dict:
    with open(_MAP, encoding="utf-8") as fh:
        return json.load(fh)["books"]


def build() -> list:
    with open(_FACETS, encoding="utf-8") as fh:
        facet_books = [b["value"] for b in json.load(fh)["books"]]
    records = build_books_dict(_load_map(), facet_books)
    with open(_OUT, "w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"books-dict: {len(records)} mục -> {_OUT}")
    facet_set = set(facet_books)
    in_facet = sum(1 for r in records if r["viet"] in facet_set)
    print(f"  (facet có {len(facet_books)} binh thư; còn {len(facet_books) - in_facet} chưa map)")
    return records


if __name__ == "__main__":
    build()
