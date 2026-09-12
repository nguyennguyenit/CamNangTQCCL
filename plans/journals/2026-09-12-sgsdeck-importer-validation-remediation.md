---
title: SGSDeck importer validation remediation
date: 2026-09-12
summary: "Closed six validation gaps, migrated equipment to upstream IDs, and restored deterministic private snapshot gates."
---

# SGSDeck importer validation remediation

## What happened
A post-implementation review reproduced six importer gaps: self-consistent snapshot shrink, stale identity mappings, swapped general details, weak semantic checks, lost deferred equipment fields, and permissive source URLs. A final review also found equipment ID drift could bypass the shrink guard.

## Decision
Use zero-tolerance comparison against the last validated snapshot. Bind mappings to source ID and exact source name, bind general detail to list ID/name/slug, validate category semantics, parse inert Flight records with upstream equipment IDs, and enforce exact origin/path/query/resource-key rules. After the one-time equipment migration, compare every category by source ID.

## Evidence
Focused SGSDeck 37/37; Python 126/126; Node 145/145; Astro check clean; build, dist 10/10, verifier 36 files/33 raw assets; two offline rebuilds byte-identical; reviewer GO. Snapshot remains 805 parents and 708 children with 79 canonical refs and 57 linked equipment specials.

## Next steps
No implementation blocker. Keep the catalog private; any UI, MCP publication, deploy, or commit remains separate scope.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
