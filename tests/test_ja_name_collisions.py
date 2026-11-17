"""Tên Nhật (`data/lookup-ja.json` `name`) trùng chữ Hán nguồn của một mục khác cùng từ điển.

Bộ khớp tên của Soi đội, đọc ảnh kho Gợi ý đội và bộ chấm eval Worker (`createExactNameIndex` trong
`js/locale-name-aliases.js`) cho tên Nhật thắng `chinese`/bí danh chữ Hán trùng của mục khác. Mỗi chỗ trùng như vậy đổi
kết quả khớp trên bản ja so với vi/zh, nên phải được duyệt và ghi tên vào danh sách cho phép dưới đây. Chỉ xét ba từ điển
mà bộ khớp tên dùng (tướng, chiến pháp, binh thư); trùng giữa hai nhóm khác nhau (cải tạo binh chủng và chiến pháp cùng
tên) không ảnh hưởng vì mỗi nhóm có chỉ mục riêng.
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CJK = re.compile(r"[一-鿿]")
DICTS = ("data/heroes-dict.json", "data/tactics.json", "data/books-dict.json")

# ID có tên Nhật → ID của mục khác mang chữ Hán nguồn trùng tên Nhật đó. Bản Nhật gọi 固若金湯 là 金城湯池, mà 金城湯池
# là chữ Hán nguồn của chiến pháp bản Nhật gọi 湯池鉄城.
ALLOWED = {
    ("tactic:co-nhuoc-kim-thang", "tactic:kim-thanh-thang-tri"),
}


def compact(value: object) -> str:
    return re.sub(r"\s+", "", value) if isinstance(value, str) else ""


def source_names(record: dict) -> list[str]:
    aliases = [alias for alias in record.get("aliases") or [] if isinstance(alias, str) and CJK.search(alias)]
    return [name for name in (compact(record.get("chinese")), *map(compact, aliases)) if name]


def find_collisions(entries: dict, dicts: list[list[dict]]) -> set[tuple[str, str]]:
    found: set[tuple[str, str]] = set()
    for records in dicts:
        owners: dict[str, set[str]] = {}
        for record in records:
            record_id = record.get("id")
            if not isinstance(record_id, str):
                continue
            for name in source_names(record):
                owners.setdefault(name, set()).add(record_id)
        for record in records:
            record_id = record.get("id")
            name = compact((entries.get(record_id) or {}).get("name")) if isinstance(record_id, str) else ""
            for other in owners.get(name, set()) - {record_id}:
                found.add((record_id, other))
    return found


class JaNameCollisionTest(unittest.TestCase):
    def test_collisions_match_allowlist(self) -> None:
        entries = json.loads((ROOT / "data/lookup-ja.json").read_text(encoding="utf-8"))["entries"]
        dicts = [json.loads((ROOT / path).read_text(encoding="utf-8")) for path in DICTS]
        found = find_collisions(entries, dicts)
        self.assertEqual(
            sorted(found - ALLOWED),
            [],
            "tên Nhật mới trùng chữ Hán nguồn của mục khác: duyệt hành vi khớp trên bản ja rồi thêm vào ALLOWED",
        )
        self.assertEqual(sorted(ALLOWED - found), [], "mục trong ALLOWED không còn trùng: gỡ khỏi danh sách")

    def test_detects_new_collision(self) -> None:
        dicts = [[
            {"id": "tactic:a", "chinese": "固若金湯"},
            {"id": "tactic:b", "chinese": "金城 湯池", "aliases": ["Kim Thành", "金城汤池"]},
            {"id": "tactic:c", "chinese": "丙"},
        ]]
        entries = {"tactic:a": {"name": "金城湯池"}, "tactic:c": {"name": "金城汤池"}}
        self.assertEqual(find_collisions(entries, dicts), {("tactic:a", "tactic:b"), ("tactic:c", "tactic:b")})
        self.assertEqual(find_collisions({"tactic:b": {"name": "金城湯池"}}, dicts), set())


if __name__ == "__main__":
    unittest.main()
