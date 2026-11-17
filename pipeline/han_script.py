"""Lối viết (giản thể / phồn thể) của một tên chữ Hán, để trang ja gắn `lang` đúng cho tên gốc ("原名").

Bảng `pipeline/han-script-chars.json` sinh từ OpenCC (cùng commit với `data/ja-kanji-variants.json`, nguồn ghi trong `source`):
`simplifiedOnly` là chữ chỉ giản thể dùng, `traditionalOnly` là chữ chỉ phồn thể dùng. Chữ hai lối viết cùng dùng không là bằng
chứng. Bảng chỉ dùng lúc build (`pipeline/build_lookup_ja.py` ghi `nameOriginalLang`), trình duyệt không tải.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

TABLE_PATH = Path(__file__).resolve().parent / "han-script-chars.json"


class HanScriptTableError(Exception):
    """Bảng ký tự sai dạng; builder dừng thay vì gắn `lang` theo bảng hỏng."""


def load_table(path: Path | str = TABLE_PATH) -> tuple[frozenset[str], frozenset[str]]:
    """Đọc và kiểm bảng: hai chuỗi ký tự không rỗng, không có ký tự nào thuộc cả hai."""
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise HanScriptTableError(f"{path}: không đọc được bảng ({exc})") from exc
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise HanScriptTableError(f"{path}: schemaVersion sai")
    simplified, traditional = payload.get("simplifiedOnly"), payload.get("traditionalOnly")
    if not (isinstance(simplified, str) and simplified and isinstance(traditional, str) and traditional):
        raise HanScriptTableError(f"{path}: thiếu simplifiedOnly/traditionalOnly")
    both = set(simplified) & set(traditional)
    if both:
        raise HanScriptTableError(f"{path}: ký tự thuộc cả hai lối viết: {''.join(sorted(both))[:20]}")
    return frozenset(simplified), frozenset(traditional)


@lru_cache(maxsize=1)
def _default_table() -> tuple[frozenset[str], frozenset[str]]:
    return load_table()


def han_script_lang(text: str, table: tuple[frozenset[str], frozenset[str]] | None = None) -> str:
    """`zh-Hans` khi chỉ có chữ riêng của giản thể, `zh-Hant` khi chỉ có chữ riêng của phồn thể; không phân biệt được hoặc lẫn
    cả hai thì `zh` (không đoán)."""
    if not isinstance(text, str):
        raise TypeError("han_script_lang nhận chuỗi")
    simplified, traditional = _default_table() if table is None else table
    hans = any(ch in simplified for ch in text)
    hant = any(ch in traditional for ch in text)
    if hans == hant:
        return "zh"
    return "zh-Hans" if hans else "zh-Hant"
