# Bộ Tra cứu thống nhất

## Phạm vi và nguồn truth

Mục **Tra cứu** đọc một generation đã xác minh gồm bốn file công khai:

- `data/heroes-dict.json`: 252 tướng (202 từ baseline/SGSDeck + 50 từ client Global; 2 tướng còn `iconUrl` rỗng: Hà Thị và SP Tào Tháo — không có trong Minh Giám Global);
- `data/tactics.json`: 406 chiến pháp;
- `data/lookup-catalog.json`: 114 trang bị với 90 đặc kỹ, 39 kỹ năng quân sư, 16 cải tạo binh chủng với 192 lựa chọn, và 41 công trình với 426 cấp;
- `data/lookup-manifest.json`: hash của ba payload và `generationId`.

Schema và kiểm tra quan hệ thuộc [`pipeline/build_unified_lookup.py`](../pipeline/build_unified_lookup.py). Loader trình duyệt thuộc [`js/lookup-data.js`](../js/lookup-data.js): công cụ nạp trọn bộ (`loadLookupBundle`: inventory, SHA-256, generation và quan hệ), trang nhóm Tra cứu nạp từng payload theo nhu cầu (`createLookupPayloadLoader`: SHA-256 theo manifest đã pin, generation, shape của chính payload). Tham chiếu chéo giữa ba payload được kiểm trên trọn bộ lúc build (`src/lib/lookup-pages.ts`) và trong dist verifier. UI không render một phần bundle lỗi.

`data/sgsdeck/`, `pipeline/sgsdeck-cache/`, `pipeline/lookup-inputs/`, registry danh tính, bản dịch, ledger và transaction journal là nguồn/evidence nội bộ. Chúng không phải public route và không được copy vào `dist/`. DTO công khai không chứa `provider`, `sourceUrl`, `provenance`, `sourceRecordId`, `sourceSnapshot` hay raw source object. `iconUrl` đã kiểm duyệt là trường hiển thị, không phải provenance. Nguồn chữ Hán hiệu ứng ngoài SGSDeck (`zhEffects`) chỉ công khai `lookup.effectZhSource = {kind}`; `ref`, `note`, `viSha256` ở đầu vào và ledger riêng.

Nguồn Team chuẩn/Team khác có contract attribution riêng. Không áp quy tắc ẩn nguồn của catalog lên link nguồn, nhãn mùa hoặc điểm SGSDeck đã được review của hai tab đó.

## Danh tính, nội dung và quan hệ

Baseline bất biến ở `pipeline/lookup-inputs/` giữ 112 tướng và 240 chiến pháp cũ. Mọi record cũ giữ tên Việt, canonical ID và loại biến thể; base, SP, CO và 40Y không bị nhập chung. Snapshot SGSDeck đã review bổ sung record mới nhưng không tự tạo đội, tier, điểm hoặc availability theo mùa.

`pipeline/lookup-identity.json` ghi 260 quyết định `matched` và 556 quyết định `new`. Quan hệ không đủ chứng cứ giữ `null` kèm trạng thái thay vì đoán; hiện có 33 đặc kỹ không nối parent. Translation fingerprint gắn bản dịch với nội dung nguồn. Nội dung nguồn thay đổi mà fingerprint cũ sẽ chặn build/promotion; thiếu dữ liệu nguồn được phân biệt với nội dung chưa dịch.

Giá trị SGSDeck có nghĩa thắng theo trường. Placeholder hoặc trường thiếu dùng fallback đã review; `0` và `false` là giá trị hợp lệ, không phải thiếu. Mười một delta baseline đã được allowlist và kiểm bằng ID chính xác; xem phase execution thay vì sửa fixture lịch sử.

### Tướng từ client Global (`pipeline/lookup-client-heroes.json`)

