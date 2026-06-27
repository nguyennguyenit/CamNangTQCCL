# Cẩm Nang Team - Tam Quốc Chí Chiến Lược

Website tĩnh tra cứu meta team cho Tam Quốc Chí Chiến Lược. Chạy bằng HTML/CSS/vanilla JS, không bundler, không framework.

## Có gì

Ba tab team (`Team PK`, `Đô Úy`, `Meta phe (cũ)`) dùng **cùng một bộ lọc inline** từ module `js/team-filter-section.js` (ô search toàn văn + nhóm chip). Các nhóm chip nằm gọn trên 1 hàng; tướng/chiến pháp/binh thư tra bằng ô tìm kiếm (không còn combo riêng). Mỗi tab tự tính facets từ tập team của nó; nhóm chỉ còn ≤1 giá trị (không lọc được gì) thì tự ẩn. Trên điện thoại, vùng nhóm lọc thu gọn sau nút **☰ Bộ lọc**. Wrapper mỏng mỗi tab: `js/team-pk.js`, `js/do-uy.js`, `js/meta-cu.js`.

- `Team PK`: 50 team giới thiệu (team Đô Úy và Meta phe cũ tách sang tab riêng), lọc theo loại binh / sao / phe, có search toàn văn. Team giới thiệu không có sẵn phe nên **quốc gia (Ngụy/Thục/Ngô/Quần/Hỗn hợp) được suy từ phe đa số của 3 tướng** (`js/derive-team-faction.js`) để gắn badge + viền màu và bật bộ lọc Phe.
- `Đô Úy (ss18)`: tab riêng cho meta đội hình Đô Úy mùa SS18 (48 team), thêm lọc tier + khuyến nghị, gắn badge tier T0–T1 + badge khuyến nghị (nguồn tham khảo `ss18.thanglonghoi.xyz`).
- `Meta phe (cũ)`: tab riêng cho 110 team meta phe các mùa cũ (source `moi-phe`), lọc theo loại binh / phe, có search toàn văn.
- `Cùng Tồn`: nhóm team cùng tồn tại, kèm `Thêm` và `Kỹ năng quân sư`.
- `Khai hoang`: đội khai hoang và quân thủ các mỏ.
- `Tra cứu tướng`: 112 tướng, lọc theo thích tính binh chủng (S/A) / vai trò / phe / sao, search fuzzy (Việt bỏ dấu / Hán-Việt / Hán); click card mở modal chi tiết (stats + thích tính + 2 chiến pháp tự mang/truyền thừa link sang thư viện).
- `Tra cứu chiến pháp`: 237 chiến pháp, search fuzzy, chạy offline, không AI.
- `Soi đội từ ảnh`: upload screenshot, đọc bằng Worker + Vision LLM (tướng + chiến pháp + binh thư), map về tên Việt canonical, hiện icon tướng để đối chiếu, rồi so với toàn bộ team. Tên tướng bị che thì đoán từ chân dung kèm cờ "kiểm tra".

## Chạy local

Frontend dùng `fetch()` JSON nên phải chạy qua HTTP server.

```bash
python3 -m http.server 8000
```

Mở `http://localhost:8000`.

Nếu cần rebuild dữ liệu từ HTML nguồn, phải có folder `Meta Team PK/` ở root repo.

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
python3 -m pipeline.build_books_dict
python3 -m pipeline.build_team_tier
```

### Tier team (theo mùa)

Tier T0–T3 gắn vào **team** (nguồn TQ rank đội hình), lưu thủ công ở `pipeline/team-tier-map.json` (`team id` → `rankings:[{source,tier,updatedAt}]`, multi-source), build ra `data/team-tier.json` bằng `build_team_tier`. Badge hiện bậc tốt nhất + tooltip mọi nguồn; team chưa có tier vẫn render bình thường.

Curate đầu mùa (suggest-only, phải duyệt tay): tải tay 1 trang xếp hạng (zhihu/taptap thường chặn anti-bot nên lưu `.html` từ browser), rồi:

```bash
python3 -m pipeline.suggest_team_tier path/to/saved-tier-list.html
```

Tool parse offline, in gợi ý `{tên đội TQ, tier, team id (khớp composition tướng)}` để chép vào `team-tier-map.json`. KHÔNG tự ghi map. Tier ngoài `{T0,T0.5,T1,T1.5,T2,T3}` sẽ bị `build_team_tier` fail-loud.

## Test

```bash
python3 -m unittest discover -s tests
node --test "tests-js/*.test.mjs"
cd worker && npm test
cd worker && npm run typecheck
```

## Deploy

- Site tĩnh: deploy bằng Cloudflare Pages hoặc static host tương đương, publish `index.html`, `css/`, `js/`, `data/`.
- GitHub Pages đang tắt vì repo private không được plan hiện tại hỗ trợ.
- Worker soi đội: deploy riêng trong `worker/` bằng Wrangler.

## Cấu trúc chính

- `index.html`, `css/styles.css`, `js/*.js`: frontend tĩnh.
- `data/*.json`: dữ liệu đã build, commit sẵn.
- `pipeline/*.py`: build dữ liệu từ HTML nguồn.
- `worker/`: proxy Cloudflare cho ảnh soi đội.
- `tests/`, `tests-js/`: test Python, JS, Worker.

## Tài liệu

- [Tổng quan + PDR](docs/project-overview-pdr.md)
- [Tóm tắt codebase](docs/codebase-summary.md)
- [Chuẩn code](docs/code-standards.md)
- [Kiến trúc hệ thống](docs/system-architecture.md)
- [Roadmap](docs/project-roadmap.md)
- [Deploy](docs/deployment-guide.md)
- [Design](docs/design-guidelines.md)

## Ghi chú

- `js/config.js` đang để placeholder cho `workerUrl` và `turnstileSiteKey`, nên tab `Soi đội từ ảnh` chưa hoạt động cho tới khi cấu hình thật.
- `data/tactics-generic.json` có 28 chiến pháp generic chờ ghép mô tả.
- `data/books-dict.json` map binh thư Hán→Việt (62/74, từ bảng thủ công `pipeline/books-han-viet-map.json`); binh thư VN dùng tên dịch nghĩa nên không auto-link như chiến pháp. 12 còn lại đều count thấp (≤5 team), bổ sung khi có nguồn đối chiếu Hán↔Việt.
- Nguồn HTML `Meta Team PK/` và cache crawl không commit, nên clone repo không tự rebuild được nếu thiếu export local.
- `Meta mỗi phe (cũ)` được gắn nhãn `Cũ`.
