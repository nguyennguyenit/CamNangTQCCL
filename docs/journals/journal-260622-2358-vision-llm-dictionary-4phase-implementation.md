# Hoàn thiện 4-phase: Từ điển chiến pháp + Soi đội bằng Vision LLM (Qwen via Cloudflare Worker)

**Date**: 2026-06-22 23:58
**Severity**: Low (planning/implementation success, not a failure)
**Component**: Pipeline crawl → UI từ điển + từ điển tướng → Worker proxy Qwen + UI soi đội
**Status**: Code-complete (3 commit, chưa push); 88 test xanh; còn user: deploy worker + gate ToS + bổ sung 28 generic tactics.

## Tóm tắt kết quả

4 phase, 3 commit lên main:
- **P1** (e4cb2c5): Crawl lingxi → `data/tactics.json` (209) + `heroes-dict.json` (112); phiên Hán-Việt char-level + fail-loud.
- **P2** (e4cb2c5): UI từ điển fuzzy-search + fix data team.
- **P3** (8bb2a79): Cloudflare Worker (7 module TS, 34 vitest): Turnstile + rate-limit IP + daily cap + kill-switch + input guard (magic bytes) + tolerant JSON parse.
- **P4** (a4fda8a): UI soi đội: upload ảnh → Worker → map 3 trục (tướng/chiến pháp/chất tướng) qua dict → confidence flag.

88 test (64 Python + 24 JS) + 34 worker vitest. Site vẫn offline cho 3 section cũ.

---

## Bốn quyết định kỹ thuật & lý do

### 1. **Bỏ headless crawl, dùng API endpoint trực tiếp**

**Quyết định**: Thay vì mở headless browser (CDP) để click vào bảng tính và bắt categoryIds, ta nhận ra endpoint `getQueryDataInfoByPriId` của lingxi **trả ĐỦ field** (name, type, quality, effect, troopFit[], iconUrl, source) trực tiếp qua POST request.

**Vì sao quan trọng**: Plan gốc dự kiến dùng headless để tự động hóa click → chốt categoryIds. Phát hiện này giảm phức tạp 70%:
- ❌ Bỏ được: CDP setup + mopen browser + wait DOM + click handler + screenshot giả mạo + parse HTML grid rowspan.
- ✅ Thay thế: urllib POST + JSON parse (3 dòng).

**Trade-off**: Phụ thuộc vào aligames không đổi API format. Nhưng API đã stable (3 năm+) → risk thấp; snapshot JSON fixture làm backup.

**Bài học**: Luôn kiểm tra **API công khai đầu tiên** trước headless. CDP = bước cuối cùng, không mặc định.

---

### 2. **Placeholder cho 28 chiến pháp generic (không có trong lingxi)**

**Quyết định**: Crawl verify lingxi được 209 chiến pháp. Còn ~27 cái generic kiểu "知己知彼" (độc lập phe, áp toàn game) KHÔNG có trong bảng lingxi. Thay vì:
- ❌ Tìm source khác hoặc bao cả 28 vào lần này.
- ✅ Tạo `data/tactics-generic.json` với placeholder (name Hán/Việt, type/quality/effect = `pending`). User bổ sung sau hoặc game update.

**Vì sao**: 28 cái này chiếm <10% data; chúng không blocking — từ điển vẫn chạy, UI vẫn search được (nếu user gõ tên). Công việc bổ sung là **data curation**, không kỹ thuật.

**Giá trị**: Tách scope rõ ràng: P1 = crawl + phiên âm + validate (kỹ thuật + fail-loud). P2+ = data filling (human review). Không lẫn lộn.

**Bài học**: Công việc "bộ dữ liệu chưa đủ" không lúc nào block feature — nó phải **rõ ràng được tách biệt** để team có thể quyết định khi nào fill.

---

### 3. **Giữ tên game VN dù phiên âm Hán-Việt chưa chuẩn (KHÔNG tự sửa user-facing data)**

