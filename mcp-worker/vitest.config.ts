import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/**/*.workerd.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/data/**/*.ts",
        "src/domain/**/*.ts",
        "src/research/**/*.ts",
      ],
      exclude: ["src/**/*.d.ts", "src/generated/**"],
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
