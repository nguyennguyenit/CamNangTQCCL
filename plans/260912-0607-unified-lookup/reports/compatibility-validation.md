# Compatibility validation — unified lookup

Date: 2026-09-13  
Scope: local certification only; no deploy or production release.

## Certified identities

- Integrated baseline commit: `623aa053d7a045ea8ea45389c19bcc508ce8aca5`.
- Active lookup generation: `lookup:de73c4ca235de9b4ba6dbc5679573a3bab623a93ea6b061f0d30ad5f12c101e8`.
- `heroes-dict.json`: `cbe815c7612550822f4731a50b5c060564fe54b3788a87fc4148523e6baa37f1` — 202 records.
- `tactics.json`: `d91c216163a9f73f59839d69e947e6bcde3182225418e06eaaad3370e9b4b656` — 406 records.
- `lookup-catalog.json`: `d938a00eeb4eb6b5f10e7328af6a36306e4107639d4023905c1a3ebac0f1c6d6`.
- `lookup-manifest.json`: `d1782c668c87cabb6e1df0b9844463b1ac9caf94e7b7fe0dad920616ad7ca8d5`.
- Catalog children: 90 equipment specials, 192 troop-mod options, 426 building levels.

Frozen baseline hashes remain `8c99a159c144000897025b98590617bfd9735d543ac4d458821dbc3e11029813` for 112 heroes and `f0e9be17bd1f36e8aba1e1ad3217504c42395aca57efdb3b2a1a7ee967e29834` for 240 tactics. Identity tests resolve every baseline Vietnamese name to its promoted canonical ID; no baseline hero/tactic identity or faction was lost.

## TDD and regressions

Phase 1 established private-source deny, immutable baseline, inventory and identity Reds. Phase 2 established precedence, translation fingerprint, child/DAG and deterministic captured-input Reds. Phase 3 established mixed-generation, publication, recovery, navigation, MCP-ingress and season-publisher Reds. The completed implementation turned each focused slice Green before broad validation; phase files contain the detailed Red/Green/Refactor record.

Phase 4 exposed and fixed three real contract gaps. Worker production test/direct
build allowlists omitted the coherent lookup sidecar pair; both now accept and
validate the pair while excluding it from emitted inventory. Filesystem MCP
ingress accepted extra/symlinked package content and lookup-enriched dictionaries
without sidecars; it now enforces exact package/root/file boundaries and rejects
the downgrade. The season publisher rechecked generation only after replacements
and skipped exclusion during first activation; it now holds exclusion
unconditionally and aborts before the first replacement. Each gap was first
captured by a failing regression.

Historical current-data assertions were moved to the immutable Phase 1 tactic
input. Season E2E controlled fixtures now publish a coherent lookup
manifest/catalog beside their fixture dictionaries instead of weakening the
application’s mixed-bundle rejection. Recommended browser tests use the tab
semantics implemented by integrated navigation. The responsive/theme suite now
opens and closes a profile for all six groups at every tested viewport/theme pair.

## Broad validation results

Observed from repository root unless noted:

- `python3 -m unittest discover -s tests`: 283 passed, 12 skipped.
- `npm run test:node`: 261 passed.
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: passed.
- `npm run test:dist`: 21 passed.
- `npm run verify`: 142 dist files and 47 raw assets verified.
- `npm run test:dev-contract`: 2 passed; exact JSON bytes and private-path denial remained Green.
- `npm run test:e2e:astro`: 102 passed using the actual Astro preview/Chromium surface.
- `npm --prefix mcp-worker run check`: 43 files, 373 tests passed with coverage, typechecks, build, node-min and control-plane verification.
- `npm --prefix mcp-worker run test:worker`: both configs passed (2 + 1 tests).

Earlier concurrent broad execution produced Astro start/test timeouts from competing local servers; isolated reruns passed without threshold changes. Those contention failures are not counted as test Reds. The MCP source allowlist failure was reproducible and fixed as described above.

## Boundary checks

- Public lookup inventory is exactly three payloads plus one lookup manifest; source/provenance objects remain private.
- Astro manifest and verifier keep every Recommended runtime/scoped route while adding lookup assets.
- Lookup/season hero and tactic bytes are pinned to one captured build snapshot. Interleaved HTML/data generations fail the verifier.
- Valid packaged MCP roots and coherent activated raw roots load through CLI/stdio. Partial, mixed, symlinked, tampered or in-progress roots fail with redacted `DATA_UNAVAILABLE` behavior.
- MCP emitted inventory remains manifest v1 (six artifacts) or v2 (eleven artifacts); lookup sidecars never become tool kinds or release artifacts.
- Shared writer exclusion applies even before the first lookup manifest exists. A generation change between initial observation and the final prewrite check aborts with zero seasonal replacements.
- Recovery refuses foreign edits and dependent-reference conflicts, including first activation against legacy target IDs, before restore. `phase3-final-2` is committed active evidence; `phase3-certified-first-activation` is the ignored/private interrupted-activation rehearsal with state `rolled-back`.

## Recommended compatibility disposition

Selected Recommended generation stays `20d85cbbc63d16b40a2b952c9a0ffad79ebfbd61c1bcf64495c0f0bb36206e5a`; its manifest hash stays `2ae1257f40b7cacf7c0ad9d1d42a7b80ff08e067dc3f511e25c7dc421efafea1`. `pipeline/recommended-identity-map.json` stays byte-identical at `8c83f699513d2e7e2fcef51bbe25c1159a638202ab0112b28374e6ed27d13750`.

The map’s evidence inputs intentionally name the frozen 112/240 baseline hashes. They are an immutable historical attestation, not an assertion that current dictionaries retain those hashes. Comparison found every baseline Vietnamese identity present, no faction change, and four Chinese display differences limited to spacing (`SP周瑜` → `SP 周瑜`, `SP朱儁` → `SP 朱儁`, `SP荀彧` → `SP 荀彧`, `SP郭嘉` → `SP 郭嘉`); normalized identity remains unchanged and the old form is equivalent under existing matching. Therefore no bridge re-review or Recommended regeneration was required.

Browser checks preserved Team chuẩn default, Team khác membership, source links, scoped selected bytes, legacy aliases and Back/Forward history. The lookup publisher must not rewrite or rehash the historical bridge merely to make its evidence hashes resemble current lookup hashes.

## Remaining release boundary

Local generation is accepted for branch handoff. No website deployment, Worker asset build from a clean exact SHA, production release, smoke against an exact deployed version, or production rollback was authorized or claimed.
