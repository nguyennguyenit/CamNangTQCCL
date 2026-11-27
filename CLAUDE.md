@AGENTS.md

## Khi chạy bằng Claude Code (Claude Desktop tab Code, CLI, cloud)

Phần này dành cho Claude Code; omp đọc AGENTS.md.

- Fable/Astra là agent của omp, ở đây không có. Chỗ nào AGENTS.md cần Fable/Astra: báo anh chạy review đó
  bằng omp, kèm đường dẫn diff/plan. Không áp dụng rule trong `~/.omp/`. Agent khác (kongming,
  code-reviewer…) vẫn dùng theo skill/rule của Claude Code, nhưng không bao giờ báo kết quả là Fable/Astra.
- Orca: không có biến `ORCA_TERMINAL_HANDLE` thì bỏ qua mọi chỉ dẫn `orca …`, không chạy lệnh `orca`.
- Dọn worktree: khi PR của session đã MERGED (`gh pr view --json state`), nhắc anh Archive session trong app
  (app tự dọn worktree). Không tự `git worktree remove`, không xoá branch, không đụng worktree ngoài session này.
