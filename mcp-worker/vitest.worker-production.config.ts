import { resolve } from "node:path";

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

import { buildWorkerAssets, WORKER_SOURCE_ONLY_FILES } from "./scripts/build-worker-assets.js";
import { repositoryPublicationRoots } from "./src/data/publication-source-reader.js";
import { WORKFLOW_BUILD_ID } from "./src/generated/workflow-build.js";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      await buildWorkerAssets({
        dataRoot: resolve("../data"),
        outputDirectory: resolve("test/.worker-assets"),
        workflowBuildId: WORKFLOW_BUILD_ID,
        allowedSourceFiles: WORKER_SOURCE_ONLY_FILES,
        publication: repositoryPublicationRoots(resolve("../data")),
        readSourceState: async () => ({
          commitSha: "0".repeat(40),
          sourceTree: `git-tree:${"0".repeat(40)}`,
        }),
        assertCleanSource: async () => undefined,
      });
      return {
        wrangler: { configPath: "./wrangler.test-production.jsonc" },
        miniflare: {
          bindings: {
            TQCCL_MCP_BEARER_CURRENT:
              "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        },
      };
    }),
  ],
  test: {
    include: ["test/performance/**/*.workerd.test.ts"],
  },
});
