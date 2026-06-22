# Red-team Audit — Plan "Soi đội từ ảnh (Vision LLM) + Từ điển chiến pháp"

_2026-06-21 23:32 (+07). Reviewer: code-reviewer. Scope: chỉ đọc + audit. KHÔNG sửa code/plan._

Plan dir: `plans/260621-2324-screenshot-team-analyzer-vision-llm/` (plan.md + phase-01..04).

## Verdict tổng

Plan vững về dữ liệu nền (Phase 1/2) — đã verify spike, dependency hợp lý, TDD chọn lọc đúng chỗ. Phần AI (Phase 3/4) có vài lỗ hổng **chí mạng về scope dữ liệu** và **pháp lý/ToS chưa cover**, đủ để chặn ship Phase 4 nếu không sửa. Không đề xuất đảo quyết định đã chốt của user; các finding dưới là bổ sung bước/guardrail còn thiếu.

## Đã đối chiếu repo (fact-check)

| Claim trong plan | Trạng thái |
|---|---|
| 172 team | ✅ `data/teams.json` = 172 |
| 112 chiến pháp đang dùng | ✅ `facets.json` tactics=112 |
| `normalizeText` tái dùng (filters.js) | ✅ tồn tại, NFD + đ→d, 0 dep |
| Pattern `aliases.json` Hán/typo→Việt | ✅ tồn tại, áp deterministic lúc build |
| `facets.tactics` để auto-link | ✅ build_facets sinh ra |
| SECTIONS nav + deep-link hash | ✅ `app.js` SECTIONS=["team-pk","coexist","khaihoang"] |
| **"fuzzy (đã có pattern)" trong JS** | ❌ **KHÔNG có** util fuzzy/levenshtein nào trong `js/`. `suggest_aliases.py` ghi rõ "KHÔNG tự áp dụng fuzzy". |
| `assets/tactics/` để chứa icon | ❌ thư mục `assets/` chưa tồn tại (tạo mới — ok, nhưng .gitignore chưa whitelist) |
| Nguồn dữ liệu **heroes** (tên tướng Hán→Việt) | ❌ Phase 1 chỉ build `tactics.json`. Không phase nào crawl/dựng dict tướng. |

---

## CRITICAL

### C1 — Phase 4 map tên tướng (`nameCn`) nhưng KHÔNG có dictionary tướng để map vào
Phase 3 schema trả `heroes[].nameCn` và `statFocusCn`; Phase 4 yêu cầu "mỗi `nameCn` → fuzzy-match `tactics.json`/heroes → tên Việt canonical". Nhưng **Phase 1 chỉ dựng `tactics.json`** (chiến pháp). Không có nguồn nào dựng dict **tướng Hán→Việt** (85 tướng trong facets là tên Việt, không có chữ Hán đối ứng), cũng không có dict **chất tướng** (`statFocusCn` vd 全智力→"toàn trí lực").
- Hệ quả: tính năng lõi "đọc cả đội" sẽ hiện đúng chiến pháp nhưng **tên tướng + chất tướng là raw Hán/hallucinated**, vi phạm chính acceptance "mọi tên hiển thị là tên Việt canonical".
- Fix: thêm vào Phase 1 (hoặc Phase 1b) việc crawl **bảng tướng** (lingxi có tbId riêng cho 武将库) → `data/heroes-dict.json {chinese, hanViet, viet}` + bảng map chất tướng (智力/武力/统率/速度/全…). Acceptance Phase 4 phải tách rõ 3 trục đo: % chiến pháp đúng, % tướng đúng, % chất tướng đúng.

