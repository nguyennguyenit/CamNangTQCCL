# Research Report Template

Copy this template into a new, session-specific Markdown report under
`plans/reports/`. Keep only sections that apply to the branch. A source-
verification task should omit the build table while retaining scope, provenance,
claim status, access, corrections, limits, and budget.

Do not use placeholder text as evidence. Use `unknown` when a field was sought but
could not be established. Keep source facts, user facts, runtime observations,
and agent inference distinguishable.

```markdown
# <Descriptive research topic>

- Research date: <YYYY-MM-DD and timezone>
- Session/run: <stable session identifier>
- Branch: <team build | tactic/mechanic | source verification>
- Topic lock: <one unchanged topic>

## Objective

<The decision or claim being investigated, including explicit non-goals.>

## Scope

| Field | Value | How determined |
| --- | --- | --- |
| Server/region | <value or unknown> | <explicit user selection, conversation provenance, or unknown> |
| Season | <value or unknown> | <explicit user selection, conversation provenance, or unknown> |
| Patch/version | <value or unknown> | <source or unknown> |
| Evidence present | <packet/source date> | <do not substitute host capture date> |
| Capture date | <date/time> | <host metadata only> |

## Previous Conclusion and Corrections

- Previous claim: <claim or none found>
- Previous report: <relative link or none found>
- Current state: <still valid | corrected | needs verification>
- New evidence: <what changed, with link>
- Replacement conclusion: <scoped conclusion or unknown>

## Call Budget

| Topic | Allowance | Limit | Used | Remaining |
| --- | --- | ---: | ---: | ---: |
| <locked topic> | External sources | <effective limit, default 5> | <search, open, raw/API, child calls, media/browser, handoff> | <limit minus used> |
| <locked topic> | TQCCL MCP | <effective limit, default 5; playbook ≤ 1> | <executed remote TQCCL calls, retries included> | <limit minus used> |

List local CLI and file reads separately if useful; they cost zero.

## SGSDeck Status

- Exact roster/configuration inspected: <yes/no>
- SGSDeck conclusion: <verified exact baseline or required missing-baseline phrase>
- Score and exact owner: <value plus configuration, or unknown>
- Selected default source: <source or none>
- Why that default: <reason independent from SGSDeck status>

## Source Configurations

Omit this section for pure source verification. Use one table per source or exact
variant; never merge cells from different records.

### <Source and configuration identifier>

| Field | Exact source value |
| --- | --- |
| Phase/level window | <value or unknown> |
| Main commander | <value or unknown> |
| Sub-commanders | <values or unknown> |
| Tactics and holders | <complete mapping or unknown> |
| Troop/formation | <value or unknown> |
| Books | <complete values or unknown> |
| Stats/speed | <allocations/order or unknown> |
| Transition milestone | <when, what changes, new holder> |
| Account conditions | <unlocks, roster, red copies, availability> |
| Source score | <value and exact configuration owner, or unknown> |
| Sample size | <known value or unknown> |
| Direct URL/location | <URL plus section/image/frame/timestamp> |

## Claim Evidence

Use exactly one allowed status per material claim.

| Claim | Status | Provenance type | URL/path | Author/publisher | Original/repost/access dates | Region/season/patch | State | AI/repost | Exact location | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <claim> | <Đã đối chiếu / Phương án từ nguồn / Chưa xác minh> | <external/user/runtime/inference> | <direct reference or unknown> | <value or unknown> | <separate dates or unknown> | <values or unknown> | <preview/test/live/historical/current/unknown> | <disclosure/chain or unknown> | <section/table/image/frame/timestamp or unknown> | <scope and conflict notes> |

## Media Access

| Media | Accessed content | Not accessed | Claim impact |
| --- | --- | --- | --- |
| <URL/file> | <actual frames/audio/text read> | <remaining boundary> | <supported or still unverified> |

Omit the table only when no media claim exists. Never convert a title, thumbnail,
or unavailable video into a read claim.

## Comparison and Constraints

- Source agreements: <claim-level list>
- Source conflicts: <claim-level list with scope>
- Independence/repost chain: <analysis>
- Global applicability: <supported, unsupported, or unknown with reason>
- Configuration differences: <no mixing or score transfer>
- Mechanic sanity result: <result and evidence boundary, when applicable>

## Conclusion

<A scoped answer that distinguishes verified claims, source proposals, and
unknowns. Do not place invalid tactics in recommendation/fallback tables.>

## Limits and Unresolved Questions

- <inaccessible source or media>
- <missing season/server/patch field>
- <budget-limited gap>
- <question that could materially change the conclusion>

## Next Step

<The smallest useful follow-up that stays within authority.>

## Authorized Handoff

Include this section only when the user authorized adding data/tests or an
instruction defect was reproduced with edit authority.

- Dispatch attempted: <yes/no>
- Dispatch result: <accepted/denied/unavailable>
- Authorized target files: <exact paths>
- Evidence and statuses passed: <links/summary>
- Required tests: <commands/contracts>
- Prohibitions: <no broad rebuild, tier assignment, Git, or deploy unless separately authorized>
- Budget charged: <one handoff action when external>

## Final Validation

- [ ] Scope and its provenance are explicit or unknown.
- [ ] Prior reports and corrections were checked.
- [ ] Every material claim has exactly one allowed status.
- [ ] URLs and exact locations support numeric claims.
- [ ] Configurations, variants, scores, and sample sizes remain intact.
- [ ] SGSDeck status is separate from the chosen default.
- [ ] Media access is stated precisely.
- [ ] Topic, limit, used, and remaining are reported.
- [ ] No unauthorized mutation, tier change, Git action, or deployment occurred.
```
