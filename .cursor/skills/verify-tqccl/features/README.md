# Cẩm Nang TQCCL verification map

This directory is the maintained source for verifying the user-facing behavior of the Cẩm Nang TQCCL handbook website. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch the site with `control-tqccl launch` so it is served at `http://127.0.0.1:4175` (or `$TQCCL_VERIFY_PORT`) from this run's `dist/`.
- Set `TQCCL_VERIFY_RUN_ID` (and a distinct port) so concurrent runs do not share `run.json` or the Playwright profile.
- Put `.cursor/skills/verify-tqccl/bin` on `PATH`.
- Run `control-tqccl doctor` and require the expected URL, launch PID owning that port, and git revision.
- Never drive an instance that was not started by this verification run.
- Do not set `COMMUNITY_API_ORIGIN` to production for the build. Blog and static community-team pages may be empty; that is not a failure of the mapped features.
- The Playwright profile starts with empty `localStorage` (no seeded chiêu mộ / kho). Features that need a first-run onboard say so.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position. When a CSS id is the stable handle (`#section-team-chuan`, `#team-detail-body`), it is named in the recipe.
- Treat every command as literal. Keep Vietnamese names and flags unchanged.
- Run browser actions through `control-tqccl browser`. There is no product CLI.
- After a mutation, prove with a second user-facing read (reload or Back). Do not remove proof artifacts during cleanup.
- Desktop width 1280×800. On inner pages, section links live in `.quick-nav`; do not confuse them with header dropdowns named `Đội hình` / `Công cụ`.
- Wait `--boot` only on pages that load `js/app.js`. Landing `/` and Tra cứu hub `/tra-cuu/` do not.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the Cẩm Nang identity visible.
- Mutation proof includes a read-only second view of the stored value.
- Record the feature ID and entry point used with every artifact (`--feature` / `--entry`).
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.
- `/quan-tri/`, `/doi-cua-toi/`, posting to `/doi-cong-dong/`, Google sign-in, and Soi đội "Đọc ảnh" are **not mapped**. They need community-worker, OAuth, or the vision Worker. If a later run tries them against this launch, report `verified-unreachable` (no `/api/*` on `astro preview`; non-localhost requests aborted).

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with <harness>` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Landing](./landing.md) covers the home page identity, stats, and the primary CTA into Đội chuẩn.
- [Đội chuẩn](./doi-chuan.md) covers the recommended-team browser: search, view switch, and opening a team detail page.
- [Tra cứu](./tra-cuu.md) covers the lookup hub, the Tướng group, search, and the profile dialog.
- [Theo dõi chiêu mộ](./theo-doi-chieu-mo.md) covers the guest (localStorage) recruit tracker: onboard, log a miss, undo.
- [Gợi ý đội từ kho](./goi-y-doi-tu-kho.md) covers building a local roster by hand and asking for five teams.
