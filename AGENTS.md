# Quy trình làm việc với repo CamNangTQCCL

Fable & Astra: theo rule global `fable-astra-routing` (`~/.omp/agent/rules/fable-astra-routing.md`).
Không lặp lại ở đây.

## Trước khi code

Agent tự đề xuất 3 điểm, anh chốt:

- Có cần plan không. Việc nhiều phase hoặc đụng schema/worker/pipeline thì dùng `/ak:plan --hard --tdd`.
- Cook bằng flag nào. Mặc định `/ak:cook <plan> --tdd`; thêm `--auto` khi plan đã qua audit.
- Có tạo branch/worktree mới không. Mặc định mỗi đợt một branch từ `main`, mở PR; không push thẳng vào `main`.

## Xếp loại thay đổi để đề xuất review

Thay đổi rủi ro cao, nên đề xuất Astra → Fable: schema D1/migration (`community-worker/migrations`),
ledger/identity-map trong `pipeline/`, `mcp-worker`/`community-worker`/`worker`, deploy production,
dữ liệu đã publish (generation). Số file của PR không phải tiêu chí: phần lớn là file sinh lại.

## Việc chưa làm

Việc ngoài phạm vi hoặc "chưa làm có lý do" thì tạo GitHub issue, không để trôi.

## Dọn session và worktree

Agent chỉ đề xuất, anh đồng ý mới đóng/xoá. Chỉ trong repo này; không đụng repo khác.

- Xong việc của session nào (terminal/agent Orca) thì đề xuất đóng session đó.
- Cuối phiên: liệt kê session còn mở của repo rồi đề xuất tắt từng cái. Không đóng terminal
  đang chạy chính mình, agent còn dở việc, hay tab mặc định chưa chắc là shell trống.
  Session cần resume sau thì đề xuất anh Sleep workspace trong app thay vì close.
- Xong worktree nào (PR đã merge hoặc bỏ) thì đề xuất dọn worktree đó. Không dùng `--force`
  khi còn thay đổi chưa commit; thêm `--delete-branch` khi branch đã merge.

```bash
orca worktree list --repo name:CamNangTQCCL --json          # worktree của repo, lấy `id`
orca terminal list --worktree "id:<repoId>::<path>" --json  # session còn mở, lấy `handle`
orca terminal close --terminal <handle> --json
orca worktree rm --worktree "id:<repoId>::<path>" --json
```
