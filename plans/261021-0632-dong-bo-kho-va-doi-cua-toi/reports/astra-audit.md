# Verdict: cần sửa trước

Audit ngày 2026-10-21. Có **1 Critical, 9 High, 6 Medium**. Chưa nên chuyển sang cook implementation; cần bổ sung các invariant và gate dưới đây vào hợp đồng phase 1 trước khi duyệt schema.

Phạm vi: đọc `plan.md`, toàn bộ phase 01–07, code/test liên quan và plan Đội cộng đồng; đọc trực tiếp nội dung GitHub issues #21/#23 bằng `gh issue view`. Chỉ chạy các phép đọc/đối chiếu JS trong bộ nhớ, không chạy test suite, build, migration, deploy, commit hoặc push. Đây là audit thiết kế, không phải kết luận rằng implementation chưa tồn tại đã được chạy và thất bại. Các mục nối tiếp red team đều chỉ ra phần sửa còn thiếu, không nhắc lại finding đã được xử lý đầy đủ.

Trong các vị trí dưới đây, `phase-*.md` là file trong `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/`; đường dẫn code tính từ root repo.

## Critical

### C1. Cascade xóa hộp chưa gắn với kết quả LWW của chính hộp

- **Vị trí plan:** `phase-01-schema-contract.md:123-125`; `phase-02-worker-roster-route.md:48-49,60`.
- **Lỗ hổng:** bước 2 yêu cầu thêm câu xóa con “khi bản ghi là xóa hộp”, nhưng không yêu cầu câu đó kiểm hộp thực sự đã chuyển sang tombstone. Một câu UPSERT bị LWW bỏ qua vẫn là SQL thành công; transaction không tự bỏ các câu DELETE phía sau. Tương tự, phải bỏ cả side effect của bản xóa `main` bị rejected. Đây là phần còn thiếu của bản sửa red-team #3.
- **Tình huống lỗi:** server có hộp sống ở timestamp 200; máy cũ gửi xóa ở 100. UPSERT đổi 0 dòng, nhưng DELETE con vẫn xóa sạch kho/đội. Hộp sống còn nguyên nên client khác không nhận tombstone hộp để giải thích mất dữ liệu. Nếu cộng mọi `meta.changes`, một request xóa 1 hộp và 40 con còn có thể trả `accepted=41`.
- **Bằng chứng:** `community-worker/src/routes/recruit.ts:103-107` dùng `WHERE excluded.updated_at > ...`, nên stale write trả 0 changes; `:140-145` cộng changes chỉ đúng khi mỗi statement tương ứng một record. `community-worker/test/fakes.ts:57-67` chạy tiếp mọi statement nếu không ném lỗi. D1 cũng chỉ rollback khi statement lỗi, không phải khi nó đổi 0 dòng ([D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)).
- **Sửa cụ thể:** cascade phải guard theo `user_id`, đúng hộp, `deleted=1` và trạng thái tombstone đã được chấp nhận trong transaction; child UPSERT cũng phải kiểm hộp sống ngay trong SQL. Chốt thứ tự box → children và semantics khi cùng request có create/delete/child write. `accepted` chỉ đếm record UPSERT, không đếm dòng con bị dọn. Thêm test stale delete, delete `main` kèm child, create box + children cùng batch, delete + child write ở cả hai thứ tự, và cô lập user cho cascade.

## High

### H1. `accepted` tổng + dirty set chưa đủ để xác nhận đúng phiên bản, retry và hòa Lamport

- **Vị trí plan:** `phase-01-schema-contract.md:109-112`; `phase-03-client-roster-sync.md:18-19,40-43`; `phase-05-my-teams-model.md:29-30`; `phase-06-my-teams-ui.md:45-46,52`.
- **Lỗ hổng:** hợp đồng coi `accepted < số gửi` là conflict, nhưng không phân biệt replay đã lưu thành công với stale write khác nội dung; dirty chỉ là tập khóa, chưa có quy tắc ACK theo phiên bản. Lamport theo máy cũng không bảo đảm hai máy không phát cùng timestamp. Đây là phần sửa còn thiếu của red-team #6/#12.
- **Tình huống lỗi:** (a) POST đã commit nhưng mất response, retry cùng payload được `accepted=0`, pending OAuth không thể xác nhận thành công; (b) đang gửi đội X@10, người dùng sửa thành X@11, response của X@10 xóa khóa dirty X và làm mất lượt đẩy X@11; (c) hai máy sửa cùng đội ở cùng ms, server giữ bản đến trước, client giữ bản local khi hòa và không hội tụ.
- **Bằng chứng:** server mẫu dùng so sánh nghiêm ngặt `>` tại `community-worker/src/routes/recruit.ts:107`; client mẫu nói rõ “hòa thì giữ bản tại chỗ” và thực hiện tại `js/recruit-tracker-store.js:668-684`. `js/recruit-sync.js:102-113` snapshot chunk trước `await`, còn state có thể đổi trong lúc mạng chờ. Không thể lấy hành vi đó làm bằng chứng dirty set mới đã an toàn.
- **Sửa cụ thể:** chốt outcome theo `(kind,id,version)` hoặc trả/read-back bản server để phân biệt `applied`, `already-applied`, `conflict`, `rejected`. Chỉ xóa dirty nếu phiên bản hiện tại vẫn là phiên bản đã gửi. Hòa nhưng khác payload phải nhận bản server làm canonical và giữ draft thua riêng; hòa cùng payload là ACK thành công. Pending save phải giữ ổn định `team.id` qua retry/reload. Thêm ba test trên, cùng batch vừa accepted vừa conflict vừa rejected; không cần thay toàn bộ sync bằng CRDT.

