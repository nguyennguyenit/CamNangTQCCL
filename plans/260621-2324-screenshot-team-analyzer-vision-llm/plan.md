---
title: Soi đội từ ảnh (Vision LLM) + Từ điển chiến pháp
description: >-
  Tra cứu chiến pháp đa ngữ + phân tích screenshot game (cả đội: tướng + chiến
  pháp + chất tướng) bằng Qwen3.7-Plus qua Cloudflare Worker proxy.
status: implemented
priority: P2
branch: main
created: '2026-06-21T23:24:00+07:00'
createdBy: controller
---

# Soi đội từ ảnh + Từ điển chiến pháp

## Overview
Hai tính năng chung nền dữ liệu:
1. **Từ điển chiến pháp** — search Việt/Hán-Việt/Hán + mô tả + icon (offline, không AI).
2. **Soi đội từ ảnh** — user upload screenshot game → Qwen3.7-Plus đọc **cả đội** (3 tướng + chiến pháp + chất tướng) → fuzzy-match về từ điển → hiện tên Việt chuẩn + đối chiếu 172 team có sẵn.

Cơ sở: 3 spike đã xong (crawl curl được, phiên Hán-Việt chính xác, OCR/vision khả thi). Quyết định đã chốt: Vision LLM = Qwen3.7-Plus; hạ tầng = **Cloudflare Worker proxy + guardrail**; scope đọc = **cả đội**.

## Quyết định đã chốt (locked)
- Vision: **Qwen3.7-Plus** (OCR-Bench-V2 ZH + ScreenSpot grounding), gọi qua Alibaba Model Studio (OpenAI-compatible).
- Hạ tầng: **Cloudflare Worker proxy** giữ key + **Turnstile + rate-limit + hard daily cap**. KHÔNG nhúng key vào site.
- Chống hallucination: **luôn fuzzy-match output model về `tactics.json` (closed dict)**, không tin tên model tự sinh.
- Site giữ static (GitHub Pages); Worker là hạ tầng tách biệt.

## Phases
| # | Phase | Trạng thái | Thứ tự ship |
|---|---|---|---|
| 1 | [Crawl từ điển chiến pháp + **tướng**](./phase-01-crawl-tactic-dictionary.md) | ✅ Done (commit e4cb2c5) | Data foundation |
| 2 | [UI Từ điển + sửa data team](./phase-02-dictionary-ui-and-data-fix.md) | ✅ Done (commit e4cb2c5) | Sau P1, trước P3/P4 |
| 3 | [Cloudflare Worker proxy + Qwen](./phase-03-cloudflare-worker-proxy.md) | ✅ Done — code (commit 8bb2a79) | Backend (gate ToS) |
| 4 | [UI Soi đội từ ảnh](./phase-04-screenshot-team-analyzer-ui.md) | ✅ Done — code (commit a4fda8a) | Tính năng chính |

## Trạng thái triển khai (2026-06-22)
Cả 4 phase **code-complete + review + commit** (3 commit, chưa push). 88 test xanh (64 Python + 24 JS) + 34 worker vitest. **Còn lại do user (pre-ship):**
- Deploy Worker (Cloudflare + DashScope key) + tạo Turnstile → điền `js/config.js` (workerUrl, siteKey).
- **Gate ToS C2**: chọn region (intl/cn — code hỗ trợ cả 2, mặc định intl), xác minh model id vision, test 5–10 screenshot thật trước public.
- Bổ sung effect/loại/chất cho 28 chiến pháp generic (`data/tactics-generic.json`, đang `pending`).
- Push lên main để deploy GitHub Pages (từ điển chạy ngay; soi đội cần worker).

## Dependencies
P1 → P2 (UI cần data). P1 → P3/P4 (cần dict tướng+chiến pháp để map/validate). P3 → P4. **P2 ship SAU P1** (phụ thuộc `tactics.json`), trước P3/P4 — KHÔNG song song P1 (sửa H2).

## Acceptance (toàn cục)
- `tactics.json` phủ ≥ chiến pháp đang dùng (112) + có icon/mô tả; auto-link ≥80%, phần còn lại review thủ công.
- Từ điển: gõ Việt bỏ dấu / Hán-Việt / dán Hán đều ra đúng; chịu typo.
- Soi đội: upload 5 screenshot thật → đọc đúng ≥ phần lớn tướng+chiến pháp; mọi tên hiển thị là tên Việt **canonical** (đã match dict), không phải raw model.
- Proxy: không thể bị spam (Turnstile + rate-limit), có hard cap/ngày, key không lộ.
- Site vẫn chạy offline cho 3 section cũ (không regress).

## Risks (toàn cục)
- **R1 Hallucination vision** → bắt buộc fuzzy-match (`js/match-dict.js`, viết mới) về closed dict + cờ độ tin + user sửa.
- **R2 Lạm dụng proxy / bill sốc** → Turnstile + rate-limit IP + hard daily cap + **monthly kill-switch + không gắn thẻ** (H5).
- **R3 Schema drift Qwen** → spike xác nhận structured-output (M1); ép schema + validate + tolerant parse.
- **R4 Tên Hán đa âm / lệch** → char-map + review ghi vào `aliases.json` (deterministic, M4); dùng dict sửa data cũ.
- **R5 Privacy/ToS (CRITICAL C2)** → **gate ToS điều kiện ship**: opt-out training + cho phép ảnh game + region rõ; disclaimer đích danh Alibaba (M3); không lưu ảnh.
- **R6 Crawl đủ category** → 174 là subset; lấy hết + field nội dung; **fail loud len != totalCount** (H3).
- **R7 Lock-in** → lớp `callModel()` cover cả endpoint LẪN cách truyền ảnh (base64 vs url) để đổi Qwen/GPT/Gemini (L3).
- **R8 Bản quyền icon (CRITICAL C3)** → KHÔNG redistribute PNG aligames; chỉ lưu iconUrl, MVP text-only.
- **R9 Worker input abuse (H4)** → enforce size/MIME/OPTIONS/anti-replay tại Worker (không tin nén client).

## Audit (đã xử lý)
Red-team audit: `plans/reports/from-code-reviewer-to-controller-audit-screenshot-team-analyzer-plan-260621-2331-report.md`. Đã áp: C1 (thêm crawl tướng + bảng chất tướng + 3 trục acceptance), C2 (gate ToS), C3 (icon URL-only), H1 (fuzzy viết mới), H2 (nhãn ship), H3 (crawl robust), H4 (worker input guard), H5 (kill-switch), M1-M4 (structured-output spike, Jaccard defer, disclaimer đích danh, review→aliases). 4 câu hỏi mở: dict tướng (tbId 武将库 đã có → giải C1) / ToS (gate P3) / icon (URL-only) / structured-output (spike P3 M1).

## Mode
Research sâu + spike đã xong (không cần vòng deep-planning nữa). TDD **chọn lọc**: test-first cho logic thuần (hán-việt transliterate, fuzzy-matcher, crawl parser, worker schema validate); UI/integration/vision test thủ công + screenshot thật (YAGNI cho glue).
