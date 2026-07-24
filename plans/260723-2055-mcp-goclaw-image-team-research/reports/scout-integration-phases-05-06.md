# Scout: integration phases 05–06

Date: 2026-07-23. Planning only; no product files changed.

Evidence: the three phase research reports, all six `.agents/skills/tqccl-coexist-team-builder/` files, relevant root/Worker tests, and current architecture/deployment docs.

Controlling decisions:
- `mcp-worker/` does not exist; Phase 5/6 depend on Phases 2–4 delivering domain service, tool registry, FS/R2 sources, stdio, authenticated Streamable HTTP, and tests.
- Images stay in GoClaw: channel media -> per-user `.uploads` -> `read_image` -> structured aggregate -> read-only `tqccl_*` MCP. Raw bytes/base64/path never enter MCP.
- Production MCP is DB-backed `streamable-http`, encrypted `api_key`, dedicated agent grant, exact `tool_allow`; stdio is local only.
- Current source routes are `/v1/mcp/servers/{id}/grants/agent` and `/v1/skills/{id}/grants/agent`; `/v1/mcp/grants` is stale.
- Dewee’s exact GoClaw version, administration surface, and retention contract remain staging gates, not repository-test assumptions.

## Phase 5 — portable skill and multi-image workflow

Outcome: an importable managed skill collects all current-turn images, calls `read_image` once per image, deterministically merges evidence, pauses on material identity uncertainty, then calls only structured read-only MCP tools.

### File inventory

| File | Action | Rough LOC | Test impact |
|---|---|---:|---|
| `.agents/skills/tqccl-coexist-team-builder/SKILL.md` | Modify | +35/−20 | Remove `/Users/...`; define collect/extract/merge/confirm/call/fail ordering. |
| `.agents/skills/tqccl-coexist-team-builder/agents/openai.yaml` | Modify | +3/−2 | Prompt describes screenshots plus MCP research. |
| `.agents/skills/tqccl-coexist-team-builder/references/goclaw-multi-image-mcp-workflow.md` | Create | 110–150 | Versioned prompt, envelope, merge, review rules. |
| `.agents/skills/tqccl-coexist-team-builder/references/coexist-team-rules.md` | Modify | +15–25 | Recency/evidence/unresolved/no-guess invariants. |
| `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py` | Modify | +3–8 | Mark local compatibility fallback; no new production behavior. |
| `tests/test_tqccl_skill_portability.py` | Create | 140–190 | Paths, secrets, references, tool order, raw-image ban, fallback smoke. |
| `mcp-worker/test/fixtures/goclaw-multi-image-extractions.json` | Create | 120–180 | Sanitized roster/team/tactic outputs plus expected aggregate. |
| `mcp-worker/test/contract/goclaw-workflow.test.ts` | Create | 170–230 | Aggregate -> canonical request -> service/result contract. |
| Deletions | None | 0 | Retain Python fallback for one compatibility release. |

Do not add channel download, image provider, Turnstile, or GoClaw administration code to MCP.

### Interface/config checklist

- Use `{baseDir}` for companions; ZIP/import through `POST /v1/skills/import`, grant and pin the managed version.
- Per-image envelope: `schemaVersion`, `imageOrdinal`, `kind` (`roster|built_teams|tactics|unknown`), `heroes`, `teams`, `tactics`, `unresolved`, `warnings`, `evidence`.
- Merge by canonical identity; preserve ordinals, highest supported level/red stars, and SP/CO or combined-slot distinctions.
- Current-turn evidence overrides chat notes only where present; retain conflicts. `reviewRequired` blocks recommendations when uncertainty can change ownership, locks, tactics, or coexist constraints.
- MCP input contains canonical IDs, confirmed corrections, locks, preferences, and evidence metadata only. Output requires `dataVersion`, provenance, conflicts/trade-offs, per-slot tactics, and truncation state.
- Final upstream allowlist: `tqccl_get_data_version`, `tqccl_normalize_entities`, `tqccl_search`, `tqccl_get_team`, `tqccl_match_team`, `tqccl_recommend_team`, `tqccl_recommend_coexist`, `tqccl_suggest_replacements`.
- Configure and allow `builtin_tools.settings.read_image.providers[]` with an enabled vision provider/model.
- MCP registration requires TLS URL, `streamable-http`, encrypted `api_key`, no `tool_prefix`, evidence-based timeout, dedicated agent grant, and exact upstream `tool_allow`; set `GOCLAW_ENCRYPTION_KEY`.
- Timeout/401/403/schema failure stops honestly; no invention or silent fallback.

