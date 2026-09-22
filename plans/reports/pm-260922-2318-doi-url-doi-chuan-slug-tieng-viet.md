# Đổi URL trang chi tiết đội sang slug tiếng Việt — plan đã đóng

- **Kết quả:** plan `CamNangTQCCL/260922-1623` (`plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet`)
  đã chuyển sang `completed`; cả ba phase `done`, checklist 26/26, tiến độ 100%.
- **Phạm vi đóng:** đợt 1 gồm ledger handle, cutover route `/doi-chuan/` + `/doi-khac/`, refresh
  contract localization và phần SEO (canonical, `og:url`, `og:type`, `robots.txt`, sitemap).
  Đợt 2 (sửa dữ liệu binh chủng) vẫn là Non-goal của plan này, không nằm trong phần đã đóng.
- **Đối chiếu với thực tế:** mọi mục trong checklist đều có artifact tương ứng trong repo —
  `pipeline/team_route_handles.py` + ledger 1366/166, hai trang `src/pages/doi-*`, registry
  `setTeamRouteHandles`, chín obligation `ui:route-*` trỏ file mới, receipt
  `pipeline/localization-reviews/site-review-v5-056.json`, `src/pages/sitemap.xml.ts`,
  `public/robots.txt`, `dist/` không còn `teams/`, và docs đã mô tả path mới.
- **Kiểm thử:** Python 48/48; Node 302/302; Playwright 138/138; `npm run verify` 1682 file;
  build 1534 trang; gate localization xanh; ledger check 1366/166 xanh. Code review PASS 9.1
  không blocker; test audit PASS; Kongming GO sau phase; docs audit đã cập nhật.

## Lệnh `ak plan` đã chạy

```bash
# 1. Chuyển Steps thành checklist rồi đánh dấu hoàn tất
ak plan check plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet/phase-01-route-handle-ledger.md --json
ak plan check plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet/phase-02-route-cutover.md --json
ak plan check plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet/phase-03-seo-va-release.md --json

# 2. Plan chưa có row trong plan store nên phase close không resolve được
ak plan reindex --json            # dry run: 260918-0144 được nhận diện, 3 phase
ak plan reindex --apply --json    # đồng bộ file -> store (không ghi/xoá file plan)

# 3. Đóng từng phase (trả về status done)
ak plan phase close CamNangTQCCL/260922-1623 1 --json
ak plan phase close CamNangTQCCL/260922-1623 2 --json
ak plan phase close CamNangTQCCL/260922-1623 3 --json

# 4. Đóng plan (ghi frontmatter plan.md)
ak plan update CamNangTQCCL/260922-1623 --status completed --json
ak plan reindex --apply --json
```

Trạng thái dựng lại từ file sau bước 4: `ak plan status` báo `status completed`,
`phases_total 3 / phases_done 3`, `total_tasks 26 / done_tasks 26`, `progress_pct 100`.

## Ghi chú vận hành

- `phase close` chỉ mutate được khi plan có row trong store; plan này chưa từng được import
  nên phải `reindex --apply` trước. `reindex` chỉ đồng bộ file → store theo mô tả của CLI,
  không ghi và không xoá file plan; nó áp dụng cho mọi plan folder của repo nên các plan khác
  cũng được đồng bộ lại theo file trên đĩa.
- Với phase có checkbox, `ak plan` coi checkbox là nguồn trạng thái: dòng `status:` trong
  frontmatter của ba file phase vẫn ở giá trị template `pending`. CLI từ chối
  `ak plan phase update --status` vì field này thuộc file, nên nếu muốn dòng đó khớp trạng thái
  đã đóng thì cần một quyết định riêng (xem phần câu hỏi mở).

## Rủi ro theo dõi (không chặn)

- Ngữ nghĩa byte của final route segment khi gán handle ngoài ASCII mới.
- Baseline giả định publication đứng yên: `--write` từ chối gán lại ledger khi generation/hash
  lệch, nên publication dịch chuyển vì lý do khác phải rebind theo quy trình riêng.
- Bổ sung phép kiểm độc lập cho việc `404.html` từ chối `og:url`, ngoài verifier dist hiện có.
- 42 hàng lệch binh chủng không được sửa ở đợt này; facet "Loại binh" vẫn sai 3% cho tới đợt 2.

## Câu hỏi mở

- Có nên chuẩn hoá dòng `status:` trong frontmatter ba file phase về `completed` không, và nếu
  có thì thực hiện bằng đường nào khi CLI tuyên bố field này thuộc file còn trạng thái phase do
  checkbox quyết định?
