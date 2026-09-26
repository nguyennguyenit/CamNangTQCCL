# Research MCP server

## Phạm vi

`mcp-worker/` cung cấp dịch vụ nghiên cứu TQCCL chỉ đọc qua JSON CLI, MCP stdio và MCP Streamable HTTP. Cả ba dùng chung tám tool:

- `tqccl_get_data_version`
- `tqccl_normalize_entities`
- `tqccl_search`
- `tqccl_get_team`
- `tqccl_match_team`
- `tqccl_recommend_team`
- `tqccl_recommend_coexist`
- `tqccl_suggest_replacements`

Dịch vụ không nhận ảnh, không crawl, không ghi dữ liệu game và không sở hữu GoClaw/Dewee hay skill của consumer. Tool error dùng mã/message/next-action cố định, không phản chiếu exception, input, path, credential hoặc upstream body.

Corpus công khai loại source `do-uy`. [Public snapshot view](../mcp-worker/src/data/public-snapshot-view.ts)
còn loại các cấu hình, evaluation, liên kết và bằng chứng chỉ thuộc phần bị ẩn
trước khi index/projector chạy, để snapshot cũ không tái công khai dữ liệu đó.
Bằng chứng dùng chung với record còn hiển thị được giữ; identity raw release
không đổi vì bước lọc public.

`releaseId` là SHA-256 đầy đủ của canonical manifest theo version. `dataVersion` rút gọn chỉ dùng hiển thị. `workflowVersion` ghép `releaseId` với `workflowBuildId`; binding hoặc cursor cũ bị từ chối khi một identity đổi.

## Consumer theo kịch bản

Gọi `tqccl_get_data_version` để đọc `manifestVersion`, capability và registry
đã review. Các tool còn lại nhận `seasonContext` tùy chọn, nhưng khi có phải là
cặp `scenarioId`/`rulesetId` đã review. Scenario-only là chế độ đọc của website;
MCP không bỏ scope thiếu/sai rồi chạy legacy. Snapshot v1 không hỗ trợ seasonal
request. Dữ liệu hiện chưa có cặp luật VN đã review; xem
[phạm vi dữ liệu](season-team-data.md).

Tám tên tool và input bắt buộc cũ giữ nguyên. Đây vẫn là migration output:
client dùng schema output v1 strict phải refresh tool discovery/schema trước
khi nhận output mới. Input không có context giữ nhánh legacy; không tự thêm
source-owned reference mới vào kết quả legacy.

Context tham gia confirmation và cursor cùng data/workflow identity. Đổi
scope hoặc canonical state cần normalize/review/xác nhận lại; không dùng
binding legacy cho request theo mùa. Search trả `configId` để mở đúng cấu hình.
Detail/replacement thiếu selector chỉ resolve khi có đúng một cấu hình hợp lệ;
khi chiến pháp trùng nhiều vị trí, caller phải chọn holder/slot hợp lệ.

- `CONFIG_AMBIGUOUS` trả tối đa 20 ID đã validate cùng tổng số và số bị lược;
  dùng search đúng context và cursor để tìm phần còn lại, rồi gửi `configId`.
- `CANDIDATE_LIMIT_EXCEEDED` trả giới hạn 500 và số cấu hình thực sau lọc
  scope/review/điều kiện/tier. Lỗi không retryable và không có portfolio một phần;
  giảm số đội output không giải quyết giới hạn đầu vào này.

Điểm SGSDeck giữ điểm gốc của đúng config/context/lựa chọn; không thay điểm
nội bộ của engine. Phương án thay thế không thừa hưởng điểm nguồn. Điều kiện
bắt buộc chưa được kho hỗ trợ vẫn chặn cấu hình có thể gợi ý, kể cả khi bật đội
chưa có tier. Schema và selector/error bounds thuộc
[research contracts](../mcp-worker/src/research/research-contracts.ts).