### Dependency map

```text
P2 identity/evidence/review -> P3 deterministic recommendation/coexist/tactics
 -> P4 registry + stdio/HTTP + auth/R2 dataVersion -> P5 fixture/contract
GoClaw media -> .uploads -> read_image per image -> merge/review
 -> tqccl_* MCP -> versioned/provenanced answer
```

### Tests, gaps, and TDD

Current reusable coverage: `analyze-map` 15 tests, `roster-scan-map` 3, `team-recommend-engine` 7; Worker `schema`, `model`, and `scan-modes` cover browser vision only. Missing: skill portability, multi-image merge/recency, raw-image exclusion, review gate, SP/CO boundary, and GoClaw execution.

Tests first:
```bash
python3 -m unittest tests.test_tqccl_skill_portability
cd mcp-worker && npm test -- --run test/contract/goclaw-workflow.test.ts
```

Implementation order: fixture/contract -> portability test -> workflow reference -> compact `SKILL.md` -> prompt/fallback note. Repeat focused tests plus `npm run typecheck`.

Regression:
```bash
node --test tests-js/analyze-map.test.mjs tests-js/roster-scan-map.test.mjs tests-js/team-recommend-engine.test.mjs
python3 -m unittest discover -s tests
cd worker && npm test && npm run typecheck
cd ../mcp-worker && npm test && npm run typecheck
```

Automated: package/reference/secret checks, sanitized merge/review fixture, schema/tool contract, legacy regressions. Staging/manual: real skill import/grant; Telegram photo+album; Zalo OA inbound image under conservative 5 MB; web `POST /v1/media/upload` then `chat.send.media`; ambiguous-name pause; trace proof that `read_image` keeps base64 out of main model/MCP.

Risks/controls: screenshot prompt injection (untrusted data); uncertain OCR (review gate); stale/duplicate evidence (recency/dedupe); cost/DoS (count/size/time bounds); media privacy (`.uploads` TTL/redaction); tenant leakage (exact grants); outage hallucination (fail closed); source drift (pin GoClaw). Zalo Personal is prohibited in production.

## Phase 6 — validate, secure, release, and operate

Outcome: prove the complete read-only system with production-shaped artifacts and a staging GoClaw/Dewee tenant, safely publish immutable data/Worker/skill, and document rotation, retention, rollback, and deployed versions.

### File inventory

| File | Action | Rough LOC | Test impact |
|---|---|---:|---|
| `mcp-worker/test/e2e/team-research-workflow.test.ts` | Create | 200–280 | Golden envelope -> review -> coexist -> bounded result. |
| `mcp-worker/test/security/release-security.test.ts` | Create | 180–240 | Auth, limits, redaction, annotations, manifest/hash rejection. |
| `mcp-worker/test/fixtures/release-snapshot/` | Create | 150–250 | Minimal immutable real-schema manifest/data; no images/secrets. |
| `mcp-worker/scripts/verify-release.ts` | Create | 130–190 | Read-only health/initialize/list/call verifier; never prints bearer. |
| `mcp-worker/package.json` | Modify | +10–18 | e2e/security/check/verifier/dry-run/deploy scripts. |
| `mcp-worker/wrangler.jsonc` | Modify | +8–15 | R2 binding, non-secret limits/version, route/date. |
| `mcp-worker/README.md` | Create | 180–240 | Local, R2/Worker, env, tests, deploy, troubleshooting. |
| `docs/mcp-goclaw-operations.md` | Create | 240–330 | Provision/canary/rotation/retention/rollback and channel matrix. |
| `docs/system-architecture.md` | Modify | +35–55 | Fourth boundary and media/structured-data trust boundary. |
| `docs/deployment-guide.md` | Modify | +55–85 | Dataset/Worker/GoClaw sequence, smoke, rollback. |
| `docs/deployment.md` | Modify after release | +12–25 | Actual data/Worker/GoClaw/skill IDs and date only. |
| `docs/codebase-summary.md`, `docs/code-standards.md`, `README.md` | Modify | +35–60 total | Boundary, owned gates, navigation. |
| `docs/project-roadmap.md`, `docs/project-changelog.md` | Modify after verification | +11–22 | Verified status/release only. |
| Deletions | None | 0 | Preserve prior data/Worker/skill versions for rollback. |

