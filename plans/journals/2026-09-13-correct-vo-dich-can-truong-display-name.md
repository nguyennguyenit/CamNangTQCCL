---
title: Correct Vo Dich Can Truong display name
date: 2026-09-13
summary: Canonical tactic rename verified locally; no deployment.
---

# Correct Vo Dich Can Truong display name

## Outcome

Renamed 刚勇无前 to Vô Địch Can Trường in the runtime dictionary, kept Cương Dũng Vô Tiền as searchable Han-Viet, removed its empty duplicate, and added the canonical build override. User-provided Vietnamese correction; no gameplay-effect changes.

## Verification

Regression failed before fix and passed after. 195 Node tests, 5 Python builder tests, Astro check, build, 13 dist tests and artifact verifier passed. Playwright checked all three lookup names on own temporary preview at port 4174; screenshot inspected, no page errors. Initial smoke assertion was corrected to accommodate existing fuzzy suggestions. Preview stopped.

## Scope

No active implementation plan for this small correction. Unrelated plan WIP untouched. No commit, push, or deployment. AgentWiki publish skipped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
