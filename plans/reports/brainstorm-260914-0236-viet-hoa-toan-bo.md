---
type: brainstorm
status: accepted
created: 2026-09-14 02:36
updated: 2026-09-14
scope: website-localization
source-generation: b23e24e6fd526c294dc9965d5b66e4219153668733adf471f5fd816846c6154c
translation-fix-generation: fb8b3871d76792ffa812ded103ee0c52f83ab3607fd294085e33d088422bfb8e
---

# Brainstorm Việt hoá toàn bộ website

## Tóm tắt

Chọn phương án Việt hoá có kiểm soát tại thời điểm build. Dữ liệu nguồn tiếng Trung tiếp tục được lưu nguyên vẹn để truy vết, nhưng giao diện mặc định chỉ hiển thị bản tiếng Việt đã được duyệt. Không dịch trực tiếp lúc người dùng mở trang và không ghi đè các trường nguồn.

## Outcome

- Mọi nội dung người dùng nhìn thấy trên website mặc định sử dụng tiếng Việt.
- Tên tướng, đội, chiến pháp, binh thư và thuật ngữ gameplay thống nhất với registry hiện có.
- Nội dung nguồn tiếng Trung vẫn được giữ để kiểm chứng và có thể tìm kiếm, nhưng không xuất hiện mặc định.
- Dữ liệu mới chưa được Việt hoá không thể lọt vào bản phát hành.

## Bằng chứng hiện tại

Audit thế hệ Recommended `b23e24e6fd526c294dc9965d5b66e4219153668733adf471f5fd816846c6154c` ghi nhận:

- 1.366 đội Recommended.
- 1.967 khối ghi chú trong projection; 1.928 khối chứa chữ Hán đang được renderer đọc từ `displayNotes.blocks[].textRaw`.
- 1.117 nội dung ghi chú tiếng Trung duy nhất cần dịch.
- 11 ô chiến pháp `戮力上心` vẫn có `tacticSlotsVi` bằng `null`. Registry Tra cứu đã có tên Hán–Việt “Lục Lực Thượng Tâm”; chưa phải bằng chứng tên client Việt chính thức.
- 1.366 trang đội hiển thị tên nguồn tiếng Trung dưới tiêu đề; có 661 tên nguồn duy nhất.
- Phần Cộng điểm đã có `statFocusVi` và không còn chữ Hán trên giao diện đã kiểm tra.

Vòng tiếp tục đã đếm trực tiếp index và detail của generation trên, đồng thời đối chiếu code các consumer. `pipeline/recommended-missing-translations.json` vẫn trỏ generation `b69cddeb19acbb06f0bccabe99412d8d54ac3032514582281e1941fbe56da02d`, nên worksheet này phải được sinh lại; số 11 ở trên được xác nhận riêng từ artifact hiện tại.

Kiểm kê sơ bộ ngoài Recommended:

- **Đội khác/đội cũ:** `js/app.js` dùng projection Recommended cho tab Team khác; trang legacy và các consumer đội cũ vẫn cần kiểm riêng. Quét `data/teams.json` thấy sáu trường `notes` chứa chữ Hán; không suy ra tất cả đều xuất hiện trên tab Team khác.
- **Cùng Tồn:** `js/render.js:seasonCoexistGroup` render trực tiếp `summaryRaw`, `openingSuggestionsRaw`, `notesRaw`, `teamNameRaw`, slot tướng/chiến pháp/binh thư và disclaimer nguồn. Phải thêm projection Việt, không dịch đè raw.
- **Khai Hoang:** `js/render.js:khaihoangTable` có lựa chọn build và nhiều nội dung điều kiện/ghi chú/nhãn nguồn. Quét các trường `displayLabel`, `displayNote`, `note`, `label` trong dữ liệu thấy 15 giá trị chứa chữ Hán; đây là tập ứng viên, chưa phải số lỗi UI. Phải phân loại tên tác giả được miễn dịch và kiểm từng build có thể chọn.
- **Tra cứu:** đường chạy hiện tại là `js/unified-lookup.js` và `js/lookup-detail.js`; alias Trung dùng tìm kiếm không phải lỗi hiển thị. Các fallback trong `hero-list.js`/`hero-detail.js` cũ chỉ tính vào UI đang hoạt động khi chứng minh có consumer; việc các file được đóng gói không đủ chứng minh route sử dụng chúng.
- **Phạm vi còn phải audit đầy đủ:** tám mục ở `src/pages/index.astro`, gồm cả Theo dõi chiêu mộ, Soi đội từ ảnh và Gợi ý đội từ kho; các trang đội độc lập, menu, bộ lọc, tooltip, tên truy cập, trạng thái tải/rỗng/lỗi và kết quả tương tác.

