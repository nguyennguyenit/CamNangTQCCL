"""Chiếu tier nguồn Nhật (bảng khớp đã review `pipeline/recommended-jp-tiers.json`) lên hàng Recommended.

Bảng khớp là input biên tập, không phải dữ liệu SGSDeck: `tierRaw` của nguồn giữ nguyên, tier JP chỉ thêm vào
trường hiển thị `tierSources` của đúng hàng đã khớp. Chỉ entry gán được tier (`reviewStatus = reviewed` và
`match.kind` là `exact`/`heroes-only`) được chiếu; mã tướng nội bộ của bảng (ví dụ `do-uy:<tên>`) không bao giờ ra
bản phát. Hàng đích lạ, lệch mùa hay bị trỏ tới hai lần làm dừng bản dựng thay vì gán tier sai.
"""
from __future__ import annotations

import json
import re

TIER_SOURCE_JP = "jp"
JP_TIERS = ("T0", "T0.5", "T1", "T1.5", "T2", "T3")
MATCH_KINDS = ("exact", "heroes-only", "none")
ASSIGNABLE_MATCH_KINDS = ("exact", "heroes-only")
REVIEW_STATUSES = ("reviewed", "needs-review")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}$")
HTTP_URL = re.compile(r"https://[^\s/]+/\S*$")


def _text(value):
    return isinstance(value, str) and bool(value.strip())


def load_jp_tiers(data):
    """Bảng khớp đã kiểm hình dạng; lỗi mô tả bằng tiếng Anh như các bộ kiểm khác của builder."""
    try:
        table = json.loads(bytes(data))
    except (TypeError, ValueError) as error:
        raise ValueError("Recommended JP tier table is not valid JSON") from error
    if not isinstance(table, dict) or table.get("schemaVersion") != 1:
        raise ValueError("Unsupported Recommended JP tier table schema")
    source = table.get("source")
    if not isinstance(source, dict):
        raise ValueError("Recommended JP tier source is missing")
    if not _text(source.get("vnSourceSeasonId")):
        raise ValueError("Recommended JP tier source season is missing")
    if not isinstance(source.get("url"), str) or not HTTP_URL.match(source["url"]):
        raise ValueError("Recommended JP tier source URL must be an absolute https URL")
    if not isinstance(source.get("publishedAt"), str) or not DATE.match(source["publishedAt"]):
        raise ValueError("Recommended JP tier source publishedAt must be YYYY-MM-DD")
    entries = table.get("entries")
    if not isinstance(entries, list):
        raise ValueError("Recommended JP tier entries are missing")
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Recommended JP tier entry is invalid")
        if entry.get("tierJa") not in JP_TIERS:
            raise ValueError("Unsupported Recommended JP tier: " + str(entry.get("tierJa")))
        if entry.get("reviewStatus") not in REVIEW_STATUSES:
            raise ValueError("Unsupported Recommended JP tier review status: " + str(entry.get("reviewStatus")))
        match = entry.get("match")
        if not isinstance(match, dict) or match.get("kind") not in MATCH_KINDS:
            raise ValueError("Unsupported Recommended JP tier match kind")
        target = match.get("recommendedTeamId")
        if match["kind"] == "none" and target is not None:
            raise ValueError("Unmatched Recommended JP tier entry cannot point at a team")
        if match["kind"] != "none" and not _text(target):
            raise ValueError("Matched Recommended JP tier entry needs a Recommended team id")
    return table


def assignable_entries(table):
    """Entry gán được tier: đã review và cùng ba tướng với một hàng Recommended."""
    return [
        entry for entry in table["entries"]
        if entry["reviewStatus"] == "reviewed" and entry["match"]["kind"] in ASSIGNABLE_MATCH_KINDS
    ]


def jp_tier_projection(table, rows):
    """`{sourceConfigId: [tierSource]}` cho các hàng khớp; kiểm hàng đích tồn tại, đúng mùa và chỉ bị trỏ một lần."""
    source = table["source"]
    season = source["vnSourceSeasonId"]
    by_id = {}
    for row in rows:
        by_id.setdefault(row.get("sourceConfigId"), row)
    projection = {}
    for entry in assignable_entries(table):
        target = entry["match"]["recommendedTeamId"]
        row = by_id.get(target)
        if row is None:
            raise ValueError("Recommended JP tier points at an unknown team: " + target)
        if row.get("sourceSeasonId") != season:
            raise ValueError("Recommended JP tier season differs for " + target)
        if target in projection:
            raise ValueError("Recommended JP tier points at the same team twice: " + target)
        projection[target] = [{
            "source": TIER_SOURCE_JP,
            "tierRaw": entry["tierJa"],
            "matchKind": entry["match"]["kind"],
            "url": source["url"],
            "publishedAt": source["publishedAt"],
        }]
    return projection


def apply_jp_tiers(candidate, data):
    """Gắn `tierSources` vào hàng index và detail của candidate (bản sao nông từng hàng, không sửa input)."""
    table = load_jp_tiers(data)
    details = candidate.get("details") or {}
    # Mùa nằm trên hàng index (detail giữ bản ghi nguồn thô, không mang `sourceSeasonId`); hàng đích phải có cả ở detail.
    projection = jp_tier_projection(table, candidate.get("records") or [])
    detail_ids = {row.get("sourceConfigId") for rows in details.values() for row in rows}
    missing = sorted(set(projection) - detail_ids)
    if missing:
        raise ValueError("Recommended JP tier team is absent from the details: " + ", ".join(missing))

    def attach(row):
        sources = projection.get(row.get("sourceConfigId"))
        return {**row, "tierSources": [dict(item) for item in sources]} if sources else row

    candidate["records"] = [attach(row) for row in candidate.get("records") or []]
    candidate["details"] = {key: [attach(row) for row in rows] for key, rows in details.items()}
    return candidate
