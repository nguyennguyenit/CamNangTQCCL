# Phase H: ghép main, docs, full gate (báo cáo)

Ngày 2026-11-18 (Asia/Saigon). Branch `feat/ja-locale-h`, tạo từ `origin/feat/ja-locale` (`46facb09`, đã có A–G). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-h`. Chưa merge vào `feat/ja-locale`, chưa mở PR, không deploy.

## Kết quả

`origin/main` (`875c1005`, 25 commit mới) đã ghép vào branch. Output vi/zh của head so với build `origin/main` chỉ khác ở các file dùng chung có chủ đích và 21 file PK-S26 của tier JP. Docs đã cập nhật. Full gate xanh; các chỗ phải chạy lại hoặc chạy tách vì máy quá tải và cổng bị session khác chiếm được ghi ở mục "Full gate".

## Ghép `origin/main`

Main mang ba nhóm thay đổi: Cùng Tồn PK-S27 · Hán Diễm Trường Minh (bảng 11 cột: Trang bị, Thẻ Kỳ Lược), sửa bản dịch Đội chuẩn (#47, #64, duyệt lại 6.409 vị trí) và workflow CI Claude.

- Xung đột git chỉ nằm ở file ghim và file sinh: `data/website-display.json`, `pipeline/site-localization-policy.json`, `pipeline/team-route-handles.json`, thư mục generation `src/data/recommended-reference/**` (264 rename/rename) và `mcp-worker/src/generated/workflow-build.ts`. Tất cả lấy bản của main rồi dựng lại bằng chuỗi ghim; không merge tay.
- File mã tự gộp không xung đột: `js/render.js`, `js/recommended-reference-render.js`, `js/season-context.js`, `js/season-ui-state.js`, `pipeline/site_localization.py`, `pipeline/season_validation.py`, `css/styles.css`, test liên quan. Đã rà theo ý nghĩa:
  - Main không thêm lời gọi `L(`/`pick(` nào. Hai nhãn mới `Trang bị: …` và `Thẻ Kỳ Lược: …` là chữ `authored-vi` (obligation `ui:coexist/equipment-line`, `ui:coexist/strategy-cards-line`), chỉ dựng ở bản Việt: `coexistModel` trả chuỗi rỗng khi `sourceText()` đúng, mà ở branch này `sourceText()` đúng cho mọi locale khác `vi`, nên bản ja ẩn hai dòng như bản zh. Không cần biến thể ja.
  - Test mới của main (`team-section-ssr`: `locale === "vi" ? 15 : 0`; `team-view-trees` vòng vi/zh) chạy đúng với ja.
- Dữ liệu Tra cứu (generation lookup) không đổi trên main: `build_lookup_ja --check` khớp (1.265 mục), không cần dịch bổ sung.
- Dữ liệu Đội chuẩn PK-S26 không đổi đội: candidate dựng lại vẫn chiếu tier JP đúng 7 hàng như E2 (`yxms-027`, `yxms-014` exact; `yxms-028`, `yxms-044`, `yxms-024`, `yxms-010`, `yxms-050` heroes-only), cùng mùa `pk-s26`; builder không báo hàng đích vắng hay lệch mùa.

## Ghim lại localization

Theo chuỗi phase-08, trên kết quả ghép (commit riêng, cuối branch):

1. Ghim lại 43 hash `policy.sourceFiles` (các file `js/`, `src/` của refactor N locale và `worker/src/schema.ts`; policy của main là nền). `inventory`: stale 0, unknown 0, digest `c6689383…` bằng `baseline.notes` của main (main đã cập nhật khi thêm `equipmentRaw`/`strategyCardsRaw`), nên không sửa `baseline.notes`.
2. `site_localization build --stage all` → `check` (0 problem, 6.409/6.409) → `publish` → `check --stage public` → `prune`: generation Recommended mới `86673de2…` có `jpTiersHash`; prune bỏ `1fe48308…` (generation của main).
3. `team_route_handles --rebind/--check`: giữ 1.681, thêm 0, bỏ 0. `lookup_route_handles --write/--check`: 983 id, 57 luật, `public/_redirects` không đổi.
4. `mcp-worker/src/generated/workflow-build.ts` sinh lại (`js/shinjitai.js` vào danh sách semantic), commit riêng trước commit ghim.

## Docs

Chỉ sửa phần có thay đổi thật, đã đọc trước khi sửa; không file nào vượt 800 dòng trừ `docs/project-changelog.md` (đã 1.431 dòng trước phase này, thêm 10 dòng).

- `README.md`: tính năng ba ngôn ngữ và tier JP, số trang build mới (8.698 trang, sitemap 8.685 URL, 2.949 trang riêng Tra cứu), lệnh `build_lookup_ja` và `report-ja-gaps`, `src/pages/ja/` trong Cấu trúc, link `docs/ja-lookup-data.md`.
- `docs/code-standards.md`: mục "Bản tiếng Trung `/zh/`" thành quy tắc chung theo `SITE_LOCALES` (thứ tự chỉ nối thêm, `pick`/`L` theo vị trí, test arity, `contentLocaleIsVietnamese`/`contentMode`, `switchTargets`/`mirroredAlternates` thay `counterpartPath`, nhãn 機械翻訳); sitemap/robots/`_headers` ba locale.
- `docs/system-architecture.md`: mục zh thành zh + ja (404 ba khối, sitemap ba bản, bộ tra tên Nhật, pin `#lookup-ja-pin`, ẩn văn xuôi chữ Trung, `community-worker`/Vision Worker nhận `ja`); `recommended-jp-tiers.json` là input của candidate.
- `docs/codebase-summary.md`: module i18n, dữ liệu ja, `report-ja-gaps`, `compare-locale-output`, tier JP.
- `docs/season-team-data.md`: `--jp-tiers` trong lệnh builder, mục mới "Tier nguồn Nhật (`tierSources`)" (quy tắc chiếu, đối chiếu mùa theo tên kịch bản, điều kiện dừng, giao diện).
- `docs/unified-lookup.md`: trigger dựng lại `data/lookup-ja.json` sau promote; `_redirects` có ba luật mỗi mã cũ (thêm `/ja/`).
- `docs/deployment-guide.md`: mục "Bản tiếng Nhật `/ja/`" chỉ trỏ tới [community-worker.md#thứ-tự-deploy](../../../docs/community-worker.md#thứ-tự-deploy), ghi rõ sao lưu D1 → migration `0015` → deploy `community-worker` → merge site; Vision Worker nên lên trước hoặc cùng lúc (Worker cũ từ chối `explainSubstitute` có `locale: "ja"`). Không chép runbook.
- `docs/project-changelog.md`: mục 2026-11-18.

## Full gate

Chạy trên cây làm việc sau ghép + ghim (nội dung bằng đúng các commit cuối). Máy tải 10–20 vì session khác chạy song song.

| Lệnh | Kết quả |
|---|---|
| `npm run check` | xanh (localization public check, `astro check` 0 lỗi, 0 cảnh báo, 2 gợi ý có sẵn) |
| `npm run build` | xanh, 8.698 trang, 18,4 s |
| `npm run verify` | xanh, "Verified 9136 dist files", `zh-gaps.md` và `ja-gaps.md` khớp, 10,9 s |
| `npm run test:dist` | 69/69 |
| `npm run test:node` | 948/948 |
| `python3 -m unittest discover -s tests` | 560 OK (13 skip) |
| `(cd worker && npm test && npm run typecheck)` | 202/202, `tsc --noEmit` sạch |
| `(cd community-worker && npm test && npm run typecheck)` | 686/686 (31 file), `tsc --noEmit` sạch |
| `node scripts/design-tokens.mjs --check` | xanh |
| `python3 -m pipeline.build_lookup_ja --check` | khớp (1.265 mục) |
| `npm run test:e2e` (toàn bộ) | 711/711 trong 396 s, chạy bằng cấu hình tạm cổng 4194 (không commit) vì 4174/4175 bị session `CamNangTQCCL-wt-doi-khac` chiếm; cấu hình tạm bỏ `bai-viet-kho-redesign.spec.mjs` (spec viết cứng fixture cổng 4175). Spec này chạy riêng bằng cấu hình chuẩn (4174/4175) khi hai cổng rảnh: 16/16. Tổng 727 test xanh. |
| `(cd mcp-worker && npm run check:repository)` | Lần đầu đỏ ở `check:workflow-build` (lệch như dự kiến) → `generate:workflow-build`, commit `237680e5`. Lần hai: `check:workflow-build`/`check:knowledge-bundle` xanh, vitest 555/558: 3 test hết giờ hoặc vượt ngưỡng CPU khi load 18–20 (`domain-budget` `coldLoadMs < 2000`, `all-tools-parity` timeout 30 s, `cli.integration`); bước e2e bên trong không chạy được vì cổng 4174 bị chiếm. Chạy lại riêng 3 file: 15/15 xanh. Chạy lại `npm run check` của `mcp-worker` (workflow-build, knowledge-bundle, local-secrets, coverage, typecheck, typecheck:worker, build, test:node-min, verify:control-plane): xanh, 558/558. Các bước còn lại của gate (astro build, test:dist, verify, e2e, test:node, unittest, worker) đã chạy riêng ở các dòng trên. `deploy:dry-run` cần cây sạch (`build:worker-assets` từ chối `SOURCE_NOT_CLEAN`): chạy sau commit ghim, `build:worker-assets` + `deploy:dry-run` xanh. |

## So output

Chi tiết ở [baseline-output.md](baseline-output.md). Tóm tắt: baseline = build `origin/main` `875c1005`, head = build sau ghép; `compare --allow-locale ja` + allowlist (`404.html`, `robots.txt`, `_headers`, `_redirects`, `css/styles.css`, `llms.txt` và 21 file PK-S26 của tier JP) → ngoài allowlist **0**. Thêm 2 file dữ liệu ja, mất 0.

## Commit

| Commit | Nội dung |
|---|---|
| `0b992a11` | `merge: origin/main vào bản tiếng Nhật` |
| `237680e5` | `chore(mcp): sinh lại workflow-build sau khi ghép main` |
| `b9b27ce3` | `docs: bản tiếng Nhật /ja/, quy tắc N locale, tier JP và thứ tự deploy` |
| (áp chót) | `docs(plan): báo cáo phase H, trạng thái phase` |
| (cuối) | `chore(data): ghim lại hash nguồn` (cuối) |

## Ghi chú cho người mở PR

- Thứ tự deploy (đưa vào mô tả PR): sao lưu D1 → `npm run db:migrate:remote` (0015) → `npm run deploy` của `community-worker` → (Vision Worker) → merge site.
- Review Astra → Fable theo `AGENTS.md` cho `worker/`, `community-worker/` (migration 0015), generation Recommended (tier JP) và `pipeline/`.
- `ak plan` không quản được plan này (không có trong plan store, phase không có checkbox/front-matter), nên trạng thái phase được sửa thẳng ở bảng `plan.md` theo yêu cầu điều phối; `status` của plan giữ `pending` cho tới khi PR merge.

## Câu hỏi chưa giải

- `docs/project-changelog.md` đã vượt `docs.maxLoc` 800 dòng từ trước (1.431 dòng); có cần tách lưu trữ changelog cũ (việc riêng, nên mở issue) không?
- Các câu của phase C/E2 vẫn để ngỏ cho chủ repo: `llms.txt` là file dùng chung thứ 6 (Q8); tên 武将図鑑 trùng với 図鑑検索; câu mới về cách ghi tên trong `DisclaimerPage` bản ja; tên nhóm chip "Bộ đội hình" khi chứa "Tier JP"; 32 thuật ngữ `unverified` trong `pipeline/ja-glossary.json` cần người chơi bản Nhật soát.
