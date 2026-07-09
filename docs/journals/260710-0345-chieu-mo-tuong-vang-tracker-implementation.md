---
date: 2026-07-10
topic: chieu-mo-tuong-vang-tracker-implementation
type: implementation-journal
---

# Chiêu mộ tướng vàng tracker implementation

## Summary

Implemented local-first `Theo dõi chiêu mộ` tab. The tracker supports multiple accounts, `Danh tướng PK` daily slots, limited banners, pity 30, 5★ history, free-text hero names, and JSON export/import.

## Key Decisions

- Pity is derived from `pullEvents`, not stored as fragile counter.
- `Tướng tài PK`, OCR, cloud sync, “chiêu mộ tiếp 2 lần”, and 5+1 core pity stayed out of phase đầu.
- Import is overwrite-only with validation + confirm.
- Hero input uses datalist but accepts unknown heroes like `SP Quan Vũ`.

## Verification

- JS tests: 67 pass.
- Python tests: 80 pass.
- Worker tests: 42 pass.
- Worker typecheck: pass.
- HTTP smoke: tracker tab/section and assets respond 200.

## Follow-up

- Real browser visual QA can polish spacing further if desired.
- Merge import remains deferred.

## Unresolved Questions

None.
