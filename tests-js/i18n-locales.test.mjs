import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LOCALE,
  L,
  LOCALES,
  LOCALE_HTML_LANG,
  LOCALE_INTL,
  LOCALE_LABEL,
  LOCALE_OG,
  LOCALE_PREFIX,
  SITE_LOCALES,
  contentLocaleIsVietnamese,
  currentLocale,
  formatNumber,
  htmlLang,
  isSiteLocale,
  localeFromPath,
  localePath,
  normalizeLocale,
  pick,
  stripLocale,
  withLocale,
} from "../js/i18n.js";
import * as routes from "../src/lib/locale-routes.ts";

test("danh sách locale: thứ tự khóa cứng, chỉ được nối thêm ở cuối", () => {
  // Biến thể của L()/pick() đi theo vị trí trong danh sách này: chèn giữa hoặc đổi thứ tự làm lệch mọi chuỗi.
  assert.deepEqual([...SITE_LOCALES], ["vi", "zh"]);
  assert.equal(SITE_LOCALES[0], DEFAULT_LOCALE);
  assert.ok(Object.isFrozen(SITE_LOCALES));
  assert.equal(LOCALES, SITE_LOCALES);
});

test("mọi bảng theo locale có đúng tập khóa SITE_LOCALES", () => {
  const tables = { LOCALE_PREFIX, LOCALE_HTML_LANG, LOCALE_INTL, LOCALE_OG, LOCALE_LABEL, HREFLANG: routes.HREFLANG, ROUTE_LOCALE_LABEL: routes.LOCALE_LABEL };
  for (const [name, table] of Object.entries(tables)) {
    assert.deepEqual(Object.keys(table), [...SITE_LOCALES], name);
    assert.ok(Object.isFrozen(table), `${name} phải bất biến`);
  }
  assert.equal(LOCALE_PREFIX[DEFAULT_LOCALE], "");
  for (const locale of SITE_LOCALES.slice(1)) assert.equal(LOCALE_PREFIX[locale], `/${locale}`);
});

test("giá trị bảng locale giữ đúng output hiện tại", () => {
  assert.deepEqual({ ...LOCALE_HTML_LANG }, { vi: "vi", zh: "zh-Hans" });
  assert.deepEqual({ ...LOCALE_INTL }, { vi: "vi-VN", zh: "zh-CN" });
  assert.deepEqual({ ...LOCALE_OG }, { vi: "vi_VN", zh: "zh_CN" });
  assert.deepEqual({ ...LOCALE_LABEL }, { vi: "Tiếng Việt", zh: "中文" });
});

test("normalizeLocale: theo mã ngôn ngữ chính, không khớp thì về vi", () => {
  assert.equal(normalizeLocale("zh"), "zh");
  assert.equal(normalizeLocale("zh-Hans"), "zh");
  assert.equal(normalizeLocale("zh-Hant"), "zh");
  assert.equal(normalizeLocale("ZH-cn"), "zh");
  assert.equal(normalizeLocale("zh_CN"), "zh");
  assert.equal(normalizeLocale("vi-VN"), "vi");
  for (const value of ["", null, undefined, "en", "fr-FR", "ja"]) assert.equal(normalizeLocale(value), "vi", String(value));
});

test("isSiteLocale và htmlLang", () => {
  for (const locale of SITE_LOCALES) assert.equal(isSiteLocale(locale), true);
  for (const value of ["", "en", "zh-Hans", null, undefined, "ja"]) assert.equal(isSiteLocale(value), false, String(value));
  assert.equal(htmlLang("zh"), "zh-Hans");
  assert.equal(htmlLang("vi"), "vi");
  assert.equal(htmlLang("lạ"), "vi");
});

test("contentLocaleIsVietnamese chỉ đúng với bản Việt", () => {
  assert.equal(contentLocaleIsVietnamese("vi"), true);
  for (const locale of SITE_LOCALES.filter((locale) => locale !== "vi")) assert.equal(contentLocaleIsVietnamese(locale), false);
  assert.equal(contentLocaleIsVietnamese(undefined), true);
});

