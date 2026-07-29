# Research MCP server

## Phạm vi

`mcp-worker/` cung cấp dịch vụ nghiên cứu TQCCL chỉ đọc qua ba bề mặt: JSON CLI, MCP stdio và MCP Streamable HTTP. Cả ba dùng chung tám schema và handler; dịch vụ không nhận ảnh, không crawl, không ghi dữ liệu game và không sở hữu GoClaw/Dewee hay skill của consumer.

Tám tool public:

- `tqccl_get_data_version`
- `tqccl_normalize_entities`
- `tqccl_search`
- `tqccl_get_team`
- `tqccl_match_team`
- `tqccl_recommend_team`
- `tqccl_recommend_coexist`
- `tqccl_suggest_replacements`

`releaseId` là SHA-256 đầy đủ của canonical manifest sáu artifact. `dataVersion` rút gọn chỉ dùng hiển thị. `workflowVersion` ghép `releaseId` với `workflowBuildId`; binding hoặc cursor cũ phải bị từ chối khi một trong hai identity đổi.

## Chạy local

Yêu cầu Node đúng `.node-version`:

```bash
cd mcp-worker
npm ci
npm run cli -- version
npm run cli -- search --input '{"query":"Lữ Mông","limit":2}'
npm run stdio
```

Đặt `TQCCL_DATA_ROOT` khi cần dùng snapshot filesystem khác. Stdout của stdio dành riêng cho protocol; diagnostic cố định đi qua stderr.

Gate package và toàn repository:

```bash
cd mcp-worker
npm run check
npm run check:repository
```

`check` không gọi mạng live hay deploy. `check:repository` từ chối release credential trong environment, rồi chạy MCP, Astro build/dist/E2E, root JS, Python fallback, Vision Worker và Wrangler dry-run.

## HTTP và trust boundary

Worker phục vụ `/healthz` và `/mcp`. `/healthz` là liveness no-I/O; readiness phải gọi MCP đã xác thực. `/mcp` dùng managed pre-shared bearer trong header `Authorization`, không phải OAuth:

```text
Authorization: Bearer <managed-secret>
MCP-Protocol-Version: 2025-11-25
```

Client generic chỉ dùng được khi có thể cấu hình header riêng. Mọi request tạo MCP server/transport mới; module scope chỉ giữ snapshot/index đã validate và limiter isolate-local. Origin, method, bearer, rate/in-flight, body, protocol và result size đều được kiểm tra trước hoặc quanh handler.

Observation/corpus là dữ liệu không tin cậy. Consumer phải gọi normalize, trình canonical state cho người dùng rà soát, lưu `confirmationBinding`, rồi gửi đúng binding và `expectedWorkflowVersion` vào recommendation. MCP xác minh tính toàn vẹn của binding nhưng không tuyên bố đã quan sát hành động xác nhận của con người.

## Data release

Production dùng hai bucket R2 Standard:

- release bucket: object content-addressed dưới `releases/<full-digest>/`, được bucket lock bảo vệ;
- pointer bucket: chỉ chứa mutable `current.json`, đổi bằng ETag compare-and-swap.

Build release local không cần credential:

```bash
cd mcp-worker
TQCCL_RELEASE_OUTPUT=/tmp/tqccl-release \
  npm run build:data-release > /tmp/tqccl-release-build.json
```

Builder yêu cầu Git tree sạch, đọc đúng sáu artifact, validate manifest/snapshot và chỉ tái sử dụng object local khi bytes giống hệt. Stage dùng conditional create, đọc lại để so bytes và không được ghi pointer. Activate chỉ nhận promotion receipt chưa hết hạn, đã bind release/manifest/source/Worker/prior pointer/evidence/approval; adapter Deployment API kiểm deployment hiện tại và yêu cầu đúng một Worker version nhận 100% traffic trước pointer CAS. Response deploy mơ hồ hoặc pointer CAS conflict đều dừng automation và mở incident; activator không tự ghi đè Worker deployment vì API không có conditional deployment ownership. Candidate đã phải tương thích với cả manifest hiện tại lẫn candidate trước bước này.

