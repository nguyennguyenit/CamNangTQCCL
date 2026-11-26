"""Chuyển chữ Hán phồn thể / giản thể sang tự dạng Nhật (shinjitai) theo bảng `data/ja-kanji-variants.json`.

Chỉ đổi từng ký tự có trong bảng; ký tự khác (chữ Latin, số, khoảng trắng, chữ Hán không có trong bảng, ví dụ 劉 龐)
giữ nguyên. Đây là phép đổi mặt chữ, không phải dịch: tên riêng mà bản Nhật gọi khác nghĩa phải nằm trong
`pipeline/ja-name-overrides.json`. Cùng bảng được trình duyệt đọc nên không lưu trạng thái ngoài file đó.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

VARIANTS_PATH = Path(__file__).resolve().parent.parent / "data" / "ja-kanji-variants.json"


class ShinjitaiTableError(Exception):
    """Bảng ký tự sai dạng; builder dừng thay vì đổi chữ theo bảng hỏng."""


def load_variants(path: Path | str = VARIANTS_PATH) -> dict[str, str]:
    """Đọc và kiểm bảng: mỗi khóa/giá trị đúng một ký tự, không ánh xạ nối tiếp (đích không phải khóa)."""
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ShinjitaiTableError(f"{path}: không đọc được bảng ký tự ({exc})") from exc
    table = payload.get("map") if isinstance(payload, dict) else None
    if not isinstance(table, dict) or not table:
        raise ShinjitaiTableError(f"{path}: thiếu `map`")
    for source, target in table.items():
        if not (isinstance(source, str) and isinstance(target, str) and len(source) == 1 and len(target) == 1):
            raise ShinjitaiTableError(f"{path}: mục {source!r} -> {target!r} không phải cặp một ký tự")
        if source == target:
            raise ShinjitaiTableError(f"{path}: mục {source!r} tự ánh xạ")
        if target in table:
            raise ShinjitaiTableError(f"{path}: mục {source!r} -> {target!r} nối tiếp sang mục khác")
    return table


@lru_cache(maxsize=1)
def _default_table() -> dict[str, str]:
    return load_variants()


def to_shinjitai(text: str, table: dict[str, str] | None = None) -> str:
    """Đổi từng ký tự của `text` theo bảng (mặc định là `data/ja-kanji-variants.json`)."""
    if not isinstance(text, str):
        raise TypeError("to_shinjitai nhận chuỗi")
    mapping = _default_table() if table is None else table
    return "".join(mapping.get(ch, ch) for ch in text)
