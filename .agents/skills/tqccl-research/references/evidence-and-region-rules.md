# Evidence and Region Rules

Use this reference while evaluating claims. The current source inventory and
source roles remain owned by the [project registry](../../../../docs/research-sources.md).
For mechanic compatibility, use only the linked
[Logic Sanity Checklist](../../tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md#logic-sanity-checklist).

## Claim Status Contract

Give every material claim exactly one status:

| Status | Meaning |
| --- | --- |
| **Đã đối chiếu** | The inspected evidence directly supports the claim in the stated scope, or two clearly identified project records have been reconciled. |
| **Phương án từ nguồn** | An inspected source proposes this build, setting, or interpretation, but the project has not established it as the selected truth. |
| **Chưa xác minh** | Evidence is missing, inaccessible, ambiguous, contradictory, or outside the stated scope. |

These statuses do not encode confidence tiers and must not be renamed. They are
independent of team tier, a source score, SGSDeck status, popularity, and Global
applicability. One document may support claims with different statuses.

## Evidence Record Per Claim

Record enough information to let another run locate the same evidence:

- claim text and status;
- direct URL or local project path;
- author or publisher when known;
- original publication date, repost date, and access date as separate fields;
- server/region, season, patch, and game version when known;
- preview, test, live, historical, or current state;
- exact article section, table row, image, frame, or timestamp;
- whether AI assistance or reposting is disclosed;
- whether the fact came from an external source, the user, project runtime, or
  agent inference.

Use `unknown` for unavailable fields. Do not infer missing metadata from page
language, domain, typography, or nearby unrelated content. A search-result
snippet may locate material but does not verify the underlying claim.

## Scope and Time

Resolve scope using the user's explicit current selection first, then the scope
settled in the conversation, then unknown. Conversation inheritance must name
both the inherited value and its provenance. Do not hardcode a season.

The date embedded in a historical test packet defines “now” for its claims. The
machine's current date is only the capture date. Do not reclassify an old packet
as current or attach a later season merely because the replay ran later.

Region applicability requires evidence about the relevant release, server, or
patch. Chinese, Japanese, Korean, English, and Vietnamese sources can corroborate
one another only when they are independent and describe compatible versions.
Different languages do not by themselves prove independence or applicability.

## SGSDeck and Other Source Proposals

SGSDeck is the project's Sách Giáo Khoa comparison point. Match the exact roster
and configuration before attaching an SGSDeck score or label. If there is no
inspected exact match, use the required phrase **chưa có mốc SGSDeck đã xác minh**.

State separately:

1. whether an exact SGSDeck baseline was verified;
2. which local or external source supplies the chosen default;
3. whether a score belongs to that exact configuration;
4. whether the configuration applies to the selected region and season.

Never transfer a score to a related roster. Never turn another team into an
SGSDeck “variant” just to fill the baseline. A 233乐园 configuration remains a
source proposal unless separately reconciled.

## Source Independence and Accessibility

A repost, translation, mirrored table, copied screenshot, or article citing the
same upstream record is not an independent confirmation. Trace the chain and
name the common origin when discoverable. AI-assisted content is not rejected
solely because it used AI; inspect its cited evidence and label the disclosure.

Do not claim to have read inaccessible media. For images and videos, record the
specific visual or spoken content actually inspected. If only a title, thumbnail,
description, or transcript fragment was accessible, state that exact boundary.

Numeric historical claims need an inspectable supporting URL and location. If a
number came only from the user or a frozen packet, label that provenance instead
of inventing an external citation.

## Configuration Integrity

Treat each source configuration as an indivisible record until comparison:

- phase or level window;
- main commander and sub-commanders;
- every tactic and its holder;
- troop type and formation;
- books;
- allocated stats and speed ordering;
- transition milestone and replacement owner;
- account, unlock, red-copy, or availability conditions;
- source score and sample size, if present.

Do not splice fields across sources. Compare differences explicitly. Similar
structure does not demonstrate that commanders, tactics, or scores substitute.
The first commander mentioned in a question is not proof of command position.
An incomplete roster is not a complete six-tactic build.

If a proposed tactic is invalid for the stated build, exclude it from all
actionable recommendation and fallback tables. Explain the rejection separately.
Do not publish it as an option and then retract it in later prose.

## Project State, Corrections, and Inference

Read topic-relevant dossiers and correction reports before relying on an older
claim. Then inspect current runtime data if the task asks what the application
contains today. Classify the result correctly:

- external evidence describes the game or source;
- user evidence describes the user's account or provided observation;
- runtime observation describes the current project artifact;
- agent inference connects facts but is not a new external confirmation.

When runtime and an old report disagree, report the difference and dates. Runtime
does not independently prove game mechanics. An old tier, local snapshot, current
runtime value, and SGSDeck value are separate records.

Correction history must preserve the old claim, new evidence, scope, replacement
conclusion, date, and report link. A later run reads the correction before
synthesis and must not silently revive the superseded claim.

## Regression Invariants

- Preserve a known sample size; do not reduce it to “some matches.”
- Preview or test-server evidence is not live-release evidence.
- Consecutive-match counts are not win rates unless wins and denominator support
  that calculation.
- A suspicious or model-like name is an unverified lead, not proven false.
- A source default and SGSDeck verification status are different conclusions.
- A historical value never becomes current because the host date changed.
- Missing source access, missing account context, or an execution omission is not
  automatically an instruction defect.
- A claim needing a URL remains unverified until that URL and location can be
  inspected.
- An inherited season must be stated with conversation provenance.
- External-call use is shared across child, raw, media, browser, and handoff
  operations for the same locked topic.

When evidence cannot resolve an invariant, choose **Chưa xác minh**, state the
gap, and stop at the active budget boundary.
