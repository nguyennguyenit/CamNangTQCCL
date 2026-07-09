---
type: journal
date: 2026-07-10
topic: chieu-mo-tuong-vang-tracker-brainstorm
---

# Journal: Chiêu mộ tướng vàng tracker brainstorm

## Context

User muốn thêm bảng theo dõi quay tướng vàng 5 sao cho lượt miễn phí/nửa giá. Repo là static site vanilla JS, đã có data tướng và tab tra cứu tướng.

## What Happened

- Scout README/docs/code để xác nhận kiến trúc static-first.
- Xác nhận `data/heroes-dict.json` có 112 tướng 5 sao.
- Chốt scope: tab mới, localStorage, nhiều account, export/import JSON.
- Chốt pity 30 cần ghi cả lượt không ra vàng, không chỉ lần ra 5 sao.
- Cắt ảnh/OCR khỏi phase đầu.

## Decisions

- Build local-first tracker trước, không cloud sync.
- Pity tính theo `account + banner`.
- JSON backup có schema version, ids, timestamps để chuẩn bị merge/sync sau.
- Không lưu ảnh trong localStorage.

## Next

Tạo implementation plan nếu user muốn chuyển sang `/ck:plan`.

## Unresolved Questions

- Banner mặc định ngoài `Danh tướng` và `Đặc biệt`.
- Import phase đầu overwrite-only hay có merge đơn giản.
