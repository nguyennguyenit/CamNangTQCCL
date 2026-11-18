# Ghép `origin/main` (Đội khác Hán Diễm Trường Minh) vào `feat/ja-locale`

Ngày 2026-11-18 (Asia/Saigon). Worktree `CamNangTQCCL-ja`, branch `feat/ja-locale` (từ `f3bb6719`). Ghép `origin/main` @ `6742503c` (24 commit, chủ yếu PR #131 Đội khác một mùa PK-S27). Không merge PR, không deploy, không đụng D1.

## Kết quả

Branch đã chứa toàn bộ `origin/main` (`git rev-list --count HEAD..origin/main` = 0), không còn conflict marker. Mọi bộ kiểm xanh. Output vi/zh so với build `origin/main` chỉ đổi trong allowlist đã biết (29 file), không trang Đội khác vi/zh nào đổi.

## Xung đột và cách giải

| File | Cách giải |
|---|---|
| `js/recommended-reference-state.js` | Giữ bảng `LEGACY_LABEL` theo locale của ja; thêm giá trị mới của main cho cả zh và ja: phe `Hán` (汉 / 漢), binh chủng `Khí giới` (器械 / 器械), nguồn `youtube` (YouTube). |
| `js/recommended-reference-render.js` | Gộp import của hai bên (`isRecommendedOtherRow` của main, `jpTier*`/`sourcePrefixedTactic`/`validateHttpSourceUrl` của ja). Nhãn mới "Đề cử" có biến thể ja おすすめ (glossary: 推荐阵容 → おすすめ編成). |
| `js/team-filter-section.js` | Theo cấu trúc main (Đội khác không có ô chọn mùa, nhãn mùa tĩnh, bỏ lựa chọn `unknown`), mọi `L(...)` mới có biến thể ja (シーズン, 開催中, 絞り込み, すべて, câu trống). `seasonTitleText` của main gọi `zh()` vốn không còn ở branch: đổi sang `sourceText()` như `seasonNameText` (bản ja hiện tên mùa nguồn, như ô chọn mùa Đội chuẩn). |
| `tests-js/astro-dist-contract.test.mjs` | Giữ công thức N locale; `SITEMAP_ROUTES_PER_LOCALE` 2915 → 3192 (+277 đội gốc mới, main: 166 → 443). |
| `tests/test_site_localization.py` | Giữ cả `UiObligationOwnerTest` (ja) lẫn `YoutubeTeamFieldClassificationTest` (main). |
| `README.md`, `docs/project-changelog.md` | Giữ cả hai mục; câu trang mùa ghi "bản zh, ja". |
| File ghim/sinh: `src/data/recommended-reference/**`, `data/website-display.json`, `pipeline/site-localization-policy.json`, `pipeline/team-route-handles.json`, `mcp-worker/src/generated/workflow-build.ts` | Lấy bản main rồi dựng lại; không sửa tay. Policy của main là nền (policyVersion `site-vi-261118-doi-khac-ky-luoc`, obligations của main); phần riêng của ja chỉ là hash `sourceFiles` và digest inventory, ghim lại ở commit cuối. |

Ngoài xung đột git: main sửa `createRawNameResolver` (bản zh) để `viet` thắng `hanViet` trùng chữ của mục khác ("Lập Lờ Đánh Tráo" → 移花接木). `createJaNameResolver` có cùng lỗi thứ tự nên sửa tương tự, kèm test (`daf7eae5`).

## Chuỗi sinh lại

1. `python3 -m pipeline.build_lookup_ja --write` → `--check`: main promote lại Tra cứu `lookup:2d9aeca6…`; 1310 mục giữ nguyên tên và bản dịch (0 mục đổi, 0 tên `verified` mất), chỉ đổi `lookupGenerationId` và hash nguồn. `report-ja-gaps --check` khớp, không cần sửa `docs/ja-gaps.md`.
2. `mcp-worker`: `generate:workflow-build` (danh sách semantic có lại `js/locale-name-aliases.js`, `js/shinjitai.js`), `check:knowledge-bundle` xanh.
3. Ghim 43 hash `sourceFiles` lệch. `inventory`: 75.267 location (bằng main), digest `36be366c…` khác `ae779806…` của main vì owner obligation của `LookupHubPage.astro` bên ja (cùng nguyên nhân như vòng 3), nên cập nhật `baseline.notes.concreteInventorySha256`.
4. `site_localization build --stage all` → `check` (0 problem, 6409/6409) → `publish` → `check --stage public` → `prune`: generation Recommended `1418468e…` có `jpTiersHash`, `tierSources` (7 đội PK-S26) và 387 hàng Đội khác; prune bỏ `95de17f0…` của main.
5. `team_route_handles --rebind/--check`: giữ 1681 Recommended, 443 Đội khác, 18 Khai hoang, 46 tombstone; thêm 0 (main đã cấp handle chỉ-thêm, không cần `--append-legacy`). `lookup_route_handles --write/--check`: 1028 ID, 57 luật redirect, `public/_redirects` không đổi.

## Kiểm (trên cây sau ghép và ghim)

| Lệnh | Kết quả |
|---|---|
| `npm run check` | localization public ok; `astro check` 0 lỗi, 0 cảnh báo (149 file) |
| `npm run build` | 9667 trang, ~16 s phần Astro |
| `npm run verify` | ok, "Verified 10106 dist files"; `zh-gaps.md`, `ja-gaps.md` khớp |
| `npm run test:dist` | 71/71 |
| `npm run test:node` | 1008/1008 (gồm arity ba biến thể) |
| `python3 -m unittest discover -s tests` | 629 OK (13 skip) |
| `worker`: `npm test`, `typecheck` | 203/203, sạch |
| `community-worker`: `npm test`, `typecheck` | 686/686, sạch |
| `mcp-worker`: `npm run check` | xanh, vitest 574/574 |
| `mcp-worker`: `build:worker-assets` + `deploy:dry-run` | xanh, chạy trên cây sạch sau commit ghim (`build:worker-assets` từ chối cây bẩn); `workflowBuildId` `bvFJRlz9…`, wrangler `--dry-run: exiting now` |
| `npx playwright test` | 745/745 (5,6 phút, cổng 4174/4175 trống, cấu hình gốc) |

## So output vi/zh

Baseline: build `origin/main` @ `6742503c` (bản `git archive` trong scratchpad, không tạo worktree), 6776 file. Head: 6778 file. `compare --allow-locale ja`: đổi 29, thêm 2 (`data/lookup-ja.json`, `data/ja-kanji-variants.json`), mất 0, **ngoài allowlist 0**.

Allowlist 29 file = 27 file của review2 (6 file dùng chung `404.html`, `robots.txt`, `_headers`, `_redirects`, `css/styles.css`, `llms.txt` và 21 file PK-S26 của tier JP) + `tra-cuu/index.html` và `zh/tra-cuu/index.html`. Hai file sau là thay đổi đã biết từ vòng 3 (`8926d2e2`): script inline `#lookup-hub-redirect` nhận tiền tố `/zh`, `/ja`. Đã kiểm lại: bỏ script đó, pin và cụm nút ngôn ngữ thì hai trang trùng byte. Không trang Đội khác vi/zh nào (443 trang đội gốc × 2, `/doi-khac/`) đổi byte.

## Số liệu

- Trang: 9667 HTML; mỗi bản `/zh/`, `/ja/` 3222 trang (trước ghép 2945; +277 trang Đội khác mới mỗi bản); sitemap 9654 URL; 38 file `/llms/…`.
- `data/lookup-ja.json`: 1310 mục, 482 `verified`, 828 `derived`.
- Quét `<main>`/`<title>` 3222 trang `/ja/`: chữ Việt chỉ còn ở 24 trang tướng ("Châu" trong ghi chú PK-S27, issue #130); `/ja/doi-khac/**` 0 chữ Việt. `/ja/doi-khac/` có nhãn mùa tĩnh シーズン 漢焰長明 và 69 nhãn おすすめ.

## Commit

`2ccb869f` merge; `daf7eae5` fix bộ tra tên Nhật; `f30d8d17` lookup-ja; `80fd4457` workflow-build MCP; `0b31b8ed` docs (README số trang, changelog); commit báo cáo này; commit cuối `chore(data): ghim lại hash nguồn`.

## Rủi ro còn lại

- Nhãn mùa tĩnh và ô chọn mùa bản ja hiện tên mùa nguồn chữ Trung (漢焰長明), không phải tên Nhật 漢焔不滅 của glossary. Đây là hành vi sẵn có của `seasonNameText` trên ja, không phải do lần ghép này.
- おすすめ, シーズン là thuật ngữ `unverified` trong glossary.
- Review Astra → Fable theo `AGENTS.md` vẫn cần cho generation Recommended và `pipeline/`.

## Câu hỏi chưa giải

- Tên mùa trên bản ja có nên dùng tên Nhật theo glossary (漢焔不滅) thay cho tên nguồn không? Nếu có thì nên làm thành việc riêng (issue), vì nó đổi cả ô chọn mùa Đội chuẩn.
