# Python HTTP acquisition probe

Observed in this conversation on 2026-09-12, Asia/Saigon; not a full-source import. Read-only Python `urllib.request` GET, 20-second timeout, ordinary User-Agent, no cookies or login. HTML passed directly to the existing worktree parser without browser JavaScript execution. No website data or code changed.

| URL | HTTP | Bytes read | Existing parser result |
|---|---|---|---|
| `https://sgsdeck.com/recommended?season=pk-s28` | 200 | 333231 | source season `pk-s28`, 93 list records |
| `https://sgsdeck.com/recommended/s28-feixiong-tai-wei-qi` | 200 | 80021 | source season `pk-s28`, 3 heroes, 6 nonempty tactics, 9 nonempty books |

The dedicated web reader could not open these URLs; Python HTTP succeeded. This does not establish that all seasons/categories support the same path, nor prove that every description, slot or identity is fully modeled by the existing parser. Bytes are the observed response sizes, not persisted checksums. Original response files were not retained in this probe.

Decision: Python-first acquisition with persisted raw cache and deterministic offline parsing. Browser remains the verification/fallback tool for unexpected source behavior. During implementation, archive actual raw pages and hashes, validate each requested scope against returned content, and reconcile the complete discovered scope inventory before publishing.