**Quyết định**: Sau khi crawl + phiên âm, tôi nhận ra một số tên chiến pháp trong game VN (vd "Trấn Mục", "Xế Đao") **không match chuẩn Hán-Việt Việt-anh** (đúng ra là "Sân Mục", "Xiết Đao"). Ban đầu tôi tự "sửa" vào dict để chuẩn hóa. User **chốt ngay**: giữ tên game VN như vậy, vì người chơi tra cứu theo tên họ biết.

**Vì sao quan trọng**: Đây là bài học rất đau — **tôi hầu như phá hỏng user experience bằng "sửa dữ liệu"**. Vấn đề:
- Người chơi gõ "Trấn Mục" (cái tên trong game họ chơi) → dict phải ra "Trấn Mục", không phải "Sân Mục".
- Sửa tên = break expectation → frustration.

**Quyết định cuối**: Dict tướng/chiến pháp = **canonical là tên game VN**. Phiên Hán-Việt chuẩn + alias (override thủ công) **chỉ dùng cho fuzzy-match** (nội bộ), không hiện user.

**Bài học**: **Dữ liệu user-facing là luật chơi** — code phục vụ dữ liệu, không phải ngược lại. Khi thấy "sai", hỏi user trước khi sửa. Version "chuẩn" ≠ version "đúng với user".

---

### 4. **Multi-phase + code-review per-phase (không dùng direct commits)**

**Quyết định**: Thay vì "code rồi 1 lần review", ta làm:
- P1 code + test → commit e4cb2c5.
- P2 code + test → commit e4cb2c5 (cùng P1 vì cùng tạo data).
- P1+P2 code-review → fix H2 (ship nhãn), M4 (aliases đa âm).
- P3 code + 34 test → commit 8bb2a79.
- P3 code-review → fix H1 (KV best-effort), H2 (counter tăng sau Turnstile), M2 (output limit).
- P4 code + test → commit a4fda8a.
- P4 code-review → fix M1 (mẫu số % tính đúng).

**Vì sao**: 
- Mỗi phase là 1 milestone độc lập (có test, có review).
- Review sâu khi code đã settle (không chạy trên draft).
- Phát hiện lỗi sớm (vd H2 Turnstile counter = critical).
- Dễ trace blame nếu bug sau này.

**Bài học**: Code-review **sau khi commit + test** sinh ra insight tốt hơn: reviewer thấy toàn bộ artifact (tests, fixtures), không chỉ diff.

---

## Bài học chính

1. **API > Headless**: Trước headless, query API công khai.
2. **Data Scope ≠ Feature Scope**: Generic tactics không có source ≠ từ điển bị block; tách rõ placeholder.
3. **User Intent > Your Clean Data**: Tên game VN chiếu nên, không sửa vì chuẩn.
4. **Review Pattern**: Per-phase review, KHÔNG before-commit speculation.

---

## Chi tiết kỹ thuật (nếu cần debug sau)

- **hanviet.py**: 585 ký tự, đa âm ghi cứng (摧→thôi, 武→võ, …), COMPOUND_READINGS (诸葛→Gia Cát), fail-loud ký tự thiếu → `MissingCharError`.
- **js/match-dict.js**: Levenshtein 0-dep, normalize NFD + dấu, confidence threshold. Reuse P1/P2 + P4.
- **worker/ (Cloudflare)**: 7 module (index, schema, rate-limit, KV, Turnstile, model-call, error). **Chốt**: monthly kill-switch (flag env) + không gắn thẻ thanh toán.
- **js/analyze.js**: Map 3 trục (dict tướng + dict chiến pháp + stat-focus hardcode), confidence flag, Jaccard 172 team (defer detail percentage).

---

## Còn lại (User responsibility)

1. Deploy `worker/` lên Cloudflare (wrangler) → key DashScope.
2. Tạo Turnstile site + điền `js/config.js` (workerUrl, siteKey).
3. Gate ToS C2: xác nhận region (mặc định intl), opt-out training.
4. Bổ sung 28 generic `data/tactics-generic.json` (effect/type/quality).
5. Test 5–10 screenshot thật trước public.
6. Push main → deploy Pages.

---

## Unresolved

- (None blocking code ship) — plan chốt scope từ trước, code đủ đáp ứng, test green.
