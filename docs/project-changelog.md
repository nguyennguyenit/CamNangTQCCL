# Project Changelog

## 2026-10-15 (SEO cho AI: nội dung đội và Tra cứu dựng sẵn, trang riêng từng mục, JSON-LD, llms)

### Added

- **Trang riêng từng mục Tra cứu** `/tra-cuu/<nhóm>/<slug>/` và `/zh/…`: 886 mục × 2 = 1772 trang, hồ sơ đầy đủ dựng lúc build, title/description riêng, canonical, hreflang vi/zh và link quay lại trang nhóm. Trang không nạp `app.js` và không tải dữ liệu; `js/lookup-item-page.js` chỉ gắn chân dung và nút phiên bản hiệu ứng (mọi phiên bản có sẵn trong HTML, mỗi panel mở bằng nhãn phiên bản của nó; có JavaScript thì bản cũ `hidden` và nhãn nhường cho nút, không JavaScript thì CSS hiện mọi bản kèm nhãn và ẩn nút), dùng hai module không phụ thuộc mới `js/lookup-effect-panels.js`, `js/http-source-url.js`. Route `src/pages/{,zh/}tra-cuu/[group]/[slug].astro`, `src/lib/lookup-item-pages.ts`, `src/components/pages/LookupItemPage.astro`.
- **Ledger slug Tra cứu đóng băng** `pipeline/lookup-route-handles.json` (`python3 -m pipeline.lookup_route_handles --write|--check`, mẫu ledger handle đội): slug gán một lần theo mã (trùng trong nhóm thì `-2`, `-3`…; corpus hiện tại không trùng), đổi tên giữ slug, mã rời corpus chuyển sang `retired` và vẫn giữ chỗ slug, mã quay lại nhận slug cũ; `handlesSha256` chặn sửa tay; pin `generationId` Tra cứu và hash `books-dict`. Loader `src/lib/lookup-detail-routes.ts` kiểm ledger lúc build. Trình duyệt suy slug từ hậu tố mã (`lookupDerivedSlug`), chỉ ngoại lệ của ledger được `SiteLayout` nhúng (`#lookup-route-handles`, hiện `{}`). Chạy lại `--write` mỗi khi generation Tra cứu hoặc `books-dict.json` đổi.
- **JSON-LD** (`src/lib/structured-data.ts`): trang chi tiết đội `WebPage` (`about` = tướng có trang riêng, tên đúng như trang hiển thị), trang nhóm `CollectionPage` + `ItemList` đủ mục, trang riêng `ItemPage` (`url`, `inLanguage`, `isPartOf` `VideoGame` `三国志·战略版`) có `mainEntity` là `Thing` (tướng, trang bị, công trình, cải tạo binh chủng) hoặc `DefinedTerm` (chiến pháp, binh thư, quân sư); mọi trang kèm `BreadcrumbList`. Bản Việt chỉ khai `alternateName` chữ Hán khi trang hiện chữ Hán; bản Trung không khai tên Việt.
- **Bộ llms từ một hàm sinh** `llmsDocuments()` (`src/lib/llms-documents.ts`): `/llms/doi-chuan/<mùa>.txt` (Đội chuẩn vượt 300 KB nên tách theo mùa, theo thứ tự registry mùa), `/llms/doi-khac.txt`, `/llms/cung-ton.txt`, `/llms/khai-hoang.txt`, `/llms/tra-cuu/<nhóm>.txt` ×7 và `/llms-full.txt` (nối các file con theo thứ tự cố định). Mỗi mục là `treeToText` (mới, `js/view-tree.js`) của đúng cây mà trang HTML dựng từ, mở bằng dòng link trang riêng; Cùng Tồn không có trang riêng nên mỗi mùa một mục link `/cung-ton/?scenario=…`. `/llms.txt` thêm "Tra cứu theo nhóm" và "Toàn văn chữ thuần theo mục"; route, `llms.txt` và allowlist verifier lấy danh sách file từ cùng hàm. `public/_headers` thêm `/llms-full.txt`, `/llms/*`.
- `scripts/report-zh-gaps.mjs` (`--check` để so, chạy tay): liệt kê mục Tra cứu mà hồ sơ zh bỏ phần chỉ có chữ Việt (`lookupProfile(...).viOnly`) và phần bị thiếu, ghi `plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md` (570/886 mục). `test:dist` chỉ kiểm bất biến (mỗi mục thiếu nêu được phần thiếu, báo cáo sinh từ dữ liệu hiện tại có dòng cho từng mục), không so với file trong thư mục kế hoạch. Không bổ sung dữ liệu zh.

### Changed

- **Builder nội dung đội trả cây view.** `js/recommended-reference-render.js` (thẻ, bảng, nhóm Tier, thân chi tiết Đội chuẩn/Đội khác, thẻ Cùng Tồn) và `js/render.js` (`t`, `svgTree`, `iconTree`, `seasonCoexistGroup`, `khaihoangTableTree`, `khaihoangDetailTrees`) không chạm `document`, nhận `locale` tường minh; build gọi `treeToHtml`, client gọi `treeToDom` rồi gắn sự kiện (chip chiến pháp mang `data-tactic-search` thay closure `onTag`). `js/i18n.js` thêm `withLocale` để build dựng vi/zh trong cùng tiến trình; `treeToDom` tạo SVG bằng `createElementNS`.
- **Trang chi tiết đội dựng sẵn**: 3098 trang (Đội chuẩn 1366, Đội khác 166, Khai hoang 17 × vi/zh) có tướng, chiến pháp, binh thư, ghi chú trong HTML (`src/lib/team-ssr.ts`, `#team-detail-body[data-prerendered]`); bỏ "Đang tải chi tiết…" và noscript "cần JavaScript" (noscript chỉ còn ở ba trang công cụ). Trang mặc định không tải dữ liệu; `?variant=` của Đội khác/Khai hoang ẩn thân dựng sẵn rồi tải, xác minh, dựng như cũ; Khai hoang tải dữ liệu ở lần bấm chip cấu hình đầu, dựng theo `variant` của URL lúc tải xong (lần bấm sau cùng thắng), tải lỗi thì giữ thân dựng sẵn, URL về mặc định và chỉ báo lỗi ở dòng trạng thái. Đường tải/dựng lại client của Đội chuẩn bị gỡ.
- **Trang danh sách đội dựng sẵn** (`src/lib/team-section-ssr.js`, cùng hàm chọn mặc định với client): Đội chuẩn/Đội khác 60 đội đầu của mùa mặc định, Cùng Tồn nhóm đầu của mùa mới nhất, Khai hoang cả trang; mỗi đội 3 tướng + link chi tiết. Client chỉ nhận lại DOM khi `data-ssr-source` khớp pin trang và `data-ssr-signature` khớp trạng thái đầu, lệch thì dựng lại; nút cần sự kiện ra HTML `disabled` tới khi gắn xong. Trang mở ở trạng thái khác mặc định (khóa `SECTION_QUERY_KEYS` trong URL, kiểu xem đã lưu Thẻ gọn/Bảng, lựa chọn Khai hoang khôi phục từ snapshot quay lại) thì script inline sau mount gắn `data-ssr-stale` và CSS ẩn danh sách (giữ chỗ) tới khi `js/app.js` dựng xong hoặc boot lỗi, không để danh sách sai mùa/bộ lọc hiện và bấm được trong lúc tải. Sidebar lọc, chọn mùa, "Xem thêm" vẫn do client dựng.
- **Trang nhóm Tra cứu dựng đủ mọi mục** (202 / 406 / 114 / 68 / 39 / 41 / 16) thay vì 60 mục đầu: mục sau trang đầu mang `data-lookup-later`, CSS chỉ ẩn khi `html[data-lookup-js]`; không JavaScript thì hiện đủ và ẩn hàng "Xem thêm". Hồ sơ tướng/chiến pháp/binh thư thành cây view (`createProfileRenderer` → `renderProfile` cho hộp thoại, `profilePageTree` cho trang riêng); bốn nhóm catalog dùng `masterDetailTree(…, {page: true})`. Nhãn dịch đóng băng lúc nạp module (`lookup-detail.js`, `unified-lookup.js`) chuyển thành hàm.
- **Link Tra cứu là path**: thẻ, hàng, mục danh sách, link quan hệ và ô chiến pháp/binh thư của trang đội trỏ `/tra-cuu/<nhóm>/<slug>/` (`lookupItemPath`/`lookupHref` của `js/lookup-ids.js`); trang đội không còn `?id=`. Trên trang nhóm, click thường vẫn mở hộp thoại/panel bằng `?id=`, Ctrl/Cmd+click mở trang riêng; `?id=` cũ vẫn mở hộp thoại; mã không có trang riêng (đặc kỹ trang bị) lùi về `?id=`.
- Sitemap 3140 → 4912 URL (thêm trang riêng Tra cứu từ `lookupDetailRoutes()`); build 4917 trang.
- `scripts/verify-astro-dist.mjs`: kiểm thân dựng sẵn của trang chi tiết và bốn trang mục đội (không chữ chờ/JavaScript, đúng một `h1`, `data-ssr-source` khớp pin), tập mã trang nhóm đúng corpus, trang riêng khớp ledger (canonical, title/description duy nhất, hồ sơ, một `h1`, link quay lại, không nạp `app.js`), bảng ngoại lệ slug khớp ledger, bộ llms đúng byte với hàm sinh và mọi link `llms.txt` có file.
- Bản dịch: hash nguồn và `concreteInventorySha256` cập nhật; +12 obligation `authored-vi` `ui:lookup-item/*`, gỡ `ui:route-recommended/noscript`, `ui:route-legacy/noscript`; baseline 56826 → 56836 location. `LookupItemPage.astro`, `lookup-item-pages.ts`, `src/pages/tra-cuu/[group]/[slug].astro` vào `sourceFiles`. Publish generation Đội chuẩn `5d9358db…` (prune `ff7b77eb…` và các generation trung gian), re-pin `pipeline/team-route-handles.json`; generation Tra cứu không đổi. `js/i18n.js` đổi nên `WORKFLOW_BUILD_ID` MCP sinh lại.

### Tests

- Node: `team-view-trees` (builder đội chạy trong Node không `document`, vi + zh, dữ liệu thật), `team-section-ssr`, `lookup-profile-trees`, `lookup-detail-routes` (luật slug Python = JS trên mọi tên corpus, ledger sửa tay/retired), `lookup-item-page-deps` (trần module/byte của trang riêng), `view-tree` (`createElementNS`, `treeToText`); dist: `astro-dist-contract` (thân dựng sẵn, trang nhóm đủ mục, 1772 trang riêng, sitemap 4912) và `seo-dist-contract` mới trong `npm run test:dist` (link path, JSON-LD, llms, zh-gaps).
- Python: `tests/test_lookup_route_handles.py` (cấp slug, va chạm, `--check`, retire/giữ chỗ/khôi phục, từ chối ledger sửa tay).
- E2E: `team-ssr-nojs`, `team-ssr-adopt`, `team-ssr-parity` (DOM nhận lại = DOM client dựng), `team-ssr-detail-states`, `lookup-item-pages`; spec cũ đổi theo hành vi chủ động thay đổi (link trang riêng, chờ `data-boot` trước khi thao tác lọc, đường `?variant=` cho test tải/fail-closed).

## 2026-10-15 (Nhãn chỉ số/binh chủng cho MCP, đoán tên gần có điều kiện)

### Added

- **`fieldLabels` trong `tqccl_get_entity`** (overview): nhãn theo locale cho khoá của `profile.stats` và `profile.troopApt` (vd `thuan` → "Khiên binh"/"盾兵"), chỉ cho khoá có trong hồ sơ. Trước đây agent chỉ thấy khoá thô và đã dịch `thuan` thành "Thuỷ binh" (Dewee R4). Nhãn lấy từ `js/lookup-field-labels.js`, nguồn chung với trang Tra cứu (`js/lookup-detail.js` dùng lại); bản dịch hiển thị đã publish lại (generation `374b8dc2…`).
- **`similarNames[].likely`** trong `tqccl_search`: đánh dấu mục duy nhất cùng loại mà mọi từ có trong tên gõ (bỏ qua dấu; sai một chữ cái chỉ ở từ ≥4 chữ) và phủ đủ số từ của tên gõ trừ tối đa một — tức người dùng gõ thừa một từ, đảo thứ tự hay gõ sai. Ví dụ: "Hổ Báo Thiết Kỵ" → Hổ Báo Kỵ, "Mưu Kế Liên Hoàn"/"Liên Hoàng Kế" → Liên Hoàn Kế; "Thiên Chi Kiếm" (Ỷ Thiên Kiếm thừa chữ "Ỷ") và "Phong Hỏa Liên Thiên" không có mục `likely`. Mục `likely` đứng đầu danh sách.
- **`refNames` trong `tqccl_get_entity`**: tên hiển thị theo locale của mọi ID thực thể có thật nhắc trong `profile` (overview) hoặc `items` (section), vd `selfTacticId: "tactic:thua-thien-tinh-the"` → "Thừa Thiên Tĩnh Thế". Trước đây tool chỉ trả ID nên agent tự dựng tên và viết sai ("Thừa Thiên Thừa Tộ", Dewee R5 câu 1).
- **`build` trong `tqccl_get_team` ở mọi section khác overview** (guide, notes, variants): `{ref, name, heroes}` của chính đội đó, giống `team.heroes` ở overview. Dewee R5b câu 17: agent chỉ đọc section guide, lấy build từ danh sách `tqccl_find_teams` (17 đội Khai hoang trong một khối) và ghép nhầm "Phong Thi Trận" của đội Chu Thái sang Gia Cát Khác.
- **`innateHeroIds` trong `tqccl_get_entity`** (chiến pháp): ID các tướng mang chiến pháp đó làm chiến pháp tự có, tên nằm trong `refNames`. Suy ngược từ hồ sơ tướng: `lookup.selfTacticId`, không có thì tên Hán khớp đúng một chiến pháp (`js/lookup-innate-holders.js`, dùng chung với trang Tra cứu). Dewee 2026-10-15: `tactic:thua-thien-tinh-the` không ghi `sourceHeroCn` nên agent trả lời "dữ liệu không ghi tướng sở hữu", dù SP Tào Tháo trỏ tới nó. 129/141 chiến pháp tự có nay có tướng (35/39 chiến pháp thiếu `sourceHeroCn`).

### Changed

- **Skill `tqccl-lookup`, tên không có trong cẩm nang** (user chốt 2026-10-15 sau debate `next-steps-1/guess`): vẫn mở đầu "không tìm thấy trong dữ liệu cẩm nang" và nêu `similarNames` là tên gần; chỉ mục `likely: true` đúng loại user hỏi mới được đoán và đưa chi tiết — nói là phỏng đoán, chi tiết mang tên của mục đó, không trả lời như thể hai tên là một, kết thúc bằng câu hỏi xác nhận; không áp cho bản SP/CO/base của tên có thật. Rule `lookup-missing-is-not-empty` lên revision 4.
- **Skill `tqccl-coexist-team-builder`** (user chốt sau R5 câu 21): thuộc tính tướng/chiến pháp (thích tính binh chủng, phe, sao, hiệu ứng) chỉ nêu khi lấy từ kết quả tool trong phiên — gọi `tqccl_get_entity` hoặc bỏ qua; `tqccl_get_entity` vào tool surface của skill. Rule `coexist-project-data-first` lên revision 2.
- **Skill `tqccl-lookup`**: build của một đội chỉ lấy từ `tqccl_get_team` của đúng đội đó, không từ danh sách `tqccl_find_teams`. Rule `lookup-khai-hoang-exact` lên revision 2.

### Fixed

- **Gợi ý đội từ kho: nút "Dùng món này" luôn bị vô hiệu**: `el()` gán `disabled="false"` khi chưa chạm giới hạn thay món, và thuộc tính có mặt là đủ để khoá nút. Nay chỉ gắn `disabled` khi `limitReached`. Bản dịch hiển thị publish lại (generation `e079390c…`).
- **Tra cứu, hồ sơ chiến pháp, cột "Cách nhận"**: thẻ tướng "Tự mang" lấy từ cùng quy tắc với hồ sơ tướng, nên tướng chỉ khớp qua tên Hán chiến pháp tự có (vd Tiểu Kiều → Thiên Hương) cũng hiện. Trước đây cột này chỉ dò `selfTacticId`. Bản dịch hiển thị publish lại (generation `989c9919…`).

## 2026-10-10 (Tra cứu: tên gần khi không khớp, chỉ dữ liệu cẩm nang)

### Added

- **`similarNames` trong `tqccl_search`** (debate `lookup-miss-1/suggest`): khi `total` là 0, trả tối đa 5 mục catalog `{entityId, kind, displayName, pagePath}` có chung ít nhất 2 từ với truy vấn (sau bỏ dấu; chữ Hán tính từng chữ), xếp theo số từ chung, số từ đúng dấu, rồi độ trùng. `total` vẫn 0, `items` vẫn rỗng; không đủ gần thì không có trường này; không gợi ý đội; không kèm tướng sở hữu. Lõi ở `similarCatalog` (`mcp-worker/src/data/publication-projection.ts`). `tqccl_normalize_entities` dùng cùng lõi cho `candidates` của tên `unknown` khi không có khớp một phần. Website Tra cứu không đổi.

### Changed

- **Skill `tqccl-lookup`** (debate `lookup-miss-1/noweb`): chỉ dùng dữ liệu cẩm nang, không web search/fetch; không có thì nói "không tìm thấy trong dữ liệu cẩm nang"; `similarNames` chỉ được nêu là tên gần, không bao giờ là món được hỏi; cần nguồn ngoài thì đề nghị chuyển research. Rule `lookup-missing-is-not-empty` lên revision 2; mô tả skill thêm "Handbook only, no web."

## 2026-10-09 (Sau đo Dewee R2: hạn mức research, skill coexist, đội tranh tài nguyên)

### Changed

- **Hạn mức skill `tqccl-research`** (user chốt sau debate `research-budget-1`): một ledger/topic với hai hạn mức — nguồn ngoài ≤5 (web, browser, media, child agent, MCP/API khác) và MCP TQCCL ≤5 (playbook ≤1, tool TQCCL khác ≤4, kể cả retry). Trước đây lượt MCP TQCCL remote ăn vào 5 lượt chung. Rule `shared-research-budget`, `budget-counts-all-external-ops`, `budget-report-ledger`, `research-playbook-once-per-topic` lên revision 2.
- **Skill `tqccl-coexist-team-builder`**: chưa có kho thì chỉ hỏi kho; normalize xong phải dừng chờ xác nhận ở lượt riêng rồi mới recommend; báo đủ portfolio, đội tranh tài nguyên, đội thiếu món; món bù chỉ từ `substitutes[]` trong kho. Rule `known-roster`, `review-canonical-state`, `coexist-show-duplicate-tactics`, `coexist-substitution-weaker-variant` lên revision 2.
- **Skill `tqccl-lookup`**: tên đầy đủ không ra kết quả thì thử tối đa 2 lần nữa (tên Hán, sửa dấu/khoảng trắng) rồi kết luận không có trong cẩm nang (Dewee R2b case 11 gọi `tqccl_search` 16 lần). Skill coexist gửi cả kho một lần bằng `observedText`, không search từng món.

### Added

- **`conflictedTeams`** trong kết quả `recommendRoster` (engine dùng chung `js/team-recommend-engine.js`) và `tqccl_recommend_teams`: đội đủ kho khi đứng riêng nhưng không vào danh sách vì dùng chung tướng/chiến pháp với đội đã chọn, kèm món tranh chấp và đội đang giữ. Trước đây các đội này chỉ nằm trong `diagnostics.prunedCandidates` nội bộ nên agent ghi "0 xung đột" (Dewee R2 case 18). Đội bị loại chỉ vì hết chỗ không vào danh sách này. Website chưa hiển thị trường mới.
- **`tqccl_normalize_entities` tự tra tên.** Observation chỉ có `observedText`/`displayName` (không `canonicalId`, `candidates`, `reviewRequired`) được tra bằng lõi search của trang Tra cứu, chỉ nhận khớp đúng tên: một mục → gán `canonicalId`; tên bản thường mà tộc còn bản 40Y/SP/CO, hoặc nhiều mục cùng tên → `ambiguous` kèm mọi bản; không khớp → `unknown` kèm tối đa 5 gợi ý khớp một phần. Trước đây observation thiếu `canonicalId` luôn ra `unknown`, nên agent phải search từng tướng/chiến pháp (Dewee R2b case 18 lượt 1: 2 normalize hỏng + 16 search). Snapshot v1/v2 (không có publication) gửi tên thì trả `CAPABILITY_UNAVAILABLE`.

## 2026-10-08 (MCP + skill: snapshot v3, bề mặt 7 tool P*, knowledge dataset, skill làm lại — CHƯA deploy)

### Changed

- **Snapshot manifest v3** = artifact v2 + publication projection (catalog/reference/recommend read model). v1/v2 vẫn đọc được nhưng catalog/reference/recommend trả `CAPABILITY_UNAVAILABLE` (không bao giờ là mảng rỗng); identity v1/v2 giữ nguyên. Hợp đồng ở `mcp-worker/src/data/artifact-contracts.ts`.
- **Bảy tool P\***: `tqccl_get_playbook`, `tqccl_search`, `tqccl_get_entity`, `tqccl_find_teams`, `tqccl_get_team`, `tqccl_normalize_entities`, `tqccl_recommend_teams`. **Tám tool cũ bị xoá, không alias** (`tqccl_get_data_version`, `tqccl_match_team`, `tqccl_recommend_team`, `tqccl_recommend_coexist`, `tqccl_suggest_replacements`, cùng `tqccl_search`/`tqccl_get_team`/`tqccl_normalize_entities` bản schema cũ); `recommendation-service` và `season-reference-projection` bị gỡ. Schema thuộc `mcp-worker/src/research/research-contracts.ts` (không sao chép vào tài liệu). `tqccl_recommend_teams` gọi đúng `recommendRoster` của trang Gợi ý kho (kết quả `basis:"source-reference-fit"`, `rulesetVerified:false`).
- **CLI**: alias `playbook, search, entity, find-teams, team, normalize, recommend` (bảng `CLI_ALIASES` trong `mcp-worker/src/cli.ts`) cộng lệnh chỉ-CLI `search-rules`.
- **`tools/list` gọn dưới 90 KiB** (output schema bỏ mô tả field lồng, error envelope phẳng dùng chung) nên `TQCCL_MCP_MAX_RESULT_BYTES` giữ 98304; `content[0].text` là JSON tương đương `structuredContent`, trần mỗi kết quả 42 KiB.
- **`tqccl_normalize_entities` không còn `INTERNAL_ERROR` khi agent gửi tướng thiếu `familyId`** (lỗi có từ trước, lộ ra khi đo R0 trên Dewee `tra`): server suy `hero-family:` từ `canonicalId` trong heroes-dict. `canonicalId` tướng không có trong snapshot hoặc `familyId` lệch trả `INVALID_REQUEST` kèm field.