### H2. Đổi tài khoản ở tab khác có thể đẩy kho của A vào tài khoản B

- **Vị trí plan:** `phase-03-client-roster-sync.md:19,22-23,38,47`; `phase-02-worker-roster-route.md:30`; `phase-05-my-teams-model.md:30`.
- **Lỗ hổng:** `userId` chỉ nằm trong cache; POST chỉ có `{records}`. Xóa cache và reload tab đăng xuất không ràng buộc owner của các request từ tab còn mở. Cache theo user và test A → B → A chưa bao phủ đổi cookie giữa hai tab.
- **Tình huống lỗi:** tab 1 giữ state/dirty của A; tab 2 đăng xuất A rồi đăng nhập B. Tab 1 resume hoặc debounce push, request mang cookie B nhưng payload vẫn là kho/đội A. Server hợp lệ hóa theo B, nên không có 401 để kích hoạt chế độ chỉ đọc. Đây là lẫn dữ liệu giữa hai tài khoản dùng chung trình duyệt, không phải suy đoán truy cập tài khoản người khác từ bên ngoài.
- **Bằng chứng:** `js/community-api.js:134` dùng `credentials: 'same-origin'`; `:187-209` memoize session trong module; `:238-241` chỉ reload trang gọi signOut. `js/recruit-sync.js:138-149` resume với user đang giữ, không hỏi lại phiên. `community-worker/src/context.ts:38-44` lấy user từ header/cookie request, và `community-worker/src/routes/recruit.ts:131-141` bind user đó khi ghi.
- **Sửa cụ thể:** thêm owner kỳ vọng của lượt sync vào hợp đồng request và server so với user đã xác thực, mismatch trả lỗi riêng; đây là assertion, không phải quyền do client cấp. Khi cache bị xóa/đổi owner, dừng timer, vô hiệu hóa request/response thuộc phiên cũ, khóa UI và nạp lại phiên. Thêm e2e hai tab A/B với push đang chờ và với response cũ về muộn. Không chỉ sửa `signOut` của một tab.

### H3. Một blob cache/cursor không giải quyết lost update giữa hai tab

- **Vị trí plan:** `phase-03-client-roster-sync.md:19,45`.
- **Lỗ hổng:** lưu cache và cursor cùng giá trị là đúng, nhưng `storage` → “đọc lại” không serialize read–modify–write, cũng không gộp các dirty record chưa có trên server. Đây là phần còn thiếu của red-team #13, khác lỗi cache/cursor bị tách.
- **Tình huống lỗi:** A và B cùng đọc snapshot S. A thêm món X và ghi S+X; trước khi xử lý event, B thêm Y và ghi S+Y. Nếu các tab đọc lại toàn blob như plan, X và dirty X biến mất. Việc cursor vẫn khớp records trong blob cuối không cứu thay đổi đã bị ghi đè.
- **Bằng chứng:** plan xác định một key dùng chung và debounce 1,5 s (`phase-03-client-roster-sync.md:19`), tạo khoảng thời gian có dirty chưa đẩy. Mẫu `js/recruit-sync.js:29-34,82-84` là ghi đè snapshot, không phải transaction; test storage hiện tại chỉ là Map `getItem/setItem` tại `tests-js/recruit-sync.test.mjs:17-23`, không mô phỏng cạnh tranh tab.
- **Sửa cụ thể:** quy định cách serialize mutation của cache giữa tab, hoặc gộp record/version + dirty của hai snapshot trước khi ghi, không thay nguyên state đang dirty bằng event snapshot. Cursor chỉ tiến khi cache thực sự bao phủ các record của mốc đó. Thêm lịch test A-read/B-read/A-write/B-write trước event, rồi reload cả hai và xác nhận X/Y đều lên server; thêm ACK muộn trên cùng key như H1.

### H4. Gộp lần đầu bỏ quên `lockedTeams` và `tacticOverrides`