test("localePath/stripLocale/localeFromPath cho mọi locale", () => {
  for (const locale of SITE_LOCALES) {
    const prefix = LOCALE_PREFIX[locale];
    assert.equal(localePath("/", locale), `${prefix}/`);
    assert.equal(localePath("/doi-chuan/x/", locale), `${prefix}/doi-chuan/x/`);
    assert.equal(localePath(`${prefix}/doi-chuan/`, locale), `${prefix}/doi-chuan/`);
    assert.equal(stripLocale(`${prefix}/tra-cuu/`), "/tra-cuu/");
    assert.equal(localeFromPath(`${prefix}/tra-cuu/`), locale);
    if (prefix) {
      assert.equal(stripLocale(prefix), "/");
      assert.equal(localeFromPath(prefix), locale);
    }
    // Đổi qua lại giữa mọi cặp locale.
    for (const other of SITE_LOCALES) assert.equal(localePath(localePath("/a/", locale), other), localePath("/a/", other));
  }
  assert.equal(localePath("https://example.com/x", "zh"), "https://example.com/x");
  assert.equal(localePath("//cdn/x", "zh"), "//cdn/x");
  assert.equal(localePath("#hash", "zh"), "#hash");
  assert.equal(stripLocale("/zhuge/"), "/zhuge/");
  assert.equal(localeFromPath("/zhuge/"), "vi");
  assert.equal(stripLocale(""), "/");
});

test("pick chọn biến thể theo vị trí locale, bỏ qua biến thể thừa", () => {
  assert.equal(pick("vi", "a", "b"), "a");
  assert.equal(pick("zh-Hans", "a", "b"), "b");
  assert.equal(pick("vi", "a", "b", "c"), "a");
  assert.equal(pick("zh", "a", "b", "c"), "b");
  // Giá trị undefined tường minh vẫn là một biến thể (trường dữ liệu có thể vắng).
  assert.equal(pick("zh", "a", undefined), undefined);
});

test("pick ném lỗi khi thiếu biến thể cho locale đang dùng", () => {
  assert.throws(() => pick("zh", "a"), /thiếu biến thể/);
  assert.throws(() => pick("vi"), /thiếu biến thể/);
  assert.equal(pick("vi", "a"), "a");
});

test("L dùng locale hiện tại (withLocale)", () => {
  assert.equal(currentLocale(), "vi");
  assert.equal(L("a", "b"), "a");
  assert.equal(withLocale("zh", () => L("a", "b")), "b");
  assert.throws(() => withLocale("zh", () => L("a")), /thiếu biến thể/);
});

test("formatNumber theo bảng Intl của locale", () => {
  assert.equal(formatNumber(12345, "vi"), new Intl.NumberFormat("vi-VN").format(12345));
  assert.equal(formatNumber(12345, "zh"), new Intl.NumberFormat("zh-CN").format(12345));
});

test("locale-routes: re-export danh sách, switchTargets, localizedHtmlPath, alternatePaths", () => {
  assert.equal(routes.SITE_LOCALES, SITE_LOCALES);
  assert.equal(routes.HREFLANG, LOCALE_HTML_LANG);
  assert.equal(Object.hasOwn(routes, "otherLocale"), false);
  assert.deepEqual(routes.switchTargets("vi"), ["zh"]);
  assert.deepEqual(routes.switchTargets("zh"), ["vi"]);
  for (const locale of SITE_LOCALES) {
    const targets = routes.switchTargets(locale);
    assert.deepEqual(targets, SITE_LOCALES.filter((other) => other !== locale));
    assert.equal(routes.localizedHtmlPath("doi-chuan/x/index.html", locale), locale === "vi" ? "doi-chuan/x/index.html" : `${locale}/doi-chuan/x/index.html`);
  }
  assert.deepEqual(routes.alternatePaths({ vi: "/bai-viet/a/", zh: "/zh/bai-viet/b/" }), [
    { hreflang: "vi", path: "/bai-viet/a/" },
    { hreflang: "zh-Hans", path: "/zh/bai-viet/b/" },
    { hreflang: "x-default", path: "/bai-viet/a/" },
  ]);
  assert.deepEqual(routes.mirroredAlternates("/zh/doi-chuan/"), [
    { hreflang: "vi", path: "/doi-chuan/" },
    { hreflang: "zh-Hans", path: "/zh/doi-chuan/" },
    { hreflang: "x-default", path: "/doi-chuan/" },
  ]);
  assert.deepEqual(routes.mirroredPaths("/zh/tra-cuu/"), { vi: "/tra-cuu/", zh: "/zh/tra-cuu/" });
  // Locale không có đường dẫn bị bỏ qua; x-default là bản đầu tiên theo thứ tự danh sách (bản Việt khi có).
  assert.deepEqual(routes.alternatePaths({ zh: "/zh/a/" }), [
    { hreflang: "zh-Hans", path: "/zh/a/" },
    { hreflang: "x-default", path: "/zh/a/" },
  ]);
  assert.deepEqual(routes.alternatePaths({}), []);
});