Chưa chạy browser audit, build hoặc E2E trong vòng brainstorm này. Các đếm dữ liệu và đường render trên không phải chứng nhận toàn website đã được kiểm kê hoàn tất.

## Constraints

- Không sửa, xoá hoặc dịch đè `nameRaw`, `notesRaw`, `textRaw` và các trường nguồn tương đương.
- Không gọi API dịch trong runtime của trình duyệt.
- Không tạo tên Việt chính thức khi chưa có bằng chứng. Trường hợp chưa xác định phải dùng bản dịch mô tả rõ ràng và trạng thái rà soát.
- Tên riêng và thuật ngữ game phải tái sử dụng `recommended-identity-map.json`, từ điển tướng, chiến pháp và binh thư hiện có.
- Tìm kiếm có thể lập chỉ mục cả tiếng Việt lẫn tiếng Trung dù giao diện chỉ hiển thị tiếng Việt.
- Pipeline phải deterministic: cùng dữ liệu nguồn và catalog dịch phải tạo cùng generation.
- Giữ hash/lineage của dữ liệu nguồn không đổi khi chỉ sửa bản dịch; generation và hash artifact hiển thị phải đổi theo nội dung Việt. Không yêu cầu giữ nguyên generation cũ.
- Không mở rộng public DTO Tra cứu để đưa raw/provenance lên website. Raw Recommended được giữ theo contract hiện có; “giữ nguồn” không đồng nghĩa phát hành thêm nguồn nội bộ.
- Thuật ngữ giao diện tiếng Anh cũng thuộc phạm vi Việt hoá. Mã game như SP/CO/40Y, cấp T0/T1, tên sản phẩm, tác giả và URL giữ nguyên khi đúng vai trò; không dùng allowlist rộng để miễn cả đoạn văn.

## Non-goals

- Không thay đổi ý nghĩa, đánh giá meta hoặc khuyến nghị chiến thuật của nguồn.
- Không xoá dữ liệu Trung khỏi repository.
- Không dịch URL, mã cấu hình, hash, tên tác giả hoặc thông tin provenance không phải nội dung giao diện.
- Không gộp công việc Việt hoá lớn vào PR `statFocus` đã merge.

## Phương án đã xem xét

### Dịch tự động khi chạy website

Ưu điểm là ít dữ liệu phải quản lý ban đầu. Nhược điểm là phụ thuộc dịch vụ ngoài, tăng độ trễ, kết quả thay đổi theo thời gian và dễ dịch sai thuật ngữ Tam Quốc Chí. Phương án thất bại khi dịch vụ không khả dụng hoặc bản dịch mới khác bản đã review.

**Quyết định:** loại.

### Ghi đè dữ liệu nguồn bằng tiếng Việt

Ưu điểm là renderer đơn giản. Nhược điểm là mất nguyên văn, phá hash và làm yếu khả năng kiểm chứng dữ liệu SGSDeck. Phương án thất bại khi cần đối chiếu hoặc cập nhật lại từ nguồn.

**Quyết định:** loại.

### Catalog dịch tại build-time

Mỗi nội dung có nguyên văn, bản Việt, trạng thái và bằng chứng. Pipeline ghép bản dịch vào projection hiển thị, trong khi dữ liệu nguồn được giữ nguyên. Phương án này tốn công rà soát ban đầu nhưng deterministic, dễ review và có thể chặn thiếu bản dịch trước release.

