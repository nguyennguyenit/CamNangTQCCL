---
phase: 3
title: "Schema effectZhSource và allowlist MCP"
status: pending
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 3 — Schema `effectZhSource` và allowlist MCP

<!-- Updated: Red Team 2026-10-20 - builder tính nguồn gốc (sgsdeck/zhEffects/missing), chặn baseline cũ không có zhEffects, thêm kind capture, viSha256 mọi loại, ref/note riêng tư, kiểm text/URL chặt, phase này chỉ code + fixture (dữ liệu chuyển ở phase 04) -->

## Mục tiêu
Builder biết nguồn gốc thật của từng hiệu ứng chữ Hán; đầu vào duy nhất `zhEffects` thay `newTactics.effectZh`; công khai `lookup.effectZhSource` chỉ có `kind`; validator Python + JS kiểm chặt; MCP giữ trường qua allowlist. Phase này **chỉ sửa code, test, fixture** — không đổi `pipeline/lookup-client-tactics.json` thật (phase 04 làm cùng kết quả tra).

## Bằng chứng
- `pipeline/build_unified_lookup.py`: `TACTIC_LOOKUP_KEYS :55`; shape file client `:1046-1053`; `_client_tactic_text :1062-1066`; `newTactics` `:1115-1140` (key-set `:1118`, `effect_zh` `:1129`, lookup `:1134-1136`, ledger payload `:1140`); vòng chiến pháp có sẵn `:1142-1185` (`effectViet` gán ở `_apply_client_effect :1079` từ `:1182-1184`, pending `:1185`); baseline: không nguồn `:1408-1416` (`row = dict(old_tactics[owner])`), có nguồn `:1426-1434` (`usable_source_effect … effect = usable_source_effect or row.get("effect")`); validator `:1710-1739`; field ledger `record() :1097-1107`, disposition `:2120`.
- 3 dòng baseline hiện xuất bản chữ Hán không từ SGSDeck: `tactic:nhanh-tri-dong-nao`, `tactic:luc-luc-thuong-quoc` (SGSDeck `待補充`), `tactic:vo-song-thuong-tuong` (không có trong SGSDeck); test cố ý `tests/test_build_unified_lookup.py:136-138`.
- Quy tắc riêng tư: `docs/unified-lookup.md:14`; test `tests/test_build_unified_lookup.py:341-347`; gate MCP `mcp-worker/test/data/publication-snapshot.test.ts:350-352` (không chứa "sgsdeck").
- URL chặt có sẵn: `pipeline/build_season_data.py:118-126` `source_url()` (chặn userinfo, khoảng trắng), test `tests/test_build_season_data.py:144`.
- `js/lookup-data.js:12`, `:109-115`. `mcp-worker/src/data/publication-builder.ts:239-242`, `:291`.
- Fixture đủ khoá (4): `tests-js/fixtures/lookup-bundle-fixtures.mjs:36-40`, `tests-js/unified-lookup.test.mjs:51-56`, `tests-e2e/season-lookup.spec.mjs:96-99`, `mcp-worker/test/fixtures/lookup-roots.ts:103-107`.

## File
- Sửa: `pipeline/build_unified_lookup.py`
- Sửa (nếu chuyển helper): `pipeline/build_season_data.py` → `pipeline/common.py` cho `source_url()` (giữ nguyên hành vi, cập nhật import)
- Sửa: `js/lookup-data.js`
- Sửa: `mcp-worker/src/data/publication-builder.ts`
- Sửa test: `tests/test_build_unified_lookup.py`, `tests-js/lookup-data.test.mjs`, `tests-js/fixtures/lookup-bundle-fixtures.mjs`, `tests-js/unified-lookup.test.mjs`, `tests-e2e/season-lookup.spec.mjs`, `mcp-worker/test/fixtures/lookup-roots.ts`, `mcp-worker/test/data/publication-snapshot.test.ts`

## Thiết kế
**Đầu vào** (`pipeline/lookup-client-tactics.json`, khoá cấp cao `zhEffects`):
```json
"zhEffects": {
  "tactic:ap-che": {"text": "…", "viSha256": "<64hex>", "source": {"kind": "translation"}},
  "tactic:tran-ap-khan-vang": {"text": "…", "viSha256": "<64hex>", "source": {"kind": "source", "ref": "https://sanzhan.slgsim.com/…"}},
  "tactic:tinh-giai-phien-ve": {"text": "…", "viSha256": "<64hex>", "source": {"kind": "capture", "note": "client TW 訓兵場 2026-10-17"}}
}
```
- Shape check `:1046-1053` thêm `zhEffects` (dict, có thể rỗng).
- Mỗi mục: khoá đúng `{text, viSha256, source}`; `viSha256` 64 hex thường; `source` đúng một dạng: `{kind:"source", ref}` (`ref` qua `source_url()` + host thuộc allowlist `{"sanzhan.slgsim.com", "forum.gamer.com.tw"}`; host khác → lỗi), `{kind:"capture", note}` (`note` chuỗi ≤ 120 ký tự, không URL), `{kind:"translation"}`.
- `text`: qua `_client_tactic_text`, thêm: không ký tự Unicode `Cc`/`Cf` (trừ `\n` nếu builder đang cho phép trong effect), không `<`, `>`, không thực thể `&…;`, độ dài ≤ 1500.
- `newTactics` key-set `:1118` → `{"nameZh"} <= set(extra) <= {"nameZh","conditions","aliases"}`; payload ledger `:1140` bỏ `effectZh`; mỗi id `newTactics` bắt buộc có mục `zhEffects`.
- **Nguồn gốc**: trong vòng baseline (`:1408-1434`) ghi cho mỗi owner `effect_origin ∈ {"sgsdeck","baseline","missing"}`: `sgsdeck` khi `usable_source_effect` được dùng; `baseline` khi `effect` lấy từ `old_tactics`/`row.get("effect")` và khác rỗng; `missing` khi rỗng. Mang qua `_apply_client_tactics` (tham số hoặc map riêng, không ghi vào row công khai).
- **Áp `zhEffects`** sau vòng chiến pháp có sẵn (sau `:1185`, khi `effectViet` đã cuối): với từng mục:
  - Owner không tồn tại → lỗi. Owner có `effect_origin == "sgsdeck"` → lỗi (không đè SGSDeck).
  - `sha256(row["effectViet"].encode("utf-8")).hexdigest() != viSha256` → `ValueError("stale zhEffects (effectViet changed): <id>")`.
  - `row["effect"] = text`; `row["lookup"]["effectZhSource"] = {"kind": kind}`; tính lại `pending` như `:1185`.
  - Ghi field ledger `clientCapture.zhEffects` (chosenInput gồm `kind` và `ref`/`note`; disposition hợp lệ theo `:2120`).