Cùng Tồn theo mùa phân biệt áp dụng đúng luật với tham khảo cùng kịch bản;
không trả legacy unknown hay kịch bản khác. Đây là nội dung untrusted, chưa
được engine chấm. [Projection](../mcp-worker/src/domain/season-reference-projection.ts)
giữ thứ tự slot, ID, nguồn và summary; giới hạn 50 nhóm, 10 đội/nhóm và 64 KiB
mỗi tool result. Bộ nguồn 5 nhóm/25 đội/75 vị trí đã có kiểm chứng projection
trong [bounds tests](../mcp-worker/test/research/season-bounds.test.ts), nhưng không
bảo đảm mọi response đều giữ đủ chi tiết: text/detail có thể rút với cờ
truncation, summary-only và omitted counts. Website vẫn là nơi đọc nguồn đầy đủ.

## Chạy local

Yêu cầu Node đúng `.node-version`:

```bash
cd mcp-worker
npm ci
npm run cli -- version
npm run cli -- search --input '{"query":"Lữ Mông","limit":2}'
npm run stdio
npm run test:coverage
```

CLI/stdio đọc filesystem qua `TQCCL_DATA_ROOT` tùy chọn. Nó phân biệt raw legacy,
raw project có đúng cặp `lookup-catalog.json` + `lookup-manifest.json`, và
packaged MCP root có `manifest.json` cùng exact inventory. Cặp lookup được kiểm
hash/generation nhưng không trở thành MCP artifact hay kind. Root partial/mixed,
transaction đang active hoặc bytes sai trả `DATA_UNAVAILABLE` đã redact. Stdout
của stdio dành riêng cho protocol; diagnostic cố định đi qua stderr.

Gate package và toàn repository:

```bash
cd mcp-worker
npm run check
npm run check:repository
```

`check:repository` từ chối release credential trong environment rồi chạy MCP, Astro, root JS, Python fallback, Vision Worker và Wrangler dry-run. Trong clean checkout, phải chạy `npm run build:worker-assets` trước gate vì dry-run cần thư mục asset đã tạo.

## HTTP và trust boundary

Worker chỉ phục vụ `/healthz` và `/mcp`; mọi URL asset public trả `404` dù có bearer. `/healthz` là liveness no-I/O. Readiness phải gọi `/mcp` đã xác thực:

```text
Authorization: Bearer <managed-secret>
MCP-Protocol-Version: 2025-11-25
```

Mỗi request tạo MCP server/transport mới. Module scope chỉ giữ snapshot/index immutable đã validate và limiter isolate-local. Origin, method, bearer, rate/in-flight, body, protocol và result size đều bị giới hạn. Bearer là pre-shared secret cho managed client, không phải OAuth.

Mã lỗi HTTP của Worker (body `{"error":{"code":"<CODE>"}}`, ngoài `/healthz`):

| HTTP | Code | Khi nào |
|---|---|---|
| `400` | `INVALID_CONTENT_LENGTH`, `INVALID_JSON`, `PROTOCOL_VERSION_NOT_SUPPORTED` | Header/body sai dạng hoặc `initialize` không dùng protocol `2025-11-25` |
| `401` | `UNAUTHORIZED` (+ `WWW-Authenticate: Bearer`) | Thiếu bearer hoặc bearer không khớp CURRENT/NEXT còn hiệu lực |
| `403` | `ORIGIN_NOT_ALLOWED` | Có `Origin` nhưng không nằm trong `TQCCL_MCP_ALLOWED_ORIGINS` (cùng quy ước với SDK transport) |
| `404` | `NOT_FOUND` | Route ngoài `/healthz`, `/mcp` |
| `405` | `METHOD_NOT_ALLOWED` | Method ngoài POST/GET/DELETE |
| `406`/`415` | `NOT_ACCEPTABLE`, `CONTENT_TYPE_NOT_ALLOWED`, `CONTENT_ENCODING_NOT_ALLOWED` | Header media sai |
| `413` | `BODY_TOO_LARGE` | Body vượt `TQCCL_MCP_MAX_BODY_BYTES` |
| `413` | `RESULT_TOO_LARGE` | Response vượt `TQCCL_MCP_MAX_RESULT_BYTES` |
| `429` | `RATE_LIMITED`, `TOO_MANY_IN_FLIGHT` | Vượt rate hoặc số request đồng thời theo fingerprint bearer |
| `500` | `INTERNAL_ERROR` | Lỗi bất ngờ khi xử lý MCP |
| `503` | `SERVICE_MISCONFIGURED` | Cấu hình sai: thiếu/yếu CURRENT, NEXT và `NEXT_TOKEN_NOT_AFTER` không đi cùng nhau, ngày không parse được, overlap quá 15 phút, limit/version metadata sai |

