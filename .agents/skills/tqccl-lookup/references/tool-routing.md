# Lookup tool routing

How to pick a tool and recover from errors. Field-level schemas come from the tool
definitions the host exposes (or the CLI `--help`); do not copy them here and do not
hardcode counts of heroes/teams/seasons.

## Choosing the call

| Question | Calls |
| --- | --- |
| Which version/capabilities/locale is live? | `tqccl_get_playbook` (once per task) |
| "Tướng/chiến pháp/trang bị/quân sư/cải tạo/công trình/binh thư X" | `tqccl_search` → `tqccl_get_entity` |
| Nested specials, options, levels of one entity | `tqccl_get_entity` with its paging/section options |
| "Đội chuẩn mùa nguồn X", "đội nào có hero Y + tactic Z" | `tqccl_find_teams` → `tqccl_get_team` |
| "Chiến pháp thay thế của đội nguồn" | `tqccl_get_team` (`alternatives`, `tacticRefs`) |
| Khai hoang | `tqccl_find_teams` for the Khai hoang collection → `tqccl_get_team` for the exact phase |

Search returns candidates; only `tqccl_get_entity` / `tqccl_get_team` results are
used as facts in the answer. Several candidates with different identity → ask the
user to choose.

## CLI fallback (same handlers, same JSON)

`cd mcp-worker && npm run cli -- <alias> --input '<json>'`

| Tool | Alias |
| --- | --- |
| `tqccl_get_playbook` | `playbook` |
| `tqccl_search` | `search` |
| `tqccl_get_entity` | `entity` |
| `tqccl_find_teams` | `find-teams` |
| `tqccl_get_team` | `team` |

## Errors

| Code | Action |
| --- | --- |
| `WORKFLOW_VERSION_CHANGED`, `KNOWLEDGE_VERSION_CHANGED` | Call `tqccl_get_playbook` again, redo the lookup |
| `CAPABILITY_UNAVAILABLE` | Playbook capabilities say what the release lacks; report it, never treat as empty |
| `ENTITY_NOT_FOUND`, `REFERENCE_NOT_FOUND` | Re-run search/find to get a valid id/selector; if still none, say it does not exist |
| `REFERENCE_SCOPE_INVALID` | Drop the season/category filter or choose a valid one |
| `CURSOR_INVALID` | Restart from the first page |
| `RESULT_TOO_LARGE` | Narrow the query / lower the limit |
| `DATA_UNAVAILABLE`, `INTERNAL_ERROR` | Retry once, then report the code |

No MCP and no CLI: state the limit and link `https://tqccl.com/tra-cuu/`.
