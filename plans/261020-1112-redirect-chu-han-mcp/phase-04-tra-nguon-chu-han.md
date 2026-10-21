---
phase: 4
title: "Tra nguồn và chuyển dữ liệu chữ Hán"
status: pending
priority: P1
effort: "1d"
dependencies: [3]
---

# Phase 4 — Tra nguồn và chuyển dữ liệu chữ Hán

<!-- Updated: Red Team 2026-10-20 - 63 mục tính từ dữ liệu (thêm 3 dòng baseline), kind capture cho 16 TROOP, viSha256 mọi loại, chuyển dữ liệu cùng kết quả tra (không nhãn tạm), rà đủ mọi mục, không lấy SGSDeck làm ref -->

## Mục tiêu
Mọi chiến pháp có chữ Hán không từ SGSDeck (31 pending + 29 `newTactics` + 3 baseline = 63, xác định lại bằng builder) có một mục `zhEffects` với kết quả tra trung thực: `source` (URL đối chiếu được), `capture` (chỉ 16 TROOP từ màn 訓兵場 client TW), hoặc `translation` (dịch từ `effectViet`). Dữ liệu được chuyển trong cùng commit với bảng theo dõi.

## Bằng chứng
- 31 id pending, 29 `newTactics`: [reports/bang-chung.md](./reports/bang-chung.md).
- 3 baseline: `tactic:nhanh-tri-dong-nao` (SGSDeck `待補充`, `data/sgsdeck/tactics.json:15206`), `tactic:luc-luc-thuong-quoc` (`:14732`; chữ Hán "降低15%" lệch vi "15%→30%", `data/tactics.json:10405-10406`), `tactic:vo-song-thuong-tuong` (không có bản ghi SGSDeck; "伤害率246%" lệch vi "123%→246%", `data/tactics.json:9375-9376`).
- 16 TROOP `tinh-*`: chữ Hán chụp màn 訓兵場 client TW (`%TEMP%\tqccl-cap\gen.py:176`); file chụp đã mất. 13 `newTactics` còn lại: `gen.py:286` đọc `new-tactics-zh.json` (đã mất), changelog ghi "三略庫/ảnh TW" (`docs/project-changelog.md:6`) — không đủ bằng chứng từng mục.
- `effectViet` của 29 `newTactics` có sẵn (gán `:1182-1184`), nên `viSha256` tính được từ đầu vào trước promote.

## File
- Tạo: `plans/261020-1112-redirect-chu-han-mcp/reports/nguon-chu-han.md` (bảng theo dõi)
- Sửa: `pipeline/lookup-client-tactics.json` (bỏ `effectZh` ở 29 `newTactics`; thêm `zhEffects` cho mọi mục)
- Sửa: `tests/test_build_unified_lookup.py` (kỳ vọng `placeholder_fallback :136-138` theo dữ liệu mới)

## Quy tắc
- **`source`** chỉ khi trang công khai trên host allowlist (三略庫 `sanzhan.slgsim.com`, Bahamut `forum.gamer.com.tw`) mô tả cùng chiến pháp **và cùng cơ chế**: mục tiêu, tỉ lệ phát động, số liệu cấp 1/tối đa, loại, điều kiện mùa. Lệch số → không phải `source`. `text` lấy nguyên văn phần hiệu ứng (bỏ HTML, ký tự ẩn), `ref` = URL trang cụ thể. Không dùng SGSDeck làm `ref` (dòng SGSDeck đã là `null`; gate MCP cấm chuỗi "sgsdeck").
- **`capture`** chỉ cho 16 TROOP `tinh-*` khi 三略庫 không có trang khớp: giữ nguyên chữ hiện có trong `newTactics.effectZh`, `note: "client TW 訓兵場 2026-10-17"`. Có trang khớp → `source`.
- **`translation`** cho mọi mục còn lại không có nguồn khớp: dịch `effectViet` hiện tại sang chữ Hán, giữ đúng số liệu, cú pháp `x→y` và thuật ngữ đã dùng ở các chiến pháp cùng loại trong `data/tactics.json` (đối chiếu cặp `effect`/`effectViet` có sẵn). Nhóm `*-tinh-thong` (4 mục) và nội chính B dùng cùng khuôn câu.
- 3 dòng baseline: chữ cũ lệch số → không giữ; `source` nếu tìm được, nếu không `translation`.
- Mọi mục: `viSha256 = sha256(effectViet UTF-8)` tại lúc gán.

