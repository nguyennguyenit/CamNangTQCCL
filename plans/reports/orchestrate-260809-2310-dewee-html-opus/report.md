# Orchestrate report: dewee-only MCP bridge HTML

> Historical run record from 2026-08-09; checks below have not been rerun for archival. Raw execution logs, prompts, and runtime state remain local and are not part of this committed report. The HTML artifact remains under Git-ignored `_site/`.

## Result

- Job: `rewrite-dewee-only-html`
- Status: success
- Runtime: Claude CLI `2.1.221`
- Model: `claude-opus-5` (live probe passed)
- Capability / risk: C3 / R1 user-approved outside sandbox
- Artifact: `_site/showoff/dewee-mcp-bridge-fix/index.html`
- Producer cost: USD 2.6682865
- Producer duration: approximately 653 seconds
- Timeout or permission denial: none

## Independent audit

Arbiter: Codex, separate model family from the Claude producer.

Verdict: **pass after content corrections**.

The producer delivered the requested dewee-only page and did not touch dewee source or perform Git publication. The audit corrected four unsupported or overly strong formulations:

1. Narrowed the upstream correctness claim to the verified trace instead of all MCP servers.
2. Preserved existing success/error semantics while sharing extraction and rendering.
3. Replaced the unproved `byte-for-byte` promise with preservation of current text-only output.
4. Replaced a nondeterministic “agent does not retry” assertion with a deterministic integration-fixture expectation.

The visible project-specific path was also shortened so the page contains no TQCCL-specific recommendation or ownership section.

## Checks

- Content scan: no `TQCCL`, fallback recommendation, or corrected overclaim remains in the HTML.
- Scope: `_site/` is ignored by `.gitignore`; no stage, commit, push, branch, or PR was created.
- Browser: page loaded without console or page errors.
- Interaction: VI/EN and system/light/dark controls work; preference survives reload.
- Responsive: at 375 × 812, document and body widths equal 375 and no element overflows.
- Accessibility smoke check: skip link, landmark regions, heading hierarchy, button labels, and pressed states are exposed in the accessibility snapshot.
- Final SHA-256: `199ff6acda86aed753f2f3d02f777f297e7b9bc3f7f4687af33f90a8e535e0dd`.

## Reproduction

```sh
rg -n "TQCCL|byte-for-byte|không rẽ nhánh riêng|does not retry|không thử lại|đều hoạt động đúng" _site/showoff/dewee-mcp-bridge-fix/index.html
git check-ignore -v _site/showoff/dewee-mcp-bridge-fix/index.html
agent-browser --session dewee-audit open "file://$PWD/_site/showoff/dewee-mcp-bridge-fix/index.html"
agent-browser --session dewee-audit snapshot -i
agent-browser --session dewee-audit errors
agent-browser --session dewee-audit set viewport 375 812
```

## Unresolved questions

None for this HTML-only task. Implementing the dewee fix remains a separately authorized source-code change.
