# Kiến trúc hệ thống

## Tổng quan

Hệ thống có bốn boundary triển khai: pipeline dữ liệu chạy local, Astro static build tạo artifact Pages, Vision Worker tùy chọn và Research MCP read-only. Browser đọc JSON đã commit; không gọi pipeline và không có backend/database chung.

```text
DATA BUILD (local)                 SITE BUILD (local)               STATIC RUNTIME (Pages)
HTML export + curate maps         src/pages/index.astro             dist/index.html
raw crawl cache (tùy có)          root js|css|data                   dist/js|css|data
          │                              │                                │
          ▼                              ▼                                ├── fetch data/*.json
pipeline Python stdlib ───────► committed JSON ── Astro static ───────────┤
          │                              │                                ├── localStorage
          └── review diff                └── public/_headers ─► dist       └── local recommendation

OPTIONAL EXTERNAL VISION PATH
Browser image + Turnstile ──POST /analyze──► Cloudflare Worker
                                             │ guards + best-effort KV
                                             ▼
                        nhà cung cấp AI OpenAI-compatible (KV ai:config, chuỗi failover của nhóm ứng với mode)
                                             │ structured Chinese JSON
                                             ▼
Browser canonical mapping + local matching/recommendation

RESEARCH MCP PATH
managed client ──Bearer + Streamable HTTP──► Cloudflare Worker + private Static Assets
local MCP client ───────────stdio──────────► filesystem snapshot
                                     cả hai ──► cùng 7 schema/handler read-only
```

`mcp-worker/` là boundary nghiên cứu riêng, không nằm trong browser/Vision flow. Package có snapshot dữ liệu read-only, JSON CLI, stdio MCP và Cloudflare Streamable HTTP dùng chung registry/handler.

## Build-time data flow

