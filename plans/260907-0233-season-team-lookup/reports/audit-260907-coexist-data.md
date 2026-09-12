# Cùng Tồn data contract: assumption and fact audit

Date: 2026-09-07. Scope: PLAN ONLY; phases 1–4 and actual data/source owners. No implementation, lint, build or test suite execution. The latest Khai hoang exclusion is preserved.

## Findings

No new consequential finding supported by the inspected evidence. This is a planning assessment, not an implementation pass or approval to publish.

## Evidence checked

- **Pinned source is real and matches the plan.** A read-only CSV inspection confirms 94 records, 10 columns, 5 group markers, 25 named team blocks and 75 hero rows. SHA-256 is `838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb`, as required by `phase-02-season-team-configurations.md:93`. Physical lines 165–177 contain the multiline coupled bow/cavalry example; `:198–203` and `:216–220` contain advisor requirements. Counts alone would not protect these fields, but phase 2 `:95,121–124` explicitly requires raw options, ordered slots, conditions and separate J semantics.
- **The new schema avoids the destructive legacy parser path.** `pipeline/parse_coexist.py:86–94` drops empty slots and assigns J to advisorSkill; `:100–110` groups by label only. The actual new CSV header at `research/coexist-binh-dien-xuan-thu.csv:5` calls J unit-tactic modification effects, and its `:4` label collides with `data/coexist.json:3`. Phase 2 `:24–34,93–97` instead owns the source payload in a discriminated sidecar, keeps fixed slots and uses source-scoped reviewed IDs. Reusing the old parser would violate explicit acceptance, rather than expose an unhandled planning assumption.
- **Fingerprint uniqueness is feasible for the legacy corpus inspected.** `data/coexist.json` contains 5 groups/25 nested teams without IDs; a read-only comparison of complete JSON group and team values found zero identical payloads within either collection. Thus phase 2 `:34` requiring a unique fingerprint match has no demonstrated blocker in this snapshot. Source labels cannot safely provide identity; phase 2 `:32,125` already forbids that and distinguishes durable reviewed keys from revision fingerprints. Reorder and edit cases are explicit. This does not claim that arbitrary future duplicate payloads can be auto-resolved.
- **Canonical normalization is gated separately from reference delivery.** `js/hero-identity.js:4–5,15–17,29–43` only recognizes spaced SP/CO prefixes and strips annotations. The CSV includes `SPĐổng Trác` at physical lines 51–65 and `Lữ Bố 40th` at 24–25. Phase 2 `:32–34,95,115` requires reviewed identity mapping before executable configurations while preserving raw reference labels. It therefore does not require the current identity helper to understand those labels automatically.
- **Scenario evidence does not masquerade as ruleset evidence.** Phase 1 `:39,49,71–74` separates user-confirmed scenario attribution from unknown ruleset and legacy unknown records. Phase 2 `:99` and phase 3 `:82–91` preserve reference-only versus verified-pair behavior. The CSV supplies no ruleset proof; the plan retains this as a data gap, not an inferred season number.
- **Previously reported readiness issue has an explicit repair contract.** Phase 2 `:101` now excludes unsupported/unknown/unmet mandatory conditions from executable portfolios, preserves diagnostics and disallows the experimental tier bypass. Its Red case specifies correct pair plus sufficient heroes/tactics but unknown advisor/S requirements. Phase 4 also carries that requirement into MCP. No new evidence warrants reopening the resolved finding. The v2 budget projector concern is likewise explicitly addressed in phase 4; this audit does not reclassify it as outstanding.

## Unresolved questions

Existing data gaps remain: exact ruleset, reviewed aliases for new variants/decorated tactics, source coupling relationships and J merged ownership. They block dependent canonical configurations, not the planned raw reference delivery. No new user decision is needed from this audit.

Status: DONE
Summary: No new data/schema feasibility finding. Source preservation, stable identity, provenance scope and meaningful Red cases are concretely bounded by the current plan.
Concerns/Blockers: Implementation and its promised behavioral tests remain pending; no runtime validation is claimed.
