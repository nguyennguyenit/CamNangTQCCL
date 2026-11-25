"""Team và phương án của Đội khác.

Team = bộ 3 tướng (``heroIdentityId`` đã resolve, bỏ thứ tự) + binh chủng (``unit`` đã chuẩn hóa; nhiều binh
chủng như "Kỵ, Cung" là một binh chủng riêng). Mỗi hàng admitted của ledger là một **phương án** (một
``legacyTeamId`` ↔ đúng một ``legacyVariantId``). Phương án **đủ dữ liệu** khi cả 3 tướng có ≥2 chiến pháp và
≥1 binh thư; website chỉ hiện phương án đủ dữ liệu.

Module này là nguồn duy nhất cho khóa team, cờ đủ dữ liệu, thứ tự phương án (``optionRank``) và bảng
``teamGroups`` mà builder ghi vào ``other-teams.json``; giao diện và MCP đọc lại, không tự tính.
"""
from __future__ import annotations

import copy
import hashlib

from pipeline.common import canonical_json

LOCAL_MERGE_KEY_VERSION = 2
TEAM_GROUP_ID_PREFIX = "g-"


def _filled(values) -> list[str]:
    return [value for value in (values or []) if isinstance(value, str) and value.strip()]


def _unit_token(row) -> str:
    units = sorted({value.strip() for value in _filled(row.get("unit"))})
    return "+".join(units) if units else "?"


def _hero_ids(row) -> list[str]:
    ids = [holder.get("heroIdentityId") for holder in row.get("holders") or []]
    if len(ids) != 3 or any(not isinstance(value, str) or not value for value in ids):
        raise ValueError("Team khác row needs three resolved hero identities: " + str(row.get("legacyTeamId")))
    return sorted(ids)


def _check_slot_alignment(row) -> None:
    """Ô chiến pháp/binh thư có chữ phải nằm liền từ đầu, và số chiến pháp có chữ bằng số ``tacticIdentityIds``.

    So sánh phương án (``js/other-team-groups.js``) ghép identity theo chỉ số ô, và khóa gộp lấy ô đầu làm binh thư
    chính; ô trống ở giữa/đầu làm hai quy ước đó lệch âm thầm, nên dừng build thay vì đoán.
    """
    for holder in row.get("holders") or []:
        for field in ("tacticSlotsRaw", "bookSlotsRaw"):
            values = [value if isinstance(value, str) else "" for value in holder.get(field) or []]
            filled = [bool(value.strip()) for value in values]
            if filled != sorted(filled, reverse=True):
                raise ValueError(f"Team khác {field} has a blank slot before a filled one: " + str(row.get("legacyTeamId")))
        if len(_filled(holder.get("tacticSlotsRaw"))) != len(holder.get("tacticIdentityIds") or []):
            raise ValueError("Team khác tactic identities do not align with tactic slots: " + str(row.get("legacyTeamId")))


def team_group_key(row) -> str:
    """Khóa team: 3 hero identity đã sort + binh chủng (rỗng ghi ``?``)."""
    return "heroes:" + ",".join(_hero_ids(row)) + "|unit:" + _unit_token(row)


def team_group_id(key: str) -> str:
    return TEAM_GROUP_ID_PREFIX + hashlib.sha256(key.encode()).hexdigest()[:16]


def data_complete(row) -> bool:
    """Đủ dữ liệu: đúng 3 tướng, mỗi tướng ≥2 chiến pháp và ≥1 binh thư không rỗng."""
    holders = row.get("holders") or []
    return len(holders) == 3 and all(
        len(_filled(holder.get("tacticSlotsRaw"))) >= 2 and len(_filled(holder.get("bookSlotsRaw"))) >= 1
        for holder in holders
    )


def local_merge_key(row) -> str:
    """Khóa gộp trùng nội bộ Đội khác (v2): tướng + chiến pháp + binh thư + binh chủng.

    Binh thư chính (ô đầu) giữ vị trí, hai binh thư phụ bỏ thứ tự; thứ tự tướng và chiến pháp không tính.
    So với Đội chuẩn vẫn dùng ``recommended_team_dedup.dedup_key`` (v1, không có binh thư/binh chủng).
    """
    holders = []
    for holder in row.get("holders") or []:
        books = _filled(holder.get("bookSlotsRaw"))
        holders.append((holder.get("heroIdentityId"), sorted(holder.get("tacticIdentityIds") or []),
                        books[:1], sorted(books[1:])))
    payload = {"version": LOCAL_MERGE_KEY_VERSION, "holders": sorted(holders), "unit": _unit_token(row)}
    return "sha256:" + hashlib.sha256(canonical_json(payload).encode()).hexdigest()