- **Vị trí plan:** `phase-01-schema-contract.md:129-135`; `phase-03-client-roster-sync.md:18,35-39`.
- **Lỗ hổng:** thuật toán đã sửa cho `owned` chỉ tạo box, season và từng món. Không có bước chuyển đội khóa/món bù hiện hữu, dù schema đã dành `locked`/`override` và #21 yêu cầu đồng bộ chúng.
- **Tình huống lỗi:** khách đã khóa một đội và chọn món bù; đăng nhập đồng ý gộp rồi UI chuyển sang kho cloud. Tướng/chiến pháp còn, nhưng đội khóa và lựa chọn món bù mất khỏi state sử dụng. Máy thứ hai cũng không có chúng; engine có thể gợi ý lại tài nguyên đã khóa.
- **Bằng chứng:** `js/roster-scan-state.js:77-86` có cả hai trường; `:165-188` chuẩn hóa/dedup đội khóa; `:256-269` giữ món bù theo ô. `js/roster-recommend-ui.js:560-568` truyền trực tiếp cả hai vào `recommendRoster`. Phase 3 test gộp chỉ đòi 5 `owned` (`:35`).
- **Sửa cụ thể:** thêm chuyển `lockedTeams`/`tacticOverrides` sang `main`, cùng quy tắc chỉ tạo khóa chưa tồn tại kể cả tombstone; bảo toàn season local khi cloud chưa có. Định nghĩa `lockedTeamKey` ổn định thay vì suy theo index, vì helper hiện tại là JSON bộ tướng/chiêu. Không đồng bộ `scans`/ảnh. Thêm fixture gộp chứa đủ owned + locked + override, tombstone của cả ba và retry sau push dở.

### H5. Xóa nhóm ở client không bảo đảm đội được chuyển về nhóm mặc định

- **Vị trí plan:** `phase-01-schema-contract.md:118-125`; `phase-06-my-teams-ui.md:27`; liên quan `phase-03-client-roster-sync.md:18`.
- **Lỗ hổng:** “chuyển đội cùng lượt” không nguyên tử về nghiệp vụ khi mỗi record có LWW/rejection riêng. Không có ràng buộc server rằng `team.groupId` thuộc nhóm sống của cùng hộp. `ensureDefaults()` còn chỉ liệt kê nhóm của `main`, chưa xác định tạo nhóm mặc định cho hộp mới.
- **Tình huống lỗi:** máy A xóa nhóm G và chuyển các đội nó biết; máy B vừa lưu thêm đội vào G hoặc có version đội mới hơn, nên tombstone G thành công nhưng một team update bị bỏ qua. Đội còn trỏ G đã xóa và có thể biến mất khỏi danh sách. Với 500 đội, 500 lần chuyển + 1 lần xóa nhóm còn vượt batch 500, dù không có cạnh tranh.
- **Bằng chứng:** per-record rejection/LWW là hợp đồng phase 1 `:112`, batch cap `:119`; schema chỉ có FK tới user, không có FK hay quan hệ group (`phase-01-schema-contract.md:30-40`). Mẫu SQL `community-worker/src/routes/recruit.ts:103-107` xác nhận từng record có thể đổi 0 dòng trong một batch thành công.
- **Sửa cụ thể:** định nghĩa xóa nhóm như operation server có guard gắn với tombstone được chấp nhận và chuyển các đội còn thuộc nhóm ngay trong transaction, cấp rev/payload đồng nhất để máy khác nhận được; hoặc quy định rõ fallback nhóm khi đọc và reject/chuẩn hóa ghi vào nhóm chết. Chốt invariant group sống/cùng box và `ensureBoxDefaults(boxId)` cho mọi hộp. Thêm test 500 đội, team tạo đồng thời, team update mới hơn, và hộp thứ hai chưa có hai nhóm mặc định. Giữ tính năng xóa nhóm đã được người dùng duyệt.

### H6. Lưu kết quả Gợi ý sẽ khôi phục đội gốc thay vì đội đang hiện

- **Vị trí plan:** `phase-05-my-teams-model.md:27,50-51`; `phase-06-my-teams-ui.md:33,48`.
- **Lỗ hổng:** `fromRosterEntry` lấy record gốc rồi `fromRecommended`/`fromLegacy`; chỉ chép món bù vào `userAlternatives`. Không áp lựa chọn thực tế lên `heroes[].hero` và `tactics[].primary`. Test #10 thậm chí yêu cầu kết quả bằng đội gốc cộng metadata, củng cố hành vi sai. Đây là phần sửa red-team #10 chưa hoàn chỉnh.
- **Tình huống lỗi:** thẻ đang hiện Trình Phổ thay SP Lữ Mông hoặc chiêu B thay A do kho thiếu/xung đột; bấm Lưu lại nhận SP Lữ Mông/A làm lựa chọn chính. Dấu thiếu kho và cảnh báo trùng sau đó cũng tính sai đội người dùng vừa lưu.
- **Bằng chứng:** `js/team-recommend-engine.js:252-265,330-340,374-385` tách đội nguồn khỏi `heroAssignments` và `tacticSelections`; UI dùng chính các selections tại `js/roster-recommend-ui.js:659-680,715,728-734`. Dữ liệu thật `data/teams.json:3443,3522-3525` có `team-intro-27` với `SP Lữ Mông/Trình Phổ`. Probe thuần với team này, kho chỉ có Cam Ninh/Thái Sử Từ/Trình Phổ và các chiêu của đội, tier T0 chỉ để admission, cho `entry.team` chứa chuỗi hai tướng nhưng `heroAssignments` chọn Trình Phổ.
- **Sửa cụ thể:** dựng baseline từ record đầy đủ để giữ binh thư/hash, rồi overlay các assignment/selection đang hiển thị vào đúng ô lưu. Bảo toàn primary gốc ở alternatives/provenance nếu cần; hash vẫn là hash nguồn gốc. Cần mapping ô engine → ô nguồn vì `js/roster-season-candidates.js:38-50` bỏ ô rỗng/bond trước khi engine đánh `slotIndex`. Đổi test #10 thành so draft với dữ liệu thẻ; thêm lựa chọn tướng legacy, chiêu thay có sẵn, món bù và ô bond đứng trước chiêu.

