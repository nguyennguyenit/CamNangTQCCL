# Báo cáo sửa review vòng 3 cho bản `/ja/` (PR #133)

Branch `feat/ja-locale-r4` (từ `origin/feat/ja-locale` @ `dce02cc9`), worktree `CamNangTQCCL-ja-r4`, ngày 2026-11-18. Không merge, không deploy.

## Sửa (TDD: test đỏ trước, xanh sau)

| Phát hiện | Nguyên nhân | Sửa | Commit |
|---|---|---|---|
| Low: JSON-LD `about` của trang đội ja ghi chữ Hán nguồn (`張讓`, `SP 貂蟬`) thay vì tên Nhật trên trang (`張譲`, `SP 貂蝉`) | `recommendedDetailPaths` dựng `shown` bằng `holderDisplayName(hero,'ja')` → `sourceName`, mà bộ tra tên ja chỉ được đăng ký trong `prepare()` của `team-ssr.ts`; `getStaticPaths` chạy trước `prepare()` nên trả nguyên chữ nguồn | `recommendedDetailPaths` gọi `await prepare()` trước khi dựng props (một dòng, `src/lib/team-detail-pages.ts`). Đội khác và Khai hoang không dùng `holderDisplayName` (đi nhánh `jaNames.fromRaw`), test xác nhận đã đúng | `5eb5165c` |
| Low: link cũ `?group=&id=` trên `/ja/tra-cuu/` rơi sang bản vi | `lookupHubTarget` chỉ nhận `/zh/`; regex `replaceState` inline viết cứng `zh` | `LOOKUP_HUB_TABLES.prefixes` = tiền tố `LOCALE_PREFIX` theo `SITE_LOCALES` (`["/zh","/ja"]`), truyền tường minh làm tham số thứ tư của `lookupHubTarget` (hàm vẫn tự đủ để nhúng inline); regex inline dựng từ cùng danh sách | `8926d2e2` |
| Low: owner obligation trỏ tên biến không còn | `ui:lookup/qilue-rarity-*` ghi `QILUE_LABELS` | Đổi thành `QILUE_RARITY_LABELS` | `42abbaa3` |

Test thêm/sửa:
- `tests-js/seo-dist-contract.test.mjs`: test JSON-LD trang chi tiết đội chạy cả bản ja (mọi tên trong `about` phải có trong thân trang, ~5.600 trang); test riêng `/ja/doi-chuan/pk-s27-truong-nhuong-han-nhuc-cung/` phải ghi `張譲`, `SP 貂蝉`, không còn `張讓`/`SP 貂蟬`. Trên build `dce02cc9` cả hai đỏ.
- `tests-js/lookup-ids.test.mjs`: ca `/ja/tra-cuu/` (nhóm + mã, chỉ nhóm, nhóm lạ ở lại mục lục ja), `/japan/` không bị nhận là tiền tố, `prefixes` khớp `SITE_LOCALES`.
- `tests-e2e/unified-lookup.spec.mjs`: thêm `/zh/` và `/ja/` vào test chuyển tiếp của mục lục (chạy script inline thật, gồm nhánh `replaceState`).
- `tests/test_site_localization.py`: owner dạng hằng `UPPER_SNAKE` phải là tên có thật trong file sở hữu.

## Ghim lại và file sinh

- `b844eabc chore(data): ghim lại hash nguồn`: `LookupHubPage.astro` nằm trong `sourceFiles`; đổi owner làm đổi `concreteInventorySha256` (`2afd3ac8…` → `733821f1…`, số location giữ 68.205). Chạy đủ chuỗi build/check/publish/check public/prune, `team_route_handles --rebind/--check`, `lookup_route_handles --check`. Generation Recommended `556ec3a2…` → `867c21dd…` (nội dung đội không đổi).
- `778e9c88 chore(mcp)`: sinh lại `WORKFLOW_BUILD_ID` vì `js/lookup-ids.js` là nguồn workflow (`js/i18n.js` đã có sẵn trong danh sách). Commit này nằm sau commit ghim; file không thuộc `sourceFiles` nên không ảnh hưởng pin (đổi thứ tự commit bị chặn quyền, đã giữ nguyên).

## So output với `origin/feat/ja-locale` (`dce02cc9`)

`scripts/compare-locale-output.mjs` (chuẩn hoá pin generation, ngày build): 9.170 file ở cả hai bên, không thêm/mất, đổi 1.116 file:

| Nhóm | Số trang | Phần đổi |
|---|---:|---|
| `ja/doi-chuan/**` | 1.113 | Chỉ `about` của khối JSON-LD WebPage (đã kiểm: bỏ JSON-LD thì HTML trùng byte; các khóa JSON-LD khác không đổi) |
| `tra-cuu/`, `zh/tra-cuu/`, `ja/tra-cuu/` | 3 | Chỉ script inline `#lookup-hub-redirect` (hàm nhúng chung cho mọi locale nên bản vi/zh đổi theo là không tránh được) |
| Còn lại vi/zh (kể cả `doi-chuan`, `doi-khac`, `khai-hoang` vi/zh) | 0 | — |

Trang ja Đội khác (167) và Khai hoang (19) không đổi: `about` đã đúng tên Nhật.

## Kiểm

| Lệnh | Kết quả |
|---|---|
| `npm run check` | 0 lỗi |
| `npm run build` | 8.836 trang, ~14 s |
| `npm run verify` | xanh |
| `npm run test:dist` | 71/71 |
| `npm run test:node` | 993/993 |
| `python3 -m unittest discover -s tests` | 603 OK (13 skip) |
| `cd worker && npm test` | 203/203 |
| `cd mcp-worker && npm run check:workflow-build && npm run check:knowledge-bundle` | xanh sau khi sinh lại; thêm `npm test` 574/574, `npm run typecheck` xanh |
| Playwright `ja-locale`, `zh-locale`, `team-detail-pages`, `unified-lookup` | 184/184 |

## Worktree

Không xoá worktree nào. Worktree của đợt này: `/Users/plateau/Project/CamNangTQCCL-ja-r4` (branch `feat/ja-locale-r4`), đề xuất dọn sau khi ghép vào `feat/ja-locale`.