### C2 — ToS Qwen/Alibaba + pháp lý gửi screenshot game thương mại lên bên thứ 3 chưa được thẩm định
R5 chỉ nói privacy/disclaimer. Chưa cover: (a) Alibaba Model Studio ToS có cho phép gửi ảnh chứa nội dung bản quyền bên thứ ba (aligames/lingxi) không; (b) lưu/đào tạo trên input — endpoint Singapore vs CN có chính sách data-retention khác nhau; (c) nếu bị Alibaba khóa key vì content policy thì feature chết.
- Fix: thêm 1 mục acceptance Phase 3 "đã đọc ToS Model Studio, xác nhận (1) input không bị dùng train hoặc đã opt-out, (2) cho phép ảnh screenshot game". Ghi rõ region endpoint. Đây là điều kiện ship, không phải nice-to-have.

### C3 — Pháp lý crawl DB lingxi + tải icon aligames về repo public
Phase 1 step "tải icon PNG về repo, không hotlink". Tải về và **commit lên GitHub Pages public** = redistribute tài sản có bản quyền của aligames/lingxi, rủi ro cao hơn hotlink. Spike đã verify crawl *được* về kỹ thuật, không verify *được phép*.
- Fix: quyết định bản quyền trước khi Phase 1 commit icon. Phương án an toàn: chỉ lưu **URL icon** (hiển thị runtime, không redistribute) hoặc bỏ icon (Phase 1 risk đã ghi fallback này — nâng nó thành quyết định bắt buộc, không "nếu rủi ro"). Crawl text data để tra cứu rủi ro thấp hơn icon; vẫn nên ghi nguồn.

---

## HIGH

### H1 — "fuzzy đã có pattern" là claim sai → ẩn công sức + rủi ro chất lượng match
Phase 2/4 dựa vào fuzzy match nhưng `js/` không có util fuzzy nào. Đây là logic lõi chống hallucination (C1 của R1). Bị mô tả như "tái dùng" trong khi phải **viết mới** (levenshtein/n-gram trên chuỗi đã normalize Hán-Việt).
- Fix: tách 1 task tường minh "viết `js/match-dict.js` fuzzy matcher (0-dep)" với test ngưỡng. Đây là nơi TDD-first bắt buộc (plan đã liệt kê fuzzy-matcher vào TDD — tốt — nhưng mô tả "đã có pattern" làm nhẹ hóa). Định nghĩa **ngưỡng confidence** cụ thể + hành vi khi dưới ngưỡng.

### H2 — Phase 2 "ship độc lập trước" KHÔNG khả thi như bảng ghi
Bảng phases ghi Phase 2 "✅ ship độc lập" nhưng Dependencies ghi P1→P2. Phase 2 cần `tactics.json` (icon, mô tả, type, quality) từ P1. "Ship trước P3/P4" thì đúng; "ship độc lập" thì sai — nó cứng phụ thuộc toàn bộ output Phase 1.
- Fix: sửa nhãn thành "ship trước P3/P4, **sau P1**". Không ảnh hưởng thứ tự nhưng tránh hiểu nhầm có thể song song P1.

### H3 — Thiếu xử lý lỗi crawl pagination + idempotency (Phase 1)
Step 2 "lặp page → gom items, sleep". Chưa có: retry/backoff khi 404/timeout giữa chừng, phát hiện trùng/thiếu page, dừng-điều-kiện rõ (so totalCount vs len thu được). Crawl đứt giữa chừng → `tactics.json` thiếu âm thầm.
- Fix: acceptance "len(items) == totalCount mỗi category, fail loud nếu lệch". Lưu raw JSON từng page làm checkpoint + fixture (đã có ý này ở Risks, đưa lên Steps).

### H4 — Worker thiếu chống lạm dụng tầng ảnh (size/type/content) + CORS preflight
Phase 3 có Turnstile + rate-limit + daily cap (tốt). Thiếu: giới hạn **kích thước payload base64** (chặn ảnh 20MB đốt token + DoS), validate **MIME/magic bytes** (chống gửi rác/không phải ảnh), xử lý **OPTIONS preflight** rõ ràng cho CORS. Turnstile token **replay** — verify phải dùng idempotency/expiry.
- Fix: thêm vào Requirements Phase 3: max payload (vd ≤1.5MB sau nén), reject non-image, OPTIONS handler, Turnstile token chỉ verify 1 lần. Nén client (Phase 4 step 1) KHÔNG được tin — Worker phải tự enforce size (client bypass được).

