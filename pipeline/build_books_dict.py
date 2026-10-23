"""Build từ điển binh thư: bảng map thủ công -> data/books-dict.json.

Khác tướng/chiến pháp: binh thư game VN dùng tên DỊCH NGHĨA (vd 铁甲->"Giáp Sắt",
统军->"Dẫn Quân"), KHÔNG phải Hán-Việt, nên KHÔNG auto-link. Map bằng bảng thủ
công `books-han-viet-map.json`, validate `viet` ∈ facets.json.books; dòng có cờ
`outsideTeams: true` là sách có trong game nhưng không đội nào dùng (được bỏ qua
kiểm facet, và phải KHÔNG có trong facet).

Dòng dạng object có thể mang hiệu ứng: `effect` (chữ Hán nguồn), `effectViet`
(bản dịch đã duyệt) và `effectVersion` (mốc số liệu nguồn) — đủ cả ba hoặc
không có trường nào, để hồ sơ bản Việt và bản zh không lệch nhau. `effectVietVersion` (tùy chọn,
chỉ đi kèm bộ ba trên) là mốc của riêng chữ Việt khi `effectViet` chép từ client Global thay vì
dịch từ `effect`: bản Việt hiện mốc này, bản zh vẫn hiện `effectVersion` của chữ Hán nguồn.

`sourceNames`: tên Hán nguồn (phồn thể, biến thể chữ) của chính binh thư đó, để
trang đội khớp ô nguồn với hồ sơ bằng tên Hán thay vì bằng bản dịch.
`excludedSourceNames`: tên nguồn của binh thư KHÁC từng bị dịch nhầm sang tên Việt
này (vd 以退為進 ≠ 以直報怨); không được trùng tên nguồn của binh thư nào.

`id`: mã hồ sơ cố định `book:<slug>` của binh thư, viết tay trong map và đi cùng mục (không khóa theo `chinese`
hay `viet`, nên sửa tên Hán hoặc đổi tên Việt không đổi id). Generator chỉ CHÉP id sang dòng, không bao giờ
slug lại tên. Mục thiếu id, id sai dạng, id trùng, hoặc id mới trùng một id đã retire trong ledger
`pipeline/lookup-route-handles.json` -> ValueError. Đổi tên Việt: sửa `viet`, đưa tên cũ vào `aliases` (tên cũ
còn trong facets.json.books vẫn qua được kiểm facet vì facets dựng từ HTML đội dùng tên cũ).

`hanViet` chỉ là field tham khảo hiển thị: sinh best-effort qua hanviet.to_viet,
BỎ field nếu tên có ký tự ngoài bảng (tôn trọng "không ship phiên âm thiếu").

Dùng:
    python3 -m pipeline.build_books_dict
"""

from __future__ import annotations

import json
import os
import re

from . import hanviet

_DIR = os.path.dirname(__file__)
_DATA = os.path.join(_DIR, "..", "data")
_FACETS = os.path.join(_DATA, "facets.json")
_MAP = os.path.join(_DIR, "books-han-viet-map.json")
_OUT = os.path.join(_DATA, "books-dict.json")
_LEDGER = os.path.join(_DIR, "lookup-route-handles.json")

_BOOK_ID = re.compile(r"book:[a-z0-9]+(?:-[a-z0-9]+)*")


_EFFECT_KEYS = ("effect", "effectViet", "effectVersion")

_NAME_LISTS = ("sourceNames", "excludedSourceNames", "aliases")


def _names(row: dict, key: str, where: str) -> list:
    value = row.get(key, [])
    if not isinstance(value, list) or any(not isinstance(name, str) or not name.strip() for name in value):
        raise ValueError(f"[fail-loud] {key} của {where} phải là danh sách tên khác rỗng")
    return sorted({name.strip() for name in value})


def _frozen_id(row: dict, where: str) -> str:
    value = row.get("id")
    if not isinstance(value, str) or not _BOOK_ID.fullmatch(value):
        raise ValueError(f"[fail-loud] binh thư {where} cần `id` dạng book:<slug> viết tay (^book:[a-z0-9]+(?:-[a-z0-9]+)*$), nhận {value!r}")
    return value


