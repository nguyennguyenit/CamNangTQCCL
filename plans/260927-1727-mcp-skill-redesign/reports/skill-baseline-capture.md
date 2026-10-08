# Skill baseline capture (pre-edit)

Captured before any Phase 2 edit, worktree branch `feat/mcp-skill-redesign`. Observed from files on disk; no model routing traces (NOT_RUN).

## tqccl-research

| file | bytes | sha256 |
|---|---|---|
| `.agents/skills/tqccl-research/SKILL.md` | 9245 | `289942c3f2f12f6c22c9303a06bdabbcd0b74f18617d2efbee2bf9635a2f2cc7` |
| `.agents/skills/tqccl-research/references/evidence-and-region-rules.md` | 7257 | `6b65a29ef27b608c874789e894b103e6d02592e026d5c9919539c9eb5ea05df3` |
| `.agents/skills/tqccl-research/references/report-template.md` | 5986 | `2f1723566c30bd5ca990c8a77f2531719983e0224eaf8a8c8ebaefd46d8b10c4` |
| `.agents/skills/tqccl-research/agents/openai.yaml` | 330 | `58903659594355161a55106aec4f67c6cdf333af21c774818d00330505476c4d` |

Frontmatter:
```yaml
name: tqccl-research
description: This skill should be used for CamNangTQCCL team-build research, tactic or mechanic verification, and game-source validation with scoped evidence and correction tracking.
```
Description length: 169 chars (target < 200).

Referenced files / paths in SKILL.md:
- `../../../docs/research-sources.md`
- `../tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md`
- `references/evidence-and-region-rules.md`
- `references/report-template.md`

## tqccl-coexist-team-builder

| file | bytes | sha256 |
|---|---|---|
| `.agents/skills/tqccl-coexist-team-builder/SKILL.md` | 3963 | `b4f8abee81888b597120d4af723bd5448eacfd16e850c8b7bba641a371bc81a0` |
| `.agents/skills/tqccl-coexist-team-builder/references/chat-context-team-notes.md` | 5284 | `77d2afd226b94b366ff4b6fa16549ad58a9045e1a228989e2de374d8f3e482d5` |
| `.agents/skills/tqccl-coexist-team-builder/references/coexist-team-rules.md` | 2362 | `4ac12ccbf27536ec46241a3d29c7b7b0aa43a4567619e49a1dabc2a1de3ece83` |
| `.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md` | 3832 | `a916c8c81c65e458cba11d24328ef3ed63f2dca46cce9e661a502796452110fb` |
| `.agents/skills/tqccl-coexist-team-builder/agents/openai.yaml` | 243 | `f15c01088bfe52a1c37c9c63092a72e35a0e1a40b42845dd1a35dbb1e2c7c290` |
| `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py` | 4765 | `2e2329a79c7451cfd4a49d8d72707fd44af26b3abe2a3a771c6b8ff24b6835ad` |

Frontmatter:
```yaml
name: tqccl-coexist-team-builder
description: Build Tam Quốc Chí Chiến Lược coexist team recommendations for the CamNangTQCCL project. Use when the user asks to ghép team cùng tồn, build thêm team, chọn team không trùng chiến pháp, ưu tiên tướng nhiều hột/red copies, research chiến báo/meta đa nguồn Trung-Nhật-Hàn-Anh, or asks for team recommendations that must follow the project's prebuilt team data and tier order from T0 through T1.
```
Description length: 392 chars (target < 200).

Referenced files / paths in SKILL.md:
- `/Users/plateau/.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py`
- `data/coexist.json`
- `data/team-tier.json`
- `data/teams.json`
- `references/chat-context-team-notes.md`
- `references/coexist-team-rules.md`
- `references/multi-source-research-and-logic-checks.md`

## Known baseline defects

- coexist description ~390 chars (> 200 limit); `/Users/plateau/.agents/...` absolute paths to `scripts/list_candidate_teams.py` in SKILL.md:25,31.
- `list_candidate_teams.py` callers outside plans: only coexist `SKILL.md` (grep, excl. node_modules/.git/plans).
- coexist instructions default to account notes `references/chat-context-team-notes.md`.
- research SKILL.md never calls a version/playbook tool (matches phase-02 step 5 note).

## Actual catalog

Not captured: no MCP host / Dewee runtime in this task. See `dewee-runtime-2026-10-07.md` for the 8-tool legacy catalog observed on Dewee. Status: NOT_RUN for reference reads / routing traces.