Một số tướng không có trong snapshot SGSDeck và không có URL ảnh từ xa. Chúng được chụp tay từ client Global (Tam Quốc Chí - Chiến Lược 24.526, màn **Võ Tướng > Minh Giám**) vào `pipeline/lookup-client-heroes.json`. Client Global là nguồn **có thẩm quyền** cho dữ liệu tướng của site bản Việt Nam. Đây là input capture có hash như identity/translations: byte của nó nằm trong `generation.json` (`inputHashes.clientHeroes`), `validate` và `_assert_lookup_publication` bắt buộc nó khớp candidate, và **file bắt buộc phải tồn tại** (không có thì build dừng; trạng thái rỗng là `heroes: []`, `portraits: {}`, `overrides: {}`, `roleTags: {}`, `aliases: {}` và cho output byte-identical với trước khi có file).

Schema (`schemaVersion: 1`, key set chính xác, build dừng nếu thừa/thiếu):

- `source`: nơi chụp (`kind`, `edition`, `client`, `version`, `screen`, `capturedAt`);
- `heroes[]`: tướng **chưa có** ở baseline, SGSDeck hay registry. `id` phải bằng `canonical_id("hero", viet)`, không trùng, `faction ∈ {Ngụy, Thục, Ngô, Quần, Hán}`, `variant ∈ {base, sp}`, `stats` là chuỗi, `growth` là số hữu hạn, `troopApt` đủ 5 khóa. `roleTag`, `roleTagViet`, `selfTacticVi`, `portrait` có thể `null`. Builder phát chúng **sau** các tướng cũ, sắp theo `id`, đủ `HERO_KEYS`; `aliases = aliasesVi + [chinese]`, `selfTacticCn`/`inheritTacticCn`/`linkScore` `null`, `cardPacks` rỗng, `usageVi` `null`, `flags.isSp = isSP`, các flag khác `null`. `lookup.selfTacticId` chỉ nối khi `selfTacticVi` khớp **đúng một** `viet` của chiến pháp đã dựng (khớp tuyệt đối, không đoán gần đúng; tên client dịch khác tên dự án thì giữ `null`). `lookup.missingFields` liệt kê các trường nguồn mà capture client không có (`CLIENT_MISSING_FIELDS` cùng `role`/`innateTacticId` khi thiếu);
- `portraits{}`: ảnh cho tướng **đã có** mà `iconUrl` build ra đang `null`. Có URL từ xa rồi thì build dừng, không ghi đè;
- `overrides{}`: sửa tướng **đã có**, áp vô điều kiện lên giá trị build (baseline/SGSDeck) vì client Global là nguồn có thẩm quyền cho bản Việt Nam. Mỗi mục có thể gồm `stats` (đủ 6 khóa, chuỗi), `growth` (đủ 6 khóa, số), `troopApt` (đủ 5 khóa, S/A/B/C), `cost` (chuỗi), `stars` (1–5), `faction`. Mục không đổi giá trị nào (no-op) làm build dừng, nên file chỉ giữ các hiệu chỉnh thật. Ledger ghi hash giá trị cũ (`localValueHash`) và nguồn client cho từng trường. `GOLDEN_HERO_DELTAS` ghim giá trị theo client Global 24.526; hiệu chỉnh đổi giá trị bị ghim làm build dừng ở `golden hero delta mismatch` và bảng ghim chỉ sửa sau review;
- `roleTags{}`: `roleTag`/`roleTagViet` cho tướng đã có **chỉ khi cả hai đang `null`**; nhãn client thô hơn nhãn Hán curated nên không bao giờ ghi đè;
- `aliases{}`: tên client nối vào `aliases` (giữ thứ tự, không trùng); trùng `viet` hoặc alias sẵn có thì build dừng.

Mọi ảnh là `/heroes/<slug>.webp` (slug = `id` bỏ `hero:`, regex `^/heroes/[a-z0-9-]+\.webp$`), 300×300 WebP, **file phải có trong `public/heroes/`** lúc build. Ledger ghi từng trường với `chosenInput: "client-capture"`, `sourceRecordId: "client-heroes:<slug>"`, và `missing-source` cho trường client không cung cấp.

