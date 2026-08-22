# Debug: 5 trace dewee — bug do MCP hay do dewee?

Ngày: 2026-08-22 | Nguồn: dewee gateway localhost:18790, agent `tra` (019d0784…), session `agent:tra:tele-tra:direct:1288910601`

## Trace map

| # | Trace ID | Giờ | Nội dung | Kết quả tool |
|---|---|---|---|---|
| 1 | 01a02884-aba6-7f1b-8d0f-15a5d50fc65d | 15:09 | "Hoàng Quan Thương" | 3× `tqccl_search` OK |
| 2 | 01a02886-8ba0-77d7-bcfb-662f32940d23 | 15:11 | ảnh Độ Giang Thương | 2× search OK, 2× `tqccl_get_team` **error** |
| 3 | 01a02888-dc9d-7680-9c53-591c98e15850 | 15:14 | ảnh Vũ Thái Bị | 1× search OK, 1× `get_team` **error** |
| 4 | 01a0288b-81ce-7b1b-bd41-0c1197fb09c9 | 15:17 | "tại sao không tìm được?" | không gọi tool |
| 5 | 01a0288c-fef2-76b6-855a-a39ca7c4d300 | 15:18 | "lỗi do em hay MCP?" | không gọi tool |

## Bug 1 — "không tìm được tên team": lỗi agent, không phải MCP

MCP trả **đúng** ngay lần đầu:

- t1 `search("Hoàng Quan Thương")` → `team:team-intro-2` / displayName `Vũ Tung Úc`
- t2 `search("Độ Giang")` → `team:team-intro-3` / displayName `Vũ Tung Mông`

Đối chiếu `data/teams.json`: `Vũ Tung Úc` có `nickname = "Hoàng Quan Thương"`, `Vũ Tung Mông` có `nickname = "Độ Giang Thương"`. `snapshot-index.ts:118` index cả `nickname` → match là chính xác.

Agent thấy `displayName` khác chuỗi user hỏi → bỏ kết quả đúng, search tiếp ("Hoàng", "Quan Vũ", "Thương"), chọn nhầm `team-intro-52 Quan Quân Thương`, rồi kết luận "database không có team này" (t4/t5). Sai.

**Góp phần từ MCP (contract gap):** item của `tqccl_search` chỉ có `{artifact, canonicalId, displayName, kind, recordId, trust}` — không có trường nào cho biết **match qua term nào** (nickname/alias/source). Agent không có bằng chứng để nhận ra hit là đúng.

## Bug 2 — `tqccl_get_team` luôn WORKFLOW_VERSION_CHANGED: lỗi dewee

Chuỗi thực tế (t2): search OK → get_team error → `get_data_version` OK → get_team error lại (cùng lỗi). Không retry nào cứu được.

Input agent gửi:
```
{"expectedWorkflowVersion":"workflow:sha256:[REDACTED]:build:sha256:[REDACTED]","teamId":"team:team-intro-52"}
```

Root cause: `dewee-src/internal/tools/scrub.go:36`
```go
// Long hex strings (64+ chars) — likely encryption keys, hashes, or secrets
regexp.MustCompile(`[a-fA-F0-9]{64,}`)
```
áp dụng tại `internal/tools/registry.go:242-248` — `result.ForLLM = ScrubCredentials(result.ForLLM)`, tức **scrub output tool TRƯỚC KHI đưa cho LLM** (scrubbing mặc định `true`, registry.go:45).

sha256 hex = đúng 64 ký tự → bị thay bằng `[REDACTED]`. LLM không bao giờ nhìn thấy workflowVersion thật, echo lại chuỗi đã bị redact → `research-handlers.ts:227 ensureExpectedWorkflow` so sánh không khớp → `WORKFLOW_VERSION_CHANGED`. Deadlock vĩnh viễn.

**Không phải trace redaction:** `internal/http/trace_redaction.go` dùng placeholder chữ thường `[redacted]` và không có pattern hex 64; chuỗi trong trace là `[REDACTED]` chữ hoa = placeholder của `tools/scrub.go`. Bằng chứng phụ: `dataVersion":"data:01cc8091c844"` (12 hex) **không** bị redact — đúng ngưỡng 64.

**Không có đường vòng:** `teamInputSchema` (research-contracts.ts:556) kế thừa `requiredWorkflowSchema` → `expectedWorkflowVersion` **bắt buộc**. Zod chỉ check `startsWith("workflow:")` nên chuỗi redact lọt schema rồi chết ở equality check.

