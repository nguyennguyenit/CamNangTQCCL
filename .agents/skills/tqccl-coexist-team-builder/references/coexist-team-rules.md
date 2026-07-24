# Coexist Team Rules For CamNangTQCCL

## Priority Order

Use this order unless the user gives a stronger constraint:

1. No duplicated tactics across active teams.
2. Prebuilt project team exists in `data/teams.json`.
3. Best tier from `data/team-tier.json`: `T0` > `T0.5` > `T1`.
4. User's higher-red or higher-copy generals.
5. Lower cost, fewer premium tactics, easier substitutions.

## Interpreting "nhiều hột"

Treat "hột" as red stars/copies/investment. If the user provides screenshots, use visible awaken/red-star information. If not available, ask only when the choice depends on it; otherwise mark red priority as unknown and choose by tier + tactic conflicts.

Do not let red stars override hard tactic conflicts. A high-red team that steals `Đoạt Hồn`, `Đương Phong`, `Thuyền Cỏ`, `Cắt Xương`, `Quân Dân`, `An Ủi`, or other locked premium tactics can be recommended only as a "move tactics" option.

## Conflict Handling

For each candidate team:

- `hard conflict`: exact same tactic already used by another active team.
- `soft conflict`: the tactic is available only if the user is willing to weaken another team.
- `missing`: user has not confirmed owning the tactic.
- `substitution`: replacement tactic that keeps the team's role but lowers ceiling.

A valid coexist recommendation has zero hard conflicts.

## Team Source Discipline

Use `data/teams.json` and `data/coexist.json` as the source of truth for built teams. Use web research only when:

- the project has no matching team,
- the user asks for Chinese battle reports,
- a tactic/hero mechanism is uncertain,
- current meta may have changed.

When web research disagrees with project data, say which source is newer or more specific. Do not silently overwrite project tiering.

## Ranking Language

- `T0/T0.5`: can be main-team or high-priority coexist if no tactic conflicts.
- `T1`: good coexist candidate.
- `Unranked but coherent`: usable only if it solves roster/tactic constraints.
- `Experimental`: only recommend when the user explicitly accepts lower stability.

## Final Answer Checklist

Before answering:

- List active locked tactics from user teams.
- Check candidate team tactics against locked tactics.
- State whether the team is exact prebuilt or substituted.
- State what gets worse if substituting.
- Choose one clear recommendation.