**Quyết định self-host chân dung (thay thế C3).** Ghi chú trước đây "không self-host chân dung" (quyết định C3 của kế hoạch `260621-2324`, brainstorm §3) bị thay bằng yêu cầu của người dùng: các tướng này không có URL ảnh từ xa nên ảnh được lưu trong repo tại `public/heroes/`. Phạm vi chỉ gồm các ảnh trong `lookup-client-heroes.json`; 112 tướng baseline vẫn dùng `iconUrl` từ xa. Phía hosting: `js/hero-portrait.js` `portraitUrl` nhận thêm đường dẫn cùng origin khớp đúng regex trên (vẫn từ chối `//host`, scheme lạ, không có `/` đầu, `..`, query); `scripts/verify-astro-dist.mjs` khóa `public/heroes` → `dist/heroes` từng byte; `public/_headers` có rule `/heroes/*` cùng chính sách revalidate như ảnh/font không băm tên.

Cập nhật số liệu (tổng số tướng, ảnh, thống kê Landing, README, `codebase-summary.md`) là bước sau promotion; số trong tài liệu theo `generation.json` → `counts` của generation đang phát.

### Chiến pháp từ client Global (`pipeline/lookup-client-tactics.json`)

Dữ liệu chụp từ client Global 24.526: mục **Chiến Pháp** (danh sách Toàn bộ ở mức đầy cấp, màn Kế thừa, màn Sự kiện) và **Thượng Thư Đài** (thẻ chiến pháp tra theo tên, hoặc mở từ chiến pháp tự mang/kế thừa trên thẻ tướng; luôn bấm "Xem hiệu quả đầy cấp" trước khi chụp). 396/406 chiến pháp có mục trong file (9 chiến pháp B lấy từ thẻ tướng xanh lam, nối ID theo nghĩa tên Hán-Việt + loại hình vì client không hiện chữ Hán). Client là nguồn có thẩm quyền cho phần tiếng Việt: giá trị build ra (SGSDeck/baseline/bản dịch) bị thay. File là input capture có hash như `lookup-client-heroes.json` (`inputHashes.clientTactics`, cờ `--client-tactics`, bắt buộc tồn tại; file chỉ có `tactics: {}` vẫn phải khai `zhEffects` cho chiến pháp có chữ Hán từ baseline cũ) và được áp **trước** tướng client.

Schema (`schemaVersion: 1`; bắt buộc `source`, `tactics`, tùy chọn `newTactics`, `retired`, `troopMods`, `tacticNotes`, `zhEffects`): `source` như tướng client; `tactics{}` khóa bằng ID chiến pháp đã có hoặc ID trong `newTactics`, mỗi mục đủ `nameVi`, `quality` (`S`/`A`/`B`/`C`, `null` = không đổi; lấy theo màu tên chiến pháp trên thẻ tướng client: cam S, tím A, xanh B, xanh nhạt C — chiến pháp binh chủng không có phẩm), `type` (enum `COMMAND`/`ACTIVE`/`BURST`/`PASSIVE`/`TROOP`/`FORMATION`/`INTERNAL`; loại "Binh Thư" của client không có trong enum nên giữ loại của kho), `activationRate` (0–1; dòng có "Xác suất phát động a%→b%" hoặc Xác suất dạng "a%→b%" lấy b là mức đầy cấp, vì cột Phát động hiện mức cấp 1), `troopFit` (tập con theo thứ tự Kỵ, Khiên, Cung, Thương, Khí giới), `targetVi` (Mục tiêu), `effectTypeVi` (Buff), `effectVi` (hướng dẫn đầy cấp), `maxUsers` (Có thể mang, màn Kế thừa; `null` = không đổi), `exchangeConditionVi` (điều kiện quy đổi ở màn Sự kiện; `null` = không đổi).