**Quyết định:** chọn.

## Thiết kế đề xuất

### Catalog nội dung dài

Tách catalog ghi chú khỏi `recommended-identity-map.json`, nhưng tái sử dụng quy ước ledger đã có trong `pipeline/lookup_translations.py`; không tạo chuẩn `translationStatus`/`evidenceRef` thứ hai cho nội dung dài.

- Ledger hiện có: `schemaVersion`, `glossaryVersion`, `entries`.
- Mỗi entry: `entityId`, `fieldPath`, `inputFingerprint`, `textVi`, `status`, `review`.
- Review: `reviewer`, `reviewedAt`, `evidence`, `semanticChecks`; chỉ `status: reviewed` được xuất bản.
- Fingerprint hiện có băm canonical JSON của entity, field, giá trị nguồn, phiên bản glossary và context. Tái sử dụng cách serialize/hash này, không tự chuẩn hoá giản/phồn thể hoặc bỏ dấu câu để ghép bản dịch.
- Khóa entry theo record và trường/block nguồn; context phải giữ loại owner, holder và nội dung liên quan để thay owner hoặc nguồn làm bản duyệt cũ mất hiệu lực.
- Giữ nguyên văn ở artifact nguồn và hiển thị cạnh bản Việt trong tập review. Schema ledger hiện có không chứa `textRaw`; không thêm trường ngoài schema chỉ để lặp lại nguồn.

Tập dịch duy nhất dùng để giảm công soạn nháp, không thay thế khóa xuất bản theo ngữ cảnh. Một câu giống hệt có thể tái sử dụng bản dịch sau khi xác nhận ngữ cảnh tương đương; không gộp mất các vị trí sử dụng hoặc owner. Bản nháp chưa duyệt nằm ngoài ledger xuất bản.

Tra cứu hiện có 3.503 entry trong `pipeline/lookup-translations.json`. Việc entry mang trạng thái `reviewed` là dữ liệu đã ghi nhận, không chứng minh vòng brainstorm này đã duyệt lại nội dung của chúng.

### Projection dữ liệu

- Pipeline thêm `textVi` vào từng `displayNotes.blocks[]`.
- `textRaw` tiếp tục được giữ trong artifact nguồn và có thể được search index sử dụng.
- Mọi trường hiển thị thuộc phạm vi dịch nhưng thiếu bản duyệt hoặc có fingerprint cũ phải chặn build, kể cả khi nguyên văn không chứa chữ Hán. Báo source record, field/block và owner cụ thể.
- Index và detail phải dùng cùng một projection để tránh lệch bản dịch.
- Phân biệt nguồn thực sự thiếu với bản dịch thiếu. Chỉ trường hợp nguồn thiếu mới dùng trạng thái thiếu dữ liệu đã Việt hoá; không xóa ghi chú, thay câu bằng placeholder hoặc ẩn bản ghi để vượt cổng.

### Renderer

- Renderer chỉ hiển thị `textVi` cho ghi chú đã projection.
- Production không fallback từ `textVi` sang `textRaw`.
- Tên đội nguồn tiếng Trung dưới tiêu đề được bỏ khỏi giao diện mặc định; provenance vẫn giữ trong payload và liên kết SGSDeck.
- Không thêm disclosure “Nguyên văn nguồn”. Người dùng đối chiếu qua liên kết nguồn hiện có; nội dung dẫn link được Việt hoá, còn tên tác giả và URL giữ nguyên. Không mở raw/provenance của Tra cứu.

### Registry thuật ngữ