def annotate_other_teams(rows):
    """Bản sao các hàng admitted (giữ thứ tự ledger) kèm ``teamGroupKey``, ``teamGroupId``, ``dataComplete``,
    ``optionRank``, và bảng ``teamGroups`` theo thứ tự xuất hiện của team.

    Đại diện team = phương án đủ dữ liệu có ``optionRank`` nhỏ nhất (ledger đã xếp đề cử trước); team không
    có phương án đủ dữ liệu có đại diện ``None``.
    """
    seen_teams = set()
    records, groups, by_id = [], [], {}
    for rank, row in enumerate(rows):
        team_id = row.get("legacyTeamId")
        if team_id in seen_teams:
            raise ValueError("Team khác needs exactly one variant per legacy team: " + str(team_id))
        seen_teams.add(team_id)
        _check_slot_alignment(row)
        key = team_group_key(row)
        record = {**copy.deepcopy(row), "teamGroupKey": key, "teamGroupId": team_group_id(key),
                  "dataComplete": data_complete(row), "optionRank": rank}
        records.append(record)
        group = by_id.get(record["teamGroupId"])
        if group is None:
            group = {"teamGroupId": record["teamGroupId"], "teamGroupKey": key, "memberVariantIds": [],
                     "completeVariantIds": [], "representativeVariantId": None}
            by_id[record["teamGroupId"]] = group
            groups.append(group)
        group["memberVariantIds"].append(record["legacyVariantId"])
        if record["dataComplete"]:
            group["completeVariantIds"].append(record["legacyVariantId"])
            if group["representativeVariantId"] is None:
                group["representativeVariantId"] = record["legacyVariantId"]
    validate_team_groups(records, groups)
    return records, groups


def validate_team_groups(records, groups):
    """Bất biến giữa ``records`` và ``teamGroups`` (fail loud): mọi bên đọc tin bảng này tuyệt đối."""
    by_variant = {}
    for record in records:
        variant = record.get("legacyVariantId")
        if variant in by_variant:
            raise ValueError("Team khác variant appears twice: " + str(variant))
        by_variant[variant] = record
        if record.get("teamGroupKey") != team_group_key(record):
            raise ValueError("Team khác teamGroupKey differs from holders and unit: " + str(variant))
        if record.get("teamGroupId") != team_group_id(record.get("teamGroupKey") or ""):
            raise ValueError("Team khác teamGroupId differs from its key: " + str(variant))
        if record.get("dataComplete") is not data_complete(record):
            raise ValueError("Team khác dataComplete flag differs from holders: " + str(variant))
    grouped, seen_groups = set(), set()
    for group in groups:
        group_id = group.get("teamGroupId")
        if group_id in seen_groups:
            raise ValueError("Team khác group appears twice: " + str(group_id))
        seen_groups.add(group_id)
        if group_id != team_group_id(group.get("teamGroupKey") or ""):
            raise ValueError("Team khác group id differs from its key: " + str(group_id))
        members = group.get("memberVariantIds") or []
        expected = [variant for variant, record in by_variant.items() if record.get("teamGroupId") == group_id]
        if sorted(members) != sorted(expected) or not members:
            raise ValueError("Team khác group members differ from records: " + str(group_id))
        ranks = [by_variant[variant]["optionRank"] for variant in members]
        if ranks != sorted(ranks):
            raise ValueError("Team khác group members must follow optionRank: " + str(group_id))
        complete = [variant for variant in members if by_variant[variant]["dataComplete"]]
        if list(group.get("completeVariantIds") or []) != complete:
            raise ValueError("Team khác group complete set differs from flags: " + str(group_id))
        representative = group.get("representativeVariantId")
        if representative != (complete[0] if complete else None):
            raise ValueError("Team khác group representative must be its first complete option: " + str(group_id))
        grouped.update(members)
    if grouped != set(by_variant):
        raise ValueError("Team khác record outside any group")