1. HTML export trong `Meta Team PK/` được parser grid/team/Cùng Tồn/khai hoang đọc.
2. `normalize.py` sửa chữ nguồn (bỏ dấu thanh kết hợp thừa, NFC), áp aliases, nickname theo nguồn và chuẩn hóa team.
3. `build_json.py` nối Team PK curate `pipeline/team-intro-supplement.json`, ghi đè `teams.json`, `facets.json` (trùng byte bản commit; `--check` chỉ so); `coexist.json`, `khaihoang.json` chỉ khi có `--overwrite-curated`; giữ ID đội đã commit và dừng nếu một ID công khai sẽ mất ([cảnh báo rebuild](deployment-guide.md#cảnh-báo-bắt-buộc)).
4. Từ điển tướng/chiến pháp (`heroes-dict.json`, `tactics.json`) do Tra cứu thống nhất sở hữu: `build_unified_lookup.py` dựng candidate, `promote_unified_lookup.py` kích hoạt ([unified-lookup.md](unified-lookup.md)); legacy builder không ghi hai file này. Tướng chụp từ client Global (Minh Giám 24.526) vào `pipeline/lookup-client-heroes.json` là input capture có hash của builder, kèm chân dung tự lưu `public/heroes/*.webp` (`portraitUrl` nhận `/heroes/<slug>.webp`, verifier dist khóa thư mục, `_headers` có rule `/heroes/*`). Chiến pháp chụp từ client (mục Chiến Pháp: Toàn bộ, Kế thừa, Sự kiện; và Thượng Thư Đài) vào `pipeline/lookup-client-tactics.json` là input capture thứ hai, áp trước tướng client và thay chữ/số liệu tiếng Việt build ra.
5. `build_books_dict.py` validate map binh thư curate với facet; dòng `outsideTeams` (sách không đội nào dùng) phải nằm ngoài facet; hiệu ứng phải đủ chữ Hán nguồn, bản dịch đã duyệt và mốc số liệu. `sourceNames` là khóa nối ô Đội chuẩn có tên Hán nguồn với hồ sơ (`createLookupIdResolver` trong `js/lookup-ids.js`); ô chỉ có tên Việt mới tra theo slug.
6. `build_team_tier.py` join bảng tier curate vào team ID.
7. Maintainer review diff và chạy test trước khi publish artifact.

Đường Tra cứu thống nhất tách khỏi legacy builder. `build_unified_lookup.py` đọc
baseline bất biến, snapshot SGSDeck đã checksum, registry danh tính và bản dịch
đã review từ một lần capture bytes; nó chỉ tạo candidate private. Promotion qua
`promote_unified_lookup.py` giữ shared lock và durable journal để thay bốn file
generation công khai có thể recover. Xem [quy trình vận hành](unified-lookup.md).

### Publication hiển thị tiếng Việt

`pipeline/site_localization.py` capture nguồn Recommended bất biến, kiểm ledger cùng receipt review, rồi dựng candidate private. Candidate đầy đủ chứa generation Recommended, `site-display.json` và một candidate Lookup được `build_unified_lookup.py` dựng/kiểm lại. Manifest site bind hash input, pin Recommended, generation cùng hash public Lookup và các source JSON hiển thị; publish chỉ thay generation Recommended với `data/website-display.json`, đồng thời từ chối nếu bốn file Lookup công khai không trùng candidate đã review.

`textRaw` và identity nguồn không bị sửa. `textVi` chỉ đi vào projection hiển thị sau review; dữ liệu root dùng overlay theo exact entity/field path. `npm run build` và `npm run verify` chạy gate public fail-closed trước khi tạo hoặc chấp nhận `dist/`.

Đường build cố ý không đưa `Team Đô Úy.html` vào artifact. 6 Team PK không có trong HTML nằm ở `pipeline/team-intro-supplement.json` (bản ghi đã chuẩn hóa, curate), nên từ HTML hiện có `teams.json`/`facets.json` tái tạo trùng byte. `pipeline/do-uy-ss18-source.json` giữ nguồn Đô Úy thô làm archive, không phải input publication. HTML/cache còn bị ignore và `coexist.json`/`khaihoang.json` curate vượt HTML. Vì vậy pipeline là công cụ bảo trì có điều kiện, chưa phải clean-clone reproducible build; quy trình an toàn thuộc [cảnh báo rebuild](deployment-guide.md).

### Dữ liệu đội theo kịch bản

[Builder sidecar](../pipeline/build_season_data.py) sở hữu đường build độc lập từ
nguồn curate `pipeline/season-*.json`. Việc xác nhận kịch bản không đồng nghĩa
với xác nhận luật VN; dữ liệu chỉ có attribution vẫn là tham khảo. `scenarioId`
giữ identity kịch bản qua các lần mở lại, còn `rulesetId` phân biệt bộ luật.
Không suy hai identity này từ số mùa hoặc ngày của nguồn nước ngoài.

[Resolver dùng chung](../js/season-context.js) sở hữu scope, cấu hình, tier và
điểm gắn với lựa chọn; [engine](../js/team-recommend-engine.js) sở hữu đối chiếu
tài nguyên và portfolio. `teamId` giữ identity đội, `configId` phân biệt cấu
hình để nhiều cấu hình cùng đội không trở thành nhiều đội trong portfolio.
Raw Cùng Tồn chỉ cung cấp nội dung tham khảo; dữ liệu nguồn chưa review không
tự trở thành cấu hình có thể gợi ý. Khai hoang tiếp tục dùng bản bảo trì mới
nhất, ngoài phạm vi sidecar mùa.

Xem [bảo trì dữ liệu đội theo kịch bản](season-team-data.md) cho đường cập nhật,
nguồn Recommended, điều kiện promote và kiểm chứng. Danh sách public artifact
thuộc [manifest của site](../src/lib/public-artifact-manifest.mjs).

## Static runtime

[`src/pages/index.astro`](../src/pages/index.astro) là Landing; tám trang mục tĩnh (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/theo-doi-chieu-mo/`, `/soi-doi-tu-anh/`, `/goi-y-doi-tu-kho/`) dùng chung `src/layouts/SiteLayout.astro`, mỗi trang một mount `#section-<id>` và `data-page-section` trên `<body>`. Tra cứu tách thành 7 trang nhóm `/tra-cuu/<slug>/` (`data-lookup-group` trên `<body>`) cộng trang mục lục tĩnh `/tra-cuu/` không nạp app, và mỗi mục có trang riêng `/tra-cuu/<nhóm>/<slug>/` (xem [nội dung dựng sẵn](#nội-dung-dựng-sẵn-lúc-build)). Layout phát pin Recommended, pin website-display, bảng route handle và hash dữ liệu mùa cho đúng trang cần (bảng ở [chuẩn code](code-standards.md)).
[`js/app.js`](../js/app.js) sở hữu khởi tạo runtime; nó capture từng response byte
một lần qua `createByteLoader()`, xác minh sidecar cùng hash của đúng các nguồn trang
đang dùng (băm song song, bảng nguồn theo trang ở [chuẩn code](code-standards.md))
rồi mới áp overlay tiếng Việt; `localizeData` từ chối nguồn chưa được xác minh.
Kho Tra cứu, `team-tier.json` và mô hình mùa chỉ tải ở trang dùng chúng và tải song song.
[`season-ui-state.js`](../js/season-ui-state.js) sở hữu query và kiểm hash toàn bộ
dữ liệu tham chiếu trước activation. [`lookup-data.js`](../js/lookup-data.js)
kiểm inventory/hash/generation của ba payload Tra cứu: trọn bộ (kèm tham chiếu chéo) cho
công cụ, build và dist verifier; từng payload theo manifest cho trang nhóm Tra cứu. Thay đổi ở bất kỳ
dependency đã được website-display pin đều dừng toàn bộ khởi tạo; lỗi semantic
Lookup trong một publication byte-coherent mới chỉ khóa các feature phụ thuộc.

Scope, filter/search, thứ tự hiển thị và chi tiết cấu hình cùng đi qua query owner của đúng trang; mục đang mở do đường dẫn quyết định, hash cũ chỉ được Landing chuyển tiếp qua `js/legacy-routes.js`. Restore scenario-only không tự nâng sang luật đã
review. Hai công cụ Soi đội và Gợi ý đội không có phạm vi mùa của layout và bỏ `scenario`/`ruleset`/`config` khỏi URL khi tải; cả hai tự có ô chọn mùa của generation Đội chuẩn đang pin (`season`, mặc định `defaultSourceSeasonId`), tải lười qua `loadRecommended()`. Soi đội đối chiếu với `index.json` lọc theo mùa và `other-teams.json` (Đội khác · tham khảo). Gợi ý đội dựng ứng viên từ `index.json` của mùa (`js/roster-season-candidates.js`: tên gốc chữ Hán → tên Việt của từ điển Tra cứu, chỉ cấu hình Giao chiến, ô chiến pháp trống/không nhận diện được coi là có điều kiện), chạy engine trên đội mùa trước rồi mới lấp bằng `teams.json` (seed tài nguyên đã chọn, bỏ đội cũ trùng bộ tướng); món bù người dùng chọn lưu trong kho (`tacticOverrides`) và vào engine như biến thể của đúng ô. Nút "Vì sao?" gọi Worker mode `explainSubstitute` (không ảnh, qua Turnstile + rate-limit), frontend bỏ lời giải thích nhắc tới chiến pháp khác ngoài hai món được hỏi. UI không dùng MCP để suy thêm luật.

Hồ sơ tướng của Tra cứu đọc thêm artifact tính lúc build `hero-summaries.json` sinh trong chính generation Recommended đang pin (khóa nối chính xác theo từng nguồn, descriptor mang hash kho Tra cứu), nên mở hồ sơ chỉ cần `manifest.json` + `hero-summaries.json` thay vì nạp toàn bộ kho đội chuẩn. Hồ sơ chiến pháp dùng cùng cơ chế với `tactic-summaries.json` (`pipeline/tactic_summaries.py`, loader `js/tactic-summaries.js`): số đội theo vị trí, tướng mang, chiến pháp đi cùng trong đội và đội tiêu biểu, trả ID để trang tự lấy tên theo ngôn ngữ; provenance mang hash của cả `tactics.json` lẫn `heroes-dict.json`. Phạm vi và ngân sách tải của đường này ghi ở [quyết định #12 của plan redesign](../plans/260923-1949-so-binh-phap-redesign/plan.md).

Hai trang danh sách đội đều gọi `createRecommendedSection()` của `team-filter-section.js`; cùng module còn dựng mục Cùng Tồn (`createSeasonCoexistSection()`: ô chọn Mùa của Đội chuẩn, hàng phiên bản `Cùng tồn 1–5`). Module này tính facet trực tiếp từ tập source, tạo search/chip, thu gọn bộ lọc trên mobile; thẻ và bảng đội do `recommended-reference-render.js` dựng (kể cả thẻ Cùng Tồn `coexistTeamCard`, cùng vỏ thẻ Đội chuẩn). `data/facets.json` không được load runtime.

Tra cứu và gợi ý cốt lõi chạy local:

- `lookup-data.js`: `loadLookupBundle` nạp trọn bốn file đã xác minh cho công cụ (không nhận partial/mixed generation); `createLookupPayloadLoader` nạp từng payload theo nhu cầu cho trang nhóm Tra cứu, mỗi payload kiểm digest trong manifest đã pin và `generationId`.
- `unified-lookup.js`: corpus theo payload đã tải, tìm trong một nhóm, view thẻ/hàng bảng và cây markup (`view-tree.js`) dùng chung cho HTML dựng lúc build (`src/lib/lookup-pages.ts`, đủ mọi mục của nhóm) và DOM; `lookup-page.js` gắn vào khung dựng sẵn (tìm, "Xem thêm", hồ sơ `?id=`, lịch sử); `lookup-profile.js` dựng hồ sơ tướng/chiến pháp/binh thư bằng cây view (`createProfileRenderer` → `renderProfile` cho hộp thoại, `profilePageTree` cho trang riêng); `lookup-master.js` dựng bộ lọc, danh sách và panel chi tiết của bốn nhóm catalog (Trang bị, Quân sư, Cải tạo binh chủng, Công trình) bằng cây view, và trang nhóm nhúng sẵn tướng liên quan (`#lookup-owner-heroes`) nên hai trang Trang bị/Quân sư không tải `heroes-dict`; `lookup-detail.js` dựng hồ sơ và quan hệ theo ID (binh thư dùng mã từ `lookup-ids.js`); không suy team/tier/availability từ catalog.
- `match-dict.js`: match Việt bỏ dấu/Hán-Việt/Hán.
- `hero-identity.js`: SP, CO và bản thường có canonical ID riêng; `familyId` chỉ biểu diễn quan hệ cùng họ, không thay thế identity khi xét sở hữu. Mỗi combined slot là một tập alternatives và chỉ cần đúng một alternative để thỏa slot.
- `filters.js`: chuẩn hoá chữ bỏ dấu (`normalizeText`) và blob tìm kiếm của một đội (`teamSearchBlob`), dùng chung giữa website và MCP.
- `team-recommend-engine.js`: xét ownership, conflict tướng/chiến pháp, alternatives, tier/red stars và portfolio tối đa 5 team.
- `coexist.json` và source-owned Cùng Tồn chỉ render tham khảo; recommender dùng dữ liệu legacy khi không có context hoặc cấu hình từ shared projector khi có cặp luật hợp lệ, không parse display string Cùng Tồn.

### Nội dung dựng sẵn lúc build

Trang đội và Tra cứu phải đọc được khi không chạy JavaScript (crawler, AI agent, máy chậm), nên nội dung chính nằm trong HTML tĩnh. Builder trả **cây view** (`h` của [`js/view-tree.js`](../js/view-tree.js), `t` của `js/render.js`) thay vì DOM: build gọi `treeToHtml`, trình duyệt gọi `treeToDom` rồi mới gắn sự kiện. Nhờ vậy chỉ có một định nghĩa markup; `.astro` không viết markup song song và build không dùng shim DOM. Builder nhận `locale` tường minh (`withLocale` của `js/i18n.js`) vì build dựng vi và zh trong cùng tiến trình. Đây vẫn là static build, không có SSR lúc chạy.

- **Trang đội.** [`src/lib/team-ssr.ts`](../src/lib/team-ssr.ts) nạp publication đã pin, áp bản dịch bằng chính `loadWebsiteDisplay`/`localizeData` của trình duyệt, đăng ký bảng route handle rồi dựng thân trang chi tiết Đội chuẩn/Đội khác/Khai hoang (`#team-detail-body[data-prerendered]`). [`src/lib/team-section-ssr.js`](../src/lib/team-section-ssr.js) dựng trạng thái mặc định của bốn trang danh sách bằng cùng hàm chọn mặc định với client: Đội chuẩn/Đội khác là `PAGE_SIZE` đội đầu của mùa mặc định, Cùng Tồn là nhóm đầu của mùa mới nhất, Khai hoang là cả trang. Sidebar lọc, ô chọn mùa và "Xem thêm" vẫn do client dựng.
- **Quy tắc nhận lại DOM.** Mount của trang danh sách mang `data-ssr-source` (sha256 publication), khối nội dung mang `data-ssr-signature` (trạng thái đầu: mùa, bộ lọc, kiểu hiển thị, số đội, nguồn quay lại). `js/app.js` chỉ cho nhận lại khi `data-ssr-source` khớp pin mà trang đã xác minh; section chỉ giữ node khi chữ ký khớp trạng thái đầu của client, lệch (URL khác, kiểu xem đã lưu khác) thì dựng lại như cũ. Nút cần sự kiện (chip chiến pháp, chip cấu hình/loại binh Khai hoang) ra HTML ở trạng thái `disabled` (`disableButtons`) và chỉ bật (`enableControl`) khi đã gắn sự kiện. Trang chi tiết mặc định không tải dữ liệu: `js/team-detail.js` chỉ nhận lại thân; `?variant=` (Đội khác, Khai hoang) ẩn thân dựng sẵn bằng script inline rồi tải, xác minh, dựng biến thể như trước; Khai hoang còn tải khi người đọc bấm chip cấu hình lần đầu.
- **Trạng thái đầu khác mặc định.** Thân dựng sẵn của trang danh sách luôn là trạng thái mặc định, còn `js/app.js` chỉ so chữ ký sau khi tải xong dữ liệu. Để danh sách sai mùa/bộ lọc không hiện (và không bấm được) suốt lúc tải, script inline ngay sau mount (`ssrStaleGuardScript` trong `src/lib/team-section-ssr.js`) gắn `data-ssr-stale` khi URL có khóa `SECTION_QUERY_KEYS` của trang, kiểu xem đã lưu là Thẻ gọn/Bảng, hoặc (Khai hoang) snapshot quay lại cùng trang có lựa chọn cấu hình; CSS ẩn `.reference-view`/`.coexist-group-view` (giữ chỗ), `js/app.js` gỡ dấu sau lần dựng + khôi phục đầu tiên, hoặc khi boot lỗi. Không có JavaScript thì script không chạy nên không ẩn gì. Trang chi tiết Khai hoang: lần bấm chip cấu hình đầu tải dữ liệu rồi dựng theo `variant` của URL lúc tải xong (lần bấm sau cùng thắng); tải lỗi thì giữ thân dựng sẵn, URL về mặc định, chỉ báo lỗi ở dòng trạng thái.
- **Tra cứu.** [`src/lib/lookup-pages.ts`](../src/lib/lookup-pages.ts) dựng **mọi** mục của trang nhóm; mục sau trang đầu mang `data-lookup-later` và CSS chỉ ẩn chúng khi `<html data-lookup-js>` (script trong head của trang nhóm), nên không JavaScript thì thấy đủ, có JavaScript thì hiển thị như trước. [`src/lib/lookup-item-pages.ts`](../src/lib/lookup-item-pages.ts) dựng trang riêng từ `profilePageTree` hoặc `masterDetailTree(…, {page: true})`, cùng cây với hộp thoại/panel. Trang riêng không nạp `app.js` và không tải dữ liệu; `js/lookup-item-page.js` chỉ gắn chân dung và nút phiên bản hiệu ứng. Mọi phiên bản hiệu ứng có sẵn trong HTML, mỗi panel mở bằng nhãn phiên bản của nó (nên `treeToText`/llms gắn nhãn với đúng đoạn); trang riêng cũng đặt `<html data-lookup-js>` trong head: có JavaScript thì bản cũ `hidden` và nhãn nhường cho nút, không JavaScript thì CSS hiện mọi bản kèm nhãn và ẩn nút.
- **Slug trang riêng đóng băng.** `pipeline/lookup-route-handles.json` (CLI [`pipeline/lookup_route_handles.py`](../pipeline/lookup_route_handles.py), loader [`src/lib/lookup-detail-routes.ts`](../src/lib/lookup-detail-routes.ts)) gán slug một lần theo mã, như ledger handle đội: đổi tên Việt không đổi URL (id binh thư ghi cố định trong `pipeline/books-han-viet-map.json`, không suy từ tên Việt, nên đổi tên Việt không đổi id), mã rời corpus chuyển sang `retired` và vẫn giữ chỗ slug. Build từ chối ledger lệch generation Tra cứu, hash `books-dict` hoặc tập mã. Trình duyệt suy slug từ hậu tố mã (`lookupDerivedSlug`), nên chỉ ngoại lệ của ledger được nhúng (`#lookup-route-handles`) để link dựng ở client trùng HTML. `lookupHref` (`js/lookup-ids.js`) trả trang riêng; mã không có trang riêng (đặc kỹ trang bị) lùi về `?id=`. Link chiến pháp/binh thư của trang đội dùng `lookupItemPath`. Trên trang nhóm, click thường vẫn mở hộp thoại/panel bằng `?id=`, và link `?id=` cũ vẫn mở được.
- **JSON-LD.** [`src/lib/structured-data.ts`](../src/lib/structured-data.ts): trang chi tiết đội `WebPage`, trang nhóm `CollectionPage` + `ItemList`, trang riêng `ItemPage` (mang `url`, `inLanguage`, `isPartOf` `VideoGame` — các thuộc tính chỉ hợp lệ trên `CreativeWork`) với `mainEntity` là `Thing`/`DefinedTerm` (`name`, `alternateName`, `description`, `image`, `inDefinedTermSet`), đều kèm `BreadcrumbList`. Hàm chỉ nhận chữ đã có trong HTML của trang nên JSON-LD không mô tả thứ người đọc không thấy.
- **llms.** [`src/lib/llms-documents.ts`](../src/lib/llms-documents.ts) là hàm sinh duy nhất của `/llms/*.txt` (Đội chuẩn tách theo mùa khi vượt `LLMS_SPLIT_BYTES`, các mùa/file theo thứ tự registry mùa `seasons.json`, Đội khác, Cùng Tồn, Khai hoang, 7 nhóm Tra cứu) và `/llms-full.txt` (nối các file con theo thứ tự cố định). Nội dung là `treeToText` của đúng cây mà trang HTML dựng từ, mỗi mục mở bằng link trang riêng. `/llms.txt` (`llmsDocument` trong `src/lib/blog-seo.ts`), các route và allowlist của dist verifier đều lấy danh sách file từ hàm này.

### Hợp đồng dữ liệu khai hoang

Trong [`data/khaihoang.json`](../data/khaihoang.json), `chamSuTeams` là trường top-level bổ sung cho bảng nguồn “Team Chạm Sứ------mang 1 lính”, độc lập với đội khai hoang chính. Bỏ `teams[].transforms` để sửa liên kết sai do trước đây ghép hai bảng theo hàng: consumer đọc trường cũ cần chuyển sang danh sách độc lập, không coi đây là phương án chuyển hình của từng đội. Mỗi nhóm giữ `id`, `title`, `heroes: [{name, tactic}]`, `note` và `sources: [{label, url}]`; ghi chú tướng thay thế thuộc cả nhóm khi ô nguồn phủ nhiều tướng. Không suy diễn tướng thứ ba, chủ tướng, binh chủng, tier hoặc cơ chế từ nhãn “mang 1 lính”.

Hướng dẫn khai hoang curate thuộc tùy chọn `teams[].guide`, sở hữu bởi đúng bộ ba tướng và không thuộc `variants[]`. Guide có thể chứa tổng quan, điểm mở đất/chuyển đội, yêu cầu đỏ, thứ tự quân thủ đất 4/5, cảnh báo, tách đội và các bước chuyển hình. Thẻ tại `/khai-hoang/` dùng khung thẻ Đội chuẩn (`.reference-team-card`) và chỉ dựng tên đội, loại binh, ấn điểm tổng `guide.ratings.overall`, hàng phiên bản và dòng tướng `tên | Trước · … → Sau · …` cùng anchor thật; ghi chú (`buildNote`/`openingNote`), thanh điểm 6 mốc và guide chỉ nằm trên `/khai-hoang/<handle>/`. Thân trang chi tiết là `khaihoangDetailTrees` (`js/render.js`): đội hình bằng thẻ tướng `detail-hero-card` của Đội chuẩn (`khaihoangBuildContent`), điểm và guide nằm ngoài subtree thay thế khi đổi phiên bản; build dựng cấu hình mặc định, `js/khaihoang-detail.js` nhận lại và chỉ xác minh pin nguồn/publication khi phải dựng cấu hình khác. `buildNote`/`openingNote` giữ owner team/hero/variant gốc; không ghép note của default vào variant. UI Khai hoang không trình bày mùa, khu vực, lưu ý nguồn hoặc link nguồn (kể cả `sources` của Chạm Sứ và panel chi tiết).

Owner danh sách là `khaihoangTableTree` (cây, dùng cho build) và [`khaihoangTable` trong `js/render.js`](../js/render.js) (nhận lại hoặc dựng DOM rồi gắn sự kiện): nút nhảy trong trang (`#de-xuat`, `#cham-su`, `#mo`, kèm số mục), lọc loại binh, đếm đội và lưới thẻ 1/2 cột (thẻ cùng hàng cao bằng nhau), rồi tham khảo chung của cả mục (`khaihoangReference`): **Đội Chạm Sứ / Ăn vạ** (`chamSuTeams`) → quân thủ mỏ (`mines`, bảng desktop/thẻ mobile). Hai khối này không thuộc đội nào nên không theo bộ lọc loại binh và không lặp lại trên trang chi tiết; khối không có dữ liệu bị bỏ cùng nút nhảy của nó, payload mảng mỏ legacy cho danh sách rỗng. Đích nhảy đã có trong HTML dựng sẵn; `js/app.js` vẫn cuộn tới phần tử của `location.hash` sau khi mount. Trang chi tiết xếp khối theo thứ tự đội hình + ghi chú → điểm đánh giá → hướng dẫn. Kiểm chứng nằm ở [`tests-e2e/khaihoang-options.spec.mjs`](../tests-e2e/khaihoang-options.spec.mjs).
Handle Khai hoang đóng băng theo `teams[].id` trong `pipeline/team-route-handles.json` (ledger v2, Recommended publication vẫn v1); trang detail canonical theo pathname. `variant` chỉ hiện cho cấu hình khác mặc định và `from` chỉ được nhận khi trỏ tới pathname trang mục có trong allowlist `SECTION_QUERY_KEYS`, giữ đúng khóa của pathname đó (URL gốc cũ dạng `/?…#<tab>` được chuẩn hoá trước khi so). Root dùng `khTeam`/`khVariant` và map `khaihoangVariants` trong snapshot history/session hiện có; context key Khai hoang bỏ đúng hai query này để phục hồi các card khác, còn Team chuẩn/Team khác vẫn so URL chính xác. Source hash `data/khaihoang.json` và bản dịch `data/website-display.json` phải khớp trước khi dựng nội dung.

JSON đã curate là dữ liệu runtime cần bảo toàn. [`build_khaihoang_payload` trong `pipeline/build_json.py`](../pipeline/build_json.py) chỉ phản ánh HTML đầu vào: HTML cũ có sáu nhóm Chạm Sứ, còn bản CSV được đối chiếu có tám nhóm và một chiến pháp đã đổi. CSV chưa phải input tự động của pipeline HTML; không chạy full rebuild để nhập phần này vì có thể mất đội bổ sung, variants/options, mùa và mỏ đã curate. [Báo cáo đối chiếu nguồn](../plans/260907-0236-cham-su-khai-hoang/reports/source-reconciliation.md) giữ chi tiết khác biệt và bằng chứng bảo toàn; [fixture parser](../tests/fixtures/khaihoang-cham-su-source.html) giữ boundary kiểm thử không phụ thuộc HTML local bị ignore.

### Cộng đồng phía trình duyệt

Mọi lời gọi cộng đồng đi same-origin `/api/*` qua [`js/community-api.js`](../js/community-api.js): lỗi server (`{error:{code,message}}`) luôn đổi sang câu song ngữ theo mã, không hiện nguyên văn; 5xx, lỗi mạng hoặc phản hồi không phải JSON là "không khả dụng" và chỉ khối cộng đồng đổi thành một lời nhắn ngắn. Ảnh chiến báo/ảnh bìa được thu nhỏ ≤ 1600px JPEG 0.82 trước khi tải lên.

- Header mọi trang có `#community-auth` ([`js/community-auth.js`](../js/community-auth.js)): chỉ hỏi `/api/me` khi `localStorage['tqccl:community-session']` cho biết trình duyệt từng đăng nhập (khách vãng lai không tốn lượt gọi API); trang cộng đồng luôn hỏi phiên và phát sự kiện `community:session` để header cập nhật. Menu tài khoản dùng `createDropdownMenu` của `js/site-nav.js`.
- Ba họ trang chi tiết đội có `<section id="community-root">` sau bài chi tiết, dựng bởi [`js/community-page.js`](../js/community-page.js) với `pageKey = stripLocale(pathname)`: "Chiến báo thực chiến" (số trận, tỉ lệ thắng, đối thủ thường gặp — tính mọi ngôn ngữ; danh sách chỉ cùng `lang`; luồng ảnh → AI → xác nhận → chờ duyệt) rồi bình luận (chỉ cùng `lang`).
- `/chien-bao/` ([`js/community-hub.js`](../js/community-hub.js)) và `/quan-tri/` ([`js/community-admin.js`](../js/community-admin.js) cùng [`js/community-admin-users.js`](../js/community-admin-users.js): cột điều hướng trái (≤960px hàng chip) mở tối đa tám khu theo hash — duyệt chiến báo, soạn bài Markdown có xem trước an toàn dựng bằng DOM, kiểm duyệt bình luận, góp ý, Soi đội, khu **AI** quản lý nhà cung cấp AI dùng chung và chuỗi model/effort/timeout riêng của từng tính năng AI, khu **Người dùng** (tìm, lọc, khoá/mở khoá, cấp quyền kiểm duyệt viên, xoá tài khoản) và khu **Nhật ký** (nhật ký mọi thao tác quản trị)). Khu hiển thị theo vai trò từ `GET /api/me`: root thấy cả tám khu; kiểm duyệt viên chỉ thấy năm khu Duyệt chiến báo, Bình luận, Góp ý, Soi đội, Người dùng (email che; lịch sử nhật ký theo từng user nằm trong chi tiết user), còn Bài viết, AI và Nhật ký toàn cục chỉ root. Trang là trang tĩnh `noindex`, ngoài sitemap; nội dung Astro nằm ở `src/components/community/*.astro` nhận `locale`. `scripts/verify-astro-dist.mjs` khoá mount/entry/noindex của hai trang và khối cộng đồng trên mọi trang chi tiết. Quyền và khoá tài khoản được cưỡng chế ở Worker, không phải ở UI: xem [Vai trò và người dùng](community-worker.md#vai-trò-và-người-dùng).
- `/doi-cong-dong/` (`src/components/pages/CommunityTeamsPage.astro` + `CommunityTeamsHub.astro`, entry [`js/community-teams.js`](../js/community-teams.js)): trang danh sách tĩnh, bốn chế độ đọc từ query (danh sách, chi tiết `?id=`, đăng `?new=1`, của tôi `?mine=1`). Hàm thuần (kiểm form, chọn phe từ kết quả AI, gộp trang) nằm ở [`js/community-team-state.js`](../js/community-team-state.js), form đăng (tải ảnh, "Đọc bằng AI" điền nháp, người dùng sửa rồi gửi) ở [`js/community-team-form.js`](../js/community-team-form.js), tên tướng/chiến pháp ở [`js/community-team-data.js`](../js/community-team-data.js): server chỉ lưu id, mọi tên hiển thị tra từ điển phía trình duyệt. Chi tiết đội dùng `pageKey = /doi-cong-dong/<id>/` cho chiến báo và bình luận qua cùng API cũ. Bảng, công thức điểm, route, mùa, xoá đội và triển khai: [Đội cộng đồng](community-worker.md#đội-cộng-đồng).
- Trang tĩnh từng đội `/doi-cong-dong/<id>/` và `/zh/doi-cong-dong/<id>/` (`src/pages/{,zh/}doi-cong-dong/[id].astro` → [`CommunityTeamPage.astro`](../src/components/pages/CommunityTeamPage.astro)) sinh lúc build cho mọi đội hiển thị công khai, từ một request `GET /api/community-teams/export` ([`src/lib/community-teams.ts`](../src/lib/community-teams.ts), cùng chính sách rỗng/fail-closed với blog). Nội dung và JSON-LD dựng ở [`src/lib/community-team-pages.ts`](../src/lib/community-team-pages.ts): chữ người dùng (tiêu đề, phân tích, tên tác giả) giữ nguyên ngôn ngữ gốc, chỉ nhãn và khung câu hỏi FAQ theo ngôn ngữ trang; ngày hiển thị là ngày duyệt (`approvedAt`); tác giả không tên hiện "Người chơi"/"玩家".
  - Canonical theo `textLang`: bản đúng ngôn ngữ văn bản tự canonical và mang JSON-LD (`WebPage` + `BreadcrumbList` + `FAQPage`), bản ngôn ngữ kia canonical về bản đó và không có JSON-LD. Không hreflang: hai bản không phải cặp dịch mà là hai khung UI cho cùng một nội dung. Sitemap chỉ có bản gốc, `lastmod` = `approvedAt`.
  - Vote, bình luận, chiến báo và trạng thái mùa là dữ liệu sống: trang không nhúng tĩnh (JSON-LD cố ý không có `aggregateRating`), `js/community-teams.js` tải live qua mount `#community-teams[data-team-id]`.
  - Danh sách `/doi-cong-dong/` có sẵn link tới trang từng đội trong HTML (robots chặn `/api/` nên crawler không dựng được danh sách bằng JS). Dưới 10 đội (`COMMUNITY_TEAMS_INDEX_MIN`) danh sách `noindex`, không canonical và không vào sitemap, để không index một trang gần rỗng.
  - Mở `?id=<id>` của đội `approved`: JS gửi `HEAD` tới URL tĩnh, 200 thì `location.replace` sang đó; đội chưa duyệt hoặc chưa có trang (vừa duyệt, build chưa xong) ở lại chế độ chi tiết SPA. Link đội đã duyệt trong danh sách SPA có `href` là URL tĩnh, nhưng click thường vẫn đi qua `?id=` để khoảng "đã duyệt, build chưa xong" không rơi vào 404.
  - Tập đội do API quyết định lúc build nên `scripts/verify-astro-dist.mjs` đọc lại từ chính `dist/` và bắt buộc trang đội tự nhất quán (đủ cặp vi/zh, đúng một bản self-canonical, không hreflang/noindex, danh sách index/noindex đúng ngưỡng và link đủ đội, sitemap khớp byte). Site được build lại khi tập đội đổi: xem [Build lại site](community-worker.md#build-lại-site-khi-nội-dung-công-khai-đổi).

### Bản tiếng Trung (`/zh/`)

- Mọi route bản Việt có bản gương cùng đường dẫn dưới `/zh`: `/zh/`, 8 trang mục, `/zh/tra-cuu/<nhóm>/` và `/zh/tra-cuu/<nhóm>/<slug>/`, `/zh/doi-chuan|doi-khac|khai-hoang/<seg>/` (cùng segment, cùng pin identity), `/zh/chien-bao/`, `/zh/doi-cong-dong/`, `/zh/doi-cong-dong/<id>/`, `/zh/quan-tri/`; blog `/zh/bai-viet/` là nội dung riêng. Route file vi/zh là vỏ mỏng, nội dung ở `src/components/pages/*.astro` nhận `locale`; `getStaticPaths` chi tiết ở `src/lib/team-detail-pages.ts` và `src/lib/lookup-item-pages.ts`. Bộ llms chỉ có bản Việt. Ngoại lệ hreflang/canonical: trang từng đội cộng đồng (xem [Cộng đồng phía trình duyệt](#cộng-đồng-phía-trình-duyệt)).
- `SiteLayout` phát `<html lang="zh-Hans">`, `og:locale` `zh_CN`, canonical theo URL của chính bản đó và hreflang vi/zh-Hans/x-default (x-default = bản Việt); header và menu mobile có nút chuyển ngôn ngữ tới trang tương ứng. JS runtime chọn ngôn ngữ theo `<html lang>` (`js/i18n.js`).
- Bản zh không preload subset font tiếng Việt; token `--font-han`/`--font-han-serif` chèn font CJK hệ thống (PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC) trên `:root:lang(zh)`.
- Nhãn kịch bản/phiên bản luật: `season-registry.json` chỉ có `labelVi`, nên bản zh hiện mã mùa trung tính (`PK-S26`); tên mùa nguồn của Đội chuẩn dùng `seasonOptions[].nameRaw` (chữ Hán gốc).
- Pages chỉ phục vụ một `404.html`: trang dựng sẵn khối Việt và khối Trung, script inline chọn khối Trung (và `lang`, tiêu đề, nút chuyển ngôn ngữ) cho đường dẫn dưới `/zh/`; vỏ header/footer của 404 vẫn là bản Việt.
- Sitemap phát cả hai bản kèm `xhtml:link` hreflang (trừ trang từng đội cộng đồng: chỉ bản gốc, không hreflang); `_headers` có một quy tắc `/zh/*`; `scripts/verify-astro-dist.mjs` khoá danh sách file zh, `<html lang>` và hreflang của từng cặp trang.

## Research MCP boundary

Luồng dùng chung hiện có:

```text
snapshot theo manifest v1/v2 (filesystem hoặc Worker Static Assets)
  → validate manifest/hash/cross-reference và dựng index
structured observations
  → normalize thành canonical state
  → caller rà soát/xác nhận
  → binding state + workflow
  → bảy research handler
  → JSON CLI hoặc MCP stdio/Streamable HTTP
```

Inventory theo version thuộc [`artifact-contracts.ts`](../mcp-worker/src/data/artifact-contracts.ts):
v1 giữ sáu artifact legacy; v2 có thêm toàn bộ năm sidecar mùa; v3 có thêm các artifact publication projection và khối `publication` trong manifest (thuộc release identity).
[`FilesystemDataSource`](../mcp-worker/src/data/filesystem-data-source.ts) phân
biệt ba format: raw legacy, raw lookup có đúng cả hai website sidecar, và packaged
MCP có manifest cùng exact inventory. Mixed/partial root bị từ chối. Lookup
sidecars chỉ xác minh raw dictionary generation, không được emit thành MCP
artifact/tool kind. [`StaticAssetsDataSource`](../mcp-worker/src/data/static-assets-data-source.ts)
dùng manifest package để chọn exact inventory. Cả hai validate trước khi
[`data-source.ts`](../mcp-worker/src/data/data-source.ts) giữ snapshot immutable.

`mcp-worker/src/domain/normalization-service.ts` sở hữu chuẩn hóa và source precedence; ambiguity, identity/family conflict hoặc locked-resource conflict đặt trạng thái cần review. `canonical-state.ts` sở hữu projection/digest và xác minh binding. `recommend-handlers.ts` chỉ gọi `recommendRoster` (`js/roster-season-candidates.js`, cùng trang Gợi ý kho) sau khi workflow, canonical state và binding khớp; trạng thái chưa phân giải, roster rỗng hoặc binding cũ bị từ chối (`CONFIRMATION_REQUIRED`). Bằng chứng người dùng thật sự đã xác nhận vẫn thuộc caller, không phải điều research handler tự chứng minh.

Bảy tên tool cùng schema request/result thuộc [`research-contracts.ts`](../mcp-worker/src/research/research-contracts.ts); dispatch và version/provenance/error behavior thuộc [`research-handlers.ts`](../mcp-worker/src/research/research-handlers.ts). CLI `npm run cli -- <lệnh>`, stdio `npm run stdio` và HTTP đều gọi cùng handler/schema. [`tool-definitions.ts`](../mcp-worker/src/mcp/tool-definitions.ts) chỉ thêm mô tả và annotation read-only; mỗi factory tạo `McpServer` mới.

[`public-snapshot-view.ts`](../mcp-worker/src/data/public-snapshot-view.ts) loại
Đô Úy và các cấu hình, evaluation, liên kết cùng bằng chứng chỉ thuộc phần bị
ẩn trước khi dựng index/projector; bằng chứng dùng chung còn được giữ. Public
view vẫn mang identity của raw release để không tạo một version dữ liệu khác.

Handler theo nhóm: [`playbook-handlers.ts`](../mcp-worker/src/research/playbook-handlers.ts) (playbook từ [`src/knowledge/`](../mcp-worker/src/knowledge/) và mùa nguồn của snapshot), [`catalog-handlers.ts`](../mcp-worker/src/research/catalog-handlers.ts) (search/get_entity), [`team-handlers.ts`](../mcp-worker/src/research/team-handlers.ts) (find_teams/get_team, gồm `collection:"engine"` qua [`season-domain-adapter.ts`](../mcp-worker/src/domain/season-domain-adapter.ts) và [`legacy-domain-adapter.ts`](../mcp-worker/src/domain/legacy-domain-adapter.ts)) và [`recommend-handlers.ts`](../mcp-worker/src/research/recommend-handlers.ts). Snapshot manifest v3 thêm các artifact projection xuất bản do [`publication-projection.ts`](../mcp-worker/src/data/publication-projection.ts) định nghĩa và [`publication-builder.ts`](../mcp-worker/src/data/publication-builder.ts) dựng; catalog/team/recommend trên snapshot v1/v2 trả `CAPABILITY_UNAVAILABLE`. Dataset luật canonical ở [`agent-knowledge/`](../agent-knowledge/) được sinh thành `src/generated/knowledge-bundle.ts`; `knowledgeVersion` tách khỏi `workflowVersion`. Chi tiết hợp đồng consumer nằm ở [Research MCP server](mcp-research-server.md).

Stdio dùng official SDK transport, giữ stdout chỉ cho protocol và ghi diagnostic cố định vào stderr. Remote Worker dùng raw Web-standard Streamable HTTP transport của SDK v1 ở chế độ JSON stateless; protocol `2025-11-25` được pin cho cả `initialize` đơn lẻ và trong batch. Trình tự `/mcp` là header guard rẻ → managed-client pre-shared bearer → rate/in-flight → đọc JSON theo byte thực tế và kiểm protocol → Static Assets/server; `/healthz` là liveness no-I/O. Origin hiện diện phải khớp chính xác và result cũng có trần. Bearer này không phải OAuth; không có OAuth server/discovery, client phải tự gắn `Authorization` header.

Remote data nằm trong cùng immutable Worker version với code. Worker chạy trước asset routing nên chỉ application code được gọi; public asset URL luôn `404`. Release builder tạo deterministic manifest và inventory đúng version từ Git tree sạch. Controller dùng prior `100%` + candidate `0%`, Version Override và exact deployment ownership trước khi promote/rollback. Chi tiết vận hành nằm ở [Research MCP server](mcp-research-server.md).

`workflowVersion` ghép full `releaseId` của canonical data manifest với `workflowBuildId` của semantic import closure; compact `dataVersion` chỉ để hiển thị. Inventory build chính xác thuộc [`workflow-source-manifest.json`](../mcp-worker/workflow-source-manifest.json); [`generate-workflow-build.ts`](../mcp-worker/scripts/generate-workflow-build.ts) kiểm closure bằng TypeScript AST, từ chối dynamic import không thể đóng và fail khi manifest/generated identity bị lệch.

Boundary này fail closed và có bounds trước xử lý: chuỗi/control characters và collection được giới hạn, ambiguity hay xung đột material chặn recommendation, output/corpus được clamp. Observation và corpus text được coi là dữ liệu không tin cậy; state/result không nhận hoặc giữ ảnh, base64, path, bearer/provider secret hay token. `coexist.json` chỉ là metadata tham khảo, không tham gia chấm điểm.

## Local state boundary

| State | Storage | Nội dung |
|---|---|---|
| Theme | `localStorage.theme` | `light` hoặc `dark` |
| Recruit tracker | `localStorage.tqcclRecruitTracker` | schema v2: account, banner, pull events (mỗi bản ghi `id`, `updatedAt`, `deletedAt`); đồng bộ tuỳ chọn lên D1 `recruit_records` khi đăng nhập |
| Roster scan | `localStorage.tqccl.rosterRecommend.scanState.v1` | tướng, chiến pháp, team khóa, confirmed, updatedAt; khi đăng nhập và đồng ý gộp, đồng bộ lên D1 `roster_records` qua `/api/roster` (cache `tqccl.roster.cloud.v1`, hợp đồng `docs/roster-sync.md`) |
| Đội của tôi | đội/nhóm không ghi `localStorage` (cache trong bộ nhớ trang); hộp kho (kể cả tên người dùng đặt) nằm trong cache `tqccl.roster.cloud.v1` khi đăng nhập ở `/goi-y-doi-tu-kho/`, xóa khi `signOut`; bản lưu dở OAuth ở `sessionStorage` 30 phút | đội, nhóm, hộp trong D1 `roster_records`; bắt buộc đăng nhập |
| Ảnh | memory phiên UI | data URL preview/request; không serialize vào roster state |

Roster serializer loại `image`, `imageDataUrl`, `base64`, `blob`, `turnstileToken`. Tracker có validate import, JSON export/import (nhập = gộp theo bản ghi) và, khi đã đăng nhập, đồng bộ `GET/POST /api/recruit`: kéo theo con trỏ `rev` của server, đẩy bản ghi sửa sau `pushedAt`, gộp "bản sửa sau cùng thắng" theo `updatedAt`. Store đóng dấu mọi thay đổi tại chỗ lớn hơn `updatedAt` lớn nhất nó đã thấy nên đồng hồ máy lệch không làm mất thay đổi.

### Cầu chuyển domain

localStorage gắn theo origin, nên khi `https://tqccl.com` thành domain chính, dữ liệu người dùng đã lưu trên `tqccl.pages.dev`/`www.tqccl.com` phải được mang sang. [`src/lib/host-bridge.ts`](../src/lib/host-bridge.ts) sinh script inline **đầu tiên** trong `<head>` của mọi trang (`SiteLayout.astro`, gồm cả 404):

- Hostname đúng `tqccl.pages.dev` hoặc `www.tqccl.com`: đọc năm khóa bền `tqcclRecruitTracker`, `tqccl.rosterRecommend.scanState.v1`, `theme`, `tqccl.teamView.v1`, `tqccl.analyze.history.v1` (khóa sessionStorage `tqccl:team-return:v1` không mang), rồi `location.replace("https://tqccl.com" + pathname + search + "#tqccl-migrate=" + encodeURIComponent({v:1, hash, items}))`. Không có khóa nào hoặc storage lỗi → chuyển thẳng, giữ hash gốc.
- Hostname `tqccl.com` với fragment `#tqccl-migrate=`: kiểm `v === 1`, `hash` là chuỗi rỗng hoặc bắt đầu `#`, mọi khóa thuộc allowlist và mọi giá trị là chuỗi; ghi **chỉ** khóa tqccl.com chưa có (không đè dữ liệu mới hơn), rồi `history.replaceState` về `pathname + search + hash gốc` trước khi script theme, script hash cũ của Landing hay `app.js` đọc URL. Payload sai → chỉ bỏ fragment.
- Host preview `*.tqccl.pages.dev`, `localhost`, `127.0.0.1` và host khác: không làm gì.

Payload nằm trong fragment nên trình duyệt không gửi nó trong request HTTP: dữ liệu không tới server Pages, access log hay Worker. Allowlist khóa lấy từ hằng của `js/recruit-tracker-store.js`, `js/roster-scan-state.js`, `js/team-view.js`, `js/analyze-state.js` cộng `theme`; thêm khóa localStorage bền mới phải thêm vào `HOST_BRIDGE_KEYS`.

## Vision request flow

Các mode của `POST /analyze`:

- `analyzeTeamImage`
- `scanHeroes`
- `scanTactics`
- `scanBuiltTeams`

Luồng Worker:

1. Trả preflight hoặc kiểm tra `POST /analyze`.
2. `ALLOWED_ORIGINS` (danh sách origin exact, phân cách dấu phẩy) thiếu/rỗng → `503` fail-closed. Nếu request có `Origin`, yêu cầu khớp chính xác một mục; request không `Origin` vẫn được phép. CORS chỉ echo origin khớp, luôn kèm `Vary: Origin`.
3. Thiếu `IP_HASH_SECRET` → `503` fail-closed (không đụng KV, siteverify hay model). `Content-Length` vượt trần body → `413` trước khi đọc body.
4. Parse body/mode. Đọc cấu hình AI từ KV `ai:config` (mã hoá AES-GCM, khoá HKDF từ `AI_CONFIG_SECRET`, cache 60 giây; module chung `shared/ai-config.ts`) và lấy chuỗi của nhóm ứng với mode (`analyzeTeamImage` → `teamScan`, ba mode scan → `rosterRecommend`, `explainSubstitute` → `explainSubstitute`): thiếu secret/giải mã lỗi/chuỗi rỗng/không mắt xích nào chạy được → `503` `Dịch vụ soi ảnh chưa được cấu hình`. Băm IP bằng HMAC-SHA256 có khoá (IPv6 gom /64).
5. Kiểm tra kill-switch, per-hour/day/month qua KV best-effort (lỗi đọc coi như 0, lỗi ghi bỏ qua).
6. Xác thực Turnstile bằng siteverify (một lần dùng, `hostname` phải là host của một origin trong `ALLOWED_ORIGINS`); không có lớp replay KV.
7. Validate image MIME, magic bytes và size (tính từ độ dài base64, chỉ giải mã phần đầu).
8. Commit global usage, gọi lần lượt mắt xích (nhà cung cấp, model, effort) của nhóm (401/402/403/429/5xx/lỗi mạng/timeout → mắt xích kế; 2xx → dừng; mỗi lượt chờ tối đa timeout của nhóm hoặc phần còn lại của trần tổng), tolerant-parse và validate output theo mode. Hết mắt xích/hết trần tổng → `502`/`503` với thông điệp cố định (429 cuối → `503`); lỗi bất ngờ → `500` JSON có CORS.
9. Browser tiếp tục kiểm envelope tương ứng với mode cho cả response `200`; JSON lỗi hoặc sai shape được đổi thành thông báo tiếng Việt hữu hạn, không đi vào state review.

Soi đội sau bước 9: `analyzeTeamImage` chỉ chép chữ in và trả `{screen, sides:[{side, heroes}]}` (một lượt AI đọc mọi phe; `tacticsCn` tối đa 3 dòng kể cả tự mang, ô không đọc được `未知`). Ảnh hai phe (màn chiến báo) hiện bước chọn Phe trái/Phe phải trước editor; đổi phe dùng lại kết quả đã đọc, mỗi phe giữ draft đã sửa. `js/analyze-map.js` phân loại từng ô thành khớp chắc / không chắc (kèm ứng viên) / không rõ và dựng editor 3 tướng × (tướng, 2 chiến pháp, binh thư); người dùng xác nhận (hoặc nhập tay, không gọi Worker) rồi `diffTeam`/`compareTeams` so từng ô với Đội chuẩn theo mùa và Đội khác. Đội đã xác nhận đi vào URL `?season=…&doi=v1.…` (`js/analyze-state.js`, chỉ ID canonical, không mang phe; `SECTION_QUERY_KEYS` giữ hai khóa này khi quay lại từ trang chi tiết), lịch sử localStorage tối đa 10 mục và thẻ PNG vẽ trên canvas; mở link/lịch sử dựng lại editor + diff mà không request Worker, link hỏng bị bỏ qua lặng lẽ. Lần Đối chiếu đầu của mỗi (lượt đọc, phe) gửi đếm ẩn danh `POST /api/scan-stats` (số ô AI chép / phải sửa / không rõ); nút "Gửi ảnh này" (đăng nhập + đồng ý) gửi ảnh + đội đã xác nhận tới `POST /api/scan-samples` để admin duyệt và xuất fixture cho bộ ảnh chuẩn `worker/eval/` (`npm run eval:vision`).

## Deployment boundary

| Surface | Artifact | Config |
|---|---|---|
| Cloudflare Pages | `dist/` từ `npm run build` | `public/_headers`, public Worker URL + Turnstile site key |
| Cloudflare Worker | `worker/src/*.ts` + `shared/ai-config.ts` + `shared/ai-models.ts` | vars trong `wrangler.toml`, KV binding (gồm bản ghi `ai:config`), secrets trong Worker env |
| Research MCP Worker | `mcp-worker/src/worker.ts` | `wrangler.jsonc`, `ASSETS`, version metadata, managed bearer secret, Origin/limit vars |
| Research MCP local | `mcp-worker/src/stdio.ts` | filesystem snapshot; stdout protocol-only |
| Maintainer local | `pipeline/*.py`, HTML/cache/maps | không publish nguồn/cache riêng tư |

Config commit hiện trỏ Pages (domain chính `https://tqccl.com`, cùng `https://www.tqccl.com` và `https://tqccl.pages.dev`) tới Worker `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze`. Đây là public config hoạt động, không phải placeholder.

Astro dùng `output: "static"` và không có Cloudflare adapter/Pages Functions. Manifest explicit trong `src/lib/public-artifact-manifest.mjs` cho phép đúng các route JS/CSS/JSON; helper từ chối file lạ, symlink và path thoát root. `scripts/verify-astro-dist.mjs` là policy output duy nhất: kiểm allowlist, byte parity của raw asset và của mọi artifact trong `public/` (deployment-control lẫn static public) → `dist/`, đối chiếu `dist/sitemap.xml` với document sinh từ chính inventory route, đồng thời từ chối source/private/secret-like output.

Browser CI chỉ do `.github/workflows/mcp-worker.yml` sở hữu. Pull request/push chạm `data/**`, `pipeline/**`, `js/**`, `css/**`, `public/**`, `src/**`, `tsconfig.json`, Astro config hoặc test liên quan đều chạy một repository gate credential-free; gate bao gồm root build, dist contract, `npm run verify`, Playwright, Node, Python, Vision Worker và Wrangler dry-run. Không có workflow Pages thứ hai chạy một tập kiểm tra lệch.

`_headers` yêu cầu browser revalidate shell, JS, CSS và JSON (`public, max-age=0, must-revalidate`). Đây là local deployment contract; response header thật và SPA fallback body chỉ được xác nhận trên Pages preview có ủy quyền.

## Failure và fallback

- Thiếu `team-tier.json`: Gợi ý đội (trang duy nhất đọc file này) vẫn chạy với đội không có tier.
- Lỗi JSON bắt buộc: thông báo tải lại/liên hệ quản trị hiện trong mount của trang mục đang mở (`js/app.js`); phần khởi tạo còn lại của trang đó không chạy.
- Dependency trang đang dùng trong `data/website-display.json` đổi bytes hoặc sai pin: toàn bộ khởi tạo của trang dừng trước render và chỉ hiện lỗi tiếng Việt hữu hạn.
- Vision lỗi: tra cứu local và tracker vẫn độc lập; UI trả status theo lỗi Worker.
- Research MCP HTTP lỗi: CLI/stdio local vẫn độc lập; recommendation fail closed, không tự bịa đội hình.
- Research MCP trả `401/429/503` trước dữ liệu khi bearer, quota hoặc cấu hình không hợp lệ; `/healthz` không đại diện data readiness.
- Worker có `FEATURE_ENABLED` kill-switch; rollback Worker/Pages độc lập. Pages rollback phải promote toàn artifact known-good, purge cache bị ảnh hưởng và kiểm tra client mới/cũ.
- Mất localStorage: tracker/scan mất nếu người dùng chưa export backup; tracker của người đã đăng nhập kéo lại được từ `/api/recruit`.

## Bước tiếp theo

Khôi phục pipeline xác định và facet đồng bộ; bổ sung accessibility focus/keyboard/live region; đánh giá Durable Object nếu cần quota cứng.

## Tham chiếu

- [PDR](project-overview-pdr.md)
- [Deployment Guide](deployment-guide.md)
- [Code Standards](code-standards.md)
- [Worker README](../worker/README.md)