- Bảo vệ tên tướng, chiến pháp, binh thư, binh chủng và tên đội trước khi dịch câu.
- Ưu tiên tên client Việt đã xác nhận.
- Nếu chưa có tên chính thức, dùng một bản dịch mô tả nhất quán thay vì tự tạo nhiều tên Hán–Việt khác nhau.
- `pipeline/lookup-identity.json` hiện ghi `戮力上心` → `tactic:luc-luc-thuong-tam`, tên “Lục Lực Thượng Tâm”. Đây chỉ là trạng thái registry, không phải bằng chứng danh tính chiến pháp; **rút đề xuất tái sử dụng tên này để tự động điền 11 ô** sau đối chiếu ngày 2026-09-14.
- Chiến pháp Nội chính của Tào Phi được nguồn chính thức ghi là `戮力上国`, hiệu ứng giảm thời gian nâng cấp công trình. Chiến pháp sự kiện được bài cộng đồng gọi tắt “戮力” là `勠力同心`, project đã có tên “Đồng Lòng Hợp Sức”. Chưa có bằng chứng nối chính xác chuỗi `戮力上心` trong 11 cấu hình sang một trong hai danh tính này.
- Sau ảnh tiếng Việt và yêu cầu “Xử lý đi” của người dùng, duyệt **hiển thị** 11 ô là “Đồng Lòng Hợp Sức” bằng cơ chế `translation-reviewed` hiện có. Giữ raw, không gán stable ID, không gộp vào `勠力同心` và không đổi Nội chính `戮力上国`; đây không phải xác minh danh tính nguồn để xét trùng hoặc xác nhận gameplay.

### Quy trình soạn và duyệt

**Người dùng đã chọn:** AI soạn, một lượt AI độc lập kiểm từng mục với nguồn; chỉ chuyển các ca mơ hồ hoặc mâu thuẫn chưa giải quyết được cho người dùng.

1. Chốt glossary từ registry và fingerprint nguồn; trích xuất các vị trí sử dụng với owner/context.
2. AI soạn nháp theo nhóm nội dung có ngữ cảnh liên quan. Không dùng runtime dịch và không xây giao diện quản trị dịch mới.
3. Lượt AI độc lập nhận nguyên văn, bản nháp, glossary và context; đối chiếu đầy đủ số, khoảng, đơn vị, phần trăm, mục tiêu, điều kiện, phủ định, thứ tự và tên riêng. Không chỉ kiểm mẫu hoặc kiểm “câu Việt đọc xuôi”.
4. Mục bị từ chối được sửa và kiểm lại. Bất đồng chưa giải quyết giữ ngoài ledger xuất bản và chuyển người dùng; không tự nâng trạng thái.
5. Ghi reviewer, evidence và semanticChecks từ lượt kiểm thực tế. Chỉ ledger đã duyệt đủ coverage/fingerprint mới được ghép vào projection.

Phương án còn lại là AI soạn rồi người dùng duyệt toàn bộ: quyền duyệt trực tiếp rõ hơn nhưng đòi hỏi đọc toàn bộ tập dịch. Người dùng không chọn phương án này. Phương án được chọn phụ thuộc năng lực đối chiếu độc lập; điểm dễ thất bại nhất là hai lượt cùng hiểu sai một cơ chế. Glossary, kiểm invariant và cơ chế chuyển ca khó giảm rủi ro, không bảo đảm bản dịch đúng tuyệt đối.

Về nguyên văn, disclosure tại trang đội cho phép đối chiếu tại chỗ nhưng thêm UI và phạm vi kiểm tra. Người dùng chọn chỉ qua liên kết vì gọn hơn; đánh đổi là khi nguồn ngoài mất hoặc đổi nội dung, người đọc phải nhờ maintainer đối chiếu snapshot nội bộ.

### Cổng phát hành

Bổ sung kiểm tra trên dữ liệu projection và output build:

