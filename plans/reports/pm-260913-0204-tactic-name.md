# Vô Địch Can Trường rename

- Outcome: canonical Vietnamese display name corrected; Han-Viet lookup preserved.
- Scope: runtime dictionary, generic placeholder source, canonical name override, regression test. No active plan; unrelated plan WIP untouched.
- Root cause: complete 刚勇无前 record used the Han-Viet label while the requested Vietnamese label resolved to a separate empty placeholder.
- Prevention: one complete canonical record; three name forms resolve to it; override and generic sources checked against regeneration drift.
- Verification: regression red then green; 195 Node tests, 188 Python tests, Astro check, build, 13 dist tests, and 43-file artifact verification passed. Independent review: 9.5/10, no blockers.
- Browser: own temporary preview at 127.0.0.1:4174, new/old/Chinese names verified, screenshot inspected, no page errors; preview stopped. Existing fuzzy suggestions intentionally preserved.
- Docs impact: no API, schema, setup or architecture changes; historical journal only.
- Release: not committed, pushed or deployed.

## Unresolved

- Public website remains unchanged until an authorized release.
