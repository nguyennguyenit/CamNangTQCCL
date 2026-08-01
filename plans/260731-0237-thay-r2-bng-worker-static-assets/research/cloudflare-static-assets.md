# Nghiên cứu Cloudflare Worker Static Assets

Ngày: 2026-07-31

> Quyết định sau red-team: plan không dùng public preview làm gate chính. Candidate được thêm ở `0%` và gọi qua Version Override trên production route; authenticated Worker-version header phải khớp target. Preview URLs giữ disabled.

## Kết luận

- Corpus hiện tại gồm sáu JSON, tổng `860,045` byte; phù hợp với Worker Static Assets.
- Một Worker Version chứa code, static assets, bindings và compatibility settings. Code và dữ liệu có thể deploy/rollback nguyên tử.
- Dùng một asset collection riêng, không trỏ thẳng toàn bộ `data/`.
- Cấu hình mục tiêu:

```jsonc
"assets": {
  "directory": "./.worker-assets",
  "binding": "ASSETS",
  "run_worker_first": true
}
```

- Worker chỉ phục vụ `/healthz` và `/mcp`; mọi asset path công khai phải trả `404`.
- Runtime đọc asset qua `env.ASSETS.fetch()` với hostname nội bộ và pathname allowlist cố định. Không passthrough request ngoài vào binding.
- Release mục tiêu: deterministic build → `wrangler versions upload` → candidate `0%` + authenticated Version Override → promote đúng version lên `100%` → production verification.
- Không chia traffic giữa hai version: hai `workflowVersion` đồng thời có thể làm cursor/confirmation binding không ổn định.

## Gate thực nghiệm

- Version Override thực sự chọn đúng candidate và vẫn đi qua production route/edge controls.
- Cold parse/validation và memory với corpus thật nằm trong budget của account.
- Deploy token có đúng quyền upload/promote/rollback.
- Known-good version rollback vẫn hoạt động khi version cũ còn R2 bindings.

## Nguồn chính thức

- [Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
- [Preview URLs](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)
- [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