- Kiểm coverage và freshness trên tập trường cần dịch được trích xuất từ đúng generation nguồn, không chỉ quét ký tự Hán.
- Không còn ký tự Hán trong nội dung UI do website cung cấp; kiểm cả text hiển thị, tiêu đề, nhãn truy cập, placeholder và tooltip. Dùng nhận diện Unicode Han đầy đủ thay vì chỉ khoảng ký tự thông dụng.
- Raw, alias tìm kiếm, URL và metadata không render được miễn quét hiển thị theo trường cụ thể. Không miễn cả subtree chỉ vì tên là provenance.
- Phân loại tên tác giả/người dùng và nội dung do người dùng nhập hoặc ảnh tải lên; giữ chúng nguyên trạng, nhưng nhãn, thông báo và phần diễn giải do website tạo phải bằng tiếng Việt.
- Audit riêng nhãn tiếng Anh theo inventory UI; no-Han không chứng minh toàn bộ nội dung là tiếng Việt.
- Báo chính xác route/trạng thái tương tác, trường, owner và nguyên văn chưa dịch.
- Quét HTML tĩnh lẫn DOM JavaScript sau khi đổi tab, build, bộ lọc, mở modal/chi tiết và gặp trạng thái rỗng/lỗi. Không coi một lần quét DOM ban đầu là toàn bộ website.
- Dữ liệu nguồn mới phải có catalog hợp lệ trước khi generation mới được xuất bản. Không xóa dữ liệu để giảm denominator coverage.

## Trình tự triển khai đề xuất

1. Lập inventory đủ tám mục điều hướng, route đội độc lập và các trạng thái tương tác; phân loại UI cần dịch, raw/search-only và ngoại lệ tên riêng. Sinh lại worksheet từ generation đang pin.
2. Chốt schema catalog theo ledger hiện có, cách định danh block/owner và tập expected fingerprints; giữ map tên ngắn riêng.
3. Trích xuất tập nháp có thể tái sử dụng, khóa glossary, AI soạn và AI độc lập kiểm từng mục; chuyển ca chưa giải quyết cho người dùng.
4. Ghép bản Việt vào pipeline Recommended; nối tên chiến pháp từ registry theo exact identity, không sửa nội dung chiến thuật nguồn.
5. Chuyển renderer và search: chỉ render projection Việt, giữ alias Trung cho truy vấn; bỏ phụ đề tên nguồn, không thêm disclosure.
6. Xử lý Cùng Tồn, Khai Hoang, đội cũ và các bề mặt còn lại từ inventory; giữ ownership/lineage và contract riêng tư của Tra cứu.
7. Thêm cổng coverage/fingerprint, no-Han và kiểm nhãn giao diện cho build/CI.
8. Build, chạy contract tests, full E2E và smoke test trình duyệt; đối chiếu đầy đủ inventory trước kết luận hoàn thành.

## Acceptance criteria

- Mọi mục trong inventory toàn website đạt kiểm tra tiếng Việt; không thu hẹp kết luận thành “mọi trang đã audit” khi còn route/trạng thái chưa kiểm.
- Không còn chữ Hán trong nội dung UI do website cung cấp, trừ ngoại lệ tên riêng đã phân loại; nhãn tiếng Anh được dịch hoặc giữ dưới dạng mã/tên sản phẩm có lý do cụ thể.
- Không còn fallback giao diện từ `textVi` sang `textRaw`, `nameZh` hoặc tên chiến pháp Trung; không thêm disclosure nguyên văn.
- Mọi trường cần dịch mới hoặc thay nguồn/context/glossary bị build chặn cho tới khi có bản duyệt đúng fingerprint và đủ coverage, dù nguồn có chữ Hán hay không.
- Một bản dịch “reviewed” phải có bằng chứng lượt AI kiểm độc lập thực tế; không dùng kiểm mẫu hoặc trạng thái tự khai làm bằng chứng duyệt toàn bộ.
- Tìm kiếm bằng tên Việt và alias Trung vẫn trả đúng đội.
- Bản dịch giữ đúng owner: ghi chú đội, tướng chính và tướng thay thế không bị gộp sai.
- Cùng input nguồn, registry, glossary và ledger tạo byte-identical artifact. Hash/lineage nguồn giữ nguyên; sửa bản dịch phải thay generation hiển thị và các manifest liên quan.
- Build, dist contracts, full E2E và smoke test trình duyệt đều đạt.

## Rủi ro và biện pháp

