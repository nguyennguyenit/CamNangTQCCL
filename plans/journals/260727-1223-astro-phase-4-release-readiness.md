---
date: 2026-07-27
session: "Astro Phase 4 local release readiness"
status: completed
plan: "../260723-2127-migrate-static-spa-to-astro/plan.md"
environment: "macOS darwin; Node 22.16.0"
---

# Journal: 2026-07-27 — Astro Phase 4 release readiness

## Context

Phase 4 đưa Astro artifact đến trạng thái locally deploy-ready cho Cloudflare Pages, đồng thời cập nhật các tài liệu sở hữu quy trình build và release. Đây là bản ghi lịch sử công việc, không phải nguồn thẩm quyền hiện hành; plan, tests, verifier, runbook và evergreen docs mới quyết định hành vi hiện tại.

## What happened

- Thêm `public/_headers` với quy tắc `Cache-Control: public, max-age=0, must-revalidate` cho `/`, `/index.html`, `/js/*`, `/css/*` và `/data/*`.
- Shared verifier yêu cầu `public/_headers` và `dist/_headers` khớp byte, chấp nhận đúng deployment-control artifact này, đồng thời tiếp tục từ chối output ngoài allowlist, symlink, private path và nội dung giống secret. Artifact gồm `35` files, trong đó có `33` raw assets.
- Local Astro HTTP preview và routed `https://astro.local` trả `200` cho shell cùng toàn bộ manifest assets; các probe đại diện cho pipeline, Worker, tests và plans trả `404` cục bộ mà không lộ private bytes. Third-party traffic vẫn được stub hoặc block.
- README, architecture, deployment guide, code standards, codebase summary và PDR được cập nhật. Runbook tách rõ local evidence khỏi quy trình Pages inspection, preview, promotion, response-header/fallback verification, cache purge và rollback cần ủy quyền sau này.
- Full gates dưới Node `22.16.0` đạt: Astro diagnostics `0`, dist/header contracts `9/9`, Playwright `12/12`, Node `102/102`, Python `82/82`, Worker `53/53` cùng typecheck; root audit có `0` vulnerability.
- Evidence identity được chốt nhất quán:
  - Base commit: `d40722789452bc66f5f2a6b91d6fddb67c84f3af`.
  - Scoped-source digest, `46` files: `c55cd6a06477e92d665922c208fcfa98c42931e4577b1b1071976429c3a8c3ca`.
  - `dist/` digest, `35` files: `0d09cadc24fdb49c1b76a14c38f9936f47b079fe119cb2808c565d047f74bdd8`.

## Reflection

Phase 4 giữ được ranh giới bằng chứng hợp lý: contract và routed HTTPS chứng minh cấu trúc artifact, containment và mô hình cache tại local, nhưng không được diễn giải thành bằng chứng về cách Pages thực sự phục vụ headers hoặc fallback. Việc đặt `_headers` dưới cùng shared verifier giảm nguy cơ tài liệu, source và `dist/` lệch nhau. Release readiness đã hoàn tất mà không cần biến một lần chuẩn bị thành một lần phát hành.

## Decisions

| Decision | Rationale | Impact |
|---|---|---|
| Đưa `_headers` vào shared artifact policy | Deployment-control bytes phải được quản lý như một phần có chủ đích của artifact | Verifier kiểm tra inclusion chính xác và vẫn chặn output ngoài allowlist |
| Dùng local HTTP cùng routed HTTPS cho release-readiness proof | Kiểm tra asset exposure, containment, mixed-content và cache model mà không phụ thuộc external state | Bằng chứng hermetic; không tuyên bố Pages-equivalent behavior |
| Tách runbook release khỏi việc thực thi release | Pages settings, live headers, promotion và rollback cần ủy quyền cùng bằng chứng thực tế | Không deploy, không tạo deployment record và không ghi release claim |
| Giữ nguyên production origin và Vision boundary | Preview không đáp ứng exact production-origin policy; local proof không phải production canary | Không gọi Vision và không nới `ALLOWED_ORIGIN` |

## Next

- Chỉ commit khi có ủy quyền riêng.
- Chỉ inspect Pages, tạo preview, verify live headers/fallback, promote hoặc rollback trong một release được ủy quyền riêng.
- Khi release thật diễn ra, ghi nhận prior deployment, kiểm tra fresh/cached clients và chỉ cập nhật deployment records từ bằng chứng đã xác minh.
- Không có commit, push, Pages mutation/deployment hay Vision request nào được thực hiện trong Phase 4.