Builder: `nameVi` khác `viet` thì **thay `viet`** (tên hiển thị toàn site theo client); `id` giữ nguyên, tên cũ còn ở `hanViet` (nếu tên cũ khác `hanViet` thì thành alias). Mọi nơi nối chiến pháp theo tên phải đi qua `id` của danh mục (khớp `viet`/`hanViet`/alias), không suy id từ slug `viet`. Dữ liệu đội (`data/teams.json`, Khai hoang, Cùng Tồn, Đội chuẩn) giữ tên đã lưu vì bị ledger duyệt băm; lớp hiển thị bản Việt đổi sang `viet` qua `createTacticDisplayName`. Lúc build, `src/lib/tactic-display.ts` tính bảng `{tên lưu: tên hiển thị}` (chỉ tên thật sự đổi) từ các file đã pin của website-display publication; bản dựng sẵn (trang đội, Khai hoang, Tra cứu) dùng bảng này và mọi trang (trừ Landing/404) nhúng nó ở `#tactic-display-names` để trình duyệt (`readTacticDisplayTable`) dựng lại đúng tên mà không tải `data/tactics.json`. `effectVi` thành `effectViet` và chữ của bản hiện hành trong `lookup.revisions`; mốc ngày của bản hiện hành cũ chỉ giữ khi tập số liệu trùng chữ client, lệch thì bản đó lùi thành lịch sử (`Bản <ngày>`/`Bản trước`) và chữ client là `Bản hiện hành` không ngày. Ledger ghi từng trường đổi với `chosenInput: "client-capture"`, `sourceRecordId: "client-tactics:<slug>"`, `localValueHash` của giá trị cũ. Tướng client nối `selfTacticId` theo `viet` (giờ là tên client), không có thì theo alias trỏ đúng một chiến pháp.

`newTactics{id: {nameZh, conditions?, aliases?}}`: chiến pháp chỉ có ở client. `conditions` (cùng shape `lookup.conditions`) ghi phạm vi mùa: bản `Tinh •`/`Chuyển •` là chiến pháp bổ sung của mùa Binh Diễn Xuân Thu, nội dung có thể khác bản gốc; chiến pháp binh chủng chỉ mùa đó cho tùy chỉnh. Mùa có 16 chiến pháp binh chủng, mỗi binh chủng một mục `Tinh •` lấy hướng dẫn gốc ở màn Sân Luyện Binh › Binh chủng Xem (chưa gồm cải tạo), các lựa chọn cải tạo S/C/B/A ghi trong `conditions`; `Chuyển •` (cải tạo đặc biệt đổi loại binh) là tên khác của cùng mục, đặt trong `aliases`. `id` phải bằng `canonical_id("tactic", nameVi)` của mục cùng khóa trong `tactics{}` và chưa có trong kho; builder thêm hàng mới vào cuối danh mục (`chinese = nameZh`, `hanViet = viet = nameVi`, `source` `null`), rồi áp dữ liệu client như mục thường. Hiệu ứng chữ Hán của mục mới bắt buộc ở `zhEffects`.