- **Dịch sai thuật ngữ:** khóa glossary và review theo batch nhỏ.
- **Câu giống nhau nhưng khác ngữ cảnh:** catalog cho phép khóa theo ngữ cảnh khi exact-string reuse không an toàn.
- **Nguồn cập nhật làm thay đổi câu:** validator báo delta thay vì fallback sang raw.
- **Catalog quá lớn:** tách nội dung dài khỏi registry tên ngắn và sinh báo cáo missing riêng.
- **No-Han gate báo nhầm dữ liệu provenance:** kiểm tra theo allowlist trường, không cấm chữ Hán trên toàn repository.

## Đính chính danh tính chiến pháp — 2026-09-14

**Mục tiêu:** phân biệt `戮力上国`, tên gọi tắt `戮力` và chuỗi nguồn `戮力上心`; sửa kết luận brainstorm, không sửa dữ liệu runtime, tier, cấu hình đội hoặc phát hành. Server/mùa/patch mục tiêu: unknown; người dùng đang cung cấp nguồn phân biệt danh tính, chưa chốt phạm vi game mới.

**Kết luận trước bị thay thế:** đề xuất nối tên registry “Lục Lực Thượng Tâm” vào 11 slot sau kiểm exact alias. Tên nguồn trùng chuỗi với registry không đủ chứng minh hai bản ghi có danh tính/cơ chế đúng. Kết luận mới: 11 vị trí là vấn đề danh tính cần xác minh, không chỉ là thiếu bản dịch.

