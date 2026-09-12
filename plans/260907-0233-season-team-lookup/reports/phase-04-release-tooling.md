# Local release tooling validation — 2026-09-12

Controller owns three release scripts, release evidence validation and their
tests. Data/handler/workflow generation belongs to the MCP agent. No deployment,
commit, real asset publication or clean-source bypass performed.

## Implemented contract

- Builder accepts exact legacy six or full eleven named artifacts. Partial
  seasonal input is rejected before replacing an accepted output directory.
- V2 emits twelve private asset files including manifest. Evidence schema stays
  v1: commit, Git tree, workflow, manifest and inventory digests remain binding.
  Manifest version chooses the exact artifact inventory; legacy canonical bytes
  and digest algorithm remain unchanged.
- Local verifier reads manifest first, checks exact file inventory and rejects
  symlink/directory/extra entries before verifying evidence. It reads all eleven
  v2 artifacts instead of silently reading six.
- Release verifier and rollback identity reader require discovery
  `manifestVersion` and the corresponding exact names/hashes. Both actual HTTP
  verifier paths run against v1 and v2 controlled snapshots.

## Red → Green

| Slice | Observed Red | Green |
|---|---|---|
| V2 builder/evidence | 2 behavioral failures: valid eleven-file source rejected and twelve-file digest rejected | Exact inventory, deterministic build/evidence and partial-preservation tests pass |
| Verification reader | 3 failures: read7 instead of12, accepted extra file, accepted symlink | Reads exact version inventory and rejects malformed directory |
| Discovery inventory | 5 failures: v2 rejected; mismatched/duplicate/unknown/version3 accepted | Strict version/name/hash comparison |
| Existing private catalog boundary | 2 failures: known private directory rejected for v1/v2 | Optional exact `sgsdeck` real/contained directory excluded without reading descendants; file/internal or external symlink/other directory/unknown file rejected |

Logs: `season-release-red.log`, `season-release-reader-red.log`,
`season-release-discovery-red.log`. The reader/helper extraction was a local
refactor before adding its behavioral tests; existing eight builder tests stayed
green. The additional v1/v2 HTTP verifier matrix is post-fix integration coverage,
not claimed as a separately observed Red.

`npm --prefix mcp-worker test -- test/release`: **72 passed, 10 files**.
See `phase-04-release-tests.log`. Full package/repository gates await consumer
completion and final workflow identity regeneration. Historical release fixtures
were not edited.

## Integration note

Current source contains unrelated WIP, so real CLI packaging must retain
`SOURCE_NOT_CLEAN`. Kongming approved recognizing the existing optional private
`data/sgsdeck/` directory to match the established Astro/private catalog policy.
Only that real, non-symlink, contained direct-child directory is excluded from
the source inventory comparison. Descendants are never enumerated/read/copied;
a dangling descendant sentinel does not affect output. Git cleanliness and
source commit/tree checks still cover tracked private changes. V1/v2 public
data identities and inventory digests remain unchanged when only that private
subtree is present. Evidence: `season-release-private-red.log` and Green above.