`zhEffects{tactic id: {text, viSha256, source}}`: đầu vào **duy nhất** cho hiệu ứng chữ Hán không lấy từ SGSDeck. `source` đúng một dạng: `{kind: "source", ref}` (trang công khai cùng cơ chế và đủ số cấp 1 → tối đa, `ref` là URL `https` cụ thể trên host đã duyệt `sanzhan.slgsim.com` hoặc `forum.gamer.com.tw`, không port/userinfo/khoảng trắng; thêm host là thay đổi code có review), `{kind: "capture", note}` (chữ chụp màn client, `note` ≤ 120 ký tự, không URL; hiện chỉ 16 chiến pháp binh chủng `Tinh •` chụp màn 訓兵場 client TW) hoặc `{kind: "translation"}` (dịch từ `effectViet`, giữ đúng số và cú pháp `x→y`). `text` không HTML, `<`/`>`, thực thể `&…;`, ký tự điều khiển/ẩn (trừ xuống dòng), ≤ 1500 ký tự. `viSha256` = SHA-256 của `effectViet` (UTF-8) lúc gán, bắt buộc mọi loại: `effectViet` đổi thì build dừng (`stale zhEffects`) để rà lại chữ Hán. Builder ghi nguồn gốc chữ Hán của từng chiến pháp (`sgsdeck` khi `effectText` SGSDeck dùng được, `baseline` khi chữ lấy từ `pipeline/lookup-inputs/tactics.json`, `missing` khi rỗng): mục `zhEffects` trỏ tới chiến pháp SGSDeck, chiến pháp không tồn tại hoặc đã gỡ làm build dừng; chiến pháp `baseline` hoặc mục `newTactics` thiếu `zhEffects` cũng dừng (`non-SGSDeck zh effect without zhEffects`). Công khai: `lookup.effectZhSource` = `null` (chữ SGSDeck hoặc chưa có chữ Hán) hoặc `{kind}`; `ref`/`note` chỉ vào ledger riêng (`clientCapture.zhEffects`, `chosenInput = zh-effect-<kind>`). Bảng kết quả tra và rà độc lập từng mục: `plans/261020-1112-redirect-chu-han-mcp/reports/nguon-chu-han.md`.

Giao diện gắn cờ "Hiệu ứng chữ Hán dịch từ tiếng Việt, chưa đối chiếu" / "中文效果译自越南语，未经核对" (`[data-zh-source="translation"]`, helper `isTranslatedZhEffect` của `js/lookup-detail.js`) cho mục `kind: "translation"`: hồ sơ chiến pháp vi + zh (trang riêng và hộp thoại, ở đầu khung hiệu ứng, ngoài panel phiên bản), thẻ chiến pháp liên quan trên hồ sơ tướng (chỉ zh) và ô hiệu ứng của bảng nhóm `/zh/tra-cuu/chien-phap/`. Meta description + JSON-LD trang zh của mục đó bỏ đoạn hiệu ứng. Mục `source`/`capture`/`null` không có cờ. Giải thích đội (roster) chưa có cờ.

`retired{mãBỏ: mãGiữ | null}`: gộp các cặp ID là cùng một chiến pháp ở client (cùng tên client, vd `nhanh-chan-tranh-dat` → `si-tranh-tien-pho`), hoặc bỏ hẳn mục không phải chiến pháp (`null`, vd `dao-vien-ket-nghia` là duyên phận). Mã bỏ không được có mục trong `tactics{}`; mã giữ phải còn và không bị bỏ. Builder xóa hàng cũ, đưa `viet`/`hanViet`/alias/`chinese` cũ vào `aliases` của mã giữ, ghi `lookup.formerIds` (mọi chiến pháp có khóa này, rỗng khi không gộp), gộp `inheritedFromIds`, chuyển liên kết tự mang/kế thừa của tướng, và ghi ledger `clientCapture.retired`. Mã bỏ hẳn mà còn tướng trỏ tới thì build dừng. `generation.compatibility.retiredTacticIds` lưu bảng này; validate so thứ tự mã cũ sau khi trừ mã đã bỏ và kiểm mã giữ có `formerIds`. Consumer: `?id=<mã cũ>` chuyển sang hồ sơ mã giữ (`retiredLookupRedirect`), resolver tên/ID và luật đội (`buildTacticRules`) quy mã cũ về mã giữ, MCP `tqccl_get_entity`/search trả mã giữ, snapshot SGSDeck còn tham chiếu mã cũ được nối qua `formerIds`.