### H7. Bộ chuyển Khai hoang mất giai đoạn, thứ tự chủ tướng và ghi chú đang hiển thị

- **Vị trí plan:** `phase-01-schema-contract.md:79-94`; `phase-05-my-teams-model.md:25,50`; `phase-06-my-teams-ui.md:48,50`.
- **Lỗ hổng:** mapping chỉ lấy `heroes[]`, `tacticsAfter`, `unitTypeAfter`. Trang nguồn thực tế hiện cả Trước/Sau, sắp lại chủ tướng và ghi chú theo build đang chọn. Hai ô chiến pháp trong model không tự biểu diễn được cả hai giai đoạn; plan chưa chốt cách giữ phần còn lại.
- **Tình huống lỗi:** lưu Chu Thái–Trương Phi–Trương Xuân Hoa theo thứ tự mảng làm Chu Thái lên đầu dù nguồn hiện Trương Phi là chủ tướng. Chiến pháp trước cấp 20 và hướng cộng điểm biến mất. Đội đổi chủ tướng sau cấp 20 như Gia Cát Khác–SP Mã Siêu–Pháp Chính cũng mất thông tin vai trò.
- **Bằng chứng:** `data/khaihoang.json:1180-1206,1228-1229` có thứ tự mảng bắt đầu Chu Thái nhưng `commanderBefore/After=Trương Phi`; `:43` có `commanderAfter=Pháp Chính`. `js/render.js:360-379,447-483,495-509` dựng hai giai đoạn, commander-first và các ghi chú build/tướng. Chọn đúng `?variant` đã sửa chỉ giải quyết chọn build, chưa giải quyết mất nội dung build.
- **Sửa cụ thể:** chốt một mapping nhỏ, rõ ở phase 1: hai ô có cấu trúc đại diện giai đoạn nào, thứ tự/vai trò theo giai đoạn đó; lưu thông tin giai đoạn còn lại, chuyển chủ tướng và ghi chú vào các trường chữ đã có. Không cần mở thêm hệ thống progression. Dùng bản đã localization và đúng build owner; test cả chủ tướng không đứng đầu mảng, đổi chủ tướng, biến thể chỉ có dữ liệu Sau. Không tự suy thêm dữ liệu Trước cho nguồn thiếu.

### H8. Gate cạnh tranh D1 của phase 2 phụ thuộc sửa harness ở plan song song

- **Vị trí plan:** `phase-02-worker-roster-route.md:34,51,59-67`; danh sách file `:18-23`.
- **Lỗ hổng:** test “hai batch song song” không thể dựa vào fake D1 hiện tại để mô phỏng D1 tuần tự. Phase 2 không sửa harness và cũng không khai báo phụ thuộc vào bản sửa đang nằm trong plan Đội cộng đồng.
- **Tình huống lỗi:** request 1 mở transaction rồi nhường lượt ở `await s.run()`; request 2 chạy `begin` trên cùng SQLite connection và lỗi transaction lồng. SQL quota đúng vẫn đỏ. Nếu tránh lỗi bằng chạy test tuần tự thì không còn kiểm gate đã hứa.
- **Bằng chứng:** `community-worker/test/fakes.ts:50-68` dùng một `DatabaseSync` và await giữa các statement; `:38-46` còn báo `changes:0` cho statement có cột trả về. Plan song song đã nhận diện và lên bước sửa cụ thể tại `plans/261021-0628-doi-cong-dong/phase-01-schema-nen-tang.md:34,122-128` (`runSync`, batch không yield, changes đúng cho RETURNING).
- **Sửa cụ thể:** ghi dependency dùng chung bản sửa harness đó trước phase 2, hoặc đưa đúng patch nền tảng vào một thay đổi chung được cả hai plan dùng; tránh hai bản sửa cạnh tranh cùng file. Test rollback, hai batch đồng thời và metadata RETURNING phải xanh trước test quota roster. Việc đặt migration 0011 không giải quyết dependency code này. D1 thật bảo đảm batch transaction tuần tự ([tài liệu chính thức](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)); fake phải mô phỏng điều đó.

