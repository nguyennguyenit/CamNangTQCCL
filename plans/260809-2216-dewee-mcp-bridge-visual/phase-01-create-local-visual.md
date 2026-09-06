# Create local visual

## Files

- Create `_site/showoff/dewee-mcp-bridge-fix/content.md`.
- Create `_site/showoff/dewee-mcp-bridge-fix/index.html`.
- Create screenshots under `_site/showoff/dewee-mcp-bridge-fix/images/`.

## Steps

- [x] Write concise bilingual content from verified trace and source evidence.
- [x] Build a self-contained responsive HTML page.
- [x] Verify local rendering and theme controls.
- [x] Attempt capture; record missing Puppeteer dependency and keep publishing disabled.
- [x] Confirm every showcase artifact is ignored by Git.

## Validation

- Open the HTML locally.
- Check console errors and responsive layout.
- Run `git check-ignore -v` on HTML, content, and screenshots.

## Risk and rollback

- Risk: accidental inclusion in a commit. Mitigation: store under `_site/`, already ignored.
- Rollback: delete the local showcase directory; no runtime or dewee code is touched.