`troopMods{troop-mod id: {nameVi, effectVi, options[12]}}`: nhóm Cải tạo binh chủng (mùa Binh Diễn Xuân Thu) chỉ giữ **một bản client** (màn Sân Luyện Binh › Binh chủng Xem): tên client (tên cũ thành `aliasesVi`), hướng dẫn mùa làm `effectVi`, `revisions` rỗng, 12 lựa chọn theo thứ tự cấp S/C/B/A (mỗi cấp 3) với `tier`, `nameVi`, `descriptionVi`, `convertsTo` (loại binh khi chọn Chuyển hoặc `null`). Nhãn cấp theo client: Đặc biệt, Sơ cấp, Trung cấp, Cao cấp. Lựa chọn trùng tên (bỏ dấu) với bản cũ giữ mã con, lựa chọn khác dùng `troop-option:<binh chủng>:<slug tên>`. `appliesToVi`/`suggestedBuildVi` (chỉ có ở SGSDeck) giữ nguyên.

`tacticNotes{tactic id: {aliases, conditions}}`: thêm tên khác và ghi chú mùa cho chiến pháp đã có, vd bản `Thác-<tên>` bán ở Sảnh Chính › Thương nhân › Mùa giải (Chiến Pháp mùa giải: cùng hiệu ứng với bản gốc, xung đột với chiến pháp cùng tên trong đội, bị xóa khi hết mùa).

Mục chỉ có ở SGSDeck đã bỏ (`retired: null`), trừ hai chiến pháp của SP Tào Tháo có ở bản Trung (giữ nội dung SGSDeck, ghi chú qua `tacticNotes`). `pipeline/lookup-client-heroes.json` có `retired` (danh sách mã tướng không có ở client, vd `hero:ha-thi`): builder bỏ tướng, gỡ khỏi `inheritedFromIds`; tướng bị bỏ không được còn ghi đè/ảnh/alias/roleTag.

### Đánh giá và Cách nhận

Hồ sơ tướng có thêm **Đánh giá** (`lookup.usageVi`, chữ nguồn `usageZh`) và **Cách nhận** (`lookup.cardPacks`: gói, tướng lõi hay không, tỉ lệ lõi/thường của cả gói) từ `pipeline/sgsdeck-guide.json`. Guide nằm ngoài `data/sgsdeck/` vì snapshot bị registry pin và registry là nguồn glossary của gate bản dịch; guide tự gắn `snapshotManifestHash` của snapshot. Dựng lại guide từ đúng cache của snapshot, không đổi snapshot:

```bash
python3 -m pipeline.build_sgsdeck_catalog --cache pipeline/sgsdeck-cache --guide-only
```

Tên gói và loại gói dịch trong bảng `CARD_PACKS`/`CARD_PACK_CATEGORIES` của builder; gói nguồn chưa có trong bảng làm build dừng. SGSDeck gắn 評價 của bản thường vào 11 bản SP ra mắt sau danh sách nguồn (2022-01-24); bảng `USAGE_REASSIGNMENTS` chuyển chúng sang hồ sơ bản thường và làm build dừng khi chữ nguồn đổi hoặc bản thường đã có 評價 riêng.

## Build và validate candidate

Builder chỉ đọc một tập raw bytes đã capture, chạy offline, không recrawl và không đọc output của chính nó làm input:

```bash
python3 -m pipeline.build_unified_lookup build \
  --inputs pipeline/lookup-inputs \
  --source data/sgsdeck \
  --identity pipeline/lookup-identity.json \
  --translations pipeline/lookup-translations.json \
  --client-heroes pipeline/lookup-client-heroes.json \
  --client-tactics pipeline/lookup-client-tactics.json \
  --output pipeline/lookup-output/candidate
python3 -m pipeline.build_unified_lookup validate \
  --candidate pipeline/lookup-output/candidate
```

Review `generation.json`, ledger, coverage và toàn bộ diff trước activation. Cùng inputs/registry/translations phải tạo byte-identical output. Không thay frozen baseline bằng output mới và không dùng candidate từ một generation khác.