### H5 — Chi phí "viral" chưa mô hình hóa hard cap đủ chặt
R2/free-tier: 1M token/90 ngày. Nếu viral, daily cap 500/ngày × 90 = vẫn có thể vượt; quan trọng hơn là **sau khi hết free tier**, mỗi ảnh tính tiền vào thẻ chủ site. Plan có hard daily cap nhưng chưa có **global hard cap tháng / kill-switch khi free tier cạn**.
- Fix: thêm env kill-switch (R7 đã có flag tắt feature — nâng thành "auto-disable khi monthly counter chạm ngưỡng", không chờ thủ công). Ghi rõ: KHÔNG gắn thẻ thanh toán vào account Qwen, hoặc đặt budget alert = $0 nếu Model Studio hỗ trợ.

---

## MEDIUM

### M1 — Schema drift Qwen: `response_format` json "nếu hỗ trợ" là điều kiện mơ hồ
Phase 3 step 3 "`response_format` json nếu hỗ trợ". Cần xác định Qwen3.7-Plus có structured output không *trước* khi build, không "nếu". Nếu không hỗ trợ → phải parse JSON từ free-text (dễ vỡ). Validate (step 4) tốt nhưng prompt-only JSON dễ kèm ```json fence.
- Fix: spike nhỏ xác nhận structured output; nếu không có, thêm bước strip-fence + tolerant parse vào schema.ts với test.

### M2 — Đối chiếu 172 team (Phase 4) thiếu định nghĩa thuật toán + acceptance đo được
"Tìm team trùng nhiều tướng/chiến pháp nhất → n/3 tướng". Chưa định nghĩa: trùng theo tướng hay tướng+chiến pháp, tie-break, ngưỡng tối thiểu để gọi "giống". Acceptance không đo được.
- Fix: định nghĩa scoring (vd Jaccard trên set tướng) + ngưỡng hiển thị + test trên team đã biết.

### M3 — Privacy/PDPA: "không lưu ảnh" cần khẳng định ở cả Qwen, không chỉ Worker
Worker không lưu (tốt). Nhưng ảnh **đã rời tới Alibaba** — disclaimer phải nói rõ "ảnh gửi tới Alibaba Cloud", không chung chung "dịch vụ AI". Liên quan C2.
- Fix: disclaimer nêu đích danh bên nhận + link policy. Không thu thập ảnh có thông tin định danh người chơi (tên account hiện trên screenshot) — cân nhắc cảnh báo crop.

### M4 — Ký tự Hán đa âm (R4) chưa có cơ chế gắn cứng cho 20% review thủ công
Spike: ~20% cần review do đa âm. Phase 1 step 5 "review thủ công" nhưng không nói lưu kết quả review ở đâu để **không phải làm lại** mỗi lần re-crawl. aliases.json là nơi đúng nhưng chưa nêu.
- Fix: chốt review thủ công ghi vào `aliases.json`/override file, re-crawl áp lại deterministic.

---

## LOW

- **L1** `.gitignore` chưa whitelist `assets/tactics/*.png`; hiện không bị ignore nhưng nếu thêm rule binary cần chú ý. (nhỏ)
- **L2** Phase 3 rate-limit "10/giờ", daily cap "500/ngày" là số ví dụ — đánh dấu rõ là placeholder cần chốt theo free tier thực.
- **L3** Lock-in `callModel()` (R7) tốt; thêm note: Qwen vision và GPT/Gemini khác nhau ở cách truyền ảnh (base64 vs url) — abstraction phải cover điểm này, không chỉ endpoint.

---

## Đánh giá theo câu hỏi audit

1. **Lỗ hổng/thiếu sót**: C1 (thiếu dict tướng) là lỗ hổng lớn nhất — break tính năng lõi. H3 (crawl error handling), H4 (worker input guard) thiếu. Dependency P1→P2→ship đúng nhưng nhãn "độc lập" sai (H2).
2. **Over-engineering / YAGNI**: Phần lớn **không** over-engineer — TDD chọn lọc, free tier, static giữ nguyên đều tiết chế tốt. Có thể **defer** an toàn: đối chiếu-172-team (M2) là nice-to-have, tách khỏi MVP Phase 4 để ship "đọc + map" trước. Turnstile có thể defer **nếu** Phase 4 ship sau bằng cách BYO-key dev cho tới khi public — nhưng user đã chốt Turnstile, không phản đối.
3. **Rủi ro chưa cover**: ToS Qwen (C2), bản quyền icon redistribute (C3), worker input abuse (H4), kill-switch chi phí (H5), disclaimer đích danh (M3). Đây là nhóm yếu nhất của plan.
4. **TDD scope**: hợp lý. Test-first cho hanviet/fuzzy/parser/schema-validate, thủ công cho UI/vision — đúng tinh thần dự án. Chỉ cần sửa mô tả "fuzzy đã có pattern" (H1) vì nó che việc phải viết mới + test ngưỡng.
5. **Thứ tự ship**: P2 ship trước P3/P4 khả thi, nhưng phụ thuộc P1 (H2). Không ship song song P1 được.
6. **Mâu thuẫn ràng buộc static/zero-dep**: Worker + Turnstile là **hạ tầng tách biệt**, site vẫn static → KHÔNG phá nguyên tắc, chấp nhận được (user đã chốt, có lý do: giữ key). `vitest`/`miniflare` trong `worker/` là devDep của worker, không vào site → ok. **Lưu ý**: Phase 4 nhúng Turnstile script bên thứ 3 vào site = thêm 1 runtime external dep vào trang vốn zero-dep — chấp nhận được nhưng nên ghi nhận rõ là ngoại lệ có chủ đích, và chỉ load script đó khi mở tab `#analyze` (lazy) để 3 section cũ giữ offline.

## Unresolved Questions
1. Có nguồn dict **tướng Hán→Việt** + **chất tướng** trong lingxi (tbId 武将库) để giải C1 không? Cần spike xác nhận trước khi cam kết Phase 4.
2. ToS Model Studio (region nào?) cho phép gửi screenshot game bản quyền + opt-out training chưa? (C2)
3. Quyết định cuối về icon: redistribute / hotlink-url / bỏ icon? (C3)
4. Qwen3.7-Plus có structured-output (`response_format`) thật không? (M1)

Status: DONE_WITH_CONCERNS
Summary: Plan vững phần dữ liệu (P1/P2) nhưng phần AI (P3/P4) có lỗ hổng scope dữ liệu chí mạng (thiếu dict tướng/chất tướng) và nhóm rủi ro pháp lý/ToS/chi phí chưa cover; không cần đảo quyết định user, chỉ bổ sung bước + guardrail.
Concerns:
- CRITICAL C1: Phase 4 map tên tướng/chất tướng nhưng không phase nào dựng dict tướng Hán→Việt (chỉ có tactics.json) → tính năng lõi hiện raw Hán.
- CRITICAL C2: ToS Qwen/Alibaba + region data-retention khi gửi screenshot game bản quyền chưa thẩm định — điều kiện ship.
- CRITICAL C3: Tải icon aligames commit lên GitHub Pages public = redistribute có bản quyền, rủi ro hơn hotlink.
- HIGH H1: "fuzzy đã có pattern" sai — JS chưa có util fuzzy, phải viết mới (logic lõi chống hallucination).
- HIGH H2: nhãn Phase 2 "ship độc lập" sai — cứng phụ thuộc P1.
- HIGH H3: crawl Phase 1 thiếu error/retry/idempotency + fail-loud khi len != totalCount.
- HIGH H4: Worker thiếu giới hạn size/MIME/OPTIONS + chống replay Turnstile (không tin nén client).
- HIGH H5: thiếu global kill-switch/budget khi free tier cạn → rủi ro bill khi viral.
