# Project Roadmap

## Mục tiêu ngắn hạn

1. Giữ dữ liệu hiện tại khớp với export HTML local.
2. Giữ site tĩnh chạy được chỉ bằng HTTP server + JSON đã commit.
3. Chỉ bật `Soi đội từ ảnh` khi Worker và `js/config.js` đã cấu hình thật.

## Việc nên làm sớm

- Cập nhật `pipeline/aliases.json` khi gặp typo mới.
- Cập nhật `pipeline/team-nicknames.json` khi muốn đổi tên gọi khác cho team.
- Cập nhật `pipeline/tactic-name-overrides.json` khi tên chiến pháp cần map lại.
- Bổ sung mô tả cho 28 tactic generic trong `data/tactics-generic.json` nếu có nguồn chắc.
- Giữ test Python / JS / Worker chạy qua sau mỗi lần đổi data model.

## Việc duy trì

- Rebuild `data/*.json` khi source HTML `Meta Team PK/` thay đổi.
- Kiểm tra lại count sau `python3 -m pipeline.build_json`.
- Giữ `docs/` đồng bộ với hành vi thật của code.
- Tránh thêm framework mới nếu chưa có nhu cầu rõ.

## Khi nào phải cập nhật docs

- Đổi command chạy local.
- Đổi cấu trúc `data/*.json`.
- Đổi flow deploy Pages hoặc Worker.
- Đổi behavior filter, render, analyze, hoặc limit.
- Đổi quyền / secret / config public trong `js/config.js` hoặc `worker/`.

## Hướng mở rộng nếu cần

- Nếu cần quota cứng hơn, thay KV best-effort bằng cơ chế counter mạnh hơn.
- Nếu cần model khác, đổi `worker/src/config.ts` và phần gọi model, rồi cập nhật docs.
- Nếu cần thêm section mới, tách rõ dữ liệu build và render trước khi mở rộng UI.

## Kết luận

Roadmap của repo này là bảo toàn độ đúng của dữ liệu, giữ deploy đơn giản, rồi mới mở rộng tính năng phụ trợ. Không cần phình kiến trúc khi dữ liệu và UI hiện tại vẫn còn chạy gọn.