### Added

- **Knowledge dataset** canonical tại `agent-knowledge/` (rules, aliases, workflows, schemas); Worker nhận qua module sinh `mcp-worker/src/generated/knowledge-bundle.ts` từ `mcp-worker/scripts/generate-knowledge-bundle.ts` (`knowledgeVersion` tách khỏi `workflowVersion`). Playbook trả version/capability/luật bắt buộc; `tqccl_search_rules` chỉ là lõi knowledge + CLI, không phải MCP tool.
- **Skill** (`.agents/skills/`): thêm `tqccl-lookup`; làm lại `tqccl-coexist-team-builder` và `tqccl-research` (thêm `evals/`); gỡ helper `scripts/list_candidate_teams.py`.

### Deploy / consumer (chưa thực hiện)

- **Chưa deploy production; Dewee R0–R2 chưa chạy.** Chia Release 1 / Release 2 là vấn đề lịch deploy (xem `plans/260927-1727-mcp-skill-redesign/phase-04-integration.md`), không phải hợp đồng runtime.
- Đổi catalog nên consumer phải reconnect và refresh `tools/list` (Dewee: [dewee#887](https://github.com/nextlevelbuilder/dewee/issues/887)), đổi grant/service key sang tên mới. Rollback: exact Worker version trước đó (code + data cùng lúc). Consumer (GoClaw/Dewee) sở hữu skill/grant/rollout phía họ; hợp đồng ở [goclaw-mcp-skill-handoff.md](goclaw-mcp-skill-handoff.md).
- Tài liệu cập nhật: `docs/goclaw-mcp-skill-handoff.md`, `docs/mcp-research-server.md`, `docs/unified-lookup.md`, `README.md`.

## 2026-10-08 (Gợi ý đội từ kho: sửa adapter dùng chung `recommendRoster` trước khi nối MCP)

### Fixed

Sửa tám lỗi audit ở `js/roster-season-candidates.js`, `js/team-recommend-engine.js`, `js/roster-scan-state.js`, `js/roster-recommend-ui.js` (website và `tqccl_recommend_teams` dùng chung `recommendRoster`):

1. **Cắt pool 60/80 trước khi kiểm kho.** Engine lọc theo kho trước, không cắt số lượng trước khi kiểm; thêm option `poolLimit` (mặc định 60) chỉ giới hạn DFS fullBox, còn bước tham lam dự phòng luôn xét TOÀN danh sách đã qua kiểm kho (không bịa `seasonContext` để né giới hạn). Probe pk-s26 Meta và probe >80 ứng viên: trước đây 0 đội mùa, nay đủ.
2. **Loại đội cũ quá tay.** Đội cũ chỉ bị loại khi trùng bộ 3 tướng với đội mùa ĐÃ CHỌN (`season.addTeams`), không phải với mọi đội mùa.
3. **Món bù không kiểm luật đội** (tối đa 1 trận pháp, 1 binh chủng, binh chủng phải hợp loại binh; suy từ `type`/`troopFit` của `data/tactics.json`). Kiểm cả ở gợi ý (`analyzeTacticSubstitutes`) lẫn ở engine với món bù đã chọn (trạng thái riêng `incompatible`, mảng `incompatibleTeams`, không gộp vào `blockedStrongTeams`). Luật chỉ áp cho món bù do người dùng chọn: 46/1317 đội nguồn tự lệch luật loại binh nên dữ liệu gốc không bị kiểm.
4. **Thiếu `unitTypesRaw`** (48/1336 cấu hình): đội mùa mang `unitType` (và `unitTypesRaw`), rỗng thì không gợi ý và không nhận binh chủng nào (`troop-unit-unknown`).
5. **Món bù đã chọn** tính vào tổ hợp cuối của đội (`finalTeamTactics`); UI truyền `team` + ô thay vì danh sách tên gốc.
6. **Món bù thứ 21 không còn bị bỏ âm thầm:** `setTacticOverride` từ chối ô mới khi đầy `MAX_TACTIC_OVERRIDES` (20), `tacticOverrideBlocked` để UI báo và vô hiệu nút.
7. **Ô chiến pháp chưa đối chiếu với từ điển** (vd. `御敵屏障` ở `s28-wutugu-huangma`): giữ tên Việt dự phòng của nguồn, `unresolved: true`; đội còn ô này có trạng thái `unreconciled` (kèm `unresolvedTactics`), không bao giờ `build-now`; ô này không bắt buộc sở hữu và không là nguồn món bù.
8. **Nhãn bậc biến thể đã thay:** entry có `variantUnrated` + `originalTier`; UI hiện "Bậc cấu hình gốc: Tx · bản đã thay chưa được đánh giá" (zh: 原配置梯度）; bản đã thay xếp sau đội cùng bậc không bị thay (`rankingTuple[1]`).

### Decided

- Chính sách trộn hai nguồn (ghi ở `recommendRoster`): chốt đội mùa trước, đội cũ chỉ dùng tài nguyên còn lại và xếp sau; KHÔNG bảo đảm số đội tối đa khi trộn.
- Giới hạn phe/truyền thừa và luật theo mùa chưa có dữ liệu: không kiểm, không đoán.

### Tests

- `tests-js/roster-adapter-audit.test.mjs` + `tests-js/fixtures/roster-adapter-fixtures.mjs` (fixture dựng từ bản ghi thật, dùng lại cho parity web = MCP): `s28-wutugu-huangma`, `team-831163`, `team-jyspt`, `team-1imndp3`, `team-epoddo` (thiếu `unitTypesRaw`), probe pk-s26 >60/>80, kiểm ba loại sai bằng 0 trên pk-s24/26/28.
- Cập nhật test đang ghim hành vi cũ: ô lạ là điều kiện, đội cũ bị loại theo mọi đội mùa, cắt món bù thứ 21 (`roster-season-candidates`, `roster-scan-state`).

### Publish

- `workflow-build` sinh lại (adapter và `js/roster-scan-state.js` nằm trong semantic closure nên sửa adapter đổi `workflowVersion`).
- Bản dịch hiển thị publish lại theo `docs/deployment-guide.md`: re-pin sha256 nguồn trong `pipeline/site-localization-policy.json`, generation Recommended mới `9945cf05…` (thay `a973b093…`, đã prune), `data/website-display.json` mới, `pipeline/team-route-handles.json` re-pin generation; `site_localization check --stage public` và `team_route_handles --check` đạt.
- `suggestTacticSubstitutes` bị gỡ; dùng `analyzeTacticSubstitutes(...).substitutes` (khoá chiến pháp nhận cả tên lẫn ID `tactic:` nên chiến pháp của đội đã khoá không bị gợi ý làm món bù).

## 2026-10-07 (Tra cứu tướng: Đánh giá của bản thường bị gắn vào bản SP)

### Fixed

- SGSDeck gắn 評價 của bản thường vào bản SP ở 11 tướng (Quan Vũ, Điển Vi, Hứa Chử, Tuân Úc, Mã Siêu, Hoàng Trung, Hoàng Nguyệt Anh, Pháp Chính, Tôn Kiên, Đổng Trác, Điêu Thuyền): nguồn 評價 là danh sách 遊民星空 ngày 2022-01-24 (tới khoảng S11), các bản SP này ra mắt S13–S25, chiến pháp "rã lấy" là truyền thừa của bản thường và bản thường không có 評價 riêng. Người dùng phát hiện ở SP Tuân Úc ("rã lấy Tứ Diện Sở Ca" là truyền thừa của Tuân Úc thường). Bảng `USAGE_REASSIGNMENTS` của `build_unified_lookup` chuyển 11 đoạn sang hồ sơ bản thường, bản SP không còn mục Đánh giá; chữ nguồn lệch, bản thường đã có 評價 riêng hay mục không dùng làm build dừng. SP Chu Du, SP Gia Cát Lượng, SP Viên Thiệu, SP Quách Gia, SP Chu Tuấn (ra mắt ≤ S11) giữ nguyên.
- 11 mục `lookup.usageVi` đổi `entityId` sang bản thường, chữ giữ nguyên; receipt `lookup-tuong-danh-gia-reassign-20261007`, batch cũ bỏ 11 mục tương ứng. Policy `site-vi-261007-danh-gia-ban-thuong` (chỉ đổi digest inventory). Generation Tra cứu `lookup:29322cab…`, Đội chuẩn `a973b093…` (prune `8a5f4b2c…`), re-pin `pipeline/team-route-handles.json`.

## 2026-10-07 (Tra cứu tướng: Đánh giá giữ/rã thẻ và Cách nhận theo gói)

### Added

- **Hồ sơ tướng có mục Đánh giá và Cách nhận.** 94 tướng hiện lời khuyên giữ/rã/đổi thẻ (`評價`, bản Việt đã duyệt; bản zh hiện chữ Hán nguồn), 126 tướng hiện gói chiêu mộ có thể ra tướng: loại gói · tên gói, có phải tướng lõi không, và tỉ lệ ra tướng lõi/thường **của cả gói** (vd SP Điển Vi: Danh tướng lõi 34%/66%, Sưu tầm thường 36%/64%, Động Như Lôi Đình lõi 41%/59%, PK Danh tướng III lõi 47%/53%). Tướng không có dữ liệu ẩn hai mục. Payload tướng thêm `lookup.usageVi`, `lookup.usageZh`, `lookup.cardPacks[]` (`packVi`, `packZh`, `categoryVi`, `categoryZh`, `isCore`, `coreRate`, `nonCoreRate`); `js/lookup-data.js` kiểm hình dạng và tỉ lệ 0–1.
- `pipeline/sgsdeck_source.parse_general_detail` đọc thêm `usage` và `cardPackAppearances` (kiểm tier `core`/`non-core`, tỉ lệ 0–1, gói thuộc đúng tướng, không trùng); `lore`, ảnh vẫn bỏ.
- **`pipeline/sgsdeck-guide.json`** (mới): bảng 16 gói + guide của cả 202 tướng, gắn `snapshotManifestHash` của `data/sgsdeck/manifest.json`. Dựng bằng `python3 -m pipeline.build_sgsdeck_catalog --cache pipeline/sgsdeck-cache --guide-only` từ đúng cache đã dựng snapshot; `query_sgsdeck_catalog.validate_guide_document` kiểm schema, binding và phủ đủ tướng. Guide nằm ngoài snapshot vì byte snapshot bị `pipeline/lookup-identity.json` pin, mà file đó là nguồn glossary của gate bản dịch (đổi là stale toàn bộ review receipt).
- `build_unified_lookup` capture guide cạnh registry (`inputHashes.guide`), dịch tên gói/loại gói bằng bảng `CARD_PACKS`/`CARD_PACK_CATEGORIES` (gói lạ làm build dừng), ghi ledger `guide.usage`/`guide.cardPacks[…]`.
- Bản dịch: 94 mục `lookup.usageVi` duyệt theo `plans/reports/translation-review-261007-tuong-danh-gia-cach-nhan.md`, receipt `lookup-tuong-danh-gia-20261007`; 5 nhãn UI `ui:lookup/hero-usage`, `hero-card-packs`, `hero-card-pack-core`, `hero-card-pack-regular`, `hero-card-pack-rates` (authored-vi). Policy `site-vi-261007-tuong-danh-gia-cach-nhan`, baseline 56727 → 56826 location; re-pin `js/lookup-data.js`, `js/lookup-detail.js`, `js/lookup-profile.js`.
- Promote transaction `site-vi-261007-tuong-guide` (`lookup:8878e4fc…`, chỉ `heroes-dict.json` đổi); publish generation Đội chuẩn `8a5f4b2c…`, re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` sinh lại vì `js/lookup-data.js` đổi. Generation `5a4a1e2b…` chưa prune.

### Tests

- `tests/test_sgsdeck_source.py`, `tests/test_build_sgsdeck_catalog.py`, `tests/test_query_sgsdeck_catalog.py`: đọc guide, gói định nghĩa lệch giữa hai tướng bị từ chối, guide dựng không đổi byte snapshot, guide lệch snapshot/gói/tier bị từ chối.
- `tests/test_build_unified_lookup.py`: SP Điển Vi có đủ 4 gói và bản dịch, 94/126 tướng có dữ liệu, ledger guide, gói lạ làm build dừng, validator từ chối usage/gói sai hình dạng.
- `tests-js/lookup-data.test.mjs`, `tests-js/unified-lookup.test.mjs`: bundle từ chối usage một nửa và tỉ lệ ngoài 0–1; hồ sơ bản Việt/zh hiện hai mục, tướng không có dữ liệu ẩn hai mục. Fixture tướng (JS, E2E, MCP) thêm ba trường mới.

## 2026-10-07 (Tra cứu: hiệu ứng binh thư, link binh thư theo tên nguồn)

### Changed

- **Hồ sơ Binh thư có hiệu ứng.** `pipeline/books-han-viet-map.json` thêm `effect` (chữ phồn thể nguồn), `effectViet` (bản dịch đã duyệt, thuật ngữ theo `effectViet` của `tactics.json`) và `effectVersion` (mốc số liệu: 2021-11 cho bốn nhánh gốc, 2024-07 cho 始計/用間 và 6 binh thư điều chỉnh) cho cả 68 binh thư; `build_books_dict` ném lỗi khi thiếu một phần trong ba trường. Hồ sơ bản Việt hiện `effectViet`, bản zh hiện chữ Hán nguồn, kèm dòng **Số liệu theo bản** (`ui:lookup/book-effect-version`). Nguồn và giới hạn: `plans/reports/research-260928-binh-thu-hieu-ung-va-ten-chua-link.md`.
- Sửa tên Hán trong `books-dict`: `出其不意` (là chiến pháp) → `出奇制胜`, `顺应天时` → `顺天应时`, `以武止戈` → `以治击乱` (Lấy Võ Dẹp Loạn, hiệu ứng khớp client VN). Thêm **Chia Lời** (`分利`) và **Tinh Thần Sảng Khoái** (`神清气净`), hết mục `_unresolved` cũ.
- `books-dict` có `sourceNames` (tên nguồn phồn thể/biến thể chữ của chính binh thư) và `excludedSourceNames` (tên của binh thư khác từng bị dịch nhầm sang tên Việt này: `以退為進` ở Dĩ Trực Báo Oán). Trang chi tiết Đội chuẩn tra binh thư theo tên Hán nguồn khi ô có tên nguồn, chỉ dùng tên Việt khi ô không có (nội dung đội gốc): 21 ô `順天應時` và 8 ô `分利` có link, 6 ô `以退為進` thôi trỏ nhầm sang Dĩ Trực Báo Oán. `sourceNames` cũng là khóa tìm của nhóm Binh thư; tên đã là tên nguồn hiện hành không còn hiện thành `旧名`.
- Không sửa `pipeline/recommended-identity-map.json`: đây là nguồn glossary của gate bản dịch, đổi file làm stale toàn bộ review receipt. Vì vậy chữ trên ô Đội chuẩn vẫn giữ bản dịch cũ ("Thuận Thiên Ứng Thời", "Dĩ Trực Báo Oán" cho `以退為進`) và 3 ô `拓濟世救貧` (= `拓·濟貧好施`) chưa có link.
- Bản dịch: policy `site-vi-261006-binh-thu-hieu-ung`, baseline 56726 → 56727 location, re-pin `js/lookup-detail.js` và `js/unified-lookup.js`; publish generation `5a4a1e2b…` (xoá `499c044a…`), re-pin `pipeline/team-route-handles.json`.

### Tests

- `tests/test_build_books_dict.py`: mang trường hiệu ứng/tên nguồn, từ chối hiệu ứng thiếu một phần và tên loại trừ trùng tên nguồn, mọi binh thư đã xuất bản có hiệu ứng, map khớp byte-đối-byte với `books-dict`.
- `tests-js/lookup-ids.test.mjs`: ô có tên Hán nguồn quyết định hồ sơ (bản dịch lệch hay nhầm không dựng link sai), ô chỉ có tên Việt vẫn tra được; `bookSourceAliases` bỏ tên nguồn hiện hành và tên loại trừ. Fixture cũ ghép `以退為進` với Dĩ Trực Báo Oán được thay.
- `tests-js/unified-lookup.test.mjs`: hồ sơ binh thư bản Việt/zh hiện hiệu ứng và phiên bản, mục chưa có hiệu ứng để trạng thái trống, tìm bằng `sourceNames`.

## 2026-10-05 (Tra cứu: Trang bị, Quân sư, Cải tạo binh chủng, Công trình theo thiết kế mới)

### Changed

- **Bốn trang nhóm catalog** (`/tra-cuu/trang-bi/`, `/quan-su/`, `/cai-tao-binh-chung/`, `/cong-trinh/` và `/zh/…`) bỏ lưới thẻ chữ Hán chung và hộp thoại hồ sơ, dùng bố cục danh sách + chi tiết theo artboard `LookupEquipment`/`LookupAdvisors`/`LookupTroops`/`LookupBuildings` (+ `…Mobile`, `…DetailMobile`). Khung đầu trang (tiêu đề, ô tìm, chip bảy nhóm, dòng trạng thái) giữ nguyên; tướng, chiến pháp, binh thư giữ nguyên hộp thoại.
- Mã mới `js/lookup-master.js` (view thuần dựng bằng cây view, dùng chung build và trình duyệt): chip lọc (trang bị: ô + phẩm; quân sư: hệ; cải tạo: binh chủng; công trình: thành chính/mọi thành), thẻ/hàng danh sách, panel chi tiết. Trang bị: thẻ nhuộm theo phẩm, panel có đặc kỹ độc quyền (T0–T3) và danh sách đặc kỹ chung; mã `equipment-special:*` mở trang bị cha với đặc kỹ tô khung, đặc kỹ không có cha mở chi tiết riêng. Quân sư: thẻ ô chữ hệ + mô tả rút, panel Võ tướng/Điểm chiến pháp/Hiệu quả/Cách dùng. Cải tạo binh chủng: danh sách chia khối theo binh chủng, phiên bản hiệu quả (hiện hành/gốc), cây 4 bậc có dấu "Gợi ý" suy từ tên trong 【…】 của `suggestedBuildVi` (`troopSuggestedIds`, không khớp thì không đánh dấu) và thanh gợi ý build. Công trình: bốn ô số liệu, bảng theo cấp, dòng tổng tài nguyên (`buildingTotals`).
- Desktop chọn sẵn mục đầu (chi tiết dựng sẵn lúc build, không cần JS); bấm mục đổi `?id=` (push, Back về mục trước). Từ 1023px trở xuống danh sách một cột và chi tiết là màn riêng có nút quay lại (`data-lookup-detail-open`), focus vào nút quay lại khi mở và về mục đã bấm khi đóng.
- Corpus: nhóm trang bị chỉ còn 114 trang bị (trước đây gộp 90 đặc kỹ thành 204 mục, chip và mục lục giờ ghi 114 đúng artboard); đặc kỹ vẫn tra được theo mã (`byId`) và tên đặc kỹ gắn trang bị là khóa tìm phụ của trang bị đó. **Đổi có chủ ý:** đặc kỹ chung/chưa rõ trang bị cha không còn là kết quả tìm riêng, chỉ xuất hiện trong chi tiết trang bị (danh sách "Đặc kỹ chung có thể rèn") hoặc qua mã.
- Bỏ mã chết của hộp thoại: `lookup-profile.js` không còn dựng cấp công trình, lựa chọn cải tạo, mục con và quan hệ dạng nút cho nhóm catalog (nhánh hồ sơ "nhóm khác" chỉ còn binh thư), xoá `costText` và CSS `.lookup-level*`/`.lookup-option*`/`.lookup-link-chips`. Hồ sơ dữ liệu của các nhóm này trong `lookup-detail.js` (`lookupProfile`) giữ nguyên.
- Cỡ trang theo nhóm (`lookupPageSize`): trang bị 24, quân sư 18, công trình 20, nhóm khác 60; `lookupMoreTrees` nhận cỡ trang.
- Trang Trang bị và Quân sư nhúng sẵn tướng liên quan (`#lookup-owner-heroes`, `{id, viet, chinese, iconUrl}`) để danh sách và chi tiết ghi tên tướng mà vẫn chỉ tải `lookup-catalog.json` lúc vào (hợp đồng "mỗi trang nhóm chỉ tải payload của nhóm mình" giữ nguyên); `LOOKUP_GROUP_PAYLOADS` của hai nhóm này không còn payload hồ sơ.
- Token: nhóm `color.tint` (`--tint-cam|tim|hoa|phong|lam|son` + `-ink`, `--tint-cam-line`, `--tint-tim-line`; có bản tối), `--ink-body`, `--line-3`, `--accent-line`, `--shadow-selected`, `--size-tile-76|panel-420|panel-440|list-280|col-34|col-36`, 27 vai trò chữ `--type-lookup-*`/`--type-chip-count`. Danh mục component thêm `tra-cuu-danh-sach-chi-tiet`, `the-trang-bi`, `the-quan-su`, `hang-danh-sach`, `panel-chi-tiet-tra-cuu`, `khoi-dac-ky`, `cay-cai-tao`, `bang-cap-cong-trinh`. Bảng màu và vai trò chữ cho Tím/Hỏa/Lâm là suy từ chấm lọc của artboard (artboard chỉ vẽ Cam, Phong, Sơn); chữ tối tự suy.
- `node scripts/design-tokens.mjs --check` đang đỏ sẵn ở HEAD vì 5 giá trị thô (`font-weight` 400/600/700, `line-height: 1`): thêm nhóm token `weight` (`--weight-regular|semibold|bold`) và `leading` (`--leading-solid`), thay 5 chỗ đó, và cho `scripts/design-tokens.mjs` đọc thêm nhóm màu `tint`. Khối legacy vẫn ceiling 0.
- Bản dịch: thêm 66 obligation `authored-vi` `ui:lookup-master/*` cho chữ mới, gỡ `ui:lookup/option-converts` (giao diện lựa chọn cải tạo trong hộp thoại đã bỏ) và đổi biểu thức của `ui:lookup/more-note` (`${pageSize}`); policy `site-vi-261005-tra-cuu-danh-sach-chi-tiet`, baseline 56661 → 56726 location, `js/lookup-master.js` vào `entrypoints`/`sourceFiles` của họ `lookup`, re-pin hash 6 nguồn; publish generation `499c044a…` (xoá `ae77c9c3…`), re-pin `pipeline/team-route-handles.json` (xem commit republish).

### Tests

- `tests-js/lookup-master.test.mjs` (mới): chip lọc và số đếm, bộ lọc giao nhau trước khi cắt trang, thứ tự gom theo binh chủng và mục chọn mặc định, `masterTargetFor` cho mã đặc kỹ (có cha/mồ côi/lạ), đặc kỹ chung theo ô, dấu "Gợi ý", phiên bản hiệu quả, tổng tài nguyên/số nổi bật của công trình, chi tiết bản zh không lọt chữ Việt.
- `tests-js/unified-lookup.test.mjs`: nhóm trang bị chỉ có trang bị (đặc kỹ còn tra được theo mã và là khóa tìm phụ của trang bị cha) — đổi có chủ ý.
- `tests-e2e/unified-lookup.spec.mjs`: các test mở "hồ sơ" của Trang bị/Công trình đổi sang panel chi tiết; thêm nhóm test danh sách + chi tiết (HTML dựng sẵn không JS, chọn mục + Back, chip lọc, mã đặc kỹ, cây gợi ý và thẻ phiên bản, bảng công trình, màn chi tiết mobile + focus, bản zh).

## 2026-10-05 (Gợi ý đội từ kho: giao diện theo thiết kế mới)

### Changed

- **Gợi ý đội từ kho** (`js/roster-recommend-ui.js`, `css/styles.css`) theo artboard `Roster`/`RosterResult` (+ Mobile), chia hai màn. Màn kho: dải 3 bước Đọc kho · Kiểm tra · Gợi ý (`.ana-flow.roster-flow`, trải hết bề ngang, giữ chữ trên mobile); thẻ thiết lập gồm "Mùa bạn đang chơi" + dòng phụ, "Ưu tiên gợi ý" thành radio phân đoạn (thay select), lời nhắc AI; 3 thẻ đọc ảnh có pill "N … đã đọc", khung tối "N ảnh · <lúc đọc>", nút Chọn ảnh (chọn là đọc ngay) + "Đọc lại"/"Đọc ảnh" (gửi lại ảnh vừa chọn); một dòng trạng thái chung dưới thẻ; "Kiểm tra kho đã đọc" hai cột chip (đếm "48 tướng · hiện 16", tối đa 16 tướng / 12 chiến pháp trước "Hiện tất cả"), đội đang khóa có icon khóa + "Bỏ đội"; thanh thao tác Xóa toàn bộ kho | Xác nhận · Gợi ý 5 đội dính đáy ở desktop.
- Màn kết quả: dải tóm tắt kho (mùa, ưu tiên, số tướng/chiến pháp, số đội khóa) + "Sửa kho đã đọc" quay lại màn kho (thay nút đóng/mở khu kiểm tra chỉ có trên mobile); hai cột "Danh sách đội sau khi xây dựng" (pill "Đã đủ 5 đội" hoặc `n/5 đội`, thẻ đội có số thứ tự, pill bậc + trạng thái, hàng tướng → chiến pháp, khối "Đã thay" hổ phách, "Mở đội →"; đội cũ viền đứt) | "Thiếu món" (pill "Thiếu N món", dòng cảnh báo + "Tôi có…", "Món bù có trong kho" dạng "Dùng X thay Y", "Vì sao?" mở khung giải thích). Bỏ mục "Nên thêm" (trùng danh sách trừ đội khóa). Bước 3 là bước đang làm khi xem kết quả.
- Đội khóa đọc từ ảnh không có tướng giữ chiến pháp: thẻ kết quả hiện hai hàng Tướng / Chiến pháp thay vì đoán.
- Kho lưu thêm `scans.{heroes,tactics,builtTeams} = {images, at}` (số ảnh đã đọc, lần đọc gần nhất; giá trị lạ bị bỏ khi đọc lại). `seasonNameText` (tên mùa không kèm số đội) tách khỏi `seasonOptionText`.
- Token: thêm `--warn`/`--warn-bg` (hổ phách: Dùng biến thể, Thiếu N món, Đã thay; theme tối tự suy, ≥ 4,5:1). Danh mục `buoc-cong-cu` viết lại cho `.roster-flow`; `the`, `the-cong-cu`, `tool-notice`, `tool-text-action`, `chip-bo-tuong` cập nhật selector/probe.
- Bản dịch: đổi chữ 14 obligation `authored-vi` `ui:roster/*` theo chữ mới, publish chung với Chiêu mộ (xem mục Chiêu mộ 2026-10-05). Sau đó thêm 27 obligation `authored-vi` cho chữ mới (thẻ thiết lập, thẻ đọc ảnh, đếm chip / Hiện tất cả, kiểm tra kho, tóm tắt kho, pill bậc / `n/5 đội` / Thiếu N món, "Dùng X thay Y", nguồn lời giải thích); không đổi obligation `translate`. Policy `site-vi-261005-goi-y-kho-chu-moi` (baseline 56661 vị trí cụ thể), publish generation `ae77c9c3…` (thay `2919664e…`, đã prune), re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` MCP không đổi.

### Tests

- `tests-e2e/beta-tools.spec.mjs` (Gợi ý đội, Vòng sửa P09, Turnstile báo lỗi): chọn ảnh là đọc, "Đọc lại" chờ token mới, dòng trạng thái chung, khung "N ảnh · vừa xong", dải bước `.roster-flow`, màn kết quả + "Sửa kho đã đọc" giữ focus, pill "Đã đủ 5 đội" / `0/5 đội`, hàng Tướng / Chiến pháp của đội khóa, mobile không tràn ngang và thanh thao tác không dính; `spa-parity`, `season-lookup`, `selected-state-contrast` theo selector mới.
- `tests-js/roster-scan-state.test.mjs`: đếm ảnh theo loại, giữ khi bỏ chip, xoá khi xoá kho, bỏ giá trị lạ.

## 2026-10-05 (Chiêu mộ: giao diện theo thiết kế mới)

### Changed

- **Theo dõi chiêu mộ** (`js/recruit-tracker.js`, `css/styles.css`) theo artboard `Recruit`/`RecruitFiveStar` (+ Mobile): hàng tài khoản có nhãn trên select (mỗi mục "Tên · x/30"), chip ☁ dạng pill, nút + Tài khoản / Xuất JSON / Nhập JSON trên hàng, menu ⋯ chỉ còn Đổi tên / Xóa tài khoản. Lưới 2 cột: thẻ Hôm nay + Nhật ký | Thống kê, Gói hạn giờ, thông báo lưu dữ liệu (cột phụ 380px); ≤980px một cột theo thứ tự RecruitMobile.
- Thẻ Hôm nay: số bảo hiểm serif 84px (mobile 64px), thanh vàng → son có vạch 1/3 · 2/3, "Hôm nay x/4" + 4 vạch lượt rẻ, dòng "Còn N lượt · hôm nay còn M lượt rẻ", "Chỉnh số" lên đầu thẻ; 3 nút ghi nhanh (2 miễn phí, Đủ 4, Có 5★) có dòng phụ nói đúng số sẽ ghi.
- Nhật ký: ngày "Hôm nay"/"Hôm qua"/dd/mm (ngày đủ ở tooltip), dòng phụ "tên gói · Lượt a–b/4" cho lượt rẻ gói ngày, badge phân loại 5★ hoặc "Chỉnh số"; nút sửa/xóa có viền. Thống kê có dòng phụ (so mốc 30, số Chủ lực, ngày liên tiếp), số thập phân theo ngôn ngữ trang.
- Gói hạn giờ: thẻ giấy nhạt, chip hạn (vàng ở ngày cuối, đỏ khi quá hạn), "+ Lượt" mở hộp thoại số lượt (thay hai nút +1/+5), "Có 5★" nền son.
- Hộp thoại Có 5★: kicker "Gói · Tài khoản", thanh chọn lượt trúng (radio native), ô −/+ "Quay tiếp sau đó", gợi ý dưới ô Tướng, Phân loại | Ngày (gói ngày: chỉ đọc, hôm nay), khung xem trước "Sẽ ghi 5★ ở lượt N … tiến độ về x / 30". Mọi hộp thoại của công cụ dùng chung đầu/nút mới; mobile Lưu rộng hết hàng trên Hủy.
- Store: `getRecruitTrackerSummary().accounts[]` kèm `dailyPity` của từng tài khoản (cho ô chọn tài khoản).
- Token: thêm `--gold` (đầu dải thanh bảo hiểm), `--type-pity-value` (84px); `--type-pity-unit` lên 600; bỏ `--type-pity-value-mobile`; chip hạn dùng `--warn`/`--warn-bg` có sẵn. Danh mục `menu-tai-khoan`, `thanh-tien-do`, `the-cong-cu`, `toast-hoan-tac`, `nhat-ky-chieu-mo` cập nhật cấu tạo/probe; thêm `the-goi-han-gio`, `hop-thoai-5-sao`.
- Bản dịch: đổi chữ của 2 obligation `authored-vi` (`ui:recruit/pity-meta-lead`, `ui:recruit/form-title`) theo chữ mới, không đổi obligation `translate` (baseline giữ nguyên). Policy `site-vi-261005-chieu-mo-goi-y-kho-redesign` re-pin hash `js/recruit-tracker.js`, `js/recruit-tracker-store.js` cùng `js/roster-recommend-ui.js`, `js/roster-scan-state.js`, `js/team-filter-section.js` (Gợi ý kho); publish generation `2919664e…` (thay `54b1dae5…`, đã prune), re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` MCP không đổi.

### Tests

- `tests-js/recruit-tracker-ui.test.mjs`: dòng phụ nút nhanh, "hôm nay còn/đã đủ", `optionText` tài khoản, ngày nhật ký tương đối, nhãn "Lượt a–b/4", dòng phụ thống kê, `tone` chip hạn.
- `tests-e2e/beta-tools.spec.mjs`: hộp thoại 5★ (thanh chọn lượt, ô −/+ đổi trần theo lượt trúng, khung xem trước), "+ Lượt" qua hộp thoại, ngày "Hôm nay", "x / y", Xuất/Nhập JSON trên hàng tài khoản.

## 2026-10-04 (Soi đội: giao diện theo thiết kế mới)

### Changed

- **Soi đội** (`js/analyze.js`, `css/styles.css`) theo artboard `Analyze`/`AnalyzeReview`/`AnalyzeResult` (sửa tay 2026-10-03/04): đầu trang có dải 3 bước Chọn ảnh · Kiểm tra đội · Đối chiếu (`.ana-flow`, `aria-current="step"`). Bước 1: thẻ chọn ảnh rộng + cột Lịch sử bên phải; khung thả ngang (vòng icon son nhạt, chữ serif), mục "Ảnh đọc được" (màn đội hình / màn chiến báo), chip tiến độ đọc ảnh, "Cách hoạt động" 3 bước. Từ bước 2 (`.ana-layout[data-stage=work]`) trang thành một cột: hàng ảnh đã chọn + nút, chọn phe, editor, kết quả, lịch sử.
- Editor: tóm tắt lượt đọc ảnh (đếm Khớp/Để trống/Không chắc/Không rõ + nút tới từng ô cần xác nhận), mỗi tướng là thẻ có ấn phe chữ Hán + tên đã chọn + số ô ổn, ô khớp có ✓ trong ô nhập, ô lỗi tô nền với "Gợi ý gần nhất" và nút Để trống cạnh ứng viên; thanh Đối chiếu dính đáy (desktop) có tiến độ x/12 ô, mùa, lời nhắc, nút.
- Kết quả: diff mỗi đội là bảng Tướng | Chiến pháp A | Chiến pháp B | Binh thư (chiến pháp khác đội viền đứt đỏ, "Đội dùng" dưới đúng tướng, dòng Thiếu tướng viền đứt); đội khớp trọn viền lục + chip "Khớp trọn" thay cho viền son của hàng đầu.
- Danh mục component `o-doc-anh`, `o-sua-doi`, `hang-doi-tuong-tu` trong `tokens.json` cập nhật theo cấu tạo mới; không thêm token.
- Bản dịch: chữ obligation cũ giữ nguyên trong nguồn, không thêm/đổi obligation; policy `site-vi-261004-soi-doi-redesign` (re-pin hash `js/analyze.js`), publish generation `54b1dae5…` (thay `5f23f4df…`, đã prune), re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` MCP không đổi.

### Tests

- `tests-e2e/beta-tools.spec.mjs`: hàng khớp trọn viền `--good` + chip "Khớp trọn" (thay viền `--accent`); tóm tắt lượt đọc có đúng 2 ô cần xác nhận, bấm mục đưa focus vào đúng ô; dải bước chuyển Kiểm tra đội → Đối chiếu.

## 2026-09-29 (Soi đội đọc cả hai phe; đếm ẩn danh, gửi ảnh tự nguyện, bộ ảnh chuẩn)

### Changed

- **Worker `analyzeTeamImage`** trả `{screen: battleReport|teamDetail|other, sides: [{side: left|right, heroes}]}`: một lượt AI chép mọi phe (bỏ quy tắc "chỉ chép phe 我方"), mỗi phe 主将 trước (phe phải đọc từ phải sang trái), bản game tiếng Việt chép nguyên chữ Việt. `validateResult` chịu output dạng cũ `{heroes}`, `screen` lạ, `side` thiếu/trùng, bỏ phe rỗng; trần 6 tướng/phe, 12 tổng.
- **Soi đội** (`js/analyze.js`): ảnh hai phe hiện bước "Chọn phe" (xem trước tên tướng mỗi phe) trước editor; editor có nút đổi phe, dùng lại kết quả đã đọc và giữ draft đã sửa của từng phe. Editor, `?doi=v1`, lịch sử, PNG giữ hợp đồng 3 tướng, không mang phe. Chờ Worker quá 15 s thì báo AI đang đọc kỹ. Frontend tạm nhận cả dạng cũ `{heroes}` để Pages deploy trước Worker.
- **Đếm ẩn danh** `POST /api/scan-stats` (community-worker, không đăng nhập, 60/giờ theo IP đã băm): lần Đối chiếu đầu của mỗi (lượt đọc, phe) gửi số ô AI chép/phải sửa/không rõ, cộng dồn theo ngày UTC ở bảng `scan_stats`.
- **Gửi ảnh tự nguyện** `POST /api/scan-samples` (đăng nhập + đồng ý, 10/ngày): ảnh + chữ AI đọc + đội đã xác nhận vào R2/`scan_samples` chờ duyệt. Tab **Soi đội** ở `/quan-tri/`: tỷ lệ ô sửa/không rõ theo màn hình × phe (7/30/90 ngày), duyệt/từ chối mẫu (từ chối xoá ảnh), "Tải fixture" cho bộ ảnh chuẩn.
- **Bộ ảnh chuẩn** `worker/eval/` (5 ảnh đã che tên: 4 chiến báo phồn thể/giản thể/tiếng Việt, 1 màn chi tiết đội) + `npm run eval:vision` chấm theo ID canonical qua `draftFromRead`, in độ chính xác theo màn hình × trường và p50/p95, có `--effort`, `--save/--from`.
- Bản dịch: thêm 17 obligation `authored-vi` cho chữ mới của `js/analyze.js` (`ui:analyze/side-*`, `sample-*`, `slow-read`, `disclaimer`), không đổi obligation `translate`; `PrivacyPage.astro` không nằm trong `sourceFiles`/obligation nên đoạn mới không cần khai thêm; policy `site-vi-260929-soi-doi-hai-phe` (re-pin hash `js/analyze.js`, `js/analyze-map.js`), publish generation `5f23f4df…` (thay `e5a3b519…`, đã prune), re-pin `pipeline/team-route-handles.json`, sinh lại `WORKFLOW_BUILD_ID` MCP (`findSimilarTeams` trong `js/analyze-map.js`).

### Tests

- `worker`: `schema.test.ts` (dạng mới/cũ, screen, side, trần), `model.test.ts`, `index.test.ts` (2 phe), `eval-score.test.ts`. `tests-js`: `normalizeTeamRead`, `readStats`, `validateWorkerResult` hai phe. `community-worker`: `scan.test.ts` (validate, rate, 503 thiếu `IP_HASH_SECRET`, quyền admin, duyệt/từ chối xoá R2, fixture).

### Deploy

- `community-worker`: `npm run db:migrate:remote` (0005) rồi deploy. Pages deploy **trước** `worker/` (frontend mới đọc được cả dạng cũ); sau khi Worker mới chạy, gỡ nhánh dạng cũ `{heroes}` trong `normalizeTeamRead` (`js/analyze-map.js`). Nhánh `{heroes}` của `validateResult` (`worker/src/schema.ts`) ở lại: nó chịu output model, không phải tương thích deploy.

## 2026-09-29 (Cấu hình AI theo tính năng: model, effort, timeout riêng; nhà cung cấp dùng chung)

### Changed

- **Bản ghi `ai:config` thay `ai:providers`** (`shared/ai-config.ts`, mã hoá như cũ): `providers` giữ endpoint + API key dùng chung, không còn `modelId`; mỗi nhà cung cấp có `preset` (catalog tĩnh `shared/ai-models.ts`: DeepSeek `deepseek-flash`, `deepseek-v4-pro`; OpenCode Zen `deepseek-v4.1-flash`, `deepseek-v4-flash-vision-exp`, `deepseek-v4-flash`, `deepseek-v4-pro`) và `extraModels` admin tự thêm (`vision`, `effortStyle`, `efforts`). `groups` có bốn nhóm — Soi đội (`teamScan`), Gợi ý đội (`rosterRecommend`: ba mode scan), Giải thích món bù (`explainSubstitute`), Chiến báo (`battleReport`) — mỗi nhóm một chuỗi failover `{providerId, modelId, effort}`, timeout mỗi lượt (5–120 s) và trần tổng (≤ 180 s). Nhóm rỗng trả chưa cấu hình, không kế thừa.
- **Effort theo mắt xích:** bỏ `thinking: {type: "disabled"}` cứng ở `worker/src/model.ts` và `community-worker/src/analyze.ts`; `callWithFailover` thêm trường suy luận theo `effortStyle` của model (`deepseek`: `thinking` + `reasoning_effort` low/high/max; `openai`: `reasoning_effort`; `none`: không gửi). Mỗi lượt chờ `min(timeout, phần còn lại của trần tổng)`, còn dưới 3 s thì dừng failover. Log `ai_provider_failed` thêm `group`, `effort`.
- **API:** `GET/PUT /api/admin/ai/config` thay `/api/admin/ai/providers`; GET kèm catalog mẫu, mức effort theo kiểu và nhóm cần ảnh. PUT validate mẫu/endpoint, model tự thêm (`duplicate_model`, `invalid_effort_style`, `invalid_efforts`), chuỗi (`unknown_provider`, `unknown_model`, `invalid_effort`, `model_not_vision`) và thời gian nguyên giây (`invalid_timeout`, `invalid_budget`). Key để trống chỉ được giữ khi cùng `id` và cùng `endpoint` (trước đây giữ theo `id` kể cả khi đổi endpoint).
- **Tab AI** (`js/community-admin.js`): phần Nhà cung cấp (mẫu, model sẵn có, model tự thêm kèm kiểu tham số và mức effort) và phần Tính năng (mỗi nhóm: mắt xích chọn nhà cung cấp → model → effort, ↑↓/Bỏ, timeout, trần tổng, "Áp cho mọi nhóm", nhãn Chạy được/Chưa cấu hình). Nhóm đọc ảnh chỉ liệt kê model nhận ảnh; xoá nhà cung cấp/model thì bỏ mắt xích trỏ tới nó; Lưu chặn timeout/trần tổng sai.
- **Chuyển dữ liệu:** khi chưa có `ai:config`, cả hai Worker đọc `ai:providers` và chuyển trong bộ nhớ (cả bốn nhóm cùng chuỗi theo thứ tự cũ, effort tắt, 45 s/lượt, trần tổng 45 s × số mục bật) nên hành vi gọi không đổi cho tới khi admin bấm Lưu. `scripts/scan-ai-models.mjs` so `/models` của mẫu với catalog.

### Tests

- `community-worker`: `ai-config.test.ts` (round-trip, chuyển v1 giữ nguyên thứ tự/key/body, phân giải chuỗi, effort → body, failover, trần tổng), `ai-admin.test.ts` (quyền, không lộ key, giữ key cũ, validate nhà cung cấp và nhóm, chuỗi chiến báo dùng đúng effort), `reports.test.ts` (chuỗi chiến báo rỗng → 503). `worker`: `index.test.ts` (mode → nhóm, nhóm rỗng → 503, effort từng mắt xích), `model.test.ts`. E2E `community.spec.mjs`: cấu hình tab AI end-to-end.

### Deploy

- Deploy `community-worker/` và `worker/` (giữa hai Worker thứ tự tuỳ ý) **trước** Pages vì tab AI mới gọi `/api/admin/ai/config` → tab **AI** → **Lưu** → xác nhận `ai:config` trong KV → gỡ đường đọc `ai:providers` (`LEGACY_PROVIDERS_KEY`, `migrateLegacy`), deploy lại, xoá khoá cũ (`docs/community-worker.md`).

## 2026-09-29 (Gợi ý đội từ kho theo mùa, mục Thiếu món, "Vì sao?")

### Changed

- `/goi-y-doi-tu-kho/` gợi ý từ **Đội chuẩn của mùa đang chọn** thay cho đội cũ: ô "Mùa bạn đang chơi" (một ô, không có Phiên bản luật), mặc định `defaultSourceSeasonId`, ghi `?season=` (thêm vào `SECTION_QUERY_KEYS` của trang) và nhớ trong kho đã lưu. `js/roster-season-candidates.js` dựng ứng viên từ `index.json` của generation đang pin: tên gốc chữ Hán → tên Việt của từ điển Tra cứu (98,6% cấu hình Giao chiến ánh xạ được; cấu hình có tướng không nhận diện bị loại), chỉ cấu hình Giao chiến, ô chiến pháp trống/`bond`/không nhận diện không tính là thiếu.
- Mùa thiếu đội thì **đội cũ `teams.json` lấp chỗ trống**, gắn nhãn "Tham khảo – đội cũ", luôn xếp sau đội của mùa, không dùng lại tướng/chiến pháp đã chọn và bỏ đội cũ trùng bộ tướng đội mùa. Engine nhận thêm `seedEntries` (đội đã chọn ở lượt trước) và trả `missingTacticSlots` (tướng giữ ô, vị trí ô) cho đội thiếu chiến pháp.
- Mục **"Thiếu món"** thay "Đội mạnh nhưng chưa thể xây dựng", đội thiếu ít món nhất đứng trước: thiếu tướng → "Tôi có tướng này"; thiếu chiến pháp → "Tôi có chiến pháp này" + món bù (chiến pháp tướng đó mang ở cấu hình khác cùng mùa, có trong kho, chưa bị đội khác hay ô khác của cùng đội dùng) kèm số cấu hình; "Dùng món này" lưu vào kho (`tacticOverrides`, tối đa 20, quá trần bỏ lựa chọn cũ nhất) và đội vào danh sách với dòng "Đã thay: A → B", "Bỏ món thay" để gỡ (kể cả khi đội vẫn chưa vào danh sách). Các thao tác này giữ trạng thái đã xác nhận, gợi ý lại ngay và đưa focus về đầu mục; "Xóa toàn bộ kho" giữ mùa đang chọn.
- Nút **"Vì sao?"** (chỉ gọi khi bấm, cache theo cặp món + tướng + ngôn ngữ): Worker mode mới `explainSubstitute` chỉ văn bản (không ảnh; vẫn qua rate-limit + Turnstile), prompt chỉ giải thích, cấm nêu chiến pháp/tướng khác; frontend `callWorkerExplain` và bỏ lời giải thích nhắc tới chiến pháp ngoài hai món được hỏi. Bốn mode đọc ảnh không đổi.
- `seasonOptionText`/`seasonOptionTitle` tách khỏi closure của `createRecommendedSection` để ô mùa của Đội chuẩn và công cụ dùng chung nhãn.
- Bản dịch: bỏ 2 obligation `translate` không còn nguồn (`ui:roster/blocked-team`, `ui:roster/local-engine-note`, cùng ledger entry và receipt), bỏ `result-missing-heroes`/`-tactics`, sửa `ui:roster/lead`/`result-variants`, thêm 28 obligation `authored-vi` cho chữ mới; policy `site-vi-260929-goi-y-doi-theo-mua`, publish generation `aff82729…`, re-pin `pipeline/team-route-handles.json`, sinh lại `WORKFLOW_BUILD_ID` MCP.

### Tests

- Node: adapter mùa (tên gốc/alias, lọc mùa + Giao chiến, ô có điều kiện, thống kê chiến pháp theo tướng, ≥98% cấu hình của generation đang pin ánh xạ được), `recommendRoster` (đội cũ chỉ lấp chỗ trống và xếp sau, bỏ đội cũ trùng bộ tướng, món bù đã chọn thành biến thể, ghi đè không còn ô bị bỏ qua), `suggestTacticSubstitutes`, engine `seedEntries` + `missingTacticSlots`, state `tacticOverrides`/`seasonId`, `safeReturnUrl` giữ `season` ở Gợi ý đội. Worker: schema/model/index cho `explainSubstitute`. E2E: `beta-tools`, `season-lookup` theo hành vi mới.

## 2026-09-29 (Theo dõi chiêu mộ: thiết kế lại, store v2, đồng bộ tuỳ chọn)

### Changed

- **Store schema v2** (`js/recruit-tracker-store.js`): một luồng bản ghi (tài khoản, gói, lượt) làm nguồn sự thật; mỗi bản ghi có `id`, `updatedAt`, `deletedAt`. Bảo hiểm, "Hôm nay x/4", số lượt tới 5★ và thống kê tính lại từ lượt sắp theo `occurredAt` (trước đây cộng theo thứ tự mảng, lưu song song `dailyStates`). Dữ liệu v1 tự chuyển khi đọc: giữ nguyên bảo hiểm và số lượt tới 5★ đã lưu, bỏ `dailyStates`. Thay đổi tại chỗ được đóng dấu lớn hơn mọi `updatedAt` kho đã thấy (Lamport) để gộp đúng khi đồng hồ máy lệch.
- **Trang `/theo-doi-chieu-mo/` làm lại** (`js/recruit-tracker.js`, CSS `.rt-*`, artboard `Recruit`/`RecruitMobile`): ghi lượt ngày một chạm "2 miễn phí" / "Đủ 4" (kẹp theo lượt rẻ còn lại) và "Có 5★" (lượt trúng trong ngày, lượt quay tiếp, tướng, phân loại); toast Hoàn tác cho mọi thao tác ghi/xóa; nhật ký sửa/xóa từng dòng; màn khởi đầu "Trong game bạn đang ở lượt mấy?" và "Chỉnh số" bất cứ lúc nào (dòng "Đồng bộ N lượt"); gói hạn giờ đổi tên, ngày hết hạn + đếm ngược, lưu trữ, xóa; thống kê TB lượt/5★, tổng 5★, chuỗi ngày. Mọi `prompt()`/`confirm()` thay bằng `<dialog>`. Nhập JSON gộp vào dữ liệu hiện có thay vì ghi đè.
- **Đồng bộ cloud tuỳ chọn:** khách vẫn chỉ dùng `localStorage` (không gọi `/api/*` khi chưa từng đăng nhập); đăng nhập Google thì `js/recruit-sync.js` kéo theo con trỏ `rev` rồi đẩy bản ghi mới (debounce 1,5 s), gộp "bản sửa sau cùng thắng" theo bản ghi; sau Nhập JSON đẩy lại toàn bộ. Chip ☁ cạnh ô tài khoản; lời mời đăng nhập một lần sau lượt 5★ đầu tiên. `community-worker`: bảng D1 `recruit_records` (migration `0004_recruit.sql`), `GET/POST /api/recruit`, rate limit `recruit_push` 600 lô/giờ, trần 20000 bản ghi/user (413 `recruit_quota_exceeded`).
- Trang Quyền riêng tư (vi/zh) nêu nhật ký chiêu mộ được đồng bộ lên D1 khi người dùng đăng nhập.
- Bản dịch: re-pin hash `js/recruit-tracker.js`, `js/recruit-tracker-store.js` (không đổi obligation); policy `site-vi-260929-theo-doi-chieu-mo-v2`, publish generation `f85b83dd…`, re-pin `pipeline/team-route-handles.json`. `js/recruit-sync.js` thêm vào manifest artifact công khai.

### Tests

- Node: store v2 (nút nhanh kẹp lượt, 5★ trong ngày, đồng bộ số lượt, sửa/xóa/khôi phục, hoàn tác, gói hạn giờ, thống kê, chuyển v1→v2 theo fixture sinh từ store v1, gộp hai máy offline, LWW, máy mới không đè tên đã đổi, đồng hồ lệch), sync client (khách không gọi API, lần đầu kéo rồi đẩy, debounce, phân trang, offline/online, đổi user, 401, đẩy toàn bộ sau nhập, đăng nhập lỗi giữ trạng thái khách), view model UI. `community-worker`: `recruit.test.ts` (auth, LWW, rev, phân trang, cô lập user, validate, trần, CSRF, rate limit). E2E: `beta-tools` (Đủ 4 một chạm + Hoàn tác, không mở hộp thoại native), `spa-parity` (dữ liệu v1 cũ qua cầu chuyển domain).

### Deploy

- Áp migration trước khi deploy Worker: `cd community-worker && npm run db:migrate:remote && npm run deploy`, rồi deploy Pages.

## 2026-09-29 (Đọc ảnh: nhà cung cấp AI quản lý ở /quan-tri/, làm lại Soi đội từ ảnh)

### Changed

- **Nhà cung cấp AI thay Qwen DashScope.** Cả `worker/` (Soi đội, Gợi ý đội — bốn `mode`) và `community-worker/` (đọc ảnh chiến báo) đọc một danh sách ưu tiên chung `ai:providers` (mỗi mục: nhãn, endpoint Chat Completions OpenAI-compatible, model id, key, bật/tắt) lưu mã hoá AES-GCM trong KV `RL` (id `6fff7d73…`, `community-worker` bind thành `AI_KV`), khoá dẫn xuất HKDF từ secret mới `AI_CONFIG_SECRET` (cùng giá trị cho cả hai Worker). Code dùng chung một bản ở `shared/ai-config.ts`.
- **Failover:** thử mục đang bật theo thứ tự; 401/402/403/429/5xx/lỗi mạng/timeout 45s → mục kế tiếp; 2xx dừng (nội dung không đọc được → 422, không thử tiếp). Danh sách rỗng/giải mã lỗi → 503 "chưa cấu hình".
- Request tới model tắt thinking (`thinking: {type: "disabled"}`): DeepSeek V4.1 bật thinking mặc định nên lượt đọc ảnh quá timeout 45s. Mỗi lần một nhà cung cấp lỗi, Worker ghi log `ai_provider_failed` (nhãn, host, model, mã HTTP, 300 ký tự đầu thông báo lỗi; không ghi key); model trả rỗng ghi `ai_empty_content`. Xem bằng `npx wrangler tail`.
- **Soi ảnh chiến báo:** prompt chép MỌI dòng chiến pháp dưới mỗi tướng theo thứ tự (≤3, kể cả dòng tự mang; dòng `兵` là chiến pháp), `booksCn = []` khi ảnh không in binh thư, bỏ qua ô tướng trống, chỉ chép phe 我方. Site bỏ dòng tự mang bằng `selfTacticCn` của từ điển tướng (tướng chưa rõ mà đủ 3 dòng thì bỏ dòng đầu); chữ AI xếp vào binh thư mà là tên chiến pháp được trả về hàng chiến pháp. Trước đây chiến pháp tự mang chiếm ô A và chiến pháp thứ ba bị hiện thành binh thư.
- **Tab AI trong `/quan-tri/`** (`js/community-admin.js`, `GET/PUT /api/admin/ai/providers` qua `requireAdmin`): thêm/sửa/xoá/bật tắt/↑↓, mẫu endpoint DeepSeek (`deepseek-flash`) và OpenCode Zen (`deepseek-v4.1-flash`) hoặc Tùy chỉnh; key chỉ ghi, GET chỉ trả `keyLast4`; để trống key khi sửa = giữ key cũ. Worker đọc với `cacheTtl` 60s.
- Bỏ hẳn `QWEN_API_KEY`/`DEEPSEEK_API_KEY`, `REGION`, `MODEL_ID`, `MODEL_ENDPOINT` và endpoint DashScope. Thứ tự deploy: đặt `AI_CONFIG_SECRET` cho cả hai Worker → deploy `community-worker` → nhập provider ở tab AI → deploy `worker/` → xoá secret cũ (`docs/community-worker.md`).
- **Soi đội từ ảnh làm lại:** prompt chỉ chép chữ in trong ảnh (bỏ nhận diện chân dung, bỏ `HERO_NAMES_CN`/`nameFromPortrait`, chiến pháp theo ô A/B, không đọc được → `未知`); mỗi ô khớp từ điển ra 3 trạng thái (khớp chắc/Không chắc kèm ≤3 ứng viên/Không rõ); editor xác nhận 3 tướng × (2 chiến pháp + binh thư) bằng `input` + `datalist`, nút **Nhập tay** không gọi Worker; Đối chiếu khoá tới khi hết ô chưa chắc.
- Đối chiếu với **Đội chuẩn** theo ô chọn mùa (`?season=`, mặc định mùa mới nhất) và **Đội khác · tham khảo**, diff từng ô (tướng thiếu/thừa, chiến pháp đúng/sai/thiếu tính cả `alternatives`, binh thư lệch). Trang không còn tải `data/teams.json`.
- Link chia sẻ `?doi=v1.…` (chỉ ID canonical, mở không gọi Worker), lịch sử trên máy `tqccl.analyze.history.v1` (≤10 mục, không ảnh), xuất PNG vẽ bằng canvas (chỉ chữ). Code mới `js/analyze-state.js`.
- Disclaimer Soi đội và trang Quyền riêng tư (vi/zh) nêu ảnh gửi tới nhà cung cấp AI của site (DeepSeek hoặc OpenCode Zen).
- Bản dịch: re-pin hash `js/analyze.js`, `js/analyze-map.js`, `js/app.js`, `js/team-detail-navigation.js`, `worker/src/schema.ts`; đổi chữ các obligation `ui:analyze/*` (`authored-vi`); tiêu đề thẻ 3 giữ "3 · Đội có sẵn tương tự" (khớp bản dịch đã duyệt `ui:analyze/similar-team`); baseline digest mới; publish generation `3f6b33cf…`, re-pin `pipeline/team-route-handles.json`.

### Tests

- `community-worker`: `ai-config` (mã hoá round-trip, sai secret, failover thứ tự/bỏ mục tắt/không chuyển ở 2xx), `ai-admin` (403 non-admin, GET không lộ key, PUT giữ key cũ, mục mới thiếu key → 400), chiến báo thiếu cấu hình → 503. `worker/`: prompt không còn chân dung/danh sách tên, schema ô A/B, thiếu cấu hình → 503.
- Node: `analyze-map` (3 trạng thái, diff), `analyze-state` (codec `?doi=`, lịch sử ≤10). E2E: `beta-tools` (ảnh → editor → đối chiếu, Nhập tay không gọi Worker, `?doi=` không gọi Worker, bản zh), `community` (tab AI).

## 2026-09-29 (Khai hoang: Chạm Sứ và quân thủ mỏ về trang danh sách)

### Changed

- **Đội Chạm Sứ / Ăn vạ** và **Quân thủ các mỏ** là dữ liệu chung của cả mục (`chamSuTeams`, `mines` top-level trong `data/khaihoang.json`) nên chuyển từ 17 trang chi tiết `/khai-hoang/<handle>/` về `/khai-hoang/`, nằm sau lưới đội. Bộ lọc loại binh chỉ lọc thẻ đội, không ảnh hưởng hai khối này.
- `/khai-hoang/` có nút nhảy trong trang dưới đầu mục: `Đội đề xuất 17 · Chạm Sứ / Ăn vạ 8 · Quân thủ mỏ 5` (`#de-xuat`, `#cham-su`, `#mo`); khối rỗng thì bỏ luôn nút nhảy. Mở thẳng `/khai-hoang/#mo` cuộn tới khối sau khi danh sách dựng xong (`js/app.js`).
- Trang chi tiết chỉ còn đội hình + ghi chú, Điểm đánh giá, Hướng dẫn khai hoang; `khaihoangReference` không còn export, `js/khaihoang-detail.js` bỏ phần tham khảo chung. Câu dẫn danh sách (vi/zh) bỏ "đội chạm sứ và quân thủ các mỏ" khỏi phần phải mở Chi tiết.
- `tokens.json`: probe `luoi-cham-su` đo trên `/khai-hoang/`, ghi chú `the-khai-hoang` theo bố cục mới.
- Bản dịch: thêm `ui:khaihoang/jump-aria`, `jump-teams`, `jump-chamsu`, `jump-mines`, đổi chữ `ui:khaihoang/lead` (`authored-vi`); policy `site-vi-260929-khai-hoang-tham-khao`, baseline 56593 location, publish generation `f71e22b6…` (xoá generation `afc632de…`), re-pin `pipeline/team-route-handles.json`.

### Tests

- E2E `khaihoang-options.spec.mjs`: danh sách có hai khối sau lưới đội, nút nhảy đúng thứ tự/href/số đếm và cuộn tới khối, bộ lọc loại binh không ẩn Chạm Sứ/mỏ, deep link `#mo`; ca Chạm Sứ (1280/375px, thiếu/rỗng) và bảng/thẻ mỏ chuyển sang trang danh sách; trang chi tiết không còn `.cham-su-card`/`.kh-mines`. Bỏ helper `routeDetailSource` không còn dùng.

## 2026-09-29 (Tra cứu: lưới Tướng theo artboard Lookup)

### Changed

- Trang `/tra-cuu/tuong/` (và `/zh/`): lưới 5 cột cách 20px (≤1023px 4 cột, ≤820px 3 cột, ≤680px 2 cột cách 12px), thẻ bo 14px; chân dung vuông phủ kín bề ngang thay ô cao 132px, vạch màu phe 3px dưới ảnh (ô dự phòng chữ Hán mang màu phe trên nền giấy đậm); tên serif 18px (mobile 16px); dòng phụ "■ Phe · N sao · Thống ngự N" (mobile bỏ số sao), vai trò dòng riêng. Thẻ không còn nhãn biến thể nổi trên ảnh (SP/CO/40Y đã có trong tên và ảnh). Nhóm catalog giữ lưới thẻ chung.
- Dòng trạng thái Tướng thêm "· ảnh chân dung từ nguồn game"; mọi trang nhóm có ghi chú "Thứ tự theo nguồn" bên phải (ẩn trên mobile và khi bản zh xếp lại kết quả tìm theo tên chữ Hán) — `lookupOrderNote` trong `js/unified-lookup.js`.
- Token chữ mới `--type-lookup-card-name`/`--type-lookup-card-name-mobile` (`tokens.json` → `type`).
- Bản dịch: re-pin hash 4 nguồn Tra cứu trong policy, publish generation `afc632de…`, re-pin `pipeline/team-route-handles.json`.

## 2026-09-29 (Tra cứu: hồ sơ chiến pháp theo artboard LookupTacticProfile)

### Added

- Hồ sơ chiến pháp dựng lại (`js/lookup-tactic-profile.js`, view thuần `js/lookup-tactic-view.js`): huy hiệu phẩm/loại/binh chủng/dạng hiệu ứng; 4 ô Tỷ lệ kích hoạt · Mục tiêu · Người mang tối đa · Xung đột; khung Hiệu ứng có nút chọn phiên bản (`aria-pressed`, bản hiện hành chọn sẵn) và số cấp 1 → cấp tối đa in đậm; cột Cách nhận gồm thẻ tướng truyền thừa/tự mang, cách nhận khác (sự kiện…) và bảng Nguồn/Dạng hiệu ứng/Hợp binh chủng/Hồi chiêu/Điểm/Điều kiện đổi.
- Khối "Trong cẩm nang" cho chiến pháp: artifact build `tactic-summaries.json` trong generation Recommended (`pipeline/tactic_summaries.py`; nối chữ Hán `tacticSlotsRaw` ↔ `chinese|aliases` cho Đội chuẩn, tên Việt ↔ `viet|hanViet` cho Đội khác; 133 ô Đội chuẩn không khớp, 0 mơ hồ). Hiện số đội chuẩn/khác, vị trí, tướng hay mang, chiến pháp hay đi cùng trong đội, 3 đội tiêu biểu và link tìm trong Đội chuẩn. Loader `js/tactic-summaries.js` kiểm provenance theo hash `data/tactics.json` + `data/heroes-dict.json`.

### Changed

- `build_generation`/`build_recommended_reference` bắt buộc `tactic_catalog_bytes`/`--tactic-catalog`; descriptor thêm `tacticSummaryCatalogHash`; kho artifact (`team_route_handles.py`, `recommended-reference-artifacts.ts`) bắt buộc `tactic-summaries.json`.
- Bản dịch: policy `site-vi-260929-lookup-tactic-profile` (thêm 3 module mới vào nguồn Tra cứu, baseline không đổi), publish generation `5d60cb1e…` (xoá generation trung gian `033859e5…`), re-pin `pipeline/team-route-handles.json`.

### Tests

- Python `tests/test_tactic_summaries.py` (đếm, quy tắc nối, cổng cấu trúc, generation đang pin khớp phép dựng lại); node `tests-js/lookup-tactic-view.test.mjs`; fixture generation trong test thêm `tactic-summaries.json`. E2E: hồ sơ chiến pháp dùng lớp mới, thêm ca chọn phiên bản + khớp số liệu build; ca Cách nhận ghim chiến pháp tự mang vẫn hiện tên sự kiện.

## 2026-09-29 (Tra cứu: hộp thoại hồ sơ gọn lại)

### Changed

- Hồ sơ Chiến pháp, Trang bị, Quân sư, Cải tạo binh chủng, Công trình, Binh thư: bỏ bảng nhãn/giá trị một cột (chữ dài đậm dồn trong cột hẹp, bên phải trống). Nay là một cột đọc từ trên xuống: đoạn đầu (thường là Hiệu ứng) nằm trong khung nổi, các đoạn Cách dùng/Mô tả/Gợi ý/Tóm tắt chữ thường; bảng thông số hai cột hàng nhãn mờ/giá trị ngăn vạch mảnh (giá trị dài chiếm cả hai cột, giá trị trống chữ mờ; ≤ 820px một cột, mobile nhãn 120px cùng hàng giá trị); quan hệ/mục con dạng nút.
- Hiệu ứng nhiều phiên bản (`effectVersions` trong `js/lookup-detail.js`, đọc cả dạng " / ", " / / ", dòng trống và nhãn chữ Hán `更新`/`原始版本` của bản zh): phiên bản hiện hành mở sẵn kèm nhãn ngày, bản cũ gập trong `<details>`; khối "Lịch sử cập nhật" không lặp lại khi đã tách được phiên bản. Thẻ chiến pháp trong hồ sơ tướng chỉ hiện phiên bản hiện hành.
- Cấp công trình thành danh sách (nhãn cấp, hiệu ứng, dòng phụ chi phí · thời gian); lựa chọn cải tạo binh chủng gom theo bậc (Đặc biệt, Cơ bản, Trung cấp, Cao cấp), mỗi dòng tên + mô tả. Eyebrow hồ sơ không còn chuỗi "Áp dụng" dài (đã có ở bảng thông số).

### Removed

- Khối "Nội chính" của hồ sơ tướng (section `civil`, 4 nhãn, CSS `.lookup-civil*`): 201/202 tướng chỉ hiện "Đang cập nhật". Trường `lookup.civil` vẫn nằm trong payload; `Điểm nội chính` ở đầu hồ sơ giữ nguyên.
- Bản dịch: bỏ 4 obligation `ui:lookup/civil-*`, thêm `ui:lookup/option-converts` (`authored-vi`); policy `site-vi-260929-lookup-profile-layout`, baseline 56589 location, publish generation `a4501b27…` (xoá generation trung gian `a135afa3…`), re-pin `pipeline/team-route-handles.json`.

### Tests

- Node: `effectVersions` tách đúng các dạng nguồn và giữ nguyên " / " nghĩa "hoặc" ở chữ thường; bỏ test ghim khối Nội chính. E2E: dòng cấp công trình dùng `.lookup-level`.

## 2026-09-28 (Tra cứu: mỗi nhóm một trang)

### Changed

- Tra cứu tách thành 7 trang nhóm `/tra-cuu/tuong/`, `/chien-phap/`, `/trang-bi/`, `/quan-su/`, `/cai-tao-binh-chung/`, `/cong-trinh/`, `/binh-thu/` (và `/zh/…`), mỗi trang có title, mô tả, canonical, H1 và mục menu/footer `aria-current` riêng; search chạy trong nhóm. Hồ sơ là `/tra-cuu/<slug>/?id=<id>`; mã của nhóm khác được chuyển sang đúng trang.
- Thanh chuyển nhóm vẽ lại: luôn một hàng ở mọi bề rộng (trước đây xuống 2 dòng ở 768–1024px và 4 dòng ở mobile). Desktop/tablet là thanh phân đoạn, mục đang xem nổi lên như thẻ, số đếm thành viên nhỏ (son ở mục đang xem); mobile là hàng viên cuộn ngang tràn mép màn hình. Nhóm đang xem được cuộn vào giữa trước lần vẽ đầu, mép còn mục khuất mờ dần.
- Hiệu năng: lúc vào trang chỉ tải `lookup-manifest` + payload của nhóm (Tướng `heroes-dict`, Chiến pháp `tactics`, 4 nhóm catalog `lookup-catalog`, Binh thư chỉ `books-dict`), cả bản zh (bộ tra tên Hán tải khi mở hồ sơ tướng). Payload hồ sơ cần thêm tải lười ở lần mở hồ sơ đầu tiên và được tải trước khi rê/focus vào thẻ. `js/lookup-data.js` thêm `validateLookupPayload`/`createLookupPayloadLoader` (digest theo manifest đã pin + `generationId`); tham chiếu chéo được kiểm trọn bộ lúc build (`src/lib/lookup-pages.ts`) và trong `scripts/verify-astro-dist.mjs`.
- Trang đầu 60 mục dựng lúc build từ cùng cây markup với trình duyệt (`js/view-tree.js`; thẻ/hàng bảng/chân dung trong `js/unified-lookup.js`, `js/hero-portrait.js`); thẻ và tên chiến pháp là link hồ sơ thật nên bấm trước khi app chạy (hoặc không có JS) vẫn tới đúng hồ sơ. Hàm hiển thị nhận `locale` tường minh; hàng bảng chiến pháp tính thẳng từ bản ghi.
- Mã UI tách: `js/lookup-page.js` (khung trang, tìm, Xem thêm, hồ sơ, lịch sử), `js/lookup-profile.js` (hộp thoại theo nhóm); `initUnifiedLookup`, `formatLookupQuery` và chế độ "tất cả nhóm" bị bỏ.
- `/tra-cuu/` thành mục lục tĩnh 7 thẻ (nhãn, mô tả, số đếm lúc build), không nạp app; script inline chuyển tiếp link cũ `?group=&id=`/`?id=`. Hash cũ ở Landing vẫn tới `/tra-cuu/?…` rồi được mục lục chuyển tiếp. Link hồ sơ từ trang chi tiết đội, `safeReturnUrl` và sitemap (thêm 14 URL) theo route mới; trang Tra cứu không còn khối noscript "cần JavaScript".
- Bản dịch: rebind obligation `ui:lookup/*`, `ui:layout/lookup-desc-*`, `ui:section-page/tra-cuu` theo file mới, thêm `ui:lookup-page/*` và `ui:lookup/profile-loading`, bỏ `ui:lookup/unit-result` (`authored-vi`); policy `site-vi-260928-lookup-group-pages`, baseline 56592 location, publish generation `b840489e…`, re-pin `pipeline/team-route-handles.json`. MCP: `lookup-data.js` đổi nên `WORKFLOW_BUILD_ID` sinh lại.

### Tests

- Node: payload đơn (`lookup-data`), hàng bảng khớp hồ sơ cho mọi chiến pháp đã công bố ở cả hai ngôn ngữ, cây markup dựng lúc build khớp bản dựng trên trang, `view-tree` HTML/DOM cùng cấu trúc và luôn escape, `lookup-ids` (`groupForId`, `lookupProfilePath`, `lookupHubTarget`), fixture dist có mục lục + 14 trang nhóm và bundle hợp lệ.
- E2E: request `/data/` đúng theo từng trang nhóm (vi + zh), mục lục không tải dữ liệu, tải lười khi mở hồ sơ, 60 mục dựng sẵn, chuyển tiếp link cũ, link hồ sơ dùng được khi app chưa chạy; spec cũ chuyển sang route mới, bỏ test ghim chế độ tất cả nhóm và chip `aria-pressed`.

## 2026-09-28 (Thư báo góp ý)

### Fixed

- Thư báo góp ý không tới Gmail: Email Routing chưa bật cho `tqccl.com` nên `FEEDBACK_MAIL.send` lỗi (góp ý vẫn lưu D1). Bật Email Routing cho subdomain `mail.tqccl.com` (MX/SPF riêng, MX apex vẫn là forwarding Porkbun) và đổi `FEEDBACK_FROM` thành `gopy@mail.tqccl.com`; [community-worker.md](./community-worker.md) mô tả cách bật subdomain thay cho bật apex.

### Changed

- CI: `actions/checkout`, `setup-node`, `setup-python`, `upload-artifact` lên `@v7` (chạy Node 24; bản `@v4`/`@v5` chạy Node 20 đã deprecated) trong cả ba workflow. Runner ghim `ubuntu-24.04` thay `ubuntu-latest`, để đợt chuyển `ubuntu-latest` sang Ubuntu 26 (từ 2026-10-19) không đổi môi trường build/E2E; nâng Ubuntu là thay đổi chủ động sau này.

## 2026-09-28 (Theme tối rõ lớp, nút đổi giao diện theo chế độ)

### Changed

- Nút đổi giao diện (header + menu mobile, `src/components/ThemeToggle.astro`): theme sáng hiện mặt trăng, theme tối hiện mặt trời (CSS chọn theo `html[data-theme]`, đúng ngay lần vẽ đầu). Tên truy cập + tooltip nói hành động: "Chuyển sang giao diện tối/sáng" (zh "切换到深色模式/切换到浅色模式"); bỏ tên cố định "Giao diện tối" và `aria-pressed`.
- Theme tối giữ tông mực/son ấm nhưng tách lớp: nền `#16140F` → `#0F0E0C`, thẻ `#201D18` → `#28251F` (1,10 → 1,26:1), viền `#3A352D` → `#524B41` (1,51 → 2,24:1), thẻ đậm/hover `#34302A`, chữ phụ/mờ sáng hơn, son `#F07A80` + son nhạt `#512328` + chữ pill `#FFA3A8` (pill nổi hơn, chữ son trên son nhạt 4,81:1 — trước 4,46:1), vòng focus `#F2868B`. Header và footer tối dùng tông dải `#1A1814` cộng vạch mép `--line` (token `--shadow-header-edge`/`--shadow-footer-edge`, inset nên không đổi bố cục); footer trước đây `#141210` dùng chung hai theme chỉ 1,02:1 với nền tối. `--f-honhop` tối `#A884E0` → `#AE8BE3` để chữ phe trên thẻ đậm giữ 4,74:1. Theme sáng không đổi.
- `tokens.json` có `meta.contrast` (22 cặp ngưỡng theme tối); `node scripts/design-tokens.mjs --check` báo cặp dưới ngưỡng hoặc không giải được.
- Bản dịch: thay `ui:layout/theme-toggle` bằng `ui:layout/theme-toggle-to-dark`/`-to-light` (`authored-vi`); policy `site-vi-260928-theme-toggle`, baseline 56589 location, publish generation `6ded1637…`, re-pin `pipeline/team-route-handles.json`.

### Tests

- `tests-js/design-tokens.test.mjs`: bộ kiểm tương phản báo cặp dưới ngưỡng/tên token sai, và token đang commit đạt mọi ngưỡng.
- E2E: nút đổi giao diện (vi/zh) đổi icon + tên theo theme và giữ sau tải lại; icon đúng khi JS trang bị chặn; theme tối đo thẻ/sidebar/viền/mép header/footer trên DOM thật, theme sáng không có mép. Bỏ test ghim tên "Giao diện tối".

## 2026-09-28 (Sửa lỗi responsive)

### Fixed

- Footer 821–1280px: khối thương hiệu (ấn 44px + logo chữ 238px) tràn đè cột "Đội hình" tới 153px. Cột giới thiệu giờ là `minmax(min-content, 2fr)`; 821–1279px giới thiệu chiếm cả hàng, năm cột link xuống dưới.
- Tra cứu › Chiến pháp 681–1023px: năm cột cố định (~816px) vượt khung panel nên cột tên co về 0 và bảng bị cắt. Bảng xếp dọc có nhãn cột (như mobile) tới 1023px; từ 1024px giữ đủ cột theo artboard. Mô tả trong cột tên hẹp xuống dòng (`overflow-wrap: anywhere`) thay vì bị cắt ngang.
- Đội chuẩn/Đội khác 821–900px: lề ngang 16px để cột chuyển nhanh cố định đè nút Bảng, ô mùa và điểm thẻ; nay giữ lề 48px.
- Cột chuyển nhanh cao ~450px bị cắt đầu/cuối ở màn thấp (điện thoại xoay ngang 844×390, cửa sổ thấp): dưới 580px chiều cao dùng nút tròn như mobile; danh sách mở lên không vượt header dính và cuộn khi dài (kể cả 320×568).
- Khai hoang bản zh: ấn "主" của chủ tướng rộng 30px tràn ô 24px; ấn giờ gọn trong ô.
- Landing › Tải game ≤820px: cụm tải chỉ rộng theo nội dung (lưới vẫn `justify-self: start`) nên nút cửa hàng hụt mép phải và QR lệch giữa; cụm giờ trải hết cột, QR canh trái, thẻ bản máy tính thành hàng như nút cửa hàng (mũi tên ở mép phải). ≤680px ẩn QR vì không quét được trên chính điện thoại; tablet vẫn giữ.
- Footer gọn lại: ≤820px năm nhóm link chảy theo hai cột báo (Đội hình + Tra cứu | Công cụ + Cộng đồng + Về cẩm nang) thay vì lưới theo hàng để lại khoảng trống lớn và nhóm "Về cẩm nang" đứng một mình (390px: cao 1674 → 1490px). Dải Game mobile: link nhà phát hành là lưới hai cột điền theo cột (nhãn ngắn một cột, nhãn dài một cột — không nhãn nào gãy dòng ở 320px), vạch ngang tách link cộng đồng cùng kiểu chữ (bỏ viên bo tròn). 821–1279px dải Game: tiêu đề một hàng, link game, link cộng đồng xuống hàng riêng — vạch ngăn không còn rớt đầu hàng.
- Footer mobile (≤820px): dải "Game chính thức" thu gọn mặc định — chỉ còn tiêu đề + phụ đề và nút mũi tên 44px (cả đầu dải là vùng bấm, tên truy cập là tiêu đề dải qua `aria-labelledby`, `aria-expanded`); bấm mở lưới link game + link cộng đồng. `initFooterGameDisclosure` trong `js/site-chrome.js` chỉ bật nút khi JS chạy (không JS: link luôn hiện) và đưa về thu gọn khi qua lại mốc 820px; desktop CSS bỏ qua `hidden` và ẩn nút nên dải vẫn một hàng. Không thêm chữ UI mới: ghim lại hash `src/layouts/SiteLayout.astro`, `js/site-chrome.js` trong policy, publish generation `35657d5d…`, re-pin `pipeline/team-route-handles.json`.

## 2026-09-28 (Cùng Tồn bản zh không còn chữ Việt)

### Fixed

- `/zh/cung-ton/` mở mặc định nhóm của bảng Cùng Tồn gốc (ghi bằng tiếng Việt) nên hiện nguyên tên tướng, chiến pháp, binh thư, ghi chú và gợi ý khai hoang tiếng Việt. `coexistModel` (`js/render.js`) giờ áp cùng quy tắc zh của nhánh legacy cho nhánh bảng gốc: tên tướng/chiến pháp/binh thư tra về chữ Hán (tướng không tra được hiện "—", chiến pháp/binh thư không tra được bị bỏ; tiền tố "Tinh·" thành "精 ·", hậu tố "40th" thành `40Y`), tên đội dựng lại từ tên tướng, nhãn "Cùng tồn N" thành "共存 N"; tóm tắt, ghi chú, gợi ý khai hoang, cải tạo, thuộc tính và ghi chú tướng bị bỏ. Bản vi giữ nguyên.
- Ghim lại hash `js/render.js` trong policy, publish generation `85425612…`, re-pin `pipeline/team-route-handles.json`.

### Tests

- E2E cập nhật theo giao diện mới: header bản vi dùng logo chữ có dòng phụ (không tagline), tagline và phép đo 320px chỉ còn ở bản zh; menu Tra cứu 7 dòng và trang Tra cứu nạp `books-dict.json` (nhóm Binh thư); Landing kiểm thẻ đội ở hero và bảng mẫu khối tier đầu; chi tiết Đội chuẩn kiểm khối Phạm vi (mùa, danh mục) và không lộ mã cấu hình nguồn.

## 2026-09-28 (Gỡ nguồn dữ liệu khỏi dữ liệu công khai)

### Changed

- Builder Recommended chỉ dùng `sourceUrl`, `listUrl`, `orderedDetailUrls`, `missingUrls` để kiểm nội bộ; `index.json`, `details-*.json`, `seasons.json` phát ra không còn các trường này.
- `pipeline.build_season_data` ghi bản chiếu công khai: provenance chỉ còn vùng/ngày; bỏ `provider`, `sourceUrl`, `note` của bằng chứng, `provider` của điểm, `url`/`sheetId`/`gid` của nguồn Cùng Tồn. `js/season-context.js` kiểm theo hình dạng mới (không còn đòi `provider === 'sgsdeck'`).
- `data/team-tier.json` bỏ `source` của từng xếp hạng (map pipeline vẫn giữ); ledger Team khác dựng lại theo tier và `teams.json` mới.
- `data/khaihoang.json` bỏ mọi `sources[]` và tên nguồn trong ghi chú/nhãn; ghi chú 6 đội PK-S26 (`pipeline/team-intro-supplement.json`) bỏ tên site và URL nguồn; `data/tactics-generic.json` bỏ URL đối chiếu.
- Tra cứu: 8 chiến pháp bỏ hậu tố trích dẫn ` (Bahamut bsn=36815)` ngay trong `pipeline/lookup-translations.json`; promote transaction `site-vi-260928-source-strip` (`lookup:356b4a3c…`). Bỏ `acquisitionDisplayText` (ẩn hậu tố lúc hiển thị) khỏi `js/lookup-detail.js`.
- Bản dịch: batch review `site-review-public-source-strip-20260928` thay `site-review-v5-054`, `-061`, `-096`; batch `lookup-public-source-strip-20260928` thay `lookup-final-current-066`, `-071`, `-074`, `-078`, `-080`, `-082`, `-087`; baseline 56588 location, publish generation `83f3a955…`, re-pin `pipeline/team-route-handles.json`.

## 2026-09-28 (Khai hoang gọn: danh sách chỉ đội + phiên bản)

### Changed

- `/khai-hoang/` chỉ còn đầu mục, lọc loại binh (kèm đếm `N / 17 đội`) và lưới thẻ dùng khung thẻ Đội chuẩn: tên đội (link), loại binh, ấn điểm tổng (đội chưa chấm: ấn viền đứt "—"), hàng phiên bản chip gọn 32px (đội không biến thể vẫn có "Mặc định"), dòng tướng `tên | Trước · … → Sau · …` với chip chiến pháp gọn và ấn "C" ở chủ tướng, chân "Chi tiết". Lưới tối đa 2 cột, thẻ cùng hàng cao bằng nhau.
- Trang chi tiết `/khai-hoang/<handle>/` nhận mọi phần còn lại: thẻ tướng như chi tiết Đội chuẩn (vai trò chủ/phó tướng theo chủ tướng trước/sau cấp 20, "Chiến pháp trước"/"Chiến pháp sau" đánh số, đổi loại binh), khối Ghi chú, Điểm đánh giá (thanh 6 mốc), Hướng dẫn khai hoang mở sẵn (không còn mục gập), Đội Chạm Sứ / Ăn vạ và Quân thủ các mỏ.
- `variantNameNodes` (nhãn SP/CO/40Y) chuyển sang `js/render.js`, `js/recommended-reference-render.js` dùng lại.
- Quy ước chủ tướng mọi phiên bản (kể cả Mặc định): tướng đứng đầu là chủ tướng trước cấp 20 (`commanderBefore`, thiếu thì tướng đầu của dữ liệu); chủ tướng sau cấp 20 là `commanderAfter`, thiếu thì vẫn là tướng đầu. Ấn "C" của chủ tướng trước cấp 20 luôn đứng sau tên; đổi chủ tướng thì chủ tướng sau cấp 20 có thêm ấn trước nhãn "Sau" (các dòng giữ chỗ ấn để nhãn "Sau" thẳng cột), ở trang chi tiết là nhãn "Chiến pháp sau". `data/khaihoang.json` bổ sung chủ tướng cho 3 cấu hình mặc định theo đúng ghi chú đã curate (Pháp Chính sau cấp 20; Gia Cát Khác sau cấp 20 ở đội Khương Duy · Hạ Hầu Uyên · Gia Cát Khác; Gia Cát Khác trước và sau cấp 20 ở đội Gia Cát Khác · Thái Sử Từ · Tả Từ).
- Policy `site-vi-260928-khai-hoang-gon` (thay tuple UI Khai hoang, ghim lại file nguồn, baseline 56664 location), publish generation `a6e3b605…`, re-pin `pipeline/team-route-handles.json`.

### Removed

- Mọi nội dung nguồn ở Khai hoang: khối "Lưu ý nguồn", link nguồn của Chạm Sứ, link nguồn trong panel chi tiết; cùng nút nhảy khối, tiêu đề "Đội khai hoang đề xuất", thanh điểm và ghi chú trên thẻ danh sách.

## 2026-09-28 (Góp ý, sửa lỗi ở footer)

### Added

- Nút **Góp ý, sửa lỗi** ở footer mọi trang (vi/zh) mở hộp thoại gồm Loại (Đề xuất tính năng, Báo cáo lỗi, Thông tin sai, Khác), Tiêu đề, Nội dung và Email tuỳ chọn; tự gửi kèm đường dẫn trang đang xem và ngôn ngữ (`js/feedback.js`). Không cần đăng nhập: khách ẩn danh qua Cloudflare Turnstile (chỉ nạp khi mở hộp thoại), người đã đăng nhập được điền sẵn email tài khoản.
- `community-worker`: `POST /api/feedback` lưu bảng D1 `feedback` (migration `0003_feedback.sql`) rồi gửi thư báo tới `nguyennlt.ncc@gmail.com` qua binding `send_email` `FEEDBACK_MAIL` (Email Routing của `tqccl.com`), `Reply-To` là email người gửi; thư lỗi không làm mất góp ý. Giới hạn 5 lần/giờ theo IP đã băm (ẩn danh) và 10 lần/giờ theo tài khoản. Secret mới `TURNSTILE_SECRET`, `IP_HASH_SECRET`; cách bật Email Routing ở [community-worker.md](./community-worker.md).
- Trang quản trị có tab **Góp ý**: lọc theo trạng thái/loại, chuyển Chưa xử lý ⇄ Đã xử lý (`GET /api/admin/feedback`, `POST /api/admin/feedback/:id/status`).

### Changed

- `GET /api/me` trả thêm `email` của chính người dùng.
- Turnstile nạp lười chuyển sang `js/turnstile.js` dùng chung cho công cụ đọc ảnh và hộp thoại góp ý; hành vi mở/đóng hộp thoại footer chuyển sang `js/modal-dialog.js` (Ủng hộ tác giả dùng chung).
- Chính sách bảo mật và Điều khoản sử dụng mô tả dữ liệu góp ý, thư báo qua Cloudflare Email Service và phạm vi nạp Turnstile.

## 2026-09-28 (Cùng Tồn: ô chọn Mùa, hàng phiên bản, thẻ Đội chuẩn)

### Changed

- Cùng Tồn dùng ô chọn Mùa của Đội chuẩn thay hàng nút kịch bản: mùa mới nhất (`binh-dien-xuan-thu`, OG · Binh Diễn Xuân Thu) đứng đầu, là mặc định khi URL thiếu `scenario` (replaceState, `COEXIST_LATEST_SCENARIO_ID` trong `js/app.js`) và mang nhãn "Mới nhất"; đổi mùa ghi `?scenario=` bằng pushState. Link cũ chỉ có `?group=` vẫn mở đúng mùa của nhóm đó.
- Hàng phiên bản "Cùng tồn 1–5" là chip viên (mobile: 5 nút số chia đều), ghi `?group=` bằng replaceState; chip không còn dòng tóm tắt đội.
- Phiên bản đang xem: một dòng tóm tắt (chuỗi đội của nguồn, "5 đội · 15 tướng · không trùng", link Nguồn) và ghi chú/gợi ý khai hoang/lưu ý nguồn gập trong `details` mặc định đóng; đội hiện bằng thẻ Đội chuẩn (`coexistTeamCard`: cấp độ, Cải tạo, CHỦ/PHÓ 1/PHÓ 2, chiến pháp, binh thư, nhãn phụ tướng).

### Removed

- Hàng nút kịch bản, ô tổng quan ba cột, thẻ đội riêng của Cùng Tồn và dòng tóm tắt đội dưới chip nhóm; hai vai trò chữ số liệu Cùng Tồn (30px serif desktop, 13px mobile) cùng biến CSS của chúng vì không còn dùng.

## 2026-09-28 (Trang chi tiết Đội chuẩn: một ngôn ngữ, Tier, link Tra cứu; Tra cứu thêm Binh thư)

### Added

- Tra cứu có nhóm thứ bảy **Binh thư** (`books`, mã `book:<slug tên Việt>` từ `js/lookup-ids.js`, nguồn `data/books-dict.json` được pin sha256 lúc build qua `#lookup-books-hash`). Hồ sơ binh thư chỉ có tên; hiệu ứng hiện "Đang cập nhật" vì dữ liệu nguồn chưa có mô tả.
- Nhóm Binh thư đọc thêm tên Hán nguồn từ `pipeline/recommended-identity-map.json` (tính lúc build, nhúng `#lookup-book-aliases`, `bookSourceAliases` trong `js/lookup-ids.js`): tìm được bằng chữ phồn thể và tên cũ (`以退為進` → `以直报怨`); hồ sơ bản zh có dòng `旧名` cho 4 binh thư đổi tên (`以治擊亂`, `以退為進`, `出奇制勝`, `開闔`).
- Trang chi tiết Đội chuẩn: dấu **Tier** nguồn ở đầu trang (render lúc build); chiến pháp và binh thư trong thẻ tướng là link tới hồ sơ Tra cứu. Mã hồ sơ tính lúc build (`recordLookupLinks` trong `src/lib/team-detail-pages.ts`, nhúng `#team-lookup-links`); tên không có hồ sơ (vd. `異族弓`) giữ dạng chữ.

### Changed

- Trang chi tiết Đội chuẩn chỉ một ngôn ngữ: bản Việt bỏ tên Hán của đội, tướng, chiến pháp và binh thư; bản `/zh/` giữ nguyên chữ Hán.
- Ghi chú từng tướng rời khỏi thẻ tướng, gom vào khối "Ghi chú" dưới đội hình kèm nhãn tên tướng (cả cấu hình thay thế và nội dung đội gốc).
- Giao diện trang chi tiết: thẻ tướng cao bằng nhau, gáy son cho chủ tướng, ô chiến pháp/binh thư dạng hàng có mũi tên khi là link, khối "Ghi chú" viền son, "Nguồn & phạm vi" thành chú thích nhỏ cuối trang.

### Removed

- Link nguồn ngoài của trang Đội chuẩn ("Xem nguồn" ở panel điểm và "Mở nguồn tham khảo") cùng `validateReferenceSourceUrl`; Đội khác/Khai hoang vẫn dẫn link nguồn qua `validateHttpSourceUrl`.

## 2026-09-27 (Hợp nhất `origin/main`: domain chính + danh sách theo trang vào bản song ngữ)

### Changed

- Nút `Xem thêm` và ghi chú số đội mỗi lượt của danh sách Đội chuẩn/Đội khác đi qua `L()` (có bản tiếng Trung); lượt mới của Đội chuẩn nối vào nhóm Tier đã có (hoặc thêm nhóm mới ở cuối) thay vì dựng lại cả lưới, nên thẻ đã hiện giữ nguyên node; tuple `ui:recommended/more-note` bind biểu thức `` `Mỗi lượt hiện ${PAGE_SIZE} đội` ``. Policy `site-vi-260927-primary-domain`: ghim lại hash 4 file nguồn, baseline inventory 56650 vị trí; không fingerprint `translate` nào đổi nên không có receipt mới. Publish generation `07869493…` (xoá generation `d96e5c79…`), re-pin `pipeline/team-route-handles.json`.
- Origin site của blog (`SITE_ORIGIN` trong `src/lib/blog-posts.ts`, phân biệt link nội bộ/ngoài), origin mặc định của community-worker (`DEFAULT_SITE_ORIGIN`) và test hreflang/sitemap bản `/zh/` chuyển sang `https://tqccl.com`.

## 2026-09-27 (Logo sách mở thay ấn quạt mưu)

### Changed

- Logo site (header, menu mobile, footer, thẻ Landing, dải CTA, hình mờ hero, hộp thoại ủng hộ) là `public/logo.png` 256px nền trong suốt, dựng từ `docs/design/brand/logo-concept-v2.png`; `public/favicon.png` (128px) và `public/og-image.png` dùng cùng logo. `public/logo.png` vào danh sách static public của verifier và có rule `_headers`.

### Removed

- Ấn quạt mưu ba lá: `src/lib/seal.ts`, CSS `.seal-blade-*`, icon quạt ở `docs/design/brand/` (`icon*.svg`, `app-icon*`) và `scripts/build-brand-logo.py` (sinh icon từ `seal.ts`). `public/brand-concept-v2.png` (606 KB) được thay bằng `public/logo.png` (44 KB).

## 2026-09-27 (Domain chính `https://tqccl.com`)

### Changed

- Site: `https://tqccl.com` là domain chính. `site` của Astro, canonical/`og:url`/`og:image`, `sitemap.xml` và `Sitemap:` trong `robots.txt` đổi từ `https://tqccl.pages.dev` sang `https://tqccl.com`.
- Cầu chuyển domain `src/lib/host-bridge.ts`: script inline đầu tiên trong `<head>` của mọi trang. Trên `tqccl.pages.dev`/`www.tqccl.com` chuyển về `https://tqccl.com` cùng path/query/hash, mang bốn khóa localStorage bền (`tqcclRecruitTracker`, `tqccl.rosterRecommend.scanState.v1`, `theme`, `tqccl.teamView.v1`) trong fragment `#tqccl-migrate=` (fragment không gửi lên server); trên `tqccl.com` chỉ ghi khóa chưa có, payload sai thì chỉ bỏ fragment. Preview `*.tqccl.pages.dev` và local không bị chuyển. Không có chữ UI mới; policy `site-vi-260927-primary-domain` (hash `SiteLayout.astro`), generation Recommended `3b08070d…` (thay `26f3dbd7…`, đã prune), `pipeline/team-route-handles.json` pin lại.
- Vision Worker: `ALLOWED_ORIGIN` (một origin) thay bằng `ALLOWED_ORIGINS` (danh sách exact, phân cách dấu phẩy) = `https://tqccl.com,https://www.tqccl.com,https://tqccl.pages.dev`, nên cả ba host đều soi ảnh được trong và sau khi chuyển domain (trước đó `tqccl.com`/`www` nhận 403). CORS echo đúng origin gửi lên kèm `Vary: Origin`, origin lạ không nhận `Access-Control-Allow-Origin`; `hostname` siteverify phải là host của một origin trong danh sách. Thiếu/rỗng biến → `503` (trước đây mở thành `*`). Cần deploy lại Worker (trước Pages) và khai đủ ba hostname trong widget Turnstile (xem `docs/deployment-guide.md` § Chuyển domain chính sang tqccl.com).

## 2026-09-27 (Đội chuẩn / Đội khác: dựng danh sách theo lượt; CI thử lại e2e một lần)

### Fixed

- `/doi-chuan/?season=all` dựng cả 1366 thẻ một lần: 3,6 s tới lúc ô `Mùa nguồn` hiện trên máy dev, 23 s khi CPU chậm 6 lần, nên CI (chậm ~5 lần) đỏ `?season=all keeps every Đội chuẩn season…`. Danh sách Đội chuẩn và Đội khác (Thẻ, Thẻ gọn, Bảng) nay hiện 60 đội đầu và nút `Xem thêm` nối 60 đội kế (cùng mẫu Tra cứu: chỉ nối lượt mới, focus đội đầu của lượt mới, số đếm `n / m đội` vẫn là cả danh sách); đổi mùa/lọc/từ khóa/kiểu hiển thị về lượt đầu. Sau sửa ô `Mùa nguồn` hiện sau ~0,15 s (CPU x1) / ~0,7 s (x6).
- Quay lại từ trang chi tiết: snapshot trở về ghi thêm khóa thẻ đã mở (`disclosures.target`), danh sách dựng đủ lượt tới thẻ đó rồi trả focus về link của nó (mốc cuộn khôi phục như trước).

### Changed

- `playwright.config.mjs`: `retries` = 1 khi `CI` được đặt (0 ở máy dev); reporter `line` liệt kê test "flaky" ở phần tổng kết.
- Test e2e P06-B1 (51 lần tải trang chi tiết trong một test) đánh dấu `test.slow()`: ở CPU chậm 6 lần vượt ngân sách 30 s mặc định (4/5 lần đỏ), sau đánh dấu 5/5 xanh.
- Chữ UI mới `Xem thêm`, `Mỗi lượt hiện 60 đội` khai `authored-vi` (`ui:recommended/more`, `ui:recommended/more-note`); policy `site-vi-260927-progressive-list`, generation Recommended `26f3dbd7…` (thay `0cb3ba92…`, đã prune), `pipeline/team-route-handles.json` pin lại.

## 2026-09-27 (Soi đội từ ảnh: căn giữa thẻ chọn ảnh)

### Fixed

- Trang Soi đội từ ảnh, từ 981px trở lên: trước lượt soi đầu (thẻ 2 và 3 còn ẩn), `.ana-layout` chỉ còn một cột 440px căn giữa. Trước đây thẻ 1 dạt trái, để trống khoảng 67% bên phải ở 1440px. Khi có kết quả thì quay lại hai cột 440px + 1fr; dưới 981px giữ nguyên một cột full-width.

## 2026-09-27 (Bản tiếng Trung toàn site `/zh/`)

### Added

- Bản tiếng Trung giản thể cho mọi route: `/zh/`, 8 trang mục, 3 họ trang chi tiết đội (1366 + 166 + 17 trang), `/zh/chien-bao/`, `/zh/quan-tri/`. Tiêu đề chi tiết bản zh dùng tên chữ Hán gốc (đội chuẩn) hoặc ghép tên tướng chữ Hán (đội khác, Khai hoang); dòng phạm vi dùng mã mùa + tên mùa chữ Hán gốc.
- `SiteLayout`: `<html lang>`, `og:locale`, hreflang vi/zh-Hans/x-default, nút chuyển ngôn ngữ ở header và menu mobile (giữ query/hash), toàn bộ chữ header/menu/footer theo ngôn ngữ trang; link game/cộng đồng có nhãn tiếng Trung.
- 404 chọn khối tiếng Trung cho đường dẫn dưới `/zh/`; sitemap thêm bản zh và `xhtml:link` hreflang; `llms.txt` liệt kê các mục bản Trung; `_headers` thêm `/zh/*`.

### Changed

- Trang mục và trang chi tiết chuyển nội dung vào `src/components/pages/*.astro` (route chỉ là vỏ mỏng); blog khai hreflang qua `SiteLayout`.
- Token font `--font-sans`/`--font-serif` dùng `--font-han`/`--font-han-serif`: bản Việt giữ nguyên, bản Trung thêm font CJK hệ thống; bản Trung không preload subset tiếng Việt.
- Bản dịch: 15 obligation `translate` đổi fingerprint (13 do dời nguồn sang `src/components/landing/Landing.astro`, `src/components/pages/RecommendedDetail.astro`, `LegacyDetail.astro`; `ui:recommended/introduction` và `ui:route-recommended/description` đổi chữ, bỏ tên SGSDeck) được duyệt lại độc lập ở batch receipt mới `site-review-zh-cutover-20260927` (gỡ item tương ứng khỏi batch `site-review-v5-056`, `-070`, `-094`). Policy ghim lại hash 36 file nguồn, thêm `Landing.astro` vào `sourceFiles`, baseline inventory 56648 vị trí (bỏ `src/lib/seal.ts` khỏi `sourceFiles` khi đổi logo); publish generation `d96e5c79…` (xoá các generation `0cb3ba92…`, `5a717307…`), re-pin `pipeline/team-route-handles.json`. `WORKFLOW_BUILD_ID` đổi vì bao đóng MCP thêm `js/i18n.js` (output MCP không đổi).

## 2026-09-27 (Bộ logo thương hiệu)

### Added

- Bộ logo `docs/design/brand/`: chữ "Cẩm Nang" (Noto Serif Display 700) + dòng phụ "GAME TAM QUỐC CHÍ – CHIẾN LƯỢC" (Be Vietnam Pro 600), tên đầy đủ "Cẩm Nang Game Tam Quốc Chí - Chiến Lược" ở `<title>`/`aria-label`; ở chữ "ẩ", dấu mũ thay bằng ba chấm Ngụy · Thục · Ngô xếp thế chân vạc (màu phe `--f-nguy`/`--f-thuc`/`--f-ngo`), dấu hỏi giữ nguyên. Tệp: `logo.svg`/`logo-dark.svg` (+ PNG), mark "ẩ" `logo-mark.svg`/`logo-mark-dark.svg` nền trong suốt, `app-icon.svg` nền giấy (+ PNG 512/180) cho favicon/app icon. Chữ outline từ `public/fonts` nên không phụ thuộc phông máy xem. Sinh lại bằng `scripts/build-brand-logo.py`.

## 2026-09-27 (Blog tĩnh song ngữ + SEO/AEO/GEO)

### Added

- Blog `/bai-viet/` và `/zh/bai-viet/` (danh sách + trang bài `/bai-viet/<slug>/`, `/zh/bai-viet/<slug>/`) sinh tĩnh lúc build từ `GET ${COMMUNITY_API_ORIGIN}/api/posts`; không khai biến → blog rỗng (trang trạng thái rỗng song ngữ), khai mà API/payload lỗi → build dừng. Markdown qua Sätteri, bỏ HTML thô, lọc scheme link/ảnh.
- Trang bài: breadcrumb, tác giả + ngày đăng/cập nhật + phút đọc, hộp tóm tắt, mục lục h2/h3, FAQ dạng `<details>`, bài liên quan theo thẻ, link bản dịch + hreflang; JSON-LD `BlogPosting`, `BreadcrumbList`, `FAQPage`; meta `article:*`, Twitter card, `og:image` = ảnh bìa. Trang danh sách: JSON-LD `CollectionPage` + `Blog` + `ItemList`.
- `rss.xml`, `zh/rss.xml`, `llms.txt` (tổng quan site và danh sách bài cho trình thu thập AI); sitemap thêm trang blog kèm `<lastmod>`; `_headers` revalidate các output mới; verifier kiểm blog tự nhất quán.

### Changed

- `robots.txt` khai tường minh `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`; chặn `/quan-tri/`, `/zh/quan-tri/`, `/api/`.

## 2026-09-27 (Pipeline: rebuild teams.json tái tạo được)

### Fixed

- `python3 -m pipeline.build_json` nay tái tạo trùng byte `data/teams.json` và `data/facets.json` (trước dừng với 8 ID mất). Nguyên nhân và sửa: 6 Team PK `team-intro-50…55` (thêm tay 2026-07-03/07-08, không có trong HTML) chuyển sang input curate `pipeline/team-intro-supplement.json`, nối sau các nguồn HTML; `normalize.clean_text` bỏ dấu thanh kết hợp thừa (`Giả Hụ̉`, `Lục Tốṇ`, `Lỗ Túc̣` trong HTML, khác dạng Unicode với khoá alias) và chuẩn NFC; `aliases.json` thêm `heroNames` (sửa cả tên hiển thị: `Hoàng Phổ Tung`, `Đổng Trách`) và 4 alias chiến pháp/binh thư đã sửa tay trong artifact; ô CP1/CP2 gộp `A+B/C+D` tách theo ô; nickname dạng chuỗi chỉ áp cho Team PK, dạng `{nickname, sources}` ghi rõ nguồn (`Hổ Thần Cung` cả hai nguồn); sao nguyên ghi `4` thay vì `4.0`. Không đổi byte `data/`.

### Changed

- `pipeline.build_json` mặc định chỉ ghi `teams.json`, `facets.json`; `--overwrite-curated` mới ghi đè `coexist.json`/`khaihoang.json` từ HTML; `--check` so với `data/` không ghi (exit 1 nếu lệch). Docs `README.md`, `deployment-guide.md`, `system-architecture.md`, `codebase-summary.md`, `project-overview-pdr.md`.

## 2026-09-27 (Pipeline: nghỉ build_dict, prune generation, dọn repo, CI, docs)

### Removed

- Chuỗi `pipeline.build_dict` (đã bị chặn vĩnh viễn từ khi Tra cứu thống nhất sở hữu `heroes-dict.json`/`tactics.json`): `build_dict.py`, `crawl_tactics.py`, `link_tactics.py`, test và fixture `tests/fixtures/lingxi/`, hai bảng chỉ chúng đọc `pipeline/tactic-name-overrides.json`, `pipeline/role-tag-map.json`; rào `promote_unified_lookup` dò tiến trình `build_dict` đang chạy. `data/tactics-generic.json` giữ nguyên (artifact công khai `legacy-public/build-input`).
- Script npm `test:contracts`, `test:dev-contract` (hai file đã chạy trong `test:node`) và `test:e2e:astro` (project Playwright duy nhất là `astro`).

### Added

- `python3 -m pipeline.site_localization prune --root .` xoá mọi thư mục generation dưới `src/data/recommended-reference/` khác `generationId` mà `current.json` pin; từ chối và không xoá gì nếu thư mục được pin không tồn tại. Thêm vào quy trình publish (`docs/season-team-data.md`) sau `check --stage public`.
- `pipeline/common.py`: `canonical_json` (luôn `allow_nan=False`) và `sha256_hex`; thay 4 hàm `sha256` hex, 3 hàm và 5 chỗ inline `canonical_json` trùng lặp. Bốn file builder Tra cứu (`build_unified_lookup.py`, `lookup_translations.py`, `sgsdeck_identity.py`, `unified_lookup_identity.py`) giữ bản riêng vì byte của chúng nằm trong `executionHashes` của generation Tra cứu (sửa là phải publish lại); slug handle của `team_route_handles.py` giữ riêng (mirror `S(x)` của `src/lib/team-detail-routes.ts`). Không đổi byte output (`check --stage public`, `team_route_handles --check`, `build_season_data` trùng byte).

### Changed

- **Dọn repo theo Q5 = A: chỉ untrack + `.gitignore`, không viết lại lịch sử, không force-push** (blob cũ vẫn trong `.git`). Repo chỉ còn track generation Recommended đang pin (`0cb3ba92…`; xoá 36 generation cũ, 3284 file, ~211 MiB khỏi cây làm việc); ngừng track `pipeline/lookup-output/site-vi-candidate/`, `site-vi-activation/` (ignore `pipeline/lookup-output/*candidate*/`, `*activation*/`), `pipeline/recommended-missing-translations.json` (worksheet nay ghi ra `.cache/`), và 53 file media `assets/videos/team-info-from-download-260701/` (ignore `*.mp4`, `*.jpg`; `team-list.md` giữ lại, bỏ đường dẫn máy). Bản trên đĩa của media, `_site/`, `.wrangler/` gốc chuyển vào `~/.Trash/CamNangTQCCL-cleanup-260927/`.
- CI `mcp-worker.yml` chạy cả khi đổi `css/**`, `public/**`, `tsconfig.json`.
- Docs: `README.md`, `docs/deployment-guide.md` bỏ `build_dict` khỏi lệnh thường; `docs/system-architecture.md` ghi từ điển do Tra cứu thống nhất sở hữu, lỗi JSON hiện ở mount trang mục; `docs/project-overview-pdr.md` 8 trang mục theo đường dẫn (hash chỉ chuyển tiếp), 202 tướng/406 chiến pháp, 17 đội khai hoang; `docs/codebase-summary.md` số liệu tương ứng; `docs/unified-lookup.md` evidence hiện tại là transaction `site-vi-260926-1928` (`committed`, `lookup:064fd2d5…`), `--activation <activation-manifest>`; `docs/season-team-data.md` `parse_coexist_csv` là thư viện không CLI (cách gọi `build_content_links` bằng Python), bước `prune`; plan `260907-2333` đánh dấu `completed`.

## 2026-09-27 (Pipeline: ID ổn định, binh thư, crawler, khoá mùa, alias)

### Fixed

- `pipeline.build_json` không còn đánh số lại ID đội theo chỉ số toàn cục (rebuild từng đổi 110 ID `moi-phe`): `build_teams` giữ ID của `data/teams.json` đang commit theo (nguồn, tập tên tướng đã sắp; trùng thì theo thứ tự), đội mới nhận số kế tiếp của đúng nguồn, đội đã commit biến mất khỏi nguồn làm lệnh dừng và liệt kê ID. Hiện lệnh dừng với 8 ID (`team-intro-50…55`, `moi-phe-73`, `moi-phe-86`), nên không ghi đè artifact.
- `pipeline.build_books_dict` không còn ném `ValueError` với `归心` (Quy Thuận) và `兵行诡道` (Binh Hành Quỷ Đạo): hai dòng map mang cờ `outsideTeams: true` (sách không đội nào dùng), validator từ chối cờ khi sách đã có trong facet. `data/books-dict.json` giữ nguyên byte.
- `pipeline.crawl_sgsdeck_recommended`: bỏ cờ `--resume` không dùng (cache manifest là điểm tiếp tục), thêm `--freeze-inventory <picker.html>` ghi `scope-inventory.json` (trước không lệnh nào ghi file này); thiếu inventory thì báo đúng bước cần chạy.
- `pipeline.build_season_data` giữ khoá `pipeline/lookup-output/promotion.lock` của repo thay vì của cha `--output-dir` (ghi ra `/tmp/…` từng tạo khoá ở `/tmp/pipeline/…`, không loại trừ promotion Tra cứu), và từ chối khi còn transaction Tra cứu `activation-prepared`/`writing`.
- `pipeline.suggest_aliases` quét đúng `_TEAM_FILES` của `build_json` (bỏ `Team Đô Úy.html`), gom tướng theo `baseName` (không đề xuất `SP Tuân Úc` ~ `SP Tuân Úc(S)`) và bỏ tên đã là khoá trong `aliases.json`.
- `pipeline.hanviet.transliterate` chọn cụm đọc đặc biệt dài nhất (trước lấy cụm khớp đầu tiên theo thứ tự khai báo); bảng hiện tại không có cụm lồng nhau nên output không đổi.

### Changed

- Test `data/facets.json` = `build_facets(data/teams.json)` và tổng `sources` = tổng `statuses` = số đội; docs bỏ câu "facets lệch 1 đội". Docs lệnh builder Recommended thêm `--catalog data/heroes-dict.json` (bắt buộc), quy trình crawler thêm bước freeze.

## 2026-09-27 (Vision Worker và Research MCP)

### Fixed

- Vision Worker: lỗi KV (vd `KV PUT failed: 429`) không còn làm request rơi ra 500 thô của Cloudflare không có CORS: đọc KV lỗi coi như 0, ghi KV lỗi bị bỏ qua; mọi lỗi bất ngờ trả JSON 500 `Lỗi xử lý, thử lại sau` có CORS.
- Vision Worker: không còn trả `Model upstream lỗi <mã>`; upstream 429 → 503 `Dịch vụ AI đang quá tải, thử lại sau`, lỗi khác (401/403/5xx) → 502 `Dịch vụ AI tạm lỗi, thử lại sau`. Soi đội và Gợi ý đội hiển thị câu tiếng Việt riêng cho 502, quá tải và Worker chưa cấu hình.
- Vision Worker: `Content-Length` vượt `ceil(MAX_IMAGE_BYTES·4/3) + 4096` bị trả 413 trước khi đọc body, ghi KV hay gọi siteverify.
- Vision Worker: siteverify phải trả `hostname` đúng host của `ALLOWED_ORIGIN`; bỏ lớp replay KV (siteverify đã bảo đảm token dùng một lần), mỗi lượt bớt một đọc và một ghi KV. Bỏ ánh xạ "Token xác thực đã dùng" ở site.
- Vision Worker: IP băm bằng HMAC-SHA256 với secret `IP_HASH_SECRET`, IPv6 gom theo /64; thiếu hoặc rỗng secret → 503 `Dịch vụ soi ảnh chưa được cấu hình` có CORS, không đụng KV, siteverify hay model. **Deploy cần `wrangler secret put IP_HASH_SECRET` trước `wrangler deploy`** (`docs/deployment-guide.md`); bộ đếm per-IP cũ tự hết hạn sau 2 giờ.
- Vision Worker: danh sách tướng cho nhận diện chân dung đủ 202 tướng Giản thể (trước 112, lệnh sinh cũ in tên Phồn thể có khoảng trắng); `worker/test/hero-names.test.ts` báo lệch khi `data/heroes-dict.json` đổi.
- Gợi ý đội từ kho: ba nút đọc ảnh khoá cùng lúc khi một thẻ đang đọc và lấy token Turnstile một lần, nên không còn gửi cùng một token hai lần; nén ảnh lỗi không còn reset widget và bỏ token.
- Research MCP: sau `TQCCL_MCP_NEXT_TOKEN_NOT_AFTER` token NEXT hết hiệu lực (401) còn CURRENT vẫn 200, thay vì cả dịch vụ trả 503 `SERVICE_MISCONFIGURED`. Origin không được phép trả 403 (trước 400), kết quả vượt `TQCCL_MCP_MAX_RESULT_BYTES` trả 413 (trước 500); bảng mã lỗi trong `docs/mcp-research-server.md`.
- Test e2e `gameplay config keeps precedence over old reference selectors` so URL Cùng Tồn kèm `scenario` mà boot tự ghi (trước đỏ ngẫu nhiên tuỳ thời điểm so).

### Changed

- Guard ảnh của Vision Worker không giải mã rồi mã hoá lại toàn ảnh: kiểm ký tự bằng regex, tính kích thước từ độ dài và padding, chỉ giải mã 12 byte đầu cho magic bytes (ảnh 1,4 MB: ~12,4 ms → ~1,7 ms). Base64 không chuẩn (thiếu padding, có khoảng trắng bên trong) nay bị 400; trình duyệt luôn gửi base64 chuẩn.
- `worker/README.md`: contract `{image, turnstileToken, mode}`, 4 chế độ và shape response, mã lỗi, Cloudflare Pages thay GitHub Pages, ba secret bắt buộc.
- Policy `site-vi-260927-worker` (hash `js/analyze.js`, `js/roster-recommend-ui.js`; thêm 3 tuple `authored-vi`), publish generation `0cb3ba92…` (xoá generation `eeaa9c42…` của Phase 5), re-pin `pipeline/team-route-handles.json`. `WORKFLOW_BUILD_ID` không đổi.

## 2026-09-27 (Hiệu năng runtime)

### Changed

- Mỗi trang chỉ tải và xác minh nguồn dữ liệu chính nó dùng (bảng nguồn theo trang ở `docs/code-standards.md`): `/khai-hoang/` còn 2 request `/data/` (trước 11), Tra cứu và Theo dõi chiêu mộ 5 (trước 11), Soi đội và Gợi ý đội 7 (trước 11), Đội chuẩn/Đội khác/Cùng Tồn 11 (trước 15); trang chi tiết Đội chuẩn/Đội khác tải `teams.json` một lần (trước hai lần) và không còn tải kho Tra cứu, Cùng Tồn, Khai hoang; chi tiết Khai hoang chỉ tải publication và `khaihoang.json`.
- `loadWebsiteDisplay` nhận `{paths}` và băm các nguồn song song; `localizeData` từ chối nguồn chưa được publication xác minh. Bộ nạp byte dùng chung `createByteLoader()` (một request mỗi đường dẫn, lần lỗi được tải lại khi "Thử lại") thay cho ba bộ nạp riêng của `app.js`, `team-detail.js`, `khaihoang-detail.js`.
- `app.js` tải kho Tra cứu, `team-tier.json` và mô hình mùa song song; lỗi kho Tra cứu chỉ báo ở trang dùng nó. Boot chỉ render phạm vi một lần và chi tiết cấu hình chỉ dựng đúng hàng được mở.
- Theo dõi chiêu mộ: tóm tắt normalize state một lần (pity và lịch sử 5★ tính trên state đã normalize); 5 banner × 2000 sự kiện từ ~33 ms xuống ~5 ms mỗi lần render.
- Policy `site-vi-260927-hieu-nang` (hash 5 file JS; inventory không đổi), publish generation `eeaa9c42…` (xoá generation `75a88d67…` của phần 4b), re-pin `pipeline/team-route-handles.json`.

### Fixed

- Test e2e N5-3 (`recommended-browser.spec.mjs`) không còn đọc URL trong trang ngay sau Back khi hai mục lịch sử cùng URL (đỏ ngẫu nhiên cả trước phase này).

## 2026-09-27 (Xoá code chết phần 4b: MCP, Vision Worker, pipeline)

### Removed

- MCP `LegacyDomainAdapter` chỉ còn `findSimilarTeams` và `recommendTeams` (hai method production gọi); bỏ 15 method còn lại cùng import `js/roster-scan-map.js`, `js/roster-scan-state.js` khỏi bao đóng workflow. Test ghim danh sách method thay bằng test hành vi: đội tương tự trả đúng đội đã đọc, gợi ý đội chỉ dùng tướng/chiến pháp có trong kho.
- MCP export chết hoặc chỉ test dùng: `LOOKUP_SIDECAR_FILES`, `ReleasePointer`, `requiresConfirmation`, `applyConfirmedCorrections`, `fromScrubSafeDigest`; trong `contracts.ts`: `createHeroSlot`, `parseBrowserScanConfirmation`, `parseConfirmationBinding`, `parseRosterSnapshot`, các kiểu `UnresolvedObservation`, `ConfirmationDecision`, `RecommendationResult`, `RecommendationRequest`, `ResultPage`, `DomainError` và kiểu/helper chỉ chúng dùng; trường `AuthenticatedBearer.slot`.
- Vision Worker: `parseAndValidate`, `AnalyzeResult.raw`, `GuardOk.bytes`.
- Pipeline: CLI `build_recommended_evidence`/`main()` của `pipeline/sgsdeck_recommended.py` và `pipeline/sgsdeck-recommended-evidence.json` (không ai đọc; các `parse_*`, `join_recommended_evidence` giữ nguyên); `build_registry`, `allocate_child_ids` của `pipeline/unified_lookup_identity.py`; `compile_data_candidate`, `check_data_candidate`, `LEDGER_PATH` của `pipeline/site_localization.py` (`ui_source_locations` đọc ledger theo `policy["artifacts"]["ledger"]`); `EXPECTED_COUNTS` của `pipeline/parse_team_intro.py`; `STAT_MAP`, `stat_focus_vn` của `pipeline/hanviet.py`.
- 15 file output reviewer mồ côi trong `pipeline/localization-reviews/` (không batch receipt nào trỏ tới).

### Changed

- Policy `site-vi-260927-xoa-code-chet-b` (hash `worker/src/schema.ts`, `js/analyze-map.js`; inventory không đổi), publish generation `75a88d67…` (xoá generation `8e1f0231…` của phần 4a), re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` đổi vì bao đóng MCP bớt hai file (output MCP không đổi).

## 2026-09-27 (Xoá code chết phần 4a: JavaScript, Astro, CSS)

### Removed

- Module không trang nào nạp: `js/team-pk.js`, `js/meta-cu.js`, `js/tactics.js`, `js/hero-list.js`, `js/hero-detail.js` và `js/derive-team-faction.js` (chỉ còn phục vụ khối dựng hàng chết của `app.js`), cùng entry trong `src/lib/public-artifact-manifest.mjs` (không còn phát ra `dist/js/`) và test chỉ phủ chúng.
- Chuỗi bộ lọc cũ: `createTeamFilterSection`, `createSeasonTeamSection`, `facetCount`; `teamCard`, `seasonTeamCard`, `coexistGroup`, `bestTier`, `tierClass`, `STATUS_LABEL` của `js/render.js`; `applyFilters`, `emptyState` của `js/filters.js` (còn `normalizeText`, `teamSearchBlob` dùng chung với MCP); `validateTeamFilters`, `filterSeasonRows`, `rowFacet` của `js/season-ui-state.js`. CSS không còn ai dùng: `.card-head`, `.head-right`, `.tag.t-book`, `.fchip.recommend`, `.tac-card`, `.tac-search`, `.combo-input`, `.team-filter-bar select`, `.flabel-inline`, `.cam-nang-status` và khối `.detail-score` đầu bị ghi đè.
- `app.js`: lời gọi `update` của hai mục `team-pk`/`meta-cu` không tồn tại, `queryForSection`, các trường hàng chỉ phục vụ chúng và `lookupUI`; lỗi khởi động nay được `console.error`.
- Export không có caller production: `clearReturnSnapshot`, `resolveTeamDestination`, `loadVerifiedLegacyTeam`, `lockedConstraints`, `heroIdentityKey`, `LOOKUP_PAYLOAD_NAMES`, 5 hằng chữ của `js/detail-actions.js` (bỏ `export`), `findAdmittedVariant`, `teamDetailHtmlPaths`, `src/lib/recommended-reference-data.mjs`.
- Engine gợi ý đội: trường `presetId`, `presetReason`, `coexistSetBonus`, `score` và hai phần tử luôn 0 của `rankingTuple`; thứ tự gợi ý không đổi.
- Nhánh không tới được: chặn paste theo tab cũ ở Soi đội, nhãn `food` và cảnh báo khoá chi phí lạ ở Tra cứu, `if (!value) continue` ở bảng Đội chuẩn.

### Changed

- Bản dịch: bỏ 2 tuple `translate` `ui:season/tier-sort`, `ui:season/tier-label` (mục ledger và item receipt); owner inventory của `data/coexist.json` là `js/render.js::seasonCoexistGroup`. Policy `site-vi-260927-xoa-code-chet-a`, publish generation `8e1f0231…` (xoá generation `b3636bad…` của phần 3c), re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` đổi vì file thuộc bao đóng MCP bị sửa (output MCP không đổi).
- `docs/codebase-summary.md`, `docs/system-architecture.md`: bảng module mô tả Landing + 8 trang mục, `team-filter-section.js`, `render.js`, `filters.js` và bộ Tra cứu hiện có.

## 2026-09-27 (UI/UX phần 3c: trang chi tiết, shell)

### Fixed

- Trang chi tiết Đội chuẩn/Đội khác: byte dữ liệu lệch pin (ví dụ `data/teams.json` đổi sau deploy) báo "Không thể xác minh dữ liệu đội hình…", không còn "Hãy kiểm tra kết nối"; chỉ lỗi fetch/HTTP mới là lỗi mạng (hàm dùng chung `isNetworkError` trong `js/detail-actions.js`, Khai hoang dùng cùng hàm).
- "Sao chép liên kết đội" chép URL của trang chi tiết không kèm `from` (trạng thái danh sách của người gửi); Khai hoang giữ `variant` đang chọn. Ô dự phòng khi clipboard lỗi cũng hiện URL này.
- Trang chi tiết: đầu trang canh trên (`align-items: start`), panel nguồn cao của Khai hoang không còn đẩy tiêu đề xuống cách link "Quay lại" ~200px.
- Panel đầu trang chỉ còn nút sao chép (Đội khác, cấu hình Khai hoang không có nguồn) không còn khung viền trông như ô trống.
- Tagline dưới logo của 8 trang mục là mô tả một dòng của chính mục trong menu (ví dụ Tra cứu "Xem tướng, chiến pháp, trang bị, quân sư"), không còn "Tra cứu đội hình theo kịch bản" chép ở 5 trang; Landing không còn tagline "Tất cả — tham khảo".
- Mục đang xem nổi bật: dòng menu mobile có `aria-current` có vạch và nhãn son; nút "Công cụ" trên header được đánh dấu khi đang ở một trong ba công cụ.
- Theme tối: link "website chính thức" ở mục Tải game khi hover dùng `--accent-ink` (không còn 1,77:1).
- Nút đổi giao diện giữ tên "Giao diện tối", chỉ `aria-pressed` đổi theo trạng thái.
- 8 trang mục có `<noscript>` với `h1` tên mục và lời nhắn cần JavaScript; khối phạm vi mùa có `role="group"` để nhãn "Phạm vi đội hình" có hiệu lực.

### Changed

- Mô tả `/cung-ton/` bỏ "và phiên bản luật" (trang không còn bộ chọn luật).
- Preload thêm subset vietnamese của Be Vietnam Pro 400 và Noto Serif Display 700.
- Mọi trang khai `og:site_name`, `og:locale=vi_VN` và `og:image` tuyệt đối trỏ `public/og-image.png` (1200×630, ấn 兵 + tên logo; lệnh sinh ở `docs/design/so-binh-phap/README.md`); `_headers` thêm luật `/og-image.png` (17 luật), verifier khoá byte ảnh.
- Bản dịch: đổi chữ `ui:section-page/cung-ton` metaDescription; thêm `ui:layout/theme-toggle`, `ui:layout/section-noscript` (đều `authored-vi`); policy `site-vi-260927-ui-ux-c`, publish generation `b3636bad…` (xoá generation trung gian `f1fcb066…` của phần 3b).

## 2026-09-27 (UI/UX phần 3b: công cụ, Chiêu mộ)

### Fixed

- Gợi ý đội: kho rỗng thì nút "Xác nhận dữ liệu đã đọc" và "Gợi ý 5 đội" khoá, bước Kiểm tra/Gợi ý ở trạng thái chờ (không còn ✓ khi chưa đọc gì). Mục "Nên thêm" trống báo "Đã đủ 5 đội." khi danh sách đã đủ 5 đội, "Chưa có đội phù hợp để thêm từ kho hiện tại." khi không đội nào thêm được.
- Soi đội, Gợi ý đội: widget Turnstile lỗi (ví dụ 110200) không còn ném `TurnstileError` ra trang; token bị bỏ và trang báo "Xác thực chống bot không thành công. Tải lại trang rồi thử lại." (hàm dùng chung `renderTurnstileWidget` trong `js/analyze.js`).
- Gợi ý đội: ô chọn tệp hệ thống ("Choose File") ẩn như Soi đội; mỗi thẻ đọc ảnh có nút "Chọn ảnh" mở hộp chọn tệp và hiện tên tệp đã chọn.
- Gợi ý đội: tên đọc từ ảnh có độ tin thấp (không khớp từ điển, chỉ phiên âm) gắn dấu "kiểm tra" và đứng đầu danh sách ở bước Kiểm tra.
- Soi đội: tướng đoán từ chân dung (`sure: false`) không còn được tính là tướng khớp khi tìm đội tương tự nhưng vẫn vào mẫu số (đọc 3 tướng, 1 không chắc → `2/3`, không còn `2/2` với dấu đủ). MCP `tqccl_match_team` nhận tướng canonical đã xác nhận nên kết quả không đổi.
- Soi đội: bước cuối ghi "Đã đọc xong — kiểm tra lại kết quả đã đọc" (kết quả nằm dưới form ở bề rộng hẹp, không phải "bên phải").
- Chiêu mộ: tiêu đề form và lịch sử 5★ ghi tên lượt tiếng Việt (`Miễn phí 1`, không còn `free_1`); số lượt trong lịch sử so với mốc bảo hiểm của chính gói (không còn cố định `/30`).
- Chiêu mộ: form 5★ của lượt ngày không còn ô Ngày, ghi vào đúng ô của lưới đã mở; lượt ngày đã ghi (Không ra/Ra 5★) không nhận thêm 5★, nên không còn sự kiện trùng.
- Chiêu mộ: trang để mở qua nửa đêm tự vẽ lại lưới ngày mới (hẹn giờ tới nửa đêm địa phương, kiểm lại khi quay về tab), bốn ô về "Chưa quay" và bấm được.

### Changed

- Gợi ý đội: chế độ "Nhiều hột" xếp số hột đỏ trước bậc (cả lượt chọn tham lam lẫn tìm kiếm full-box, full-box so tổng hột của danh sách khi cùng số đội); "Meta T0 → T1" giữ thứ tự cũ. Engine dùng chung với MCP nên output gợi ý đội MCP ở chế độ `redStars` đổi theo; `WORKFLOW_BUILD_ID` đổi.
- Bản dịch: đổi chữ `ui:analyze/step-done`, `ui:roster/add-empty`; thêm `ui:roster/add-full`, `ui:roster/scan-pick-action`, `ui:roster/flag-check`, `ui:analyze/turnstile-error` (đều `authored-vi`); policy `site-vi-260927-ui-ux-b`, publish generation `f1fcb066…` (xoá generation `17a9c663…` của phần 3a) và re-pin `pipeline/team-route-handles.json`.

## 2026-09-27 (UI/UX phần 3a: danh sách đội, Cùng Tồn, Tra cứu)

### Fixed

- Đội chuẩn/Đội khác: mũi tên ô `Mùa nguồn` và các nút mở nhóm lọc (Nhóm, Nguồn) không còn mất nét ở `/doi-khac/` (mỗi icon dựng node SVG riêng).
- Đội chuẩn nhận `?season=all` (link từ Tra cứu): ô `Mùa nguồn` có lựa chọn `Tất cả` và hiện đúng lựa chọn đó thay cho mùa mặc định.
- Đội hai tướng ở nguồn (ô thứ ba để trống, ví dụ `yxms-005`) hiện ô `—` có tên truy cập "Nguồn để trống" trên thẻ, bảng và trang chi tiết thay cho "Nội dung tiếng Việt chưa sẵn sàng".
- Tên đội chuẩn đã dịch hết dùng ngoặc thường: `Gian Hùng Kỵ（Lữ Bố）` → `Gian Hùng Kỵ (Lữ Bố)` (chuẩn hoá ở `resolve_team_display_name`; tên còn chữ Hán giữ nguyên).
- Không còn hai trang chi tiết cùng `<title>` hoặc cùng mô tả: Đội chuẩn thêm mã mùa (`Hoàng Cân Thuẫn (PK-S26)`), Đội khác trùng tên thêm nhãn nguồn; còn trùng thì thêm số thứ tự (` · 2`). `scripts/verify-astro-dist.mjs` chặn tiêu đề/mô tả trùng.
- Cùng Tồn chỉ còn một điều khiển kịch bản: bỏ select `Mùa` trong đầu mục, hàng nút kịch bản (thứ tự registry) ghi `?scenario=` bằng pushState, reload giữ và Back về kịch bản trước; URL chưa có `scenario` chọn kịch bản của `group` trong link cũ, không thì kịch bản đầu (replaceState). Đóng chi tiết cấu hình (nút hoặc Escape) trả focus về tiêu đề Cùng Tồn.
- Link quay lại từ trang chi tiết chỉ giữ khoá thật của trang: Cùng Tồn `group`, `config`, `scenario`, `ruleset`; Soi đội, Gợi ý đội không giữ khoá nào.
- Tra cứu: mở thẻ từ chế độ tất cả không còn chuyển lưới sang một nhóm (`group` là bộ lọc người dùng chọn, không suy từ `id`); bấm lại chip đang nhấn để về tất cả. Đóng hồ sơ đã mở trong phiên lùi lịch sử (một lần Back sau đó về trạng thái trước khi mở); Back giữ số lượt "Xem thêm" đã mở và trả focus về thẻ vừa mở; "Xem thêm" chỉ nối lượt mới và đưa focus tới mục đầu của lượt đó.
- Tra cứu: con số "đội chuẩn" trong "Trong cẩm nang" là chữ thường (link "Tìm tướng này trong Đội chuẩn" giữ nguyên); hồ sơ tướng hiện `Điểm nội chính`, `Thưởng sưu tầm`, `Quy tắc điểm đỏ` khi dữ liệu có; nút đóng hồ sơ trên mobile (≤ 680px) ghim ở góc trên khi cuộn.

### Changed

- Nút chế độ xem của hai trang danh sách đội đổi nhãn `2 cột` / `4 cột` / `Bảng` → `Thẻ` / `Thẻ gọn` / `Bảng` (aria "Xem dạng thẻ", "Xem dạng thẻ gọn"); `?view=luoi|bang` và khoá nhớ `tqccl.teamView.v1` giữ nguyên.
- Bản dịch: đổi chữ 4 obligation `authored-vi` của nút chế độ xem, thêm 4 (`ui:recommended/source-empty-seat`, `ui:lookup/hero-civil-points`, `hero-collectible-bonus`, `hero-red-rules`); policy `site-vi-260927-ui-ux-a`, publish generation `17a9c663…` (xoá generation trung gian `07792857…`) và re-pin `pipeline/team-route-handles.json`.

## 2026-09-27 (7 lỗi nặng)

### Fixed

- Trang dùng `js/season-context.js` không còn hỏng trên Safari 16: regex cờ `v` thay bằng `/(?![\n\r\t])\p{C}/u` (cùng hành vi); test mới `tests-js/browser-baseline.test.mjs` kiểm mọi module JS phát hành chạy được trên cú pháp ES2022.
- Tra cứu: tìm không dấu coi `đ`/`Đ` là `d`/`D` ("dieu thuyen" ra Điêu Thuyền); khoá tìm tính một lần mỗi mục thay vì mỗi lần gõ.
- Gợi ý đội: dòng "Thiếu tướng:" của "Đội mạnh nhưng chưa thể xây dựng" hiện tên tướng theo từng vị trí (lựa chọn trong vị trí nối bằng " / ") thay cho mã `hero:…`.
- Soi đội: chọn ảnh khác trong lúc đang soi không còn làm nút "Soi đội" kẹt; widget Turnstile luôn reset sau lượt soi, kết quả của ảnh cũ bị bỏ.
- Chiêu mộ: nhập JSON kiểm từng tài khoản, gói, lượt quay, lượt ngày (khoá lượt, số lượt hữu hạn ≥ 1, tham chiếu tài khoản/gói có thật) và chạy thử trước khi ghi đè; file hỏng báo "Dữ liệu không hợp lệ.", dữ liệu cũ giữ nguyên.
- Gợi ý đội: đọc lại cùng ảnh đội đã xây không nhân đôi đội khóa; hai đội khóa dùng chung tướng/chiến pháp thì giữ đội đầu, đội sau vào xung đột (trước đây bỏ cả hai và tướng của chúng bị gợi ý lại). Mỗi đội khóa có nút "Bỏ đội", thêm nút "Xóa toàn bộ kho" (có hỏi xác nhận).
- `pipeline.recommended_team_dedup` nhận `--pack pipeline/localization-inputs/recommended.json` thay cho `--cache` khi máy không có cache crawler; pack phải khớp `baseline.sourcePins` (ledger sinh ra trùng byte với ledger hiện có).
- Sửa tên hỏng trong `data/teams.json` (script một lần, dữ liệu dựng sẵn NFC): bỏ dấu chấm dưới rời ở `Lục Tốn`, `Giả Hủ`, `Lỗ Túc` (cả tên tướng `(S)` và 7 tên đội moi-phe-72, 86, 113–116, 133), `SP Hoàng Phổ Tung` → `SP Hoàng Phủ Tung`, `SP Đổng Trách` → `SP Đổng Trác`, tên đội `Trách Thuyền Bố` → `Trác Thuyền Bố`, chiến pháp `Thịnh Khí` → `Thịnh Khí Linh Địch`; các đội này nay sở hữu được trong Gợi ý đội. Giữ nguyên `Bái Sư …` và `Tinh·Phong Thi Trận` (chiến pháp bản tinh). Alias tương ứng thêm vào `pipeline/aliases.json`, khoá nickname `Hoàng Phủ Tung|…` đổi theo; sinh lại `data/facets.json` và `pipeline/recommended-other-teams.json` (bằng `--pack`; counts không đổi, 40 đội Đội khác). Handle URL giữ nguyên. Test mới `tests-js/teams-data-integrity.test.mjs` (NFC + mọi đội sở hữu được, trừ danh sách chờ nguồn có lý do). Publish generation `07792857…` (bỏ generation trung gian `5c666843…`), re-pin `legacyTeamsSha256`.
- Bản dịch: thêm 4 obligation `authored-vi` (`ui:roster/locked-remove`, `locked-remove-aria`, `clear-all`, `clear-all-confirm`), policy `site-vi-260927-loi-nang`, publish lại cùng đợt sửa tên (generation cuối `07792857…`) và re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` MCP sinh lại (engine gợi ý đội dùng chung).

## 2026-09-27 (đường dẫn công cụ)

### Changed

- Ba trang Công cụ dùng đường dẫn ghi rõ tên: `/chieu-mo/` → `/theo-doi-chieu-mo/`, `/soi-doi/` → `/soi-doi-tu-anh/`, `/goi-y-doi/` → `/goi-y-doi-tu-kho/` (menu, Landing, sitemap, canonical, `_headers`, allowlist `safeReturnUrl`, hash cũ `#recruit-tracker`/`#analyze`/`#roster-recommend`). Đường dẫn cũ không redirect, trả trang 404 tĩnh như URL ngoài inventory. Bản dịch: đổi id obligation `ui:section-page/<đường dẫn>` + entrypoint, ghim lại hash nguồn và digest inventory trong policy; cần publish generation mới + re-pin `pipeline/team-route-handles.json`.

## 2026-09-26 (thẻ đội + lưới 4 cột)

### Changed

- Thẻ đội của `/doi-chuan/` và `/doi-khac/` dựng lại chung một bố cục: gáy thẻ tô màu phe, điểm nguồn nằm trong ô ấn son viền kép (nhãn "ĐIỂM"), đội chưa có điểm dùng cùng ô ấn viền đứt nét "—" (trình đọc màn hình đọc "Chưa có điểm nguồn") nên đầu thẻ hai trang cùng hình dạng; vai trò Chủ tướng chữ son; chân thẻ nền giấy nhạt với CTA "Chi tiết" dạng nút chữ son 44px thay cho nút mực đặc lặp lại.
- Dòng tướng co giãn theo bề rộng thẻ bằng container query: thẻ ≥ 480px giữ ba cột `vai trò | tên | chiến pháp + binh thư`, thẻ hẹp hơn (lưới gọn, tablet, mobile) xếp tên → chiến pháp → binh thư.
- Chuyển kiểu hiển thị thành ba nút `2 cột` / `4 cột` / `Bảng`: `4 cột` (`?view=luoi`) là lưới thẻ gọn, số cột theo bề rộng vùng kết quả (4 ở 1440px, 3 ở 1280px, 2 ở 1024px, 1 ở mobile); lựa chọn nhớ chung cho hai trang qua `tqccl.teamView.v1`, URL chỉ mang `view=luoi|bang`. Dưới 1280px nút chỉ còn icon.
- Bản dịch: 5 obligation `authored-vi` của nút chuyển kiểu hiển thị (`2 cột`, `4 cột`, `Bảng` + aria), policy `site-vi-260926-the-doi-luoi`, publish generation `1a4fd71a…` và re-pin `pipeline/team-route-handles.json`; probe `tokens.json` (`the-doi`, `dong-tuong`, `chuyen-the-bang`, `nut-chinh`) cập nhật theo thẻ mới.
- Dòng tướng: nhãn biến thể `40Y`/`SP`/`CO` đổi thành con dấu viền mảnh cùng màu chữ (nền trong suốt; CO dùng token mới `--khien-ink` để đạt ≥ 5,4:1) và luôn cùng hàng với tên tướng; ở thẻ rộng ô tên phủ mọi hàng nên tên nhiều dòng không còn đẩy dòng binh thư xuống. Chiến pháp thành chip son nhạt (mobile: vùng bấm 44px, chip nhìn thấy 30px), tên binh thư chuyển sang mực đậm `type.tag` để nổi hơn nhãn "Binh thư ·".
- Sidebar lọc `/doi-chuan/`, `/doi-khac/` gọn lại: hàng 36px thay cho 44px, nhóm ngăn bằng vạch mảnh, số đếm thành viên nhỏ canh phải, mục đang bật dùng dải nền nhạt + ô tích đặc thay cho cả hàng đen, `Xóa lọc` ẩn khi không có gì để xóa. Panel cao 572px → 438px ở `/doi-chuan/`. Mobile giữ chip 44px.
- Bỏ bộ chọn `Danh mục` ở `/doi-chuan/`, `/doi-khac/`: danh sách luôn gộp mọi danh mục nguồn; `?category=` cũ bị bỏ khỏi URL lúc tải trang và không lọc gì, link quay lại từ trang chi tiết chỉ còn `season`. Ô `Mùa nguồn` thành một khung gọn (nhãn nhỏ trên giá trị, mũi tên phải, cả khung là vùng bấm). Bản dịch: bỏ obligation `ui:recommended/category-label`, policy `site-vi-260926-bo-danh-muc`, publish generation `0ddbd034…` và re-pin `pipeline/team-route-handles.json`.
- Lưới `4 cột`: dòng binh thư xuống dòng hiện đủ tên thay cho cắt một dòng "…" (tên binh thư thứ ba trở đi trước đây không đọc được).
- Bỏ bộ chọn `Mùa` / `Phiên bản luật` và dòng "Tất cả — tham khảo" khỏi hai công cụ `/soi-doi/`, `/goi-y-doi/`: công cụ luôn đối chiếu/gợi ý trên dữ liệu đội cũ, bỏ ô "Xem đội ngoài phạm vi để tham khảo", thông báo phạm vi và ô "Thử nghiệm cấu hình chưa xếp hạng"; `?scenario=`, `?ruleset=`, `?config=` cũ bị bỏ khỏi URL lúc tải, link "Mở scan / nhập kho" trong chi tiết cấu hình trỏ `/goi-y-doi/`. Hai trang không còn nhận `#season-controls`/`#season-artifact-hashes`. Bản dịch: bỏ obligation `ui:analyze/outside-heading`, `ui:analyze/outside-note`, policy `site-vi-260926-bo-mua-cong-cu`, publish generation `f93a51ea…` và re-pin `pipeline/team-route-handles.json`.

## 2026-09-26 (Sổ binh pháp)

### Changed

- Redesign toàn site theo giao diện "Sổ binh pháp": Landing ở `/` và 8 trang mục tĩnh (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/chieu-mo/`, `/soi-doi/`, `/goi-y-doi/`) thay cho SPA một trang dùng hash; mọi hash/URL cũ được Landing chuyển tiếp qua `js/legacy-routes.js`, `?detail=`/`?legacyTeam=` vẫn mở đúng trang chi tiết.
- Shell dùng chung một lần (`SiteLayout`): header, menu thả, menu mobile toàn màn hình, footer; theme sáng/tối theo lựa chọn đã lưu hoặc hệ điều hành, chặn nháy bằng script inline trong `<head>`.
- Token hoá toàn bộ giao diện: `docs/design/so-binh-phap/tokens.json` là nguồn duy nhất cho màu/giá trị vi mô và danh mục component; khối CSS cũ ("legacy") đã xoá hết, `node scripts/design-tokens.mjs --check` báo 0 giá trị thô.
- Font self-host (Be Vietnam Pro + Noto Serif Display, subset latin/latin-ext/vietnamese) ở `public/fonts/`, phục vụ cùng `/css/styles.css` và `public/_headers`.
- Giao diện tối được rà trên DOM thật: sửa các cặp chữ/nền không đạt 4,5:1 của nút CTA header, nút CTA Landing, nhãn biến thể SP/CO và pill phe bằng token mới `--on-fill`/`--f-nguy-strong`; thêm token vai trò chữ cho nhãn biến thể, badge loại binh nhỏ và dòng phân loại phạm vi.
- Shell: nav ngang chỉ hiện từ 1280px (dưới mốc đó header dùng ☰), panel menu thả neo trong khung nhìn, footer dùng chung nằm ở đáy trang ngắn, trang 404 có lề trang như các trang khác.
- A11y/responsive: control ≥ 44px trên mobile, không cuộn ngang ở 320/390/768/1440, focus-visible rõ, menu thả/hộp thoại có `aria-expanded`/Escape/focus trả về, ô chọn ảnh native của Gợi ý đội có tên truy cập được (`aria-labelledby`), Turnstile 300px nằm trong khung cuộn ở bề rộng hẹp.
- Tài liệu mô tả đúng mô hình mới: `design-guidelines`, `code-standards`, `system-architecture`, `deployment-guide`, `unified-lookup`, `README`.
- Vòng sửa nit của redesign: trạng thái "đang chọn" và nút chính ở theme tối dùng họ token mới `--select*`/`--f-*-select` (nền chọn `#EDE6D8` + chữ `#16140F`) thay vì mượn màu dải header — nền chọn đạt 14,82:1 với nền trang và 13,53:1 với chip chưa chọn (WCAG 1.4.11 ≥ 3:1); theme sáng giữ nguyên giá trị cũ nên không đổi pixel.
- Đổi Mùa ở Soi đội / Gợi ý đội nay gọi `turnstile.reset` khi bỏ token nên widget cấp token mới thay vì khoá nút tới lúc hết hạn; `?view=the` (mặc định) bị bỏ khỏi URL bằng `replaceState`; Escape đóng panel lọc mobile và trả focus về nút; hộp thoại hồ sơ chừa lề hai bên ở 821–1279px.
- Sửa `activationRate` sai đơn vị của `tactic:thien-uy-khieu-tran` (50 → 0,5) ngay tại bước nhận giá trị trong pipeline, kèm bảng hiệu chỉnh có lý do, ledger disposition `corrected-public` và kiểm khoảng 0–1 cho mọi tỷ lệ kích hoạt; mã trích dẫn `(Bahamut bsn=…)` chỉ bị ẩn ở lớp hiển thị, dữ liệu và ledger giữ nguyên.
- Sửa lỗi bố cục mobile: `--space-38` chưa từng được khai làm hàng tướng trên thẻ mất cột nhãn (nay là token `size.col-hero-role` 38px); bảng xem trước của Landing ở bề rộng hẹp xếp dọc nên cột điểm không còn phải cuộn ngang; dấu `·` của dòng phụ thẻ Tra cứu không còn mồ côi ở đầu dòng khi xuống hàng; nguồn gốc mã QR (lệnh sinh + phiên bản `qrcode@1.5.4`) nay nằm trong comment của chính `<svg>` nên có trong `dist/index.html`.
- Sửa theo audit ảnh ghép với artboard "Sổ binh pháp": header trang trong đặt nav sát thương hiệu, panel/footer "Tra cứu" bỏ dòng lặp (tiêu đề là link), footer mobile có pill cộng đồng + phụ đề nhà phát hành, Landing đổi bố cục "Hai kho đội" + thanh bảng dải tối + thẻ xem trước gọn theo artboard; chip lọc Đội chuẩn/Khai hoang xếp theo số đội giảm dần, nút "Chi tiết" luôn ở mép phải, bảng Đội chuẩn đúng bề rộng cột và cột Điểm căn phải; Tra cứu tách dòng vai trò, sửa khoảng cách ô tìm, ô chân dung mobile 96px, thang chỉ số /120, hồ sơ không che nav; Khai hoang mỗi tướng một hàng `tên | Trước → Sau` (mobile 3 dòng) và trang chi tiết chọn cấu hình bằng chip; Cùng Tồn tách pill cấp đội/tag tướng, mobile chọn nhóm bằng hàng số và gập ô tổng quan; Chiêu mộ/Soi đội/Gợi ý đội bỏ chữ lặp và thẻ rỗng, ô lượt 1 cột trên mobile; `color-scheme` theo theme. Lệch giữ có lý do ghi ở mục "Audit 260926" của từng báo cáo `visual-phase-0N.md`.

## 2026-08-25

### Changed

- Retire 48 team Đô Úy khỏi artifact công khai, tab/hash/module website và toàn bộ kết quả Research MCP; website còn 9 section và dữ liệu public còn 166 team (56 Team PK, 110 Meta phe cũ) cùng 31 tier row.
- Giữ `pipeline/do-uy-ss18-source.json` làm archive nguồn thô, loại `Team Đô Úy.html` khỏi pipeline build và thêm lớp lọc MCP để snapshot cũ không tái công khai source `do-uy`.

## 2026-08-01

### Changed

- Research MCP đóng code, canonical manifest và sáu data artifact trong cùng một private Worker Static Assets version; CLI/stdio vẫn đọc filesystem và tám tool không đổi.
- Release production chuyển sang manual exact-SHA Worker Versions: candidate `0%` được xác minh bằng Version Override trước khi promote duy nhất `100%`, với reconciliation response mơ hồ và ownership-safe rollback.
- Bỏ runtime/release/control-plane R2, AWS SDK và npm release path; giữ edge rate control, managed bearer và denylist credential cũ.

## 2026-07-11

### Fixed

- Sửa mapping chính thức `Nhanh Trí Động Não`: `灵机一动`, Chủ động 30%→55%, chỉ Kỵ/Khí giới, tăng Trí–Thống–Mị theo ảnh client Việt; trả `才辩机捷` về tên fallback `Tài Biện Cơ Tiệp`.
- Bỏ alias OCR `灵机 → 临机` để ảnh không còn bị map nhầm sang `Thời Cơ Chiến Thắng`; bổ sung test hồi quy pipeline, artifact và OCR.

## 2026-07-03

### Added

- Team PK thêm 3 đội SP Quan Vũ theo meta PK-S26: Pháp Quan Lưu Bị, Pháp Quan Mã Đại, Quan Quân Thương; gắn tier T0 cho 3 đội mới và Quan Tinh Khiên hiện có.
- Team PK thêm 2 đội SP Lô Trực mùa `Anh Hùng Mệnh Thế`: Thái Sư Cung (T0) và Cự Mã Cung (T0.5).
- Team PK bổ sung nickname/tên gọi meta cho 33 đội, ví dụ Hoàng Mã Thương, Vinh Quang Thương, Hoàng Quan Thương, Kỳ Lân Cung, Thái Úy Khiên.
- Team PK bổ sung và verify tier PK-S26 `Anh Hùng Mệnh Thế` từ Zeabur; sau rà lại có 30/55 đội có badge tier và 19 đội T0 chắc hơn, bỏ T0 của Vinh Quang Thương và hạ Đô Đốc Cung bản Lỗ Túc về T0.5.

## 2026-06-26

### Added

- Tab `Đô Úy (ss18)`: tách team `do-uy` (37 team) khỏi Team PK, filter bar inline (loại binh / phe / tier / khuyến nghị), badge khuyến nghị, gán quốc gia, sắp xếp tier T0→T1.
- Section `Tra cứu tướng`: 112 tướng, chip lọc (thích tính binh chủng / vai trò / phe / sao) + search fuzzy (Việt bỏ dấu / Hán-Việt / Hán), modal chi tiết tướng (`js/hero-list.js`, `js/hero-detail.js`).
- Engine tier theo team: `pipeline/team-tier-map.json` → `data/team-tier.json` (`build_team_tier`), badge hiện bậc tốt nhất + tooltip multi-source; `suggest_team_tier` parse offline gợi ý curate đầu mùa.
- Từ điển binh thư Hán→Việt (`data/books-dict.json` qua `build_books_dict`).

### Changed

- Team PK render team-intro; Meta phe cũ render moi-phe; team `do-uy` ẩn khỏi Team PK.
- Mobile: hamburger menu section (`js/mobile-section-menu.js`) + drawer bộ lọc Team PK (`js/mobile-filter-drawer.js`).

## 2026-06-23

### Changed

- Giữ mô tả/mục tiêu tiếng Trung trong `effect`/`target`, bổ sung `effectViet`/`targetViet` cho 6 chiến pháp đã dịch.
- Thẻ tra cứu chiến pháp hiển thị tiếng Việt trước và nguyên văn tiếng Trung sau; record chưa dịch vẫn hiển thị tiếng Trung.
- Pipeline áp bản dịch thủ công từ `tactic-name-overrides.json`, tránh mất dữ liệu song ngữ khi rebuild.

### Fixed

- Đưa menu trang mobile vào nút hamburger góc trái header, bỏ logo kiếm, và tách `Bộ lọc` Team PK thành action riêng; drawer lọc có nút đóng, nút `Tìm / Xem kết quả`, overlay/Escape để thoát, và focus/accessibility state rõ hơn.
- Đồng bộ tên và mô tả tiếng Việt theo ảnh game cho `Đánh Đâu Thắng Đó`, `Khắc Địch Chế Thắng`, `Hợp Quân Tụ Chúng`, `Thịnh Khí Linh Địch`, `Phá Trận Thôi Kiên`, `Đánh Bại Quân Địch`.
- Tách đúng `Khắc Địch Chế Thắng` (`克敌制胜`) và `Đánh Bại Quân Địch` (`折冲御侮`) thành hai chiến pháp riêng.
- Thêm test hồi quy cho nội dung 6 chiến pháp và tham chiếu `Đánh Bại Quân Địch` trong artifact JSON.
