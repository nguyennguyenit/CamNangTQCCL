# Bằng chứng trước plan (2026-10-20)

Nguồn: session cũ 01a14098 (PR #11), rà của Astra (`agent://AstraVerify`), hai scout `PublishChainScout-2`, `CodeTestScout-2`, và kiểm tay. Mọi dòng có `file:line` đã đọc trực tiếp hoặc do scout trích.

## Dữ liệu
- `data/tactics.json`: 409 chiến pháp; 31 dòng `pending: true`, `effect` rỗng (30 `null`, 1 `""`), đều có `effectViet`. Loại: ACTIVE 12, INTERNAL 12, BURST 4, FORMATION 1, PASSIVE 1, COMMAND 1. Cả 31 nằm trong `lookup-client-tactics.json.tactics`, không trong `newTactics`.
- `pipeline/lookup-client-tactics.json`: khoá `schemaVersion, source, tactics(407), newTactics(29), retired(26), troopMods(16), tacticNotes(7)`. `newTactics[id]` = `{nameZh, effectZh}` + tuỳ chọn `conditions`, `aliases` (kiểm ở `build_unified_lookup.py:1118`). 29 mục: TROOP 16, ACTIVE 8, PASSIVE 2, INTERNAL 2, COMMAND 1.
- File gốc chữ Hán đã mất: `%TEMP%\tqccl-cap\tx\` chỉ còn `unmatched.json` (mất `new-tactics-zh.json`, `new-tactics-draft.json`, `troops-zh.json`, `troops-vi.json`). `gen.py:176` ghi TROOP lấy từ ảnh 訓兵場 client TW; `gen.py:286` đọc `new-tactics-zh.json` cho 13 mục còn lại.
- Không có đầu vào vi→zh đã duyệt nào: `pipeline/lookup-translations.json` (3597 mục) toàn zh→vi.
- `pipeline/lookup-route-handles.json`: khoá `booksSha256, generationId, handles, handlesSha256, note, retired, schemaVersion`; `retired.tactics` 26 (18 gộp, 8 bỏ hẳn), `retired.heroes` 1 (`ha-thi`); mọi slug cũ trùng phần đuôi mã. `generationId` = `lookup:25d725b8…` = `data/lookup-manifest.json`.
- 18 mã giữ trong `data/tactics.json` có đúng 1 `formerIds` mỗi mã.

## Code
- MCP allowlist: `mcp-worker/src/data/publication-builder.ts:239-242` (`TACTIC_LOOKUP_FIELDS`), áp ở `:291` qua `pick`. `publication-projection.ts` không lọc trường.
- Schema khoá chặt: Python `pipeline/build_unified_lookup.py:55` + `:1712`; JS `js/lookup-data.js:12` + `:109` (`requireShape` exact).
- Dựng lookup chiến pháp: `newTactics` `:1134-1136`; baseline không nguồn `:1414`; baseline có nguồn `:1434`. Pending: `:1185`, kiểm `:1738`.
- Hiệu ứng: `js/lookup-tactic-profile.js:116-154` (`effectSection`, locale `:19`); thẻ liên quan `js/lookup-profile.js:136` (zh dùng `effect`, vi dùng `effectViet`); class `.lookup-version-tag` `css/styles.css:7993-8000`.
- Redirect: `pipeline/lookup_route_handles.py` chỉ ghi ledger (`write_ledger :220-244`, `check_ledger :247-254`, CLI `:257-271`); `load_corpus :96` chỉ giữ `(id, name)`.
- Verifier: `scripts/verify-astro-dist.mjs:31-33` `DEPLOYMENT_CONTROL_ARTIFACTS` chỉ có `_headers`; kiểm byte `:658-666`; inventory `:292-298` chặn file lạ/thiếu.
- `pages-deploy.yml:28-30` checkout `main`, `:53` ghi `--commit-hash`. `mcp-worker.yml:122-147` bắt `production_sha` = `origin/main`.
- Preflight cần `TQCCL_FIRST_RELEASE_BOOTSTRAP`, `CLOUDFLARE_ACCOUNT_ID`, `TQCCL_WORKER_NAME`, `TQCCL_WORKER_DEPLOY_API_TOKEN` (`mcp-worker/scripts/preflight-worker-release.ts:15-20`).

## Test cần đụng
- Python: `tests/test_lookup_route_handles.py` (`make_data :24-47`, `run_cli :57-61`, `RealLedgerTest :244`); `tests/test_build_unified_lookup.py` `ClientTacticCaptureTest :694`, test `newTactics` `:786-798`.
- JS: `tests-js/astro-dist-contract.test.mjs` 6 fixture ghi `_headers` (`:626/628, :688/689, :1164/1165, :1208/1209, :1394/1395, :1445/1446`) + real-dist `:877-889`; mẫu `tests-js/pages-headers-contract.test.mjs`; `package.json` `test:dist` liệt kê file tường minh.
- Fixture lookup đủ khoá (4): `tests-js/fixtures/lookup-bundle-fixtures.mjs:36-40`, `tests-js/unified-lookup.test.mjs:51-56`, `tests-e2e/season-lookup.spec.mjs:97-98`, `mcp-worker/test/fixtures/lookup-roots.ts:103-107`.
- `tests-js/lookup-data.test.mjs:277-282, :426-443`; `tests-js/lookup-profile-trees.test.mjs`; `mcp-worker/test/data/publication-snapshot.test.ts:326-366`.
- E2E: `tests-e2e/lookup-item-pages.spec.mjs` (`:83`, `:102-106`), `tests-e2e/zh-locale.spec.mjs:70-75`.

## Chuỗi phát hành (Linux)
- `build_unified_lookup.py:6`, `promote_unified_lookup.py:6` import `fcntl` → chỉ chạy Linux/WSL. WSL `Ubuntu` có `~/w` (git checkout, nhánh cũ `feat/global-client-lookup`, sửa dở `community-worker/src/app.ts`), `~/node/bin`, `~/pwlibs`, `/usr/bin/python3`. Script `*-w.sh`/`repin.py` đã mất. Code từ chối symlink tổ tiên (`O_NOFOLLOW`) → phải là bản sao thật trong FS Linux.
- Python không có trên PATH Windows.
- Lệnh (theo `docs/unified-lookup.md:73-148`, `docs/deployment-guide.md:251-293`, `pipeline/site_localization.py`):
  1. `python3 -m pipeline.build_unified_lookup build … --output pipeline/lookup-output/candidate` rồi `validate --candidate …`
  2. `python3 -m pipeline.promote_unified_lookup promote --candidate … --activation <manifest> --transaction <id> --root .` (manifest `{"schemaVersion":1,"paths":[{path,source,beforeHash,afterHash}]}`, `promote_unified_lookup.py:186-206`; journal non-`data/` paths phải bằng manifest `:376-381`; không có script sinh manifest).
  3. `python3 -m pipeline.lookup_route_handles --write` rồi `--check` (sau promote vì `generationId` đổi).
  4. Repin `policy.sourceFiles` (`site-localization-policy.json:761-833`) cho mọi file bị ghim đã sửa. Không cần đăng ký `UI_LITERAL_OBLIGATIONS` (chỉ tuple đã đăng ký được kiểm, `site_localization.py:1781-1810`) nên không repin `concreteLocationCount`/`concreteInventorySha256`.
  5. `site_localization build --stage all --output .cache/site-localization-candidate` → `check --stage all --candidate …` → `publish --candidate …` → `check --stage public` (→ `prune` tuỳ chọn).
  6. Repin tay `pipeline/team-route-handles.json:2` = generationId của `src/data/recommended-reference/current.json`; `python3 -m pipeline.team_route_handles --check`.
  7. `npm --prefix mcp-worker run generate:workflow-build` (cuối cùng; `js/lookup-data.js`, `publication-builder.ts` nằm trong `mcp-worker/workflow-source-manifest.json`).
  8. Gate.
- Đã giải sau red-team 2026-10-20: manifest activation `paths: []` (promote chạy `validate_candidate` với code trên đĩa trước `_activation_rows`, `promote_unified_lookup.py:436`, `:203-206`; tiền lệ `plans/260913-2018-viet-hoa-toan-bo/phase-02-reviewed-publication.md:85`); không chạy `build_recommended_reference` (`site_localization publish` đã dựng, `:2108-2118`; CLI hiện bắt buộc `--teams/--tactic-catalog/--output`, `build_recommended_reference.py:756-761`); giá trị `kind` là chuỗi chuẩn hoá, site localization phân loại không lỗi (`site_localization.py:250`); knowledge bundle không đọc dữ liệu chiến pháp.
- Đã phát hiện ở red-team: 3 dòng chữ Hán từ baseline cũ (`tactic:nhanh-tri-dong-nao`, `tactic:luc-luc-thuong-quoc`, `tactic:vo-song-thuong-tuong`; `build_unified_lookup.py:1408-1409, 1427-1428`) → tổng 63 mục cần `zhEffects`.
