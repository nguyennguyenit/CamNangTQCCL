"""Private build-time contract for full-site Vietnamese localization.

Captures immutable Recommended inputs, validates translation/review evidence, and
compiles deterministic private candidates without mutating selected publications.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import shutil
import tempfile
from pathlib import Path, PurePosixPath

from pipeline.build_recommended_reference import (
    _validated_raw_display_notes,
    apply_display_map,
    build_generation,
    inputs_from_cache,
    load_display_map,
    localize_rows,
)
from pipeline.build_unified_lookup import (
    PUBLIC_FILES as LOOKUP_PUBLIC_FILES,
    build_candidate as build_lookup_candidate,
    validate_candidate as validate_lookup_candidate,
)
from pipeline.lookup_translations import (
    CJK,
    HASH,
    canonical_json_bytes,
    translation_fingerprint,
    validate_translation_entries,
)
from pipeline.recommended_identity import build_display_mapping


ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = "pipeline/site-localization-policy.json"
PACK_PATH = "pipeline/localization-inputs/recommended.json"
LEDGER_PATH = "pipeline/site-translations.json"
RECEIPTS_PATH = "pipeline/site-translation-reviews.json"
REVIEW_OUTPUT_DIR = "pipeline/localization-reviews"
IDENTITY_MAP_PATH = "pipeline/recommended-identity-map.json"
OTHER_LEDGER_PATH = "pipeline/recommended-other-teams.json"

SCHEMA_VERSION = 1
CLASSIFICATIONS = ("translate", "canonical", "authored-vi", "exempt", "missing-source")
REQUIRED_SECTIONS = (
    "analyze",
    "coexist",
    "khaihoang",
    "lookup",
    "recruit-tracker",
    "roster-recommend",
    "team-chuan",
    "team-khac",
)
REQUIRED_ROUTE_FAMILIES = ("legacy-detail", "recommended-detail")
REQUIRED_OWNER_FILES = (
    "js/app.js",
    "js/team-filter-section.js",
    "src/lib/team-detail-routes.ts",
    "worker/src/schema.ts",
)
EXEMPT_KINDS = ("url-id-hash", "real-name", "game-code", "search-alias", "user-content")
CARDINALITIES = (
    "per-account",
    "per-entry",
    "per-group",
    "per-holder",
    "per-note-block",
    "per-option",
    "per-record",
    "per-scope",
    "per-state",
    "per-team",
)

POLICY_KEYS = {
    "schemaVersion",
    "policyVersion",
    "classifications",
    "baseline",
    "glossary",
    "artifacts",
    "sourceFiles",
    "sections",
    "routeFamilies",
    "exemptions",
}
SECTION_KEYS = {"id", "label", "mount", "entrypoints", "states", "locations"}
ROUTE_KEYS = {"id", "page", "entrypoints", "routeModule", "states", "locations"}
LOCATION_REQUIRED = {"fieldPath", "owner", "fieldPattern", "classification", "glossary", "states"}
LOCATION_OPTIONAL = {
    "entityId",
    "entityIdPattern",
    "cardinality",
    "chosenInputFrom",
    "textEvidence",
    "exemptKind",
    "reason",
}
OWNER_KEYS = {"file", "symbol"}

PACK_KEYS = {"schemaVersion", "provenance", "inventory", "records", "details", "displayNotes"}
PROVENANCE_KEYS = {
    "cacheInventoryHash",
    "cacheManifestSha256",
    "cachedPageBytes",
    "cachedPageCount",
    "dedupKeyVersion",
    "decisionSnapshotSha256",
    "detailCount",
    "mappingFileSha256",
    "noteBlockCount",
    "noteOwnerCounts",
    "otherTeamCount",
    "recommendedCorpusHash",
    "recordCount",
    "scopeStateCounts",
    "sourceInventoryHash",
}
NOTE_BLOCK_KEYS = {"id", "owner", "holderIndex", "textRaw"}
NOTE_OWNERS = ("alternative", "primary", "team")
NOTE_FIELD_PATTERN = "displayNotes.blocks[].textRaw"
NOTE_ENTITY_PATTERN = "recommended:{safeScopeKey}/{sourceConfigId}"

ROW_DERIVED = frozenset(
    {
        "displayNameVi",
        "displayNotes",
        "legacyReferences",
        "sourceCategoryNameVi",
        "sourceSeasonCode",
        "sourceSeasonNameVi",
        "sourceSeasonTranslationStatus",
        "statFocusKind",
        "statFocusVi",
    }
)
HOLDER_DERIVED = frozenset(
    {
        "bookSlotsVi",
        "displayNameVi",
        "statFocusKind",
        "statFocusVi",
        "tacticSlotKinds",
        "tacticSlotsVi",
    }
)
HOLDER_FIELDS = ("heroes", "alternativeHoldersRaw")
ABSOLUTE_PATH = re.compile(r"(?:^|[\s\"'(=])(?:/Users/|/home/|/private/|/var/|/tmp/|[A-Za-z]:\\\\)")

RECEIPTS_KEYS = {"schemaVersion", "batches"}
BATCH_REQUIRED = {
    "batchId",
    "draftSession",
    "reviewerSession",
    "reviewedAt",
    "outputPath",
    "outputSha256",
    "items",
}
BATCH_OPTIONAL = {"draftOrigin", "reviewerModel", "reviewerProvider"}
RECEIPT_ITEM_KEYS = {
    "entityId",
    "fieldPath",
    "glossaryDigest",
    "inputFingerprint",
    "textSha256",
    "verdict",
}
OUTPUT_KEYS = {"schemaVersion", "batchId", "reviewerSession", "items"}
OUTPUT_ITEM_REQUIRED = {
    "entityId",
    "fieldPath",
    "inputFingerprint",
    "glossaryDigest",
    "textSha256",
    "verdict",
}
OUTPUT_ITEM_OPTIONAL = {"errors", "notes"}
DATA_INVENTORY_OWNERS = {
    "data/coexist.json": "js/render.js::coexistGroup",
    "data/khaihoang.json": "js/render.js::khaihoangTable",
    "data/teams.json": "js/recommended-reference-render.js::legacyContentSections",
    "data/season-content-links.json": "js/render.js::seasonCoexistGroup",
}
CANONICAL_DATA_FIELDS = {
    "advisorSkill",
    "bookSlotsRaw",
    "books",
    "commanderAfter",
    "commanderBefore",
    "faction",
    "hero",
    "heroes",
    "name",
    "nameRaw",
    "nickname",
    "statFocus",
    "statFocusRaw",
    "tactic",
    "tacticBefore",
    "tacticSlotsRaw",
    "tactics",
    "tacticsAfter",
    "teamName",
    "title",
    "unit",
    "unitType",
    "unitTypeAfter",
    "unitTypeBefore",
}
AUTHORED_VI_DATA_FIELDS = {
    "avoid",
    "context",
    "disclaimerRaw",
    "displayLabel",
    "displayNote",
    "evidenceRefs",
    "good",
    "groupLabel",
    "label",
    "note",
    "notes",
    "notesRaw",
    "openingSuggestionsRaw",
    "overview",
    "seasonNote",
    "summary",
    "summaryRaw",
    "target",
    "teamNameRaw",
    "timing",
    "unitTacticEffectsRaw",
    "warning",
}
EXEMPT_DATA_FIELDS = {
    "contentFingerprint",
    "dataset",
    "format",
    "gid",
    "id",
    "kind",
    "period",
    "recordId",
    "region",
    "reviewStatus",
    "scenarioId",
    "season",
    "sheetId",
    "source",
    "sourceConfigId",
    "sourceScopeId",
    "status",
    "type",
    "url",
    "variant",
}
CANONICAL_DATA_FIELDS.update({"alternatives", "baseName", "rawType", "trainHeroes"})
UI_LITERAL_OBLIGATIONS = (
    ("ui:app/load-error", "errorTemplate", "Lỗi tải dữ liệu: {message}. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.", "js/app.js", "main", "error", "translate", 'displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")'),
    ("ui:analyze/provider-error", "errorMessage", "Không thể phân tích ảnh. Vui lòng thử lại.", "js/analyze.js", "callWorker", "error", "translate", "localizeWorkerError(data?.error, res.status)"),
    ("ui:analyze/exception", "errorMessage", "Không thể hoàn tất thao tác. Vui lòng thử lại.", "js/analyze.js", "initAnalyze", "error", "translate", "describeAnalyzeError(e, ANALYZE_ACTION_ERROR)"),
    ("ui:roster/provider-error", "errorMessage", "Không đọc được ảnh. Vui lòng thử lại.", "js/roster-recommend-ui.js", "initRosterRecommend", "error", "translate", "describeAnalyzeError(err, ROSTER_PROVIDER_ERROR)"),
    ("ui:roster/status", "statusLabels", "missing-tactic | move-tactic | variant | build-now", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate", "ROSTER_STATUS_LABELS[entry.status]"),
    ("ui:roster/team-default", "teamNameDefault", "Team đã build", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:worker/team-default", "teamNameDefault", "Team ${i + 1}", "worker/src/schema.ts", "validateBuiltTeamsScanResult", "success", "translate"),
    ("ui:recruit/account-default", "accountDefault", "Account", "js/recruit-tracker.js", "createAccount", "data", "translate"),
    ("ui:recruit/account-add", "accountAdd", "+ Account", "js/recruit-tracker.js", "initRecruitTracker", "data", "translate"),
    ("ui:recruit/pity-label", "pityLabel", "Pity 5★", "js/recruit-tracker.js", "renderRecruitTracker", "data", "translate"),
    ("ui:app/team-chuan-title", "title", "title:'Team chuẩn'", "js/app.js", "main", "static", "translate"),
    ("ui:app/team-khac-title", "title", "title:'Team khác'", "js/app.js", "main", "static", "translate"),
    ("ui:recommended/introduction", "introduction", "Dữ liệu SGSDeck Recommended theo mùa nguồn.", "js/team-filter-section.js", "createRecommendedSection", "static", "translate"),
    ("ui:season/tier-sort", "tierSort", "Theo tier", "js/team-filter-section.js", "createSeasonTeamSection", "static", "translate"),
    ("ui:season/tier-label", "tierLabel", "tier:'Tier'", "js/team-filter-section.js", "createSeasonTeamSection", "data", "translate"),
    ("ui:analyze/similar-team", "heading", "Team có sẵn giống", "js/analyze.js", "renderResult", "success", "translate"),
    ("ui:analyze/no-similar-team", "empty", "Không tìm thấy team có sẵn đủ giống", "js/analyze.js", "renderResult", "empty", "translate"),
    ("ui:roster/team-locked", "heading", "Team đang khóa", "js/roster-recommend-ui.js", "renderReview", "review", "translate"),
    ("ui:roster/status-locked", "statusDefault", "\"locked\"", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/tier-label", "tierLabel", "`Tier:", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/open-team", "action", "Mở team", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/portfolio", "heading", "Portfolio sau khi build", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/blocked-team", "heading", "Team mạnh nhưng chưa build được", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "translate"),
    ("ui:roster/local-engine-note", "note", "AI chỉ đọc ảnh. Team được chọn bằng engine local từ dữ liệu đã curate.", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "translate"),
    ("ui:roster-map/team-default", "teamNameDefault", "Team đã build", "js/roster-scan-map.js", "mapBuiltTeamsScan", "success", "translate"),
    ("ui:roster-state/team-default", "teamNameDefault", "Team đã build", "js/roster-scan-state.js", "normalizeLockedTeam", "success", "translate"),
    ("ui:recruit-store/main-default", "accountDefault", 'name: "Main"', "js/recruit-tracker-store.js", "createDefaultRecruitTrackerState", "data", "translate"),
    ("ui:recruit-store/account-default", "accountDefault", 'name || "Account"', "js/recruit-tracker-store.js", "createAccount", "data", "translate"),
    ("ui:root/team-chuan", "navLabel", ">Team chuẩn<", "src/pages/index.astro", "root navigation", "static", "translate"),
    ("ui:root/team-khac", "navLabel", ">Team khác<", "src/pages/index.astro", "root navigation", "static", "translate"),
    ("ui:root/beta", "statusLabel", ">Beta<", "src/pages/index.astro", "root navigation", "static", "translate"),
    ("ui:root/build-credit", "creditLabel", "Build bởi", "src/pages/index.astro", "footer", "static", "translate"),
    ("ui:layout/team-chuan", "navLabel", "label: 'Team chuẩn'", "src/layouts/SiteLayout.astro", "SECTIONS", "static", "translate"),
    ("ui:layout/team-khac", "navLabel", "label: 'Team khác'", "src/layouts/SiteLayout.astro", "SECTIONS", "static", "translate"),
    ("ui:layout/beta", "statusLabel", ">Beta<", "src/layouts/SiteLayout.astro", "navigation", "static", "translate"),
    ("ui:layout/build-credit", "creditLabel", "Build bởi", "src/layouts/SiteLayout.astro", "footer", "static", "translate"),
    ("ui:recruit/account-picker", "ariaLabel", "Chọn account", "js/recruit-tracker.js", "renderHeader", "data", "translate"),
    ("ui:recruit/account-heading", "heading", '}, "Account")', "js/recruit-tracker.js", "renderHeader", "data", "translate"),
    ("ui:recruit/account-delete", "action", "Xóa acc", "js/recruit-tracker.js", "renderHeader", "data", "translate"),
    ("ui:recruit/history-filter", "description", "lọc theo account đang chọn", "js/recruit-tracker.js", "renderHistory", "history", "translate"),
    ("ui:recruit/account-new-prompt", "prompt", "Tên account mới:", "js/recruit-tracker.js", "addAccount", "prompt", "translate"),
    ("ui:recruit/account-added", "message", "Đã thêm account.", "js/recruit-tracker.js", "addAccount", "success", "translate"),
    ("ui:recruit/account-rename-prompt", "prompt", "Tên account:", "js/recruit-tracker.js", "renameActiveAccount", "prompt", "translate"),
    ("ui:recruit/account-renamed", "message", "Đã đổi tên account.", "js/recruit-tracker.js", "renameActiveAccount", "success", "translate"),
    ("ui:recruit/account-minimum", "error", "Cần giữ ít nhất 1 account.", "js/recruit-tracker.js", "deleteActiveAccount", "error", "translate"),
    ("ui:recruit/account-delete-confirm", "confirm", 'Xóa account "${current.name}"', "js/recruit-tracker.js", "deleteActiveAccount", "prompt", "translate"),
    ("ui:recruit/account-deleted", "message", "Đã xóa account.", "js/recruit-tracker.js", "deleteActiveAccount", "success", "translate"),
    ("ui:recruit/import-confirm-account", "confirm", "${summary.accounts} account", "js/recruit-tracker.js", "importJson", "import-export", "translate"),
    ("ui:recruit/import-confirm-banner", "confirm", "${summary.banners} banner", "js/recruit-tracker.js", "importJson", "import-export", "translate"),
    ("ui:recruit/import-confirm-backup", "confirm", "backup trước", "js/recruit-tracker.js", "importJson", "import-export", "translate"),
    ("ui:recruit-store/account-invalid", "error", "Account không hợp lệ.", "js/recruit-tracker-store.js", "validateRecruitTrackerImport", "error", "translate"),
    ("ui:recruit-store/active-account-invalid", "error", "Active account không hợp lệ.", "js/recruit-tracker-store.js", "validateRecruitTrackerImport", "error", "translate"),
    ("ui:route-recommended/title-team", "title", "— Team chuẩn —", "src/pages/teams/recommended/[sourceConfigId].astro", "page title", "static", "translate"),
    ("ui:route-recommended/description", "metaDescription", "dữ liệu nguồn SGSDeck Recommended", "src/pages/teams/recommended/[sourceConfigId].astro", "page metadata", "static", "translate"),
    ("ui:route-recommended/tagline", "tagline", 'tagline="Chi tiết Team chuẩn"', "src/pages/teams/recommended/[sourceConfigId].astro", "page header", "static", "translate"),
    ("ui:route-recommended/back", "backLink", "Quay lại Team chuẩn", "src/pages/teams/recommended/[sourceConfigId].astro", "back navigation", "return", "translate"),
    ("ui:route-recommended/noscript", "noscript", "danh sách Team chuẩn", "src/pages/teams/recommended/[sourceConfigId].astro", "noscript", "no-js", "translate"),
    ("ui:route-legacy/title-team", "title", "— Team khác —", "src/pages/teams/legacy/[legacyTeamId].astro", "page title", "static", "translate"),
    ("ui:route-legacy/tagline", "tagline", 'tagline="Chi tiết Team khác"', "src/pages/teams/legacy/[legacyTeamId].astro", "page header", "static", "translate"),
    ("ui:route-legacy/back", "backLink", "Quay lại Team khác", "src/pages/teams/legacy/[legacyTeamId].astro", "back navigation", "return", "translate"),
    ("ui:route-legacy/noscript", "noscript", "danh sách Team khác", "src/pages/teams/legacy/[legacyTeamId].astro", "noscript", "no-js", "translate"),
    ("ui:root/brand", "brand", "Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/pages/index.astro", "page metadata and header", "static", "translate"),
    ("ui:root/meta-description", "metaDescription", "Tổng hợp meta team", "src/pages/index.astro", "page metadata", "static", "translate"),
    ("ui:recruit/daily-rule-warning", "warning", "summary.daily.pity.isOverLimit ? \"Kiểm tra lại dữ liệu/game rule\"", "js/recruit-tracker.js", "buildRecruitTrackerViewModel", "error", "translate"),
    ("ui:recruit/limited-rule-warning", "warning", "item.pity.isOverLimit ? \"Kiểm tra lại dữ liệu/game rule\"", "js/recruit-tracker.js", "buildRecruitTrackerViewModel", "error", "translate"),
    ("ui:recruit/limited-banner-description", "description", "Tạo riêng cho banner", "js/recruit-tracker.js", "renderLimited", "data", "translate"),
    ("ui:recruit/banner-name-prompt", "prompt", "Tên gói/banner hạn giờ:", "js/recruit-tracker.js", "addLimitedBanner", "prompt", "translate"),
    ("ui:recruit-store/account-missing", "error", "Thiếu account.", "js/recruit-tracker-store.js", "validateRecruitTrackerImport", "error", "translate"),
    ("ui:recruit-store/banner-missing", "error", "Thiếu banner.", "js/recruit-tracker-store.js", "validateRecruitTrackerImport", "error", "translate"),
)


def sha256_hex(data) -> str:
    return hashlib.sha256(data).hexdigest()


def text_digest(text) -> str:
    """SHA-256 of the exact reviewed Vietnamese text bytes."""
    if not isinstance(text, str):
        raise ValueError("translation text must be a string")
    return sha256_hex(text.encode("utf-8"))


def location_key(entity_id, field_path) -> str:
    """Public location key convention shared with the browser: compact JSON array."""
    for part in (entity_id, field_path):
        if not isinstance(part, str) or not part.strip():
            raise ValueError("location key needs a domain-scoped id and field path")
    return canonical_json_bytes([entity_id, field_path]).decode().rstrip("\n")


def _corpus_bytes(corpus) -> bytes:
    """Exact byte form the Team khác ledger pins as `recommendedCorpusHash`."""
    return json.dumps(corpus, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _repo_member(root, relative, *, label="repository path"):
    text = str(relative).replace("\\", "/")
    pure = PurePosixPath(text)
    if not text or pure.is_absolute() or any(part in ("", ".", "..") for part in pure.parts):
        raise ValueError(f"unsafe {label}: {text}")
    return Path(root) / pure


# --------------------------------------------------------------------------------------
# P1-A — inventory and owner policy
# --------------------------------------------------------------------------------------


def _validate_location(location, *, states, source_files, glossary_sources, where):
    if not isinstance(location, dict):
        raise ValueError(f"localization location must be an object: {where}")
    keys = set(location)
    missing = LOCATION_REQUIRED - keys
    unknown = keys - LOCATION_REQUIRED - LOCATION_OPTIONAL
    if missing or unknown:
        raise ValueError(f"localization location schema is wrong: {where} {sorted(missing | unknown)}")
    has_id = isinstance(location.get("entityId"), str) and location["entityId"].strip()
    has_pattern = isinstance(location.get("entityIdPattern"), str) and location["entityIdPattern"].strip()
    if has_id == has_pattern:
        raise ValueError(f"location needs exactly one of entityId/entityIdPattern: {where}")
    if has_pattern and location.get("cardinality") not in CARDINALITIES:
        raise ValueError(f"location family needs a known cardinality: {where}")
    if has_id and "cardinality" in location:
        raise ValueError(f"single location cannot declare cardinality: {where}")
    identity = location.get("entityId") or location["entityIdPattern"]
    if ":" not in identity:
        raise ValueError(f"location id must carry a domain prefix: {where} {identity}")
    for field in ("fieldPath", "fieldPattern"):
        value = location[field]
        if not isinstance(value, str) or not value.strip() or "*" in value:
            raise ValueError(f"location {field} must be an exact pattern without wildcards: {where}")
    classification = location["classification"]
    if classification not in CLASSIFICATIONS:
        raise ValueError(f"unknown classification: {where} {classification!r}")
    owner = location["owner"]
    if not isinstance(owner, dict) or set(owner) != OWNER_KEYS:
        raise ValueError(f"location owner must name file and symbol: {where}")
    if owner["file"] not in source_files:
        raise ValueError(f"location owner file is outside the reviewed source inventory: {where} {owner['file']}")
    if not isinstance(owner["symbol"], str) or not owner["symbol"].strip():
        raise ValueError(f"location owner symbol is required: {where}")
    glossary = location["glossary"]
    if not isinstance(glossary, list) or any(item not in glossary_sources for item in glossary):
        raise ValueError(f"location glossary dependency is not a reviewed glossary source: {where}")
    if classification == "canonical" and not glossary:
        raise ValueError(f"canonical location must resolve a checked glossary: {where}")
    location_states = location["states"]
    if not isinstance(location_states, list) or not location_states or any(item not in states for item in location_states):
        raise ValueError(f"location states must be declared render states: {where}")
    if classification == "translate" and not (
        isinstance(location.get("chosenInputFrom"), str) and location["chosenInputFrom"].strip()
    ):
        raise ValueError(f"translate location must name its chosen raw input: {where}")
    if classification == "authored-vi" and not (
        isinstance(location.get("textEvidence"), str) and location["textEvidence"].strip()
    ):
        raise ValueError(f"authored-vi location must record text-check evidence: {where}")
    if classification == "exempt":
        if location.get("exemptKind") not in EXEMPT_KINDS:
            raise ValueError(f"exempt location needs an allowed exempt kind: {where}")
        if not (isinstance(location.get("reason"), str) and len(location["reason"].strip()) >= 10):
            raise ValueError(f"exempt location needs an exact field/owner reason: {where}")
    if classification == "missing-source" and not (
        isinstance(location.get("reason"), str) and location["reason"].strip()
    ):
        raise ValueError(f"missing-source location must record why the source is absent: {where}")
    if classification != "exempt" and "exemptKind" in location:
        raise ValueError(f"only exempt locations carry exemptKind: {where}")


def policy_location_index(policy):
    """Map (entity id or family pattern, field path) -> location; also report duplicates."""
    index = {}
    duplicates = []
    for scope, scope_id, location in _iter_policy_locations(policy):
        key = (location.get("entityId") or location["entityIdPattern"], location["fieldPath"])
        if key in index:
            duplicates.append({"location": location_key(*key), "reason": f"duplicate location in {scope} {scope_id}"})
            continue
        index[key] = {**location, "scope": scope, "scopeId": scope_id}
    return index, duplicates


def _iter_policy_locations(policy):
    for section in policy.get("sections", []):
        for location in section.get("locations", []):
            yield "section", section.get("id"), location
    for family in policy.get("routeFamilies", []):
        for location in family.get("locations", []):
            yield "routeFamily", family.get("id"), location


def validate_policy(policy):
    if not isinstance(policy, dict) or set(policy) != POLICY_KEYS:
        raise ValueError("localization policy must use the exact policy schema")
    if policy["schemaVersion"] != SCHEMA_VERSION:
        raise ValueError("unsupported localization policy schemaVersion")
    if not isinstance(policy["policyVersion"], str) or not policy["policyVersion"].strip():
        raise ValueError("policyVersion is required")
    if tuple(policy["classifications"]) != CLASSIFICATIONS:
        raise ValueError("localization policy must declare the exact classification set")

    glossary = policy["glossary"]
    if not isinstance(glossary, dict) or set(glossary) != {"sources", "terminology"}:
        raise ValueError("glossary policy must declare sources and terminology")
    sources = glossary["sources"]
    if not isinstance(sources, list) or not sources or len(set(sources)) != len(sources):
        raise ValueError("glossary sources must be a unique non-empty list")
    for item in sources:
        _repo_member(".", item, label="glossary source")
    if not isinstance(glossary["terminology"], dict) or not glossary["terminology"]:
        raise ValueError("glossary terminology policy is required")

    artifacts = policy["artifacts"]
    if not isinstance(artifacts, dict) or set(artifacts) != {
        "capturedSourcePack",
        "ledger",
        "receipts",
        "reviewOutputDir",
    }:
        raise ValueError("artifacts policy must name the private localization artifacts")
    for value in artifacts.values():
        _repo_member(".", value, label="artifact path")

    source_files = policy["sourceFiles"]
    if not isinstance(source_files, dict) or not source_files:
        raise ValueError("reviewed source-hash inventory is required")
    for path, digest in source_files.items():
        _repo_member(".", path, label="source file")
        if not isinstance(digest, str) or not HASH.fullmatch(digest):
            raise ValueError(f"reviewed source hash is invalid: {path}")
    for required in REQUIRED_OWNER_FILES:
        if required not in source_files:
            raise ValueError(f"reviewed source inventory is missing an active owner: {required}")

    baseline = policy["baseline"]
    if not isinstance(baseline, dict) or set(baseline) != {"recommended", "lookup", "sourcePins", "notes"}:
        raise ValueError("baseline must record Recommended, Lookup, source pins and notes")
    pins = baseline["sourcePins"]
    if not isinstance(pins, dict) or not pins:
        raise ValueError("baseline source pins are required")
    for key in ("cacheInventoryHash", "recommendedCorpusHash"):
        value = pins.get(key)
        if not isinstance(value, str) or not value.startswith("sha256:") or not HASH.fullmatch(value[7:]):
            raise ValueError(f"baseline pin is not a sha256 digest: {key}")
    for key in ("cachedPageCount", "cachedPageBytes", "recordCount"):
        if type(pins.get(key)) is not int or pins[key] <= 0:
            raise ValueError(f"baseline pin must be a positive count: {key}")
    authority = pins.get("authority")
    if not isinstance(authority, dict) or set(authority) != {"file", "fields"}:
        raise ValueError("baseline pins must name their authority file and fields")
    _repo_member(".", authority["file"], label="authority file")

    sections = policy["sections"]
    if not isinstance(sections, list):
        raise ValueError("sections must be an array")
    ids = [section.get("id") for section in sections]
    if tuple(sorted(ids)) != REQUIRED_SECTIONS or len(set(ids)) != len(ids):
        raise ValueError("policy must cover exactly the eight mounted sections")
    families = policy["routeFamilies"]
    family_ids = [family.get("id") for family in families]
    if tuple(sorted(family_ids)) != REQUIRED_ROUTE_FAMILIES:
        raise ValueError("policy must cover both standalone detail route families")

    glossary_sources = set(sources)
    for section in sections:
        if set(section) != SECTION_KEYS:
            raise ValueError(f"section policy schema is wrong: {section.get('id')}")
        _validate_scope(section, source_files, glossary_sources, where=f"section {section['id']}")
    for family in families:
        if set(family) != ROUTE_KEYS:
            raise ValueError(f"route family policy schema is wrong: {family.get('id')}")
        _repo_member(".", family["page"], label="route page")
        _repo_member(".", family["routeModule"], label="route module")
        _validate_scope(family, source_files, glossary_sources, where=f"routeFamily {family['id']}")

    exemptions = policy["exemptions"]
    if not isinstance(exemptions, list):
        raise ValueError("exemptions must be an array")
    index, duplicates = policy_location_index(policy)
    if duplicates:
        raise ValueError("every location needs exactly one classification: " + duplicates[0]["location"])
    declared_exempt = {
        location_key(*key) for key, location in index.items() if location["classification"] == "exempt"
    }
    listed = set()
    for item in exemptions:
        if not isinstance(item, dict) or set(item) != {"location", "owner", "field", "exemptKind", "reason"}:
            raise ValueError("exemption entries must record location, owner, field, kind and reason")
        if item["location"] not in declared_exempt:
            raise ValueError("exemption does not match an exempt location: " + str(item["location"]))
        listed.add(item["location"])
    if listed != declared_exempt:
        raise ValueError("every exempt location must be listed with an exact reason")

    for key, location in index.items():
        if location["classification"] == "translate" and location["fieldPath"] == NOTE_FIELD_PATTERN:
            continue
    if (NOTE_ENTITY_PATTERN, NOTE_FIELD_PATTERN) not in index:
        raise ValueError("policy must own the Recommended display-note obligation family")
    return policy


def _validate_scope(scope, source_files, glossary_sources, *, where):
    entrypoints = scope["entrypoints"]
    if not isinstance(entrypoints, list) or not entrypoints:
        raise ValueError(f"{where} needs at least one entrypoint")
    for entry in entrypoints:
        if entry not in source_files:
            raise ValueError(f"{where} entrypoint is outside the reviewed source inventory: {entry}")
    states = scope["states"]
    if not isinstance(states, list) or not states or len(set(states)) != len(states):
        raise ValueError(f"{where} must declare unique render states")
    locations = scope["locations"]
    if not isinstance(locations, list) or not locations:
        raise ValueError(f"{where} must own at least one location")
    covered = set()
    for location in locations:
        _validate_location(
            location,
            states=set(states),
            source_files=source_files,
            glossary_sources=glossary_sources,
            where=f"{where} {location.get('entityId') or location.get('entityIdPattern')}.{location.get('fieldPath')}",
        )
        covered.update(location["states"])
    orphan = sorted(set(states) - covered)
    if orphan:
        raise ValueError(f"{where} has render states without an owner: {orphan}")


def load_policy(root=ROOT, path=POLICY_PATH):
    return validate_policy(json.loads(_repo_member(root, path, label="policy path").read_bytes()))


def source_file_states(root, policy):
    """Reviewed source hashes versus the bytes on disk; stale hashes block the gate."""
    states = []
    for path in sorted(policy["sourceFiles"]):
        member = _repo_member(root, path, label="source file")
        if not member.is_file():
            state, actual = "missing", None
        else:
            actual = sha256_hex(member.read_bytes())
            state = "fresh" if actual == policy["sourceFiles"][path] else "stale"
        states.append({"path": path, "reviewedSha256": policy["sourceFiles"][path], "actualSha256": actual, "state": state})
    return states


def glossary_digest(root, policy):
    """Digest computed from the real glossary bytes plus the reviewed terminology policy."""
    sources = []
    for path in policy["glossary"]["sources"]:
        member = _repo_member(root, path, label="glossary source")
        if not member.is_file():
            raise ValueError("glossary source is missing: " + path)
        sources.append({"path": path, "sha256": sha256_hex(member.read_bytes())})
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "sources": sources,
        "terminology": policy["glossary"]["terminology"],
    }
    return "sha256:" + sha256_hex(canonical_json_bytes(payload))


# --------------------------------------------------------------------------------------
# P1-B — verified deterministic capture of the Recommended source pack
# --------------------------------------------------------------------------------------


def _cache_root(cache):
    path = Path(cache)
    if path.is_symlink():
        raise ValueError("Recommended cache root must not be a symlink")
    if not path.is_dir():
        raise ValueError("Recommended cache root is missing: " + str(path))
    return path.resolve(strict=True)


def _cache_member(root, relative, url):
    if not isinstance(relative, str) or not relative:
        raise ValueError("Cached Recommended page path is missing: " + str(url))
    pure = PurePosixPath(relative.replace("\\", "/"))
    if pure.is_absolute() or any(part in ("", ".", "..") for part in pure.parts):
        raise ValueError("Cached Recommended page path escapes the cache: " + str(url))
    path = root / pure
    if path.is_symlink():
        raise ValueError("Cached Recommended page must not be a symlink: " + str(url))
    if not path.is_file():
        raise ValueError("Cached Recommended page is missing: " + str(url))
    if path.resolve() != root / pure:
        raise ValueError("Cached Recommended page resolves outside the cache: " + str(url))
    return path


def verify_cache_layout(cache):
    """Fail closed on a foreign, unsafe or unpinned cache before anything is read or written."""
    root = _cache_root(cache)
    manifest = json.loads((root / "manifest.json").read_bytes())
    frozen = json.loads((root / "scope-inventory.json").read_bytes())
    if not isinstance(manifest, dict) or not isinstance(frozen, dict):
        raise ValueError("Recommended cache manifest and inventory must be objects")
    pages = manifest.get("pages")
    if not isinstance(pages, dict) or not pages:
        raise ValueError("Recommended cache manifest has no pages")
    inventory_hash = frozen.get("inventoryHash")
    if not isinstance(inventory_hash, str) or not inventory_hash.startswith("sha256:") or not HASH.fullmatch(inventory_hash[7:]):
        raise ValueError("Recommended cache inventory hash is invalid")
    if manifest.get("inventoryHash") != inventory_hash:
        raise ValueError("Recommended cache does not match the frozen inventory")
    total = 0
    for url in sorted(pages):
        item = pages[url]
        if not isinstance(item, dict) or not isinstance(item.get("sha256"), str) or not HASH.fullmatch(item["sha256"]):
            raise ValueError("Cached Recommended page hash is invalid: " + str(url))
        page = _cache_member(root, item.get("path"), url)
        digest = hashlib.sha256()
        with page.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
                total += len(chunk)
        if digest.hexdigest() != item["sha256"]:
            raise ValueError("Cached Recommended hash mismatch")
    return {
        "root": root,
        "manifest": manifest,
        "frozen": frozen,
        "cacheInventoryHash": inventory_hash,
        "cacheManifestSha256": sha256_hex((root / "manifest.json").read_bytes()),
        "cachedPageCount": len(pages),
        "cachedPageBytes": total,
    }


def _raw_row(row):
    """Drop only the derived Vietnamese projections; keep scope, order and raw fields."""
    raw = {key: value for key, value in row.items() if key not in ROW_DERIVED}
    for field in HOLDER_FIELDS:
        holders = raw.get(field)
        if isinstance(holders, list):
            raw[field] = [
                {key: value for key, value in holder.items() if key not in HOLDER_DERIVED}
                if isinstance(holder, dict)
                else holder
                for holder in holders
            ]
    return raw


def _note_projection(projection):
    return {
        "schemaVersion": projection["schemaVersion"],
        "blocks": [{key: block[key] for key in ("id", "owner", "holderIndex", "textRaw") if key in block} for block in projection["blocks"]],
    }


def _assert_portable(value, where="pack"):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ROW_DERIVED or key in HOLDER_DERIVED:
                raise ValueError(f"captured pack still carries a derived display field: {where}.{key}")
            if isinstance(key, str) and key.endswith("Vi"):
                raise ValueError(f"captured pack still carries a Vietnamese projection: {where}.{key}")
            _assert_portable(item, f"{where}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _assert_portable(item, f"{where}[{index}]")
    elif isinstance(value, str) and ABSOLUTE_PATH.search(value):
        raise ValueError(f"captured pack must stay portable, absolute path found at {where}")


def pack_corpus(pack):
    """Detail corpus in the cache order the Team khác ledger pins."""
    details = pack["details"]
    return [row for scope in pack["inventory"]["scopes"] for row in details[scope["safeScopeKey"]]]


def _validate_other_ledger(ledger, inventory, map_bytes, corpus):
    if ledger.get("dedupKeyVersion") != 1:
        raise ValueError("Unsupported Team khác dedup key version")
    if ledger.get("sourceInventoryHash") != inventory["inventoryHash"]:
        raise ValueError("Team khác ledger source inventory differs")
    if ledger.get("mappingFileSha256") != "sha256:" + sha256_hex(map_bytes):
        raise ValueError("Team khác ledger identity map differs")
    if ledger.get("recommendedCorpusHash") != "sha256:" + sha256_hex(_corpus_bytes(corpus)):
        raise ValueError("Team khác ledger Recommended corpus differs")
    if len(ledger.get("decisions", [])) != ledger.get("inputTeamRows"):
        raise ValueError("Team khác ledger decision cardinality differs")
    counts = {
        name: sum(item.get("classification") == name for item in ledger["decisions"])
        for name in ("distinct", "duplicate", "pendingIdentity", "pendingSource")
    }
    if counts != ledger.get("counts") or len(ledger.get("admitted", [])) != counts["distinct"]:
        raise ValueError("Team khác ledger counts differ")
    return ledger


def validate_source_pack(pack):
    if not isinstance(pack, dict) or set(pack) != PACK_KEYS:
        raise ValueError("captured source pack must use the exact pack schema")
    if pack["schemaVersion"] != SCHEMA_VERSION:
        raise ValueError("unsupported captured source pack schemaVersion")
    provenance = pack["provenance"]
    if not isinstance(provenance, dict) or set(provenance) != PROVENANCE_KEYS:
        raise ValueError("captured source pack provenance schema is wrong")
    inventory = pack["inventory"]
    if not isinstance(inventory, dict) or not isinstance(inventory.get("scopes"), list) or not inventory["scopes"]:
        raise ValueError("captured source pack inventory is invalid")
    scope_keys = [scope.get("safeScopeKey") for scope in inventory["scopes"]]
    if len(set(scope_keys)) != len(scope_keys) or any(not isinstance(key, str) or not key for key in scope_keys):
        raise ValueError("captured source pack scopes are not unique")
    details = pack["details"]
    if not isinstance(details, dict) or set(details) != set(scope_keys):
        raise ValueError("captured source pack details must cover every inventory scope")
    records = pack["records"]
    if not isinstance(records, list) or not records:
        raise ValueError("captured source pack has no Recommended records")

    ordered = [
        (scope, row["sourceConfigId"])
        for scope in scope_keys
        for row in details[scope]
    ]
    seen = [(row.get("safeScopeKey"), row.get("sourceConfigId")) for row in records]
    if seen != ordered:
        raise ValueError("captured source pack lost source scope or listing order")
    for index, row in enumerate(records):
        if type(row.get("listIndex")) is not int:
            raise ValueError("captured record is missing its source listing index")
    notes = pack["displayNotes"]
    if not isinstance(notes, dict) or set(notes) - set(scope_keys):
        raise ValueError("captured display notes reference an unknown scope")
    config_ids = {scope: {row["sourceConfigId"] for row in details[scope]} for scope in scope_keys}
    blocks_total = 0
    owner_counts = {owner: 0 for owner in NOTE_OWNERS}
    for scope in sorted(notes):
        scoped = notes[scope]
        if not isinstance(scoped, dict) or set(scoped) - config_ids[scope]:
            raise ValueError("captured display notes reference an unknown source config: " + scope)
        for config_id in sorted(scoped):
            projection = scoped[config_id]
            if not isinstance(projection, dict) or set(projection) != {"schemaVersion", "blocks"} or projection["schemaVersion"] != 1:
                raise ValueError("captured display notes projection is invalid: " + config_id)
            ids = set()
            for block in projection["blocks"]:
                if not isinstance(block, dict) or set(block) - NOTE_BLOCK_KEYS or {"id", "owner", "textRaw"} - set(block):
                    raise ValueError("captured display note block schema is wrong: " + config_id)
                if block["owner"] not in NOTE_OWNERS:
                    raise ValueError("captured display note owner is invalid: " + config_id)
                if block["owner"] == "team":
                    if "holderIndex" in block:
                        raise ValueError("team display note cannot own a holder index: " + config_id)
                elif type(block.get("holderIndex")) is not int or block["holderIndex"] < 0:
                    raise ValueError("holder display note needs its holder index: " + config_id)
                if not isinstance(block["textRaw"], str) or not block["textRaw"].strip():
                    raise ValueError("captured display note text is invalid: " + config_id)
                if block["id"] in ids:
                    raise ValueError("captured display note occurrence ids must be unique: " + config_id)
                ids.add(block["id"])
                owner_counts[block["owner"]] += 1
                blocks_total += 1
    if provenance["sourceInventoryHash"] != inventory.get("inventoryHash"):
        raise ValueError("captured source inventory digest does not match its payload")
    if provenance["recommendedCorpusHash"] != "sha256:" + sha256_hex(_corpus_bytes(pack_corpus(pack))):
        raise ValueError("captured Recommended corpus digest does not match its payload")
    if provenance["recordCount"] != len(records) or provenance["detailCount"] != len(ordered):
        raise ValueError("captured provenance record counts do not match the payload")
    if provenance["noteBlockCount"] != blocks_total or provenance["noteOwnerCounts"] != owner_counts:
        raise ValueError("captured provenance note counts do not match the payload")
    _assert_portable(records, "records")
    _assert_portable(details, "details")
    _assert_portable(notes, "displayNotes")
    return pack


def verify_pack_pins(pack, pins):
    """Refuse a pack that disagrees with the reviewed source pins; never update the pins."""
    provenance = pack["provenance"]
    for key, expected in pins.items():
        if key == "authority":
            continue
        if key == "normalizedSnapshotSha256":
            if sha256_hex(canonical_json_bytes(pack)) != expected:
                raise ValueError("captured normalized snapshot differs from the reviewed source pin")
            continue
        if key not in provenance:
            raise ValueError("captured pack cannot prove the reviewed pin: " + key)
        if provenance[key] != expected:
            raise ValueError(f"captured pack pin differs from the reviewed source pin: {key}")
    return pack


def capture_source_pack(cache, *, identity_map=None, other_ledger=None, pins=None, root=ROOT):
    """Parse the verified cache once into a portable, normalized private source pack."""
    identity_map = _repo_member(root, IDENTITY_MAP_PATH) if identity_map is None else Path(identity_map)
    other_ledger = _repo_member(root, OTHER_LEDGER_PATH) if other_ledger is None else Path(other_ledger)
    layout = verify_cache_layout(cache)
    inputs = inputs_from_cache(layout["root"], identity_map=identity_map, other_ledger=other_ledger)

    map_bytes = identity_map.read_bytes()
    ledger_bytes = other_ledger.read_bytes()
    ledger = json.loads(ledger_bytes)
    inventory = inputs["inventory"]
    records = [_raw_row(row) for row in inputs["records"]]
    details = {key: [_raw_row(row) for row in rows] for key, rows in inputs["details"].items()}
    notes = {}
    for row in inputs["records"]:
        projection = row.get("displayNotes")
        if projection is None:
            continue
        _validated_raw_display_notes(projection, row)
        notes.setdefault(row["safeScopeKey"], {})[row["sourceConfigId"]] = _note_projection(projection)

    scope_states = {}
    for scope in inventory["scopes"]:
        scope_states[scope.get("state")] = scope_states.get(scope.get("state"), 0) + 1
    blocks = [block for scoped in notes.values() for projection in scoped.values() for block in projection["blocks"]]
    pack = {
        "schemaVersion": SCHEMA_VERSION,
        "provenance": {
            "cacheInventoryHash": layout["cacheInventoryHash"],
            "cacheManifestSha256": layout["cacheManifestSha256"],
            "cachedPageCount": layout["cachedPageCount"],
            "cachedPageBytes": layout["cachedPageBytes"],
            "dedupKeyVersion": ledger["dedupKeyVersion"],
            "decisionSnapshotSha256": "sha256:" + sha256_hex(ledger_bytes),
            "detailCount": sum(len(rows) for rows in details.values()),
            "mappingFileSha256": "sha256:" + sha256_hex(map_bytes),
            "noteBlockCount": len(blocks),
            "noteOwnerCounts": {owner: sum(block["owner"] == owner for block in blocks) for owner in NOTE_OWNERS},
            "otherTeamCount": len(inputs["otherTeams"]),
            "recommendedCorpusHash": ledger["recommendedCorpusHash"],
            "recordCount": len(records),
            "scopeStateCounts": scope_states,
            "sourceInventoryHash": ledger["sourceInventoryHash"],
        },
        "inventory": inventory,
        "records": records,
        "details": details,
        "displayNotes": notes,
    }
    validate_source_pack(pack)
    _validate_other_ledger(ledger, inventory, map_bytes, pack_corpus(pack))
    if pins:
        verify_pack_pins(pack, pins)
    return pack


def write_source_pack(pack, output, *, allow_source_update=False):
    """Atomically persist the reviewed snapshot; differing bytes need explicit approval."""
    validate_source_pack(pack)
    data = canonical_json_bytes(pack)
    path = Path(output)
    if path.is_symlink():
        raise ValueError("captured source pack path must not be a symlink")
    if path.exists():
        if not path.is_file():
            raise ValueError("captured source pack path is not a file")
        if path.read_bytes() == data:
            return {"status": "unchanged", "sha256": sha256_hex(data), "bytes": len(data)}
        if not allow_source_update:
            raise ValueError("captured source pack differs from the reviewed snapshot; source update approval is required")
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=str(path.parent), prefix=".site-localization-", suffix=".json")
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise
    return {"status": "written", "sha256": sha256_hex(data), "bytes": len(data)}


def load_source_pack(root=ROOT, path=PACK_PATH, *, pins=None):
    pack = validate_source_pack(json.loads(_repo_member(root, path, label="source pack path").read_bytes()))
    reviewed_pins = load_policy(root)["baseline"]["sourcePins"] if pins is None else pins
    return verify_pack_pins(pack, reviewed_pins)


def hydrate_inputs(pack, identity_map, other_ledger, *, pins):
    """Rebuild Recommended generation inputs only from an externally locked source pack."""
    validate_source_pack(pack)
    verify_pack_pins(pack, pins)
    map_bytes = Path(identity_map).read_bytes()
    ledger_bytes = bytes(other_ledger) if isinstance(other_ledger, (bytes, bytearray)) else Path(other_ledger).read_bytes()
    ledger = json.loads(ledger_bytes)
    inventory = pack["inventory"]
    _validate_other_ledger(ledger, inventory, map_bytes, pack_corpus(pack))
    mapping = build_display_mapping(json.loads(map_bytes).get("entries", []))
    notes = pack["displayNotes"]

    def attach(scope_key, row):
        projection = notes.get(scope_key, {}).get(row.get("sourceConfigId"))
        return {**row, "displayNotes": projection} if projection is not None else row

    names, shared = {}, {}
    details = {
        key: [attach(key, row) for row in rows]
        for key, rows in pack["details"].items()
    }
    records = [attach(row["safeScopeKey"], row) for row in pack["records"]]
    return {
        "inventory": inventory,
        "records": localize_rows(records, mapping, names, shared),
        "details": {key: localize_rows(rows, mapping, names, shared) for key, rows in details.items()},
        "otherTeams": ledger["admitted"],
        "mappingHash": "sha256:" + sha256_hex(map_bytes),
        "decisionSnapshotHash": "sha256:" + sha256_hex(ledger_bytes),
        "dedupKeyVersion": ledger["dedupKeyVersion"],
    }


# --------------------------------------------------------------------------------------
# P1-C — expected fingerprints, glossary freshness and review receipts
# --------------------------------------------------------------------------------------


def recommended_note_inputs(pack):
    """Chosen raw input plus publication context for every Recommended display-note block."""
    rows = {(row["safeScopeKey"], row["sourceConfigId"]): row for row in pack["records"]}
    obligations = []
    for scope_key in sorted(pack["displayNotes"]):
        scoped = pack["displayNotes"][scope_key]
        for config_id in sorted(scoped):
            row = rows[(scope_key, config_id)]
            for block in scoped[config_id]["blocks"]:
                owner = block["owner"]
                holder_index = block.get("holderIndex")
                holders = row.get("heroes" if owner == "primary" else "alternativeHoldersRaw") or []
                identity = holders[holder_index].get("nameRaw") if owner in ("primary", "alternative") else None
                obligations.append(
                    {
                        "entityId": f"recommended:{scope_key}/{config_id}",
                        "fieldPath": f"displayNotes.blocks.{block['id']}.textRaw",
                        "chosenInput": block["textRaw"],
                        "context": {
                            "domain": "recommended",
                            "sourceField": "displayNotes.textRaw",
                            "safeScopeKey": scope_key,
                            "sourceScopeId": row.get("sourceScopeId"),
                            "sourceSeasonId": row.get("sourceSeasonId"),
                            "sourceCategoryId": row.get("sourceCategoryId"),
                            "sourceConfigId": config_id,
                            "blockId": block["id"],
                            "owner": owner,
                            "holderIndex": holder_index,
                            "holderIdentity": identity,
                        },
                    }
                )
    return obligations


def expected_fingerprints(obligations, digest):
    """Expected input fingerprints keyed by (entityId, fieldPath) for the site ledger."""
    expected = {}
    for item in obligations:
        key = (item["entityId"], item["fieldPath"])
        if key in expected:
            raise ValueError("duplicate localization obligation: " + location_key(*key))
        expected[key] = translation_fingerprint(
            item["entityId"], item["fieldPath"], item["chosenInput"], digest, item["context"]
        )
    return expected


def _review_output(root, batch, review_dir, problems, where):
    path = batch.get("outputPath")
    if not isinstance(path, str) or not path.startswith(review_dir.rstrip("/") + "/"):
        problems.append({"location": where, "reason": "reviewer output must live in the private review directory"})
        return None
    try:
        member = _repo_member(root, path, label="reviewer output")
    except ValueError as error:
        problems.append({"location": where, "reason": str(error)})
        return None
    if member.is_symlink() or not member.is_file():
        problems.append({"location": where, "reason": "captured reviewer output is missing"})
        return None
    data = member.read_bytes()
    if sha256_hex(data) != batch.get("outputSha256"):
        problems.append({"location": where, "reason": "captured reviewer output bytes were modified after review"})
        return None
    try:
        output = json.loads(data)
    except ValueError:
        problems.append({"location": where, "reason": "captured reviewer output is not valid JSON"})
        return None
    if not isinstance(output, dict) or set(output) != OUTPUT_KEYS or output.get("schemaVersion") != 1:
        problems.append({"location": where, "reason": "captured reviewer output schema is wrong"})
        return None
    if output.get("batchId") != batch["batchId"] or output.get("reviewerSession") != batch["reviewerSession"]:
        problems.append({"location": where, "reason": "captured reviewer output is not bound to this review session"})
        return None
    if not isinstance(output.get("items"), list) or not output["items"]:
        problems.append({"location": where, "reason": "captured reviewer output has no item results"})
        return None
    return output


def validate_review_receipts(receipts, ledger, *, root=ROOT, digest, review_dir=REVIEW_OUTPUT_DIR):
    """Bind every reviewed ledger entry to a real captured independent reviewer output."""
    problems = []
    if (
        not isinstance(receipts, dict)
        or set(receipts) != RECEIPTS_KEYS
        or receipts.get("schemaVersion") != 1
        or not isinstance(receipts.get("batches"), list)
        or not receipts["batches"]
    ):
        return [{"location": RECEIPTS_PATH, "reason": "review receipt file must use the exact receipt schema"}]
    entries = {(entry["entityId"], entry["fieldPath"]): entry for entry in ledger["entries"]}
    accepted = {}
    seen_batch_ids = set()
    claimed = set()
    for position, batch in enumerate(receipts["batches"]):
        where = f"receipt:{batch.get('batchId')}" if isinstance(batch, dict) else f"receipt:#{position}"
        if not isinstance(batch, dict) or BATCH_REQUIRED - set(batch) or set(batch) - BATCH_REQUIRED - BATCH_OPTIONAL:
            problems.append({"location": where, "reason": "review batch schema is wrong"})
            continue
        if batch["batchId"] in seen_batch_ids:
            problems.append({"location": where, "reason": "duplicate active review batch"})
            continue
        seen_batch_ids.add(batch["batchId"])
        if any(not isinstance(batch[field], str) or not batch[field].strip() for field in ("batchId", "draftSession", "reviewerSession", "reviewedAt")):
            problems.append({"location": where, "reason": "review batch needs actual session metadata"})
            continue
        if batch["draftSession"] == batch["reviewerSession"]:
            problems.append({"location": where, "reason": "review session must differ from the draft session"})
            continue
        if not isinstance(batch["outputSha256"], str) or not HASH.fullmatch(batch["outputSha256"]):
            problems.append({"location": where, "reason": "review batch output hash is invalid"})
            continue
        if not isinstance(batch["items"], list) or not batch["items"]:
            problems.append({"location": where, "reason": "review batch has no checked items"})
            continue
        output = _review_output(root, batch, review_dir, problems, where)
        if output is None:
            continue
        results = {}
        broken = False
        for item in output["items"]:
            if not isinstance(item, dict) or OUTPUT_ITEM_REQUIRED - set(item) or set(item) - OUTPUT_ITEM_REQUIRED - OUTPUT_ITEM_OPTIONAL:
                problems.append({"location": where, "reason": "captured reviewer item schema is wrong"})
                broken = True
                break
            key = (item["entityId"], item["fieldPath"])
            if key in results:
                problems.append({"location": where, "reason": "captured reviewer output contains duplicate locations"})
                broken = True
                break
            results[key] = item
        if broken:
            continue
        receipt_keys = []
        for item in batch["items"]:
            if not isinstance(item, dict) or set(item) != RECEIPT_ITEM_KEYS:
                problems.append({"location": where, "reason": "receipt item schema is wrong"})
                broken = True
                break
            receipt_keys.append((item["entityId"], item["fieldPath"]))
        if broken:
            continue
        if len(receipt_keys) != len(set(receipt_keys)):
            problems.append({"location": where, "reason": "review batch contains duplicate receipt locations"})
            continue
        if set(results) != set(receipt_keys):
            problems.append({"location": where, "reason": "captured reviewer locations do not exactly match receipt locations"})
            continue
        for item in batch["items"]:
            key = (item["entityId"], item["fieldPath"])
            try:
                where_item = location_key(*key)
            except ValueError as error:
                problems.append({"location": where, "reason": str(error)})
                continue
            if item["verdict"] != "accepted":
                problems.append({"location": where_item, "reason": f"reviewer verdict is {item['verdict']!r}"})
                continue
            if item["glossaryDigest"] != digest:
                problems.append({"location": where_item, "reason": "receipt glossary digest is stale"})
                continue
            entry = entries.get(key)
            if entry is None:
                problems.append({"location": where_item, "reason": "receipt checks a location outside the ledger"})
                continue
            if item["inputFingerprint"] != entry["inputFingerprint"]:
                problems.append({"location": where_item, "reason": "receipt fingerprint no longer matches the ledger"})
                continue
            if item["textSha256"] != text_digest(entry["textVi"]):
                problems.append({"location": where_item, "reason": "receipt text hash no longer matches the ledger text"})
                continue
            result = results.get(key)
            if result is None:
                problems.append({"location": where_item, "reason": "captured reviewer output does not cover this location"})
                continue
            if result["verdict"] != "accepted":
                problems.append({"location": where_item, "reason": "captured reviewer output rejected this location"})
                continue
            if result["textSha256"] != item["textSha256"]:
                problems.append({"location": where_item, "reason": "captured reviewer output checked different text"})
                continue
            if result["inputFingerprint"] != item["inputFingerprint"]:
                problems.append({"location": where_item, "reason": "captured reviewer output checked different source context"})
                continue
            if result["glossaryDigest"] != item["glossaryDigest"]:
                problems.append({"location": where_item, "reason": "captured reviewer output checked a different glossary"})
                continue
            if key in claimed:
                problems.append({"location": where_item, "reason": "location has duplicate active review receipts"})
                continue
            claimed.add(key)
            accepted[key] = where
    for key in sorted(entries):
        if key not in accepted:
            problems.append({"location": location_key(*key), "reason": "missing independent review receipt"})
    return problems


def _walk_strings(value, path=()):
    if isinstance(value, dict):
        for key in sorted(value):
            yield from _walk_strings(value[key], (*path, key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk_strings(item, (*path, index))
    elif isinstance(value, str) and value.strip():
        yield path, value


def _json_path(path):
    result = ""
    for part in path:
        if isinstance(part, int):
            result += f"[{part}]"
        else:
            result += ("." if result else "") + part
    return result


def _data_classification(path, text):
    field = next((part for part in reversed(path) if isinstance(part, str)), "")
    if field in EXEMPT_DATA_FIELDS or re.match(r"^(?:https?://|sha256:)", text):
        return "exempt"
    if CJK.search(text):
        return "translate"
    if field in CANONICAL_DATA_FIELDS:
        return "canonical"
    if field in AUTHORED_VI_DATA_FIELDS:
        return "authored-vi"
    raise ValueError(f"unreviewed data field classification: {field or '$'}")

def ui_source_locations(root, obligations=UI_LITERAL_OBLIGATIONS):
    locations = []
    missing = []
    try:
        ledger = json.loads(_repo_member(root, "pipeline/site-translations.json", label="UI translation ledger").read_bytes())
        reviewed = {
            (entry["entityId"], entry["fieldPath"]): entry["textVi"]
            for entry in ledger.get("entries", [])
            if entry.get("status") == "reviewed"
        }
    except (OSError, ValueError, KeyError, json.JSONDecodeError):
        reviewed = {}
    for obligation in obligations:
        entity_id, field_path, chosen_input, relative, symbol, state, classification, *binding = obligation
        source_expression = binding[0] if binding else chosen_input
        source = _repo_member(root, relative, label="UI source").read_text()
        present = source_expression in source
        if not present and not binding:
            translated = reviewed.get((entity_id, field_path))
            present = isinstance(translated, str) and translated in source
        if not present:
            missing.append({
                "entityId": entity_id,
                "fieldPath": field_path,
                "source": relative,
                "sourceExpression": source_expression,
            })
        locations.append({
            "entityId": entity_id,
            "fieldPath": field_path,
            "owner": f"{relative}::{symbol}",
            "classification": classification,
            "authority": f"ui-source:{state}",
        })
    return locations, missing
def recommended_display_locations(pack):
    """Concrete captured fields consumed by Recommended list/detail renderers."""
    locations = []
    obligations = []

    def add(entity_id, field_path, classification, owner):
        locations.append({
            "entityId": entity_id,
            "fieldPath": field_path,
            "owner": owner,
            "classification": classification,
            "authority": "captured-recommended",
        })

    for option in pack["inventory"]["seasonOptions"]:
        entity_id = f"recommended-season:{option['sourceSeasonId']}"
        add(entity_id, "displayNameVi", "translate", "js/team-filter-section.js::seasonOptionText")
        obligations.append({
            "entityId": entity_id,
            "fieldPath": "displayNameVi",
            "chosenInput": option["nameRaw"],
            "context": {
                "domain": "recommended-season",
                "sourceSeasonId": option["sourceSeasonId"],
                "sourceField": "inventory.seasonOptions[].nameRaw",
            },
        })
        add(entity_id, "label", "canonical", "js/team-filter-section.js::seasonOptionTitle")
        add(entity_id, "sourceSeasonId", "exempt", "js/team-filter-section.js::renderSeasonOptions")

    scalar_fields = {
        "authorRaw": "exempt",
        "factionRaw": "canonical",
        "nameZh": "canonical",
        "source": "canonical",
        "sourceCategoryId": "canonical",
        "sourceConfigId": "exempt",
        "sourceSeasonId": "exempt",
        "sourceUrl": "exempt",
        "subcategoryRaw": "canonical",
        "tierRaw": "exempt",
    }
    holder_fields = {
        "nameRaw": "canonical",
        "roleRaw": "canonical",
        "statFocusRaw": "canonical",
    }
    holder_lists = {
        "bookSlotsRaw": "canonical",
        "tacticSlotsRaw": "canonical",
    }
    for row in pack["records"]:
        entity_id = f"recommended:{row['safeScopeKey']}/{row['sourceConfigId']}"
        for field, classification in scalar_fields.items():
            if isinstance(row.get(field), str) and row[field].strip():
                add(entity_id, field, classification, "js/recommended-reference-render.js::recommendedTeamCard")
        for field in ("unitTypesRaw",):
            for index, value in enumerate(row.get(field) or []):
                if isinstance(value, str) and value.strip():
                    add(entity_id, f"{field}.{index}", "canonical", "js/recommended-reference-render.js::unitBadges")
        for collection in ("heroes", "alternativeHoldersRaw"):
            for index, holder in enumerate(row.get(collection) or []):
                holder_owner = "js/recommended-reference-render.js::holderView"
                for field, classification in holder_fields.items():
                    if isinstance(holder.get(field), str) and holder[field].strip():
                        add(entity_id, f"{collection}.{index}.{field}", classification, holder_owner)
                for field, classification in holder_lists.items():
                    for slot, value in enumerate(holder.get(field) or []):
                        if isinstance(value, str) and value.strip():
                            add(entity_id, f"{collection}.{index}.{field}.{slot}", classification, holder_owner)
    return locations, obligations


def site_translation_obligations(root, pack):
    """Exact build-owned translations; Lookup remains in its dedicated ledger."""
    obligations = recommended_note_inputs(pack)
    _, recommended_obligations = recommended_display_locations(pack)
    obligations.extend(recommended_obligations)
    for relative, owner in DATA_INVENTORY_OWNERS.items():
        value = json.loads(_repo_member(root, relative, label="data translation source").read_bytes())
        for path, text in _walk_strings(value):
            if _data_classification(path, text) != "translate":
                continue
            json_path = _json_path(path)
            obligations.append({
                "entityId": f"data:{relative}:{_json_path(path[:-1]) or '$'}",
                "fieldPath": json_path,
                "chosenInput": text,
                "context": {
                    "domain": "data",
                    "sourceFile": relative,
                    "sourcePath": json_path,
                    "owner": owner,
                },
            })
    for obligation in UI_LITERAL_OBLIGATIONS:
        entity_id, field_path, chosen_input, relative, symbol, state, classification, *_ = obligation
        if classification != "translate":
            continue
        obligations.append({
            "entityId": entity_id,
            "fieldPath": field_path,
            "chosenInput": chosen_input,
            "context": {
                "domain": "ui",
                "sourceFile": relative,
                "ownerSymbol": symbol,
                "state": state,
            },
        })
    return obligations



def concrete_site_locations(root, pack):
    """Extract the full phase-1 denominator from actual captured/public inputs."""
    locations = []
    for item in recommended_note_inputs(pack):
        locations.append({
            "entityId": item["entityId"],
            "fieldPath": item["fieldPath"],
            "owner": "js/recommended-reference-render.js::notesByOwner",
            "classification": "translate",
            "authority": "captured-recommended",
        })
    recommended_locations, _ = recommended_display_locations(pack)
    locations.extend(recommended_locations)
    for relative, owner in DATA_INVENTORY_OWNERS.items():
        value = json.loads(_repo_member(root, relative, label="data inventory source").read_bytes())
        for path, text in _walk_strings(value):
            locations.append({
                "entityId": f"data:{relative}:{_json_path(path[:-1]) or '$'}",
                "fieldPath": _json_path(path),
                "owner": owner,
                "classification": _data_classification(path, text),
                "authority": relative,
            })
    lookup = json.loads(_repo_member(root, "pipeline/lookup-translations.json", label="Lookup ledger").read_bytes())
    for entry in lookup.get("entries", []):
        locations.append({
            "entityId": entry["entityId"],
            "fieldPath": entry["fieldPath"],
            "owner": "pipeline/lookup-translations.json",
            "classification": "translate",
            "authority": "lookup-in-place-review",
        })
    ui_locations, missing_literals = ui_source_locations(root)
    locations.extend(ui_locations)
    keys = [(item["entityId"], item["fieldPath"]) for item in locations]
    duplicates = len(keys) - len(set(keys))
    counts = {name: sum(item["classification"] == name for item in locations) for name in CLASSIFICATIONS}
    digest = sha256_hex(canonical_json_bytes(sorted(locations, key=lambda item: (item["entityId"], item["fieldPath"]))))
    return {
        "locations": locations,
        "counts": counts,
        "total": len(locations),
        "duplicates": duplicates,
        "missingUiSources": missing_literals,
        "digest": digest,
    }


def _safe_candidate_output(root, output):
    root = Path(root).resolve(strict=True)
    output = Path(output)
    if not output.is_absolute():
        output = root / output
    if output.is_symlink():
        raise ValueError("candidate output must not be a symlink")
    resolved = output.resolve(strict=False)
    if root not in resolved.parents:
        raise ValueError("candidate output must stay inside the repository")
    relative = resolved.relative_to(root)
    if not relative.parts or relative.parts[0] in {"data", "dist", "public", "src", "pipeline"}:
        raise ValueError("candidate output must use a private repository directory")
    if resolved.exists() and any(resolved.iterdir()):
        raise ValueError("candidate output already contains files")
    return resolved


def _apply_recommended_translations(inputs, entries):
    """Attach reviewed note text without changing captured raw ownership or bytes."""
    def attach(scope_key, row):
        notes = row.get("displayNotes")
        if notes is None:
            return
        entity_id = f"recommended:{scope_key}/{row['sourceConfigId']}"
        for block in notes["blocks"]:
            key = (entity_id, f"displayNotes.blocks.{block['id']}.textRaw")
            block["textVi"] = entries[key]["textVi"]

    for row in inputs.get("records", []):
        attach(row["safeScopeKey"], row)
    for scope_key, rows in inputs.get("details", {}).items():
        for row in rows:
            attach(scope_key, row)
    return inputs


def _candidate_files(root):
    files = {}
    for path in sorted(Path(root).rglob("*")):
        if path.is_symlink():
            raise ValueError("candidate contains a symlink")
        if path.is_file():
            files[path.relative_to(root).as_posix()] = sha256_hex(path.read_bytes())
    return files

def _assert_lookup_publication(root, candidate_lookup):
    for name in (*LOOKUP_PUBLIC_FILES, "lookup-manifest.json"):
        actual = _repo_member(root, f"data/{name}", label="public Lookup artifact")
        expected = candidate_lookup / name
        if not actual.is_file() or actual.read_bytes() != expected.read_bytes():
            raise ValueError(f"public Lookup artifact differs from reviewed candidate: data/{name}")


def compile_candidate(root, output, *, stage):
    if stage not in {"data", "all"}:
        raise ValueError("unsupported localization build stage")
    gate = check(root, stage=stage, _evidence_only=True)
    root = Path(root).resolve(strict=True)
    output = _safe_candidate_output(root, output)
    if gate["exitCode"]:
        raise ValueError("localization evidence gate failed: " + json.dumps(gate["problems"][:5], ensure_ascii=False))
    policy = load_policy(root)
    digest = glossary_digest(root, policy)
    pack = load_source_pack(root, policy["artifacts"]["capturedSourcePack"])
    ledger_bytes = _repo_member(root, policy["artifacts"]["ledger"]).read_bytes()
    ledger = validate_translation_entries(json.loads(ledger_bytes), expected_fingerprints(site_translation_obligations(root, pack), digest))
    entries = {(entry["entityId"], entry["fieldPath"]): entry for entry in ledger["entries"]}

    inputs = hydrate_inputs(
        pack,
        _repo_member(root, IDENTITY_MAP_PATH),
        _repo_member(root, OTHER_LEDGER_PATH),
        pins=policy["baseline"]["sourcePins"],
    )
    inputs = _apply_recommended_translations(inputs, entries)
    display = load_display_map(_repo_member(root, "pipeline/recommended-display-map.json"))
    for source_season_id, item in display["seasons"].items():
        key = (f"recommended-season:{source_season_id}", "displayNameVi")
        item["displayNameVi"] = entries[key]["textVi"]

    input_hashes = {
        relative: sha256_hex(_repo_member(root, relative).read_bytes())
        for relative in (
            POLICY_PATH,
            policy["artifacts"]["capturedSourcePack"],
            policy["artifacts"]["ledger"],
            policy["artifacts"]["receipts"],
            "pipeline/lookup-translations.json",
            "pipeline/recommended-display-map.json",
            "pipeline/recommended-content-links.json",
            IDENTITY_MAP_PATH,
            OTHER_LEDGER_PATH,
        )
    }
    inputs["localizationInputsHash"] = "sha256:" + sha256_hex(canonical_json_bytes(input_hashes))
    apply_display_map(inputs, display)
    output.mkdir(parents=True, exist_ok=True)
    lookup_root = output / "lookup"
    lookup_manifest = build_lookup_candidate(
        inputs=_repo_member(root, "pipeline/lookup-inputs"),
        source=_repo_member(root, "data/sgsdeck"),
        identity=_repo_member(root, "pipeline/lookup-identity.json"),
        translations=_repo_member(root, "pipeline/lookup-translations.json"),
        output=lookup_root,
    )
    validate_lookup_candidate(
        lookup_root,
        inputs=_repo_member(root, "pipeline/lookup-inputs"),
        source=_repo_member(root, "data/sgsdeck"),
        identity=_repo_member(root, "pipeline/lookup-identity.json"),
        translations=_repo_member(root, "pipeline/lookup-translations.json"),
    )
    lookup_lock = output / ".lookup.build.lock"
    if lookup_lock.is_symlink():
        raise ValueError("Lookup candidate lock must not be a symlink")
    lookup_lock.unlink(missing_ok=True)
    lookup_generation = json.loads((lookup_root / "generation.json").read_bytes())
    lookup_pin = {
        "schemaVersion": SCHEMA_VERSION,
        "generationId": lookup_manifest["generationId"],
        "files": lookup_manifest["files"],
        "generationEvidenceSha256": sha256_hex((lookup_root / "generation.json").read_bytes()),
        "ledgerSha256": lookup_generation["ledgerHash"],
    }
    recommended_root = output / "recommended"
    selector = build_generation(
        inputs,
        recommended_root,
        teams_bytes=_repo_member(root, "data/teams.json").read_bytes(),
        content_links_bytes=_repo_member(root, "pipeline/recommended-content-links.json").read_bytes(),
        ledger_bytes=_repo_member(root, OTHER_LEDGER_PATH).read_bytes(),
    )

    source_hashes = {
        relative: sha256_hex(_repo_member(root, relative).read_bytes())
        for relative in sorted(DATA_INVENTORY_OWNERS)
    }
    source_hashes.update({
        f"data/{name}": sha256_hex((lookup_root / name).read_bytes())
        for name in (*LOOKUP_PUBLIC_FILES, "lookup-manifest.json")
    })
    values = {
        location_key(entry["entityId"], entry["fieldPath"]): entry["textVi"]
        for entry in ledger["entries"]
        if entry["entityId"].startswith("data:")
        or (stage == "all" and entry["entityId"].startswith("ui:"))
    }
    descriptor = {
        "schemaVersion": SCHEMA_VERSION,
        "stage": stage,
        "inputHashes": input_hashes,
        "sourceHashes": source_hashes,
        "lookupPin": lookup_pin,
        "recommendedPin": selector,
        "valuesSha256": sha256_hex(canonical_json_bytes(values)),
    }
    generation_id = "site-localization:" + sha256_hex(canonical_json_bytes(descriptor))
    sidecar = {
        "schemaVersion": SCHEMA_VERSION,
        "generationId": generation_id,
        "sourceHashes": source_hashes,
        "recommendedPin": selector,
        "values": values,
    }
    (output / "site-display.json").write_bytes(canonical_json_bytes(sidecar))
    files = _candidate_files(output)
    manifest = {
        **descriptor,
        "generationId": generation_id,
        "files": files,
        "counts": {
            "displayValues": len(values),
            "dataValues": sum(entry["entityId"].startswith("data:") for entry in ledger["entries"]),
            "uiValues": sum(
                entry["entityId"].startswith("ui:") for entry in ledger["entries"]
            ) if stage == "all" else 0,
            "recommendedNotes": len(recommended_note_inputs(pack)),
            "uiPending": (
                sum(entry["entityId"].startswith("ui:") for entry in ledger["entries"])
                if stage == "data" else 0
            ),
        },
    }
    (output / "candidate-manifest.json").write_bytes(canonical_json_bytes(manifest))
    return manifest

def compile_data_candidate(root, output):
    return compile_candidate(root, output, stage="data")


def check_candidate(root, candidate, *, stage):
    """Recompile in disposable storage and compare every candidate byte."""
    candidate = Path(candidate)
    if candidate.is_symlink() or not candidate.is_dir():
        raise ValueError(f"{stage} candidate directory is missing or unsafe")
    manifest = json.loads((candidate / "candidate-manifest.json").read_bytes())
    if manifest.get("stage") != stage:
        raise ValueError(f"candidate stage mismatch: expected {stage}")
    actual = _candidate_files(candidate)
    with tempfile.TemporaryDirectory(prefix=".site-localization-check-", dir=Path(root)) as temporary:
        expected_root = Path(temporary) / "candidate"
        compile_candidate(root, expected_root, stage=stage)
        expected = _candidate_files(expected_root)
        if actual != expected:
            raise ValueError(f"{stage} candidate file inventory or bytes differ from deterministic reconstruction")
    return manifest


def check_data_candidate(root, candidate):
    return check_candidate(root, candidate, stage="data")


def publish_candidate(root, candidate):
    """Activate one verified full candidate; generation first, selectors last."""
    root = Path(root).resolve(strict=True)
    candidate = Path(candidate).resolve(strict=True)
    manifest = check_candidate(root, candidate, stage="all")
    _assert_lookup_publication(root, candidate / "lookup")
    selector = json.loads((candidate / "recommended/current.json").read_bytes())
    generation_id = selector["generationId"]
    source_generation = candidate / "recommended" / generation_id
    recommended_root = _repo_member(root, "src/data/recommended-reference")
    destination_generation = recommended_root / generation_id
    if destination_generation.exists():
        if _candidate_files(destination_generation) != _candidate_files(source_generation):
            raise ValueError("selected Recommended generation already exists with different bytes")
    else:
        temporary_generation = recommended_root / f".{generation_id}.tmp"
        if temporary_generation.exists():
            shutil.rmtree(temporary_generation)
        shutil.copytree(source_generation, temporary_generation)
        os.replace(temporary_generation, destination_generation)

    def replace_bytes(destination, source):
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.tmp")
        temporary.write_bytes(source.read_bytes())
        os.replace(temporary, destination)

    replace_bytes(recommended_root / "current.json", candidate / "recommended/current.json")
    replace_bytes(_repo_member(root, "data/website-display.json"), candidate / "site-display.json")
    return manifest


def check_publication(root):
    """Prove selected public bytes equal a deterministic strict reconstruction."""
    root = Path(root).resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix=".site-localization-public-", dir=root) as temporary:
        candidate = Path(temporary) / "candidate"
        manifest = compile_candidate(root, candidate, stage="all")
        selector = json.loads((candidate / "recommended/current.json").read_bytes())
        generation_id = selector["generationId"]
        comparisons = (
            (candidate / "site-display.json", _repo_member(root, "data/website-display.json")),
            (candidate / "recommended/current.json", _repo_member(root, "src/data/recommended-reference/current.json")),
        )
        for expected, actual in comparisons:
            if not actual.is_file() or actual.read_bytes() != expected.read_bytes():
                raise ValueError(f"public localization artifact differs from strict build: {actual.relative_to(root)}")
        expected_generation = candidate / "recommended" / generation_id
        actual_generation = _repo_member(root, f"src/data/recommended-reference/{generation_id}")
        if not actual_generation.is_dir() or _candidate_files(actual_generation) != _candidate_files(expected_generation):
            raise ValueError("public Recommended generation differs from strict build")
        _assert_lookup_publication(root, candidate / "lookup")
        return manifest


# --------------------------------------------------------------------------------------
# Reports and CLI
# --------------------------------------------------------------------------------------


def inventory_report(root=ROOT, *, policy=None, pack=None):
    """Read-only site inventory: owners, classifications, states and real missing counts."""
    policy = load_policy(root) if policy is None else validate_policy(policy)
    index, duplicates = policy_location_index(policy)
    digest = glossary_digest(root, policy)
    classifications = {name: 0 for name in CLASSIFICATIONS}
    families = 0
    literals = 0
    for location in index.values():
        classifications[location["classification"]] += 1
        if "entityIdPattern" in location:
            families += 1
        else:
            literals += 1
    sections = [
        {
            "id": section["id"],
            "mount": section["mount"],
            "entrypoints": sorted(section["entrypoints"]),
            "states": sorted(section["states"]),
            "locations": len(section["locations"]),
            "classifications": sorted({location["classification"] for location in section["locations"]}),
        }
        for section in sorted(policy["sections"], key=lambda item: item["id"])
    ]
    routes = [
        {
            "id": family["id"],
            "page": family["page"],
            "routeModule": family["routeModule"],
            "entrypoints": sorted(family["entrypoints"]),
            "states": sorted(family["states"]),
            "locations": len(family["locations"]),
        }
        for family in sorted(policy["routeFamilies"], key=lambda item: item["id"])
    ]
    sources = source_file_states(root, policy)
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "command": "inventory",
        "policyVersion": policy["policyVersion"],
        "glossaryDigest": digest,
        "sections": sections,
        "routeFamilies": routes,
        "locations": {
            "policy": {"total": len(index), "literals": literals, "families": families},
            "concrete": None,
        },
        "classifications": classifications,
        "unknownLocations": 0,
        "duplicateLocations": len(duplicates),
        "sourceFiles": {
            "total": len(sources),
            "stale": sorted(item["path"] for item in sources if item["state"] == "stale"),
            "missing": sorted(item["path"] for item in sources if item["state"] == "missing"),
        },
        "baseline": policy["baseline"],
        "capturedSourcePack": None,
        "translation": {
            "expectedObligations": 0,
            "ledgerEntries": 0,
            "translated": 0,
            "missing": 0,
            "published": False,
        },
    }
    if pack is None:
        pack_path = _repo_member(root, policy["artifacts"]["capturedSourcePack"])
        pack = load_source_pack(root, policy["artifacts"]["capturedSourcePack"]) if pack_path.is_file() else None
    if pack is None:
        report["unknownLocations"] = len(index)
        report["translation"]["reason"] = "captured source pack is missing"
        return report
    expected = expected_fingerprints(site_translation_obligations(root, pack), digest)
    recommended_expected = expected_fingerprints(recommended_note_inputs(pack), digest)
    concrete = concrete_site_locations(root, pack)
    ledger_path = _repo_member(root, policy["artifacts"]["ledger"])
    entries = {}
    if ledger_path.is_file():
        ledger = json.loads(ledger_path.read_bytes())
        for entry in ledger.get("entries", []) if isinstance(ledger, dict) else []:
            entries[(entry.get("entityId"), entry.get("fieldPath"))] = entry
    lookup_entries = {}
    lookup_path = _repo_member(root, "pipeline/lookup-translations.json")
    if lookup_path.is_file():
        lookup = json.loads(lookup_path.read_bytes())
        for entry in lookup.get("entries", []) if isinstance(lookup, dict) else []:
            lookup_entries[(entry.get("entityId"), entry.get("fieldPath"))] = entry
    full_translation_keys = {
        (item["entityId"], item["fieldPath"])
        for item in concrete["locations"]
        if item["classification"] == "translate"
    }
    translated = len(full_translation_keys & (set(entries) | set(lookup_entries)))
    report["capturedSourcePack"] = {
        "records": pack["provenance"]["recordCount"],
        "details": pack["provenance"]["detailCount"],
        "noteBlocks": pack["provenance"]["noteBlockCount"],
        "noteOwnerCounts": pack["provenance"]["noteOwnerCounts"],
        "scopeStateCounts": pack["provenance"]["scopeStateCounts"],
        "recommendedCorpusHash": pack["provenance"]["recommendedCorpusHash"],
        "sourceInventoryHash": pack["provenance"]["sourceInventoryHash"],
        "normalizedSnapshotSha256": sha256_hex(canonical_json_bytes(pack)),
    }
    report["locations"]["concrete"] = {
        "total": concrete["total"],
        "digest": concrete["digest"],
        "byAuthority": {
            authority: sum(item["authority"] == authority for item in concrete["locations"])
            for authority in sorted({item["authority"] for item in concrete["locations"]})
        },
    }
    report["classifications"] = concrete["counts"]
    report["unknownLocations"] = len(concrete["missingUiSources"])
    report["unknownLocationDetails"] = concrete["missingUiSources"]
    report["duplicateLocations"] += concrete["duplicates"]
    report["translation"] = {
        "expectedObligations": concrete["counts"]["translate"],
        "recommendedObligations": len(recommended_expected),
        "lookupReviewObligations": sum(
            item["authority"] == "lookup-in-place-review" for item in concrete["locations"]
        ),
        "ledgerEntries": len(entries) + len(lookup_entries),
        "siteLedgerEntries": len(entries),
        "translated": translated,
        "missing": len(full_translation_keys) - translated,
        "published": False,
    }
    baseline_inventory = policy["baseline"]["notes"]
    if concrete["total"] != baseline_inventory.get("concreteLocationCount"):
        report["unknownLocationDetails"].append({
            "location": "full-site-inventory",
            "reason": "concrete location count differs from reviewed baseline",
            "expected": baseline_inventory.get("concreteLocationCount"),
            "actual": concrete["total"],
        })
    if concrete["digest"] != baseline_inventory.get("concreteInventorySha256"):
        report["unknownLocationDetails"].append({
            "location": "full-site-inventory",
            "reason": "concrete inventory digest differs from reviewed baseline",
            "expected": baseline_inventory.get("concreteInventorySha256"),
            "actual": concrete["digest"],
        })
    report["unknownLocations"] = len(report["unknownLocationDetails"])
    return report


def check(root=ROOT, *, policy=None, stage=None, candidate=None, _evidence_only=False):
    """Fail-closed offline gate; candidate checks only write disposable scratch."""
    problems = []
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "command": "check",
        "problems": problems,
        "glossaryDigest": None,
        "coverage": {},
        "exitCode": 1,
    }
    try:
        policy = load_policy(root) if policy is None else validate_policy(policy)
    except (ValueError, OSError) as error:
        problems.append({"location": POLICY_PATH, "reason": str(error)})
        return report
    report["policyVersion"] = policy["policyVersion"]
    for item in source_file_states(root, policy):
        if item["state"] != "fresh":
            problems.append({"location": item["path"], "reason": f"reviewed source hash is {item['state']}"})
    try:
        digest = glossary_digest(root, policy)
    except (ValueError, OSError) as error:
        problems.append({"location": "glossary", "reason": str(error)})
        return report
    report["glossaryDigest"] = digest

    pack_relative = policy["artifacts"]["capturedSourcePack"]
    try:
        pack = load_source_pack(root, pack_relative)
        verify_pack_pins(pack, policy["baseline"]["sourcePins"])
    except (ValueError, OSError) as error:
        problems.append({"location": pack_relative, "reason": str(error)})
        return report

    index, _ = policy_location_index(policy)
    if (NOTE_ENTITY_PATTERN, NOTE_FIELD_PATTERN) not in index:
        problems.append({"location": POLICY_PATH, "reason": "captured obligations have no approved owner"})
        return report
    recommended_expected = expected_fingerprints(recommended_note_inputs(pack), digest)
    site_expected = expected_fingerprints(site_translation_obligations(root, pack), digest)
    concrete = concrete_site_locations(root, pack)
    baseline_inventory = policy["baseline"]["notes"]
    report["uiPending"] = sum(
        item["context"].get("domain") == "ui"
        for item in site_translation_obligations(root, pack)
    )
    report["uiMissingSources"] = concrete["missingUiSources"]
    if stage != "data" and concrete["missingUiSources"]:
        problems.extend({
            "location": location_key(item["entityId"], item["fieldPath"]),
            "reason": f"reviewed UI source expression is missing: {item['sourceExpression']}",
        } for item in concrete["missingUiSources"])
    if concrete["duplicates"]:
        problems.append({"location": "full-site-inventory", "reason": "concrete localization locations are duplicated"})
    if (
        concrete["total"] != baseline_inventory.get("concreteLocationCount")
        or concrete["digest"] != baseline_inventory.get("concreteInventorySha256")
    ):
        problems.append({"location": "full-site-inventory", "reason": "concrete localization inventory differs from reviewed baseline"})
    full_translation_keys = {
        (item["entityId"], item["fieldPath"])
        for item in concrete["locations"]
        if item["classification"] == "translate"
    }

    ledger_relative = policy["artifacts"]["ledger"]
    ledger_path = _repo_member(root, ledger_relative)
    if not ledger_path.is_file():
        missing = sorted(location_key(*key) for key in full_translation_keys)
        problems.append({"location": ledger_relative, "reason": "site translation ledger is missing"})
        report["coverage"] = {
            "expected": len(full_translation_keys),
            "recommended": len(recommended_expected),
            "lookupReview": baseline_inventory["lookupReviewObligations"],
            "translated": 0,
            "missing": len(missing),
            "missingSample": missing[:20],
            "receipts": 0,
        }
        return report
    ledger = json.loads(ledger_path.read_bytes())
    site_entries = {
        (entry.get("entityId"), entry.get("fieldPath"))
        for entry in (ledger.get("entries", []) if isinstance(ledger, dict) else [])
    }
    lookup_relative = "pipeline/lookup-translations.json"
    lookup_path = _repo_member(root, lookup_relative)
    try:
        lookup_ledger = json.loads(lookup_path.read_bytes())
        validate_translation_entries(lookup_ledger)
    except (ValueError, OSError) as error:
        problems.append({"location": lookup_relative, "reason": str(error)})
        lookup_ledger = {"entries": []}
    lookup_entries = {
        (entry.get("entityId"), entry.get("fieldPath"))
        for entry in lookup_ledger["entries"]
    }
    combined_entries = site_entries | lookup_entries
    missing = sorted(location_key(*key) for key in full_translation_keys - combined_entries)
    extra = sorted(
        location_key(*key)
        for key in combined_entries - full_translation_keys
        if all(isinstance(part, str) for part in key)
    )
    report["coverage"] = {
        "expected": len(full_translation_keys),
        "recommended": len(recommended_expected),
        "siteLedger": len(site_expected),
        "lookupReview": len(lookup_entries),
        "translated": len(full_translation_keys) - len(missing),
        "missing": len(missing),
        "missingSample": missing[:20],
        "extraSample": extra[:20],
        "receipts": 0,
    }
    if isinstance(ledger, dict) and ledger.get("glossaryVersion") != digest:
        problems.append({"location": ledger_relative, "reason": "ledger glossary digest is stale"})
    try:
        validate_translation_entries(ledger, site_expected)
    except ValueError as error:
        problems.append({"location": ledger_relative, "reason": str(error)})
    for key in missing:
        problems.append({"location": key, "reason": "translation or independent Lookup review is missing"})
    for key in extra:
        problems.append({"location": key, "reason": "ledger entry has no concrete source owner"})

    receipts_relative = policy["artifacts"]["receipts"]
    receipts_path = _repo_member(root, receipts_relative)
    if not receipts_path.is_file():
        problems.append({"location": receipts_relative, "reason": "independent review receipts are missing"})
        return report
    receipts = json.loads(receipts_path.read_bytes())
    combined_ledger = {
        "entries": [
            *(ledger.get("entries", []) if isinstance(ledger, dict) else []),
            *lookup_ledger["entries"],
        ],
    }
    receipt_problems = validate_review_receipts(
        receipts,
        combined_ledger,
        root=root,
        digest=digest,
        review_dir=policy["artifacts"]["reviewOutputDir"],
    )
    report["coverage"]["receipts"] = sum(len(batch.get("items", [])) for batch in receipts.get("batches", []) if isinstance(batch, dict))
    problems.extend(receipt_problems)
    if not problems and stage is not None and not _evidence_only:
        try:
            if stage in {"data", "all"}:
                if candidate is None:
                    raise ValueError(f"{stage}-stage check requires a candidate")
                report["candidate"] = check_candidate(root, candidate, stage=stage)
            elif stage == "public":
                report["candidate"] = check_publication(root)
            else:
                raise ValueError("unsupported localization stage")
        except (ValueError, OSError) as error:
            problems.append({"location": str(candidate or stage), "reason": str(error)})
    if not problems:
        report["exitCode"] = 0
    return report


def _emit(report, destination=None):
    data = canonical_json_bytes(report)
    if destination is not None:
        path = Path(destination)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    sys.stdout.write(data.decode())
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    capture = commands.add_parser("capture", help="capture the verified Recommended source pack")
    capture.add_argument("--cache", required=True, type=Path)
    capture.add_argument("--output", required=True, type=Path)
    capture.add_argument("--root", default=ROOT, type=Path)
    capture.add_argument("--identity-map", type=Path)
    capture.add_argument("--other-ledger", type=Path)
    capture.add_argument("--allow-source-update", action="store_true")
    capture.add_argument("--report", type=Path)

    inventory = commands.add_parser("inventory", help="report the site localization inventory")
    inventory.add_argument("--root", default=ROOT, type=Path)
    inventory.add_argument("--report", type=Path)

    builder = commands.add_parser("build", help="compile a private localization candidate")
    builder.add_argument("--root", default=ROOT, type=Path)
    builder.add_argument("--stage", default="all", choices=("data", "all"))
    builder.add_argument("--output", required=True, type=Path)

    publisher = commands.add_parser("publish", help="activate a verified full localization candidate")
    publisher.add_argument("--root", default=ROOT, type=Path)
    publisher.add_argument("--candidate", required=True, type=Path)

    checker = commands.add_parser("check", help="fail-closed offline localization gate")
    checker.add_argument("--root", default=ROOT, type=Path)
    checker.add_argument("--stage", choices=("data", "all", "public"))
    checker.add_argument("--candidate", type=Path)

    args = parser.parse_args(argv)
    if args.command == "capture":
        policy = load_policy(args.root)
        pack = capture_source_pack(
            args.cache,
            identity_map=args.identity_map,
            other_ledger=args.other_ledger,
            pins=policy["baseline"]["sourcePins"],
            root=args.root,
        )
        written = write_source_pack(pack, args.output, allow_source_update=args.allow_source_update)
        _emit(
            {
                "schemaVersion": SCHEMA_VERSION,
                "command": "capture",
                "output": {**written, "path": str(args.output)},
                "provenance": pack["provenance"],
            },
            args.report,
        )
        return 0
    if args.command == "inventory":
        report = inventory_report(args.root)
        _emit(report, args.report)
        return 0
    if args.command == "build":
        manifest = compile_candidate(args.root, args.output, stage=args.stage)
        _emit({"schemaVersion": SCHEMA_VERSION, "command": "build", "candidate": manifest})
        return 0
    if args.command == "publish":
        manifest = publish_candidate(args.root, args.candidate)
        _emit({"schemaVersion": SCHEMA_VERSION, "command": "publish", "candidate": manifest})
        return 0
    report = check(args.root, stage=args.stage, candidate=args.candidate)
    _emit(report)
    return report["exitCode"]


if __name__ == "__main__":
    raise SystemExit(main())
