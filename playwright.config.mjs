import { defineConfig, devices } from "@playwright/test";
import { FIXTURE_PORT, FIXTURE_SLUG } from "./scripts/design-canvas/bai-viet-fixture.mjs";

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
    // E2E không phụ thuộc mạng ngoài: Turnstile thật tải chậm trên CI làm xô layout đúng lúc test bấm.
    // Test cần widget tự stub bằng `page.route("https://challenges.cloudflare.com/**", …)`; route chạy trước DNS.
    launchOptions: { args: ["--host-resolver-rules=MAP challenges.cloudflare.com ~NOTFOUND"] },
  },
  webServer: [
    {
      // `--ignore-lock`: giữ preview ở foreground (từ Astro 7.2, preview tự chạy nền khi phát hiện AI agent) để Playwright quản lý vòng đời.
      command: `npm run build && npm run preview -- --ignore-lock --host 127.0.0.1 --port ${astroPort}`,
      url: `http://127.0.0.1:${astroPort}`,
      reuseExistingServer: false,
      // Lệnh trên chạy cả `astro build` (~30 s trên runner CI) trước khi preview lắng nghe.
      timeout: 120_000,
    },
    {
      // Dev server có bài viết mẫu cho trang bài viết chi tiết (build thường không có bài: blog lấy từ API cộng đồng lúc
      // build). Một tiến trình node chạy cả API `/api/posts` cục bộ lẫn `astro dev` (API lập trình), nên dừng tiến trình
      // là dừng cả hai; SIGTERM để script tự đóng dev server và API.
      command: `node scripts/design-canvas/bai-viet-fixture.mjs --port ${FIXTURE_PORT} --no-watch`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/bai-viet/${FIXTURE_SLUG}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
  ],
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