Thêm hoặc sửa tướng client: sửa `pipeline/lookup-client-heroes.json` (và thả ảnh vào `public/heroes/`), rồi build → validate → promote như trên. Sau promotion chạy lại các bước dẫn xuất: `python3 -m pipeline.lookup_route_handles --write` rồi `--check`, ghim lại `policy.sourceFiles` cho file đã sửa, `site_localization build --stage all` → `check --stage all` → `publish` → `check --stage public` → `prune` (`publish` dựng lại Recommended, gồm tóm tắt "Trong cẩm nang"; không chạy `build_recommended_reference` tay), re-pin `pipeline/team-route-handles.json`, `node scripts/report-zh-gaps.mjs` và cuối cùng `npm --prefix mcp-worker run generate:workflow-build` (digest artifact MCP).

## Promote và recover

Promotion là local activation có lock/journal/backup, không phải deployment và không hứa atomic switch nhiều file:

```bash
python3 -m pipeline.promote_unified_lookup promote \
  --candidate pipeline/lookup-output/candidate \
  --activation <activation-manifest> \
  --transaction <transaction-id> \
  --root .
```

`--activation` là đường dẫn file JSON manifest (`<activation-manifest>`, ví dụ `pipeline/lookup-output/<tên>-activation/activation-manifest.json`; thư mục `*candidate*`/`*activation*` dưới `pipeline/lookup-output/` là dẫn xuất, không commit), không phải thư mục. Các `source`
trong manifest resolve tương đối từ thư mục chứa file đó; file phải bind code/
config/test postimage đã review cùng preimage checkpoint. Promotion tạo journal
bền trước mutation, kiểm preimage dưới shared lock, rồi thay đúng các path owned.
Browser, build, season publisher và MCP raw reader từ
chối transaction chưa hoàn tất hoặc bundle trộn.

Sau process interruption, dùng đúng transaction đã ghi:

```bash
python3 -m pipeline.promote_unified_lookup recover \
  --transaction <transaction-id> \
  --root .
```

Recovery chỉ sửa transaction bị gián đoạn và restore path khi current bytes vẫn
bằng postimage owned; edit ngoài transaction làm nó dừng trước partial restore.
Nó kiểm dependent season refs, giữ file mùa và WIP không thuộc ownership. Nó
không hoàn tác một activation đã `committed`: transaction `site-vi-260928-source-strip`
(`committed`, khớp `lookup:356b4a3c…` trong `data/lookup-manifest.json`) là
evidence hiện tại; journal nằm dưới `pipeline/lookup-output/transactions/`
(ignored, chỉ có trên máy đã chạy promotion). Muốn chuyển khỏi generation đã commit cần một activation mới đã
review; không xóa lock hoặc chép preimage thủ công.

## Consumer và publication contract

Mỗi mục có trang riêng `/tra-cuu/<nhóm>/<slug>/` (`tuong`, `chien-phap`, `trang-bi`, `quan-su`, `cai-tao-binh-chung`, `cong-trinh`, `binh-thu`; bảng ở `js/lookup-ids.js`) dựng sẵn hồ sơ đầy đủ lúc build; slug đóng băng theo mã trong `pipeline/lookup-route-handles.json` nên đổi tên Việt không đổi URL. Hồ sơ `?id=<id>` trên trang của đúng nhóm là trạng thái hộp thoại/panel và link `?id=` cũ vẫn mở được. Mục lục `/tra-cuu/` chuyển tiếp link cũ `?group=<nhóm>&id=<id>` (hoặc chỉ `?id=`) sang trang nhóm; hash cũ `#lookup`, `#heroes`, `#tactics` và `#lookup?group=<nhóm>&id=<id>` được Landing chuyển tới mục lục (dạng `#lookup/<nhóm>/<id>` không thuộc contract) mà không rewrite history ngoài navigation do người dùng thực hiện. Lúc vào trang nhóm chỉ tải manifest + payload của nhóm (Binh thư chỉ `books-dict`); payload hồ sơ cần thêm tải lười khi mở hồ sơ đầu tiên; trang riêng không tải dữ liệu. HTML trang nhóm có đủ mọi mục (khi có JavaScript chỉ trang đầu hiện), chip nhóm là link, tìm Việt bỏ dấu/Hán/Hán-Việt trong nhóm, phân trang, modal focus trap, Escape, Back/Forward, mobile và light/dark thuộc contract trình duyệt.

