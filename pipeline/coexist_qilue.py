"""Thẻ Kỳ Lược của đội Cùng Tồn: nối chữ thô của sheet (`strategyCardsRaw`) với mã `qilue-card:*` của catalog Kỳ lược.

Sheet Cùng Tồn (bảng 11 cột) ghi chuỗi thẻ theo thứ tự hiệp bằng tên Việt, nối bằng ``→``:
``Ẩn Tích Mang Thương → Bái Huyện Tụ Nghĩa → …`` (thẻ đầu dùng ở hiệp 2). Mỗi tên phải khớp đúng `nameVi` (tên client)
của một hàng `qilueCards` trong lookup catalog, hoặc nằm trong bảng alias đã duyệt
(`pipeline/coexist-qilue-aliases.json`, mỗi alias ghi mã thẻ, chữ Hán và nguồn đối chiếu).

Fail-closed giống `pipeline/recommended_qilue.py`: tên lạ, alias trỏ sai thẻ, chuỗi sai luật game (3–5 thẻ không trùng,
tối đa 1 thẻ hiếm, loại thẻ thuộc 2 loại của một phương lược) đều làm build dừng. Sheet không ghi phương lược nên
không suy ra phương lược; chỉ kiểm rằng tồn tại ít nhất một phương lược dùng được bộ thẻ.

Kết quả `strategyCardIds` là projection tính từ nguồn + catalog, không phải nội dung nguồn: `content_fingerprint`
bỏ qua trường này nên bản đồ record đã duyệt không đổi khi catalog đổi tên hiển thị.
"""

from __future__ import annotations

import json
import unicodedata
from pathlib import Path

from .recommended_qilue import QilueError, _check_rules, load_catalog

ROOT = Path(__file__).resolve().parents[1]
ALIASES_PATH = ROOT / "pipeline" / "coexist-qilue-aliases.json"
CATALOG_PATH = ROOT / "data" / "lookup-catalog.json"
SEPARATOR = "→"
CARD_PREFIX = "qilue-card:"


class CoexistQilueError(QilueError):
    """Chuỗi Thẻ Kỳ Lược của đội Cùng Tồn không nối được với catalog: build dừng."""


def _name(value):
    """So khớp tên theo NFC và khoảng trắng gọn; không đổi hoa thường hay dấu (tên client là chuẩn)."""
    return " ".join(unicodedata.normalize("NFC", value).split())


def card_index(catalog, aliases_document):
    """Bảng `{tên Việt → mã thẻ}` gồm tên client của catalog và alias đã duyệt; kiểm alias trước khi dùng.

    Alias hợp lệ khi: trỏ một mã `qilue-card:*` có trong catalog, chữ Hán ghi kèm trùng `nameZh` của thẻ đó, có nguồn,
    và tên alias không trùng tên client của bất kỳ thẻ nào (tránh một tên hai nghĩa)."""
    _, _, by_id = load_catalog(catalog)
    names = {}
    for row in catalog["qilueCards"]:
        key = _name(row["nameVi"])
        if key in names:
            raise CoexistQilueError(f"qilue catalog repeats card name: {row['nameVi']}")
        names[key] = row["id"]
    if (
        not isinstance(aliases_document, dict)
        or set(aliases_document) != {"schemaVersion", "note", "aliases"}
        or aliases_document["schemaVersion"] != 1
        or not isinstance(aliases_document["aliases"], dict)
    ):
        raise CoexistQilueError("coexist qilue aliases shape is invalid")
    index = dict(names)
    for alias, entry in aliases_document["aliases"].items():
        key = _name(alias)
        if (
            not isinstance(entry, dict) or set(entry) != {"cardId", "nameZh", "source"}
            or not isinstance(entry["source"], str) or not entry["source"].strip()
            or not str(entry["cardId"]).startswith(CARD_PREFIX) or entry["cardId"] not in by_id
            or by_id[entry["cardId"]]["nameZh"] != entry["nameZh"]
        ):
            raise CoexistQilueError(f"coexist qilue alias is invalid: {alias}")
        if key in index:
            raise CoexistQilueError(f"coexist qilue alias repeats a card name: {alias}")
        index[key] = entry["cardId"]
    return index, by_id


def resolve_strategy_cards(raw, index, by_id, *, label):
    """Mã thẻ theo đúng thứ tự hiệp của chữ nguồn; chuỗi rỗng trả `[]`. `label` chỉ dùng trong thông báo lỗi."""
    if not isinstance(raw, str):
        raise CoexistQilueError(f"strategy cards are not text: {label}")
    if not raw.strip():
        return []
    ids = []
    for part in raw.split(SEPARATOR):
        name = _name(part)
        if not name:
            raise CoexistQilueError(f"empty qilue card name in {label}")
        card = index.get(name)
        if card is None:
            raise CoexistQilueError(f"unknown qilue card in {label}: {name}")
        ids.append(card)
    try:
        _check_rules(label, None, ids, by_id)
    except CoexistQilueError:
        raise
    except QilueError as error:
        raise CoexistQilueError(str(error)) from error
    return ids


def read_catalog(path=CATALOG_PATH):
    return json.loads(Path(path).read_bytes())


def read_aliases(path=ALIASES_PATH):
    return json.loads(Path(path).read_bytes())


def check_payload_cards(content_links, catalog, aliases_document):
    """Mọi đội bảng 11 cột có chữ thẻ phải mang `strategyCardIds` đúng bằng kết quả nối lại từ chữ nguồn với catalog
    hiện hành; đội không có chữ thẻ thì không mang mã. Dùng ở bước publish dữ liệu mùa để catalog đổi (mất thẻ, đổi mã)
    hay ai sửa tay mã thẻ đều làm build dừng."""
    index, by_id = card_index(catalog, aliases_document)
    for link in content_links:
        target = link.get("target") or {}
        if target.get("type") != "source-owned-coexist":
            continue
        for team in target["payload"]["teams"]:
            if "strategyCardsRaw" not in team:
                continue
            label = team.get("recordId") or link.get("recordId")
            expected = resolve_strategy_cards(team["strategyCardsRaw"], index, by_id, label=label)
            if expected and team.get("strategyCardIds") != expected:
                raise CoexistQilueError(f"strategyCardIds differ from the source cards: {label}")
            if not expected and "strategyCardIds" in team:
                raise CoexistQilueError(f"strategyCardIds without source cards: {label}")
