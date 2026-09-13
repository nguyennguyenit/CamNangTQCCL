# Phase 2 checkpoint — package frozen, candidate quota-blocked

- Thời điểm: 2026-09-14 00:20 Asia/Ho_Chi_Minh
- Phạm vi: Phase 2 `tqccl-research`; chưa mở Phase 3
- Trạng thái: package đã đóng băng để replay; behavioral Green chưa đạt

## Package

Đã tạo đúng bốn file được chấp thuận:

1. `.agents/skills/tqccl-research/SKILL.md` — 184 dòng
2. `.agents/skills/tqccl-research/agents/openai.yaml` — 5 dòng
3. `.agents/skills/tqccl-research/references/evidence-and-region-rules.md` — 148 dòng
4. `.agents/skills/tqccl-research/references/report-template.md` — 147 dòng

Instruction hash theo đúng phép ghép của `run-replay.mjs`:
`fc116aadff4a336fb85418ba4bd4475563fbdac3c519f83e954533a28bd7883d`.

Structural validation đạt: inventory đúng bốn file; frontmatter và `openai.yaml`
parse được bằng Node `yaml`; description 169 ký tự; default prompt gọi
`$tqccl-research`; mọi link/anchor resolve; không hardcode `/Users/`; không nhập
thang Evidence Grading cũ; `git diff --check` sạch. Harness regression đạt 18/18.

Reviewer sớm không tìm thấy High/Critical. Hai góp ý đã áp dụng: prompt giao diện
không giả định đã có mùa/server, và report là bắt buộc khi kết luận/đính chính/
provenance/handoff tạo tri thức bền vững. Kongming phát hiện thêm một câu routing
mâu thuẫn với rule persistence; câu đó đã sửa. Sau sửa, Kongming quyết định đóng
băng package và replay lại dưới instruction hash mới.

## Candidate attempts

Capture case03 trước review đạt `OBSERVED` và sửa đúng lỗi packet-time, nhưng không
được dùng cho candidate cuối vì instruction hash đã thay đổi. Capture được giữ
nguyên tại `candidate-v2-attempt-00-pre-review/03.json`, SHA-256
`e8a95885108a66a134c90b1f2d8629922eb46c8a8f1a85e0519d1caa46ae1b6c`.

Lượt đầu sau đó của case10 bị chặn trước dispatcher, trace và transcript đều rỗng:

- status: `ENVIRONMENT_BLOCKED`
- lỗi: `You've hit your session limit · resets 4am (Asia/Saigon)`
- archive: `candidate-v2-attempt-01-quota/10.json`
- SHA-256: `ed06ad1b9db79f1df3747cc7b6970c9b6461a2642c170489c607256bd1a5229d`

Active `candidate-v2/` hiện không có capture. Không case nào khác được chạy sau
quota failure; không có runner còn hoạt động.

## Resume gate

Từ 04:00 ngày 2026-09-14 Asia/Ho_Chi_Minh, retry đúng case10 một lần trước:

```bash
node plans/260907-2333-project-research-skill/reports/harness/run-replay.mjs candidate-v2 10
```

Chỉ tiếp tục ma trận khi case10 đạt capture gate và được kiểm tra answer/trace.
Nếu quota vẫn chặn, archive nguyên capture mới rồi dừng; thời gian reset do CLI
báo không bảo đảm quota đã khả dụng. Mọi capture cuối phải có instruction hash
`fc116aadff4a336fb85418ba4bd4475563fbdac3c519f83e954533a28bd7883d`.

Phase 2 vẫn pending cho đến khi replay, grading và persistence case15 hoàn tất.
Phase 3, coexist handoff, runtime/data, Git và deploy vẫn ngoài checkpoint này.