Khối "Trong cẩm nang" của hồ sơ Tướng và Chiến pháp đọc `hero-summaries.json`/`tactic-summaries.json` của generation Recommended đang pin (chỉ `manifest.json` + đúng file đó, không tải `index.json`/`other-teams.json`); số liệu chiến pháp trả ID tướng/chiến pháp nên tên hiển thị lấy từ corpus theo ngôn ngữ trang.

Astro build capture một website-display publication snapshot. Sidecar pin exact bytes/generation của Lookup cùng source JSON hiển thị và generation Recommended; HTML và mọi route raw đều dùng snapshot đó. Candidate strict của `site_localization` tự dựng/validate Lookup từ review inputs và chỉ publish khi bốn file Lookup công khai đã trùng candidate. Nếu source hash, HTML pin, route hoặc generation bị interleave, build/verifier dừng toàn bộ khởi tạo thay vì phát hành artifact trộn hoặc render raw.

MCP có bảy tool (xem [Research MCP server](mcp-research-server.md)); `tqccl_search` có tám kind `hero`, `tactic`, `equipment`, `advisor`, `troopMod`, `building`, `book`, `team` (nguồn: `SEARCH_KINDS` trong `catalog-handlers.ts`). Raw project root được nhận khi hai lookup sidecar và dictionary bytes coherent; packaged MCP root được nhận theo `manifest.json` (sáu/mười một artifact cho v1/v2; v3 thêm artifact publication, xem [artifact contracts](../mcp-worker/src/data/artifact-contracts.ts)). Hai lookup sidecar website được validate ở ingress nhưng không emit thành MCP artifact hay kind. Root trộn hai format bị từ chối.

## Regeneration triggers

- Đổi source snapshot, guide, identity decision, translation hoặc merge rule: build/validate candidate và review generation mới.
- Promote generation mới hoặc đổi `data/books-dict.json`: chạy `python3 -m pipeline.lookup_route_handles --write` rồi `--check` trước build (build từ chối ledger slug lệch pin hay tập mã), và `node scripts/report-zh-gaps.mjs` để báo cáo zh thiếu chữ khớp dữ liệu; slug đã cấp không đổi, mã rời corpus chuyển sang `retired`. `--write` cũng sinh `public/_redirects` (đầu ra, không sửa tay): mỗi mã trong `lookup.formerIds` của một chiến pháp có hai rule `301` (`/tra-cuu/chien-phap/<slug cũ>/` và `/zh/…`) tới trang mã giữ; `--check` báo `public/_redirects is stale` khi file lệch ledger. Mã đã gỡ mà không mã giữ nào liệt kê vẫn 404.
- Đổi hero/tactic/catalog bytes: promote cả bundle bốn file; không thay từng file.
- Đổi semantic runtime MCP: chạy `npm --prefix mcp-worker run generate:workflow-build`, commit generated identity rồi chạy `check`.
- Đổi public manifest/build verifier/router: chạy root check, build, dist verifier, dev contract và Astro E2E.
- Đổi raw-ingress/MCP packaging: chạy MCP `check` và `test:worker`; build release assets chỉ trong clean exact-SHA checkout.
- Đổi code/UI source được policy localization theo dõi: review diff, cập nhật exact source binding, dựng/check/publish candidate `--stage all`, rồi chạy public check; không sửa sidecar hay generation bằng tay.

Release/deploy, Worker asset publication và rollback production cần authorization riêng. Local acceptance không cấp quyền cho các thao tác đó.
