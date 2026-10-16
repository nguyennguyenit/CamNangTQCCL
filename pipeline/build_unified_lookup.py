"""Build and validate a private, deterministic unified lookup candidate."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
import re
import secrets
import stat
from pathlib import Path

from pipeline.lookup_translations import (
    canonical_json_bytes,
    translation_fingerprint,
    validate_translation_entries,
)
from pipeline.query_sgsdeck_catalog import validate_guide_document
from pipeline.sgsdeck_identity import canonical_id
from pipeline.unified_lookup_identity import _child_row, _fingerprint, _slug, _source_row, validate_registry


SOURCE_GROUPS = ("generals", "tactics", "equipment", "advisors", "troop-mods", "buildings")
CLIENT_HEROES_FILE = Path(__file__).with_name("lookup-client-heroes.json")
PUBLIC_HEROES_DIR = Path(__file__).resolve().parents[1] / "public" / "heroes"
CLIENT_PORTRAIT_PATTERN = re.compile(r"/heroes/([a-z0-9-]+)\.webp")
CLIENT_SOURCE_KEYS = {"kind", "edition", "client", "version", "screen", "capturedAt"}
CLIENT_HERO_KEYS = {"id", "viet", "chinese", "aliasesVi", "faction", "stars", "cost", "isSP", "variant", "stats", "growth", "troopApt", "roleTag", "roleTagViet", "selfTacticVi", "portrait"}
CLIENT_STAT_KEYS = ("luc", "tri", "thong", "toc", "chinh", "mi")
CLIENT_APTITUDE_KEYS = ("ky", "thuan", "cung", "thuong", "khiGioi")
# Trường SGSDeck mà bản capture từ client không có; tên theo thuộc tính nguồn như `missingFields` của SGSDeck.
CLIENT_MISSING_FIELDS = ("adaptInfantry", "adaptNavy", "advisorSkillId", "cardPacks", "civil", "civilInnatePoints", "inheritedTacticName", "isCO", "isCollectible", "isDynamicOpen", "isMusou", "usage")
CLIENT_TACTICS_FILE = Path(__file__).with_name("lookup-client-tactics.json")
CLIENT_TACTIC_KEYS = {"nameVi", "quality", "type", "activationRate", "troopFit", "targetVi", "effectTypeVi", "effectVi", "maxUsers", "exchangeConditionVi"}
CLIENT_TACTIC_TYPES = {"COMMAND", "ACTIVE", "BURST", "PASSIVE", "TROOP", "FORMATION", "INTERNAL"}
PUBLIC_FILES = ("heroes-dict.json", "tactics.json", "lookup-catalog.json")
MISSING_TEXT = {"待補充", "待补充"}
FACTIONS = {"WEI": "Ngụy", "SHU": "Thục", "WU": "Ngô", "QUN": "Quần", "HAN": "Hán"}
HERO_KEYS = {"id", "chinese", "hanViet", "viet", "aliases", "faction", "stars", "cost", "stats", "troopApt", "selfTacticCn", "inheritTacticCn", "roleTag", "roleTagViet", "iconUrl", "isSP", "linkScore", "pending", "lookup"}
TACTIC_KEYS = {"id", "chinese", "hanViet", "viet", "aliases", "type", "quality", "effect", "effectViet", "target", "targetViet", "troopFit", "source", "sourceHeroCn", "iconUrl", "linkScore", "pending", "lookup"}
COMMON_KEYS = {"id", "nameVi", "aliasesVi", "aliasesZh", "conditions", "missingFields"}
EQUIPMENT_KEYS = COMMON_KEYS | {"qualityVi", "slotVi"}
SPECIAL_KEYS = COMMON_KEYS | {"tierVi", "slotVi", "descriptionVi", "acquisitionVi", "equipmentId", "exclusiveHeroId"}
ADVISOR_KEYS = COMMON_KEYS | {"elementVi", "effectVi", "usageVi", "tacticPoints", "heroIds"}
TROOP_MOD_KEYS = COMMON_KEYS | {"effectVi", "appliesToVi", "suggestedBuildVi", "troopLimitVi", "revisions", "options"}
BUILDING_KEYS = COMMON_KEYS | {"summaryVi", "mainCityOnly", "maxLevel", "levels"}
OPTION_KEYS = {"id", "tierVi", "nameVi", "descriptionVi", "convertsToVi"}
LEVEL_KEYS = {"id", "level", "costs", "durationVi", "effectVi"}
FIELD_LEDGER_KEYS = {"entityId", "fieldPath", "disposition", "chosenInput", "sourceRecordId", "sourceFieldPath", "sourceValueHash", "localValueHash", "reason", "translationInputFingerprint", "reviewEvidence"}
HERO_LOOKUP_KEYS = {"conditions", "missingFields", "revisions", "variant", "selfTacticId", "inheritTacticId", "advisorId", "growth", "otherAptitudes", "categoryVi", "exclusiveTitleVi", "civil", "civilInnatePoints", "collectibleBonusVi", "redRulesVi", "flags", "usageVi", "usageZh", "cardPacks"}
CARD_PACK_KEYS = {"packVi", "packZh", "categoryVi", "categoryZh", "isCore", "coreRate", "nonCoreRate"}
TACTIC_LOOKUP_KEYS = {"conditions", "missingFields", "revisions", "activationRate", "cooldown", "maxUsers", "pointCost", "effectTypeVi", "exchangeConditionVi", "acquiredFromVi", "inheritedFromIds", "conflictsVi"}
SLOTS = {"武器": "Vũ khí", "防具": "Phòng cụ", "坐騎": "Tọa kỵ", "寶物": "Bảo vật", "WEAPON": "Vũ khí", "ARMOR": "Phòng cụ", "MOUNT": "Tọa kỵ", "TREASURE": "Bảo vật"}
GOLDEN_HERO_DELTAS = {
    "hero:ha-hau-don": ("troopApt", "thuan", "S"),
    "hero:vuong-nguyen-co": ("stats", "mi", "50"),
    "hero:nhac-tien": ("stats", "toc", "68"),
    "hero:truong-xuan-hoa": ("stats", "mi", "68"),
    "hero:quan-ngan-binh": ("stats", "mi", "50"),
    "hero:ma-van-loc": ("stats", "mi", "47"),
    "hero:lo-tuc": ("troopApt", "cung", "S"),
    "hero:lu-mong": ("troopApt", "cung", "S"),
    "hero:lu-linh-y": ("stats", "mi", "34"),
    "hero:sp-lu-mong": ("troopApt", "cung", "S"),
    "hero:dong-bach": ("stats", "mi", "57"),
    # Các ghim trên phản ánh client Global 24.526 (nguồn có thẩm quyền, qua `overrides` của lookup-client-heroes.json).
}
# Hiệu chỉnh giá trị nguồn đã review (Kongming ruling). Chỉ tra cứu thuần tại điểm adopt:
# KHÔNG sửa source_docs/attrs, vì fingerprint dịch và sourceValueHash của ledger phải đọc giá trị thô.
# Giá trị thô lệch `raw` (vd upstream đã sửa), chủ sở hữu lệch `entityId`, hoặc mục không được
# tiêu thụ trong build đều làm build thất bại; mục khi đó phải review lại hoặc xóa.
SOURCE_VALUE_CORRECTIONS = {
    ("tactics", "cmtb9e3c6000058f84ugbcun5", "activationRate"): {
        "entityId": "tactic:thien-uy-khieu-tran",
        "raw": 50,
        "published": 0.5,
        "reason": "Reviewed unit correction: SGSDeck capture has activationRate 50 (percent scale) for 天威嘯陣; every other tactic uses a 0–1 fraction, so 50% is published as 0.5.",
    },
}
# SGSDeck gắn lời khuyên 評價 của bản thường vào bản SP ở các tướng dưới đây: nguồn của 評價 là danh sách
# 遊民星空 (爆炸冰整理) ngày 2022-01-24 (tới khoảng S11), các bản SP này ra mắt S13–S25, chiến pháp "拆" là
# truyền thừa của bản thường, và bản thường không có 評價 riêng. Lời khuyên được công bố trên hồ sơ bản thường.
# Khóa: sourceId bản SP → (sourceId bản thường, chữ nguồn đã review). Chữ nguồn lệch, bản thường đã có 評價
# riêng hoặc mục không được tiêu thụ đều làm build thất bại.
USAGE_REASSIGNMENTS = {
    "cmnzuqkaz000x3wf8bc0cefo4": ("cmo4dvzyw0001u4f8uwgelgts", "有劉備張飛必留一個，多餘將優先拆橫掃千軍，其次升星"),  # SP 關羽 → 關羽
    "cmnzwg57f000194f8v1ioc6w5": ("cmo4dw5uj0007u4f89kj91p0u", "可留一個，優先拆折衝禦侮、酌情換虎衛軍，其次升星"),  # SP 典韋 → 典韋
    "cmnzwgb8u000c94f8xrd4ltkp": ("cmo4dw4bo0005u4f8lmtwgmy5", "可留一個，多餘將優先換裸衣血戰，其次酌情拆所向披靡"),  # SP 許褚 → 許褚
    "cmnzwge0b000l94f8usar7du4": ("cmo4dw5gq0006u4f8hxql2g4s", "可不留，優先拆四面楚歌、酌情換決水潰城、青州兵，其次作內政、覺醒"),  # SP 荀彧 → 荀彧
    "cmnzwgt8u001l94f8v36ax3uo": ("cmo4dvzle0000u4f8f3f0fole", "必留一個，多餘將優先換裸衣血戰，其次優先拆所向披靡，酌情換鐵騎驅馳"),  # SP 馬超 → 馬超
    "cmnzwh56z002694f8llexs8hk": ("cmo4dw92e0009u4f8ijttaffh", "可留一個，多餘將優先拆萬箭齊發，其次換擊其惰歸"),  # SP 黃忠 → 黃忠
    "cmnzwha93002h94f8kd9xsq6t": ("cmo4dwlcp000bu4f8v51ct8sg", "必留一個，多餘將優先拆鋒矢陣，其次升星、覺醒"),  # SP 黃月英 → 黃月英
    "cmnzwhb1x002j94f8u36vy1yl": ("cmo4dwljk000cu4f83x2niuuv", "必留一個，多餘將優先換擊其惰歸、酌情拆沉沙決水，其次升星、覺醒"),  # SP 法正 → 法正
    "cmnzwi1xd003594f85vkg2qra": ("cmo4dwblm000au4f8udljhjcp", "可留一個，優先換三勢陣、酌情拆挫銳，其次酌情升星、覺醒、換典藏"),  # SP 孫堅 → 孫堅
    "cmnzwift1003s94f8kzfwqxnw": ("cmo4dw21v0002u4f8z2ig608e", "可留一個，優先拆暴戾無仁、換火熾原燎，其次酌情升星、覺醒、換典藏"),  # SP 董卓 → 董卓
    "cmnzwiybn004t94f8572lb26a": ("cmo4dwm41000eu4f8zf9w5clv", "可留一個，多餘將酌情拆傾國傾城，其次酌情升星、覺醒、換典藏"),  # SP 貂蟬 → 貂蟬
}
QUALITY = {"橙": "Cam", "紫": "Tím", "藍": "Lam", "綠": "Lục"}
ELEMENTS = {"風": "Phong", "火": "Hỏa", "水": "Thủy", "土": "Thổ", "雷": "Lôi", "山": "Sơn", "林": "Lâm"}
TIERS = {"SPECIAL": "Đặc biệt", "BASIC": "Cơ bản", "INTERMEDIATE": "Trung cấp", "ADVANCED": "Cao cấp", "T0": "T0", "T1": "T1", "T2": "T2", "T3": "T3"}
TROOPS = {"CAVALRY": "Kỵ binh", "SHIELD": "Khiên binh", "BOW": "Cung binh", "SPEAR": "Thương binh", "SIEGE": "Khí giới"}
# Tên gói chiêu mộ và loại gói đã duyệt. Gói mới của nguồn làm build dừng ở `_enum` cho tới khi được dịch ở đây.
CARD_PACKS = {
    "名將": "Danh tướng", "典藏卡包": "Sưu tầm",
    "其疾如風": "Kỳ Tật Như Phong", "其徐如林": "Kỳ Từ Như Lâm", "侵略如火": "Xâm Lược Như Hỏa", "不動如山": "Bất Động Như Sơn",
    "懸權而動": "Huyền Quyền Nhi Động", "難知如陰": "Nan Tri Như Âm", "動如雷霆": "Động Như Lôi Đình",
    "PK 名將 I": "PK Danh tướng I", "PK 名將 II": "PK Danh tướng II", "PK 名將 III": "PK Danh tướng III", "PK 名將 IV": "PK Danh tướng IV",
    "S1 名將卡包": "Danh tướng S1", "S2 名將卡包": "Danh tướng S2", "S3 名將卡包": "Danh tướng S3",
}
CARD_PACK_CATEGORIES = {
    "名將卡包": "Gói Danh tướng", "典藏卡包": "Gói Sưu tầm",
    "EX小卡包（風林火山）": "Gói EX (Phong Lâm Hỏa Sơn)", "EX小卡包（權陰雷）": "Gói EX (Quyền Âm Lôi)",
    "PK名將卡包": "Gói Danh tướng PK", "雙十一限定": "Giới hạn 11/11",
}
_ROOT_TRANSLATION_FIELDS = {
    "generals": {
        "attributes.category": "lookup.categoryVi",
        "attributes.role": "roleTagViet",
        "attributes.exclusiveTitle": "lookup.exclusiveTitleVi",
        "attributes.civilRole": "lookup.civil.roleVi",
        "attributes.civilBonusDesc": "lookup.civil.bonusVi",
        "attributes.civilSpecialty": "lookup.civil.specialtyVi",
        "attributes.civilTacticBonus": "lookup.civil.tacticBonusVi",
        "attributes.collectibleBonus": "lookup.collectibleBonusVi",
        "attributes.redRules": "lookup.redRulesVi",
    },
    "tactics": {
        "attributes.effectText": "effectViet",
        "attributes.effectTarget": "targetViet",
        "attributes.effectType": "lookup.effectTypeVi",
        "attributes.exchangeCondition": "lookup.exchangeConditionVi",
        "attributes.sources": "lookup.acquiredFromVi",
        "attributes.conflictsWith": "lookup.conflictsVi",
    },
    "advisors": {
        "attributes.effectText": "effectVi",
        "attributes.description": "usageVi",
    },
    "troop-mods": {
        "attributes.effectText": "effectVi",
        "attributes.appliesTo": "appliesToVi",
        "attributes.suggestedBuild": "suggestedBuildVi",
    },
    "buildings": {"attributes.summary": "summaryVi"},
}


def _sha(payload):
    return hashlib.sha256(payload).hexdigest()


def _json(payload):
    return json.loads(payload)


def _normalize_root_alias(path):
    path = Path(path).absolute()
    parts = path.parts
    if len(parts) > 1:
        first = Path(path.anchor) / parts[1]
        if first.is_symlink():
            return first.resolve(strict=True).joinpath(*parts[2:])
    return path


def _reject_symlink_ancestry(path):
    path = Path(path).absolute()
    current = path
    while True:
        if current.exists() and current.is_symlink():
            raise ValueError(f"symlink path component is forbidden: {current}")
        if current.parent == current:
            return
        current = current.parent


def _capture_file(path):
    path = _normalize_root_alias(path)
    if path.is_symlink():
        raise ValueError(f"symlink input is forbidden: {path}")
    _reject_symlink_ancestry(path)
    path = path.resolve(strict=True)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(path, flags)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ValueError(f"input must be a regular non-symlink file: {path}")
        chunks = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                return b"".join(chunks)
            chunks.append(chunk)
    finally:
        os.close(descriptor)


def _capture_dir(path, names):
    path = _normalize_root_alias(path)
    if path.is_symlink():
        raise ValueError(f"symlink input is forbidden: {path}")
    _reject_symlink_ancestry(path)
    path = path.resolve(strict=True)
    if not path.is_dir():
        raise ValueError(f"input must be a regular non-symlink directory: {path}")
    return {name: _capture_file(path / name) for name in names}


def _ensure_distinct_output(output, protected):
    output = _normalize_root_alias(output)
    if output.is_symlink() or output.parent.is_symlink():
        raise ValueError(f"symlink candidate output path is forbidden: {output}")
    _reject_symlink_ancestry(output.parent)
    output = output.parent.resolve(strict=False) / output.name
    resolved_output = output.resolve(strict=False)
    for item in protected:
        item = _normalize_root_alias(item)
        if item.is_symlink():
            raise ValueError(f"symlink input is forbidden: {item}")
        _reject_symlink_ancestry(item)
        resolved = item.resolve(strict=False)
        if (
            resolved_output == resolved
            or resolved in resolved_output.parents
            or resolved_output in resolved.parents
        ):
            raise ValueError("candidate output overlaps a protected input")
    return output


def _conditions(record, translated=None, owner=None):
    season = record.get("sourceSeason")
    rows = []
    if isinstance(season, dict):
        if season.get("number") is not None:
            rows.append({"kind": "season", "textVi": f"Mùa {season['number']}"})
        if season.get("scenarioName"):
            text = translated.get((owner, "conditions.scenarioVi")) if translated and owner else None
            if not text:
                raise ValueError(f"missing reviewed scenario translation: {owner}")
            rows.append({"kind": "scenario", "textVi": text})
    return rows


def _flatten(value, prefix="attributes"):
    if isinstance(value, dict):
        if not value:
            yield prefix, value
        for key in sorted(value):
            yield from _flatten(value[key], f"{prefix}.{key}")
    elif isinstance(value, list):
        if not value:
            yield prefix, value
        for index, item in enumerate(value):
            yield from _flatten(item, f"{prefix}[{index}]")
    else:
        yield prefix, value


def _revisions(source_text, translated_text):
    if not isinstance(source_text, str) or not isinstance(translated_text, str):
        return []
    markers = list(re.finditer(
        r"(?:Cập nhật(?:\s+ngày)?\s+(\d{4}-\d{2}-\d{2})(?:\s*\([^)]*\))?|Phiên bản gốc|Bản gốc)",
        translated_text,
        flags=re.IGNORECASE,
    ))
    if not markers:
        return []
    rows = []
    for index, marker in enumerate(markers):
        start = marker.end()
        end = markers[index + 1].start() if index + 1 < len(markers) else len(translated_text)
        text = translated_text[start:end].strip(" /:")
        if not text:
            continue
        date = marker.group(1)
        rows.append({
            "labelVi": "Bản hiện hành" if not rows else ("Bản gốc" if date is None else f"Bản {date}"),
            "effectiveDate": date,
            "textVi": text,
            "isCurrent": not rows,
        })
    return rows


def _translation_specs(source_docs, source_owner, child_ids, glossary, baseline_heroes, baseline_tactics, identity_hash, published_usage):
    specs = {}
    baseline_hero_by_owner = {canonical_id("hero", row.get("viet") or row["hanViet"]): row for row in baseline_heroes}
    baseline_tactic_by_owner = {canonical_id("tactic", row.get("viet") or row["hanViet"]): row for row in baseline_tactics}

    def add(entity_id, field_path, source_value, context):
        if (
            source_value is None
            or source_value == ""
            or source_value == []
            or (isinstance(source_value, str) and source_value in MISSING_TEXT)
        ):
            return
        key = (entity_id, field_path)
        specs[key] = translation_fingerprint(
            entity_id,
            field_path,
            source_value,
            glossary,
            context,
        )

    def record_context(record, source_field):
        return {
            "sourceField": source_field,
            "attributes": record.get("attributes", {}),
            "sourceSeason": record.get("sourceSeason"),
            "identityRegistryHash": identity_hash,
        }

    general_fields = (
        ("category", "lookup.categoryVi"),
        ("role", "roleTagViet"),
        ("exclusiveTitle", "lookup.exclusiveTitleVi"),
        ("civilRole", "lookup.civil.roleVi"),
        ("civilBonusDesc", "lookup.civil.bonusVi"),
        ("civilSpecialty", "lookup.civil.specialtyVi"),
        ("civilTacticBonus", "lookup.civil.tacticBonusVi"),
        ("collectibleBonus", "lookup.collectibleBonusVi"),
        ("redRules", "lookup.redRulesVi"),
    )
    tactic_fields = (
        ("effectText", "effectViet"),
        ("effectTarget", "targetViet"),
        ("effectType", "lookup.effectTypeVi"),
        ("conflictsWith", "lookup.conflictsVi"),
    )
    for group, fields in (("generals", general_fields), ("tactics", tactic_fields)):
        for record in source_docs[group]["records"]:
            entity_id = source_owner[f"{group}:{record['sourceId']}"]
            attrs = record["attributes"]
            for source_field, target_field in fields:
                add(
                    entity_id,
                    target_field,
                    attrs.get(source_field),
                    record_context(record, source_field),
                )
            if group == "generals" and not attrs.get("role"):
                baseline = baseline_hero_by_owner.get(entity_id)
                if baseline and baseline.get("roleTag"):
                    add(
                        entity_id,
                        "roleTagViet",
                        baseline["roleTag"],
                        {**record_context(record, "baseline.roleTag"), "chosenInput": "local-baseline"},
                    )
            if group == "tactics":
                sources = attrs.get("sources")
                acquisition_context = record_context(record, "sources+exchangeCondition")
                if isinstance(sources, list):
                    add(entity_id, "lookup.acquiredFromVi", sources, acquisition_context)
                elif isinstance(sources, dict):
                    add(
                        entity_id,
                        "lookup.acquiredFromVi",
                        sources.get("eventName"),
                        acquisition_context,
                    )
                    add(
                        entity_id,
                        "lookup.exchangeConditionVi",
                        sources.get("exchangeCondition") or attrs.get("exchangeCondition"),
                        acquisition_context,
                    )
                else:
                    add(
                        entity_id,
                        "lookup.exchangeConditionVi",
                        attrs.get("exchangeCondition"),
                        acquisition_context,
                    )

    general_by_source = {record["sourceId"]: record for record in source_docs["generals"]["records"]}
    for source_id, (usage, origin_id) in published_usage.items():
        context = record_context(general_by_source[origin_id], "guide.usage")
        if origin_id != source_id:
            context = {**context, "publishedOn": source_id}
        add(source_owner[f"generals:{source_id}"], "lookup.usageVi", usage, context)

    tactic_record_by_owner = {
        source_owner[f"tactics:{record['sourceId']}"]: record
        for record in source_docs["tactics"]["records"]
    }
    for entity_id, baseline in baseline_tactic_by_owner.items():
        record = tactic_record_by_owner.get(entity_id)
        attrs = record["attributes"] if record else {}
        context_record = record or {"attributes": {}, "sourceSeason": None}
        if attrs.get("effectText") in MISSING_TEXT or not attrs.get("effectText"):
            add(
                entity_id,
                "effectViet",
                baseline.get("effect"),
                {**record_context(context_record, "baseline.effect"), "chosenInput": "local-baseline"},
            )
        if attrs.get("effectTarget") is None:
            add(
                entity_id,
                "targetViet",
                baseline.get("target"),
                {**record_context(context_record, "baseline.target"), "chosenInput": "local-baseline"},
            )
    for group in SOURCE_GROUPS:
        records = source_docs[group]["records"] + source_docs[group].get("children", [])
        for record in records:
            season = record.get("sourceSeason")
            if not isinstance(season, dict) or not season.get("scenarioName"):
                continue
            is_special = group == "equipment" and record in source_docs[group].get("children", [])
            category = "equipment-special" if is_special else group
            entity_id = source_owner[f"{category}:{record['sourceId']}"]
            add(
                entity_id,
                "conditions.scenarioVi",
                season["scenarioName"],
                record_context(record, "sourceSeason.scenarioName"),
            )

    for record in source_docs["equipment"]["children"]:
        entity_id = source_owner[f"equipment-special:{record['sourceId']}"]
        context = record_context(record, "equipment-special")
        add(entity_id, "descriptionVi", record["attributes"].get("description"), context)
        add(entity_id, "acquisitionVi", record["attributes"].get("acquisitionSources"), context)
    for record in source_docs["advisors"]["records"]:
        entity_id = source_owner[f"advisors:{record['sourceId']}"]
        context = record_context(record, "advisor")
        add(entity_id, "effectVi", record["attributes"].get("effectText"), context)
        add(entity_id, "usageVi", record["attributes"].get("description"), context)
    for record in source_docs["troop-mods"]["records"]:
        entity_id = source_owner[f"troop-mods:{record['sourceId']}"]
        attrs = record["attributes"]
        context = record_context(record, "troop-mod")
        add(entity_id, "effectVi", attrs.get("effectText"), context)
        add(entity_id, "appliesToVi", attrs.get("appliesTo"), context)
        add(entity_id, "suggestedBuildVi", attrs.get("suggestedBuild"), context)
        for index, option in enumerate(attrs.get("options", [])):
            child_id = child_ids[(record["sourceId"], "troop-option", str(index))]
            add(child_id, "nameVi", option.get("traitName"), context)
            add(child_id, "descriptionVi", option.get("description"), context)
    for record in source_docs["buildings"]["records"]:
        entity_id = source_owner[f"buildings:{record['sourceId']}"]
        attrs = record["attributes"]
        context = record_context(record, "building")
        add(entity_id, "summaryVi", attrs.get("summary"), context)
        for level in attrs.get("levels", []):
            child_id = child_ids[(record["sourceId"], "building-level", str(level["level"]))]
            add(child_id, "durationVi", level.get("duration"), context)
            add(child_id, "effectVi", level.get("effect"), context)
    return specs


def _lookup_maps(identity, mapping):
    source_owner = {}
    for row in mapping["mappings"]:
        kind = "hero" if row["category"] == "generals" else "tactic"
        source_owner[f"{row['category']}:{row['sourceId']}"] = canonical_id(kind, row["canonicalName"])
    decision_by_owner = {}
    decision_by_source = {}
    for row in identity["decisions"]:
        key = f"{row['category']}:{row['sourceId']}"
        decision_by_source[key] = row
        if row["canonicalId"] is not None:
            source_owner[key] = row["canonicalId"]
            decision_by_owner[row["canonicalId"]] = row
    return source_owner, decision_by_owner, decision_by_source, {}


def _child_id_map(identity, source_docs, source_owner):
    rows = {}
    by_parent = {row["parentId"]: row for row in identity["childIds"]}
    del by_parent
    for record in source_docs["troop-mods"]["records"]:
        parent_id = source_owner[f"troop-mods:{record['sourceId']}"]
        matches = [row for row in identity["childIds"] if row["parentId"] == parent_id and row["kind"] == "troop-option"]
        by_key = {row["inputKey"]: row["id"] for row in matches}
        for index, option in enumerate(record["attributes"].get("options", [])):
            input_key = "|".join([
                str(option.get("tier") or ""),
                str(option.get("traitName") or ""),
                str(option.get("convertsTo") or ""),
            ])
            rows[(record["sourceId"], "troop-option", str(index))] = by_key[input_key]
    for record in source_docs["buildings"]["records"]:
        parent_id = source_owner[f"buildings:{record['sourceId']}"]
        matches = [row for row in identity["childIds"] if row["parentId"] == parent_id and row["kind"] == "building-level"]
        by_key = {row["inputKey"]: row["id"] for row in matches}
        for level in record["attributes"].get("levels", []):
            key = str(level["level"])
            rows[(record["sourceId"], "building-level", key)] = by_key[key]
    return rows


def _common(record, owner, decision, translated):
    return {
        "id": owner,
        "nameVi": decision["nameVi"],
        "aliasesVi": decision["aliasesVi"],
        "aliasesZh": decision["aliasesZh"],
        "conditions": _conditions(record, translated, owner),
        "missingFields": list(record.get("missingFields", [])),
    }


def _number_or_none(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"expected finite number, got {value!r}")
    return value

def _resolved_source_value_corrections(source_docs, source_owner):
    # Đối chiếu từng hiệu chỉnh với bản capture trước khi dựng spec dịch, để lỗi stale/owner
    # được báo đúng nguyên nhân thay vì bị che bởi lỗi fingerprint dịch.
    for key, correction in SOURCE_VALUE_CORRECTIONS.items():
        group, source_id, field = key
        record = next((row for row in source_docs[group]["records"] if row["sourceId"] == source_id), None)
        if record is None:
            raise ValueError(f"source value correction has no captured record: {key}")
        owner = source_owner.get(f"{group}:{source_id}")
        if owner != correction["entityId"]:
            raise ValueError(f"source value correction owner mismatch: {key} resolves to {owner!r}, expected {correction['entityId']!r}")
        raw = record.get("attributes", {}).get(field)
        if canonical_json_bytes(raw) != canonical_json_bytes(correction["raw"]):
            raise ValueError(f"stale source value correction: {key} captured {raw!r}, reviewed raw {correction['raw']!r}")
    return SOURCE_VALUE_CORRECTIONS


def _adopted_number(corrections, consumed, group, record, field):
    # Tra cứu thuần: trả giá trị đã hiệu chỉnh nếu có, không đụng tới record gốc.
    key = (group, record["sourceId"], field)
    if key in corrections:
        consumed.add(key)
        return _number_or_none(corrections[key]["published"])
    return _number_or_none(record["attributes"].get(field))


def _enum(table, value, field):
    if value is None:
        return None
    if value not in table:
        raise ValueError(f"unknown nonempty enum {field}: {value}")
    return table[value]


def _published_usage(guide_by_source):
    """`{sourceId: (usage, originSourceId)}` after moving SP-misattached advice to its base hero."""
    published = {source_id: (row["usage"], source_id) for source_id, row in guide_by_source.items() if row["usage"]}
    for source_id, (target_id, reviewed_usage) in USAGE_REASSIGNMENTS.items():
        source = guide_by_source.get(source_id)
        target = guide_by_source.get(target_id)
        if source is None or target is None or source["usage"] != reviewed_usage:
            raise ValueError(f"stale usage reassignment: {source_id} -> {target_id}")
        if target["usage"] is not None:
            raise ValueError(f"usage reassignment target already has its own advice: {target_id}")
        del published[source_id]
        published[target_id] = (reviewed_usage, source_id)
    return published


def _public_card_packs(guide_doc):
    """Pack table keyed by source pack ID, with the reviewed Vietnamese pack and category names."""
    return {
        pack["id"]: {
            "packVi": _enum(CARD_PACKS, pack["nameZh"], "card pack"),
            "packZh": pack["nameZh"],
            "categoryVi": _enum(CARD_PACK_CATEGORIES, pack["category"], "card pack category"),
            "categoryZh": pack["category"],
            "coreRate": _number_or_none(pack["coreRate"]),
            "nonCoreRate": _number_or_none(pack["nonCoreRate"]),
        }
        for pack in guide_doc["cardPacks"]
    }


def _captured(inputs, source, identity, translations, client_heroes, client_tactics):
    baseline = _capture_dir(inputs, ("heroes-dict.json", "tactics.json", "manifest.json"))
    source_bytes = _capture_dir(source, tuple(f"{name}.json" for name in SOURCE_GROUPS) + ("manifest.json",))
    identity_bytes = _capture_file(identity)
    translation_bytes = _capture_file(translations)
    client_bytes = _capture_file(client_heroes)
    client_tactic_bytes = _capture_file(client_tactics)
    mapping_path, guide_path = _sibling_inputs(identity)
    mapping_bytes = _capture_file(mapping_path)
    guide_bytes = _capture_file(guide_path)
    baseline_manifest = _json(baseline["manifest.json"])
    for name in ("heroes-dict.json", "tactics.json"):
        if _sha(baseline[name]) != baseline_manifest["files"][name]:
            raise ValueError(f"frozen baseline hash changed: {name}")
    source_manifest = _json(source_bytes["manifest.json"])
    for group in SOURCE_GROUPS:
        if _sha(source_bytes[f"{group}.json"]) != source_manifest["files"][group]:
            raise ValueError(f"captured source hash changed: {group}")
    identity_doc = _json(identity_bytes)
    if identity_doc["baselineManifestHash"] != _sha(baseline["manifest.json"]):
        raise ValueError("identity does not bind captured baseline")
    if identity_doc["sourceManifestHash"] != _sha(source_bytes["manifest.json"]):
        raise ValueError("identity does not bind captured source manifest")
    if identity_doc["existingMap"]["sha256"] != _sha(mapping_bytes):
        raise ValueError("identity does not bind captured legacy map")
    validate_guide_document(_json(guide_bytes), source_bytes["manifest.json"], _json(source_bytes["generals.json"]))
    return {
        "baseline": baseline,
        "source": source_bytes,
        "identity": identity_bytes,
        "translations": translation_bytes,
        "mapping": mapping_bytes,
        "guide": guide_bytes,
        "clientHeroes": client_bytes,
        "clientTactics": client_tactic_bytes,
    }


def _captured_inventory(baseline_heroes, baseline_tactics, source_docs):
    parents = []
    children = []
    for category in SOURCE_GROUPS:
        document = source_docs[category]
        category_parents = [_source_row(category, record) for record in document["records"]]
        parents.extend(category_parents)
        if category == "equipment":
            parent_by_source = {row["sourceId"]: row for row in category_parents}
            for child in document["children"]:
                parent = parent_by_source.get(child.get("parentSourceId"))
                if parent is None:
                    parent = {"sourceId": child.get("parentSourceId") or "unresolved"}
                children.append(_child_row(parent, "equipment-special", child["sourceId"], child))
        elif category == "troop-mods":
            for parent in category_parents:
                for option in parent["record"]["attributes"]["options"]:
                    input_key = "|".join(
                        str(option.get(field) or "") for field in ("tier", "traitName", "convertsTo")
                    )
                    children.append(_child_row(parent, "troop-option", input_key, option))
        elif category == "buildings":
            for parent in category_parents:
                for level in parent["record"]["attributes"]["levels"]:
                    children.append(_child_row(parent, "building-level", str(level["level"]), level))
    local = []
    for kind, records in (("hero", baseline_heroes), ("tactic", baseline_tactics)):
        for record in records:
            local.append({
                "key": f"{kind}:{_slug(record['viet'])}",
                "kind": kind,
                "nameVi": record["viet"],
                "fingerprint": _fingerprint({"kind": kind, "record": record}),
                "record": record,
            })
    return {"parents": parents, "children": children, "local": local}




def _translation_binding(group, record, path, owner, child_ids, is_child=False):
    if group == "equipment" and is_child:
        target = {
            "attributes.description": "descriptionVi",
            "attributes.acquisitionSources": "acquisitionVi",
        }.get(path)
        if target:
            return owner, target
        if path.startswith("attributes.acquisitionSources["):
            return owner, "acquisitionVi"
    if group == "generals" and path.startswith("attributes.redRules."):
        return owner, "lookup.redRulesVi"
    if group == "tactics":
        if path == "attributes.sources.eventName" or path.startswith("attributes.sources["):
            return owner, "lookup.acquiredFromVi"
        if path == "attributes.sources.exchangeCondition":
            return owner, "lookup.exchangeConditionVi"
    target = _ROOT_TRANSLATION_FIELDS.get(group, {}).get(path)
    if target:
        return owner, target
    if group == "troop-mods":
        match = re.fullmatch(r"attributes\.options\[(\d+)\]\.(traitName|description)", path)
        if match:
            index = int(match.group(1))
            child_id = child_ids[(record["sourceId"], "troop-option", str(index))]
            return child_id, "nameVi" if match.group(2) == "traitName" else "descriptionVi"
    if group == "buildings":
        match = re.fullmatch(r"attributes\.levels\[(\d+)\]\.(duration|effect)", path)
        if match:
            level = record["attributes"]["levels"][int(match.group(1))]
            child_id = child_ids[(record["sourceId"], "building-level", str(level["level"]))]
            return child_id, f"{match.group(2)}Vi"
    return None


def _is_typed_public_source(group, path):
    public_roots = {
        "generals": {
            "attributes.faction", "attributes.stars", "attributes.cost", "attributes.baseForce",
            "attributes.baseWisdom", "attributes.baseCommand", "attributes.baseSpeed",
            "attributes.basePolitics", "attributes.baseCharm", "attributes.adaptCavalry",
            "attributes.adaptShield", "attributes.adaptBow", "attributes.adaptSpear",
            "attributes.adaptSiege", "attributes.adaptInfantry", "attributes.adaptNavy",
            "attributes.innateTacticId", "attributes.inheritedTacticName", "attributes.advisorSkillId",
            "attributes.variant", "attributes.growForce", "attributes.growWisdom",
            "attributes.growCommand", "attributes.growSpeed", "attributes.growPolitics",
            "attributes.growCharm", "attributes.civilInnatePoints", "attributes.isCollectible",
            "attributes.isDynamicOpen", "attributes.isMusou", "attributes.isCO", "attributes.isSp",
        },
        "tactics": {
            "attributes.kind", "attributes.quality", "attributes.effectText",
            "attributes.effectTarget", "attributes.source", "attributes.activationRate",
            "attributes.cooldown", "attributes.maxUsers", "attributes.pointCost",
            "attributes.troopLimit", "attributes.sources", "attributes.conflictsWith",
        },
        "equipment": {"attributes.quality", "attributes.slot", "attributes.tier"},
        "advisors": {"attributes.element", "attributes.tacticPoints", "attributes.generals"},
        "troop-mods": {"attributes.troopLimit"},
        "buildings": {"attributes.mainCityOnly", "attributes.maxLevel"},
    }
    if path in public_roots[group]:
        return True
    return (
        (group == "tactics" and path.startswith("attributes.troopLimit["))
        or (group == "advisors" and path.startswith("attributes.generals["))
        or (group == "troop-mods" and (path.startswith("attributes.troopLimit[") or path.startswith("attributes.options[")))
        or (group == "buildings" and path.startswith("attributes.levels["))
    )


def _mapped_public_disposition(group, path, owner, relations):
    if group != "tactics" or not path.startswith("attributes.inheritedFrom"):
        return None
    match = re.fullmatch(r"attributes\.inheritedFrom\[(\d+)\]", path)
    if match:
        return "mapped-public" if relations.get((owner, f"lookup.inheritedFromIds[{match.group(1)}]")) else None
    if path != "attributes.inheritedFrom":
        return None
    targets = [
        target
        for (relation_owner, field), target in relations.items()
        if relation_owner == owner and field.startswith("lookup.inheritedFromIds[")
    ]
    if targets and all(targets):
        return "mapped-public"
    if any(targets):
        return "partially-mapped-public"
    return None


def _is_meaningful_empty_source(group, path, value):
    if value != []:
        return False
    return (
        (group == "tactics" and path in {"attributes.troopLimit", "attributes.sources", "attributes.conflictsWith", "attributes.inheritedFrom"})
        or (group == "advisors" and path == "attributes.generals")
        or (group == "troop-mods" and path in {"attributes.troopLimit", "attributes.options"})
    )




def _client_portrait(value, owner):
    match = CLIENT_PORTRAIT_PATTERN.fullmatch(value) if isinstance(value, str) else None
    if match is None:
        raise ValueError(f"client portrait path is invalid: {owner}")
    file = PUBLIC_HEROES_DIR / f"{match.group(1)}.webp"
    if file.is_symlink() or not file.is_file():
        raise ValueError(f"client portrait file is missing: {owner}")
    return value


def _client_text(value, owner, field, *, nullable=False, empty=False):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or (not empty and not value.strip()):
        raise ValueError(f"client hero {field} is invalid: {owner}")
    return value


CLIENT_OVERRIDE_KEYS = {"stats", "growth", "troopApt", "cost", "stars", "faction", "roleTag", "roleTagViet"}


def _validate_client_document(document):
    if (
        not isinstance(document, dict)
        or set(document) != {"schemaVersion", "source", "heroes", "portraits", "overrides", "roleTags", "aliases"}
        or type(document["schemaVersion"]) is not int
        or document["schemaVersion"] != 1
        or not isinstance(document["source"], dict)
        or set(document["source"]) != CLIENT_SOURCE_KEYS
        or any(not isinstance(value, str) or not value.strip() for value in document["source"].values())
        or not isinstance(document["heroes"], list)
        or not isinstance(document["portraits"], dict)
        or not isinstance(document["overrides"], dict)
        or not isinstance(document["roleTags"], dict)
        or not isinstance(document["aliases"], dict)
    ):
        raise ValueError("client hero supplement shape is invalid")


def _client_hero(entry):
    if not isinstance(entry, dict) or set(entry) != CLIENT_HERO_KEYS:
        raise ValueError("client hero entry shape is invalid")
    owner = entry["id"]
    viet = _client_text(entry["viet"], owner, "viet")
    if re.search(r"\s*[\(（][^()（）]*[\)）]\s*$", viet):
        # `js/hero-identity.js` bỏ chú thích cuối ngoặc khi lấy canonical ID: tên này sẽ trùng ID với tướng khác ở MCP/Soi đội.
        raise ValueError(f"client hero name must not end with a parenthetical annotation: {owner}")
    if owner != canonical_id("hero", viet):
        raise ValueError(f"client hero id does not match its Vietnamese name: {owner}")
    chinese = _client_text(entry["chinese"], owner, "chinese")
    if not _string_list(entry["aliasesVi"]):
        raise ValueError(f"client hero aliasesVi is invalid: {owner}")
    if entry["faction"] not in set(FACTIONS.values()):
        raise ValueError(f"client hero faction is invalid: {owner}")
    if type(entry["stars"]) is not int or entry["stars"] < 1:
        raise ValueError(f"client hero stars is invalid: {owner}")
    cost = _client_text(entry["cost"], owner, "cost")
    if type(entry["isSP"]) is not bool or entry["variant"] not in {"base", "sp"}:
        raise ValueError(f"client hero isSP or variant is invalid: {owner}")
    stats, growth, aptitudes = entry["stats"], entry["growth"], entry["troopApt"]
    if (
        not isinstance(stats, dict) or set(stats) != set(CLIENT_STAT_KEYS)
        or any(not isinstance(value, str) or not value.strip() for value in stats.values())
        or not isinstance(growth, dict) or set(growth) != set(CLIENT_STAT_KEYS)
        or any(isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) for value in growth.values())
        or not isinstance(aptitudes, dict) or set(aptitudes) != set(CLIENT_APTITUDE_KEYS)
        or any(not isinstance(value, str) or not value.strip() for value in aptitudes.values())
    ):
        raise ValueError(f"client hero stats, growth or troopApt is invalid: {owner}")
    for field in ("roleTag", "roleTagViet", "selfTacticVi"):
        _client_text(entry[field], owner, field, nullable=True)
    if entry["portrait"] is not None:
        _client_portrait(entry["portrait"], owner)
    return owner, viet, chinese, cost


def _apply_client_heroes(document, heroes, tactics, identity):
    """Append the Global-client heroes and fill missing portraits; returns the field ledger rows."""
    _validate_client_document(document)
    taken = {row["id"] for row in heroes} | {row["canonicalId"] for row in identity["decisions"] if str(row.get("canonicalId", "")).startswith("hero:")}
    existing = {row["id"]: row for row in heroes}
    ledger = []

    def record(entity, path, value, reason, *, missing=False, previous=None):
        ledger.append({
            "entityId": entity, "fieldPath": path, "disposition": "missing-source" if missing else "typed-public",
            "chosenInput": "none" if missing else "client-capture", "sourceRecordId": f"client-heroes:{entity.removeprefix('hero:')}",
            "sourceFieldPath": path, "sourceValueHash": _sha(canonical_json_bytes(value)),
            "localValueHash": _sha(canonical_json_bytes(previous)) if previous not in (None, "") else None,
            "reason": reason, "translationInputFingerprint": None,
            "reviewEvidence": ["captured Global client hero supplement", "pipeline/lookup-client-heroes.json"],
        })

    for owner, portrait in sorted(document["portraits"].items()):
        if owner not in existing:
            raise ValueError(f"client portrait targets an unknown hero: {owner}")
        if existing[owner]["iconUrl"] is not None:
            raise ValueError(f"client portrait would override an existing icon: {owner}")
        existing[owner]["iconUrl"] = _client_portrait(portrait, owner)
        record(owner, "clientCapture.portrait", portrait, "Hero had no remote icon; self-hosted client portrait selected.")

    keys = {"stats": CLIENT_STAT_KEYS, "growth": CLIENT_STAT_KEYS, "troopApt": CLIENT_APTITUDE_KEYS}
    for owner, override in sorted(document["overrides"].items()):
        if owner not in existing or not isinstance(override, dict) or not override or not set(override) <= CLIENT_OVERRIDE_KEYS:
            raise ValueError(f"client override is invalid: {owner}")
        row = existing[owner]
        targets = {"stats": row["stats"], "growth": row["lookup"]["growth"], "troopApt": row["troopApt"]}
        if ("roleTag" in override) != ("roleTagViet" in override):
            raise ValueError(f"client override roleTag and roleTagViet must be given together: {owner}")
        if "roleTag" in override:
            pair = {field: override[field] for field in ("roleTag", "roleTagViet")}
            for field, value in pair.items():
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(f"client override value is invalid: {owner}.{field}")
            if all(row[field] == value for field, value in pair.items()):
                raise ValueError(f"client override is a no-op: {owner}.roleTag")
            for field, value in pair.items():
                if row[field] != value:
                    record(owner, f"clientCapture.overrides.{field}", value, "Global client is authoritative; built value replaced.", previous=row[field])
                    row[field] = value
        for section, values in sorted(override.items()):
            if section in ("roleTag", "roleTagViet"):
                continue
            if section in keys:
                if not isinstance(values, dict) or set(values) != set(keys[section]):
                    raise ValueError(f"client override {section} key set is invalid: {owner}")
                for key in keys[section]:
                    value = values[key]
                    if section == "growth":
                        valid = not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)
                    elif section == "troopApt":
                        valid = value in {"S", "A", "B", "C"}
                    else:
                        valid = isinstance(value, str) and bool(value.strip())
                    if not valid:
                        raise ValueError(f"client override value is invalid: {owner}.{section}.{key}")
                changed = [key for key in keys[section] if targets[section][key] != values[key]]
                if not changed:
                    raise ValueError(f"client override is a no-op: {owner}.{section}")
                for key in changed:
                    record(owner, f"clientCapture.overrides.{section}.{key}", values[key], "Global client is authoritative; built value replaced.", previous=targets[section][key])
                    targets[section][key] = values[key]
                continue
            if section == "cost":
                valid = isinstance(values, str) and bool(values.strip())
            elif section == "stars":
                valid = type(values) is int and 1 <= values <= 5
            else:
                valid = values in set(FACTIONS.values())
            if not valid:
                raise ValueError(f"client override value is invalid: {owner}.{section}")
            if row[section] == values:
                raise ValueError(f"client override is a no-op: {owner}.{section}")
            record(owner, f"clientCapture.overrides.{section}", values, "Global client is authoritative; built value replaced.", previous=row[section])
            row[section] = values

    for owner, tags in sorted(document["roleTags"].items()):
        if owner not in existing or not isinstance(tags, dict) or set(tags) != {"roleTag", "roleTagViet"}:
            raise ValueError(f"client roleTags entry is invalid: {owner}")
        for field in ("roleTag", "roleTagViet"):
            _client_text(tags[field], owner, field)
            if existing[owner][field] is not None:
                raise ValueError(f"client roleTags would overwrite an existing tag: {owner}.{field}")
        for field in ("roleTag", "roleTagViet"):
            existing[owner][field] = tags[field]
            record(owner, f"clientCapture.roleTags.{field}", tags[field], "Hero had no role tag; Global client label selected.")

    for owner, names in sorted(document["aliases"].items()):
        if owner not in existing or not _string_list(names) or not names or any(not name.strip() for name in names):
            raise ValueError(f"client aliases entry is invalid: {owner}")
        row = existing[owner]
        for name in names:
            if name == row["viet"] or name in row["aliases"]:
                raise ValueError(f"client alias duplicates an existing name: {owner}: {name}")
            row["aliases"].append(name)
        record(owner, "clientCapture.aliases", names, "Global client spellings appended to aliases.")

    seen = set()
    rows = []
    for entry in document["heroes"]:
        owner, viet, chinese, cost = _client_hero(entry)
        if owner in taken or owner in seen:
            raise ValueError(f"client hero id collides with an existing hero: {owner}")
        seen.add(owner)
        rows.append((owner, viet, chinese, cost, entry))
    tactic_by_name, tactic_by_alias = {}, {}
    for tactic in tactics:
        tactic_by_name.setdefault(tactic["viet"], []).append(tactic["id"])
        for alias in tactic["aliases"]:
            tactic_by_alias.setdefault(alias, set()).add(tactic["id"])
    for owner, viet, chinese, cost, entry in sorted(rows, key=lambda item: item[0]):
        # Tên `viet` khớp trước; không có thì nhận alias trỏ về đúng một chiến pháp (tên client Global được nối làm alias).
        matches = (tactic_by_name.get(entry["selfTacticVi"]) or sorted(tactic_by_alias.get(entry["selfTacticVi"], ()))) if entry["selfTacticVi"] else []
        self_tactic = matches[0] if len(matches) == 1 else None
        missing = list(CLIENT_MISSING_FIELDS)
        if entry["roleTag"] is None:
            missing.append("role")
        if self_tactic is None:
            missing.append("innateTacticId")
        missing.sort()
        heroes.append({
            "id": owner, "chinese": chinese, "hanViet": viet, "viet": viet,
            "aliases": list(dict.fromkeys(entry["aliasesVi"] + [chinese])),
            "faction": entry["faction"], "stars": entry["stars"], "cost": cost,
            "stats": dict(entry["stats"]), "troopApt": dict(entry["troopApt"]),
            "selfTacticCn": None, "inheritTacticCn": None,
            "roleTag": entry["roleTag"], "roleTagViet": entry["roleTagViet"],
            "iconUrl": entry["portrait"], "isSP": entry["isSP"], "linkScore": None, "pending": False,
            "lookup": {
                "conditions": [], "missingFields": missing, "revisions": [], "variant": entry["variant"],
                "selfTacticId": self_tactic, "inheritTacticId": None, "advisorId": None,
                "growth": {key: _number_or_none(entry["growth"][key]) for key in CLIENT_STAT_KEYS},
                "otherAptitudes": {"infantry": None, "navy": None}, "categoryVi": None, "exclusiveTitleVi": None,
                "civil": {"roleVi": None, "bonusVi": None, "specialtyVi": None, "tacticBonusVi": None},
                "civilInnatePoints": None, "collectibleBonusVi": None, "redRulesVi": None,
                "flags": {"isCollectible": None, "isDynamicOpen": None, "isMusou": None, "isCO": None, "isSp": entry["isSP"]},
                "usageVi": None, "usageZh": None, "cardPacks": [],
            },
        })
        for path, value in _flatten(entry, "clientCapture"):
            record(owner, path, value, "Captured Global client value selected for the typed public hero projection.")
        for field in missing:
            record(owner, f"clientCapture.{field}", None, "Global client capture does not provide this field.", missing=True)
    return ledger


def _validate_client_tactics_document(document):
    if (
        not isinstance(document, dict)
        or set(document) != {"schemaVersion", "source", "tactics"}
        or type(document["schemaVersion"]) is not int
        or document["schemaVersion"] != 1
        or not isinstance(document["source"], dict)
        or set(document["source"]) != CLIENT_SOURCE_KEYS
        or any(not isinstance(value, str) or not value.strip() for value in document["source"].values())
        or not isinstance(document["tactics"], dict)
    ):
        raise ValueError("client tactic capture shape is invalid")


def _client_tactic_text(value, owner, field, *, nullable=False):
    if value is None and nullable:
        return None
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"client tactic {field} is invalid: {owner}")
    return value


def _level_numbers(text):
    return sorted(set(re.findall(r"\d+(?:[.,]\d+)?", text.replace(",", "."))))


def _apply_client_effect(row, text):
    """Chữ client là bản hiện hành tiếng Việt. Bản sửa cũ (từ chữ Hán nguồn) giữ làm lịch sử; mốc ngày của bản
    hiện hành cũ chỉ giữ khi số liệu client trùng nó, lệch thì bản đó lùi về lịch sử và client không mang ngày."""
    revisions = row["lookup"]["revisions"]
    current = next((item for item in revisions if item["isCurrent"]), None)
    row["effectViet"] = text
    if current is None or current["textVi"] == text:
        return
    if _level_numbers(current["textVi"]) == _level_numbers(text):
        current["textVi"] = text
        return
    date = current["effectiveDate"]
    current.update({"isCurrent": False, "labelVi": f"Bản {date}" if date else "Bản trước"})
    revisions.insert(0, {"labelVi": "Bản hiện hành", "effectiveDate": None, "textVi": text, "isCurrent": True})


def _apply_client_tactics(document, tactics):
    """Áp số liệu chụp từ mục Chiến Pháp của client Global (nguồn có thẩm quyền cho bản Việt); trả các dòng ledger."""
    _validate_client_tactics_document(document)
    by_id = {row["id"]: row for row in tactics}
    troop_order = list(TROOPS.values())
    ledger = []

    def record(owner, path, value, previous):
        ledger.append({
            "entityId": owner, "fieldPath": path,
            "disposition": "typed-public" if previous in (None, "", []) else "corrected-public",
            "chosenInput": "client-capture", "sourceRecordId": f"client-tactics:{owner.removeprefix('tactic:')}",
            "sourceFieldPath": path, "sourceValueHash": _sha(canonical_json_bytes(value)),
            "localValueHash": None if previous in (None, "", []) else _sha(canonical_json_bytes(previous)),
            "reason": "Global client is authoritative for the Vietnamese edition; built value replaced.",
            "translationInputFingerprint": None,
            "reviewEvidence": ["captured Global client tactic", "pipeline/lookup-client-tactics.json"],
        })

    def assign(owner, target, key, value, path):
        if target[key] != value:
            record(owner, path, value, target[key])
            target[key] = value

    for owner, entry in sorted(document["tactics"].items()):
        if owner not in by_id or not isinstance(entry, dict) or set(entry) != CLIENT_TACTIC_KEYS:
            raise ValueError(f"client tactic entry is invalid: {owner}")
        row, lookup = by_id[owner], by_id[owner]["lookup"]
        name = _client_tactic_text(entry["nameVi"], owner, "nameVi")
        rate, max_users, troops = entry["activationRate"], entry["maxUsers"], entry["troopFit"]
        if (
            entry["quality"] not in {None, "S", "A", "B"}
            or entry["type"] not in CLIENT_TACTIC_TYPES
            or isinstance(rate, bool) or not isinstance(rate, (int, float)) or not 0 < rate <= 1
            or (max_users is not None and (type(max_users) is not int or max_users < 1))
            or not _string_list(troops) or not troops or len(set(troops)) != len(troops)
            or any(value not in troop_order for value in troops)
            or troops != sorted(troops, key=troop_order.index)
        ):
            raise ValueError(f"client tactic value is invalid: {owner}")
        target = _client_tactic_text(entry["targetVi"], owner, "targetVi")
        effect_type = _client_tactic_text(entry["effectTypeVi"], owner, "effectTypeVi")
        effect = _client_tactic_text(entry["effectVi"], owner, "effectVi")
        exchange = _client_tactic_text(entry["exchangeConditionVi"], owner, "exchangeConditionVi", nullable=True)
        if name != row["viet"]:
            # Tên hiển thị theo client; tên cũ giữ ở `hanViet` (Hán-Việt) hoặc thành alias để tra cứu/nối đội cũ vẫn khớp.
            previous = row["viet"]
            record(owner, "clientCapture.nameVi", name, previous)
            row["viet"] = name
            if previous != row["hanViet"] and previous not in row["aliases"]:
                row["aliases"].append(previous)
            if name in row["aliases"]:
                row["aliases"].remove(name)
        if entry["quality"] is not None:
            assign(owner, row, "quality", entry["quality"], "clientCapture.quality")
        assign(owner, row, "type", entry["type"], "clientCapture.type")
        assign(owner, row, "troopFit", list(troops), "clientCapture.troopFit")
        assign(owner, row, "targetViet", target, "clientCapture.targetVi")
        assign(owner, lookup, "activationRate", rate, "clientCapture.activationRate")
        assign(owner, lookup, "effectTypeVi", effect_type, "clientCapture.effectTypeVi")
        if max_users is not None:
            assign(owner, lookup, "maxUsers", max_users, "clientCapture.maxUsers")
        if exchange is not None:
            assign(owner, lookup, "exchangeConditionVi", exchange, "clientCapture.exchangeConditionVi")
        if row["effectViet"] != effect or any(item["isCurrent"] and item["textVi"] != effect for item in lookup["revisions"]):
            record(owner, "clientCapture.effectVi", effect, row["effectViet"])
            _apply_client_effect(row, effect)
        row["pending"] = not bool(row.get("effect") and row["effectViet"])
    return ledger


def _build_model(capture):
    baseline_heroes = _json(capture["baseline"]["heroes-dict.json"])
    baseline_tactics = _json(capture["baseline"]["tactics.json"])
    source_docs = {group: _json(capture["source"][f"{group}.json"]) for group in SOURCE_GROUPS}
    identity = _json(capture["identity"])
    mapping = _json(capture["mapping"])
    translations = _json(capture["translations"])
    guide_doc = _json(capture["guide"])
    guide_by_source = {row["sourceId"]: row for row in guide_doc["generals"]}
    published_usage = _published_usage(guide_by_source)
    source_owner, decision_by_owner, decisions, _unused = _lookup_maps(identity, mapping)
    child_ids = _child_id_map(identity, source_docs, source_owner)
    corrections = _resolved_source_value_corrections(source_docs, source_owner)
    consumed_corrections = set()
    identity_translation_context = _sha(canonical_json_bytes({
        "decisions": [{key: row.get(key) for key in ("canonicalId", "nameVi", "aliasesVi", "aliasesZh", "variant")} for row in identity["decisions"]],
        "relations": [{key: row.get(key) for key in ("ownerId", "fieldPath", "targetId")} for row in identity["relationDecisions"]],
        "childIds": [{key: row.get(key) for key in ("id", "parentId", "kind", "inputKey")} for row in identity["childIds"]],
    }))
    specs = _translation_specs(source_docs, source_owner, child_ids, translations["glossaryVersion"], baseline_heroes, baseline_tactics, identity_translation_context, published_usage)
    legacy_owners = {
        f"{row['category']}:{row['sourceId']}": canonical_id(
            "hero" if row["category"] == "generals" else "tactic",
            row["canonicalName"],
        )
        for row in mapping["mappings"]
    }
    validate_registry(
        identity,
        _captured_inventory(baseline_heroes, baseline_tactics, source_docs),
        expected_hashes={
            "baseline": _sha(capture["baseline"]["manifest.json"]),
            "source": _sha(capture["source"]["manifest.json"]),
            "mapping": _sha(capture["mapping"]),
        },
        legacy_source_keys=legacy_owners,
    )
    validate_translation_entries(translations, specs)
    translated = {(row["entityId"], row["fieldPath"]): row["textVi"] for row in translations["entries"]}
    relations = {(row["ownerId"], row["fieldPath"]): row["targetId"] for row in identity["relationDecisions"]}

    old_heroes = {canonical_id("hero", row.get("viet") or row["hanViet"]): row for row in baseline_heroes}
    old_tactics = {canonical_id("tactic", row.get("viet") or row["hanViet"]): row for row in baseline_tactics}
    hero_sources = {source_owner[f"generals:{row['sourceId']}"]: row for row in source_docs["generals"]["records"]}
    tactic_sources = {source_owner[f"tactics:{row['sourceId']}"]: row for row in source_docs["tactics"]["records"]}

    card_packs = _public_card_packs(guide_doc)
    heroes = []
    for owner in list(old_heroes) + sorted(set(hero_sources) - set(old_heroes)):
        source = hero_sources.get(owner)
        if source is None:
            row = dict(old_heroes[owner])
            row["id"] = owner
            row["lookup"] = {"conditions": [], "missingFields": [], "revisions": [], "variant": "base", "selfTacticId": None, "inheritTacticId": None, "advisorId": None, "growth": {key: None for key in ("luc", "tri", "thong", "toc", "chinh", "mi")}, "otherAptitudes": {"infantry": None, "navy": None}, "categoryVi": None, "exclusiveTitleVi": None, "civil": {"roleVi": None, "bonusVi": None, "specialtyVi": None, "tacticBonusVi": None}, "civilInnatePoints": None, "collectibleBonusVi": None, "redRulesVi": None, "flags": {key: None for key in ("isCollectible", "isDynamicOpen", "isMusou", "isCO", "isSp")}, "usageVi": None, "usageZh": None, "cardPacks": []}
            heroes.append(row)
            continue
        attrs = source["attributes"]
        decision = decisions.get(f"generals:{source['sourceId']}") or {"nameVi": old_heroes[owner].get("viet"), "aliasesVi": [], "aliasesZh": [source["nameZh"]], "variant": attrs.get("variant") or "base"}
        row = dict(old_heroes.get(owner, {}))
        name_vi = row.get("viet") or decision["nameVi"]
        old_stats = row.get("stats", {})
        old_aptitudes = row.get("troopApt", {})
        def stat(source_field, output_field):
            value = attrs.get(source_field)
            return str(value) if value is not None else old_stats.get(output_field, "")
        def aptitude(source_field, output_field):
            value = attrs.get(source_field)
            return value if value not in (None, "") else old_aptitudes.get(output_field)
        row.update({
            "id": owner, "chinese": source["nameZh"], "hanViet": name_vi, "viet": name_vi,
            "aliases": list(dict.fromkeys(row.get("aliases", []) + decision.get("aliasesVi", []) + decision.get("aliasesZh", []))),
            "faction": _enum(FACTIONS, attrs.get("faction"), "general.faction"), "stars": attrs.get("stars"),
            "cost": str(attrs["cost"]) if attrs.get("cost") is not None else row.get("cost"),
            "stats": {"luc": stat("baseForce", "luc"), "tri": stat("baseWisdom", "tri"), "thong": stat("baseCommand", "thong"), "toc": stat("baseSpeed", "toc"), "chinh": stat("basePolitics", "chinh"), "mi": stat("baseCharm", "mi")},
            "troopApt": {"ky": aptitude("adaptCavalry", "ky"), "thuan": aptitude("adaptShield", "thuan"), "cung": aptitude("adaptBow", "cung"), "thuong": aptitude("adaptSpear", "thuong"), "khiGioi": aptitude("adaptSiege", "khiGioi")},
            "selfTacticCn": row.get("selfTacticCn"), "inheritTacticCn": attrs.get("inheritedTacticName") or row.get("inheritTacticCn"),
            "roleTag": attrs.get("role") or row.get("roleTag"), "roleTagViet": translated.get((owner, "roleTagViet")) or row.get("roleTagViet"),
            "iconUrl": row.get("iconUrl"), "isSP": row.get("isSP", bool(attrs.get("isSp"))), "linkScore": row.get("linkScore"), "pending": False,
        })
        direct_tactic = source_owner.get(f"tactics:{attrs.get('innateTacticId')}")
        direct_advisor = source_owner.get(f"advisors:{attrs.get('advisorSkillId')}")
        row["lookup"] = {
            "conditions": _conditions(source, translated, owner), "missingFields": list(source.get("missingFields", [])), "revisions": [],
            "variant": decision.get("variant") or attrs.get("variant") or "base",
            "selfTacticId": direct_tactic, "inheritTacticId": relations.get((owner, "lookup.inheritTacticId")), "advisorId": direct_advisor,
            "growth": {"luc": _number_or_none(attrs.get("growForce")), "tri": _number_or_none(attrs.get("growWisdom")), "thong": _number_or_none(attrs.get("growCommand")), "toc": _number_or_none(attrs.get("growSpeed")), "chinh": _number_or_none(attrs.get("growPolitics")), "mi": _number_or_none(attrs.get("growCharm"))},
            "otherAptitudes": {"infantry": attrs.get("adaptInfantry"), "navy": attrs.get("adaptNavy")},
            "categoryVi": translated.get((owner, "lookup.categoryVi")), "exclusiveTitleVi": translated.get((owner, "lookup.exclusiveTitleVi")),
            "civil": {"roleVi": translated.get((owner, "lookup.civil.roleVi")), "bonusVi": translated.get((owner, "lookup.civil.bonusVi")), "specialtyVi": translated.get((owner, "lookup.civil.specialtyVi")), "tacticBonusVi": translated.get((owner, "lookup.civil.tacticBonusVi"))},
            "civilInnatePoints": _number_or_none(attrs.get("civilInnatePoints")), "collectibleBonusVi": translated.get((owner, "lookup.collectibleBonusVi")), "redRulesVi": translated.get((owner, "lookup.redRulesVi")),
            "flags": {"isCollectible": attrs.get("isCollectible"), "isDynamicOpen": attrs.get("isDynamicOpen"), "isMusou": attrs.get("isMusou"), "isCO": attrs.get("isCO"), "isSp": attrs.get("isSp")},
            "usageVi": translated.get((owner, "lookup.usageVi")), "usageZh": published_usage.get(source["sourceId"], (None, None))[0],
            "cardPacks": [{**card_packs[pack["packId"]], "isCore": pack["tier"] == "core"} for pack in guide_by_source[source["sourceId"]]["cardPacks"]],
        }
        heroes.append(row)

    tactics = []
    for owner in list(old_tactics) + sorted(set(tactic_sources) - set(old_tactics)):
        source = tactic_sources.get(owner)
        if source is None:
            row = dict(old_tactics[owner]); row["id"] = owner
            row.setdefault("aliases", [])
            row["effectViet"] = translated.get((owner, "effectViet")) or row.get("effectViet")
            row["targetViet"] = translated.get((owner, "targetViet")) or row.get("targetViet")
            row["pending"] = not bool(row.get("effect") and row.get("effectViet"))
            row["lookup"] = {"conditions": [], "missingFields": [], "revisions": [], "activationRate": None, "cooldown": None, "maxUsers": None, "pointCost": None, "effectTypeVi": None, "exchangeConditionVi": None, "acquiredFromVi": [], "inheritedFromIds": [], "conflictsVi": None}
            tactics.append(row)
            continue
        attrs = source["attributes"]
        decision = decisions.get(f"tactics:{source['sourceId']}") or {"nameVi": old_tactics[owner].get("viet"), "aliasesVi": [], "aliasesZh": [source["nameZh"]]}
        row = dict(old_tactics.get(owner, {}))
        name_vi = row.get("viet") or decision["nameVi"]
        sources = attrs.get("sources")
        acquired = translated.get((owner, "lookup.acquiredFromVi"))
        acquired_rows = [part.strip() for part in acquired.split(";") if part.strip()] if isinstance(sources, list) and acquired else ([acquired] if acquired else [])
        effect_vi = translated.get((owner, "effectViet")) or row.get("effectViet")
        inherited = [target for (relation_owner, field), target in relations.items() if relation_owner == owner and field.startswith("lookup.inheritedFromIds[") and target]
        source_effect = attrs.get("effectText")
        usable_source_effect = source_effect if source_effect not in MISSING_TEXT else None
        effect = usable_source_effect or row.get("effect")
        row.update({"id": owner, "chinese": source["nameZh"], "hanViet": name_vi, "viet": name_vi,
            "aliases": list(dict.fromkeys(row.get("aliases", []) + decision.get("aliasesVi", []) + decision.get("aliasesZh", []))),
            "type": attrs.get("kind"), "quality": attrs.get("quality"), "effect": effect, "effectViet": effect_vi,
            "target": attrs.get("effectTarget") if attrs.get("effectTarget") is not None else row.get("target"), "targetViet": translated.get((owner, "targetViet")) or row.get("targetViet"), "troopFit": [_enum(TROOPS, value, "tactic.troopLimit") for value in attrs.get("troopLimit", [])],
            "source": attrs.get("source"), "sourceHeroCn": row.get("sourceHeroCn"), "iconUrl": row.get("iconUrl"), "linkScore": row.get("linkScore"), "pending": not bool(effect and effect_vi),
            "lookup": {"conditions": _conditions(source, translated, owner), "missingFields": list(source.get("missingFields", [])), "revisions": _revisions(usable_source_effect, effect_vi), "activationRate": _adopted_number(corrections, consumed_corrections, "tactics", source, "activationRate"), "cooldown": _number_or_none(attrs.get("cooldown")), "maxUsers": _number_or_none(attrs.get("maxUsers")), "pointCost": _number_or_none(attrs.get("pointCost")), "effectTypeVi": translated.get((owner, "lookup.effectTypeVi")), "exchangeConditionVi": translated.get((owner, "lookup.exchangeConditionVi")), "acquiredFromVi": acquired_rows, "inheritedFromIds": inherited, "conflictsVi": translated.get((owner, "lookup.conflictsVi"))}})
        tactics.append(row)
    # Mục hiệu chỉnh không được tiêu thụ là mục mồ côi: build phải dừng để review lại bảng.
    orphaned_corrections = set(corrections) - consumed_corrections
    if orphaned_corrections:
        raise ValueError(f"orphaned source value corrections: {sorted(orphaned_corrections)}")
    client_ledger = _apply_client_tactics(_json(capture["clientTactics"]), tactics)
    client_ledger += _apply_client_heroes(_json(capture["clientHeroes"]), heroes, tactics, identity)

    equipment = []
    for record in source_docs["equipment"]["records"]:
        owner = source_owner[f"equipment:{record['sourceId']}"]; decision = decisions[f"equipment:{record['sourceId']}"]
        attrs = record["attributes"]
        equipment.append({**_common(record, owner, decision, translated), "qualityVi": _enum(QUALITY, attrs.get("quality"), "equipment.quality"), "slotVi": _enum(SLOTS, attrs.get("slot"), "equipment.slot")})
    specials = []
    for record in source_docs["equipment"]["children"]:
        owner = source_owner[f"equipment-special:{record['sourceId']}"]; decision = decisions[f"equipment-special:{record['sourceId']}"]; attrs = record["attributes"]
        parent_source = record.get("parentSourceId")
        equipment_id = source_owner.get(f"equipment:{parent_source}") if parent_source else relations.get((owner, "equipmentId"))
        specials.append({**_common(record, owner, decision, translated), "tierVi": _enum(TIERS, attrs.get("tier"), "special.tier"), "slotVi": _enum(SLOTS, attrs.get("slot"), "special.slot"), "descriptionVi": translated.get((owner, "descriptionVi")), "acquisitionVi": [part.strip() for part in translated.get((owner, "acquisitionVi"), "").split(";") if part.strip()], "equipmentId": equipment_id, "exclusiveHeroId": relations.get((owner, "exclusiveHeroId"))})
    advisors = []
    for record in source_docs["advisors"]["records"]:
        owner = source_owner[f"advisors:{record['sourceId']}"]; decision = decisions[f"advisors:{record['sourceId']}"]; attrs = record["attributes"]
        hero_ids = [source_owner[f"generals:{item['id']}"] for item in attrs.get("generals", []) if f"generals:{item['id']}" in source_owner]
        advisors.append({**_common(record, owner, decision, translated), "elementVi": _enum(ELEMENTS, attrs.get("element"), "advisor.element"), "effectVi": translated.get((owner, "effectVi")), "usageVi": translated.get((owner, "usageVi")), "tacticPoints": _number_or_none(attrs.get("tacticPoints")), "heroIds": hero_ids})
    troop_mods = []
    for record in source_docs["troop-mods"]["records"]:
        owner = source_owner[f"troop-mods:{record['sourceId']}"]
        decision = decisions[f"troop-mods:{record['sourceId']}"]
        attrs = record["attributes"]
        options = []
        for index, option in enumerate(attrs.get("options", [])):
            child_id = child_ids[(record["sourceId"], "troop-option", str(index))]
            options.append({"id": child_id, "tierVi": _enum(TIERS, option["tier"], "troop-option.tier"), "nameVi": translated[(child_id, "nameVi")], "descriptionVi": translated.get((child_id, "descriptionVi")), "convertsToVi": _enum(TROOPS, option.get("convertsTo"), "troop-option.convertsTo")})
        troop_mods.append({**_common(record, owner, decision, translated), "effectVi": translated.get((owner, "effectVi")), "appliesToVi": translated.get((owner, "appliesToVi")), "suggestedBuildVi": translated.get((owner, "suggestedBuildVi")), "troopLimitVi": [_enum(TROOPS, value, "troop-mod.troopLimit") for value in attrs.get("troopLimit", [])], "revisions": _revisions(attrs.get("effectText"), translated.get((owner, "effectVi"))), "options": options})
    buildings = []
    for record in source_docs["buildings"]["records"]:
        owner = source_owner[f"buildings:{record['sourceId']}"]; decision = decisions[f"buildings:{record['sourceId']}"]; attrs = record["attributes"]
        levels = []
        for level in attrs.get("levels", []):
            child_id = child_ids[(record["sourceId"], "building-level", str(level["level"]))]
            costs = level.get("costs") or {}
            levels.append({"id": child_id, "level": level["level"], "costs": {name: _number_or_none(costs.get(name)) for name in ("wood", "iron", "stone")}, "durationVi": translated.get((child_id, "durationVi")), "effectVi": translated.get((child_id, "effectVi"))})
        buildings.append({**_common(record, owner, decision, translated), "summaryVi": translated.get((owner, "summaryVi")), "mainCityOnly": attrs.get("mainCityOnly"), "maxLevel": attrs.get("maxLevel"), "levels": levels})

    ledger = []
    for group in SOURCE_GROUPS:
        child_records = source_docs[group].get("children", [])
        for record in source_docs[group]["records"] + child_records:
            is_child = any(record is child for child in child_records)
            category = "equipment-special" if group == "equipment" and is_child else group
            owner = source_owner[f"{category}:{record['sourceId']}"]
            for path, value in _flatten(record.get("attributes", {})):
                translation_key = _translation_binding(group, record, path, owner, child_ids, is_child)
                source_missing = (
                    value is None
                    or value == ""
                    or (value == [] and not _is_meaningful_empty_source(group, path, value))
                    or (isinstance(value, str) and value in MISSING_TEXT)
                )
                translation_fingerprint_value = specs.get(translation_key) if translation_key and not source_missing else None
                fallback_value = None
                correction = None if is_child else corrections.get((group, record["sourceId"], path.removeprefix("attributes.")))
                mapped_disposition = _mapped_public_disposition(group, path, owner, relations)
                if source_missing and group == "generals" and path == "attributes.role":
                    fallback_value = old_heroes.get(owner, {}).get("roleTag")
                elif source_missing and group == "tactics" and path == "attributes.effectText":
                    fallback_value = old_tactics.get(owner, {}).get("effect")
                elif source_missing and group == "tactics" and path == "attributes.effectTarget":
                    fallback_value = old_tactics.get(owner, {}).get("target")
                if correction is not None:
                    disposition, chosen_input = "corrected-public", "source"
                    reason = correction["reason"]
                elif translation_fingerprint_value:
                    disposition, chosen_input = "translated-public", "source"
                    reason = "Captured source value selected and bound to reviewed Vietnamese output."
                elif fallback_value is not None:
                    disposition, chosen_input = "fallback-public", "local-baseline"
                    reason = "Missing source value rejected; frozen local fallback selected."
                elif source_missing:
                    disposition, chosen_input = "missing-source", "none"
                    reason = "Source explicitly missing and no local fallback exists."
                elif mapped_disposition:
                    disposition, chosen_input = mapped_disposition, "source"
                    reason = "Captured relationship selected and mapped to reviewed public canonical IDs." if mapped_disposition == "mapped-public" else "Captured relationship was partially mapped; unresolved targets remain private evidence."
                elif _is_typed_public_source(group, path) or _is_meaningful_empty_source(group, path, value):
                    disposition, chosen_input = "typed-public", "source"
                    reason = "Captured source value selected for an explicit typed public destination."
                else:
                    disposition, chosen_input = "private-evidence", "source"
                    reason = "Captured source value intentionally omitted from the public DTO."
                local_value = correction["published"] if correction is not None else fallback_value
                ledger.append({"entityId": owner, "fieldPath": path, "disposition": disposition, "chosenInput": chosen_input, "sourceRecordId": record["sourceId"], "sourceFieldPath": path, "sourceValueHash": _sha(canonical_json_bytes(value)), "localValueHash": _sha(canonical_json_bytes(local_value)) if local_value is not None else None, "reason": reason, "translationInputFingerprint": translation_fingerprint_value, "reviewEvidence": ["captured source manifest", "private identity/translation ledgers"]})
            for path, value in _flatten({key: value for key, value in record.items() if key != "attributes"}, "sourceRecord"):
                translation_key = (owner, "conditions.scenarioVi") if path == "sourceRecord.sourceSeason.scenarioName" else None
                ledger.append({"entityId": owner, "fieldPath": path, "disposition": "translated-public" if translation_key else "private-evidence", "chosenInput": "source", "sourceRecordId": record["sourceId"], "sourceFieldPath": path, "sourceValueHash": _sha(canonical_json_bytes(value)), "localValueHash": None, "reason": "Scenario condition translated for public display." if translation_key else "Provider/top-level source value retained only in private evidence.", "translationInputFingerprint": specs.get(translation_key) if translation_key else None, "reviewEvidence": ["captured source manifest", "private identity/translation ledgers"]})
    reassigned_to = {source_id: target_id for source_id, (target_id, _usage) in USAGE_REASSIGNMENTS.items()}
    reassigned_from = {target_id: source_id for source_id, target_id in reassigned_to.items()}
    for record in source_docs["generals"]["records"]:
        owner = source_owner[f"generals:{record['sourceId']}"]
        guide = guide_by_source[record["sourceId"]]
        for path, value in _flatten({"usage": guide["usage"], "cardPacks": guide["cardPacks"]}, "guide"):
            fingerprint = specs.get((owner, "lookup.usageVi")) if path == "guide.usage" else None
            local_value = None
            if path == "guide.usage" and record["sourceId"] in reassigned_to:
                target_owner = source_owner[f"generals:{reassigned_to[record['sourceId']]}"]
                fingerprint = specs[(target_owner, "lookup.usageVi")]
                disposition, reason = "corrected-public", f"Source attached the base hero's advice to this SP record; published on {target_owner}."
            elif path == "guide.usage" and record["sourceId"] in reassigned_from:
                local_value = published_usage[record["sourceId"]][0]
                disposition, reason = "corrected-public", f"Advice captured on SP record {reassigned_from[record['sourceId']]} belongs to this base hero."
            elif value is None or value == []:
                disposition, reason = "missing-source", "Source guide has no value for this general."
            elif fingerprint:
                disposition, reason = "translated-public", "Captured guide usage bound to reviewed Vietnamese output."
            else:
                disposition, reason = "typed-public", "Captured card pack appearance selected for the typed public card pack list."
            ledger.append({"entityId": owner, "fieldPath": path, "disposition": disposition, "chosenInput": "source" if disposition != "missing-source" else "none", "sourceRecordId": record["sourceId"], "sourceFieldPath": path, "sourceValueHash": _sha(canonical_json_bytes(value)), "localValueHash": _sha(canonical_json_bytes(local_value)) if local_value is not None else None, "reason": reason, "translationInputFingerprint": fingerprint, "reviewEvidence": ["captured SGSDeck guide", "private translation ledger"]})
    for kind, baseline_rows in (("hero", baseline_heroes), ("tactic", baseline_tactics)):
        for baseline in baseline_rows:
            owner = canonical_id(kind, baseline.get("viet") or baseline["hanViet"])
            for path, value in _flatten(baseline, "baseline"):
                target_field = {"baseline.roleTag": "roleTagViet", "baseline.effect": "effectViet", "baseline.target": "targetViet"}.get(path)
                source_record = hero_sources.get(owner) if kind == "hero" else tactic_sources.get(owner)
                source_attributes = source_record.get("attributes", {}) if source_record else {}
                selected_fallback = (
                    (kind == "hero" and path == "baseline.roleTag" and not source_attributes.get("role"))
                    or (kind == "tactic" and path == "baseline.effect" and (not source_attributes.get("effectText") or source_attributes.get("effectText") in MISSING_TEXT))
                    or (kind == "tactic" and path == "baseline.target" and source_attributes.get("effectTarget") is None)
                )
                translation_fingerprint_value = specs.get((owner, target_field)) if target_field and selected_fallback else None
                ledger.append({"entityId": owner, "fieldPath": path, "disposition": "translated-public" if translation_fingerprint_value else "compatibility-preimage", "chosenInput": "local-baseline", "sourceRecordId": None, "sourceFieldPath": None, "sourceValueHash": None, "localValueHash": _sha(canonical_json_bytes(value)), "reason": "Frozen local fallback selected and bound to reviewed Vietnamese output." if translation_fingerprint_value else "Frozen local field retained or explicitly compared before source projection.", "translationInputFingerprint": translation_fingerprint_value, "reviewEvidence": ["frozen baseline manifest", "exact compatibility merge"]})
    ledger.extend(client_ledger)
    catalog = {"schemaVersion": 1, "equipment": equipment, "specials": specials, "advisors": advisors, "troopMods": troop_mods, "buildings": buildings}
    return heroes, tactics, catalog, ledger, specs


def _render_model(capture):
    heroes, tactics, catalog, ledger, specs = _build_model(capture)
    _validate_payloads(heroes, tactics, catalog)
    payloads = {
        "heroes-dict.json": json.dumps(heroes, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n",
        "tactics.json": json.dumps(tactics, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n",
        "lookup-catalog.json": json.dumps(catalog, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n",
    }
    ledger_bytes = json.dumps(ledger, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n"
    return heroes, tactics, catalog, ledger, specs, payloads, ledger_bytes


def _walk_vi(value, path=""):
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            if (key.endswith("Vi") or key.endswith("Viet")) and isinstance(child, str) and re.search(r"[\u3400-\u9fff]", child):
                raise ValueError(f"Vietnamese display field contains CJK: {child_path}")
            if (key.endswith("Vi") or key.endswith("Viet")) and isinstance(child, list):
                if any(isinstance(item, str) and re.search(r"[\u3400-\u9fff]", item) for item in child):
                    raise ValueError(f"Vietnamese display field contains CJK: {child_path}")
            _walk_vi(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _walk_vi(child, f"{path}[{index}]")
    elif isinstance(value, float) and not math.isfinite(value):
        raise ValueError(f"non-finite number: {path}")


def _validate_conditions(rows, owner):
    if not isinstance(rows, list):
        raise ValueError(f"conditions must be an array: {owner}")
    for row in rows:
        if set(row) != {"kind", "textVi"} or row["kind"] not in {"season", "scenario", "requirement"} or not isinstance(row["textVi"], str):
            raise ValueError(f"condition shape is invalid: {owner}")


def _validate_revisions(rows, owner):
    if not isinstance(rows, list):
        raise ValueError(f"revisions must be an array: {owner}")
    for row in rows:
        if set(row) != {"labelVi", "effectiveDate", "textVi", "isCurrent"} or not isinstance(row["labelVi"], str) or not _optional_string(row["effectiveDate"]) or not isinstance(row["textVi"], str) or type(row["isCurrent"]) is not bool:
            raise ValueError(f"revision shape is invalid: {owner}")
    if rows and sum(row["isCurrent"] for row in rows) != 1:
        raise ValueError(f"revisions need exactly one current row: {owner}")


def _optional_number(value):
    return value is None or (not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value))


def _string_list(value):
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _optional_string(value):
    return value is None or isinstance(value, str)


def _validate_payloads(heroes, tactics, catalog):
    if (
        not isinstance(heroes, list)
        or not heroes
        or not isinstance(tactics, list)
        or not tactics
        or set(catalog) != {"schemaVersion", "equipment", "specials", "advisors", "troopMods", "buildings"}
        or type(catalog["schemaVersion"]) is not int
        or catalog["schemaVersion"] != 1
    ):
        raise ValueError("candidate payload shape is invalid")
    if any(not isinstance(row, dict) or set(row) != HERO_KEYS for row in heroes):
        raise ValueError("hero public projection shape is invalid")
    if any(not isinstance(row, dict) or set(row) != TACTIC_KEYS for row in tactics):
        raise ValueError("tactic public projection shape is invalid")
    hero_ids = {row["id"] for row in heroes}
    tactic_ids = {row["id"] for row in tactics}
    if len(hero_ids) != len(heroes) or len(tactic_ids) != len(tactics):
        raise ValueError("candidate contains duplicate IDs")
    if (
        len(catalog["specials"]) != 90
        or sum(len(row["options"]) for row in catalog["troopMods"]) != 192
        or sum(len(row["levels"]) for row in catalog["buildings"]) != 426
    ):
        raise ValueError("candidate child inventory is incomplete")
    advisor_ids = {row["id"] for row in catalog["advisors"]}
    hero_by_id = {row["id"]: row for row in heroes}
    for identifier, (section, field, expected) in GOLDEN_HERO_DELTAS.items():
        if hero_by_id.get(identifier, {}).get(section, {}).get(field) != expected:
            raise ValueError(f"golden hero delta mismatch: {identifier}.{section}.{field}")
    for row in heroes:
        lookup = row["lookup"]
        if set(lookup) != HERO_LOOKUP_KEYS:
            raise ValueError(f"hero lookup shape is invalid: {row['id']}")
        if set(lookup["growth"]) != {"luc", "tri", "thong", "toc", "chinh", "mi"} or set(lookup["otherAptitudes"]) != {"infantry", "navy"} or set(lookup["civil"]) != {"roleVi", "bonusVi", "specialtyVi", "tacticBonusVi"} or set(lookup["flags"]) != {"isCollectible", "isDynamicOpen", "isMusou", "isCO", "isSp"}:
            raise ValueError(f"hero nested lookup shape is invalid: {row['id']}")
        if (
            not isinstance(row["id"], str)
            or not row["id"].startswith("hero:")
            or set(row["stats"]) != {"luc", "tri", "thong", "toc", "chinh", "mi"}
            or set(row["troopApt"]) != {"ky", "thuan", "cung", "thuong", "khiGioi"}
            or not _string_list(row["aliases"])
            or type(row["pending"]) is not bool
            or type(row["isSP"]) is not bool
            or not _optional_number(row["linkScore"])
            or not all(isinstance(row[field], str) for field in ("chinese", "hanViet", "viet"))
            or any(not _optional_string(row[field]) for field in ("faction", "cost", "selfTacticCn", "inheritTacticCn", "roleTag", "roleTagViet", "iconUrl"))
            or (row["stars"] is not None and type(row["stars"]) is not int)
            or any(not isinstance(value, str) for value in row["stats"].values())
            or any(value is not None and not isinstance(value, str) for value in row["troopApt"].values())
            or any(not _optional_number(value) for value in lookup["growth"].values())
            or any(value is not None and not isinstance(value, str) for value in lookup["otherAptitudes"].values())
            or any(value is not None and type(value) is not bool for value in lookup["flags"].values())
            or any(not _optional_string(value) for value in lookup["civil"].values())
            or any(not _optional_string(lookup[field]) for field in ("categoryVi", "exclusiveTitleVi", "collectibleBonusVi", "redRulesVi", "usageVi", "usageZh"))
            or (lookup["usageVi"] is None) != (lookup["usageZh"] is None)
            or not isinstance(lookup["cardPacks"], list)
            or any(
                not isinstance(pack, dict) or set(pack) != CARD_PACK_KEYS
                or not all(isinstance(pack[field], str) and pack[field] for field in ("packVi", "packZh", "categoryVi", "categoryZh"))
                or type(pack["isCore"]) is not bool
                or not all(_optional_number(pack[field]) and pack[field] is not None and 0 <= pack[field] <= 1 for field in ("coreRate", "nonCoreRate"))
                for pack in lookup["cardPacks"]
            )
            or not _optional_number(lookup["civilInnatePoints"])
            or lookup["variant"] not in {"base", "sp", "co", "40y"}
            or not _string_list(lookup["missingFields"])
        ):
            raise ValueError(f"hero scalar type is invalid: {row['id']}")
        _validate_conditions(lookup["conditions"], row["id"])
        _validate_revisions(lookup["revisions"], row["id"])
        if lookup["selfTacticId"] is not None and lookup["selfTacticId"] not in tactic_ids:
            raise ValueError(f"dangling self tactic: {row['id']}")
        if lookup["inheritTacticId"] is not None and lookup["inheritTacticId"] not in tactic_ids:
            raise ValueError(f"dangling inherited tactic: {row['id']}")
        if lookup["advisorId"] is not None and lookup["advisorId"] not in advisor_ids:
            raise ValueError(f"dangling advisor: {row['id']}")
    for row in tactics:
        lookup = row["lookup"]
        if set(lookup) != TACTIC_LOOKUP_KEYS:
            raise ValueError(f"tactic lookup shape is invalid: {row['id']}")
        if (
            not isinstance(row["id"], str)
            or not row["id"].startswith("tactic:")
            or not _string_list(row["aliases"])
            or not _string_list(row["troopFit"])
            or type(row["pending"]) is not bool
            or not all(isinstance(row[field], str) for field in ("chinese", "hanViet", "viet"))
            or any(not _optional_string(row[field]) for field in ("type", "quality", "effect", "effectViet", "target", "targetViet", "source", "sourceHeroCn", "iconUrl"))
            or not _optional_number(row["linkScore"])
            or not _string_list(lookup["acquiredFromVi"])
            or not _string_list(lookup["inheritedFromIds"])
            or not _string_list(lookup["missingFields"])
            or any(not _optional_string(lookup[field]) for field in ("effectTypeVi", "exchangeConditionVi", "conflictsVi"))
            or any(not _optional_number(lookup[field]) for field in ("activationRate", "cooldown", "maxUsers", "pointCost"))
        ):
            raise ValueError(f"tactic scalar type is invalid: {row['id']}")
        # Tỷ lệ kích hoạt công bố phải là phân số 0–1; lệch đơn vị từ upstream phải làm build thất bại,
        # chỉ một mục SOURCE_VALUE_CORRECTIONS đã review mới cho phép hiệu chỉnh.
        if lookup["activationRate"] is not None and not 0 <= lookup["activationRate"] <= 1:
            raise ValueError(f"tactic activationRate is outside 0-1: {row['id']}")
        has_effect = isinstance(row["effect"], str) and bool(row["effect"].strip()) and row["effect"] not in MISSING_TEXT
        has_effect_vi = isinstance(row["effectViet"], str) and bool(row["effectViet"].strip())
        if (has_effect and not has_effect_vi) or row["pending"] != (not (has_effect and has_effect_vi)):
            raise ValueError(f"tactic effect translation state is invalid: {row['id']}")
        _validate_conditions(lookup["conditions"], row["id"])
        _validate_revisions(lookup["revisions"], row["id"])
        if any(identifier not in hero_ids for identifier in lookup["inheritedFromIds"]):
            raise ValueError(f"dangling inherited hero: {row['id']}")
    for group, keys in (
        ("equipment", EQUIPMENT_KEYS),
        ("specials", SPECIAL_KEYS),
        ("advisors", ADVISOR_KEYS),
        ("troopMods", TROOP_MOD_KEYS),
        ("buildings", BUILDING_KEYS),
    ):
        if not isinstance(catalog[group], list) or any(not isinstance(row, dict) or set(row) != keys for row in catalog[group]):
            raise ValueError(f"{group} public projection shape is invalid")
        for row in catalog[group]:
            _validate_conditions(row["conditions"], row["id"])
            if (
                not isinstance(row["id"], str)
                or not isinstance(row["nameVi"], str)
                or not _string_list(row["aliasesVi"])
                or not _string_list(row["aliasesZh"])
                or not _string_list(row["missingFields"])
            ):
                raise ValueError(f"{group} scalar type is invalid: {row['id']}")
            if group == "equipment" and any(not _optional_string(row[field]) for field in ("qualityVi", "slotVi")):
                raise ValueError(f"equipment scalar type is invalid: {row['id']}")
            if group == "specials" and (
                any(not _optional_string(row[field]) for field in ("tierVi", "slotVi", "descriptionVi", "equipmentId", "exclusiveHeroId"))
                or not _string_list(row["acquisitionVi"])
            ):
                raise ValueError(f"special scalar type is invalid: {row['id']}")
            if group == "advisors" and (
                any(not _optional_string(row[field]) for field in ("elementVi", "effectVi", "usageVi"))
                or not _optional_number(row["tacticPoints"])
                or not _string_list(row["heroIds"])
            ):
                raise ValueError(f"advisor scalar type is invalid: {row['id']}")
            if group == "troopMods" and (
                any(not _optional_string(row[field]) for field in ("effectVi", "appliesToVi", "suggestedBuildVi"))
                or not _string_list(row["troopLimitVi"])
                or not isinstance(row["options"], list)
            ):
                raise ValueError(f"troop mod scalar type is invalid: {row['id']}")
            if group == "buildings" and (
                not _optional_string(row["summaryVi"])
                or type(row["mainCityOnly"]) is not bool
                or type(row["maxLevel"]) is not int
                or not isinstance(row["levels"], list)
            ):
                raise ValueError(f"building scalar type is invalid: {row['id']}")
    if any(
        not isinstance(option, dict)
        or set(option) != OPTION_KEYS
        or not isinstance(option["id"], str)
        or not isinstance(option["nameVi"], str)
        or any(not _optional_string(option[field]) for field in ("tierVi", "descriptionVi", "convertsToVi"))
        for row in catalog["troopMods"]
        for option in row["options"]
    ):
        raise ValueError("troop option public projection shape is invalid")
    if any(
        not isinstance(level, dict)
        or set(level) != LEVEL_KEYS
        or set(level["costs"]) != {"wood", "iron", "stone"}
        or type(level["level"]) is not int
        or any(not _optional_number(value) for value in level["costs"].values())
        or any(not _optional_string(level[field]) for field in ("durationVi", "effectVi"))
        for row in catalog["buildings"]
        for level in row["levels"]
    ):
        raise ValueError("building level public projection shape is invalid")
    child_ids = [row["id"] for row in catalog["specials"]]
    child_ids += [option["id"] for row in catalog["troopMods"] for option in row["options"]]
    child_ids += [level["id"] for row in catalog["buildings"] for level in row["levels"]]
    if len(child_ids) != len(set(child_ids)):
        raise ValueError("candidate contains duplicate child IDs")
    equipment_ids = {row["id"] for row in catalog["equipment"]}
    if any(row["equipmentId"] is not None and row["equipmentId"] not in equipment_ids for row in catalog["specials"]):
        raise ValueError("special contains dangling equipmentId")
    if any(row["exclusiveHeroId"] is not None and row["exclusiveHeroId"] not in hero_ids for row in catalog["specials"]):
        raise ValueError("special contains dangling exclusiveHeroId")
    if any(any(identifier not in hero_ids for identifier in row["heroIds"]) for row in catalog["advisors"]):
        raise ValueError("advisor contains dangling heroId")
    for row in catalog["troopMods"]:
        _validate_revisions(row["revisions"], row["id"])
    if any(type(row["mainCityOnly"]) is not bool or type(row["maxLevel"]) is not int for row in catalog["buildings"]):
        raise ValueError("building scalar type is invalid")
    _walk_vi({"heroes": heroes, "tactics": tactics, "catalog": catalog})


def _type_signature(value):
    if isinstance(value, dict):
        return {key: _type_signature(child) for key, child in sorted(value.items())}
    if isinstance(value, list):
        return "list"
    return type(value).__name__


def _read_file_at(directory_fd, name):
    descriptor = os.open(name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=directory_fd)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise ValueError(f"candidate artifact must be a regular file: {name}")
        chunks = []
        while True:
            chunk = os.read(descriptor, 1024 * 1024)
            if not chunk:
                return b"".join(chunks)
            chunks.append(chunk)
    finally:
        os.close(descriptor)


def _write_file_at(directory_fd, name, payload):
    descriptor = os.open(
        name,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
        0o600,
        dir_fd=directory_fd,
    )
    try:
        view = memoryview(payload)
        while view:
            written = os.write(descriptor, view)
            view = view[written:]
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _remove_dir_at(parent_fd, name):
    directory_fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent_fd)
    try:
        for child in os.listdir(directory_fd):
            if not stat.S_ISREG(os.stat(child, dir_fd=directory_fd, follow_symlinks=False).st_mode):
                raise ValueError(f"candidate staging directory contains unexpected entry: {child}")
            os.unlink(child, dir_fd=directory_fd)
    finally:
        os.close(directory_fd)
    os.rmdir(name, dir_fd=parent_fd)


def _open_directory_no_symlinks(path):
    path = _normalize_root_alias(path)
    descriptor = os.open(path.anchor, os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.parts[1:]:
            child = os.open(
                component,
                os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0),
                dir_fd=descriptor,
            )
            os.close(descriptor)
            descriptor = child
        return descriptor
    except Exception:
        os.close(descriptor)
        raise


def _publish_candidate(output, artifacts):
    parent = output.parent
    parent_fd = _open_directory_no_symlinks(parent)
    lock_fd = None
    stage_name = f".{output.name}-stage-{secrets.token_hex(16)}"
    backup_name = None
    try:
        lock_fd = os.open(
            f".{output.name}.build.lock",
            os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0),
            0o600,
            dir_fd=parent_fd,
        )
        if not stat.S_ISREG(os.fstat(lock_fd).st_mode):
            raise ValueError("candidate build lock must be a regular file")
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        os.mkdir(stage_name, mode=0o700, dir_fd=parent_fd)
        stage_fd = os.open(stage_name, os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent_fd)
        try:
            for name, payload in artifacts.items():
                _write_file_at(stage_fd, name, payload)
            os.fsync(stage_fd)
            for name, payload in artifacts.items():
                if _read_file_at(stage_fd, name) != payload:
                    raise ValueError(f"staged candidate readback mismatch: {name}")
        finally:
            os.close(stage_fd)
        try:
            existing = os.stat(output.name, dir_fd=parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            existing = None
        if existing is not None:
            if not stat.S_ISDIR(existing.st_mode):
                raise ValueError("candidate output must be a regular directory")
            backup_name = f".{output.name}-previous-{secrets.token_hex(16)}"
            os.rename(output.name, backup_name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        try:
            os.rename(stage_name, output.name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            stage_name = None
        except Exception:
            if backup_name is not None:
                try:
                    os.stat(output.name, dir_fd=parent_fd, follow_symlinks=False)
                except FileNotFoundError:
                    os.rename(backup_name, output.name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
                    backup_name = None
            raise
        if backup_name is not None:
            _remove_dir_at(parent_fd, backup_name)
            backup_name = None
        os.fsync(parent_fd)
    finally:
        if stage_name is not None:
            try:
                _remove_dir_at(parent_fd, stage_name)
            except FileNotFoundError:
                pass
        if lock_fd is not None:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)
        os.close(parent_fd)


def _sibling_inputs(identity):
    """Reviewed legacy name map and SGSDeck general guide live beside the identity registry."""
    identity = Path(identity)
    return identity.with_name("sgsdeck-name-map.json"), identity.with_name("sgsdeck-guide.json")


def _input_hashes(capture):
    return {
        "baselineManifest": _sha(capture["baseline"]["manifest.json"]),
        "sourceManifest": _sha(capture["source"]["manifest.json"]),
        "identity": _sha(capture["identity"]),
        "translations": _sha(capture["translations"]),
        "mapping": _sha(capture["mapping"]),
        "guide": _sha(capture["guide"]),
        "clientHeroes": _sha(capture["clientHeroes"]),
        "clientTactics": _sha(capture["clientTactics"]),
    }


def build_candidate(*, inputs, source, identity, translations, output, client_heroes=None, client_tactics=None, after_capture=None):
    client_heroes = Path(client_heroes) if client_heroes is not None else CLIENT_HEROES_FILE
    client_tactics = Path(client_tactics) if client_tactics is not None else CLIENT_TACTICS_FILE
    protected = (inputs, source, identity, translations, client_heroes, client_tactics, *_sibling_inputs(identity))
    output = _ensure_distinct_output(output, protected)
    module_paths = {
        name: Path(__file__).with_name(name)
        for name in ("build_unified_lookup.py", "lookup_translations.py", "sgsdeck_identity.py", "unified_lookup_identity.py")
    }
    execution_bytes = {name: _capture_file(path) for name, path in module_paths.items()}
    capture = _captured(inputs, source, identity, translations, client_heroes, client_tactics)
    if after_capture is not None:
        after_capture()
    heroes, tactics, catalog, ledger, _specs, payloads, ledger_bytes = _render_model(capture)
    files = {name: _sha(payload) for name, payload in payloads.items()}
    generation_id = "lookup:" + _sha(canonical_json_bytes(files))
    manifest = {"schemaVersion": 1, "generationId": generation_id, "files": files}
    baseline_heroes = _json(capture["baseline"]["heroes-dict.json"])
    baseline_tactics = _json(capture["baseline"]["tactics.json"])
    compatibility = {
        "legacyHeroIds": [canonical_id("hero", row.get("viet") or row["hanViet"]) for row in baseline_heroes],
        "legacyTacticIds": [canonical_id("tactic", row.get("viet") or row["hanViet"]) for row in baseline_tactics],
        "legacyHeroTypes": {
            canonical_id("hero", row.get("viet") or row["hanViet"]): _type_signature(row)
            for row in baseline_heroes
        },
        "legacyTacticTypes": {
            canonical_id("tactic", row.get("viet") or row["hanViet"]): _type_signature(row)
            for row in baseline_tactics
        },
    }
    generation = {
        "schemaVersion": 1,
        "generationId": generation_id,
        "inputHashes": _input_hashes(capture),
        "builderHash": _sha(execution_bytes["build_unified_lookup.py"]),
        "executionHashes": {name: _sha(payload) for name, payload in execution_bytes.items()},
        "compatibility": compatibility,
        "outputHashes": files,
        "counts": {
            "heroes": len(heroes),
            "tactics": len(tactics),
            "equipment": len(catalog["equipment"]),
            "specials": len(catalog["specials"]),
            "advisors": len(catalog["advisors"]),
            "troopMods": len(catalog["troopMods"]),
            "buildings": len(catalog["buildings"]),
            "fieldLedgerRows": len(ledger),
        },
        "ledger": "ledger.json",
        "ledgerHash": _sha(ledger_bytes),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output = _ensure_distinct_output(output, protected)
    artifacts = {
        **payloads,
        "lookup-manifest.json": json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n",
        "generation.json": json.dumps(generation, ensure_ascii=False, sort_keys=True, indent=2).encode() + b"\n",
        "ledger.json": ledger_bytes,
    }
    if (
        any(not isinstance(row, dict) or set(row) != FIELD_LEDGER_KEYS for row in ledger)
        or generation["ledgerHash"] != _sha(artifacts["ledger.json"])
        or set(manifest["files"]) != set(PUBLIC_FILES)
    ):
        raise ValueError("staged candidate evidence is invalid")
    _publish_candidate(output, artifacts)
    return manifest


def validate_candidate(candidate, *, inputs=None, source=None, identity=None, translations=None, client_heroes=None, client_tactics=None):
    candidate = Path(candidate)
    if candidate.is_symlink() or not candidate.is_dir():
        raise ValueError("candidate must be a regular directory")
    required_files = set(PUBLIC_FILES) | {"lookup-manifest.json", "generation.json", "ledger.json"}
    if {path.name for path in candidate.iterdir()} != required_files:
        raise ValueError("candidate directory inventory is invalid")
    captured = {name: _capture_file(candidate / name) for name in required_files}
    manifest = json.loads(captured["lookup-manifest.json"])
    if (
        set(manifest) != {"schemaVersion", "generationId", "files"}
        or type(manifest["schemaVersion"]) is not int
        or manifest["schemaVersion"] != 1
        or set(manifest["files"]) != set(PUBLIC_FILES)
    ):
        raise ValueError("candidate manifest shape is invalid")
    for name in PUBLIC_FILES:
        if manifest["files"].get(name) != _sha(captured[name]):
            raise ValueError(f"candidate hash mismatch: {name}")
    if manifest["generationId"] != "lookup:" + _sha(canonical_json_bytes(manifest["files"])):
        raise ValueError("candidate generation ID mismatch")
    heroes = json.loads(captured["heroes-dict.json"])
    tactics = json.loads(captured["tactics.json"])
    catalog = json.loads(captured["lookup-catalog.json"])
    _validate_payloads(heroes, tactics, catalog)
    generation = json.loads(captured["generation.json"])
    if (
        set(generation) != {"schemaVersion", "generationId", "inputHashes", "builderHash", "executionHashes", "compatibility", "outputHashes", "counts", "ledger", "ledgerHash"}
        or generation["schemaVersion"] != 1
        or generation["generationId"] != manifest["generationId"]
        or generation["outputHashes"] != manifest["files"]
        or generation["ledger"] != "ledger.json"
        or set(generation["inputHashes"]) != {"baselineManifest", "sourceManifest", "identity", "translations", "mapping", "guide", "clientHeroes", "clientTactics"}
        or set(generation["executionHashes"]) != {"build_unified_lookup.py", "lookup_translations.py", "sgsdeck_identity.py", "unified_lookup_identity.py"}
        or generation["builderHash"] != generation["executionHashes"]["build_unified_lookup.py"]
        or any(not re.fullmatch(r"[0-9a-f]{64}", value) for value in (*generation["inputHashes"].values(), *generation["executionHashes"].values(), generation["ledgerHash"]))
    ):
        raise ValueError("private generation evidence does not match candidate")
    compatibility = generation["compatibility"]
    if (
        set(compatibility) != {"legacyHeroIds", "legacyTacticIds", "legacyHeroTypes", "legacyTacticTypes"}
        or [row["id"] for row in heroes[:len(compatibility["legacyHeroIds"])]] != compatibility["legacyHeroIds"]
        or [row["id"] for row in tactics[:len(compatibility["legacyTacticIds"])]] != compatibility["legacyTacticIds"]
    ):
        raise ValueError("legacy identity order evidence does not match candidate")
    for rows, signatures_key in ((heroes, "legacyHeroTypes"), (tactics, "legacyTacticTypes")):
        by_id = {row["id"]: row for row in rows}
        for identifier, expected in compatibility[signatures_key].items():
            row = by_id.get(identifier)
            if row is None or _type_signature({key: row[key] for key in expected}) != expected:
                raise ValueError(f"legacy field type evidence does not match candidate: {identifier}")
    ledger = json.loads(captured["ledger.json"])
    if (
        not isinstance(ledger, list)
        or not ledger
        or any(not isinstance(row, dict) or set(row) != FIELD_LEDGER_KEYS for row in ledger)
        or any(row["disposition"] not in {"translated-public", "typed-public", "mapped-public", "partially-mapped-public", "fallback-public", "corrected-public", "missing-source", "private-evidence", "compatibility-preimage"} for row in ledger)
        or generation["ledgerHash"] != _sha(captured["ledger.json"])
        or generation.get("counts", {}).get("fieldLedgerRows") != len(ledger)
    ):
        raise ValueError("private field ledger evidence is invalid")
    repo_root = Path(__file__).resolve().parents[1]
    inputs = Path(inputs) if inputs is not None else repo_root / "pipeline" / "lookup-inputs"
    source = Path(source) if source is not None else repo_root / "data" / "sgsdeck"
    identity = Path(identity) if identity is not None else repo_root / "pipeline" / "lookup-identity.json"
    translations = Path(translations) if translations is not None else repo_root / "pipeline" / "lookup-translations.json"
    client_heroes = Path(client_heroes) if client_heroes is not None else repo_root / "pipeline" / "lookup-client-heroes.json"
    client_tactics = Path(client_tactics) if client_tactics is not None else repo_root / "pipeline" / "lookup-client-tactics.json"
    approved = _captured(inputs, source, identity, translations, client_heroes, client_tactics)
    approved_input_hashes = _input_hashes(approved)
    module_paths = {
        name: Path(__file__).with_name(name)
        for name in ("build_unified_lookup.py", "lookup_translations.py", "sgsdeck_identity.py", "unified_lookup_identity.py")
    }
    approved_execution_hashes = {name: _sha(_capture_file(path)) for name, path in module_paths.items()}
    if generation["inputHashes"] != approved_input_hashes or generation["executionHashes"] != approved_execution_hashes:
        raise ValueError("candidate is not bound to the approved inputs and execution")
    _expected_heroes, _expected_tactics, _expected_catalog, _expected_ledger, _expected_specs, expected_payloads, expected_ledger_bytes = _render_model(approved)
    if any(captured[name] != expected_payloads[name] for name in PUBLIC_FILES):
        raise ValueError("candidate public projection does not match reviewed content")
    if captured["ledger.json"] != expected_ledger_bytes:
        raise ValueError("candidate field ledger does not match approved merge decisions")
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build")
    for flag in ("inputs", "source", "identity", "translations", "output"):
        build.add_argument(f"--{flag}", required=True)
    build.add_argument("--client-heroes", default=str(CLIENT_HEROES_FILE))
    build.add_argument("--client-tactics", default=str(CLIENT_TACTICS_FILE))
    validate = subparsers.add_parser("validate")
    validate.add_argument("--candidate", required=True)
    args = parser.parse_args(argv)
    if args.command == "build":
        result = build_candidate(inputs=args.inputs, source=args.source, identity=args.identity, translations=args.translations, output=args.output, client_heroes=args.client_heroes, client_tactics=args.client_tactics)
    else:
        result = validate_candidate(args.candidate)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
