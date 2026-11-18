// Danh sách locale mà Worker hiểu: nguồn duy nhất cho kiểu `WorkerLocale`, validator và bảng câu theo ngôn ngữ.
// Thêm ngôn ngữ = thêm vào danh sách này; các bảng `satisfies Record<WorkerLocale, …>` ở model.ts sẽ báo lỗi
// kiểu cho tới khi có câu tương ứng. Khoá `tests-js/worker-locales-parity.test.mjs` giữ danh sách này trùng
// `SITE_LOCALES` của site.

export const WORKER_LOCALES = ["vi", "zh", "ja"] as const;

export type WorkerLocale = (typeof WORKER_LOCALES)[number];

export function isWorkerLocale(value: unknown): value is WorkerLocale {
  return typeof value === "string" && (WORKER_LOCALES as readonly string[]).includes(value);
}
