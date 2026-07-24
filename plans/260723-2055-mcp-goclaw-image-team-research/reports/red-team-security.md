# Red-team security review of the implementation plan

Scope: plan and phase files plus the two requested research reports. This review preserves the fixed architecture decisions. Findings are limited to evidenced security, privacy, integrity, and factual-contract gaps in the plan.

## Findings

### 1. High — “Immutable” R2 releases can still be overwritten, and `current.json` has a lost-update race

- **Plan location:** `phase-06-validate-secure-release-and-operations.md:27`, `:77-80`, `:137-142`; `phase-03-build-research-tools-data-loaders-and-cli.md:102-103`.
- **Evidence:** The plan specifies upload order and post-upload verification, but no create-only precondition for `releases/<version>/*` and no ETag/`If-Match` precondition for replacing `current.json`. The research itself calls the scheme only “atomic-ish” and describes an ordinary pointer overwrite (`research/researcher-cloudflare-mcp.md:27`, `:180-187`). R2 `put()` supports conditional `onlyIf`, and failed preconditions do not store the object ([Cloudflare Workers R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)).
- **Failure impact:** A retry, concurrent publisher, or rollback racing a release can overwrite a supposedly immutable object or silently point consumers at the wrong valid release. Hash-after-upload does not prevent the race.
- **Precise plan correction:** Require create-only conditional writes for every versioned object and manifest; if a key already exists, verify byte/hash identity and never rewrite it. Read the prior pointer ETag and update `current.json` with `If-Match`; fail on conflict and require the operator to re-read/reconcile. Add concurrent-publisher and retry-idempotency tests, not only injected upload failures.

### 2. High — The claimed read-only runtime R2 policy is not enforceable through a normal Worker R2 binding

- **Plan location:** `phase-06-validate-secure-release-and-operations.md:32`, `:84`, `:195`; `phase-04-add-stdio-and-streamable-http-transports.md:62-63`, `:82`.
- **Evidence:** The plan gives the production Worker an R2 bucket binding and calls it “read-only by policy.” Cloudflare documents an R2 binding as a capability that exposes `get`, `put`, and `delete`; the binding itself is read/write ([Cloudflare bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/), [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)). The repository’s current architecture likewise treats Worker bindings as runtime capabilities (`docs/system-architecture.md:94`).
- **Failure impact:** A compromised dependency or future Worker regression can mutate or delete release data despite the stated credential separation, defeating the integrity and rollback model.
- **Precise plan correction:** Stop claiming the binding enforces read-only access. Either use a genuinely read-only retrieval path/credential supported by the chosen deployment design, or explicitly accept code-enforced read-only access and add a Worker-bundle guard that rejects `.put`, `.delete`, multipart, and publication imports plus an account-level R2 alert/audit control. Keep publisher credentials and code outside the runtime package.

### 3. Medium — The request guard order contradicts the “authenticate before body parsing” contract

- **Plan location:** `phase-04-add-stdio-and-streamable-http-transports.md:29`, `:80-85`, `:104`, `:119`; `plan.md:59`.
- **Evidence:** The requirement and test matrix demand `401` before parsing, but the function checklist orders `headers/body limit -> bearer` (`phase-04...md:83`). The source research requires bearer validation before parsing and lists wrong bearer as `401` before body parsing (`research/researcher-cloudflare-mcp.md:146-151`, `:222`).
- **Failure impact:** An unauthenticated client may trigger body reads, buffering, decompression, or parser work and receive content-dependent errors, increasing denial-of-service exposure and violating the promised constant/minimal auth failure behavior.
- **Precise plan correction:** Freeze the order as route + method + cheap header/Origin/declared-length checks → bearer authentication → streaming actual-byte cap/content negotiation/body parse → dependencies/server/handler. Add chunked/no-`Content-Length`, malformed compressed body, and wrong-bearer tests proving the body stream is not consumed before auth.

### 4. Medium — Secret-file hygiene is promised but not represented in the file plan

- **Plan location:** `phase-06-validate-secure-release-and-operations.md:33`, `:58`, `:81`, `:151`, `:195-196`; `phase-04-add-stdio-and-streamable-http-transports.md:183`.
- **Evidence:** The verifier consumes the bearer from an environment variable, and local Wrangler/test workflows commonly create `.dev.vars` or `.env` files. The current `.gitignore` ignores `.wrangler/` but not `.dev.vars*` or `.env*` (`.gitignore:1-14`); Phase 6 does not list `.gitignore` for modification. Repository standards say secrets must never be committed (`docs/code-standards.md:57`).
- **Failure impact:** A developer can accidentally commit the MCP bearer, Cloudflare token, GoClaw admin token, or provider/channel credentials used during staging.
- **Precise plan correction:** Add `.gitignore` to the file inventory and ignore `.dev.vars*`, `.env*`, and local secret exports while allowing explicitly sanitized `*.example` files. Add a tracked-file/secret-pattern gate covering the new package and release artifacts; document ephemeral shell or secret-store injection for the verifier.

### 5. Medium — The media gate covers `.uploads` deletion but not the raw-image vision provider’s privacy contract

- **Plan location:** `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:26-28`, `:137`, `:169-176`, `:187-193`; `phase-06-validate-secure-release-and-operations.md:113`, `:180`.
- **Evidence:** GoClaw sends raw images to the configured dedicated `read_image` provider (`research/researcher-goclaw-dewee.md:102-107`, `:129-131`). The staging gates verify routing and local `.uploads` purge, but not provider retention, training use, region, deletion, or payload logging. This repository already tracks provider retention and image-payload logging as unresolved privacy work (`docs/project-roadmap.md:28-35`) and documents an existing provider’s unpublished retention period (`worker/README.md:50-57`).
- **Failure impact:** Raw screenshots may outlive local purge, cross an unapproved region, be retained/trained on, or appear in provider/observability logs despite MCP correctly receiving only structured observations.
- **Precise plan correction:** Add a production-blocking vision-provider approval gate covering terms/DPA, training use, retention/deletion SLA, region, subprocessors, payload logging, and incident deletion. Add user-facing screenshot handling/consent guidance and a trace canary proving image content and persisted paths are absent from GoClaw/provider observability where configurable.

### 6. Medium — “Content-addressed” versioning conflicts with a timestamped manifest unless the digest boundary is defined

- **Plan location:** `phase-06-validate-secure-release-and-operations.md:76-80`, `:150`; `phase-03-build-research-tools-data-loaders-and-cli.md:27-28`, `:74`.
- **Evidence:** The release version is described as content-addressed while the manifest includes `created timestamp` (`phase-06...md:77`), yet unchanged artifact bytes must reproduce the release (`phase-06...md:150`). No canonical serialization or statement excluding nondeterministic metadata from version derivation exists.
- **Failure impact:** Two builds of identical data can receive different versions, or locally synthesized and R2 versions can diverge, breaking cache identity, rollback evidence, cursor version binding, and cross-transport parity.
- **Precise plan correction:** Define `dataVersion` as a digest over an ordered canonical tuple of the six artifact names, byte sizes, and SHA-256 hashes only. Exclude timestamps, object keys, environment, and upload metadata from that digest; specify canonical JSON serialization and add a build-at-two-times reproducibility test.

Status: DONE_WITH_CONCERNS
Summary: Six high-confidence plan corrections are required; the fixed architecture remains viable, but R2 immutability/read-only claims and request-auth ordering need correction before implementation.
Concerns/Blockers: No blocker to revising the plan. Dewee remains correctly staging-gated; vision-provider privacy approval and bearer scope are still unresolved production gates.