def build_books_dict(han_viet_map: dict, facet_books: list, ledger: dict | None = None) -> list:
    """Bảng {chinese: {id, viet, [outsideTeams], [aliases], [sourceNames...], [effect...]}} -> list record, sort theo viet.

    - id PHẢI có, đúng dạng, không trùng; id mới (ngoài ledger handles.books) không được trùng retired.books.
    - viet (hoặc một tên trong aliases) thường PHẢI ∈ facet_books, nếu không -> ValueError (fail-loud chống map lệch).
    - viet có cờ outsideTeams PHẢI ∉ facet_books (cờ cũ -> ValueError để gỡ cờ).
    - hiệu ứng: đủ effect/effectViet/effectVersion hoặc không có, thiếu một phần -> ValueError.
    - excludedSourceNames không được là tên (chinese/sourceNames) của binh thư nào -> ValueError.
    - hanViet: best-effort; bỏ nếu thiếu ký tự.
    """
    facet_set = set(facet_books)
    live = set(((ledger or {}).get("handles") or {}).get("books") or {})
    retired = set(((ledger or {}).get("retired") or {}).get("books") or {})
    records = []
    seen_ids: dict = {}
    for chinese, entry in han_viet_map.items():
        if not isinstance(entry, dict):
            raise ValueError(f"[fail-loud] binh thư Hán '{chinese}' phải là object có `id` và `viet`, không phải chuỗi trần")
        row = entry
        viet = row.get("viet")
        where = f"'{viet}' (Hán '{chinese}')"
        book_id = _frozen_id(row, where)
        if book_id in seen_ids:
            raise ValueError(f"[fail-loud] id {book_id} trùng giữa Hán '{seen_ids[book_id]}' và '{chinese}'")
        seen_ids[book_id] = chinese
        if book_id not in live and book_id in retired:
            raise ValueError(f"[fail-loud] id mới {book_id} ({where}) trùng id đã retire; không cấp lại id cho binh thư khác")
        if not isinstance(viet, str) or not viet.strip():
            raise ValueError(f"[fail-loud] binh thư {book_id} (Hán '{chinese}') thiếu tên Việt `viet`")
        outside = row.get("outsideTeams") is True
        known = {viet, *_names(row, "aliases", where)}
        if outside and viet in facet_set:
            raise ValueError(f"[fail-loud] viet {where} đã có trong facets.json.books, gỡ cờ outsideTeams")
        if not outside and not known & facet_set:
            raise ValueError(f"[fail-loud] viet {where} không thuộc facets.json.books (tên cũ phải ghi vào `aliases`)")
        effect = {key: row[key].strip() for key in _EFFECT_KEYS if isinstance(row.get(key), str) and row[key].strip()}
        if effect and len(effect) != len(_EFFECT_KEYS):
            raise ValueError(f"[fail-loud] binh thư {where} thiếu một phần hiệu ứng: cần đủ {', '.join(_EFFECT_KEYS)}")
        if "effectVietVersion" in row:
            if not effect or not isinstance(row["effectVietVersion"], str) or not row["effectVietVersion"].strip():
                raise ValueError(f"[fail-loud] binh thư {where}: effectVietVersion cần chuỗi và đủ bộ hiệu ứng")
            effect["effectVietVersion"] = row["effectVietVersion"].strip()
        rec = {"id": book_id, "chinese": chinese, "viet": viet}
        missing: set = set()
        hv = hanviet.to_viet(chinese, missing)
        if not missing:  # chỉ giữ phiên âm sạch
            rec["hanViet"] = hv
        for key in _NAME_LISTS:
            names = _names(row, key, where)
            if names:
                rec[key] = names
        rec.update(effect)
        records.append(rec)
    owned = {name for rec in records for name in (rec["chinese"], *rec.get("sourceNames", []))}
    for rec in records:
        clash = sorted(owned & set(rec.get("excludedSourceNames", [])))
        if clash:
            raise ValueError(f"[fail-loud] '{rec['viet']}' loại trừ tên nguồn của một binh thư khác: {', '.join(clash)}")
    records.sort(key=lambda r: r["viet"])
    return records


def _load_map() -> dict:
    with open(_MAP, encoding="utf-8") as fh:
        return json.load(fh)["books"]


def build() -> list:
    with open(_FACETS, encoding="utf-8") as fh:
        facet_books = [b["value"] for b in json.load(fh)["books"]]
    with open(_LEDGER, encoding="utf-8") as fh:
        ledger = json.load(fh)
    records = build_books_dict(_load_map(), facet_books, ledger)
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