Observation và corpus là dữ liệu không tin cậy. Consumer phải normalize, cho người dùng rà soát canonical state, lưu `confirmationBinding`, rồi gửi đúng binding và `expectedWorkflowVersion` vào recommendation. MCP kiểm toàn vẹn binding nhưng không tự tuyên bố người dùng đã xác nhận.

## Worker Static Assets

Worker dùng một private Static Assets collection có binding `ASSETS`,
`run_worker_first: true`. Inventory chính xác thuộc
[artifact contracts](../mcp-worker/src/data/artifact-contracts.ts): manifest v1
có sáu JSON legacy cộng `manifest.json` (bảy file); v2 có thêm đủ năm sidecar
mùa, thành 11 JSON cộng manifest (12 file). Không chấp nhận bộ sidecar một phần.
V1 giữ nguyên thuật toán identity và fixture lịch sử. `build-worker-assets`
cho phép đúng hai lookup sidecar ở source root để xác minh dictionary generation,
nhưng loại cả hai khỏi output package. `StaticAssetsDataSource` chọn allowlist
từ manifest rồi validate bytes/hash/cross-reference trước khi cache snapshot
immutable; filesystem dùng cùng artifact validator.

Mỗi Worker version chứa cả code và data nên promotion/rollback là nguyên tử. Không cần storage release rời. Nhịp vận hành mặc định là một release theo mùa, khoảng ba tháng: curate data diff, review, build deterministic bundle, chạy full gate rồi phát hành exact Worker version. GoClaw URL, bearer và tám tool không đổi khi chỉ cập nhật dữ liệu mùa.

Build từ clean exact SHA:

```bash
cd mcp-worker
npm run --silent build:worker-assets > /secure/artifact/worker-release-evidence.json
npm run verify:worker-assets -- /secure/artifact/worker-release-evidence.json
npm run check:repository
```

Bundle chỉ hợp lệ khi evidence khớp commit, Git tree, `releaseId`, manifest digest, asset inventory digest và `workflowBuildId`. Builder từ chối source dirty, symlink, file thừa, bytes/schema sai và source identity thay đổi giữa hai lần đọc.

[Builder](../mcp-worker/scripts/build-worker-assets.ts) nhận diện riêng thư mục
private tùy chọn `data/sgsdeck/`: phải là thư mục thật, không phải symlink và
nằm trực tiếp trong data root. Builder loại nó khỏi inventory, không duyệt,
đọc hoặc copy nội dung con. Ngoại lệ này không nới kiểm sạch Git, không đưa
catalog private vào Worker assets/public routes và không cho phép thư mục lạ.
`SOURCE_NOT_CLEAN` yêu cầu xử lý checkout/release scope trước khi build; không
tạo asset giả hoặc bỏ guard để chạy dry-run.

## Production release

Workflow `.github/workflows/mcp-worker.yml` chỉ vào job production khi manual dispatch từ `main`, checkbox production được bật và `production_sha` là full SHA 40 ký tự khớp `HEAD`, `GITHUB_SHA` lẫn current `origin/main`. Repo giữ private; owner đã chấp thuận cơ chế manual exact-SHA thay cho required-reviewer environment không khả dụng ở GitHub plan hiện tại. Release dùng một concurrency group với `cancel-in-progress: false`. Credential không được đặt ở job level: repository gate không có secret, token chỉ-read chỉ ở edge-control step và deploy token chỉ được cấp cho preflight, upload, Custom Domain trigger và deployment controller. MCP bearer ở release step; riêng bootstrap đầu tiên còn cấp bearer cho upload step để đóng gói secret vào version chưa có secret kế thừa.

