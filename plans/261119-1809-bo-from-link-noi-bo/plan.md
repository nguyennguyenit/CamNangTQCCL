---
title: "Bỏ ?from= khỏi link nội bộ tới trang chi tiết đội"
description: "Link nội bộ tới trang chi tiết chỉ còn URL sạch; nút Quay lại lấy đích từ history.state → ?from= cũ → document.referrer → mặc định họ đội."
status: done
priority: P2
effort: 1d
issue: 172
branch: fix/clean-team-detail-links
tags: [bugfix, frontend, seo]
blockedBy: []
blocks: []
created: 2026-11-20
---

# Bỏ `?from=` khỏi link nội bộ tới trang chi tiết đội

## Overview

Link nội bộ tới trang chi tiết chỉ còn URL sạch. Nút "Quay lại" lấy đích theo thứ tự `history.state` → `?from=` cũ → `document.referrer` → sessionStorage (theo trang chi tiết) → trang mặc định của họ đội.
Production 2026-11-20: `/doi-chuan/` 338 thẻ `from` / 0 sạch, `/doi-khac/` 120 / 0, `/khai-hoang/` 40 / 0 (20 giá trị `from`).
Canonical đã sạch; vấn đề là internal link trỏ URL không canonical (Google khuyên link nội bộ trỏ canonical) và số biến thể không có trần (client dùng `location.href`).
Nguồn quyết định: tư vấn Fable (agent://FableFromParamSeo) + audit Astra GO-with-conditions (agent://AstraFromParamAudit). User chốt: đường nhanh, giữ `kho`/`xep`, tách `?variant=` Đội khác sang issue #172.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Không link nội bộ nào (HTML dựng sẵn lẫn DOM sau hydrate, gồm link đổi ngôn ngữ) mang `from` | P1 |
| 2 | Nút Quay lại về đúng danh sách + bộ lọc (kể cả `kho`/`xep`) khi click thường, Cmd/middle-click, reload, đổi variant, đổi ngôn ngữ, quay về sau đăng nhập Google, nút "cấu hình mặc định" | P1 |
| 3 | Khai hoang: tab mới từ đội B không quay về cặp của đội A (Astra finding 1) | P1 |
| 4 | Link cũ `?from=` vẫn chạy; URL được dọn `from` sau khi đọc | P2 |
| 5 | Verifier `dist/` chặn tái phát bằng parse URL, không regex thô | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Thư viện nguồn quay lại](./phase-01-thu-vien-nguon-quay-lai.md) | Done |
| 2 | [Trang chi tiết và mọi caller](./phase-02-wiring-trang-chi-tiet-va-caller.md) | Done |
| 3 | [Verifier, E2E, docs](./phase-03-verifier-e2e-docs.md) | Done |

## Non-goals

- `?variant=` của Đội khác (issue #172). Rule verifier chỉ cấm `from`, không đòi href = canonical.
- Copy href thẻ Khai hoang rồi mở trong cùng tab (không referrer, chưa có storage cho đội đó): Quay lại về `/khai-hoang/`, chip khôi phục từ snapshot phiên; URL danh sách không còn `khTeam` (user chấp nhận 2026-11-20).
- Redirect/Search Console removal: canonical tự gom URL `?from=` đã index.

## Quyết định thiết kế

- Chữ ký prerender (`referenceViewSignature`) **bỏ** thành phần URL (Astra finding 3): `state` đã mang season/q/filters (gồm `source`); list không đọc `scenario`/`ruleset`/`config`. Giữ stale guard cũ cho `kho`/`xep` (không ẩn thân dựng sẵn) qua `SSR_STALE_EXEMPT_KEYS`.
- Đích quay lại ghim vào `history.state.teamDetailReturn` (cùng entry: reload, đổi variant) **và** sessionStorage `tqccl:team-detail-return:v1` theo pathname chi tiết bỏ locale (entry mới: đổi ngôn ngữ, OAuth, skip-link, nút cấu hình mặc định). Referrer đứng trước storage để mở lại từ danh sách khác không lấy đích cũ.
- Khai hoang: đích lấy từ referrer thì ghi đè cặp bằng (đội của trang, variant lúc vào nếu là chip có thật); `?from=` cũ giữ nguyên cặp của nó.
- `Referrer-Policy: strict-origin-when-cross-origin` đưa vào `public/_headers` (hiện chỉ đặt ở Cloudflare).

## Success Criteria

- [ ] `npm run test:node` xanh; test mới của Phase 1 đỏ trước khi sửa.
- [ ] `npm run build && npm run verify` xanh, rule mới báo 0 href nội bộ có `from`.
- [ ] E2E mới + E2E bị ảnh hưởng (danh sách ở Phase 3) xanh.
- [ ] Astra audit diff: GO.

## Red Team Review

### Session — 2026-11-20
**Findings:** 23 thô, 14 sau gộp (14 accepted, 0 rejected; 1 accepted-modified: fallback Khai hoang dùng sessionStorage thay vì chuyển chỗ)
**Severity breakdown:** 6 High, 8 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Entry mới (OAuth, đổi ngôn ngữ, skip-link reload) mất đích | High | Accept | Phase 1, 2, 3 |
| 2 | Nút "cấu hình mặc định" Khai hoang mất đích | High | Accept (modified) | Phase 2, 3 |
| 3 | Giữ URL trong chữ ký + `kho` → mất adopt (169→60), trích sai Astra | High | Accept | plan, Phase 1, 2 |
| 4 | Copy-mở lại Khai hoang không có hợp đồng mới | High | Accept (non-goal, user chốt) | plan, Phase 3 |
| 5 | Thiếu test độc hại cho resolver | High | Accept | Phase 1 |
| 6 | Danh sách unit test thiếu `:523-534`, `returnHrefFor` | High | Accept | Phase 1 |
| 7 | Cuộn trước khi áp kho | Medium | Accept | Phase 2, 3 |
| 8 | `origin` không truyền cho state/from | Medium | Accept | Phase 1 |
| 9 | Referrer-Policy không nằm trong repo | Medium | Accept | Phase 2, 3 |
| 10 | `variant` lạ ghép vào cặp quay lại | Medium | Accept | Phase 2, 3 |
| 11 | Verifier bỏ sót host cũ, entity số, tokenizer thứ hai | Medium | Accept | Phase 3 |
| 12 | site-chrome re-encode query mọi trang | Medium | Accept | Phase 2 |
| 13 | E2E kho flaky, thiếu Soi đội, ca không referrer không chứng minh JS | Medium | Accept | Phase 3 |
| 14 | Trích dẫn sai (`{...history.state}`, file test verifier, test site-chrome không tồn tại) | Medium | Accept | Phase 2, 3 |

Whole-plan sweep: thứ tự nguồn quay lại thống nhất ở plan.md/Phase 1/Phase 2/docs Phase 3; mọi file test nhắc tới đã kiểm tồn tại (trừ `tests-js/site-chrome.test.mjs` ghi rõ là tạo mới).

## Câu hỏi còn mở

- Không.

<!-- slug: bo-from-link-noi-bo -->
