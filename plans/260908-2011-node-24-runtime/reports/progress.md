# Node 24.20.0 completion — 2026-09-09

Status: completed with a documented deployment limitation. Full-plan sync covered the single phase: 4/4 tasks and 4/4 plan criteria complete; no unresolved mappings.

| Acceptance | Evidence |
| --- | --- |
| New zsh/fish shells select Node 24.20.0 and npm 11.19.0; Node 22.16.0 retained | [Runtime setup](runtime-setup.md), [independent review](review.md) |
| Exact pin, bounded engines and lock roots align; dependency objects unchanged | [Independent review](review.md) |
| Canonical MCP workflow fingerprint regenerated and fresh | [Validation](validation.md), [independent review](review.md) |
| Runtime builds, types, tests and browser checks pass | [Validation](validation.md): Node 143 including artifact 9, E2E 26, Python 89, MCP 305, Vision 53, workerd 3 |
| Scoped review has no blocking defect; unrelated WIP preserved | [Independent review](review.md), [runtime setup](runtime-setup.md); controller hash checks retain original source WIP except authorized README runtime edit |

## Documentation impact

Runtime setup/build requirements changed. The smallest owning surfaces, [README](../../../README.md) and [deployment guide](../../../docs/deployment-guide.md), now match the shared 24.20.0 pin. No roadmap/changelog update is needed for completion itself. Historical Khai hoang validation records retain their original runtime evidence; three concurrently changed Khai hoang phase documents were not reverted or edited by this task.

## Limits and handoff

- Supplemental Wrangler dry-run failed because `.worker-assets` is absent. Its canonical builder correctly rejected dirty source with `SOURCE_NOT_CLEAN`; deployment bundling remains unverified. A future release from an approved clean checkout must generate assets and pass the dry-run. No bypass, commit or deployment occurred.
- Existing shells/agents may retain an older runtime until restarted or explicitly selecting 24.20.0. Fish uses an explicit version selector; rollback must update/remove it as well as the nvm alias.
- CLI `ak plan check` marked both checklists and `ak plan update` set plan status. The CLI leaves phase frontmatter and the human-readable phase table unchanged; those duplicate status displays were reconciled to the completed checkbox state before final validation.
- Journal CLI preflight resolved ancestor registry project `plateau` at `/Users/plateau`, not this repository. Per controller authorization, the concise journal was written directly under repository `plans/journals`; no registry/global configuration was changed. AgentWiki publish skipped.

Unresolved questions: none. Unverified release gate: actual Worker deployment dry-run.