Phạm vi ảnh hưởng: mọi tool dùng `requiredWorkflowSchema` — `get_team`, `match_team`, `recommend_team`, `recommend_coexist`, `suggest_replacements`. Qua dewee đều hỏng 100%.

## Phân định

| Triệu chứng | Chủ thể lỗi |
|---|---|
| Không tìm ra team theo nickname | Agent (chính) + MCP thiếu trường matched-term (phụ) |
| get_team luôn WORKFLOW_VERSION_CHANGED | **dewee** (scrub 64-hex trên đường ForLLM) |

Agent tự chẩn đoán ở t5 gần đúng phần 2 (đổ cho "hệ thống redact hash"), nhưng sai phần 1 khi khẳng định data không có team.

## Fix đề xuất

1. **MCP-side (khuyến nghị, ta kiểm soát được)** — đổi `workflowVersion`/`releaseId` sang digest ngắn như `dataVersion` đang dùng (12 hex) hoặc base36/base64url. Giữ nguyên tác dụng chặn stale, miễn nhiễm với mọi client scrub hex. File: `mcp-worker/src/domain/canonical-state.ts` (`createWorkflowVersion`, hàm sinh releaseId).
2. **MCP-side** — thêm `matchedTerm` (+ `nickname`) vào item của `tqccl_search` để agent xác nhận được hit qua alias.
3. **dewee-side** — thu hẹp regex hex: bỏ qua khi có tiền tố `sha256:`/`sha1:`/`sha512:`/`digest:`, hoặc thêm allowlist. Sửa `internal/tools/scrub.go`.

## Unresolved

