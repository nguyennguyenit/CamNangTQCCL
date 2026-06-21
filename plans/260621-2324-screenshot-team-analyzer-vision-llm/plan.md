---
title: Soi đội từ ảnh (Vision LLM) + Từ điển chiến pháp
description: >-
  Tra cứu chiến pháp đa ngữ + phân tích screenshot game (cả đội: tướng + chiến
  pháp + chất tướng) bằng Qwen3.7-Plus qua Cloudflare Worker proxy.
status: planning
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
| # | Phase | Trạng thái | Ship độc lập |
|---|---|---|---|
| 1 | [Crawl + dựng từ điển dữ liệu](./phase-01-crawl-tactic-dictionary.md) | Pending | Data foundation |
| 2 | [UI Từ điển + sửa data team](./phase-02-dictionary-ui-and-data-fix.md) | Pending | ✅ Có giá trị ngay, không cần AI |
| 3 | [Cloudflare Worker proxy + Qwen](./phase-03-cloudflare-worker-proxy.md) | Pending | Backend |
| 4 | [UI Soi đội từ ảnh](./phase-04-screenshot-team-analyzer-ui.md) | Pending | Tính năng chính |

## Dependencies
P1 → P2 (UI cần data). P1 → P3 (proxy schema dùng dict để validate). P3 → P4 (UI gọi proxy). P2 ship được trước, độc lập P3/P4.

## Acceptance (toàn cục)
- `tactics.json` phủ ≥ chiến pháp đang dùng (112) + có icon/mô tả; auto-link ≥80%, phần còn lại review thủ công.
- Từ điển: gõ Việt bỏ dấu / Hán-Việt / dán Hán đều ra đúng; chịu typo.
- Soi đội: upload 5 screenshot thật → đọc đúng ≥ phần lớn tướng+chiến pháp; mọi tên hiển thị là tên Việt **canonical** (đã match dict), không phải raw model.
- Proxy: không thể bị spam (Turnstile + rate-limit), có hard cap/ngày, key không lộ.
- Site vẫn chạy offline cho 3 section cũ (không regress).

## Risks (toàn cục)
- **R1 Hallucination vision** → bắt buộc fuzzy-match về closed dict + hiện độ tin + cho user sửa.
- **R2 Lạm dụng proxy / bill sốc** → Turnstile + rate-limit IP + hard daily cap; free tier.
- **R3 Schema drift Qwen** → ép JSON schema + validate; fallback "không đọc được, thử lại".
- **R4 Tên Hán đa âm / lệch** → char-map + review; dùng dict sửa lại data cũ.
- **R5 Privacy** → ảnh gửi bên thứ 3; ghi rõ disclaimer, không lưu ảnh.
- **R6 Crawl đủ category** → 174 mới là subset; phải lấy hết + field nội dung.
- **R7 Phụ thuộc/lock-in** → chuẩn OpenAI-compatible để đổi model (Qwen/GPT/Gemini).

## Mode
`--deep --tdd`: test-first cho logic thuần (hán-việt transliterate, fuzzy-matcher, crawl parser, worker validate). UI/integration test thủ công + screenshot thật.
