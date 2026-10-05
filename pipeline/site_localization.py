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
from pipeline.common import canonical_json, sha256_hex
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
REQUIRED_ROUTE_FAMILIES = ("khaihoang-detail", "legacy-detail", "recommended-detail")
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
    "data/coexist.json": "js/render.js::seasonCoexistGroup",
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
    "buildNote",
    "context",
    "disclaimerRaw",
    "displayLabel",
    "evidenceRefs",
    "good",
    "groupLabel",
    "label",
    "note",
    "notes",
    "notesRaw",
    "openingNote",
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
    ("ui:recommended/introduction", "introduction", "Đội hình tham khảo, chia theo mùa tương ứng.", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:analyze/similar-team", "heading", "Team có sẵn giống", "js/analyze.js", "renderResult", "success", "translate"),
    ("ui:analyze/no-similar-team", "empty", "Không tìm thấy team có sẵn đủ giống", "js/analyze.js", "renderResult", "empty", "translate"),
    ("ui:roster/team-locked", "heading", "Team đang khóa", "js/roster-recommend-ui.js", "renderReview", "review", "translate"),
    ("ui:roster/status-locked", "statusDefault", "\"locked\"", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/tier-label", "tierLabel", "`Tier:", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/open-team", "action", "Mở team", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster/portfolio", "heading", "Portfolio sau khi build", "js/roster-recommend-ui.js", "renderRecommendation", "success", "translate"),
    ("ui:roster-map/team-default", "teamNameDefault", "Team đã build", "js/roster-scan-map.js", "mapBuiltTeamsScan", "success", "translate"),
    ("ui:roster-state/team-default", "teamNameDefault", "Team đã build", "js/roster-scan-state.js", "normalizeLockedTeam", "success", "translate"),
    ("ui:recruit-store/main-default", "accountDefault", 'name: "Main"', "js/recruit-tracker-store.js", "createDefaultRecruitTrackerState", "data", "translate"),
    ("ui:recruit-store/account-default", "accountDefault", 'name || "Account"', "js/recruit-tracker-store.js", "createAccount", "data", "translate"),
    ("ui:root/team-chuan", "navLabel", ">Team chuẩn<", "src/components/landing/Landing.astro", "root navigation", "static", "translate"),
    ("ui:root/team-khac", "navLabel", ">Team khác<", "src/components/landing/Landing.astro", "root navigation", "static", "translate"),
    ("ui:root/beta", "statusLabel", ">Beta<", "src/components/landing/Landing.astro", "root navigation", "static", "translate"),
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
    ("ui:route-recommended/title-team", "title", "— Team chuẩn —", "src/components/pages/RecommendedDetail.astro", "page title", "static", "translate"),
    ("ui:route-recommended/description", "metaDescription", ": tướng, chiến pháp, binh thư và điểm tham khảo.", "src/components/pages/RecommendedDetail.astro", "page metadata", "static", "authored-vi"),
    ("ui:route-recommended/tagline", "tagline", 'tagline="Chi tiết Team chuẩn"', "src/components/pages/RecommendedDetail.astro", "page header", "static", "translate"),
    ("ui:route-recommended/back", "backLink", "Quay lại Team chuẩn", "src/components/pages/RecommendedDetail.astro", "back navigation", "return", "translate"),
    ("ui:route-recommended/noscript", "noscript", "danh sách Team chuẩn", "src/components/pages/RecommendedDetail.astro", "noscript", "no-js", "translate"),
    ("ui:route-legacy/title-team", "title", "— Team khác —", "src/components/pages/LegacyDetail.astro", "page title", "static", "translate"),
    ("ui:route-legacy/tagline", "tagline", 'tagline="Chi tiết Team khác"', "src/components/pages/LegacyDetail.astro", "page header", "static", "translate"),
    ("ui:route-legacy/back", "backLink", "Quay lại Team khác", "src/components/pages/LegacyDetail.astro", "back navigation", "return", "translate"),
    ("ui:route-legacy/noscript", "noscript", "danh sách Team khác", "src/components/pages/LegacyDetail.astro", "noscript", "no-js", "translate"),
    ("ui:root/brand", "brand", "Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/landing/Landing.astro", "page metadata and header", "static", "translate"),
    ("ui:root/meta-description", "metaDescription", "Tổng hợp meta team", "src/components/landing/Landing.astro", "page metadata", "static", "translate"),
    ("ui:recruit/daily-rule-warning", "warning", "summary.daily.pity.isOverLimit ? \"Kiểm tra lại dữ liệu/game rule\"", "js/recruit-tracker.js", "buildRecruitTrackerViewModel", "error", "translate"),
    ("ui:recruit/limited-rule-warning", "warning", "item.pity.isOverLimit ? \"Kiểm tra lại dữ liệu/game rule\"", "js/recruit-tracker.js", "buildRecruitTrackerViewModel", "error", "translate"),
    ("ui:recruit/limited-banner-description", "description", "Tạo riêng cho banner", "js/recruit-tracker.js", "renderLimited", "data", "translate"),
    ("ui:recruit/banner-name-prompt", "prompt", "Tên gói/banner hạn giờ:", "js/recruit-tracker.js", "addLimitedBanner", "prompt", "translate"),
    ("ui:recruit-store/account-missing", "error", "Thiếu account.", "js/recruit-tracker-store.js", "validateRecruitTrackerImport", "error", "translate"),
    ("ui:recruit-store/banner-missing", "error", "Thiếu banner.", "js/recruit-tracker-store.js", "validateRecruitTrackerImport", "error", "translate"),
    ("ui:khaihoang/guide-heading", "heading", "Hướng dẫn khai hoang", "js/render.js", "khaihoangGuide", "data", "authored-vi", 'el("h2", { class: "kh-guide-title" }, L("Hướng dẫn khai hoang", "开荒攻略"))'),
    # Phase 8 — Cùng Tồn: đầu mục, chọn mùa/phiên bản, dòng đếm, ghi chú gập và thẻ đội.
    ("ui:coexist/kicker", "kicker", "Đội hình", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi"),
    ("ui:coexist/title", "title", "Cùng Tồn", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi"),
    ("ui:coexist/lead", "lead", "Năm đội dùng được cùng lúc trong một tài khoản, 15 tướng không trùng nhau. Chọn mùa rồi chọn phiên bản để tham khảo.", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi"),
    ("ui:coexist/season-aria", "ariaLabel", "'Mùa'", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi", "el('select', {'aria-label': L('Mùa', '赛季')})"),
    ("ui:coexist/season-label", "label", "'Mùa'", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi", "el('span', {class: 'reference-season-label'}, L('Mùa', '赛季'))"),
    ("ui:coexist/season-latest", "status", "'Mới nhất'", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi"),
    ("ui:coexist/version-aria", "ariaLabel", "'Chọn phiên bản Cùng Tồn'", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi"),
    ("ui:coexist/version-label", "label", "'Phiên bản'", "js/team-filter-section.js", "createSeasonCoexistSection", "static", "authored-vi"),
    ("ui:coexist/group-fallback", "groupLabel", "'Nhóm'", "js/render.js", "coexistGroupLabel", "static", "authored-vi", 'value || "Nhóm"'),
    ("ui:coexist/empty", "empty", "Không có nhóm Cùng Tồn trong mùa này.", "js/team-filter-section.js", "createSeasonCoexistSection", "empty", "authored-vi"),
    ("ui:coexist/notes-label", "label", "Ghi chú", "js/render.js", "seasonCoexistGroup", "data", "authored-vi"),
    ("ui:coexist/opening-label", "label", "Gợi ý khai hoang", "js/render.js", "seasonCoexistGroup", "data", "authored-vi"),
    ("ui:coexist/notes-summary", "summaryLabel", "Ghi chú & gợi ý khai hoang", "js/render.js", "seasonCoexistGroup", "data", "authored-vi"),
    ("ui:coexist/counts-line", "countsLine", "`${counts.teams} đội · ${counts.heroes} tướng · `", "js/render.js", "seasonCoexistGroup", "data", "authored-vi"),
    ("ui:coexist/counts-clean", "verdict", "không trùng", "js/render.js", "seasonCoexistGroup", "data", "authored-vi"),
    ("ui:coexist/counts-duplicate", "verdict", "`có trùng: ${counts.duplicates.join(\", \")}`", "js/render.js", "seasonCoexistGroup", "data", "authored-vi"),
    ("ui:coexist/level-title", "title", "'Cấp độ đội'", "js/recommended-reference-render.js", "coexistTeamCard", "data", "authored-vi"),
    ("ui:coexist/refit-line", "refitLine", "`Cải tạo: ${team.unitTacticEffects}`", "js/recommended-reference-render.js", "coexistTeamCard", "data", "authored-vi"),
    ("ui:coexist/advisor-line", "advisorLine", "`QS: ${hero.advisorSkill}`", "js/recommended-reference-render.js", "coexistTeamCard", "data", "authored-vi"),
    ("ui:coexist/books-missing", "emptyLabel", "'Chưa ghi'", "js/recommended-reference-render.js", "coexistTeamCard", "data", "authored-vi"),
    ("ui:coexist/slot-missing", "missing", "Chưa có dữ liệu", "js/render.js", "coexistModel", "data", "authored-vi"),
    # Khai hoang: danh sách mang đội + phiên bản và tham khảo chung (Chạm Sứ, quân thủ mỏ); trang chi tiết mang đội hình, ghi chú, điểm, hướng dẫn.
    ("ui:khaihoang/kicker", "kicker", "Đội hình", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/title", "title", "Khai hoang", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/lead", "lead", "Đội mở đất và các phiên bản chiến pháp. Mở Chi tiết để xem điểm từng mốc đất, ghi chú và hướng dẫn đánh đất.", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/jump-aria", "ariaLabel", "Trong trang", "js/render.js", "khaihoangJumpNav", "static", "authored-vi"),
    ("ui:khaihoang/jump-teams", "linkLabel", "Đội đề xuất", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/jump-chamsu", "linkLabel", "\"Chạm Sứ / Ăn vạ\"", "js/render.js", "khaihoangTable", "data", "authored-vi"),
    ("ui:khaihoang/jump-mines", "linkLabel", "Quân thủ mỏ", "js/render.js", "khaihoangTable", "data", "authored-vi"),
    ("ui:khaihoang/teams-aria", "ariaLabel", "Đội khai hoang", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/unit-filter-aria", "ariaLabel", "\"Lọc theo loại binh\"", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/unit-all", "label", "Tất cả", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/result-count", "countLine", "` / ${teams.length} đội`", "js/render.js", "khaihoangTable", "static", "authored-vi"),
    ("ui:khaihoang/unit-empty", "empty", "Không có đội khai hoang nào dùng loại binh này.", "js/render.js", "khaihoangTable", "empty", "authored-vi"),
    ("ui:khaihoang/card-versions-label", "label", "Phiên bản", "js/render.js", "khaihoangTeamCard", "static", "authored-vi"),
    ("ui:khaihoang/card-detail-link", "linkLabel", "Chi tiết", "js/render.js", "khaihoangTeamCard", "static", "authored-vi"),
    ("ui:khaihoang/card-score-title", "title", "Điểm tổng khai hoang (thang 10)", "js/render.js", "khaihoangScoreStamp", "data", "authored-vi"),
    ("ui:khaihoang/card-score-missing", "status", "Chưa có điểm khai hoang", "js/render.js", "khaihoangScoreStamp", "empty", "authored-vi"),
    ("ui:khaihoang/card-score-unit", "unit", "\"điểm\"", "js/render.js", "khaihoangScoreStamp", "data", "authored-vi"),
    ("ui:khaihoang/card-config-aria", "ariaLabel", "`Chọn cấu hình ${team.title}`", "js/render.js", "khaihoangConfigRow", "static", "authored-vi"),
    ("ui:khaihoang/card-default", "label", "Mặc định", "js/render.js", "khaihoangConfigRow", "static", "authored-vi"),
    ("ui:khaihoang/card-variant", "label", "`Cấu hình ${index + 1}`", "js/render.js", "khaihoangConfigRow", "static", "authored-vi"),
    ("ui:khaihoang/stage-before", "label", "\"Trước\"", "js/render.js", "khaihoangHolder", "data", "authored-vi"),
    ("ui:khaihoang/stage-after", "label", "\"Sau\"", "js/render.js", "khaihoangHolder", "data", "authored-vi"),
    ("ui:khaihoang/role-commander", "role", "\"Chủ tướng\"", "js/render.js", "COMMANDER_LABEL", "data", "authored-vi"),
    ("ui:khaihoang/role-commander-before", "role", "Chủ tướng trước cấp 20", "js/render.js", "EARLY_COMMANDER_LABEL", "data", "authored-vi"),
    ("ui:khaihoang/role-commander-after", "role", "Chủ tướng sau cấp 20", "js/render.js", "LATE_COMMANDER_LABEL", "data", "authored-vi"),
    ("ui:khaihoang/role-deputy", "role", "Phó tướng", "js/render.js", "khaihoangHeroCard", "data", "authored-vi"),
    ("ui:khaihoang/detail-tactics-before", "label", "Chiến pháp trước", "js/render.js", "khaihoangHeroCard", "data", "authored-vi"),
    ("ui:khaihoang/detail-tactics-after", "label", "Chiến pháp sau", "js/render.js", "khaihoangHeroCard", "data", "authored-vi"),
    ("ui:khaihoang/detail-lineup-title", "title", "\"Đội hình\"", "js/render.js", "khaihoangBuildContent", "data", "authored-vi"),
    ("ui:khaihoang/detail-notes-title", "title", "\"Ghi chú\"", "js/render.js", "khaihoangBuildContent", "data", "authored-vi"),
    ("ui:khaihoang/ratings-title", "title", "Điểm đánh giá", "js/render.js", "khaihoangRatings", "data", "authored-vi"),
    ("ui:khaihoang/rating-note", "note", "Điểm /10 cho cả bộ ba tướng, chưa chấm riêng từng bộ chiến pháp · Tướng trắng vẫn dùng được; càng nhiều đỏ càng tốt.", "js/render.js", "khaihoangRatings", "data", "authored-vi"),
    ("ui:khaihoang/rating-land4", "label", "\"Đất 4\"", "js/render.js", "khaihoangRatingBar", "data", "authored-vi"),
    ("ui:khaihoang/rating-land5", "label", "\"Đất 5\"", "js/render.js", "khaihoangRatingBar", "data", "authored-vi"),
    ("ui:khaihoang/rating-land6", "label", "\"Đất 6\"", "js/render.js", "khaihoangRatingBar", "data", "authored-vi"),
    ("ui:khaihoang/rating-land7to8", "label", "\"Đất 7–8\"", "js/render.js", "khaihoangRatingBar", "data", "authored-vi"),
    ("ui:khaihoang/rating-transition", "label", "\"Chuyển\"", "js/render.js", "khaihoangRatingBar", "data", "authored-vi"),
    ("ui:khaihoang/rating-overall", "label", "\"Tổng\"", "js/render.js", "khaihoangRatingBar", "data", "authored-vi"),
    ("ui:khaihoang/chamsu-title", "title", "Đội Chạm Sứ / Ăn vạ", "js/render.js", "khaihoangReference", "data", "authored-vi"),
    ("ui:khaihoang/mines-title", "title", "Quân thủ các mỏ", "js/render.js", "khaihoangReference", "data", "authored-vi"),
    ("ui:khaihoang/mines-caption", "caption", "Quân thủ từng mỏ", "js/render.js", "minesTable", "data", "authored-vi"),
    ("ui:khaihoang/mines-col-mine", "columnLabel", "Mỏ", "js/render.js", "minesTable", "data", "authored-vi"),
    ("ui:khaihoang/mines-col-squads", "columnLabel", "`Quân thủ (${squads} đội)`", "js/render.js", "minesTable", "data", "authored-vi"),
    ("ui:khaihoang/detail-versions-label", "label", "'Phiên bản'", "js/khaihoang-detail.js", "initKhaiHoangDetail", "data", "authored-vi"),
    # Trang mục tách đường dẫn: tiêu đề và mô tả riêng của từng trang là chữ tác giả mới.
    ("ui:section-page/doi-chuan", "title", "Đội chuẩn — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/doi-chuan", "metaDescription", "Danh sách đội hình Đội chuẩn theo từng mùa, lọc theo phe, loại binh và mùa.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/doi-khac", "title", "Đội khác — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/doi-khac", "metaDescription", "Danh sách đội hình Đội khác đã đối chiếu với đội chuẩn, lọc theo phe, loại binh và mùa.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/cung-ton", "title", "Cùng Tồn — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/cung-ton", "metaDescription", "Các nhóm tướng Cùng Tồn theo kịch bản, kèm cấu hình áp dụng và phần tham khảo.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/khai-hoang", "title", "Khai hoang — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/khai-hoang", "metaDescription", "Hướng dẫn khai hoang theo từng đội: build trước và sau, thanh điểm mốc và cách đánh đất.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/tra-cuu", "title", "Tra cứu — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/LookupHubPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/tra-cuu", "metaDescription", "Tra cứu tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng, công trình và binh thư theo tên Việt hoặc chữ Hán.", "src/components/pages/LookupHubPage.astro", "page metadata", "static", "authored-vi"),
    # Trang nhóm Tra cứu (/tra-cuu/<slug>/): tiêu đề, mô tả và dòng dẫn ghép nhãn nhóm + mô tả nhóm đã khai bên dưới.
    ("ui:lookup-page/title", "title", "`${current.label} — Tra cứu — Cẩm Nang Game Tam Quốc Chí - Chiến Lược`", "src/components/pages/LookupGroupPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:lookup-page/meta-description", "metaDescription", "`${current.label}: ${current.description}. Tìm theo tên Việt, Hán-Việt hoặc chữ Hán.`", "src/components/pages/LookupGroupPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:lookup-page/lead", "lead", "`${current.description} — tìm bằng tên Việt, Hán-Việt hoặc chữ Hán.`", "src/components/pages/LookupGroupPage.astro", "page header", "static", "authored-vi"),
    ("ui:section-page/theo-doi-chieu-mo", "title", "Theo dõi chiêu mộ — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/theo-doi-chieu-mo", "metaDescription", "Theo dõi chiêu mộ theo tài khoản: lịch sử, mốc bảo hiểm và số lượt còn lại của từng đợt.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/soi-doi-tu-anh", "title", "Soi đội từ ảnh — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/soi-doi-tu-anh", "metaDescription", "Soi đội hình từ ảnh chụp và đối chiếu với dữ liệu đội đã được tuyển chọn.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/goi-y-doi-tu-kho", "title", "Gợi ý đội từ kho — Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    ("ui:section-page/goi-y-doi-tu-kho", "metaDescription", "Gợi ý đội từ kho tướng và chiến pháp của bạn, kèm điều kiện và hiệu ứng cần kiểm chứng.", "src/components/pages/SectionPage.astro", "page metadata", "static", "authored-vi"),
    # Header/menu/footer dùng chung (Phase 3): chữ tác giả mới — lớp `authored-vi`, không cần receipt.
    # Nguồn liên kết chính thức: plans/reports/brainstorm-260923-2033-official-game-links-menu.md §1.
    ("ui:layout/logo-title", "brand", "Cẩm Nang Game Tam Quốc Chí - Chiến Lược", "src/layouts/SiteLayout.astro", "header", "static", "authored-vi"),
    ("ui:layout/menu-label", "ariaLabel", "Menu chính", "src/layouts/SiteLayout.astro", "navigation", "static", "authored-vi"),
    ("ui:layout/menu-open", "ariaLabel", "Mở menu trang", "src/layouts/SiteLayout.astro", "navigation", "static", "authored-vi"),
    ("ui:layout/menu-close", "ariaLabel", "Đóng menu", "src/layouts/SiteLayout.astro", "menu mobile", "static", "authored-vi"),
    ("ui:layout/menu-figures", "groupTitle", "Đội hình", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/menu-tools", "navLabel", "Công cụ", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/menu-tools-title", "groupTitle", "Công cụ · Beta", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/menu-game", "navLabel", "Game", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/menu-game-strip", "groupTitle", "Game chính thức", "src/layouts/SiteLayout.astro", "menu mobile", "static", "authored-vi"),
    ("ui:layout/footer-game-subtitle", "groupSubtitle", "Liên kết của nhà phát hành", "src/layouts/SiteLayout.astro", "footer mobile", "static", "authored-vi"),
    ("ui:layout/menu-community-title", "groupTitle", "Cộng đồng game", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/menu-download-title", "groupTitle", "Tải game", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/data-updated", "chipLabel", "Dữ liệu cập nhật", "src/layouts/SiteLayout.astro", "footer", "static", "authored-vi"),
    ("ui:layout/footer-about", "heading", "Về cẩm nang", "src/layouts/SiteLayout.astro", "footer", "static", "authored-vi"),
    ("ui:layout/menu-stats", "linkLabel", "Số liệu cẩm nang", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/menu-stats-desc", "menuDescription", "Quy mô dữ liệu của cẩm nang", "src/layouts/SiteLayout.astro", "menu", "static", "authored-vi"),
    ("ui:layout/cta-open-guide", "ctaLabel", "Mở cẩm nang", "src/layouts/SiteLayout.astro", "header", "static", "authored-vi"),
    ("ui:layout/cta-open-guide-menu", "ctaLabel", "Mở Đội chuẩn", "src/layouts/SiteLayout.astro", "menu mobile", "static", "authored-vi"),
    ("ui:layout/footer-intro", "description", "Cẩm nang cộng đồng cho người chơi Tam Quốc Chí Chiến Lược: đội hình theo mùa, tra cứu tướng và chiến pháp, cùng vài công cụ tính giúp.", "src/layouts/SiteLayout.astro", "footer", "static", "authored-vi"),
    ("ui:layout/footer-copyright", "copyright", "© 2026 Cẩm Nang TQCCL · Cẩm nang tra cứu build tướng dành cho game Tam Quốc Chí - Chiến Lược", "src/layouts/SiteLayout.astro", "footer", "static", "authored-vi"),
    ("ui:layout/footer-credit", "credit", "Nguyễn Nguyên · HLxThanos · Team 2 bang Huynh Đệ", "src/layouts/SiteLayout.astro", "footer", "static", "authored-vi"),
    ("ui:layout/menu-desc-team-chuan", "menuDescription", "Cấu hình đội theo từng mùa", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-team-khac", "menuDescription", "Đội người chơi tổng hợp và đối chiếu", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-coexist", "menuDescription", "Các nhóm đội dùng cùng lúc", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-khaihoang", "menuDescription", "Hướng dẫn đánh đất theo từng đội", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-lookup", "menuDescription", "Xem tướng, chiến pháp, trang bị, quân sư", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-recruit-tracker", "menuDescription", "Mốc bảo hiểm 5★, nhiều tài khoản", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-analyze", "menuDescription", "Đọc đội từ ảnh chụp màn hình", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-desc-roster-recommend", "menuDescription", "Tối đa 5 đội không trùng tài nguyên", "src/layouts/SiteLayout.astro", "SECTION_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-heroes", "menuDescription", "Chỉ số, binh chủng và chiến pháp", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-tactics", "menuDescription", "Hiệu quả và cách dùng chiến pháp", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-equipment", "menuDescription", "Trang bị theo ô và phẩm chất", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-advisors", "menuDescription", "Hiệu ứng và cách dùng quân sư", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-troop-mods", "menuDescription", "Cải tạo binh chủng và gợi ý build", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-buildings", "menuDescription", "Công trình theo cấp và hiệu quả", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/lookup-desc-books", "menuDescription", "Binh thư theo tên Việt và chữ Hán", "src/lib/lookup-pages.ts", "LOOKUP_DESCRIPTIONS", "static", "authored-vi"),
    ("ui:layout/menu-dialog-label", "ariaLabel", "Menu", "src/layouts/SiteLayout.astro", "menu mobile", "static", "authored-vi"),
    ("ui:layout/theme-toggle-to-dark", "ariaLabel", "Chuyển sang giao diện tối", "src/layouts/SiteLayout.astro", "header", "static", "authored-vi"),
    ("ui:layout/theme-toggle-to-light", "ariaLabel", "Chuyển sang giao diện sáng", "src/layouts/SiteLayout.astro", "header", "static", "authored-vi"),
    ("ui:layout/section-noscript", "noscript", "Mục này cần JavaScript để hiển thị nội dung. Hãy bật JavaScript rồi tải lại trang.", "src/layouts/SiteLayout.astro", "noscript", "no-js", "authored-vi"),
    ("ui:official-links/trang-chu-game", "label", "Trang chủ game", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/trang-chu-game", "description", "Website chính thức của nhà phát hành", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/doi-qua", "label", "Đổi quà", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/doi-qua", "description", "Trang đổi thưởng", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/web-nap", "label", "Web nạp", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/web-nap", "description", "Cửa hàng nạp trên web", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/tu-cach-tro-ve", "label", "Tra xem tư cách trở về", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/tu-cach-tro-ve", "description", "Dành cho người chơi quay lại", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/cskh", "label", "Chăm sóc khách hàng", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/cskh", "description", "s3g.service@thienthuonghoa.com", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/fanpage-facebook", "label", "Fanpage Facebook", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/nhom-facebook", "label", "Nhóm Facebook", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/youtube", "label", "YouTube", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/app-store", "label", "App Store", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/google-play", "label", "Google Play", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    ("ui:official-links/may-tinh-windows", "label", "Máy tính (Windows)", "src/lib/official-links.ts", "OFFICIAL_LINKS", "static", "authored-vi"),
    # Landing (Phase 4): chữ tác giả của trang chủ — chuỗi tĩnh trong index.astro và câu có số trong landing-stats.ts.
    ("ui:landing/hero-kicker", "kicker", "Cẩm nang cộng đồng", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-kicker-extra", "kickerAccent", "· Tam Quốc Chí Chiến Lược", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-title", "title", "Mùa này chơi đội nào?", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-title-accent", "titleAccent", "Mở sổ là thấy.", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-standard", "action", "Mở Đội chuẩn", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-check-filter", "check", "Lọc theo mùa, binh, phe", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-check-name", "check", "Tên tướng theo bản game VN", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-check-theme", "check", "Sáng / tối", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-heading", "heading", "Số liệu cẩm nang", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-configs", "label", "cấu hình Đội chuẩn", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-tier0", "label", "cấu hình xếp T0", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-seasons", "label", "t('mùa', '个赛季')", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-heroes", "label", "tướng", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-tactics", "label", "chiến pháp", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/stats-note", "note", "Số liệu mang tính tham khảo, không phải phương án duy nhất.", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/need-kicker", "kicker", "Lối vào nhanh", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/vaults-kicker", "kicker", "Kho đội", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/vaults-title", "heading", "Hai kho đội, một bộ lọc chung", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/vaults-sub", "sub", "Lọc theo mùa, loại binh, phe hoặc gõ tên tướng, chiến pháp, binh thư. Xem dạng thẻ để đọc kỹ, dạng bảng để so nhiều đội cùng lúc.", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/land-coexist-title", "cardTitle", "Cùng Tồn", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/land-khaihoang-title", "cardTitle", "Khai hoang", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/tools-recruit-title", "cardTitle", "Theo dõi chiêu mộ", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/tools-analyze-title", "cardTitle", "Soi đội từ ảnh", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-kicker", "kicker", "Tải game chính thức", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-title", "heading", "Chưa cài game? Tải Tam Quốc Chí – Chiến Lược", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-source-prefix", "description", "Liên kết lấy từ", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-source-link", "link", "website chính thức", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-source-suffix", "description", "của nhà phát hành. Cẩm nang không phân phối bản cài.", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-qr-label", "ariaLabel", "Mã QR tải game", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-qr-caption", "caption", "Quét để tải trên điện thoại", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-store-kicker", "kicker", "Tải về trên", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-exe-title", "title", "Tải xuống phiên bản máy tính", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/download-exe-note", "note", "Windows · tệp cài .exe từ nhà phát hành", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/cta-title", "heading", "Mở cẩm nang, chọn đội cho mùa này.", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/cta-lead", "lead", "Chạy ngay trên trình duyệt, dùng tốt trên điện thoại, có giao diện sáng và tối.", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/cta-action", "action", "Mở cẩm nang", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/hero-lead", "lead", "${viNumber(stats.standardConfigs)} cấu hình đội từ ${viNumber(stats.sourceSeasons)} mùa, ${viNumber(stats.otherTeams)} đội người chơi tổng hợp, cùng ${viNumber(stats.heroes)} tướng và ${viNumber(stats.tactics)} chiến pháp để tra cứu — miễn phí, không cần tài khoản.", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/vaults-standard-count", "countLabel", "${viNumber(stats.standardConfigs)} cấu hình", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/vaults-standard-note", "note", "theo mùa và danh mục, kèm điểm tham khảo.", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/vaults-other-count", "countLabel", "${viNumber(stats.otherTeams)} đội", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/vaults-other-note", "note", "người chơi tổng hợp: ${viNumber(stats.otherTeamsWithCounters)} đội ghi đội sợ, ${viNumber(stats.otherTeamsWithAlternatives)} đội có phương án thay thế.", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/land-coexist-note", "note", "${viNumber(coexist.groups)} nhóm, mỗi nhóm ${viNumber(coexist.teamsPerGroup)} đội dùng cùng lúc — ${viNumber(coexist.heroesPerGroup)} tướng không trùng nhau.", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/land-khaihoang-note", "note", "${viNumber(khaiHoang.teams)} đội mở đất, ${viNumber(khaiHoang.beforeAfterTeams)} đội có đủ cấu hình trước/sau, ${viNumber(khaiHoang.chamSuTeams)} đội Chạm Sứ, cùng quân thủ của ${viNumber(khaiHoang.mines)} mỏ.", "src/lib/landing-stats.ts", "landingCopy", "static", "authored-vi"),
    ("ui:landing/preview-card-label", "ariaLabel", "Ví dụ một thẻ đội", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-card-score-unit", "unit", "điểm", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-card-role-main", "roleLabel", "'CHỦ'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-card-role-deputy-1", "roleLabel", "'PHÓ 1'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-card-role-deputy-2", "roleLabel", "'PHÓ 2'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-card-books-missing", "emptyLabel", "t('Chưa ghi', '未注明')", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-card-link", "action", "'Chi tiết'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-caption", "caption", "Ví dụ chế độ Bảng", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-count", "count", " · ${count} đội", "src/lib/landing-stats.ts", "landingPreviews", "static", "authored-vi"),
    ("ui:landing/preview-tier-title", "title", "TIER_TITLE = 'Tier'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-head-team", "columnHeader", "'Đội'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-head-main", "columnHeader", "'Chủ tướng'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-head-deputy-1", "columnHeader", "'Phó 1'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-head-deputy-2", "columnHeader", "'Phó 2'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    ("ui:landing/preview-table-head-score", "columnHeader", "'Điểm'", "src/components/landing/Landing.astro", "landing", "static", "authored-vi"),
    # Danh sách Đội chuẩn / Đội khác: sidebar lọc, chuyển 2 cột/4 cột/Bảng, thẻ gọn và bảng 5 cột.
    ("ui:recommended/kicker", "kicker", "'Đội hình'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/filter-heading", "heading", "'Bộ lọc'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/clear", "action", "'Xóa lọc'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/season-label", "label", "L('Mùa','赛季')", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-group", "ariaLabel", "'Kiểu hiển thị'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-cards", "label", "label:'Thẻ'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-grid", "label", "label:'Thẻ gọn'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-table", "label", "label:'Bảng'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-cards-aria", "ariaLabel", "'Xem dạng thẻ'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-grid-aria", "ariaLabel", "'Xem dạng thẻ gọn'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/view-table-aria", "ariaLabel", "'Xem dạng bảng'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/facet-unit", "label", "FACET_LABEL={unit:'Loại binh'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/facet-faction", "label", "faction:'Phe'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/facet-subcategory", "label", "subcategory:'Nhóm'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/facet-source", "label", "source:'Bộ đội hình'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/search-placeholder", "placeholder", "'Tìm tướng, chiến pháp, binh thư…'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/empty-match", "empty", "'Không có đội khớp bộ lọc.'", "js/team-filter-section.js", "createRecommendedSection", "empty", "authored-vi"),
    ("ui:recommended/more", "action", "'Xem thêm'", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/more-note", "note", "`Mỗi lượt hiện ${PAGE_SIZE} đội`", "js/team-filter-section.js", "createRecommendedSection", "static", "authored-vi"),
    ("ui:recommended/table-team", "heading", "'Đội'", "js/recommended-reference-render.js", "recommendedTeamTable", "static", "authored-vi"),
    ("ui:recommended/table-main", "heading", "'Chủ tướng'", "js/recommended-reference-render.js", "recommendedTeamTable", "static", "authored-vi"),
    ("ui:recommended/table-vice1", "heading", "'Phó 1'", "js/recommended-reference-render.js", "recommendedTeamTable", "static", "authored-vi"),
    ("ui:recommended/table-vice2", "heading", "'Phó 2'", "js/recommended-reference-render.js", "recommendedTeamTable", "static", "authored-vi"),
    ("ui:recommended/table-score", "heading", "'Điểm'", "js/recommended-reference-render.js", "recommendedTeamTable", "static", "authored-vi"),
    ("ui:recommended/role-main", "label", "'CHỦ'", "js/recommended-reference-render.js", "holderView", "static", "authored-vi"),
    ("ui:recommended/role-vice1", "label", "'PHÓ 1'", "js/recommended-reference-render.js", "holderView", "static", "authored-vi"),
    ("ui:recommended/role-vice2", "label", "'PHÓ 2'", "js/recommended-reference-render.js", "holderView", "static", "authored-vi"),
    ("ui:recommended/books-missing", "text", "'Chưa ghi'", "js/recommended-reference-render.js", "holderView", "empty", "authored-vi"),
    ("ui:recommended/score-unit", "label", "'điểm'", "js/recommended-reference-render.js", "recommendedTeamCard", "static", "authored-vi"),
    ("ui:recommended/score-missing", "text", "'Chưa có điểm'", "js/recommended-reference-render.js", "recommendedTeamCard", "empty", "authored-vi"),
    ("ui:recommended/fear", "label", "'Sợ'", "js/recommended-reference-render.js", "fearLine", "data", "authored-vi"),
    ("ui:recommended/alternatives", "summary", "Thay thế (", "js/recommended-reference-render.js", "alternativesDisclosure", "static", "authored-vi"),
    ("ui:recommended/detail-cta", "action", "'Chi tiết'", "js/recommended-reference-render.js", "recommendedTeamCard", "static", "authored-vi"),
    ("ui:recommended/find-tactic", "title", "'Tìm chiến pháp này'", "js/recommended-reference-render.js", "holderView", "static", "authored-vi"),
    ("ui:recommended/table-missing", "text", "'—'", "js/recommended-reference-render.js", "tableHeroCell", "empty", "authored-vi"),
    ("ui:recommended/source-empty-seat", "ariaLabel", "'Để trống'", "js/recommended-reference-render.js", "sourceEmptySeat", "empty", "authored-vi"),
    # Trang chi tiết đội (Phase 6): khung TeamDetail, panel điểm, thẻ tướng và nút sao chép liên kết.
    ("ui:detail/copy-link", "ariaLabel", "'Sao chép liên kết đội'", "js/detail-actions.js", "copyControl", "static", "authored-vi"),
    ("ui:detail/copy-fallback-label", "ariaLabel", "'Liên kết đội'", "js/detail-actions.js", "copyControl", "static", "authored-vi"),
    ("ui:detail/copied", "message", "'Đã sao chép liên kết'", "js/detail-actions.js", "copyControl", "success", "authored-vi"),
    ("ui:detail/copy-failed", "message", "'Không sao chép tự động được. Liên kết đã được chọn sẵn để bạn tự sao chép.'", "js/detail-actions.js", "copyControl", "error", "authored-vi"),
    ("ui:recommended/detail-lineup", "heading", "'Đội hình'", "js/recommended-reference-render.js", "recommendedTeamDetailContent", "static", "authored-vi"),
    ("ui:recommended/detail-notes", "heading", "'Ghi chú'", "js/recommended-reference-render.js", "detailNotes", "static", "authored-vi"),
    ("ui:recommended/detail-lookup-link", "title", "'Mở trong Tra cứu'", "js/recommended-reference-render.js", "lookupItem", "static", "authored-vi"),
    ("ui:recommended/detail-role-main", "label", "'Chủ tướng'", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-role-vice1", "label", "'Phó tướng 1'", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-role-vice2", "label", "'Phó tướng 2'", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-tactic-label", "label", "'Chiến pháp'", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-books-label", "label", "'Binh thư'", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-bonds-label", "label", "'Duyên phận'", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-stat-note", "label", "Lưu ý: ", "js/recommended-reference-render.js", "detailHeroCard", "static", "authored-vi"),
    ("ui:recommended/detail-missing", "text", "'Chưa có dữ liệu'", "js/recommended-reference-render.js", "detailHeroCard", "empty", "authored-vi"),
    ("ui:route-recommended/score-label", "label", "t('Điểm', '评分')", "src/components/pages/RecommendedDetail.astro", "score panel", "static", "authored-vi"),
    ("ui:route-recommended/score-source", "label", "tổng hợp", "src/components/pages/RecommendedDetail.astro", "score panel", "static", "authored-vi"),
    ("ui:route-recommended/tier-label", "title", "title=\"Tier\"", "src/components/pages/RecommendedDetail.astro", "header", "static", "authored-vi"),
    ("ui:lookup/kicker", "kicker", "Tra cứu", "src/components/pages/LookupGroupPage.astro", "page header", "static", "authored-vi"),
    ("ui:lookup/title", "title", "<h1 class=\"reference-title\">{t('Tra cứu'", "src/components/pages/LookupHubPage.astro", "page header", "static", "authored-vi"),
    ("ui:lookup/lead", "lead", "Tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng, công trình và binh thư — tìm bằng tên Việt, Hán-Việt hoặc chữ Hán.", "src/components/pages/LookupHubPage.astro", "page header", "static", "authored-vi"),
    ("ui:lookup/search-aria", "ariaLabel", "t(`Tìm ${LOOKUP_GROUP_UNITS[group]}`", "src/components/pages/LookupGroupPage.astro", "search", "static", "authored-vi"),
    ("ui:lookup/search-placeholder", "placeholder", "`Tìm ${LOOKUP_GROUP_UNITS[group]}… (gõ không dấu hoặc chữ Hán đều được)`", "src/components/pages/LookupGroupPage.astro", "search", "static", "authored-vi"),
    ("ui:lookup/group-aria", "ariaLabel", "t('Nhóm tra cứu'", "src/components/pages/LookupGroupPage.astro", "group links", "static", "authored-vi"),
    ("ui:lookup/hint-cards", "hint", '" · bấm để mở hồ sơ"', "js/unified-lookup.js", "lookupSummaryTrees", "static", "authored-vi"),
    ("ui:lookup/hint-table", "hint", '" · bấm tên để mở hồ sơ"', "js/unified-lookup.js", "lookupSummaryTrees", "static", "authored-vi"),
    ("ui:lookup/unit-heroes", "unit", 'heroes: "tướng"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/unit-tactics", "unit", 'tactics: "chiến pháp"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/unit-equipment", "unit", 'equipment: "trang bị"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/unit-advisors", "unit", 'advisors: "quân sư"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/unit-troop-mods", "unit", '"troop-mods": "cải tạo binh chủng"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/unit-buildings", "unit", 'buildings: "công trình"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/unit-books", "unit", 'books: "binh thư"', "js/unified-lookup.js", "LOOKUP_GROUP_UNITS", "static", "authored-vi"),
    ("ui:lookup/book-former-names", "label", 'L("Tên cũ", "旧名")', "js/lookup-detail.js", "bookProfile", "static", "authored-vi"),
    ("ui:lookup/more", "action", '"Xem thêm"', "js/unified-lookup.js", "lookupMoreTrees", "static", "authored-vi"),
    ("ui:lookup/more-note", "note", "`Mỗi lượt hiện ${PAGE_SIZE} kết quả`", "js/unified-lookup.js", "lookupMoreTrees", "static", "authored-vi"),
    ("ui:lookup/empty", "empty", '"Không có kết quả phù hợp."', "js/lookup-page.js", "initLookupPage", "empty", "authored-vi"),
    ("ui:lookup/unavailable", "message", '"Mục tra cứu đang được cập nhật."', "js/lookup-page.js", "initLookupPage", "empty", "authored-vi"),
    ("ui:lookup/profile-loading", "status", '"Đang tải hồ sơ…"', "js/lookup-page.js", "initLookupPage", "static", "authored-vi"),
    ("ui:lookup/close", "ariaLabel", '"Đóng hồ sơ"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/badge-cost", "label", '`Thống ngự ${record.cost}`', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/fact-role", "label", '[L("Vai trò", "定位"), valueText(fieldByKey(profile, "roleTagViet"), "")]', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/fact-title", "label", '"Danh hiệu độc quyền"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/fact-traits", "label", '"Đặc tính"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/section-stats", "heading", '"Chỉ số"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/section-aptitudes", "heading", '"Thích tính binh chủng"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/section-conditions", "heading", '"Điều kiện"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/section-revisions", "heading", '"Lịch sử cập nhật"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/revision-fallback", "text", '"Đã ghi nhận cập nhật"', "js/lookup-profile.js", "revisionText", "empty", "authored-vi"),
    ("ui:lookup/missing-value", "text", 'const MISSING = "—"', "js/unified-lookup.js", "tacticTableRow", "empty", "authored-vi"),
    ("ui:lookup/table-name", "heading", '"Chiến pháp"', "js/unified-lookup.js", "TABLE_HEADS", "static", "authored-vi"),
    ("ui:lookup/table-quality", "heading", '"Phẩm"', "js/unified-lookup.js", "TABLE_HEADS", "static", "authored-vi"),
    ("ui:lookup/table-type", "heading", '"Loại"', "js/unified-lookup.js", "TABLE_HEADS", "static", "authored-vi"),
    ("ui:lookup/table-effect", "heading", '"Hiệu quả"', "js/unified-lookup.js", "TABLE_HEADS", "static", "authored-vi"),
    ("ui:lookup/table-target", "heading", '"Mục tiêu"', "js/unified-lookup.js", "TABLE_HEADS", "static", "authored-vi"),
    ("ui:lookup/table-rate", "heading", '"Tỷ lệ"', "js/unified-lookup.js", "TABLE_HEADS", "static", "authored-vi"),
    ("ui:lookup/cam-nang-heading", "heading", '"Trong cẩm nang"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-note", "note", "Tính từ đội chuẩn và đội khác đang có · mọi mùa", "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-loading", "status", '"Đang tải số liệu đội hình…"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-empty", "empty", '"Chưa có trong đội nào."', "js/lookup-profile.js", "createProfileRenderer", "empty", "authored-vi"),
    ("ui:lookup/cam-nang-failed", "error", '"Chưa tải được số liệu Trong cẩm nang."', "js/lookup-profile.js", "createProfileRenderer", "error", "authored-vi"),
    ("ui:lookup/cam-nang-appearance", "heading", '"Xuất hiện trong"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-standard-unit", "unit", '"đội chuẩn"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-other-unit", "unit", '"đội khác"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-tactics", "heading", '"Chiến pháp hay mang"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-books", "label", '["Binh thư hay dùng (", String(view.books.teams), " đội)"]', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-stat-focus", "label", '["Hướng điểm hay dùng (", String(view.statFocus.teams), " đội)"]', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-teams", "heading", '"Đội tiêu biểu"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/cam-nang-find", "action", '"Tìm tướng này trong Đội chuẩn"', "js/lookup-profile.js", "createProfileRenderer", "static", "authored-vi"),
    ("ui:lookup/position-main", "label", '"Chủ tướng"', "js/unified-lookup.js", "POSITION_LABELS", "static", "authored-vi"),
    ("ui:lookup/position-vice1", "label", '"Phó tướng 1"', "js/unified-lookup.js", "POSITION_LABELS", "static", "authored-vi"),
    ("ui:lookup/position-vice2", "label", '"Phó tướng 2"', "js/unified-lookup.js", "POSITION_LABELS", "static", "authored-vi"),
    ("ui:lookup/hero-civil-points", "label", '"Điểm nội chính"', "js/lookup-detail.js", "heroProfile", "static", "authored-vi"),
    ("ui:lookup/hero-collectible-bonus", "label", '"Thưởng sưu tầm"', "js/lookup-detail.js", "heroProfile", "static", "authored-vi"),
    ("ui:lookup/hero-red-rules", "label", '"Quy tắc điểm đỏ"', "js/lookup-detail.js", "heroProfile", "static", "authored-vi"),
    ("ui:lookup/option-converts", "label", '`Chuyển thành ${item.convertsToVi}`', "js/lookup-profile.js", "createProfileRenderer", "data", "authored-vi"),
    # 3 công cụ Beta (Phase 9): chữ tác giả mới trong phần render của công cụ — lớp `authored-vi`.
    ("ui:recruit/kicker", "kicker", "Công cụ · Beta", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/title", "title", "Theo dõi chiêu mộ", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/lead", "lead", "Đếm lượt tới mốc bảo hiểm 5★ cho từng tài khoản và ghi lại tướng 5★ đã ra.", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/storage-notice", "notice", "Dữ liệu chỉ lưu trong trình duyệt này và có thể mất khi xóa dữ liệu trang. Dùng ", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/export", "action", "Xuất JSON", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/import", "action", "Nhập JSON", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/account-menu-label", "ariaLabel", "Tùy chọn tài khoản", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/pity-meter-label", "ariaLabel", "Tiến độ bảo hiểm 5★", "js/recruit-tracker.js", "initRecruitTracker", "data", "authored-vi"),
    ("ui:recruit/daily-sub", "sub", "4 lượt miễn phí / nửa giá mỗi ngày", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/pity-meta-lead", "meta", "hôm nay còn ${remainingToday} lượt rẻ", "js/recruit-tracker.js", "paintPity", "data", "authored-vi"),
    ("ui:recruit/limited-title", "title", "Gói hạn giờ / Đột xuất", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/limited-add", "action", "Thêm gói", "js/recruit-tracker.js", "initRecruitTracker", "static", "authored-vi"),
    ("ui:recruit/banner-pity-note", "note", "Bảo hiểm riêng của gói", "js/recruit-tracker.js", "paintBanners", "data", "authored-vi"),
    ("ui:recruit/banner-progress", "label", "Tiến độ", "js/recruit-tracker.js", "paintBanners", "data", "authored-vi"),
    ("ui:recruit/banner-meter-aria", "ariaLabel", "Tiến độ bảo hiểm 5★ · ", "js/recruit-tracker.js", "paintBanners", "data", "authored-vi"),
    ("ui:recruit/form-title", "title", "Ghi tướng vừa ra", "js/recruit-tracker.js", "paintForm", "data", "authored-vi"),
    ("ui:recruit/form-hero", "label", "Tướng", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:recruit/form-date", "label", "Ngày", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:recruit/form-pulls", "label", "Số lượt", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:recruit/form-class", "label", "Phân loại", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:recruit/form-note", "label", "Ghi chú", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:recruit/form-save", "action", "Lưu 5★", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:recruit/form-close", "action", "Đóng", "js/recruit-tracker.js", "paintForm", "static", "authored-vi"),
    ("ui:analyze/kicker", "kicker", "Công cụ · Beta", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/title", "title", "Soi đội từ ảnh", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/lead", "lead", "Chụp màn hình đội hình hoặc nhập tay, kiểm tra từng ô rồi đối chiếu với Đội chuẩn theo mùa và Đội khác.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/pick-step", "title", "1 · Chọn ảnh", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/read-step", "title", "2 · Kiểm tra đội", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/similar-step", "title", "3 · Đội có sẵn tương tự", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/read-note", "note", "Sửa mọi ô cho đúng game. Ô “Không chắc” chọn một gợi ý hoặc gõ lại; ô chiến pháp, binh thư có thể để trống.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/similar-note", "note", "Theo số tướng rồi số chiến pháp khớp", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/drop-title", "title", "Kéo thả ảnh, dán (Ctrl+V) hoặc bấm để chọn", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/drop-note", "note", "PNG, JPEG hoặc WebP · nên crop chỉ phần đội hình", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/preview-alt", "alt", "Ảnh đã chọn", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/file-ready", "note", "Đã nén · sẵn sàng gửi", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/pick-another", "action", "Chọn ảnh khác", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/steps-aria", "ariaLabel", "Trạng thái", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/step-compress", "step", "Nén ảnh", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/step-turnstile", "step", "Xác thực chống bot", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/step-run", "step", "Soi đội và đối chiếu", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/step-done", "step", "Đã đọc xong — kiểm tra lại kết quả đã đọc", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/flag-check", "label", "Không chắc", "js/analyze.js", "initAnalyze", "data", "authored-vi"),
    ("ui:analyze/compressing", "status", "Đang nén ảnh…", "js/analyze.js", "initAnalyze", "status", "authored-vi"),
    ("ui:analyze/running", "status", "Đang soi đội…", "js/analyze.js", "initAnalyze", "status", "authored-vi"),
    ("ui:analyze/invalid-response", "error", "Phản hồi không hợp lệ, thử lại.", "js/analyze.js", "initAnalyze", "error", "authored-vi"),
    ("ui:analyze/setup-missing", "message", "Tính năng soi đội chưa được cấu hình.", "js/analyze.js", "initAnalyze", "error", "authored-vi"),
    ("ui:analyze/setup-hint", "message", "Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/turnstile-error", "error", "Xác thực chống bot không thành công. Tải lại trang rồi thử lại.", "js/turnstile.js", "renderTurnstileWidget", "error", "authored-vi"),
    ("ui:analyze/ai-service-error", "error", "Dịch vụ AI đang gặp sự cố. Thử lại sau ít phút.", "js/analyze.js", "localizeWorkerError", "error", "authored-vi"),
    ("ui:analyze/ai-overloaded", "error", "Dịch vụ AI đang quá tải. Đợi vài phút rồi thử lại.", "js/analyze.js", "localizeWorkerError", "error", "authored-vi"),
    ("ui:analyze/worker-unconfigured", "error", "Dịch vụ soi ảnh chưa sẵn sàng. Thử lại sau.", "js/analyze.js", "localizeWorkerError", "error", "authored-vi"),
    ("ui:roster/kicker", "kicker", "Công cụ · Beta", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/title", "title", "Gợi ý đội từ kho", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/lead", "lead", "Đọc ảnh kho tướng và chiến pháp, kiểm tra lại, rồi để công cụ cục bộ chọn tối đa 5 đội không trùng tài nguyên từ Đội chuẩn của mùa bạn đang chơi.", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/steps-aria", "ariaLabel", "Các bước", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/step-scan", "step", "Đọc kho", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/step-review", "step", "Kiểm tra", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/step-suggest", "step", "Gợi ý", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/step-caps", "caps", "Bước ${index + 1}", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/scan-count", "count", "${total} ${scan.unit} đã đọc", "js/roster-recommend-ui.js", "paintScanCards", "data", "authored-vi"),
    ("ui:roster/scan-done", "state", "Đọc lại", "js/roster-recommend-ui.js", "paintScanCards", "data", "authored-vi"),
    ("ui:roster/scan-pending", "state", "Chưa đọc", "js/roster-recommend-ui.js", "paintScanCards", "data", "authored-vi"),
    ("ui:roster/scan-pick-file", "status", "Chưa có ảnh", "js/roster-recommend-ui.js", "initRosterRecommend", "status", "authored-vi"),
    ("ui:roster/scan-pick-action", "action", 'L("Chọn ảnh", "选择图片")', "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/scan-token-first", "status", "Xác thực Turnstile trước.", "js/roster-recommend-ui.js", "initRosterRecommend", "status", "authored-vi"),
    ("ui:roster/scan-status", "status", "Đã đọc xong. Kiểm tra lại dữ liệu bên dưới.", "js/roster-recommend-ui.js", "initRosterRecommend", "status", "authored-vi"),
    ("ui:roster/review-toggle", "action", "Sửa kho đã đọc", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/heroes-heading", "heading", "Tướng đã đọc", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/tactics-heading", "heading", "Chiến pháp đã đọc", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/add-placeholder", "placeholder", "Thêm tướng ảnh chưa đọc ra…", "js/roster-recommend-ui.js", "addControl", "static", "authored-vi"),
    ("ui:roster/add-action", "action", "Thêm", "js/roster-recommend-ui.js", "addControl", "static", "authored-vi"),
    ("ui:roster/remove-aria", "ariaLabel", "Bỏ ", "js/roster-recommend-ui.js", "itemList", "data", "authored-vi"),
    ("ui:roster/flag-check", "label", 'L("kiểm tra", "待核对")', "js/roster-recommend-ui.js", "itemList", "data", "authored-vi"),
    ("ui:roster/locked-empty", "empty", "Chưa có đội khóa.", "js/roster-recommend-ui.js", "teamList", "empty", "authored-vi"),
    ("ui:roster/locked-heroes", "label", "Tướng: ", "js/roster-recommend-ui.js", "teamList", "data", "authored-vi"),
    ("ui:roster/locked-tactics", "label", "Chiến pháp: ", "js/roster-recommend-ui.js", "teamList", "data", "authored-vi"),
    ("ui:roster/locked-remove", "action", "Bỏ đội", "js/roster-recommend-ui.js", "teamList", "static", "authored-vi"),
    ("ui:roster/locked-remove-aria", "ariaLabel", "Bỏ đội ${team.teamName}", "js/roster-recommend-ui.js", "teamList", "data", "authored-vi"),
    ("ui:roster/clear-all", "action", "Xóa toàn bộ kho", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/clear-all-confirm", "confirm", "Xóa toàn bộ kho đã đọc (tướng, chiến pháp, đội khóa)? Không hoàn tác được.", "js/roster-recommend-ui.js", "initRosterRecommend", "prompt", "authored-vi"),
    ("ui:roster/add-heading", "heading", "Danh sách đội sau khi xây dựng", "js/roster-recommend-ui.js", "renderRecommendation", "static", "authored-vi"),
    ("ui:roster/portfolio-empty", "empty", "Chưa có đội nào xây dựng được từ kho hiện tại.", "js/roster-recommend-ui.js", "renderRecommendation", "empty", "authored-vi"),
    ("ui:roster/add-full", "empty", "Đã đủ ${MAX_TEAMS} đội", "js/roster-recommend-ui.js", "renderRecommendation", "empty", "authored-vi"),
    ("ui:roster/add-empty", "empty", "Chưa có đội phù hợp để thêm từ kho hiện tại.", "js/roster-recommend-ui.js", "renderRecommendation", "empty", "authored-vi"),
    ("ui:roster/result-tactics", "label", 'L("Chiến pháp", "战法")', "js/roster-recommend-ui.js", "renderRecommendation", "data", "authored-vi"),
    ("ui:roster/result-variants", "label", "Đã thay:", "js/roster-recommend-ui.js", "renderRecommendation", "data", "authored-vi"),
    ("ui:roster/setup-missing", "message", "Tính năng gợi ý đội từ kho chưa được cấu hình.", "js/roster-recommend-ui.js", "initRosterRecommend", "error", "authored-vi"),
    ("ui:roster/setup-hint", "message", "Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js.", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    # Gợi ý theo mùa + mục Thiếu món + "Vì sao?" (plans/260929-0415-goi-y-doi-theo-mua).
    ("ui:roster/ai-note", "note", "AI chỉ đọc ảnh, và chỉ giải thích món bù khi bạn hỏi. Đội được chọn bằng công cụ cục bộ từ dữ liệu đã tuyển chọn.", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/season-label", "label", "Mùa bạn đang chơi", "js/roster-recommend-ui.js", "initRosterRecommend", "static", "authored-vi"),
    ("ui:roster/season-loading", "status", "Đang tải mùa…", "js/roster-recommend-ui.js", "initRosterRecommend", "status", "authored-vi"),
    ("ui:roster/season-none", "empty", "Không có dữ liệu mùa", "js/roster-recommend-ui.js", "initRosterRecommend", "error", "authored-vi"),
    ("ui:roster/season-unavailable", "error", "Không tải được đội chuẩn theo mùa. Gợi ý tạm dùng đội cũ để tham khảo.", "js/roster-recommend-ui.js", "initRosterRecommend", "error", "authored-vi"),
    ("ui:roster/legacy-badge", "label", "Tham khảo – đội cũ", "js/roster-recommend-ui.js", "renderRecommendation", "data", "authored-vi"),
    ("ui:roster/legacy-note", "note", "Mùa đang chọn chưa đủ đội xây được từ kho: đội cũ được thêm để tham khảo, xếp sau đội của mùa.", "js/roster-recommend-ui.js", "renderRecommendation", "success", "authored-vi"),
    ("ui:roster/clear-override", "action", "Bỏ món thay", "js/roster-recommend-ui.js", "renderRecommendation", "success", "authored-vi"),
    ("ui:roster/idle-override", "note", "Món bù đã chọn cho ${team.name} chưa đưa đội vào danh sách.", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/missing-heading", "heading", "Thiếu món", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/missing-note", "note", "Đội mạnh của mùa chỉ còn thiếu vài món, đội thiếu ít nhất đứng trước. Nếu bạn có món đó mà ảnh chưa đọc ra, bấm “Tôi có…”.", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/missing-empty", "empty", "Không có đội mạnh nào của mùa đang thiếu món.", "js/roster-recommend-ui.js", "renderRecommendation", "empty", "authored-vi"),
    ("ui:roster/missing-hero", "label", 'Thiếu tướng ${names.join(" / ")}', "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/missing-tactic", "label", "Thiếu chiến pháp ${slot.tactic} (${slot.holderName})", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/have-hero", "action", "Tôi có tướng này", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/have-hero-aria", "ariaLabel", "Tôi có tướng ${name}", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/have-tactic", "action", "Tôi có chiến pháp này", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/have-tactic-aria", "ariaLabel", "Tôi có chiến pháp ${name}", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/substitutes-aria", "ariaLabel", "Món bù có trong kho", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/substitute-count", "count", "${configCount} cấu hình cùng mùa", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/use-substitute", "action", "Dùng món này", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/use-substitute-aria", "ariaLabel", "Dùng ${tactic} thay ${slot.tactic}", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/no-substitute", "empty", "Kho chưa có món bù từ đội cùng mùa.", "js/roster-recommend-ui.js", "renderRecommendation", "empty", "authored-vi"),
    ("ui:roster/why", "action", "Vì sao?", "js/roster-recommend-ui.js", "renderRecommendation", "conflict", "authored-vi"),
    ("ui:roster/explain-running", "status", "Đang hỏi AI…", "js/roster-recommend-ui.js", "explainSubstitute", "status", "authored-vi"),
    ("ui:roster/explain-rejected", "error", "Chưa giải thích được món bù này. Hãy đối chiếu hiệu ứng trong Tra cứu.", "js/roster-recommend-ui.js", "explainSubstitute", "error", "authored-vi"),
    ("ui:roster/explain-error", "error", "Chưa giải thích được lúc này. Thử lại sau.", "js/roster-recommend-ui.js", "explainSubstitute", "error", "authored-vi"),
    ("ui:analyze/explain-error", "error", "Chưa giải thích được lúc này. Thử lại sau.", "js/analyze.js", "localizeWorkerError", "error", "authored-vi"),
    ("ui:analyze/disclaimer", "note", "Site chỉ đếm ẩn danh số ô bạn phải sửa (không ảnh, không tên); ", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-left", "label", "Phe trái · ta", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-right", "label", "Phe phải · đối thủ", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-aria", "ariaLabel", "Chọn phe cần soi", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-run", "action", "Soi phe này", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-step", "title", "2 · Chọn phe", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-note", "note", "Ảnh có cả hai phe. Chọn phe muốn soi; có thể đổi sang phe kia sau mà không cần đọc lại ảnh.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/side-switch-aria", "ariaLabel", "Đổi phe", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/sample-send", "action", "Gửi ảnh này", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/sample-consent", "label", "Tôi đồng ý gửi ảnh này cùng đội đã xác nhận cho quản trị viên để cải thiện AI đọc ảnh.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/sample-title", "title", "Giúp AI đọc đúng hơn", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/sample-note", "note", "Tuỳ chọn. Ảnh chỉ được lưu khi bạn bấm gửi và được quản trị viên duyệt trước khi dùng.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/sample-login", "message", "Đăng nhập để gửi ảnh cho quản trị viên.", "js/analyze.js", "initAnalyze", "static", "authored-vi"),
    ("ui:analyze/sample-sent", "status", "Đã gửi, cảm ơn bạn.", "js/analyze.js", "initAnalyze", "status", "authored-vi"),
    ("ui:analyze/sample-need-confirm", "status", "Hãy xác nhận đủ đội trước khi gửi ảnh.", "js/analyze.js", "initAnalyze", "status", "authored-vi"),
    ("ui:analyze/sample-sending", "status", "Đang gửi…", "js/analyze.js", "initAnalyze", "status", "authored-vi"),
    ("ui:analyze/slow-read", "status", "AI đang đọc kỹ ảnh này, có thể mất thêm chút thời gian…", "js/analyze.js", "initAnalyze", "status", "authored-vi"),
)


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
    return canonical_json(corpus).encode()


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
        raise ValueError("policy must cover all three standalone detail route families")

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
        # Historical outputs stay immutable; a receipt claims every output location
        # that remains active in the independently inventoried translation ledger.
        if set(receipt_keys) != set(results).intersection(entries):
            problems.append({"location": where, "reason": "receipt locations do not match active captured reviewer locations"})
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

def ui_source_locations(root, ledger_relative, obligations=UI_LITERAL_OBLIGATIONS):
    locations = []
    missing = []
    try:
        ledger = json.loads(_repo_member(root, ledger_relative, label="UI translation ledger").read_bytes())
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



def concrete_site_locations(root, pack, ledger_relative):
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
    ui_locations, missing_literals = ui_source_locations(root, ledger_relative)
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
        # Khóa nối "Trong cẩm nang" (Phase 7) là kho Tra cứu vừa dựng trong cùng candidate, không phải
        # bản đang phát trên đĩa — số liệu không thể lệch với `data/heroes-dict.json` sau publish.
        catalog_bytes=(lookup_root / "heroes-dict.json").read_bytes(),
        tactic_catalog_bytes=(lookup_root / "tactics.json").read_bytes(),
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


def prune_generations(root):
    """Delete every Recommended generation directory except the one current.json pins."""
    root = Path(root).resolve(strict=True)
    recommended_root = _repo_member(root, "src/data/recommended-reference")
    generation_id = json.loads((recommended_root / "current.json").read_bytes())["generationId"]
    if not isinstance(generation_id, str) or not re.fullmatch(r"[0-9a-f]{64}", generation_id):
        raise ValueError(f"invalid pinned Recommended generation id: {generation_id!r}")
    if not (recommended_root / generation_id).is_dir():
        raise ValueError(f"pinned Recommended generation is missing: {generation_id}")
    removed = sorted(
        entry.name for entry in recommended_root.iterdir()
        if entry.is_dir() and not entry.is_symlink() and entry.name != generation_id
    )
    for name in removed:
        shutil.rmtree(recommended_root / name)
    return {"kept": generation_id, "removed": removed}


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
    concrete = concrete_site_locations(root, pack, policy["artifacts"]["ledger"])
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
    concrete = concrete_site_locations(root, pack, policy["artifacts"]["ledger"])
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

    pruner = commands.add_parser("prune", help="delete Recommended generations other than the pinned one")
    pruner.add_argument("--root", default=ROOT, type=Path)

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
    if args.command == "prune":
        _emit({"schemaVersion": SCHEMA_VERSION, "command": "prune", **prune_generations(args.root)})
        return 0
    report = check(args.root, stage=args.stage, candidate=args.candidate)
    _emit(report)
    return report["exitCode"]


if __name__ == "__main__":
    raise SystemExit(main())