Cloudflare Create Deployment không có conditional/ETag precondition. Vì vậy deploy token phải dành riêng cho workflow và không được mutation từ dashboard, Wrangler hay token khác trong cửa sổ release. Controller re-read ngay trước mỗi POST, gắn run ID trong deployment message, reconcile response bị mất rồi read-back; observed drift luôn mở incident. Đây là serialization + ownership protocol vận hành, không phải CAS nguyên tử do Cloudflare cung cấp.

Zone `tqccl.com` dùng Cloudflare Free nên edge rule giới hạn `10` request mỗi `10` giây trên path `/mcp`, là chu kỳ được gói này hỗ trợ và đã được owner chấp thuận. Worker vẫn giữ limiter `60` request mỗi `60` giây; hai lớp có cùng tốc độ trung bình nhưng edge chặn burst sớm hơn. Release driver dùng một scheduler chung cho candidate, production và rollback verification, cách tối thiểu `1.100 ms` giữa mọi request `/mcp`; health probe ngoài path này không bị trì hoãn.

Thứ tự bắt buộc:

1. Checkout và assert exact `GITHUB_SHA` trên `main`.
2. Build/verify bundle, chạy full repository gate và Wrangler dry-run không credential.
3. Xác minh live edge rate control bằng token chỉ-read.
4. Preflight read-only yêu cầu bootstrap chưa có deployment hoặc normal có đúng một prior `100%`; controller vẫn read-back exact deployment trước khi xác minh hoặc mutation tiếp theo.
5. Bootstrap tạo Worker/version đầu bằng `wrangler deploy`; normal release upload immutable version bằng `wrangler versions upload`. Cả hai đọc candidate UUID từ Wrangler NDJSON evidence, bảo đảm Custom Domain bằng `wrangler triggers deploy` và chờ `/healthz` sẵn sàng tối đa 120 giây trước controller.
6. Tạo temporary deployment prior `100%` + candidate `0%`.
7. Gọi production `/mcp` bằng Cloudflare Version Override và bearer; header runtime `TQCCL-MCP-Worker-Version` phải đúng candidate, đồng thời `releaseId`, `workflowBuildId`, catalog và tám tool đều phải đạt.
8. Re-read đúng deployment do run sở hữu, promote candidate thành version duy nhất `100%`, rồi verify production không override.
9. Khi `rehearse_rollback: true`, capture prior code/data identity trước mutation, rollback exact prior, xác minh lại version/release/workflow/data digest, re-promote candidate và chạy lại full production verifier. Mọi bước đều dùng expected-current ownership guard.

### Bootstrap deployment đầu tiên

Normal release bắt buộc có một prior version duy nhất ở `100%`. Khi live inventory chứng minh Worker chưa có deployment, người vận hành phải chọn manual input `bootstrap_first_release: true` trong exact-SHA dispatch đã xác nhận. Nhánh này fail closed nếu API quan sát thấy bất kỳ deployment hiện tại nào; không được dùng nó để thay normal promotion.

Workflow tạo file dotenv tạm với mode theo `umask 077`, truyền file đó cho `wrangler deploy --secrets-file`, rồi xóa bằng `trap` và không đưa file vào artifact. `wrangler.jsonc` khai báo bearer current là secret bắt buộc nên bootstrap dừng trước mutation khi secret không đáp ứng; normal upload kế thừa secret của Worker đang hoạt động. `wrangler deploy` tạo version/deployment đầu ở `100%`; controller chỉ read-back đúng candidate duy nhất rồi xác minh endpoint bằng bearer, không tạo deployment lần hai. Đây là ngoại lệ one-time: chưa có prior nên verification fail sẽ mở incident và phải tắt route/khắc phục trực tiếp, không thể tự rollback.

