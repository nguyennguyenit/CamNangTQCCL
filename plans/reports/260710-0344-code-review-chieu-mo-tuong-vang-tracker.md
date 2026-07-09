---
type: code-review-report
date: 2026-07-10
topic: chieu-mo-tuong-vang-tracker
status: pass-after-fixes
skill: ck:code-review
---

# Code Review: Theo dõi chiêu mộ tướng vàng

## Verdict

PASS AFTER FIXES.

## Stage 1 - Spec Compliance

| Requirement | Status | Evidence |
|---|---|---|
| New tab `Theo dõi chiêu mộ` | Pass | `index.html`, `js/app.js` add `recruit-tracker` section |
| Multi-account | Pass | `createAccount`, `renameAccount`, `deleteAccount`, active account select |
| `Danh tướng PK` 4 daily slots | Pass | `DAILY_SLOT_DEFS`, daily UI slot grid |
| Slot states `pending/miss/fiveStar` | Pass | Store tests + CSS status classes |
| Pity 30 by `account + banner` | Pass | `getPity`, focused tests for account/banner isolation |
| Limited banners | Pass | `createLimitedBanner`, UI `+1`, `+5`, `Ra 5★` |
| History 5★ | Pass | `getFiveStarHistory`, UI history list |
| Hero autocomplete + free-text | Pass | `datalist` from `heroes-dict`, input not restricted to list |
| Export/import JSON | Pass | Blob export, import validation + confirm before overwrite |
| Corrupt storage fallback | Pass | Store test covers corrupt localStorage |
| Excluded scope | Pass | No `Tướng tài PK`, OCR, cloud sync, 5+1 core pity UI |

## Stage 2 - Code Quality Findings

### Fixed

1. Medium - Missing delete account UI.
   - Problem: store supported `deleteAccount`, but UI only exposed create/rename.
   - Fix: added `Xóa acc` action with confirm and one-account guard.

2. Medium - Tracker layout too dense on mobile.
   - Problem: four daily slots and form stayed in desktop grid under mobile breakpoint.
   - Fix: added responsive rules for account bar, section heads, limited rows, slot grid, and form.

## Stage 3 - Adversarial Review

No accepted findings remain.

Checked:

- XSS/data injection: dynamic strings are rendered through `el()` text nodes or attributes, not raw `innerHTML`.
- Import corruption: JSON is parsed and validated before overwrite; invalid file leaves current state untouched.
- Pity corruption: pull events are source of truth; selectors derive pity by account/banner.
- Timezone: daily key uses browser local date, not UTC slicing.
- Resource scope: no image/base64 storage, no dependency added.

Residual low risk:

- Huge manually imported JSON could temporarily freeze browser during parse. This is local user-controlled import, not network-exposed; acceptable for phase đầu.

## Verification Evidence

- `node --check js/recruit-tracker.js && node --check js/recruit-tracker-store.js && node --check js/app.js` pass.
- `node --test "tests-js/*.test.mjs"` pass: 67 tests.
- `python3 -m unittest discover -s tests` pass: 80 tests.
- `cd worker && npm test` pass: 42 tests.
- `cd worker && npm run typecheck` pass.
- Local HTTP smoke on port 8765: `/`, `/js/app.js`, `/js/recruit-tracker.js`, `/js/recruit-tracker-store.js`, `/css/styles.css`, `/data/heroes-dict.json` all 200; HTML contains tracker tab and section.

## Unresolved Questions

None.