### H9. Quota “chỉ bản sống” vẫn cho phép tăng tombstone không giới hạn

- **Vị trí plan:** `phase-01-schema-contract.md:118-125`; `phase-02-worker-roster-route.md:42,50-51,60`.
- **Lỗ hổng:** giảm payload và không tính tombstone vào live quota là hợp lý, nhưng chưa có giới hạn số khóa được giữ, không cấm tombstone cho id chưa tồn tại, không có giao thức compact/resnapshot. Đây là phần còn thiếu của red-team #3 về không dọn bản xóa.
- **Tình huống lỗi:** user đã đăng nhập gửi nhiều id team/group ngẫu nhiên ở trạng thái deleted, hoặc tạo rồi xóa luân phiên trong `main`. Live count luôn thấp nhưng DB và lần pull đầu tăng mãi. Giới hạn 600 push/giờ × 500 record chỉ giới hạn tốc độ, không giới hạn tổng dung lượng. Xóa hộp khác không dọn được tombstone trong `main` vì hộp này không được xóa.
- **Bằng chứng:** PK theo `(user_id,kind,id)` và payload tombstone trong DDL phase 1 `:30-40` cho phép mỗi id mới chiếm một dòng; quy tắc kiểm quota chỉ khi chuyển sang sống tại `:118`. Cron hiện có chỉ xóa uploads và rate_limits (`community-worker/src/cleanup.ts:21-24`); phase 2 không bổ sung cleanup. Tác động nằm ở D1 chung và lượng dữ liệu kéo, không chỉ thẩm mỹ UI.
- **Sửa cụ thể:** cấm tạo tombstone cho khóa chưa từng tồn tại, đồng thời chốt trần retained-record/storage riêng hoặc cơ chế compaction có sync epoch/full-resnapshot. Phương án nhỏ nhất là trần tổng khóa giữ lại, chặn tạo khóa mới khi đạt trần nhưng vẫn cho sửa/xóa khóa đã có; đưa quyết định này vào bước duyệt schema. Không xóa tombstone theo TTL đơn thuần vì có thể hồi sinh dữ liệu từ máy lâu không online. Thêm test churn create/delete và tombstone id lạ.

## Medium

### M1. Cap nhóm theo hộp bị lách bằng cập nhật `boxId` của record còn sống

- **Vị trí plan:** `phase-01-schema-contract.md:62,118`; `phase-02-worker-roster-route.md:20,51,60`.
- **Lỗ hổng:** cap chỉ kiểm khi tạo mới/hồi sinh, còn `group` có id ngẫu nhiên độc lập `boxId`; chưa cấm đổi box của record sống. Cập nhật nhóm từ hộp A sang B làm tăng số nhóm sống của B mà không phải live transition.
- **Tình huống lỗi:** B đã đủ 50 nhóm, client gửi sửa một nhóm đang sống của A với `boxId=B` và timestamp mới. SQL chỉ kiểm new/resurrection sẽ cho nhóm thứ 51 vào B; các team tham chiếu nhóm cũ còn lệch box.
- **Bằng chứng:** DDL phase 1 `:34,39-40` không gắn id với box và chỉ kiểm box_id null cho kind box. `group` dạng `grp-…` tại `:62`; cap live-transition tại `:118`. API nhận payload do client cung cấp theo mẫu `community-worker/src/routes/recruit.ts:45-56`, nên invariant phải nằm ở server, không thể dựa vào UI không có nút chuyển hộp.
- **Sửa cụ thể:** do #23 chỉ yêu cầu chuyển đội giữa nhóm, chọn cách nhỏ nhất: `box_id` bất biến sau khi tạo group/team/owned/locked/override; mọi id suy từ box phải khớp `data.boxId`, và cột DB phải lấy từ cùng nguồn đã kiểm. Nếu cho chuyển box thì kiểm cap hộp đích trong chính UPDATE và xử lý quan hệ con. Thêm test cập nhật sống ở cap đầy, không chỉ tạo/hồi sinh.

### M2. Resolver được chọn không báo “không có trong từ điển” như plan giả định