Activator API bắt buộc nhận một distributed activation lock dùng chung cho mọi holder của deployment credential; lock bao trùm từ kiểm pointer/deployment đến deploy, pointer CAS và live verification. Adapter dùng `control/activation-lock.json` trong pointer bucket: acquire/release đều là conditional `PutObject` theo ETag, không delete và không tự hết hạn. Holder thứ hai bị chặn; process chết để lock ở `held` nhằm fail closed. Production driver phải cấp UUID `holderId` rõ ràng và ghi nó cùng approval/release evidence để điều tra hoặc break-lock; adapter không sinh holder ẩn.

Break-lock là incident procedure có ủy quyền riêng: đọc lock/pointer/deployment hiện tại, xác nhận không còn activator chạy, đối chiếu holder và release evidence, sau đó ETag-CAS record sang `released`. Không xóa hoặc overwrite mù. Adapter local đã có test tranh chấp/CAS nhưng cấu hình credential, monitor lock lâu và rehearsal live vẫn là release gate mở.

Nếu activation và release-lock cùng lỗi, lỗi ngoài cùng là `LEASE_RELEASE_FAILED` và lỗi activation gốc nằm trong `cause`; incident logger phải lưu cả chuỗi lỗi đã redaction.

Thứ tự release bắt buộc:

1. Chạy credential-free repository gate và tạo immutable artifact.
2. Xác minh bucket lock, edge rate limit, event notification và alert path bằng credential chỉ đọc.
3. Dùng credential release-bucket riêng để conditional-stage object rồi xác minh hash.
4. Upload đúng một candidate Worker version không nhận traffic; kiểm current và candidate manifest.
5. Tạo promotion receipt content-addressed, validity tối đa 15 phút.
6. Sau phê duyệt, deploy đúng candidate version ở 100%, rồi dùng credential pointer-bucket riêng để CAS `current.json`.
7. Force-refresh live verifier. Nếu lỗi, CAS-restore pointer cũ; nếu restore xung đột, dừng automation và mở incident.

Không mô tả R2 binding là IAM read-only: platform binding có thể ghi. Reader interface, import guard, bucket separation, lock và monitor là các lớp cưỡng chế bổ sung.

Sau repository gate credential-free và khi có ủy quyền stage, driver executable nhận chỉ path/evidence không bí mật trên argv; toàn bộ credential đến từ managed environment:

```bash
cd mcp-worker
npm run stage:data-release -- \
  --metadata /tmp/tqccl-release-build.json \
  --release-directory /tmp/tqccl-release/releases/<full-digest> \
  --environment staging
```

Driver yêu cầu `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`, tên hai bucket, release-bucket S3 credential riêng và `CLOUDFLARE_CONTROL_PLANE_READ_TOKEN`. `--environment` bind bucket cố định: staging dùng `tqccl-release-objects-staging`/`tqccl-release-pointer-staging`, production dùng hai bucket không hậu tố. Driver kiểm clean Git tree trùng `sourceTree`, tái tạo canonical manifest trực tiếp từ `data/` để khớp release/manifest evidence, rồi chạy live control-plane preflight, conditional-create đúng bảy object và đọc lại bytes.

Stage từ chối mọi pointer/deploy/generic Cloudflare/AWS credential nếu chúng hiện diện. Các lệnh Git con chỉ nhận `PATH`/`LANG`, không kế thừa release credential. Driver không tạo `S3PointerStore` và không thể activate `current.json`.

Sau candidate verification và khi immutable receipt/expectation đã được approval environment pin bằng `TQCCL_APPROVED_RECEIPT_ID`, activator executable chạy:

```bash
cd mcp-worker
npm run activate:data-release -- \
  --receipt /secure/artifact/promotion-receipt.json \
  --expectation /secure/artifact/promotion-expectation.json \
  --fixture /secure/artifact/release-verifier-fixture.json \
  --endpoint https://mcp.example.com/mcp \
  --environment staging
```