- Fix ở MCP hay chờ patch dewee? (đề xuất #1 vì không phụ thuộc bên ngoài)
- Có cần sửa prompt agent `tra` để bám kết quả search đầu tiên thay vì search lặp rồi tự kết luận "không có"?

---

# Phần 2 — Validation (chạy 2026-08-22 19:31)

## V1. Tái hiện scrub của dewee (white-box, đã chạy)

Probe test tạm trong `dewee-src/internal/tools` gọi thẳng `ScrubCredentials` (đã xoá sau khi chạy):

```
IN : {"workflowVersion":"workflow:sha256:3b1f...5c6d:build:sha256:3b1f...5c6d","dataVersion":"data:01cc8091c844"}
OUT: {"workflowVersion":"workflow:sha256:[REDACTED]:build:sha256:[REDACTED]","dataVersion":"data:01cc8091c844"}
```

Trùng **byte-for-byte** với `input_preview` trong trace t2/t3. `dataVersion` (12 hex) sống sót → xác nhận ngưỡng 64.

Probe các format ứng viên:

| Format | Kết quả |
|---|---|
| hex 64 | SCRUBBED |
| hex 63 | CLEAN |
| hex 32 / 16 / 12 | CLEAN |
| base64url 43 | CLEAN |
| base32 26 | CLEAN |

## V2. MCP là vô can (black-box, đã chạy)

Qua `npm run cli` với `--data-root ../data`, không dính dewee:

```
REAL WV = workflow:sha256:01cc8091c844...453d:build:sha256:f2161b8a...cd15
team + WV thật     -> OK team=Vũ Tung Úc nickname=Hoàng Quan Thương
team + WV redact   -> {"error":{"code":"WORKFLOW_VERSION_CHANGED","retryable":true}}
search "Hoàng Quan Thương" -> team:team-intro-2  Vũ Tung Úc
search "Độ Giang Thương"   -> team:team-intro-3  Vũ Tung Mông
```

Khép kín: MCP đúng ở cả 2 mặt; chỉ hỏng khi input đã bị redact. Ghi chú: `dataVersion` chính là 12 hex đầu của `releaseId` (`artifact-contracts.ts:315`).

## V3. Phản chứng cho fix #1 — phạm vi rộng hơn dự tính

Grep usage cho thấy **fix #1 bản gốc là SAI**:

- `releaseId` là digest toàn vẹn thật: `artifact-contracts.ts:308` tính sha256, `:471` so khớp manifest, `release/worker-release-evidence.ts:131` ép `SHA256_PATTERN`. Cắt ngắn `releaseId` sẽ phá verify release + worker assets.
- Không chỉ `workflowVersion` bị chặn. Mọi input client phải echo lại 64-hex đều chết qua dewee:
  - `confirmationBindingSchema.workflowVersion` + `.normalizationDigest` (research-contracts.ts:112-119, qua `recommendationInputSchema`) → hỏng `recommend_team`, `recommend_coexist`, `suggest_replacements`
  - `requiredWorkflowSchema` → hỏng `get_team`, `match_team`

**Đính chính (2026-08-22 21:0x, phát hiện khi red-team plan B):** dòng `sha256` ở `research-contracts.ts:462` nằm trong `versionOutputSchema` (OUTPUT của get_data_version), KHÔNG phải `replacementInputSchema`. Artifact `sha256` và `releaseId` là output-only — bị redact nhưng không tool nào bắt echo lại nên không gây lỗi. Kết luận và hướng sửa không đổi: vẫn đúng 5 tool hỏng, vẫn cùng root cause.

→ Sửa mỗi `createWorkflowVersion` **không đủ**.

## Hướng sửa sau validation

**Fix chính — dewee (1 dòng regex, chữa hết mọi tool):** `internal/tools/scrub.go:36` thu hẹp `[a-fA-F0-9]{64,}` để bỏ qua hex có tiền tố hash (`sha256:`, `sha1:`, `sha512:`, `digest:`). Digest của dữ liệu công khai không phải credential; pattern vẫn bắt key/hash trần. Repo `nextlevelbuilder/dewee` — ta có quyền push.

**Fix phụ — MCP (hardening, không phụ thuộc client):** đổi encoding các token client-echo sang base32/base64url (giữ nguyên 256-bit entropy, không mất tính bảo mật), **giữ nguyên `releaseId` sha256 đầy đủ** cho integrity. Chỉ làm nếu muốn miễn nhiễm với mọi client có scrub.

**Fix độc lập — MCP:** thêm `matchedTerm` vào item `tqccl_search`.

## Acceptance test sau khi sửa

1. dewee: unit test trong `internal/tools` — `ScrubCredentials("workflow:sha256:<64hex>:build:sha256:<64hex>")` giữ nguyên; `ScrubCredentials("<64hex trần>")` vẫn `[REDACTED]`; `sk-...`, `ghp_...`, DSN vẫn bị scrub (chống regression bảo mật).
2. mcp-worker: `npm run test:coverage && npm run typecheck` xanh; nếu đổi encoding thì thêm contract test round-trip.
3. E2E thật: rebuild + restart dewee, gửi lại đúng 5 prompt cũ qua Telegram cho agent `tra`, rồi `dewee traces list` → pull trace mới → **assert không còn span nào `status=error`** và `get_team` trả `team.name`.
4. Regression tìm kiếm: hỏi "Hoàng Quan Thương" → agent phải trả lời Vũ Tung Úc, không được nói "không có trong database".

## Unresolved

- Sửa dewee trước (rẻ, chữa hết) rồi mới tính hardening MCP? Hay làm cả hai?
- Có patch prompt agent `tra` để bám kết quả search đầu tiên không?

---

# Phần 3 — Validation live qua bot (2026-08-22 20:04–20:09)

Lần chạy đầu (trace 01a02979 / 01a0297c×2) **hỏng, bỏ**: gate `session_task_execution_policy.go:12` chặn mọi tool vì agent gọi `session_tasks action=update` khi chưa có ledger. Câu trả lời "[REDACTED]" trong lần đó là bot nhớ lại hội thoại cũ, không phải tool call — không tính là bằng chứng.

Lần chạy hợp lệ (thêm bước `action=ensure` kèm `current_step`):

| Trace | Nội dung | Kết quả |
|---|---|---|
| 01a02992-eced-7d27-a461-a17fe6717900 | get_data_version + đếm ký tự | tool chạy thật, span completed |
| 01a02994-e486-7612-8a58-2748b012f17c | 2× get_data_version → get_team | get_team **error** WORKFLOW_VERSION_CHANGED |
| 01a02996-b035-73e0-8618-49bcded8c909 | search | INVALID_REQUEST — lỗi format prompt, xem dưới |

## Bằng chứng quyết định

**1. Model thực sự nhận chuỗi đã bị bóp.** Span `mcp_tqccl__tqccl_get_data_version` (q1), output thô:
```
"workflowVersion":"workflow:sha256:[REDACTED]:build:sha256:[REDACTED]"
```
Bot tự đếm và báo **54 ký tự**. Chuỗi thật (đo bằng CLI) dài **158 ký tự**; chuỗi redact dài **50**. Con số bot báo đi theo đường khác với trace preview và không bị scrub — nếu model nhìn thấy hash thật nó phải báo ~158. → Loại bỏ hoàn toàn giả thuyết "chỉ trace bị redact, model vẫn thấy hash thật".

`dataVersion` = `"data:01cc8091c844"` còn nguyên (bot báo 18, thật 17) → đúng ngưỡng 64-hex.

**2. Vòng lặp chết tái hiện nguyên vẹn** (q2): 2 lần `get_data_version` liên tiếp OK, rồi
```
IN : {"expectedWorkflowVersion":"workflow:sha256:[REDACTED]:build:sha256:[REDACTED]","teamId":"team:team-intro-2"}
OUT: TQCCL_ERROR:WORKFLOW_VERSION_CHANGED
```
Model echo đúng chuỗi nó nhận được; MCP từ chối đúng theo hợp đồng. Không bên nào sai logic — dữ liệu bị hỏng trên đường truyền của dewee.

**3. Phạm vi rộng hơn workflowVersion — xác nhận live.** Trong cùng output q1, mọi `sha256` của artifact đều `sha256:[REDACTED]`. Đây chính là giá trị `suggest_replacements` bắt client echo lại (`research-contracts.ts:462`) → tool đó cũng hỏng, đúng như phân tích V3.

## Điểm chưa kết luận

q3 (`tqccl_search`) trả INVALID_REQUEST vì model gửi `{"kinds":"[\"team\"]","limit":"5"}` — string thay vì array/number, do prompt validate viết JSON inline gây nhiễu. **Lỗi prompt, không phải MCP.** Search đã được chứng minh đúng ở V2 black-box (`Hoàng Quan Thương` → `team:team-intro-2` Vũ Tung Úc), nên không chặn quyết định.

## Chốt

Sửa dewee `internal/tools/scrub.go:36` là **bắt buộc và đủ** để mở khoá `get_team`, `match_team`, `recommend_team`, `recommend_coexist`, `suggest_replacements`. Không có cách nào lách từ phía MCP mà không đụng vào tính toàn vẹn của `releaseId`.

---

# Phần 4 — Truy vết search qua bot (trace 01a0299d-70ff-702e-afad-3ce5dd98a454)

Ledger `ensure` OK → `tqccl_search` chạy thật, nhưng vẫn `INVALID_REQUEST`. Args model gửi:

```
{"kinds":"[\"team\"]","limit":"5","query":"Hoàng Quan Thương"}
```

`kinds` là **JSON-string** thay vì array, `limit` là string thay vì number. Prompt lần này KHÔNG chứa JSON inline → **không phải nhiễu từ prompt** như suy đoán ban đầu; model tự stringify khi user nêu giá trị cụ thể. Trace 15:09–15:13 cùng model gửi đúng `{"kinds":["team"],"limit":20}` → lỗi không tất định.

Hai gap có thể sửa trong repo này:

1. **Schema quá nghiêm ở biên LLM** (`research-contracts.ts:501-512`): `kinds` là `z.array(...)`, `limit` là `z.number()`. Đề xuất nới ở biên: `z.coerce.number()` cho `limit`, `z.preprocess` parse JSON-string cho `kinds`. Chỉ nới tại tool boundary, không đụng domain.
2. **Lỗi không nêu field** (`research-handlers.ts:306`, `publicMessage("INVALID_REQUEST")` = "Yêu cầu không hợp lệ."): agent không biết field nào sai → không tự sửa, không retry. Đề xuất trả kèm đường dẫn field vi phạm (tên field thôi, không lộ giá trị).

Không đổi kết luận về dewee. Câu hỏi search đã chốt ở vòng CLI black-box; ngừng lặp validate qua bot cho hạng mục này.

---

# Phần 5 — Thẩm định bảo mật + kế hoạch hành động (2026-08-22 20:50)

Phản biện độc lập chạy trên fable, đã tự verify lại 3 mắt xích quan trọng nhất.

## Đính chính phân tích bảo mật

Lập luận cũ "kẻ tấn công điều khiển được định dạng thì regex vốn vô dụng" **sai vì gộp hai tầng chi phí khác nhau**. Tồn tại tầng rẻ: agent chỉ cần tự thêm tiền tố `sha256:` — từ khoá cố định, ghi công khai trong `scrub.go`.

Đường khai thác đã verify:
- `cmd/onboard_helpers.go:64` ghi `GOCLAW_ENCRYPTION_KEY` dạng trần vào `.env.local`.
- `internal/tools/shell_deny_groups.go` chỉ chặn `echo/printf/python -c/node -e` khi có literal `$GOCLAW_…` (dòng 233-236). **Không pattern nào chặn đọc file `.env`**; `dangerous_paths` (dòng 96-107) chỉ có chmod/chown.
- `internal/tools/shell.go:269` chỉ jail **thư mục làm việc**, không jail nội dung lệnh → đường dẫn tuyệt đối vẫn đọc được. Deployment chạy native qua launchd (`run-dewee.sh` exec thẳng), không container.
- Lệnh dạng `grep ENCRYPTION_KEY .env.local | sed 's/.*=/sha256:/'` → với regex nới sẽ khớp nhánh miễn trừ và **không bị redact**.

→ **Nới regex một mình CÓ hạ threat model. Nới regex + hardening đăng ký giá trị khoá thì KHÔNG.** Hardening chạy `strings.ReplaceAll` theo giá trị chính xác sau vòng regex, không quan tâm tiền tố. Đã xác nhận `registry.go:244` gọi bản global `ScrubCredentials` (không phải `ScrubCredentialsCtx`) nên hardening có hiệu lực trên đúng đường tool output.

Được xác nhận đúng: regex đề xuất không có bug (RE2 tuyến tính, không ReDoS, hex tham lam dừng đúng ở `:`, sha512 trần vẫn bị redact); không sót secret ≥64-hex nào khác (gateway token 32 hex, API key 32 hex, PKCE verifier base64, license token 32 hex).

Bác bỏ: allowlist theo MCP server / tắt scrub cho tool "đã trust" — phá đúng thuộc tính defense-in-depth của Layer 4 (`docs/09-security.md:16`); server trusted vẫn có thể echo nội dung độc.

---

# VIỆC CẦN LÀM

## A. Repo dewee — `/Users/plateau/dewee-src`

Thứ tự A1 → A2 → A3 là **bắt buộc**, không đảo. Ship A3 trước A1 tạo cửa sổ có miễn trừ nhưng chưa có lưới exact-match.

### A1. Hardening — bịt đường rò khoá mã hoá
- `internal/tools/env_scrub.go:13-33` — thêm `GOCLAW_ENCRYPTION_KEY` vào `staticCredentialEnvKeys` (hiện chỉ có `GOCLAW_GATEWAY_TOKEN`).
- Lúc boot: gọi `AddCredentialScrubValues(os.Getenv("GOCLAW_ENCRYPTION_KEY"))`. Hàm này hiện **không có caller nào ngoài test**.
- Comment bắt buộc kèm theo: *chỉ dùng `AddCredentialScrubValues` cho secret cấp-process; secret cấp-tenant PHẢI dùng `AddScrubValuesCtx`/`WithScrubBag`* — xem `scrub.go:117-121`, cơ chế global vốn đã biết là không tenant-safe.

### A2. Regression test khoá invariant
Test qua **pipeline thật**, không phải unit test regex rời:
- `ScrubCredentials("sha256:" + <giá trị khoá từ env>)` → phải chứa `[REDACTED]`, không chứa giá trị gốc.
- Ghi chú: `internal/tools/scrub_test.go` hiện **không có test nào** dùng hex ≥64 (`grep -c` = 0). Không có lưới sẵn, phải tự dựng.

### A3. Nới regex — fix chính, mở khoá 5 tool MCP
`internal/tools/scrub.go:36`. Go dùng RE2, **không có lookbehind** — `(?<!sha256:)` không compile. Dùng alternation + `ReplaceAllStringFunc`:

```go
// Digest-prefixed hex is content-addressed public data, not a secret.
// Bare long hex stays redacted — last net for GOCLAW_ENCRYPTION_KEY.
var longHexPattern = regexp.MustCompile(
    `(?i)\b(?:sha(?:1|256|384|512)|blake2b|blake3|md5|digest):[a-fA-F0-9]{32,}` +
    `|[a-fA-F0-9]{64,}`)
```
Match chứa `:` → giữ nguyên; ngược lại → `[REDACTED]`. Nhánh có tiền tố đặt **trước** (Go leftmost-first). `{32,}` ở nhánh này là cố ý: phủ `md5:` (32) và `sha1:` (40); hex trần 32-63 vốn chưa từng bị redact nên không mở thêm surface.

**Tuyệt đối không** nới thành "hex sau dấu hai chấm" — `ENCRYPTION_KEY: <64hex>` sẽ lọt.

Bảng test:

| Input | Kỳ vọng |
|---|---|
| `workflow:sha256:<64hex>:build:sha256:<64hex>` | giữ nguyên |
| `<64hex>` trần | `[REDACTED]` |
| `sha256:<giá trị GOCLAW_ENCRYPTION_KEY>` | `[REDACTED]` (nhờ A1) |
| `ENCRYPTION_KEY: <64hex>` | `[REDACTED]` |
| `ENCRYPTION_KEY=<64hex>` | `[REDACTED]` |
| `<128hex>` trần | `[REDACTED]` |
| `sk-…`, `ghp_…`, `AKIA…`, `postgres://…` | `[REDACTED]` |

### A4. Chất lượng chẩn đoán (không chặn)
- `internal/agent/session_task_execution_policy.go:12` — thông báo gate nêu thẳng `session_tasks(action="ensure", current_step="…")`. Agent gọi sai `update` thay vì `ensure` ở 4 trace liên tiếp.
- Lời gọi bị gate từ chối **không sinh span** → nhìn trace không biết agent đã thử gì. Nên ghi span cho cả trường hợp bị chặn.

### A5. Acceptance sau khi rebuild + restart dewee
Gửi lại 5 prompt gốc cho agent `tra`, pull trace, assert:
- Không còn span `status=error`.
- `get_team` trả `team.name`.
- Hỏi "Hoàng Quan Thương" → ra Vũ Tung Úc, không nói "không có trong database".

## B. Repo mcp-worker — `/Users/plateau/Project/CamNangTQCCL/mcp-worker`

Độc lập với A, làm song song được. Không cái nào chặn cái nào.

### B1. Short opaque token thay vì bắt echo digest 158 ký tự
Schema **đã có tiền lệ**: `research-contracts.ts:381-384` dùng `dataVersion: /^data:[a-f0-9]{12}$/` tách khỏi `releaseId` sha256 đầy đủ. `expectedWorkflowVersion` không theo tiền lệ đó.

Phát token ngắn opaque, server map ngược về digest đầy đủ. Đây là **staleness check chứ không phải integrity proof** nên rút ngắn không mất gì. Lợi ích: miễn nhiễm với mọi client có redaction, không riêng dewee; không cần chờ A xong.

**Giữ nguyên `releaseId` sha256 đầy đủ** — nó là digest toàn vẹn thật (`artifact-contracts.ts:308,471`, `release/worker-release-evidence.ts:131` ép `SHA256_PATTERN`). Cắt ngắn sẽ phá verify release và worker assets.

Đụng tới: `domain/canonical-state.ts:204` (`createWorkflowVersion`), `research-contracts.ts:14-20` (validator `workflowVersion`), và các schema echo digest khác: `confirmationBindingSchema.normalizationDigest` (:115), artifact `sha256` trong `replacementInputSchema` (:462).

### B2. Nới schema ở biên LLM
`research-contracts.ts:501-512` — `kinds: z.array(...)`, `limit: z.number()`. Model gửi `{"kinds":"[\"team\"]","limit":"5"}` → `INVALID_REQUEST` (trace 01a0299d). Không tất định: trace 15:09 cùng model gửi đúng kiểu.

Sửa: `z.coerce.number()` cho `limit`; `z.preprocess` parse JSON-string cho `kinds`. **Chỉ tại tool boundary**, domain giữ nguyên.

### B3. Lỗi nêu field vi phạm
`research-handlers.ts:306` trả `publicMessage("INVALID_REQUEST")` = "Yêu cầu không hợp lệ." trống trơn → agent không biết sai ở đâu, bỏ cuộc, không retry.

Sửa: kèm đường dẫn field từ zod issues. Chỉ tên field, không lộ giá trị.

### B4. Search cho biết vì sao khớp
`data/snapshot-index.ts:118` index `nickname` nhưng item trả về chỉ có `displayName`. Đây là nguyên nhân bot nói "database không có Hoàng Quan Thương" trong khi MCP đã trả đúng `Vũ Tung Úc`.

Sửa: thêm `matchedTerm` (và `nickname` nếu có) vào item + output schema.

### B5. Verify
`npm run test:coverage && npm run typecheck`. Nếu làm B1 thì thêm contract test round-trip token ngắn.

## C. Prompt agent `tra` (tuỳ chọn)
Bám kết quả search đầu tiên, không tự kết luận "không có trong database" khi tool đã trả item.

## Unresolved
- B1 có làm ngay không, hay chờ A xong rồi đánh giá lại mức cần thiết? (A đủ để hết lỗi; B1 là defense-in-depth cho client khác)
- A4 (span cho lời gọi bị gate chặn) có nằm trong scope đợt này không?