- **Vị trí plan:** `phase-01-schema-contract.md:69-71`; `phase-03-client-roster-sync.md:20,39`.
- **Lỗ hổng:** `canonicalHeroId` và `createTacticIdResolver` tạo slug ngay cả với tên không tồn tại. Chỉ gọi hai hàm đó không thể thực hiện quy tắc “không tìm thấy → chỉ trên máy này”. Đây là phần kiểm membership còn thiếu sau bản sửa red-team #1.
- **Tình huống lỗi:** tên thêm tay/OCR sai vẫn sinh `hero:...`/`tactic:...`, được gộp lên cloud như món đã đối chiếu; hoặc tên chỉ có chữ Hán khiến hero slug rỗng và ném, làm hỏng lượt gộp nếu không cô lập từng món.
- **Bằng chứng:** `js/hero-identity.js:21-26,37-49` không nhận dictionary; `js/lookup-ids.js:116-123` ghi rõ fallback `tactic:<slug>`. Probe đọc thuần trả `hero:tuong-khong-ton-tai` và `tactic:chien-phap-khong-ton-tai` cho tên bịa. Đây là hành vi engine hợp lệ, nhưng không phải phép xác minh catalog.
- **Sửa cụ thể:** dùng resolver để giữ đúng identity engine, rồi kiểm membership trong tập ID của dictionary; tên chuẩn lấy từ hàng dictionary. Catch lỗi theo từng món. Test tên Việt không tồn tại, tên Hán chưa map, alias hợp lệ, former tactic ID và món manual không có canonicalId.

### M3. Endpoint hash chắc chắn cần sửa dist allowlist, không phải “nếu cổng kiểm yêu cầu”

- **Vị trí plan:** `phase-05-my-teams-model.md:33,56,62,65-68`; `phase-06-my-teams-ui.md:62-65`.
- **Lỗ hổng:** plan để tùy chọn đăng ký endpoint trong `root-static-artifacts.ts`/dist contract và không chỉ đích danh verifier. Verifier hiện dùng allowlist đóng; `root-static-artifacts.ts` quản lý cây `js/css/data`, không tự đăng ký JSON ở root. Đây là phần sửa red-team #2 còn thiếu đối với artifact mới.
- **Tình huống lỗi:** phase 5 tạo `dist/my-teams-source-index.json`, build xong nhưng `test:dist`/`verify` báo unexpected file. Sửa nhầm root-static-artifacts vừa không sửa allowlist vừa tạo thêm nguồn bị pin cần publish lại.
- **Bằng chứng:** `scripts/verify-astro-dist.mjs:265-296` liệt kê expectedFiles rồi fail mọi file lạ; `src/lib/root-static-artifacts.ts:146-169` chỉ đối chiếu manifest cho `js/css/data`; `tests-js/astro-dist-contract.test.mjs:324-327` chỉ tự sinh trang COMMUNITY_PAGES. `pipeline/site-localization-policy.json:817` đang pin `root-static-artifacts.ts`. `_headers` test cũng so danh sách rule chính xác tại `tests-js/pages-headers-contract.test.mjs:89-94`.
- **Sửa cụ thể:** phase 5 phải sửa rõ `scripts/verify-astro-dist.mjs` và fixture `tests-js/astro-dist-contract.test.mjs`: allowlist endpoint, tạo fixture và kiểm JSON/hash/payload thật. Thêm cache revalidation rule cho JSON mutable và update header contract ngay phase 5. Không thêm file nguồn giả vào `data/`. Ở phase 6, đưa manifest + entry stub hoàn chỉnh + publish localization trước gate build/dist bước 1, thay vì để đến bước 4.

### M4. Link nguồn của Đội của tôi thiếu registry `{r,k}` và làm mất variant

- **Vị trí plan:** `phase-06-my-teams-ui.md:18,27,55`; `phase-01-schema-contract.md:95,139-148`.
- **Lỗ hổng:** trang mới dùng `pageKind="detail"` theo ReportsPage và gọi `teamDetailPath(...)`, nhưng layout detail chỉ nhúng bảng legacy. Chưa có bước nạp registry trên entry mới; `teamDetailPath` cũng không xử lý variant hay nguồn analyze.
- **Tình huống lỗi:** đội Recommended/Khai hoang không có link nguồn vì lookup trả null; legacy có key `x~v` hoặc trả null nếu dùng nguyên key, hoặc quay về bản mặc định nếu chỉ lấy x. Đội Soi cần route công cụ riêng, không phải một trong ba họ detail.
- **Bằng chứng:** `src/layouts/SiteLayout.astro:353-365` trả `{l: legacy}` cho pageKind detail; `js/team-detail-navigation.js:62-66,106-118` cần registry đã khởi tạo và chỉ nhận id theo family. `:121-136` mới là helper nối query variant. Entry hiện hữu gọi `setTeamRouteHandlesFromJSON` rõ ràng ở `js/team-detail.js:41`.
- **Sửa cụ thể:** cung cấp và khởi tạo đầy đủ registry cần cho MyTeamsPage (có thể nhúng riêng ở component, không cần sửa layout toàn site); parse source thành family/id/variant có kiểm định rồi dùng `teamDetailHref`. Chốt nguồn analyze có link `/soi-doi-tu-anh/` dựng từ canonical draft hay không có link. E2E click link thật cho recommended, legacy variant, khaihoang variant, cả vi/zh.

### M5. Picker kho không dùng nguyên trạng cho trình soạn: thiếu binh thư và loại mất chiến pháp

