"""Kỳ lược (奇略) của đội Đội chuẩn: projection hiển thị tính lúc publish từ ghi chú nguồn.

Kết quả `qilue` chỉ là projection hiển thị (giống `displayNotes`): tính trong `site_localization.compile_candidate`
sau `hydrate_inputs`, từ chữ Hán ghi chú đội (`displayNotes.blocks[].textRaw`, thiếu thì `notesRaw`) và catalog
Kỳ lược của **cùng** lookup candidate. Không bao giờ vào source pack, nên `recommendedCorpusHash` không đổi.

Các dạng chữ nguồn (PK-S27):
- official: ``作戰方略：謀算。奇略卡（第 2→6 回合）：a→b→c→d→e`` (台服官方)
- qimou:    ``奇謀（謀算）：a→b→…`` (小幫手, 阿焰, 秋石…)
- bare:     ``謀算：a→b→[極]c→…`` (không có tiền tố; ``[極]`` đánh dấu thẻ hiếm)
- list:     ``奇略：a、b、c…`` (không ghi thứ tự hiệp, không ghi phương lược)
Đội ghi ``復刻…奇略`` (chép kỳ lược đội khác), đội nhãn sai và đội chủ ý bỏ qua nằm trong
`pipeline/recommended-qilue-overrides.json` và được xét TRƯỚC khi đọc chữ.

Fail-closed: tên thẻ lạ, sai luật game, hay đội có chữ kỳ lược mà không ra `qilue` (và không nằm trong `skip`)
đều làm publish dừng. Pack đã ghim nên điều này chỉ xảy ra khi recapture (vốn phải qua review), và chỉ áp cho
mùa trong `overrides.seasons`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

STRATEGY_ZH = "整軍|強攻|謀算|久戰|襲擾"
OFFICIAL = re.compile(r"作戰方略：(%s)[。\s]*奇略卡（第\s*2\s*→\s*6\s*回合）：([^。\n]+)" % STRATEGY_ZH)
QIMOU = re.compile(r"奇謀（(%s)）：([^。\n]+)" % STRATEGY_ZH)
BARE = re.compile(r"(?:^|[｜|\s])(%s)：([^。\n｜|]*→[^。\n｜|]*)" % STRATEGY_ZH)
LIST = re.compile(r"奇略：([^。\n]+)")
# Chữ báo hiệu đoạn có nói tới kỳ lược dạng danh sách (dùng cho gate độ phủ, đếm từ phía dữ liệu).
MENTION = re.compile(r"(奇略|奇謀)[^。\n]*[→、]")
RARE_MARK = "[極]"
QILUE_CATALOG_KEYS = ("qilueStrategies", "qilueCards")


class QilueError(ValueError):
    """Chữ kỳ lược của đội không đọc được hoặc sai luật game: publish dừng."""


def load_catalog(catalog):
    """Bảng tra từ lookup catalog cùng candidate: (strategies theo nameZh, cards theo nameZh, rows theo mã)."""
    if not all(isinstance(catalog.get(key), list) for key in QILUE_CATALOG_KEYS):
        raise QilueError("lookup catalog has no qilue rows")
    strategies = {row["nameZh"]: row for row in catalog["qilueStrategies"]}
    cards = {row["nameZh"]: row for row in catalog["qilueCards"]}
    by_id = {row["id"]: row for key in QILUE_CATALOG_KEYS for row in catalog[key]}
    return strategies, cards, by_id


def load_overrides(document, by_id):
    """Kiểm `recommended-qilue-overrides.json` so với catalog: mọi mã phải có thật, không biến thể nào trùng tên thẻ."""
    keys = {"schemaVersion", "seasons", "noteVariantsZh", "copyFrom", "fix", "skip"}
    if not isinstance(document, dict) or set(document) != keys or document["schemaVersion"] != 1:
        raise QilueError("qilue overrides shape is invalid")
    seasons, variants, copies, fixes, skips = (document[key] for key in ("seasons", "noteVariantsZh", "copyFrom", "fix", "skip"))
    if not isinstance(seasons, list) or not seasons or not all(isinstance(item, str) and item for item in seasons):
        raise QilueError("qilue overrides seasons is invalid")
    names = {row["nameZh"] for row in by_id.values()}
    for variant, target in variants.items():
        if variant in names or not str(target).startswith("qilue-card:") or target not in by_id:
            raise QilueError(f"qilue note variant is invalid: {variant}")
    for config, sources in copies.items():
        if not isinstance(sources, list) or not sources or config in sources or len(set(sources)) != len(sources):
            raise QilueError(f"qilue copyFrom is invalid: {config}")
    for config, entry in fixes.items():
        if (
            not isinstance(entry, dict) or set(entry) != {"strategyId", "cardIds", "ordered", "reason"}
            or not isinstance(entry["reason"], str) or not entry["reason"].strip()
            or type(entry["ordered"]) is not bool
            or (entry["strategyId"] is not None and entry["strategyId"] not in by_id)
            or not isinstance(entry["cardIds"], list) or any(card not in by_id for card in entry["cardIds"])
        ):
            raise QilueError(f"qilue fix is invalid: {config}")
    for config, reason in skips.items():
        if not isinstance(reason, str) or not reason.strip():
            raise QilueError(f"qilue skip needs a reason: {config}")
    if set(copies) & set(fixes) or set(copies) & set(skips) or set(fixes) & set(skips):
        raise QilueError("qilue override sections overlap")
    return document


def _texts(record):
    """(mã block, chữ Hán) của mọi ghi chú đội; record không có displayNotes thì dùng `notesRaw`."""
    blocks = (record.get("displayNotes") or {}).get("blocks")
    if blocks:
        return [(block.get("id"), block.get("textRaw") or "") for block in blocks]
    texts = [(None, record.get("notesRaw") or "")]
    texts += [(None, hero.get("notesRaw") or "") for hero in record.get("heroes", [])]
    return texts


def _cards(raw, separator, cards, variants, config):
    """Danh sách mã thẻ theo đúng thứ tự chữ; `[極]` phải đánh vào thẻ hiếm."""
    ids = []
    for item in (part.strip() for part in raw.split(separator)):
        if not item:
            continue
        rare = item.startswith(RARE_MARK)
        name = item[len(RARE_MARK):].strip() if rare else item
        row = cards.get(name)
        if row is None and name in variants:
            row = next(card for card in cards.values() if card["id"] == variants[name])
        if row is None:
            raise QilueError(f"unknown qilue card in {config}: {name}")
        if rare and row["rarity"] != "rare":
            raise QilueError(f"{RARE_MARK} marks a common qilue card in {config}: {name}")
        ids.append(row["id"])
    return ids


def _check_rules(config, strategy, card_ids, by_id):
    """Luật game: 3–5 thẻ không trùng, tối đa 1 thẻ hiếm, loại thẻ thuộc 2 loại của phương lược."""
    rows = [by_id[card] for card in card_ids]
    if not 3 <= len(rows) <= 5 or len(set(card_ids)) != len(card_ids):
        raise QilueError(f"qilue needs 3-5 distinct cards: {config}")
    if sum(row["rarity"] == "rare" for row in rows) > 1:
        raise QilueError(f"qilue allows at most one rare card: {config}")
    types = {row["type"] for row in rows}
    allowed = [set(row["cardTypes"]) for key, row in by_id.items() if key.startswith("qilue-strategy:")]
    if strategy is not None and not types <= set(strategy["cardTypes"]):
        raise QilueError(f"qilue card types do not fit strategy {strategy['nameZh']}: {config}")
    if strategy is None and not any(types <= pair for pair in allowed):
        raise QilueError(f"qilue card types fit no strategy: {config}")


def _parse(config, texts, strategies, cards, variants, by_id):
    """Đọc theo thứ tự ưu tiên official → qimou → bare → list; trả None khi không có chuỗi thẻ."""
    for form, pattern, separator, ordered in (("official", OFFICIAL, "→", True), ("qimou", QIMOU, "→", True), ("bare", BARE, "→", True), ("list", LIST, "、", False)):
        found = [(block, match) for block, text in texts for match in pattern.finditer(text)]
        if not found:
            continue
        sequences = {match.groups()[-1].strip() for _, match in found}
        if len(sequences) != 1:
            raise QilueError(f"several {form} qilue sequences in {config}")
        block, match = found[0]
        raw = match.groups()[-1]
        if "復刻" in raw:
            raise QilueError(f"qilue copy of another team needs copyFrom: {config}")
        strategy = strategies[match.group(1)] if ordered else None
        card_ids = _cards(raw, separator, cards, variants, config)
        _check_rules(config, strategy, card_ids, by_id)
        result = {"strategyId": strategy["id"] if strategy else None, "cardIds": card_ids, "ordered": ordered, "form": form}
        if form == "official" and block is not None:
            text = dict(texts)[block]
            if not re.sub(r"[\s。]", "", text.replace(match.group(0), "")):
                result["hideNoteBlockId"] = block
        return result
    return None


def _mentions(texts, cards, variants):
    """Gate độ phủ: chữ nhắc tên thẻ (hoặc biến thể) hay có `奇略/奇謀` kèm `→`/`、`."""
    names = set(cards) | set(variants)
    return any(MENTION.search(text) or any(name in text for name in names) for _, text in texts)


def compute_qilue(records, catalog, overrides):
    """`{(safeScopeKey, sourceConfigId): qilue}` cho mọi đội thuộc mùa trong `overrides.seasons`."""
    strategies, cards, by_id = load_catalog(catalog)
    load_overrides(overrides, by_id)
    variants, copies, fixes, skips = (overrides[key] for key in ("noteVariantsZh", "copyFrom", "fix", "skip"))
    seasons = set(overrides["seasons"])
    result, configs = {}, {}
    for record in records:
        if record.get("sourceSeasonId") not in seasons:
            continue
        config = record["sourceConfigId"]
        key = (record["safeScopeKey"], config)
        configs.setdefault(config, []).append(key)
        if config in skips or config in copies:
            continue
        if config in fixes:
            entry = fixes[config]
            strategy = by_id[entry["strategyId"]] if entry["strategyId"] else None
            _check_rules(config, strategy, entry["cardIds"], by_id)
            result[key] = {"strategyId": entry["strategyId"], "cardIds": list(entry["cardIds"]), "ordered": entry["ordered"], "form": "fix"}
            continue
        texts = _texts(record)
        parsed = _parse(config, texts, strategies, cards, variants, by_id)
        if parsed is None:
            if _mentions(texts, cards, variants):
                raise QilueError(f"team mentions qilue but no sequence was read (add to skip or fix): {config}")
            continue
        result[key] = parsed
    for config, sources in copies.items():
        if config not in configs:
            raise QilueError(f"qilue copyFrom team is not in the pack: {config}")
        for source in sources:
            if not any(key[1] == source for key in result):
                raise QilueError(f"qilue copyFrom source has no qilue: {config} -> {source}")
        for key in configs[config]:
            result[key] = {"strategyId": None, "cardIds": [], "ordered": False, "form": "copy", "copyFrom": list(sources)}
    unused = (set(fixes) | set(skips)) - set(configs)
    if unused:
        raise QilueError("qilue overrides name teams outside the pack: " + ", ".join(sorted(unused)))
    return result


def read_overrides(path):
    return json.loads(Path(path).read_bytes())
