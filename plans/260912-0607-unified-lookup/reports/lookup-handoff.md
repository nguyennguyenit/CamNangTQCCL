# Unified lookup handoff

Date: 2026-09-13  
Disposition: accepted locally; ready for an authorized release workflow, not deployed.

## What changed

The site now has one `Tra cứu` tab for six groups: heroes, tactics, equipment/specials, advisors, troop modifications/options, and buildings/levels. `#heroes` and `#tactics` remain compatible aliases. Search is Vietnamese-diacritic-insensitive and includes reviewed Chinese/alias text; paging reaches records after the first 60. Profiles expose reviewed relations and child records without inventing missing links.

The active public generation is `lookup:de73c4ca235de9b4ba6dbc5679573a3bab623a93ea6b061f0d30ad5f12c101e8`:

- heroes `cbe815c7612550822f4731a50b5c060564fe54b3788a87fc4148523e6baa37f1` (202);
- tactics `d91c216163a9f73f59839d69e947e6bcde3182225418e06eaaad3370e9b4b656` (406);
- catalog `d938a00eeb4eb6b5f10e7328af6a36306e4107639d4023905c1a3ebac0f1c6d6` (114 equipment, 90 specials, 39 advisors, 16 troop mods, 192 options, 41 buildings, 426 levels);
- manifest `d1782c668c87cabb6e1df0b9844463b1ac9caf94e7b7fe0dad920616ad7ca8d5`.

Every frozen baseline identity is retained: 112 heroes and 240 tactics. Eleven approved field deltas applied to Hạ Hầu Đôn (shield S), Vương Nguyên Cơ (charm 80), Nhạc Tiến (speed 58), Trương Xuân Hoa (charm 75), Quan Ngân Bình (charm 79), Mã Vân Lộc (charm 75), Lỗ Túc (bow S), Lữ Mông (bow S), Lữ Linh Ỷ (charm 74), SP Lữ Mông (bow S), and Đổng Bạch (charm 77). Zero/false preservation is covered by the merge tests.

The identity registry contains 260 matched and 556 new parent decisions. There are no unresolved parent identities. Thirty-three equipment specials intentionally retain a null parent because the source evidence cannot prove a relationship. Stale Vietnamese translation fingerprints block rebuild/promotion; genuinely unavailable source text stays distinguishable from untranslated content.

## Consumer contracts handed off

- Season owner: use the promoted dictionary bytes and lookup generation under the shared exclusion. Recheck the generation while still holding the exclusion immediately before seasonal replacement. A publisher that validated G1 but resumes after rollback to G0 must abort before writing.
- Recommended owner: keep selected generation `20d85cbbc63d16b40a2b952c9a0ffad79ebfbd61c1bcf64495c0f0bb36206e5a`, manifest hash `2ae1257f40b7cacf7c0ad9d1d42a7b80ff08e067dc3f511e25c7dc421efafea1`, and identity-map hash `8c83f699513d2e7e2fcef51bbe25c1159a638202ab0112b28374e6ed27d13750` unchanged. Its frozen dictionary hashes are historical evidence, not current hashes; normalized identity/display/faction semantics remain compatible.
- MCP owner: coherent raw project roots may contain both lookup sidecars; valid packaged roots contain the MCP manifest plus exact v1/v2 artifact inventory and no website lookup sidecars. Website sidecars are validated at raw ingress but never emitted or exposed as new tools/kinds.
- Website owner: HTML season hashes, lookup manifest/routes and built hero/tactic bytes must come from the same captured publication snapshot. Preserve the scoped Recommended pin/routes and its attribution contract independently.

No consumer may use a catalog-only record to infer team membership, tier, score, ownership, availability or season applicability.

## Rebuild, activation and recovery

Operational commands and source boundaries are documented in
[`docs/unified-lookup.md`](../../../docs/unified-lookup.md). The candidate builder
is offline and deterministic. Promotion requires a reviewed candidate, an
activation manifest file whose sources resolve relative to its directory, and a
unique transaction ID. It writes a durable journal before shared code/data mutation.

Recovery location: `pipeline/lookup-output/transactions/<transaction-id>`.
`phase3-final-2` is committed active-generation evidence;
`phase3-certified-first-activation` is the genuine-baseline interrupted-activation
rehearsal with state `rolled-back`. Keep both private/ignored according to
retention policy. `recover` repairs interrupted transactions; it does not undo a
committed activation. Recovery checks destination postimages, preimages,
code/config/test ownership and dependent season refs before changing anything.
If unrelated WIP or dependent refs conflict, stop and coordinate; do not restore
files piecemeal or copy backups manually.

## Validation evidence

[`compatibility-validation.md`](compatibility-validation.md) records the final focused and broad commands. Final broad outcomes were 283 Python passes (12 skips), 261 Node passes, Astro check/build/dist/verify/dev contracts Green, 102 browser E2E passes, MCP check 373 passes plus build/typecheck/control-plane, and both Worker runtime suites Green.

The browser matrix covers 320/375/768/1280 widths, light/dark, all six groups, deep links, last paged results, profiles, modal focus/Escape, keyboard tabs/chips, Team chuẩn/Team khác, source links and Back/Forward. Privacy checks cover direct paths, `/@fs`, module/raw queries, symlinks and traversal while positive public/Recommended routes remain byte-exact.

## Release checklist

Before an authorized release:

1. Start from a clean exact commit and verify these hashes/generation again.
2. Run the repository commands in `docs/unified-lookup.md` and the MCP clean-source gate.
3. Build Worker assets only from the clean source root; never bypass the clean-source guard or replace historical v1 fixtures.
4. Exercise the release platform’s exact-version smoke and rollback procedure under separate authorization.
5. Record deployed version IDs and production observations in the owning deployment record.

This handoff does not authorize deploy, MCP release, production promotion or mutation of source-owned Recommended/team data.
