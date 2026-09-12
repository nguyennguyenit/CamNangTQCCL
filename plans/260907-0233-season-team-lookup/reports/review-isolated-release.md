# Isolated Release Scope Review

Date: 2026-09-12
Reviewer: code-reviewer
Worktree: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`
Branch: `feat/season-team-lookup`
HEAD reviewed: `6993f060719e5b9e49677cb9c3a1fb6f8f041eb8`
Base recorded by release manifest: `f221c2f55b9f16d857e5785b7fcb7d25a19b705e`

## Scope

Read-only focused review of the isolated release assembly before durable feature commit. I did not re-review the whole season architecture already covered by the prior UI, MCP, shared-core, Recommended and release-tooling reviews.

Primary files reviewed:

- `plans/260907-0233-season-team-lookup/reports/release-preparation.md`
- `plans/260907-0233-season-team-lookup/reports/release-selection.json`
- `.gitattributes`
- `pipeline/sgsdeck_recommended.py`
- `tests/test_sgsdeck_recommended.py`
- `README.md`
- `docs/season-team-data.md`
- `plans/260907-0233-season-team-lookup/plan.md`
- final validation and hash logs under `plans/260907-0233-season-team-lookup/reports/`

Focus areas requested: selected closure, private catalog omission, README/link isolation, secret exposure, the Python 3.9 empty-query fix, public contract strictness, test deletion risk, legacy data hashes, and the added CSV whitespace metadata.

## Overall Assessment

Status: PASS for the bounded pre-commit release-scope review.

Score: 9/10
Critical count: 0
High count: 0
Medium count: 0
Low count: 0

The source boundary, executable compatibility fix, CSV metadata, and current staging state look correct for the authorized local feature commit. Full real asset packaging and repository release gates still belong after the feature commit, as planned.

## Findings

No open findings.

During review, the staged index initially failed `git diff --check --cached` because the whitespace-only report/log fixes and `.gitattributes` had not been staged yet. The current reviewed state has those updates staged and both diff checks pass:

```text
git diff --check
# exit 0

git diff --check --cached
# exit 0
```

## Scope Checks

- Selected closure: `release-selection.json` lists 159 selected files. Comparing actual changed files since `f221c2f` plus current status found all 159 selected paths present and zero selected paths missing.
- Exclusions: zero `excludedFiles` are present in the actual changed set. `git ls-files` and `git ls-files --others --exclude-standard` found no private catalog files under `data/sgsdeck/`, no private catalog importers, and no unrelated research-skill plan files in the isolated worktree.
- Current staged-not-selected paths: `.gitattributes`, `reports/release-preparation.md`, and `reports/release-selection.json`. These are release metadata outside the source-selection manifest; the current index stages them cleanly.
- Primary parity: selected files differ from the primary workspace only for README, several scope/link docs/reports, `pipeline/sgsdeck_recommended.py`, and `tests/test_sgsdeck_recommended.py`. The Python diff is exactly the empty-query guard; the test diff adds the strict URL/query regression.
- README isolation: the isolated README keeps season/Node documentation and removes private SGSDeck catalog commands and catalog/research docs links from the public docs list.
- Missing links: the eleven out-of-scope planning/doc links are converted to explicit text paths such as "tai lieu ngoai nhanh"; I did not find accidental live links to excluded planning artifacts in the scoped docs that were changed for this assembly.
- Secrets: selected-file scan found only documented placeholders such as `CLOUDFLARE_API_TOKEN='<read-token>'`; no committed bearer value, API token, private key, dotenv value, or credential literal was found.
- Tests: no tests were deleted relative to base. Base had 98 tracked test paths under `tests`, `tests-js`, `tests-e2e`, and `mcp-worker/test`; current checkout has 116 tracked test paths and 25 selected test paths.

## Python Fix Review

The release-only executable delta against the primary workspace is:

```diff
-    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
+    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True) if parsed.query else []
```

This preserves strict parsing for nonempty queries and only maps an absent query string to an empty list. The regression test accepts `/recommended`, detail URLs without query, and allowlisted list queries; it rejects missing values, blank values, duplicate keys, malformed separators, unknown keys, and query strings on detail URLs.

Fresh validation:

```text
python3 -m unittest tests.test_sgsdeck_recommended -v
# Ran 13 tests in 0.053s
# OK

AST parse:
# AST_OK pipeline/sgsdeck_recommended.py
# AST_OK tests/test_sgsdeck_recommended.py
```

## CSV Metadata Review

`.gitattributes` contains one exact path rule:

```text
plans/260907-0233-season-team-lookup/research/coexist-binh-dien-xuan-thu.csv -text whitespace=-blank-at-eol,cr-at-eol
```

`git check-attr` confirms `text: unset` and `whitespace: -blank-at-eol,cr-at-eol` for that path. The CSV hash is:

```text
838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb
```

I agree with preserving the raw export bytes here. The parser/test contract treats the CSV as checksum-bound source evidence, and the diff shows quoted multiline cells where normalization would be a data mutation rather than style cleanup. The `.gitattributes` rule is narrow and does not relax repository-wide whitespace checks.

## Existing Validation Evidence Checked

`final-validation.md` records local behavioral/build/type/artifact checks passing before the release gate stopped at the expected environment boundary: missing `mcp-worker/.worker-assets` for Wrangler dry-run and `SOURCE_NOT_CLEAN` for real asset build. It explicitly does not claim deploy or publication success.

Legacy artifact evidence remains intact:

```text
9/9 legacy artifact hashes unchanged
data/books-dict.json
data/coexist.json
data/facets.json
data/heroes-dict.json
data/khaihoang.json
data/tactics-generic.json
data/tactics.json
data/team-tier.json
data/teams.json
```

The final validation also records `npm run verify` passing for 43 dist files / 40 raw assets, `npm run check` with 0 Astro diagnostics, and root Python discovery at 187 passed. I did not rerun the long full repository gate per scope.

## Scout Findings

- Main edge case was commit assembly drift: the source working tree can pass `git diff --check` while the staged index still fails. This is now the only blocking finding.
- Empty Recommended query handling is narrowly fixed and covered; no loosening of token/unknown/duplicate/detail-query rejection found.
- Private catalog and unrelated research-skill artifacts are excluded from actual changed files.
- Public legacy data hashes are unchanged; no Khai hoang season split or score promotion was found in this bounded release assembly review.

## Recommended Actions

1. Proceed with the authorized local feature commit from the current staged index.
2. After the feature commit, run the planned real asset builder/verifier and complete repository gate from the clean committed source identity.
3. Treat `.gitattributes`, `release-preparation.md`, and `release-selection.json` as explicit release metadata outside the source-selection manifest unless the controller wants the manifest to be a strict all-staged-file list.

## Metrics

- Fresh focused Python: 13/13 passed.
- Fresh syntax check: Python AST parse passed for the adapter and test.
- Working-tree whitespace: `git diff --check` passed.
- Staged whitespace: `git diff --check --cached` passed.
- Test deletion check: 0 deleted tests relative to base.
- Secret scan: 0 real secret literals found in selected files.

## Unresolved Questions

- Is `release-selection.json` intended to be a strict all-staged-file manifest or only a source-selection manifest? Current staging treats `.gitattributes`, `release-preparation.md`, and `release-selection.json` as release metadata outside the selected source set.

Status: DONE
Summary: Release source scope and the Python 3.9 compatibility fix look sound, with private catalog/unrelated files excluded, legacy data hashes preserved, CSV byte policy staged, and both working-tree and staged diff checks passing.
Concerns/Blockers: None for this bounded pre-commit review. Full real asset packaging and repository release gates remain post-commit work.
