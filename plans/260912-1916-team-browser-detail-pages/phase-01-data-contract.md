---
phase: 1
title: "Bản dịch tên đội và bảo toàn nội dung cũ"
status: completed
priority: P1
effort: ""
dependencies: []
---

# Phase 1 — Bản dịch tên đội và bảo toàn nội dung cũ

## Goal

Xuất bản tên đội Việt và nội dung cũ có nguồn gốc rõ, không thay danh tính, điểm hoặc quyết định xét trùng. Đây là phase đã khảo sát sâu; thực hiện TDD trước khi sửa builder hoặc ghi generation mới.

## Evidence and scope

- `pipeline/recommended_identity.py:15-20,52-95`: alias/display map đã dùng chung, nhưng chưa nhận `kind: team`. Không thêm một từ điển dịch thứ hai.
- `pipeline/build_recommended_reference.py:42-105,232-334`: publication kiểm tra membership, hash payload và chọn generation nguyên tử; `otherTeams` chỉ lấy admitted.
- `js/recommended-reference-render.js:115-130`: chi tiết legacy giữ notes/alternatives nhưng chưa render counters.
- Snapshot khảo sát: 1,366 Recommended rows, 661 tên Trung khác nhau; 166 legacy originals, 53 có counters và 33 có team notes; ledger 40 distinct, 19 duplicate, 107 pendingIdentity. Các con số là baseline để đối chiếu, không sửa input nhằm đạt số cố định.

## Files

Tất cả đường dẫn dưới đây tương đối với worktree tuyệt đối đã chốt trong [plan.md](plan.md); không thao tác checkout main.

- Modify: `pipeline/recommended_identity.py`, `pipeline/recommended-identity-map.json` — thêm bản dịch tên đội trong map hiện có, không cấp stableId mới.
- Modify: `pipeline/report_recommended_translations.py`, `pipeline/recommended-missing-translations.json` — thống kê tên đội thiếu bản Việt cùng nguồn và xung đột.
- Modify: `pipeline/build_recommended_reference.py` — đọc dữ liệu legacy, kiểm tra liên kết, thêm nội dung hiển thị và hash input.
- Modify narrowly: `pipeline/sgsdeck_recommended.py`, `tests/test_sgsdeck_recommended.py` — display-only paragraph ownership từ cached DOM; giữ public raw parser output và corpus hash đầu vào dedup nguyên vẹn.
- Create: `pipeline/recommended-content-links.json` — danh sách liên kết được rà soát, không phải kết quả fuzzy matching.
- Modify: `tests/test_recommended_identity.py`, `tests/test_build_recommended_reference.py`, `tests/test_report_recommended_translations.py`; giữ các regression trong `tests/test_recommended_team_dedup.py`.
- Regenerate sau Green: `pipeline/recommended-other-teams.json`, generation mới và `src/data/recommended-reference/current.json`, worksheet. Không ghi đè thư mục generation cũ.
- Intentionally unchanged: `data/teams.json`, cấu hình/đánh giá gameplay, crawler, raw parser contract và thuật toán dedup. Chỉ cho phép augmentation note ownership dưới đây, không parser/crawler redesign.

## Shared contract — proposed additions

### Tên đội

Entry trong identity map: `kind: "team"`, `aliases: [nameZh]`, `displayNameVi`, `reviewStatus: "translation-reviewed"`, `evidenceRef`; không có `stableId`. Dùng `alias_key` hiện có; không tự coi mọi dạng giản/phồn thể là tương đương. Entry có `sourceConfigId` tùy chọn chỉ áp dụng cho đúng cấu hình và alias nguồn đã kiểm tra; mục không có ID là bản dịch chung cho cùng tên nguồn. Duplicate/conflicting scoped entries phải fail-loud.

Thêm `resolve_team_display_name(row, mapping)` trong module hiện có: ưu tiên scoped entry đúng ID/tên, rồi bản dịch chung. Scoped entries có lookup riêng và không được chèn vào global `displayNames`, tránh dịch nhầm mọi cấu hình có cùng alias. Không đổi chữ ký các helper dành cho hero/tactic/book. Index và scoped details cùng nhận `displayNameVi`; giữ `nameZh` nguyên bản. Dùng tên/nickname legacy sẵn có cho đội cũ; không dùng nickname đó cho Recommended chỉ vì giống tên hoặc ba tướng.

Worksheet mở rộng loại team, ghi đủ raw aliases, ID, URL, số xuất hiện; từ chưa xác minh vẫn raw. Dịch toàn bộ tên đội có thể đối chiếu trong corpus, giữ khác biệt binh chủng/cải tạo/biến thể; trường hợp thuật ngữ thực sự mơ hồ cần ngữ cảnh và quyết định dịch, không bịa tên để đạt coverage. `戮力上心` không được tự đổi thành `勠力同心`; các bản dịch và bond đã duyệt giữ nguyên.

### Quyền sở hữu ghi chú — display-only

