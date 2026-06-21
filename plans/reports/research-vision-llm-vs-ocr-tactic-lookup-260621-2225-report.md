# Research: Dùng Vision LLM (Qwen-VL/GPT/Gemini) thay OCR để đọc screenshot

_2026-06-21 22:25 (+07). Câu hỏi: dùng AI vision (vd "Qwen 3.7 plus", "gpt 5.5") phân tích ảnh phía sau được không?_

## Verdict: ✅ ĐƯỢC, và TỐT HƠN HẲN tesseract — nhưng vướng 1 ràng buộc: site đang static (không có chỗ giấu API key).

Vision LLM không chỉ OCR chính xác hơn nhiều, mà còn làm CẢ pipeline trong 1 lần gọi: đọc ảnh → ra thẳng {3 tướng, chiến pháp, chất tướng} dạng JSON, thậm chí map sẵn tên Việt. Gộp luôn bước "OCR + fuzzy + confirm".

## Qwen3.7-Plus — XÁC MINH (ra 2026/06/01, sau cutoff nên ban đầu tôi nói sai)
Đọc trang chính thức (render headless): **Qwen3.7-Plus là model agent đa phương thức thật**, hợp NHẤT cho việc này:
- "Multimodal agent model unifies vision + language"; Visual Agent: **perception, reasoning, grounding**, search-augmented QA.
- Benchmark **OCR-Bench-V2 (EN + ZH)** → OCR tiếng Trung chính thức. **ScreenSpot Pro / OSWorld-Verified** → grounding/đọc screenshot GUI.
- Context tới 200-256K. **Available via Alibaba Cloud Model Studio (gọi API)**.
- → Đọc thẳng screenshot game → ra cấu trúc {tướng, chiến pháp} + định vị; quá đủ cho bài toán.
- Giá: trang blog không nêu; theo Model Studio (tier Qwen-VL) ~vài phần nghìn đô/ảnh + free tier 1M token/model/90 ngày.

Lựa chọn tương đương khác: GPT-5 vision, Gemini 3 vision, Qwen3-VL/Qwen-OCR — đều đọc tốt. Dùng chuẩn OpenAI-compatible để dễ đổi.

## So sánh tesseract.js vs Vision LLM
| | tesseract.js (đã spike) | Vision LLM |
|---|---|---|
| Accuracy chữ game | ~50-75% ký tự → cần fuzzy+confirm | ~95%+, hiểu ngữ cảnh |
| Làm được gì | chỉ ra chữ thô | ra JSON cấu trúc: tướng+chiến pháp+chất, map tên Việt luôn |
| Hạ tầng | client-side, offline, FREE | cần API key → cần proxy/backend HOẶC user tự nhập key |
| Chi phí | 0 | ~token-based, **cực rẻ** (xem dưới) |
| Privacy | ảnh không rời máy | ảnh gửi bên thứ 3 |
| Phụ thuộc | model 15MB | mạng + nhà cung cấp |

## Chi phí (cực thấp — không phải rào cản)
Tính theo token, KHÔNG theo ảnh:
- Qwen3-VL (OpenRouter): ~$0.26/1M input, $2.60/1M output; bản 8B: $0.10/$0.42.
- 1 screenshot ≈ ~1-2k token ảnh + ~200 token output → **~$0.001-0.005/ảnh** (phần nghìn đô).
- **Free tier**: Alibaba Model Studio tặng ~1M token/model/90 ngày (endpoint Singapore) → đủ **hàng nghìn ảnh miễn phí**. OpenRouter cũng có vài model vision free.

## Rào cản THẬT: site static không giấu được key
GitHub Pages = chỉ file tĩnh, không backend → KHÔNG nhúng key vào JS (lộ ngay). 3 cách:

| Cách | Mô tả | Ưu / Nhược |
|---|---|---|
| **A. Serverless proxy** (khuyến nghị) | Cloudflare Workers/Pages Functions giữ key, site gọi proxy | Free tier rộng (CF Workers 100k req/ngày); UX mượt; +1 hạ tầng nhỏ, không còn "pure static" |
| **B. BYO key** | User tự dán API key của họ (lưu localStorage), browser gọi thẳng | Giữ zero-backend, chủ site 0 chi phí; nhưng user phải có key (ma sát cao) |
| **C. Free aggregator** | OpenRouter/free-tier vision models qua proxy | Rẻ/free nhưng phụ thuộc ToS + reliability |

## Kiến trúc đề xuất (vision-first, vẫn an toàn)
```
User upload screenshot
   -> Cloudflare Worker (giữ key, gọi Qwen3-VL/Qwen-OCR)
   -> model trả JSON: [{hero, tactics[]}, ...] (Hán)
   -> ĐỐI CHIẾU output với tactics.json (closed dict) bằng fuzzy
      (chống hallucination: model có thể đọc sai/bịa tên)
   -> hiển thị tên Việt chuẩn + mô tả + icon
```
**Vẫn cần `tactics.json` (closed dict)** để chốt tên chuẩn — vision LLM có thể đọc đúng chữ nhưng bịa tên Việt; fuzzy-match về dict đã crawl mới đảm bảo đúng.

## Khuyến nghị
- **Nếu chấp nhận 1 serverless proxy nhỏ (Cloudflare Workers free)**: chọn Vision LLM — UX tốt nhất, đọc cả đội, chi phí ~0, accuracy cao. Đây là phương án mạnh nhất.
- **Nếu phải giữ pure-static, zero-backend**: BYO-key (user dán key) hoặc tesseract.js fallback.
- **Hybrid an toàn**: Vision LLM đọc → fuzzy-match về `tactics.json` → user xác nhận icon (như đã chốt). Vision thay tesseract ở bước OCR, phần còn lại giữ nguyên.

## Điểm cần lưu ý
- **Hallucination**: luôn map output model về closed dict, không tin tên model tự sinh.
- **Privacy**: ảnh gửi bên thứ 3 — game tool nên rủi ro thấp, nhưng nên ghi rõ.
- **Reliability**: phụ thuộc nhà cung cấp + free tier có hạn → cân nhắc rate-limit/cache.
- **Lock-in**: dùng chuẩn OpenAI-compatible (OpenRouter) để dễ đổi model.

## Unresolved questions
- Chủ site chấp nhận thêm 1 serverless proxy (Cloudflare Workers) không, hay bắt buộc pure-static?
- Ngân sách: dùng free tier (đủ cho lượng nhỏ) hay trả phí khi scale?
- Chỉ đọc TÊN chiến pháp, hay để vision LLM đọc CẢ đội (tướng+chiến pháp+chất) + đối chiếu 172 team có sẵn?
- Có cần fallback offline (tesseract.js) khi không có mạng/quota không?

## Sources
- [Qwen-VL OCR (DashScope) — Alibaba Cloud](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-ocr)
- [Qwen3-VL pricing — OpenRouter](https://openrouter.ai/qwen)
- [Qwen API pricing 2026](https://pricepertoken.com/pricing-page/provider/qwen)
- [Hide API keys on static site with Cloudflare Workers](https://medium.com/@IamCOD3X/%EF%B8%8Fhide-your-api-keys-on-a-static-site-with-cloudflare-workers-3c87077da309)
- [Cloudflare Pages Functions — build an API](https://developers.cloudflare.com/pages/tutorials/build-an-api-with-pages-functions/)
- [llm-proxy-on-cloudflare-workers](https://github.com/blue-pen5805/llm-proxy-on-cloudflare-workers)