## Các bước
1. Xác định danh sách bằng builder (không tự đếm tay): chạy build candidate trên nhánh có code phase 03 với `zhEffects` rỗng; lỗi `non-SGSDeck zh effect without zhEffects` + danh sách pending + `newTactics` cho ra tập cần làm. Ghi tổng thực tế vào bảng (kỳ vọng 63).
2. Tạo `reports/nguon-chu-han.md`: cột `id | tên Việt | loại | nhóm (pending/newTactics/baseline) | kết quả (source/capture/translation) | ref/note | ghi chú đối chiếu cơ chế`.
3. Tra từng mục (三略庫 theo tên Hán-Việt suy ra, rồi Bahamut); ghi ghi chú đối chiếu. Có thể chia 2–3 agent theo nhóm (pending ACTIVE/BURST; pending INTERNAL/khác + baseline; `newTactics`) — mỗi agent chỉ ghi phần bảng của mình, không sửa `lookup-client-tactics.json`; một người hợp nhất.
4. Hợp nhất vào `zhEffects` trong **một commit** cùng bảng: bỏ `effectZh` khỏi 29 `newTactics`; tính `viSha256` bằng script dùng một lần (không commit), ví dụ trong WSL:
   ```bash
   python3 - <<'PY'
   import json,hashlib,sys
   c=json.load(open("pipeline/lookup-client-tactics.json"))
   # effectVi của chiến pháp có sẵn nằm ở c["tactics"][id]["effectVi"]; với newTactics lấy effectViet từ candidate
   t={r["id"]:r for r in json.load(open("pipeline/lookup-output/candidate/tactics.json"))}
   for i in sys.argv[1:] or []: print(i, hashlib.sha256(t[i]["effectViet"].encode()).hexdigest())
   PY
   ```
   (Kiểm định dạng `candidate/tactics.json` là list hay object trước khi chạy.)
5. Build + validate candidate: không lỗi stale, không lỗi baseline, 0 pending.
6. **Rà đủ mọi mục** bằng một reviewer độc lập (không phải người tra): mục `source` khớp cơ chế với trang `ref`; mục `translation` giữ đúng số liệu với `effectViet`; mục `capture` chỉ thuộc 16 TROOP; `text` không có HTML/ký tự ẩn. Ghi kết quả rà vào cột cuối bảng.

## Todo
- [ ] Danh sách từ builder (kỳ vọng 63)
- [ ] Bảng `nguon-chu-han.md`
- [ ] Tra 31 pending + 3 baseline
- [ ] Tra 29 `newTactics` (16 TROOP: source hoặc capture)
- [ ] Hợp nhất `zhEffects` + bỏ `effectZh` (một commit)
- [ ] Candidate build/validate xanh
- [ ] Rà đủ mọi mục

## Kiểm tra
- Candidate validate pass; 0 dòng `pending`.
- Số mục `zhEffects` = số dòng bảng = số dòng `effectZhSource != null` trong candidate.
- `grep -c '"kind": "capture"'` ≤ 16 và mọi id `capture` bắt đầu `tactic:tinh-` thuộc 16 TROOP.

## Rủi ro
- 三略庫/Bahamut mô tả bản TW khác patch Global → chỉ nhận `source` khi số liệu khớp.
- Trang nguồn chứa văn bản lạ (forum): builder chặn HTML/ký tự ẩn; reviewer rà đủ.