Parser hiện gom cùng paragraph vào holder.notesRaw và team.notesRaw (`pipeline/sgsdeck_recommended.py:206-207,222`), nên chỉ render đủ cả hai sẽ lặp hướng dẫn. Bổ sung projection `displayNotes: {schemaVersion: 1, blocks: [...]}` sau raw-corpus/ledger checks. Mỗi block có `id` theo paragraph occurrence trong DOM nguồn, `textRaw`, và owner `team` hoặc `primary`/`alternative` kèm holderIndex. Dùng cùng holder selector/parsed DOM, ancestor containment và thứ tự nguồn để gán mỗi occurrence đúng một owner; bỏ đúng hero-name paragraphs như parser cũ. Hai paragraphs khác occurrence dù text giống nhau vẫn giữ riêng.

Đặt raw-and-display extraction helper trong parser hiện hữu, reuse DOM thay vì parse lại; public raw parser vẫn trả các field/bytes như trước. Builder join/hash raw records trước, rồi gắn displayNotes vào index/detail. Không substring-replace hoặc trừ tập chuỗi giữa notesRaw và holder notes; cách đó không phân biệt đoạn chung cố ý lặp với một occurrence bị aggregate hai lần. Consumer phase 2 render projection ở đúng section, không render lại raw aggregate cạnh projection; raw vẫn lưu để đối chiếu và search.

### Nội dung legacy và liên kết Recommended

Giữ `/data/teams.json` là nguồn public của **tất cả originals**, gồm cả duplicate/pending; không đưa các dòng bị loại trở lại danh sách Team khác.

Thêm `legacyContent` vào mỗi admitted row: bản sao nguyên đối tượng legacy gốc, kèm `legacyContentSha256` tính bằng canonical JSON của đối tượng đó. ID phải tồn tại duy nhất; row vẫn dùng `legacyTeamId`/`legacyVariantId` đã có. Render cấu hình admitted và các phương án gốc có nhãn riêng, không ngầm coi mọi tổ hợp thay thế đều được admit hoặc có điểm. Không tạo thêm artifact sao chép cả 166 originals.

`recommended-content-links.json` dùng `{schemaVersion: 1, entries: [...]}`. Một entry có `sourceConfigId`, `legacyTeamId`, `legacyVariantId` khi có, `sourceContentSha256`, `legacyContentSha256`, `reviewStatus`, `evidenceRef`. Fingerprint nguồn tính trên bản ghi raw đã join, trước mọi display enrichment; fingerprint legacy tính trên toàn bộ đối tượng gốc. Cùng một quy tắc canonical được dùng ở validator/test, không hash bản đã dịch.

- Chỉ entry `reviewed` có evidence, IDs tồn tại và fingerprints khớp mới được publish thành `legacyReferences` trên index/detail nguồn, gồm locator, proof và `legacyContent` nguyên bản.
- Người rà soát phải kiểm tra đúng holder, slot chiến pháp/binh thư, chủ tướng, điều kiện và phạm vi hướng dẫn; dedup key giống nhau không tự tạo liên kết. Link không chuyển điểm, mùa hoặc eligibility từ nguồn sang legacy.
- Entry pending không được áp dụng vào Recommended; stale reviewed link làm build thất bại trước đổi selector. Không tự tạo reviewed entry hoặc evidence giả.
- Nếu không có liên kết nào đủ bằng chứng, danh sách reviewed rỗng là kết quả hợp lệ; phải ghi kết quả rà soát thật. Nội dung cũ vẫn đọc được qua trang original ở phase 2, không bị bỏ hoặc gắn bừa vào nguồn.

Thêm input CLI **proposed** `--teams data/teams.json` và `--content-links pipeline/recommended-content-links.json`. Hàm input builder có các tham số keyword tương ứng. Descriptor/manifest ghi hash của hai input (`legacyTeamsHash`, `contentLinksHash`), kể cả khi không có link active; payload hashes vẫn là authority. Giữ schemaVersion 1 cho trường bổ sung, dedupKeyVersion 1 không đổi. Root raw teams bytes được phase 2 pin độc lập để trang original không phụ thuộc Recommended có tải được hay không.

Ràng buộc cùng snapshot: đọc `--teams` bytes một lần, yêu cầu `ledger.localTeamsSha256 == "sha256:" + sha256(bytes)`, và `legacyTeamsHash` dùng chính giá trị có prefix đó. Không chỉ đối chiếu ID/row count. Phase 2 build catalog phải so selected manifest `legacyTeamsHash` với raw artifact bytes trước khi tạo cả original và source pages; runtime original vẫn độc lập Recommended.

Validation nội dung/lineage đặt ở **common publication boundary** của `build_generation`/`validate_generation_inputs`, không chỉ nhánh cache. `--input` và mọi caller trực tiếp phải cung cấp cùng authoritative teams/content-links/ledger context để kiểm tra hoặc tái dẫn xuất enrichment; không tin `legacyReferences`/`legacyContent` tự nhét trong JSON. Giữ parser cache-only dùng bởi dedup không tự publish/enrich. Migrate toàn bộ publication callers/tests; không giữ đường publish legacy bỏ qua proofs. Kiểm tra explicit shared title/lineage equality theo sourceConfigId giữa index/detail: validator hiện tại mới kiểm tra membership/ordered IDs.

