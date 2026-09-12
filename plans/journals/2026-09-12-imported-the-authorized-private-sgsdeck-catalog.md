---
title: Imported the authorized private SGSDeck catalog
date: 2026-09-12
summary: Imported and validated six SGSDeck catalogs while preserving the private boundary.
---

# Imported the authorized private SGSDeck catalog

## What happened

The project owner confirmed authorization to import the six SGSDeck catalogs. Kongming reopened the bulk gate for that exact scope. A bounded 224-resource acquisition captured six list pages, equipment specials, 176 general details, and 41 building details with allowlisted redirects, response limits, checksums, pacing, and atomic cache promotion.

The builder composed and validated a private snapshot in `data/sgsdeck/`: 805 parent records and 708 child records. General detail parsing whitelists game fields and excludes editorial prose and images. Building tables became 426 structured level rows. Equipment retained 90 specials as explicit children.

## Identity and limitations

Reviewed exact-Chinese mapping produced 79 canonical refs: 39 generals and 40 tactics. Uncertain identities remain null. `古錠刀` lacks quality/slot in the rendered source boundary; 33 specials have no matching equipment parent; 26 generals are list-only upstream. All limitations remain explicit instead of inferred.

## Verification

Focused SGSDeck tests passed 26/26; full Python 115/115; Node 145/145; all project gates passed. Two real offline rebuilds were byte-identical to each other and the accepted snapshot. Canonical dictionaries and public manifest hashes stayed unchanged. The public build emitted only the existing allowlisted assets and no SGSDeck route or artifact. Final review scored 9.5/10 with zero critical findings.

## Decision

The catalog remains private and outside UI, MCP, team/tier, deployment, and publication scope. No deployment or commit was performed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
