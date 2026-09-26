// Tệp được sinh bởi scripts/generate-workflow-build.ts. Không sửa thủ công.
export const WORKFLOW_BUILD_ID = "build:sha256b64:DGo-uPzbFB4gYegvPeWq1Rlsi0Av1rTl1hz1XKdYkzM" as const;
export const WORKFLOW_SEMANTIC_FILES = [
  "js/analyze-map.js",
  "js/filters.js",
  "js/hanviet.js",
  "js/hero-identity.js",
  "js/lookup-data.js",
  "js/match-dict.js",
  "js/season-context.js",
  "js/team-recommend-engine.js",
  "mcp-worker/src/data/artifact-contracts.ts",
  "mcp-worker/src/data/data-source.ts",
  "mcp-worker/src/data/entity-identity.ts",
  "mcp-worker/src/data/filesystem-data-source.ts",
  "mcp-worker/src/data/lookup-bundle.ts",
  "mcp-worker/src/data/public-snapshot-view.ts",
  "mcp-worker/src/data/snapshot-index.ts",
  "mcp-worker/src/domain/canonical-state.ts",
  "mcp-worker/src/domain/contracts.ts",
  "mcp-worker/src/domain/digest-encoding.ts",
  "mcp-worker/src/domain/legacy-domain-adapter.ts",
  "mcp-worker/src/domain/normalization-service.ts",
  "mcp-worker/src/domain/recommendation-service.ts",
  "mcp-worker/src/domain/season-domain-adapter.ts",
  "mcp-worker/src/domain/season-reference-projection.ts",
  "mcp-worker/src/research/research-contracts.ts",
  "mcp-worker/src/research/research-handlers.ts",
  "mcp-worker/src/research/validation-fields.ts"
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
