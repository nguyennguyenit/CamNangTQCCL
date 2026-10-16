"""Reviewed SGSDeck-to-Vietnamese canonical identity mapping."""

from __future__ import annotations

import re
import unicodedata


def _slug(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.strip().lower().replace("đ", "d"))
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", ascii_text))


def canonical_id(kind: str, display_name: str) -> str:
    if kind not in {"hero", "tactic"}:
        raise ValueError(f"unsupported canonical kind: {kind}")
    slug = _slug(display_name)
    if not slug:
        raise ValueError("canonical display name is empty")
    return f"{kind}:{slug}"


def canonical_corpus(heroes, tactics):
    """Khóa theo `id` ổn định của bản ghi (tên hiển thị có thể đổi theo client); bản ghi chưa có `id` dùng slug `viet`."""
    corpus = {}
    for kind, records in (("hero", heroes), ("tactic", tactics)):
        for record in records:
            display_name = record.get("viet")
            if not isinstance(display_name, str) or not display_name.strip():
                continue
            identifier = record.get("id") or canonical_id(kind, display_name)
            if identifier in corpus:
                raise ValueError(f"duplicate canonical ID: {identifier}")
            corpus[identifier] = {"kind": kind, "record": record}
    return corpus


def _owner_names(record) -> tuple:
    """Tên Việt hợp lệ của chủ: tên hiển thị hiện tại và tên Hán-Việt (tên lúc snapshot được rà)."""
    return tuple(name for name in (record.get("viet"), record.get("hanViet")) if isinstance(name, str) and name)


def _variant(value: str) -> str:
    normalized = value.strip().upper()
    if normalized.startswith("40Y"):
        return "40y"
    if normalized.startswith("SP ") or normalized.startswith("SP"):
        return "sp"
    if normalized.startswith("CO ") or normalized.startswith("CO") or value.strip().startswith("無雙"):
        return "co"
    return "base"


def validate_canonical_ref(category: str, value, corpus) -> None:
    if value is None:
        return
    if not isinstance(value, dict) or set(value) != {"kind", "id"}:
        raise ValueError("canonicalRef must be null or exactly {kind,id}")
    expected_kind = "hero" if category == "generals" else "tactic" if category == "tactics" else None
    if expected_kind is None:
        raise ValueError(f"{category} records cannot own canonicalRef")
    if value["kind"] != expected_kind:
        raise ValueError(f"canonicalRef kind does not match {category}")
    identifier = value["id"]
    if not isinstance(identifier, str) or not identifier.startswith(expected_kind + ":"):
        raise ValueError("canonicalRef ID has the wrong namespace")
    owner = corpus.get(identifier)
    if owner is None or owner["kind"] != expected_kind:
        raise ValueError(f"canonicalRef does not resolve: {identifier}")


def validate_record_ref(category: str, record, corpus) -> None:
    if "canonicalRef" not in record:
        raise ValueError("SGSDeck record is missing canonicalRef")
    reference = record["canonicalRef"]
    validate_canonical_ref(category, reference, corpus)
    if reference is None:
        return
    owner = corpus[reference["id"]]["record"]
    if record.get("nameVi") not in _owner_names(owner):
        raise ValueError("canonicalRef owner does not match nameVi")
    if _variant(record.get("nameZh", "")) != _variant(owner["viet"]):
        raise ValueError("canonicalRef crosses source/canonical variants")


def apply_reviewed_mappings(category, records, mappings, heroes, tactics):
    corpus = canonical_corpus(heroes, tactics)
    by_source = {}
    for mapping in mappings:
        mapping_category = mapping.get("category")
        if mapping_category not in {"generals", "tactics"}:
            raise ValueError(f"unsupported reviewed mapping category: {mapping_category}")
        if mapping_category != category:
            continue
        source_id = mapping.get("sourceId")
        for field in ("sourceId", "sourceName", "canonicalName", "evidence"):
            if not isinstance(mapping.get(field), str) or not mapping[field].strip():
                raise ValueError(f"reviewed mapping has invalid {field}: {category}/{source_id}")
        if source_id in by_source:
            raise ValueError(f"duplicate reviewed mapping: {category}/{source_id}")
        by_source[source_id] = mapping
    canonical_records = heroes if category == "generals" else tactics if category == "tactics" else []
    by_name = {}
    for record in canonical_records:
        names = _owner_names(record) if category == "tactics" else (record.get("viet"),)
        for name in dict.fromkeys(name for name in names if name):
            by_name.setdefault(name, []).append(record)

    for record in records:
        mapping = by_source.get(record.get("sourceId"))
        if mapping is None:
            validate_record_ref(category, record, corpus)
            continue
        if mapping["sourceName"].strip() != record["nameZh"].strip():
            raise ValueError(f"reviewed mapping source name changed: {record.get('sourceId')}")
        candidates = by_name.get(mapping.get("canonicalName"), [])
        if len(candidates) != 1:
            raise ValueError(f"canonical mapping is missing or ambiguous: {mapping.get('canonicalName')}")
        owner = candidates[0]
        if _variant(record["nameZh"]) != _variant(owner["viet"]):
            raise ValueError(f"canonical mapping crosses variants: {record['nameZh']} -> {owner['viet']}")
        kind = "hero" if category == "generals" else "tactic"
        reference = {"kind": kind, "id": owner.get("id") or canonical_id(kind, owner["viet"])}
        validate_canonical_ref(category, reference, corpus)
        # Giữ tên đã rà trong mapping để snapshot không đổi byte khi tên hiển thị đổi theo client.
        record["nameVi"] = mapping["canonicalName"]
        record["canonicalRef"] = reference
        record["verification"]["identity"] = "matched"
        validate_record_ref(category, record, corpus)
    unused = sorted(set(by_source) - {record.get("sourceId") for record in records})
    if unused:
        raise ValueError(f"unused reviewed mapping: {category}/{unused[0]}")
    return records