- **Đã đối chiếu — chiến pháp Nội chính:** trang [Lingxi về Tào Phi](https://community.lingxigames.com/m/s3/strategy_wj/detail-350659087930767364-445977605140658180), mục 自带战法, ghi `戮力上国` và “委任为主政官时，城建设施升级时间降低15%”. Bài [Gamersky ngày 2020-01-16](https://www.gamersky.com/handbooksy/202001/1257150.shtml), mục 战法介绍, ghi mức tối đa 30%. Do đó 15%–30% giảm thời gian nâng cấp công trình có bằng chứng ở các nguồn đã đọc; không phải hiệu ứng tăng sản lượng của record `戮力上心` hiện tại. Gamersky ghi nguồn 官方微信, không tính là bằng chứng hoàn toàn độc lập với publisher.
- **Đã đối chiếu — tên gọi trong bài cộng đồng:** [Bahamut ngày 2025-10-24](https://forum.gamer.com.tw/C.php?bsn=36815&snA=10949) có tiêu đề gọi tắt “戮力or嬰城”, nhưng phản hồi tầng 2 viết đầy đủ `勠力同心` và đề xuất đi cùng `靈機一動`. Không dùng tên gọi tắt để sinh danh tính chiến pháp mới “Lục Lực”.
- **Phương án từ nguồn — cơ chế chiến pháp sự kiện:** phần dẫn đọc được của [233乐园 ngày 2025-11-26](https://www.233leyuan.com/post-detail/1993784451508369469) mô tả `勠力同心` là Chủ động 50%, trị liệu ngẫu nhiên 1–4 lần và tăng Thống Soái theo Trí Lực. Bài mang nhãn đăng lại và phần dẫn có dấu hiệu hỗ trợ AI; ảnh nội dung chưa được đọc trong vòng này, nên không coi đây là xác minh cơ chế độc lập đầy đủ.
- **Đã đối chiếu — lịch sử project:** [bản sửa ngày 2026-09-06](implementation-260906-1431-khaihoang-source-options.md) đã tách “Đồng Lòng Hợp Sức” (`勠力同心`) khỏi “Lục Lực Thượng Quốc” (`戮力上国`) và ghi nhận bằng chứng ảnh client. Vòng hiện tại đọc báo cáo đó, không tuyên bố đã xem lại ảnh.
- **Đã đối chiếu — ảnh tiếng Việt người dùng cung cấp ngày 2026-09-14:** đã đọc trực tiếp Image #1, kích thước 847×381. Tên hiển thị “Đồng Lòng Hợp Sức”; loại Chủ động, xác suất 50%, mục tiêu một quân ta. Hiệu ứng: ngẫu nhiên 1–4 lần trị liệu, tỷ lệ 51%→102% chịu ảnh hưởng Trí Lực; tăng 8→16 Thống Soái chịu ảnh hưởng Trí Lực, có thể cộng dồn, duy trì 2 hiệp. Dòng xung đột ghi “Không”; phần nguồn ghi chiến pháp sự kiện. Dòng “Dùng xếp hạng Võ Tướng” có SP Điêu Thuyền, nhưng không phải ảnh cấu hình 11 đội SGSDeck. Ảnh chốt tên Việt và mô tả hiển thị của chiến pháp hồi phục, không có chữ Hán để chứng minh trực tiếp alias `戮力上心`. Không cần hỏi lại tên Việt này; xuất xứ trang, server, mùa và patch của ảnh chưa được cung cấp.
- **Chưa xác minh — điều kiện đổi:** thông tin người dùng cung cấp “Tào Tháo + Tuân Úc” chưa được các nội dung đã đọc xác nhận đủ. Bình luận Bahamut có trao đổi về cách đổi khác nhưng không đủ xác lập công thức theo server/mùa; không đưa công thức tiêu tướng vào hướng dẫn hành động.
- **Chưa xác minh — 11 slot `戮力上心`:** artifact local xác nhận chuỗi này nằm ở slot thứ hai của SP Điêu Thuyền trong 11 cấu hình. Chưa xác định được đây là lỗi tên nguồn, mapping hay danh tính khác. Không suy ra nó chính là `勠力同心` chỉ từ việc hồi phục phù hợp đội hình.

**SGSDeck:** đã mở [cấu hình Hán Thất Cung](https://sgsdeck.com/recommended/s27-han-hanshi-gong-1), nhưng bộ đọc chỉ trả vỏ trang và tiêu đề, không trả đầy đủ slot. Với phép nối danh tính đang tranh chấp: **chưa có mốc SGSDeck đã xác minh** từ nội dung live đọc được. Snapshot local vẫn chứng minh trạng thái đã nhập; không chuyển điểm/tier hoặc xác nhận áp dụng Global.

**Phạm vi truy cập:** đọc văn bản của năm URL nêu trên; không mở ảnh/video trên các website, Facebook, Zhihu hoặc link ejoy do người dùng đưa. Sau đó đã xem trực tiếp ảnh tiếng Việt 847×381 do người dùng đính kèm trong cuộc trò chuyện; không phát sinh truy cập nguồn ngoài. Ngày đọc 2026-09-14; ngày xuất bản của trang Lingxi/SGSDeck và patch tương ứng unknown. Nguồn lịch sử không tự xác nhận phiên bản live hiện tại.

**External-call ledger:** topic `phan-biet-luc-luc-va-11-slot-sp-dieu-thuyen`; limit 5; used 5; remaining 0. Không mở thêm nguồn trong vòng này. Các truy vấn local không tính vào ledger.

**Quyết định triển khai sau yêu cầu người dùng:** sử dụng ranh giới duyệt hiển thị/danh tính đã có trong `pipeline/recommended_identity.py`. Tên Việt được duyệt cho Recommended, còn danh tính nguồn tiếp tục unresolved; không cần tạo resolver mới hoặc sửa từ điển Tra cứu. Bước xác minh danh tính nếu thực hiện sau này phải có bằng chứng riêng, không tự nâng trạng thái từ bản dịch.

### Kết quả sửa 11 ô — 2026-09-14

- Thêm một entry `translation-reviewed` cho `戮力上心` → “Đồng Lòng Hợp Sức” trong `pipeline/recommended-identity-map.json`, có evidenceRef tới xác nhận/ảnh người dùng và báo cáo này.
- Cache `.cache/sgsdeck-recommended` không có ở checkout hiện tại; đã tìm thấy cache đóng băng trong worktree `CamNangTQCCL-season-team-lookup`. Trước khi dùng, đối chiếu inventory hash và corpus hash của đủ 1.366 raw record với publication đang pin; cả hai khớp. Không recrawl hoặc tạo bằng chứng nguồn giả.
- Chạy dedup → builder → report bằng pipeline hiện có. Generation mới `fb8b3871d76792ffa812ded103ee0c52f83ab3607fd294085e33d088422bfb8e`; worksheet báo **0 tên thiếu bản Việt**, không phải 0 đoạn văn chưa Việt hoá.
- So sánh toàn bộ payload trước/sau: đúng **22 giá trị** thay đổi, là 11 `tacticSlotsVi[1]` ở index và 11 vị trí tương ứng trong detail, từ `null` sang “Đồng Lòng Hợp Sức”. Các trường khác, raw, owner, số đội và quyết định/admitted của dedup giữ nguyên. Hash nguồn, nội dung đội cũ, liên kết và năm file được bảo vệ gồm từ điển/manifest Tra cứu không đổi.
- Regression `test_luc_luc_display_approval_does_not_merge_combat_and_internal_identities` thất bại trước sửa với `None != 'Đồng Lòng Hợp Sức'`, đạt sau sửa; tiếp tục kiểm danh tính source unresolved và Nội chính/chiến đấu không bị gộp.
- **Kiểm chứng đạt:** 44 Python tests cho identity/dedup/builder/report/parser; 23 JS contracts cho Recommended và route/navigation; Astro check 0 lỗi/cảnh báo; build 1.534 trang; verify 1.678 file dist; 22 dist contracts.
- Dựng lại từ cache vào thư mục tạm tạo selector, manifest và toàn bộ payload byte-identical; thư mục tạm đã xóa.
- Trình duyệt mở đủ 11 route, xác nhận SP Điêu Thuyền hiển thị “Đồng Lòng Hợp Sức”, không còn `戮力上心` trong khối tướng đó, không phát sinh page error. Đã kiểm ảnh giao diện ở màn hình 390px. Không chạy full E2E toàn website vì lần sửa này chỉ đổi mapping dữ liệu.
- Cổng 4322 đã có dev server cũ; preview tự chuyển sang 4323. Đã nhận diện đúng cổng từ log và kiểm bản build mới ở 4323; không dừng hoặc sửa server cũ của người dùng. Server dev đang mở cần khởi động lại để nhận generation mới theo contract hiện có.
- Không sửa renderer, từ điển Tra cứu, tier hoặc dữ liệu nguồn. Chưa commit, push hoặc deploy.

## Trạng thái bàn giao

- Bốn trường contract trong báo cáo tiếp tục là cơ sở cho bước lập kế hoạch; hướng build-time không thay đổi.
- Hai lựa chọn sản phẩm đã được người dùng chốt trong vòng tiếp tục: chỉ liên kết nguồn và AI soạn/AI kiểm độc lập.
- Các quy tắc catalog/coverage ở trên là đề xuất kỹ thuật đã đối chiếu code hiện có, chưa phải implementation.
- Riêng 11 ô chiến pháp đã được sửa và kiểm chứng local theo mục kết quả ở trên. Catalog ghi chú và phần Việt hoá toàn website chưa triển khai; không coi bản sửa nhỏ này là hoàn thành toàn bộ brainstorm.
- Bước kế tiếp: lập kế hoạch triển khai theo inventory đầy đủ; mang theo outcome, constraints, non-goals, acceptance và hai lựa chọn đã chốt, không hỏi lại chúng.

## Rủi ro chưa khép lại

- Việc hiển thị 11 ô đã hoàn tất theo bản duyệt người dùng. Danh tính nguồn `戮力上心` vẫn unresolved cho dedup; không dùng bản duyệt hiển thị làm chứng cứ để gộp với chiến pháp khác hoặc sửa từ điển Tra cứu.
- Tổng tập dịch ngoài Recommended và coverage các trạng thái động phải được đo trong bước inventory; 1.117 không phải tổng số đoạn cần dịch của toàn website.
- AI kiểm độc lập vẫn có thể cùng mắc lỗi ngữ nghĩa với lượt soạn. Nếu không giải quyết được bằng nguồn và glossary, phải dừng mục đó để hỏi người dùng.
