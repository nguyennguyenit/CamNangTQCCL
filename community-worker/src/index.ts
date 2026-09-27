// Entry Worker: fetch = Hono app; scheduled = cron dọn dẹp (src/cleanup.ts).
// Chỉ export default: workerd coi mọi named export của entry là handler.

import { createApp } from "./app";
import { cleanup } from "./cleanup";
import type { Env } from "./env";

const app = createApp();

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cleanup(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
