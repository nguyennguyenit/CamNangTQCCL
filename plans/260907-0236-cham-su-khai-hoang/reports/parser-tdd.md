# Parser TDD evidence

Date: 2026-09-07. Scope: historical HTML parser and pure payload helper only.

## Source fixture

`tests/fixtures/khaihoang-cham-su-source.html` preserves original text, rowspan and colspan for rows 0–54 of `Meta Team PK/Khai hoang.html`, removing presentation attributes. Its comment records provenance and the original Google Sheet URL. This historical HTML has six pairs; the newer CSV/runtime has eight. Group alternatives span the Lữ Mông/Giả Hủ pair and belong once in its note.

## Red

Tests and fixture were written before implementation. Command:

```sh
python3 -m unittest tests.test_parse_secondary.TestChamSu.test_main_teams_do_not_attach_right_table
```

Observed exit 1: `AssertionError: False is not true` at the assertion that main teams contain no `transforms`. This proves the existing erroneous attachment behavior, rather than an import/environment failure. Additional desired parser/payload tests were written in the same step; their missing symbols were not used as bug evidence.

## Green

- `python3 -m unittest tests.test_parse_secondary`: 9 passed, no skips.
- `python3 -m unittest discover -s tests`: 89 passed, no skips.

Coverage includes the six source pairs, exact first pair tactics and single group alternatives note, historical Lăng Thống tactic, schema/provenance, independent right-table grouping despite left-side data ending, absent/empty table, deterministic payload and unique IDs. Fixture tests never depend on ignored source HTML. The existing local-source tests still cover 11 main teams and five mines.

The left-boundary test is explicitly a perturbation derived from the real fixture, with left cells cleared after the first hero. Flattened span text only preserves origin alternatives so it does not invent duplicate group notes.

Implementation adds `parse_cham_su_teams` with right-header detection and right-side blank-row group boundaries; origin metadata prevents copying merged alternatives twice. IDs use normalized hero names. `build_khaihoang_payload(html_path)` returns all three fields without writing files or opening team/coexist source HTML; the full builder was not run. Main-team heroes and mines parsing otherwise remain unchanged.

No commit/deploy. No unresolved questions.

## Identity integration

Aligned IDs with the curated runtime convention: normalized group names without a `cham-su-` prefix (for example `lu-mong-gia-hu`). The same group now has the same identity across HTML and CSV snapshots. Updated assertion and reran `python3 -m unittest tests.test_parse_secondary`: 9 passed, no skips. No runtime data changed.
