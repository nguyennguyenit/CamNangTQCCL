// Hook nạp module của Node (`module.register`) cho một tiến trình con: nạp `js/i18n.js` với `SITE_LOCALES` có thêm `ja`
// (và bảng tiền tố/lang/Intl/og/nhãn của ja) khi branch chưa bật `/ja/`. Báo cáo gap ja (`scripts/report-ja-gaps.mjs`) và unit
// test hồ sơ ja dùng hook này để dựng đúng hồ sơ ja trước khi locale được bật. Khi `ja` đã có trong `SITE_LOCALES`, hook không
// đổi gì (mẫu thay thế không còn khớp), nên kết quả trước và sau khi bật ja là một.

const I18N_PATH = /\/js\/i18n\.js$/;
const LOCALE_LIST = "(['vi', 'zh'])";
const JA_TABLE_VALUES = Object.freeze({ PREFIX: "'/ja'", HTML_LANG: "'ja'", INTL: "'ja-JP'", OG: "'ja_JP'", LABEL: "'日本語'" });

/** Mã nguồn `js/i18n.js` với `ja` nối cuối danh sách locale và các bảng locale; đã có `ja` thì trả nguyên. */
export function withPreviewJa(source) {
  if (!source.includes(`SITE_LOCALES = Object.freeze(/** @type {const} */ ${LOCALE_LIST})`)) return source;
  let out = source.replace(LOCALE_LIST, "(['vi', 'zh', 'ja'])");
  for (const [name, value] of Object.entries(JA_TABLE_VALUES)) {
    out = out.replace(new RegExp(`(export const LOCALE_${name} = Object\\.freeze\\(\\{[^}]*?)\\s*\\}\\);`), `$1, ja: ${value} });`);
  }
  return out;
}

/** Hook `load`: chỉ đổi đúng `js/i18n.js` của repo. */
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.startsWith("file:") || !I18N_PATH.test(new URL(url).pathname)) return result;
  return { ...result, source: withPreviewJa(String(result.source)) };
}

/** Tham số dòng lệnh `node` để tiến trình con nạp hook này trước mọi module. */
export function previewLocaleNodeArgs() {
  return ["--import", `data:text/javascript,import{register}from"node:module";register(${JSON.stringify(import.meta.url)});`];
}
