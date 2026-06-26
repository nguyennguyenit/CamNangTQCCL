---
type: red-team-audit
date: 2026-06-23
slug: mobile-filter-team-pk
---

# Red-Team Audit Mobile Filter Team PK

## Findings

| Severity | Finding | Response |
|---|---|---|
| High | If drawer stays open on section switch, it can cover non-Team PK pages. | Auto-close in `switchSection`; hide opener outside Team PK. |
| High | A separate opener can become invisible if placed below content. | Place mobile filter action directly below disclaimer before grid. |
| Medium | Overlay may trap scroll or create inaccessible state. | Use overlay button + Escape close; avoid focus trap complexity for narrow static drawer. |
| Medium | Desktop could accidentally show drawer header/footer. | CSS hides drawer chrome by default, shows only in mobile media query. |
| Medium | Inline `style.display` conflicts with responsive CSS. | Replace with layout/section classes and drawer close state. |
| Low | Adding tests by importing `app.js` may trigger `main()`. | Put drawer behavior in testable exported functions or use DOM smoke if import is too side-effectful. |

## Audit Verdict

Plan is acceptable if implementation proves:

- Nav tabs are only sections.
- Drawer has all close paths.
- Existing filters/search tests remain green.
- Mobile screenshot/DOM smoke confirms no overlap.

## Open Questions

None.
