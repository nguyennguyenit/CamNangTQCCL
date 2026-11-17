# Scout: dữ liệu trang Đội chuẩn (2026-11-17)

Mục đích: thêm ô kỳ lược có cấu trúc trên trang Đội chuẩn. Phần này chỉ đọc code, chưa sửa gì.

## Đường đi dữ liệu
- **Nguồn:** sgsdeck. `sourceConfigId` là slug của nguồn: `s27-official-*`/`s27-ofw-*` (台服官方), `s27-lp-*` (小幫手), `*-ay` (阿焰), `*-sr` (秋石). PK-S27 có 169 cấu hình.
- **Parse:** `pipeline/sgsdeck_recommended.py`, gồm `_display_notes` (~l.230) và `parse_recommended_detail_with_display_notes` (~l.312).
- **Pack:** `pipeline/localization-inputs/recommended.json`, gồm các phần `records`, `details`, `displayNotes`, `provenance` (`recommendedCorpusHash`).
- **Build:** `pipeline/build_recommended_reference.py`. Các hàm chính:
  - `raw_source_record` (l.48)
  - `_validated_display_notes` (l.115)
  - `prepare_publication_inputs` (l.124)
  - `validate_generation_inputs` (l.292)
  - `_build_generation_locked` (l.386)
  - `inputs_from_cache` (l.662), trong đó có `attach_display_notes` (~l.759)
- **Dịch ghi chú:** `pipeline/site_localization.py`, gồm `recommended_note_inputs` (l.1548), `validate_review_receipts` (l.1631), `_apply_recommended_translations` (l.2001). Bản dịch nằm ở `pipeline/site-translations.json`, biên nhận review ở `pipeline/localization-reviews/`.
- **Ledger dedup:** `pipeline/recommended-other-teams.json` khóa theo `recommendedCorpusHash`. Hash này tính trên phần raw, nên thêm trường raw sẽ làm lệch ledger.
- **Render:**
  - `js/recommended-reference-render.js`: `recommendedDetailTrees` (l.685), `detailNotes` (l.325)
  - `src/lib/team-ssr.ts:103`, `src/lib/team-section-ssr.js`
  - `src/lib/team-detail-pages.ts`: `TeamLookupLinks` (l.94, hiện chỉ có tactic và book), `recordLookupLinks` (l.215)

## Schema và tiền lệ
- Đội không có trường riêng cho phương lược hay kỳ lược.
- Tiền lệ gần nhất cho trường tùy chọn là commit `d4bddb0` (`tacticBeforeLevel20Raw`, lấy từ markup). Chưa có tiền lệ tách một trường có cấu trúc từ chữ ghi chú tự do.

## Đếm PK-S27 (169 cấu hình, ước lượng)
- **A.** Dạng `作戰方略：X。奇略卡（第 2→6 回合）：…`: 16 đội, đều từ 台服官方.
- **B.** Dạng `奇謀（X）：a→…`: 22 đội.
- Nhãn phương lược gặp được: 謀算, 強攻, 整軍, 襲擾, 久戰 (久戰 chỉ có 1 đội).
- **C.** Dạng `奇略：a、b…`, không ghi thứ tự: khoảng 13 đội.
- **D.** Nhãn lạ hoặc sai: `s27-han-yuanshu-feixiong-qi`, và `s27-lp-zuolv-qiang` (ghi nhãn 謀算 nhưng chuỗi thẻ là 強攻, có chú 待確認).
- **R.** Chép kỳ lược của đội khác (復刻): `s27-lp-beifa-qiang`, `s27-lp-taoyuan-dun-ay`, `s27-lp-taiwei-dun-ay`, `s27-chuanzi-gong`.
- Không có thẻ: khoảng 110 đội.

## Nơi khác dùng dữ liệu đội
- **zh:** dùng chung component và builder với bản Việt.
- **llms:** `src/lib/llms-documents.ts:82` lấy chữ từ `recommendedDetailPlainText`.
- **JSON-LD:** chỉ chứa tướng.
- **MCP:** `mcp-worker/src/research/team-handlers.ts`. Trường mới không tự hiện ra ở đây.
- **Đội của tôi:** `js/my-teams-sources.js:231`.
- **Tìm kiếm:** `js/recommended-reference-state.js:178`.

## Test
- Python: `test_sgsdeck_recommended.py`, `test_build_recommended_reference.py`, `test_site_localization.py`, `test_recommended_team_dedup.py`.
- JS: `recommended-before-level-20.test.mjs`, `team-section-ssr.test.mjs`, `team-view-trees.test.mjs`.
- E2E: `team-detail-pages.spec.mjs`, `team-ssr-parity.spec.mjs`, `recommended-browser.spec.mjs`.