- **Vị trí plan:** `phase-04-quick-picker-ungate.md:18-20,35`; `phase-06-my-teams-ui.md:28`.
- **Lỗ hổng:** picker phase 4 chỉ có tướng/chiến pháp, quy định INNATE/“Tự mang” luôn bị loại. Phase 6 lại dùng nó để chọn cả binh thư và yêu cầu #23 là chọn được mọi tướng/chiến pháp trong Tra cứu. Chưa có catalog/provider hoặc mode cho hai nhu cầu khác nhau.
- **Tình huống lỗi:** không có danh sách binh thư cho editor; chiến pháp tự mang có hồ sơ Tra cứu không thể chọn dù người dùng được phép soạn tự do. Nếu bỏ filter toàn cục để sửa editor thì test/quy tắc của nhập kho phase 4 bị phá.
- **Bằng chứng:** catalog binh thư có route/ID riêng: `js/lookup-ids.js:17-20,144-150`; nguồn Soi dùng trường `book` canonical tại `js/analyze-state.js:29,37,70`. Filter “luôn bị loại” và chỉ hai nhóm input được đóng cứng ngay trong phase 4, không phải khả năng đã tồn tại cho book.
- **Sửa cụ thể:** tái dụng cơ chế tìm/chọn, tách policy theo mục đích: inventory chỉ món có thể sở hữu/nhập kho, team editor có full catalog và books-dict. Đưa nhiệm vụ này vào phase 4 hoặc 5 trước phase 6; thêm test cùng một tactic bị loại ở inventory nhưng chọn được ở editor, và lưu/reload book ID đúng. Không cần thêm một framework picker.

### M6. Mapping các trường còn lại và hash nguồn chưa bao phủ thay đổi người đọc thực sự thấy

- **Vị trí plan:** `phase-01-schema-contract.md:89-95,145-148`; `phase-05-my-teams-model.md:23-28,53`; `phase-06-my-teams-ui.md:31`.
- **Lỗ hổng:** `fromRecommended` chưa map cộng điểm/ghi chú; `fromLegacy` chỉ nêu `.name`, bỏ mảng `alternatives` và notes/counters. Với biến thể legacy, plan truyền riêng `admitted.legacyContent`, khác object UI render có ghép `team.notes`. Hash chỉ tên tướng/chiêu/binh thư cũng không đổi khi chỉ dẫn cộng điểm, chủ tướng, binh chủng hoặc ghi chú nguồn đổi.
- **Tình huống lỗi:** bản lưu thiếu phương án thay/ghi chú dù đang hiện ở nguồn; sau đó tác giả sửa hướng cộng điểm hoặc chỉ dẫn build nhưng “Bản gốc đã cập nhật” không hiện vì tên ba loại món không đổi. Đây là thiếu dữ liệu của bản sao độc lập, không phải yêu cầu đồng bộ ngược chỉnh sửa cá nhân.
- **Bằng chứng:** `js/recommended-reference-render.js:259-279` hiển thị statFocus; `:384-388` đọc mảng alternatives của tướng/chiêu/binh thư; `:403-407` đọc counters. `js/team-detail.js:151-153` render `{...legacyContent, notes: team.notes}`. Các chỉ dẫn/commander Khai hoang là dữ liệu thật tại `data/khaihoang.json:1204-1206,1226-1229` và được render theo H7.
- **Sửa cụ thể:** bổ sung bảng mapping từng trường hiển thị → trường có cấu trúc/chữ của draft, ghi rõ những nội dung không thuộc bản sao (ví dụ chiến báo/điểm hướng dẫn chung), dùng đúng object đã render cho legacy variant. Hash canonical trên các trường nguồn có ý nghĩa được lưu, gồm raw notes/stat/commander/unit và alternatives; vẫn loại bản dịch, order JSON không ổn định và mọi chỉnh sửa của user. Thêm test nguồn chỉ đổi stat/note, dịch Việt đổi nhưng raw không đổi, và legacy variant thừa hưởng notes của đội gốc.

## Đối chiếu các Verification gate và phạm vi