- **Chặn baseline**: sau khi áp, mọi owner có `effect_origin == "baseline"` mà không có mục `zhEffects` → `ValueError("non-SGSDeck zh effect without zhEffects: <id>")`.
- **Công khai**: mọi literal lookup (`:1134-1136`, `:1414`, `:1434`) thêm `"effectZhSource": None`. Không có `ref`, `note`, `viSha256` ở dữ liệu công khai.
- `TACTIC_LOOKUP_KEYS` (Py `:55`, JS `:12`) thêm `"effectZhSource"`. Validator Py (`:1714-1731`) và JS (`:110-115`): `None` hoặc dict đúng `{kind}` với `kind ∈ {source, capture, translation}`; khi khác `None` thì `effect` phải là chuỗi không rỗng.
- MCP: `TACTIC_LOOKUP_FIELDS` thêm `"effectZhSource"` (sau `"effectTypeVi"`).

## Các bước
1. Test trước:
   - `tests/test_build_unified_lookup.py` `ClientTacticCaptureTest` (`_build :711`, `_entry :705`): sửa `test_new_client_tactic_is_appended_with_chinese_text` (`:786-798`) sang `zhEffects`. Ca mới: mỗi kind ra đúng `{kind}`; sha lệch → stale; `ref` userinfo/khoảng trắng/host lạ → lỗi; `text` có `\u200b`, `<br>`, `&nbsp;`, quá dài → lỗi; mục trỏ owner SGSDeck → lỗi; `newTactics` thiếu `zhEffects` hoặc còn `effectZh` → lỗi; owner baseline thiếu `zhEffects` → lỗi; owner baseline có `zhEffects` → nhận.
   - Test công khai `:341-347`: thêm `assertNotIn(b'"ref"', raw)`, `b'"note"'`, `b'viSha256'`.
   - Test thật `:136-138` (`placeholder_fallback`): đổi kỳ vọng — chỉ pass sau phase 04 (đánh dấu rõ trong commit; phase 04 cập nhật dữ liệu cùng commit).
   - `tests-js/lookup-data.test.mjs`: nhận `null`/3 kind; từ chối khoá thừa (`ref`, `viSha256`), kind lạ.
   - `mcp-worker/test/data/publication-snapshot.test.ts` (allowlist `:326-366`): tactic fixture thêm `effectZhSource: {kind: "translation"}`, assert được giữ, `hidden` vẫn bị bỏ.
2. Cài builder + validator Py/JS + allowlist; chuyển `source_url()` nếu cần dùng chung.
3. Cập nhật 4 fixture đủ khoá thêm `"effectZhSource": null`.
4. Chạy test đơn vị (WSL) với fixture; **không** build trên dữ liệu thật ở phase này (dữ liệu thật sẽ đỏ cho tới phase 04 — có chủ ý, tránh nhãn tạm sai).

## Todo
- [ ] Test Python/JS/MCP (đỏ trước)
- [ ] Builder: nguồn gốc, `zhEffects`, chặn baseline, stale sha, kiểm text/URL
- [ ] Validator Py + JS, `TACTIC_LOOKUP_KEYS`
- [ ] `TACTIC_LOOKUP_FIELDS` MCP
- [ ] 4 fixture đủ khoá

## Kiểm tra
- `python3 -m unittest tests.test_build_unified_lookup.ClientTacticCaptureTest -v` pass.
- `node --experimental-strip-types --test tests-js/lookup-data.test.mjs tests-js/unified-lookup.test.mjs` pass.
- `cd mcp-worker && npx vitest run test/data/publication-snapshot.test.ts` pass (phần allowlist; phần dựng từ dữ liệu thật chạy lại ở phase 06).

## Rủi ro
- Test dùng dữ liệu thật đỏ giữa phase 03 và 04: phase 03 và 04 nằm cùng nhánh PR-B, không merge riêng.
- Host allowlist có thể thiếu nguồn hợp lệ khác: thêm host mới là thay đổi code có review, không nới thành "mọi https".
