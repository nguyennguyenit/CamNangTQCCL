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
