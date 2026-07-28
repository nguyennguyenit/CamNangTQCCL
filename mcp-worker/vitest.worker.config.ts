import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const TEST_BEARER = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TQCCL_MCP_BEARER_CURRENT: TEST_BEARER,
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.workerd.test.ts"],
  },
});

