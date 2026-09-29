# Phase 3 — Worker mode `explainSubstitute` (TDD)

Re-read `worker/src/*` after the concurrent session commits; they are being changed now.

## Request
`POST /analyze` `{ mode: 'explainSubstitute', turnstileToken, context }` — no `image`.
```ts
context = { locale: 'vi' | 'zh', hero: string, missing: { name, effect }, substitute: { name, effect }, configCount: number }
```
Strings ≤ 40 (names) / ≤ 1200 (effects); unknown keys rejected (400).

## Worker changes
- `schema.ts`: add mode to `AnalyzeMode`/`ANALYZE_MODES`; `validateExplainContext`; `validateExplanation`
  → `{ explanation: string (1..600) }`.
- `index.ts`: same order (origin → limits → Turnstile → commitGlobalUsage); branch: text modes skip
  `validateImage` and require valid `context`.
- `model.ts`: `EXPLAIN_SUBSTITUTE_PROMPT` (explain only; never name another tactic; say when effects differ);
  `buildRequestBody` text-only content for this mode.
- Tests: schema validation, index branch (no image OK for this mode, image modes still require image,
  Turnstile/limits still enforced), prompt contract, 4 old modes unchanged.

## Frontend client (`js/analyze.js`)
- Add `callWorkerExplain(context, token)` sharing the fetch/error mapping of `callWorker`;
  `validateWorkerResult('explainSubstitute', data)`.
- Client-side guard: reject explanation mentioning any tactics-dict name other than missing/substitute
  → show generic "Không giải thích được" message.
- Test in `tests-js/analyze-errors.test.mjs`.