Activator từ chối release-bucket và generic AWS/Cloudflare credential. Nó chỉ nhận pointer-bucket credential, Worker deploy token, control-plane read token và managed MCP bearer qua environment; environment bind cùng bucket map với stage. `TQCCL_ACTIVATION_HOLDER_ID` là UUID correlation. `TQCCL_APPROVED_MCP_ENDPOINT` phải là URL HTTPS `/mcp` sạch và khớp byte-for-byte với `--endpoint`; userinfo, query, fragment hoặc host khác đều bị chặn trước khi bearer được dùng. Driver xác minh receipt content address + approved ID + environment, lấy distributed lock, kiểm control plane, deploy đúng candidate duy nhất 100%, pointer CAS và force-refresh live verifier. Sau các MCP call, driver đọc lại Cloudflare deployment và chỉ chấp nhận đúng candidate duy nhất ở 100%. Mọi lỗi được redaction thành thông báo cố định; pointer rollback vẫn dùng ETag CAS.

## Live verification

Bearer chỉ đến từ environment, không đặt trong argv/query/file repo:

```bash
cd mcp-worker
TQCCL_MCP_BEARER_CURRENT='<managed value>' \
npm run verify:release -- \
  --endpoint https://mcp.example.com/mcp \
  --release-id sha256:<64-hex> \
  --workflow-build-id build:sha256:<64-hex> \
  --fixture /secure/path/release-verifier-fixture.json
```

Fixture chứa `observations`, `teamId`, `tacticName`, không chứa credential. Verifier kiểm health, auth thiếu/sai, negotiated/subsequent protocol header, authenticated GET/DELETE, catalog gồm description/input-output schema/annotation chính xác, pagination/truncation, injection non-echo, tám tool, provenance và binding bị sửa. Khi activator gọi verifier với force-refresh, request đã xác thực mang header nội bộ `TQCCL-MCP-Force-Refresh: 1`; Worker bỏ cache snapshot cho từng tool call, nhưng vẫn áp dụng rate/in-flight limits. Header chỉ được xử lý sau bearer auth và mọi giá trị khác `1` bị từ chối. Output/error không phản chiếu bearer hoặc upstream body.

Control-plane artifact có thể kiểm offline:

```bash
npm run verify:control-plane
```

`--live` chỉ dùng credential Cloudflare chỉ đọc qua environment. Workflow `MCP R2 control-plane monitor` chạy lịch hằng ngày và manual; trạng thái drift phải chặn activate.

## Rotation, incident và rollback

Bearer rotation theo ba trạng thái:

1. `current`: chỉ token hiện tại hợp lệ.
2. overlap có hạn: `current` và `next` hợp lệ đến `TQCCL_MCP_NEXT_TOKEN_NOT_AFTER`, tối đa 15 phút.
3. promote/retire: next thành current, token cũ bị xóa và không được phục hồi khi rollback code.

Không lưu bearer trong argv, query, GitHub artifact, log hoặc deployment record. `mcp-worker/.release-secrets/` và `*.release-secret` chỉ dành cho ngoại lệ cục bộ ngắn hạn; release gate từ chối nếu các file này chưa được dọn.

Khi có sự cố:

- auth/rate/control-plane drift: tắt route MCP hoặc disable production HTTP, giữ pointer;
- data lỗi: CAS về pointer known-good; không overwrite khi ETag đã đổi;
- code lỗi: rollback code/version cũ nhưng giữ secrets, bindings, Origin và limits hiện hành;
- release object nghi bị sửa: ngừng activate, giữ lock/evidence và điều tra event log;
- `DATA_UNAVAILABLE`: `/healthz` có thể vẫn sống, nhưng readiness phải fail closed sau stale deadline.

Rollback full configuration, thay lock policy, xoay credential, deploy Worker và đổi pointer production đều là thao tác có ủy quyền riêng. Không ghi ID/version/ngày vào [Deployment Record](deployment.md) trước khi live verification có bằng chứng.

## Tài liệu liên quan

- [Kiến trúc hệ thống](system-architecture.md)
- [Deployment Guide](deployment-guide.md)
- [GoClaw consumer handoff](goclaw-mcp-skill-handoff.md)
- [Chuẩn code](code-standards.md)