- **Phase 1:** là bước viết/duyệt hợp đồng, chưa phải duyệt migration. Những thay đổi semantics C1/H1/H5/H9 phải được đưa vào bản duyệt; không cần hỏi lại hai quyết định đã chốt là giữ xóa hộp/nhóm và hỏi trước khi gộp (`plan.md:137-141`).
- **Phase 2:** migration 0011 độc lập với bảng cộng đồng là hợp lý; gate concurrent test bị H8. Các test live-cap cần thêm update khi đầy, chuyển hộp và side effect bị bỏ qua; không chỉ count tạo mới.
- **Phase 3–4:** đã có manifest và vòng publish localization, nhưng cần H1–H4/M2. E2E intercept config có thể làm đúng: phải trả module vẫn export đủ `ANALYZE_CONFIG`/`isAnalyzeConfigured`, dùng `REPLACE_ME`. Chuỗi rỗng thực tế không khiến hàm hiện tại trả false (`js/config.js:15-19`), nên không dùng chữ “cấu hình rỗng” làm fixture thay cho placeholder. Giữ test Turnstile của cấu hình production là đúng (`tests-e2e/spa-parity.spec.mjs:162-164`).
- **Phase 5–6:** cần M3 trước gate dist, H6/H7/M4–M6 trước khẳng định “giống dữ liệu đang hiện”. Mẫu E2E có route intercept thật ở `tests-e2e/community.spec.mjs:70-82`; Playwright tự chạy build qua `playwright.config.mjs:20-24`, nên không thể dùng E2E để đi vòng qua publication gate. Audit này không chạy E2E.
- **Phase 7:** thứ tự rollout đúng hướng, nhưng suite xanh trên fake và smoke bằng session dựng sẵn không phải bằng chứng Google OAuth thật hay D1 production. Tài liệu đang nói đúng giới hạn đó (`docs/community-worker.md:155-157`).
- **Citation cần sửa nhẹ, không tính thêm finding:** phase 3 `:26` nói PrivacyPage nằm trong `sourceFiles`, nhưng inventory hiện tại `pipeline/site-localization-policy.json:761-833` không có file này; `community-api.js`/`community-auth.js` cũng không được pin ở inventory đó. Các file roster, detail JS và ba Detail.astro thì có. Publish vẫn cần vì chúng bị sửa, nhưng không nên khai đã xác minh pin của PrivacyPage. Dòng `docs/community-worker.md:157` là bằng chứng smoke trước đây và giới hạn OAuth, không phải script seed session dùng ngay.
- **Phối hợp plan song song:** 0011 tránh đúng dải giữ chỗ 0008–0010; ngoài menu/headers/manifest/localization, bổ sung owner/dependency `community-worker/test/fakes.ts` như H8. Giữ merge tuần tự các generated publication rồi repin sau cùng. Không có bằng chứng cần hợp nhất hai tính năng hoặc sửa recruit-sync.
- **Over-engineering:** chưa thấy lý do có bằng chứng để bỏ một route/một bảng/cột box_id, nhóm/hộp, source hash hay chia sẻ module thuần; chúng phục vụ #21/#23 hoặc quyết định đã duyệt. Những bản sửa đề xuất ở trên là hoàn thiện dữ liệu và tính nhất quán. Không mở thêm public sharing, spreadsheet import, CRDT tổng quát hoặc refactor recruit-sync.

## Các claim đã xác minh là đúng

- Món thêm tay hiện chỉ có `{name, confidence:"manual"}`; phải suy canonical ID khi gộp: `js/roster-scan-state.js:209-214`. Giữ cả membership check theo M2.
- `db.batch` cùng conditional SQL là hướng đúng để tránh check-rồi-ghi quota; D1 chạy batch transaction tuần tự. Không cần transaction tương tác quanh nhiều `await` ([D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)). Điều này không thay thế guard side effect C1 hay chứng minh SQL chưa viết.
- Bảng riêng có FK user cascade tương thích mẫu đang dùng, mount cạnh recruit và 401 cho requireUser là đúng: `community-worker/migrations/0004_recruit.sql:4-12`, `community-worker/src/app.ts:92-101`, `community-worker/src/context.ts:62-65`.
- Manifest JS là bắt buộc và đã được plan bổ sung cho các module mới; cây nguồn được so chính xác với manifest: `src/lib/root-static-artifacts.ts:146-169`. Ghim lại các file hiện có bị sửa và publish/repin generation đúng quy trình `docs/deployment-guide.md:253-271`.
- Trang mặc định Đội chuẩn/Đội khác adopt SSR; legacy variant tải runtime; Khai hoang đổi variant bằng replaceState: `js/team-detail.js:119-123,131-153,175-178`, `js/khaihoang-detail.js:128-137`. Payload nhúng và đọc biến thể lúc bấm là hướng sửa đúng.
- Escape JSON theo `jsonLd` ngăn chuỗi `</script>` thoát khỏi thẻ bằng mã hóa `<`: `src/lib/blog-posts.ts:387-394`. Giới hạn byte, schema theo kind và dựng href từ route đáng tin là các yêu cầu an toàn đúng; chưa phải chứng nhận implementation tương lai không XSS.
- Soi đội đã xác nhận có shape `{heroes:[{hero,tactics:[id|null,id|null],book}]}` như plan trích: `js/analyze-state.js:29-38,70-72`. Nguồn này không cần giả tạo hash của một bản gốc trên site.
- Route cộng đồng noindex cần cả hai ngôn ngữ, COMMUNITY_PATHS, COMMUNITY_PAGES và header contract: `src/lib/locale-routes.ts:18-19`, `scripts/verify-astro-dist.mjs:77-81`, `tests-js/pages-headers-contract.test.mjs:122-126`. Phần bổ sung page trong phase 6 đã chọn đúng các owning files.