`worker/wrangler.toml`, `worker/package.json`, and Worker secrets are regression inputs, not edit targets; keep Vision and MCP Workers independent.

### Interface/config checklist and dependencies

- `verify-release.ts` takes URL and expected `dataVersion`; bearer comes from secret env, never argv. Check `/healthz`, MCP initialize/list/call, schema, annotations, provenance, version, truncation.
- Security tests cover constant-shape 401/403, body/result limits, path isolation, redacted logs/errors, read-only annotations, and incomplete/mixed R2 snapshot rejection.
- `npm run check` owns unit/contract/transport/e2e/security/typecheck; deploy depends on it and pinned tools.
- Publish versioned objects+manifest, verify hashes/counts, then switch `current.json`; retain prior manifest. Worker has read-only R2 and no publication MCP tool.
- Pin tested GoClaw build; verify grant/revoke, bearer rotation/pool eviction, managed-skill pin/rollback, exact discovery, and `.uploads` deletion SLA.
- Rollout dependency: clean artifact -> R2 manifest -> Worker -> live verifier -> GoClaw MCP/grant -> `read_image` -> skill/grant -> Telegram -> Zalo OA -> web -> Dewee decision -> deployment records. Rollback reverses version pointers/grants and rotates compromised secrets.

### Tests, gaps, and TDD

Current gates are root Python, root Node, and Vision Worker tests/typecheck. Phase 2–4 domain/data/tool/transport/auth tests are prerequisites. Missing: full golden, corrupt R2 release cases, live verifier, secret/path redaction, grant/revoke/rotation, channel canaries, Dewee contract, and runbook.

Tests first and focused gates:
```bash
cd mcp-worker
npm test -- --run test/e2e/team-research-workflow.test.ts
npm test -- --run test/security/release-security.test.ts
npm run test:e2e && npm run test:security && npm run typecheck
npm run deploy:dry-run
```

Full regression:
```bash
python3 -m unittest discover -s tests
node --test "tests-js/*.test.mjs"
cd worker && npm test && npm run typecheck
cd ../mcp-worker && npm run check && npm run deploy:dry-run
```

Automated: deterministic golden, stdio/HTTP parity, bearer/limits/redaction, manifest/hash/version, package gates, live endpoint verifier. Staging/manual: real R2 switch/rollback, secret rotation, grant revoke, skill rollback, Telegram album, Zalo OA image, web upload, redacted trace review, media purge, and Dewee MCP/skill/`read_image` confirmation.

Risks/controls: bearer blast radius (least privilege/rotation/limits); cross-tenant exposure (pairing/grants/isolation); mixed data (atomic manifest); dirty publish (clean build/hash); version drift (`dataVersion` plus recorded IDs); secret leakage (no argv/query/log); indefinite retention (blocking SLA/purge); unsupported Zalo behavior (OA inbound/text only); false deployment claims (records only after canaries).

Status: DONE
Summary: Concrete Phase 5/6 inventories, contracts, dependencies, TDD gates, automation/canary split, and rollout/security controls are ready.
Concerns/Blockers: `mcp-worker/` must first be delivered by Phases 2–4. Dewee remote MCP, managed skills, `read_image`, exact version, and media retention remain production-blocking staging questions.
