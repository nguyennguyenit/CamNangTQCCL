import { defineConfig, devices } from "@playwright/test";

const astroPort = 4174;

export default defineConfig({
  testDir: "./tests-e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: true,
  // CI chạy chậm hơn máy dev vài lần: thử lại một lần; reporter `line` vẫn liệt kê test "flaky" ở phần tổng kết.
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${astroPort}`,
    url: `http://127.0.0.1:${astroPort}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "astro",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: `http://127.0.0.1:${astroPort}`,
      },
    },
  ],
});