Common validator cũng kiểm tra displayNotes owner/index hợp lệ, occurrence IDs duy nhất trong mỗi record và projection thống nhất index/detail. Đây là field hiển thị mới, không được đưa vào raw source fingerprint hoặc dedup corpus. P1.3 sở hữu projection này cùng lineage enrichment.

## TDD — Red before Green

Viết/mở rộng các test hành vi sau trước khi sửa source; chạy từng test và ghi thất bại đúng lý do, không chấp nhận collection/import error là Red:

- **D1 — title identity:** cùng alias dùng bản dịch chung; scoped title chỉ thay đúng sourceConfigId; thay bản Việt không đổi nameZh, ID, raw holders, resolve_identity hoặc dedup key. Alias collision/scoped mismatch bị từ chối.
- **D2 — worksheet:** phát hiện title thiếu/ambiguous có ngữ cảnh, sau review thì hết thiếu ở cả index/detail. Cùng alias nhưng chỉ một sourceConfigId có scoped translation thì các ID khác vẫn được báo thiếu; cache resolution phải chứa sourceConfigId khi xử lý team. Bond không trở thành tactic thiếu dịch; typo chưa xác thực vẫn tồn tại.
- **D3 — preservation/ownership:** admitted legacy giữ nguyên counters good/avoid, team/hero notes và tactic/book/hero alternatives; originals không đổi và duplicate/pending không lọt list. Fixture nguồn có một common paragraph, primary và alternative paragraphs: projection sở hữu mỗi occurrence một lần, giữ hai occurrence có cùng text ở hai chủ thể khác nhau; raw parser record và dedup corpus hash không đổi. Dùng thêm og-bingyan-40y-lvbu-b hoặc s23-sp-xunyu-shanhe-gong-2 làm case aggregate overlap đã quan sát.
- **D4 — linkage boundary:** cùng tên/cùng dedup key nhưng khác binh thư hoặc chủ tướng không tự mang notes/counters sang nguồn. Reviewed exact link hiển thị được riêng; missing ID, sai variant, stale source/legacy fingerprint hoặc ledger.localTeamsSha256 khác input đều fail trước đổi selector. Cả nhánh cache, CLI --input và direct build_generation phải từ chối pending/pre-enriched unverified references.
- **D5 — provenance/determinism:** sửa nội dung/link input làm generation hash đổi; build cùng input ra cùng bytes; mapping identity-only hash và ledger decisions giữ nguyên sau dịch. Mismatch title/lineage index/detail bị reject, không chỉ đối chiếu IDs. Legacy hash prefix/bytes nhất quán với ledger và artifact đọc ở Astro.
- **D6 — score/source boundaries:** giữ 0, số thập phân, >100 và null đúng nghĩa; không lấy stars/historicalTier làm value. Scope empty/uncollected vẫn không có rows sau enrichment.

## Tasks

- [x] P1.1 Ghi baseline payload/ledger và chạy Red D1–D6.
- [x] P1.2 Mở rộng shared title map, worksheet và hoàn tất rà soát tên đội.
- [x] P1.3 Bổ sung legacyContent, reviewed links, fingerprint validation và input hashes.
- [x] P1.4 Chạy Green, tái tạo publication và chứng minh bất biến trước bàn giao.

## Verification commands

Chạy từ worktree; các test name D1–D6 là contract đề xuất, chọn tên unittest cụ thể khi viết test.

```sh
python3 -m unittest tests.test_sgsdeck_recommended tests.test_recommended_identity tests.test_build_recommended_reference tests.test_report_recommended_translations tests.test_recommended_team_dedup
python3 -m pipeline.recommended_team_dedup --teams data/teams.json --team-tier data/team-tier.json --cache .cache/sgsdeck-recommended --identity-map pipeline/recommended-identity-map.json --output pipeline/recommended-other-teams.json
python3 -m pipeline.build_recommended_reference --cache .cache/sgsdeck-recommended --identity-map pipeline/recommended-identity-map.json --other-ledger pipeline/recommended-other-teams.json --teams data/teams.json --content-links pipeline/recommended-content-links.json --output src/data/recommended-reference
python3 -m pipeline.report_recommended_translations --reference-dir src/data/recommended-reference --identity-map pipeline/recommended-identity-map.json --output pipeline/recommended-missing-translations.json
```

Builder command có hai flag mới: chỉ chạy sau khi implement và kiểm tra `--help`. Cache phải tồn tại/khớp frozen inventory; không crawl lại âm thầm. Dùng temporary directory cho unit fixtures và output thử, chỉ chọn publication cuối sau Green.

## Exit evidence

Lưu Red/Green, danh sách title còn mơ hồ nếu có, kết quả rà soát links và so sánh toàn bộ corpus vào report của plan. So sánh raw/ID/ordering/score/ledger sau khi loại đúng các trường display/lineage/hash mới đã định nghĩa, không dùng một bộ lọc bỏ mọi khác biệt. Old originals phải byte-equal. Chưa chuyển phase nếu thiếu tên đội do chưa thực hiện rà soát, link stale, hoặc mất nội dung; thuật ngữ thực sự chưa xác thực giữ raw kèm bằng chứng, không giả nhận đã dịch.