Sau bootstrap xanh, chạy lại workflow với `bootstrap_first_release: false` và `rehearse_rollback: true` để tạo version thứ hai, thực hiện normal prior `100%` + candidate `0%` Version Override, promotion, rollback rehearsal và re-promotion. Hai input không được cùng `true`. Chỉ khi vòng thứ hai đạt mới xem first-release gate hoàn tất.

Driver dùng trong workflow:

```bash
cd mcp-worker
npm run release:worker -- \
  <candidate-worker-version-uuid> \
  /secure/artifact/worker-release-evidence.json \
  test/fixtures/release-verification.json
```

Driver lấy `CLOUDFLARE_ACCOUNT_ID`, `TQCCL_WORKER_NAME`, `TQCCL_MCP_ENDPOINT` từ repository variables; deploy token và bearer từ repository secrets. Workflow cấp thêm `TQCCL_RELEASE_RUN_ID`, `TQCCL_FIRST_RELEASE_BOOTSTRAP`, `TQCCL_REHEARSE_ROLLBACK` và `TQCCL_DEPLOYMENT_EVIDENCE_PATH` không bí mật. Không đặt secret trong argv, query, repo hoặc artifact.

## Verification và control plane

Verifier độc lập có thể chạy với exact identities:

```bash
TQCCL_MCP_BEARER_CURRENT='<managed value>' \
npm run verify:release -- \
  --endpoint https://mcp.tqccl.com/mcp \
  --release-id sha256:<64-hex> \
  --workflow-build-id build:sha256b64:<43-base64url> \
  --worker-version-id <worker-version-uuid> \
  --fixture test/fixtures/release-verification.json
```

Verifier kiểm liveness, auth thiếu/sai, protocol, exact version header, catalog/schema/annotation, pagination, injection non-echo, provenance, binding và đủ tám tool. Control-plane artifact chỉ còn edge rate rule:

```bash
npm run verify:control-plane
CLOUDFLARE_ZONE_ID='<zone>' CLOUDFLARE_API_TOKEN='<read-token>' \
  node --import tsx scripts/verify-control-plane.ts --live
```

Workflow `MCP edge security monitor` chạy lịch và manual. Drift chặn release; bearer vẫn giữ nguyên.

## Rotation, incident và rollback

Bearer rotation vẫn theo current → overlap có hạn → promote/retire. Rollback code/data không phục hồi bearer cũ. Sau `TQCCL_MCP_NEXT_TOKEN_NOT_AFTER`, token NEXT tự hết hiệu lực (trả `401` như token lạ) và dịch vụ vẫn chạy bằng CURRENT; vận hành vẫn phải promote hoặc xoá biến NEXT/NOT_AFTER khỏi môi trường. Cấu hình sai khác vẫn `503 SERVICE_MISCONFIGURED`.

Deployment controller dùng exact-current ownership guard:

- candidate smoke fail: chỉ phục hồi prior exclusive nếu current vẫn đúng temporary deployment của run;
- pre-promote drift: dừng và mở incident, không mutation;
- production verify fail: chỉ rollback prior nếu current vẫn đúng candidate deployment vừa promote;
- rollback rehearsal: xác minh exact prior code/data identity, rồi re-promote và verify candidate; nếu re-promote fail thì prior đã xác minh được phục hồi;
- stale rollback hoặc concurrent release: dừng và mở incident, không overwrite release khác.

Rollback known-good Worker version phục hồi đồng thời code và data. Auth/rate/control-plane drift có thể yêu cầu tắt route MCP; `DATA_UNAVAILABLE` vẫn để `/healthz` sống nhưng authenticated readiness fail closed. Mọi production mutation, bearer rotation và external-resource retirement cần authorization riêng. Không ghi version/ngày production vào [Deployment Record](deployment.md) nếu chưa có live evidence.

## Tài liệu liên quan

- [Kiến trúc hệ thống](system-architecture.md)
- [Deployment Guide](deployment-guide.md)
- [GoClaw consumer handoff](goclaw-mcp-skill-handoff.md)
- [Chuẩn code](code-standards.md)
