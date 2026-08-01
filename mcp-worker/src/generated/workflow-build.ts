// Tệp được sinh bởi scripts/generate-workflow-build.ts. Không sửa thủ công.
export const WORKFLOW_BUILD_ID = "build:sha256:f2161b8ade98276c532316b11cd771e861fbbc5355fb3e07553495050d9acd15" as const;
export const WORKFLOW_SEMANTIC_FILES = [
  "js/analyze-map.js",
  "js/filters.js",
  "js/hanviet.js",
  "js/hero-identity.js",
  "js/match-dict.js",
  "js/roster-scan-map.js",
  "js/roster-scan-state.js",
  "js/team-recommend-engine.js",
  "mcp-worker/src/data/artifact-contracts.ts",
  "mcp-worker/src/data/data-source.ts",
  "mcp-worker/src/data/entity-identity.ts",
  "mcp-worker/src/data/snapshot-index.ts",
  "mcp-worker/src/domain/canonical-state.ts",
  "mcp-worker/src/domain/contracts.ts",
  "mcp-worker/src/domain/legacy-domain-adapter.ts",
  "mcp-worker/src/domain/normalization-service.ts",
  "mcp-worker/src/domain/recommendation-service.ts",
  "mcp-worker/src/research/research-contracts.ts",
  "mcp-worker/src/research/research-handlers.ts"
] as const;
export const WORKFLOW_BUILD_INPUTS = [
  ".node-version",
  "mcp-worker/package-lock.json",
  "mcp-worker/package.json",
  "mcp-worker/scripts/generate-workflow-build.ts",
  "mcp-worker/tsconfig.build.json",
  "mcp-worker/tsconfig.json",
  "mcp-worker/workflow-source-manifest.json"
] as const;
