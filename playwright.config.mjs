import { defineConfig, devices } from "@playwright/test";

const legacyPort = 4173;

export default defineConfig({
  testDir: "./tests-e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${legacyPort}`,
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `python3 -m http.server ${legacyPort} --bind 127.0.0.1 --directory .`,
    url: `http://127.0.0.1:${legacyPort}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "legacy",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
