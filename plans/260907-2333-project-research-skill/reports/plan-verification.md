# Source verification — 2026-09-07

## Evidence

Standard tier: Fact Checker and Contract Verifier. Source-presence checks below establish local owners, not behavioral success or live game truth. No application tests run.

| Area | Claim / source anchor | Result |
| --- | --- | --- |
| Baseline | `Gói skill đã chốt` | VERIFIED `plans/reports/brainstorm-260907-1714-project-research-skill.md:110` |
| Baseline | `Kiểm chứng bổ sung` | VERIFIED `plans/reports/brainstorm-260907-1714-project-research-skill.md:179` |
| Baseline | `Trạng thái bằng chứng` | VERIFIED `docs/research-sources.md:54` |
| Baseline | `Docs evergreen` | VERIFIED `docs/code-standards.md:85` |
| Baseline | `plans/` | VERIFIED `README.md:97` |
| Baseline | `"id"` | VERIFIED `data/teams.json:3` |
| Baseline | `"rankings"` | VERIFIED `data/team-tier.json:4` |
| Baseline | `"teams"` | VERIFIED `data/khaihoang.json:2` |
| Baseline | `"test:node"` | VERIFIED `package.json:16` |
| Baseline | `Binh Vô` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/references/chat-context-team-notes.md:57` |
| Package | `name: tqccl-coexist-team-builder` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/SKILL.md:2` |
| Package | `display_name:` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/agents/openai.yaml:2` |
| Package | `short_description:` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/agents/openai.yaml:3` |
| Package | `default_prompt:` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/agents/openai.yaml:4` |
| Package | `SGSDeck — đội đề xuất` | VERIFIED `docs/research-sources.md:17` |
| Package | `233乐园 — cộng đồng game` | VERIFIED `docs/research-sources.md:27` |
| Package | `| Đã đối chiếu |` | VERIFIED `docs/research-sources.md:60` |
| Package | `| Phương án từ nguồn |` | VERIFIED `docs/research-sources.md:61` |
| Package | `| Chưa xác minh |` | VERIFIED `docs/research-sources.md:62` |
| Package | `## Logic Sanity Checklist` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md:41` |
| Integration | `Read `references/multi-source` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/SKILL.md:45` |
| Integration | `T0`, `T0.5`, `T1` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/SKILL.md:14` |
| Integration | `duplicates a locked tactic` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/SKILL.md:15` |
| Integration | `Prefer higher-red` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/SKILL.md:16` |
| Integration | `If the user references prior chat context` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/SKILL.md:53` |
| Integration | `## Evidence Grading` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md:32` |
| Integration | `--available-heroes` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py:64` |
| Integration | `--used-tactics` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py:65` |
| Integration | `--no-conflicts` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py:67` |
| Integration | `--max-tier` | VERIFIED `.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py:68` |

## Additional observations

- Node `yaml` and `js-yaml` imports succeed; actual existing skill frontmatter and agents metadata parse successfully with `yaml`.
- System Python validator reported missing `yaml`; no dependency installation or validator change performed.
- Brainstorm has 16 local Markdown references; all resolve.
- Planned new skill is absent; this is package inventory evidence, not a behavioral Red.
- Search in `.agents`, `docs`, `tests`, `tests-js` and `package.json` found no runtime consumer of the new skill. Existing coexist metadata invokes its own skill; its workflow owns the only intended handoff edit.

## Unresolved questions

None for source anchors.
