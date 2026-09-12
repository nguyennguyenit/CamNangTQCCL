---
title: "Node 24.20.0 runtime upgrade"
summary: "Selected and verified Node 24.20.0 locally while preserving Node 22 and unrelated work."
date: 2026-09-09
---

# Node 24.20.0 runtime upgrade

Node 24.20.0/npm 11.19.0 now resolve in new zsh and fish shells; Node 22 remains installed. Shared pin, bounded root/MCP engines and lock metadata align without dependency upgrades. Setup docs and the canonically generated MCP workflow fingerprint were updated.

Runtime build, type, unit, browser and Python checks passed; independent review found no blocking defect. [Validation](../260908-2011-node-24-runtime/reports/validation.md) records exact results. Production dry-run remains unverified: assets are absent and canonical generation requires clean source. Preserved unrelated WIP; no commit or deployment.

Existing shells require restart or explicit version selection. Fish rollback must also update/remove its explicit selector. Journal written locally because CLI storage resolved an ancestor project outside this repository. AgentWiki publish skipped.
