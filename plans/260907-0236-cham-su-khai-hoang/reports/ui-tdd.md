# UI TDD — 2026-09-07

Scope: `js/render.js`, `css/styles.css`, `tests-e2e/khaihoang-options.spec.mjs`.

## Red

Before renderer edits, ran:

```sh
npm run test:e2e:astro -- tests-e2e/khaihoang-options.spec.mjs --grep 'standalone.*1280'
```

Result: 1 failed. At line 88, `getByRole('heading', { name: 'Team Chạm Sứ / Ăn vạ', exact: true })` was not found after 5000ms. Fixture contains actual CSV groups Lữ Mông–Giả Hủ and Tôn Thượng Hương–Lăng Thống, including group alternatives and the CSV's Phong Thi Trận. This demonstrates the missing UI independently from runtime data migration.

## Green

After adding standalone renderer and removing transforms presentation:

```sh
npm run test:e2e:astro -- tests-e2e/khaihoang-options.spec.mjs
```

Result: **7 passed (24.4s)**. Original two option tests unchanged. Additional coverage verifies desktop 1280px/mobile 375px, three-block order, original `.kh-card` count, exact heroes/tactic chips/note/source URL, safe source rel, no unit/before-after/variant controls in Chạm Sứ, absent transforms label, missing/empty `chamSuTeams`, legacy mines array, and no document overflow.

## Visual and process checks

Inspected [375px card](cham-su-375.png): both hero/tactic rows are readable, alternatives wrap beneath them once, source link remains inside card; no clipping. [Desktop card](cham-su-1280.png) retained as additional evidence. Screenshots are fixture-based; curated eight-group data is validated separately by root.

Port 4174 was free before each run. Playwright webServer owned preview PIDs 32459 (red) and 33040 (green), command `npm run preview -- --host 127.0.0.1 --port 4174`, worktree `/Users/plateau/Project/CamNangTQCCL`. Harness stopped both on test exit; final `lsof -nP -iTCP:4174 -sTCP:LISTEN` returned no listener. No user process stopped.

No unresolved UI questions.
