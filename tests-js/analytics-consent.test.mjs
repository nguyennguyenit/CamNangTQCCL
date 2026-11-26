import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { ANALYTICS_CONFIG } from "../js/config.js";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_MS,
  CONSENT_VERSION,
  applyConsent,
  deleteAnalyticsCookies,
  getConsent,
  isAdminPath,
  isAnalyticsEnabled,
  parseStoredConsent,
  sanitizeParams,
  setConsent,
  track,
} from "../js/analytics.js";
import { initConsentBanner } from "../js/consent-banner.js";
import { ANALYTICS_LOADER_CONFIG, ANALYTICS_LOADER_SCRIPT } from "../src/lib/analytics-loader.ts";

const ID = ANALYTICS_CONFIG.measurementId;
const NOW = 1_800_000_000_000;

/** Cửa sổ giả: location + localStorage (có thể chặn) + document.cookie có jar thật + head ghi lại script được thêm. */
function fakeWindow(url, { stored = null, gtag = false, failStorage = false, cookies = {} } = {}) {
  const { hostname, pathname, href } = new URL(url);
  const store = new Map(stored === null ? [] : [[CONSENT_STORAGE_KEY, stored]]);
  const jar = new Map(Object.entries(cookies));
  const cookieWrites = [];
  const calls = [];
  const win = {
    location: { hostname, pathname, href },
    localStorage: {
      getItem(key) {
        if (failStorage) throw new Error("storage blocked");
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        if (failStorage) throw new Error("storage blocked");
        store.set(key, value);
      },
    },
    document: {
      get cookie() {
        return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
      },
      set cookie(line) {
        cookieWrites.push(line);
        const [pair] = line.split(";");
        const name = pair.split("=")[0].trim();
        if (/expires=Thu, 01 Jan 1970/u.test(line)) jar.delete(name);
        else jar.set(name, pair.split("=")[1] ?? "");
      },
      head: {
        appended: [],
        appendChild(node) {
          this.appended.push(node);
          return node;
        },
      },
      createElement: (tag) => ({ tag, async: false, src: "" }),
    },
  };
  if (gtag) win.gtag = (...args) => calls.push(args);
  return { win, store, jar, cookieWrites, calls };
}

/** Chạy hàm với `window` toàn cục giả (track/isAnalyticsEnabled mặc định đọc `window`). */
function withWindow(win, run) {
  globalThis.window = win;
  try {
    return run();
  } finally {
    delete globalThis.window;
  }
}

const json = (value) => JSON.parse(JSON.stringify(value));

test("parseStoredConsent chỉ nhận lựa chọn đúng phiên bản, đúng giá trị và còn hạn 12 tháng", () => {
  const parse = (value) => parseStoredConsent(typeof value === "string" ? value : JSON.stringify(value), NOW, CONSENT_TTL_MS, CONSENT_VERSION);
  assert.equal(parse({ v: 1, choice: "granted", at: NOW }), "granted");
  assert.equal(parse({ v: 1, choice: "denied", at: NOW - 1000 }), "denied");
  assert.equal(parse({ v: 1, choice: "granted", at: NOW - CONSENT_TTL_MS }), "granted", "đúng mốc hạn vẫn hợp lệ");
  assert.equal(parse({ v: 1, choice: "granted", at: NOW - CONSENT_TTL_MS - 1 }), null, "quá 12 tháng thì hỏi lại");
  assert.equal(CONSENT_TTL_MS, 365 * 24 * 60 * 60 * 1000);
  assert.equal(parse({ v: 2, choice: "granted", at: NOW }), null);
  assert.equal(parse({ v: 1, choice: "maybe", at: NOW }), null);
  assert.equal(parse({ v: 1, choice: "granted" }), null);
  assert.equal(parse({ v: 1, choice: "granted", at: "hôm qua" }), null);
  for (const raw of ["{hỏng", "null", "[]", '"granted"', "123"]) assert.equal(parse(raw), null, raw);
  assert.equal(parseStoredConsent(null, NOW, CONSENT_TTL_MS, CONSENT_VERSION), null);
  assert.equal(parseStoredConsent(undefined, NOW, CONSENT_TTL_MS, CONSENT_VERSION), null);
});

test("isAdminPath nhận /quan-tri/ ở mọi locale và chỉ chúng", () => {
  for (const path of ["/quan-tri/", "/quan-tri", "/quan-tri/x", "/zh/quan-tri/", "/zh/quan-tri", "/ja/quan-tri/", "/ja/quan-tri/y/"]) {
    assert.equal(isAdminPath(path), true, path);
  }
  for (const path of ["/", "/zh/", "/doi-chuan/", "/quan-tri-vien/", "/zh/doi-chuan/quan-tri/", "/ja/", "", null, undefined]) {
    assert.equal(isAdminPath(path), false, String(path));
  }
});

test("isAnalyticsEnabled cần đúng host, không phải trang quản trị và gtag đã được dựng", () => {
  const enabled = (url, gtag = true) => isAnalyticsEnabled(fakeWindow(url, { gtag }).win);
  assert.equal(enabled("https://tqccl.com/doi-chuan/"), true);
  assert.equal(enabled("https://tqccl.com/doi-chuan/", false), false);
  for (const host of ["localhost", "127.0.0.1", "tqccl.pages.dev", "www.tqccl.com", "preview.tqccl.pages.dev", "tqccl.com.evil.test"]) {
    assert.equal(enabled(`https://${host}/doi-chuan/`), false, host);
  }
  for (const path of ["/quan-tri/", "/zh/quan-tri/", "/ja/quan-tri/"]) assert.equal(enabled(`https://tqccl.com${path}`), false, path);
  assert.equal(isAnalyticsEnabled(null), false);
  assert.equal(isAnalyticsEnabled(undefined), false);
  assert.equal(isAnalyticsEnabled({}), false);
});

test("track import được trong Node và là no-op khi không có window", () => {
  assert.equal(typeof window, "undefined");
  assert.doesNotThrow(() => track("search", { search_term: "x" }));
});

test("track chỉ gửi sự kiện search (chữ người dùng gõ) khi đã đồng ý; sự kiện khác đi ở mọi trạng thái đồng ý", () => {
  const send = (options, name, params) => {
    const page = fakeWindow("https://tqccl.com/tra-cuu/tuong/", { gtag: true, ...options });
    withWindow(page.win, () => track(name, params));
    return page.calls;
  };
  const search = { search_term: "kiếm", lookup_group: "heroes" };
  const content = { content_type: "heroes", content_id: "hero:ma-sieu" };
  const states = {
    "chưa chọn": {},
    "từ chối": { stored: JSON.stringify({ v: 1, choice: "denied", at: Date.now() }) },
    "hết hạn": { stored: grant(Date.now() - CONSENT_TTL_MS - 60_000) },
    "sai phiên bản": { stored: JSON.stringify({ v: 2, choice: "granted", at: Date.now() }) },
    "dữ liệu hỏng": { stored: "{hỏng" },
    "storage bị chặn": { failStorage: true },
  };
  for (const [label, options] of Object.entries(states)) {
    assert.deepEqual(send(options, "search", search), [], `search bị bỏ khi ${label}`);
    assert.deepEqual(send(options, "select_content", content), [["event", "select_content", content]], `sự kiện khác vẫn đi khi ${label}`);
  }
  assert.deepEqual(send({ stored: grant() }, "search", search), [["event", "search", search]], "đã đồng ý thì search đi");
});

test("track chỉ gọi gtag('event', …) trên trang bật GA, với tham số đã làm sạch", () => {
  const prod = fakeWindow("https://tqccl.com/tra-cuu/tuong/", { gtag: true });
  withWindow(prod.win, () =>
    track("select_content", {
      content_type: "heroes",
      content_id: "hero:ma-sieu",
      team_count: 5,
      ok: false,
      nan: Number.NaN,
      inf: Number.POSITIVE_INFINITY,
      nothing: null,
      missing: undefined,
      nested: { email: "a@b.c" },
      list: ["a"],
      fn: () => 1,
      long: "x".repeat(300),
    }));
  assert.equal(prod.calls.length, 1);
  const [command, name, params] = prod.calls[0];
  assert.deepEqual([command, name], ["event", "select_content"]);
  assert.deepEqual({ ...params, long: params.long.length }, { content_type: "heroes", content_id: "hero:ma-sieu", team_count: 5, ok: false, long: 100 });

  withWindow(prod.win, () => track("feedback"));
  assert.deepEqual(prod.calls[1], ["event", "feedback", {}], "tham số mặc định là {}");
  withWindow(prod.win, () => track("", { a: 1 }));
  withWindow(prod.win, () => track(null, { a: 1 }));
  assert.equal(prod.calls.length, 2, "tên rỗng/không phải chuỗi bị bỏ");

  const silent = [
    "http://localhost:4174/tra-cuu/",
    "https://tqccl.pages.dev/tra-cuu/",
    "https://www.tqccl.com/tra-cuu/",
    "https://tqccl.com/quan-tri/",
    "https://tqccl.com/zh/quan-tri/",
    "https://tqccl.com/ja/quan-tri/",
  ];
  for (const url of silent) {
    // Đã đồng ý nhưng host/trang không bật GA: không sự kiện nào đi, kể cả search.
    const page = fakeWindow(url, { gtag: true, stored: grant() });
    withWindow(page.win, () => {
      track("select_content", { content_type: "heroes", content_id: "hero:ma-sieu" });
      track("search", { search_term: "kiếm", lookup_group: "heroes" });
    });
    assert.deepEqual(page.calls, [], url);
  }
  const noGtag = fakeWindow("https://tqccl.com/tra-cuu/", { stored: grant() });
  assert.doesNotThrow(() => withWindow(noGtag.win, () => track("search", { search_term: "kiếm" })));
});

test("track không bao giờ ném lỗi, kể cả khi gtag hay tham số làm hỏng", () => {
  const throwing = fakeWindow("https://tqccl.com/tra-cuu/");
  throwing.win.gtag = () => {
    throw new Error("gtag hỏng");
  };
  assert.doesNotThrow(() => withWindow(throwing.win, () => track("filter_change", { filter: "view", filter_value: "bang" })));
  const hostile = fakeWindow("https://tqccl.com/tra-cuu/", { gtag: true });
  const params = {};
  Object.defineProperty(params, "boom", { enumerable: true, get() { throw new Error("getter hỏng"); } });
  assert.doesNotThrow(() => withWindow(hostile.win, () => track("filter_change", params)));
  assert.doesNotThrow(() => withWindow({ location: null }, () => track("search")));
});

test("sanitizeParams giữ chuỗi, số hữu hạn và boolean", () => {
  assert.deepEqual(sanitizeParams({ a: "x", b: 1, c: true, d: null, e: undefined, f: {}, g: [], h: Number.NaN, i: 0, j: "" }), { a: "x", b: 1, c: true, i: 0, j: "" });
  assert.deepEqual(sanitizeParams(null), {});
});

test("setConsent ghi lựa chọn, báo Consent Mode chỉ với analytics_storage và getConsent đọc lại", () => {
  const page = fakeWindow("https://tqccl.com/doi-chuan/", { gtag: true });
  assert.equal(getConsent(page.win, NOW), null);
  assert.equal(setConsent("granted", page.win, NOW), true);
  assert.deepEqual(JSON.parse(page.store.get(CONSENT_STORAGE_KEY)), { v: 1, choice: "granted", at: NOW });
  assert.deepEqual(page.calls, [["consent", "update", { analytics_storage: "granted" }]]);
  assert.equal(getConsent(page.win, NOW + 1000), "granted");
  assert.equal(getConsent(page.win, NOW + CONSENT_TTL_MS + 1), null, "hết hạn sau 12 tháng");

  assert.equal(setConsent("denied", page.win, NOW + 5), true);
  assert.equal(getConsent(page.win, NOW + 6), "denied");
  assert.deepEqual(page.calls.at(-1), ["consent", "update", { analytics_storage: "denied" }]);
  for (const call of page.calls) assert.deepEqual(Object.keys(call[2]), ["analytics_storage"], "quảng cáo không bao giờ được cấp");
});

test("setConsent từ chối giá trị lạ và trang không bật GA, không ghi gì", () => {
  const page = fakeWindow("https://tqccl.com/doi-chuan/", { gtag: true });
  assert.equal(setConsent("maybe", page.win, NOW), false);
  assert.equal(setConsent(undefined, page.win, NOW), false);
  assert.equal(page.store.size, 0);
  assert.deepEqual(page.calls, []);
  for (const url of ["http://localhost:4174/", "https://tqccl.com/quan-tri/", "https://tqccl.pages.dev/"]) {
    const off = fakeWindow(url, { gtag: true });
    assert.equal(setConsent("granted", off.win, NOW), false, url);
    assert.equal(off.store.size, 0, url);
    assert.deepEqual(off.calls, [], url);
  }
});

test("storage bị chặn: setConsent vẫn áp lựa chọn cho lần xem này và getConsent trả null", () => {
  const page = fakeWindow("https://tqccl.com/doi-chuan/", { gtag: true, failStorage: true });
  assert.equal(getConsent(page.win, NOW), null);
  assert.equal(setConsent("granted", page.win, NOW), true);
  assert.deepEqual(page.calls, [["consent", "update", { analytics_storage: "granted" }]]);
});

test("rút lại đồng ý xoá cookie _ga* ở mọi biến thể domain và giữ cookie khác", () => {
  const page = fakeWindow("https://tqccl.com/doi-chuan/", {
    gtag: true,
    cookies: { _ga: "GA1.1.1.2", [`_ga_${ID.slice(2)}`]: "GS2.1.s1", _gid: "x", _gat: "1", session: "keep", ga: "keep2" },
  });
  deleteAnalyticsCookies(page.win);
  assert.deepEqual([...page.jar.keys()].sort(), ["_gat", "_gid", "ga", "session"]);
  const domains = new Set(page.cookieWrites.map((line) => line.match(/;domain=([^;]*)/u)?.[1] ?? "(host)"));
  assert.deepEqual([...domains].sort(), ["(host)", ".tqccl.com", "tqccl.com"]);
  assert.ok(page.cookieWrites.every((line) => /path=\//u.test(line) && /expires=Thu, 01 Jan 1970/u.test(line)));

  const again = fakeWindow("https://tqccl.com/doi-chuan/", { gtag: true, cookies: { _ga: "1", _ga_X: "2", keep: "3" } });
  assert.equal(setConsent("denied", again.win, NOW), true);
  assert.deepEqual([...again.jar.keys()], ["keep"], "Từ chối xoá cookie GA");
  const kept = fakeWindow("https://tqccl.com/doi-chuan/", { gtag: true, cookies: { _ga: "1" } });
  setConsent("granted", kept.win, NOW);
  assert.deepEqual([...kept.jar.keys()], ["_ga"], "Đồng ý không xoá cookie");
  const applied = fakeWindow("https://tqccl.com/", { gtag: true, cookies: { _ga: "1" } });
  applyConsent("denied", applied.win);
  assert.deepEqual([...applied.jar.keys()], [], "applyConsent denied cũng xoá cookie");
  assert.doesNotThrow(() => deleteAnalyticsCookies({}));
  assert.doesNotThrow(() => deleteAnalyticsCookies(null));
});

test("cấu hình loader lấy id và host từ js/config.js, đủ đường dẫn quản trị của mọi locale", () => {
  assert.match(ID, /^G-[A-Z0-9]{6,}$/u);
  assert.deepEqual([...ANALYTICS_LOADER_CONFIG.hosts], ["tqccl.com"]);
  assert.deepEqual([...ANALYTICS_LOADER_CONFIG.adminPaths], ["/quan-tri/", "/zh/quan-tri/", "/ja/quan-tri/"]);
  assert.equal(ANALYTICS_LOADER_CONFIG.storageKey, "analyticsConsent");
  assert.equal(ANALYTICS_LOADER_CONFIG.ttlMs, CONSENT_TTL_MS);
  assert.equal(ANALYTICS_LOADER_CONFIG.version, 1);
  assert.ok(ANALYTICS_LOADER_SCRIPT.includes(ID));
  assert.doesNotMatch(ANALYTICS_LOADER_SCRIPT, /=>|\bconst\b|\blet\b|`/u, "script inline giữ cú pháp ES5");
});

/** Chạy đúng chuỗi script inline trong vm với cửa sổ giả; trả `dataLayer` (đã chuẩn hoá thành JSON) và script được thêm. */
function runLoader(url, options = {}) {
  const page = fakeWindow(url, options);
  vm.runInNewContext(ANALYTICS_LOADER_SCRIPT, { window: page.win });
  return {
    page,
    gtag: typeof page.win.gtag,
    entries: page.win.dataLayer ? json(page.win.dataLayer.map((entry) => Array.from(entry))) : null,
    scripts: page.win.document.head.appended,
  };
}

const grant = (at = Date.now()) => JSON.stringify({ v: 1, choice: "granted", at });

test("loader trên tqccl.com: consent mặc định từ chối → js → config (không tự gửi page_view) → page_view tường minh → nạp gtag.js", () => {
  const url = "https://tqccl.com/doi-chuan/?utm_source=newsletter&gclid=abc123";
  const { entries, scripts, gtag } = runLoader(`${url}#tqccl-migrate=abc`);
  assert.equal(gtag, "function");
  assert.deepEqual(entries.map((entry) => entry.slice(0, 2)), [["consent", "default"], ["js", entries[1][1]], ["config", ID], ["event", "page_view"]]);
  assert.deepEqual(entries[0][2], { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500 });
  assert.match(entries[1][1], /^\d{4}-\d{2}-\d{2}T/u, "gtag('js', new Date())");
  assert.deepEqual(entries[2][2], { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  assert.deepEqual(entries[3][2], { page_location: url }, "URL chụp ở <head>, giữ utm_*/gclid mà js/app.js gỡ sau đó, bỏ #fragment như gtag.js");
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].tag, "script");
  assert.equal(scripts[0].async, true);
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${ID}`);
});

test("loader áp lựa chọn đã lưu: chỉ granted còn hạn mới gửi update, ngay sau mặc định và trước config", () => {
  const granted = runLoader("https://tqccl.com/doi-chuan/", { stored: grant() });
  assert.deepEqual(granted.entries.map((entry) => entry.slice(0, 2)).map((pair) => pair.join(":")), ["consent:default", "consent:update", `js:${granted.entries[2][1]}`, `config:${ID}`, "event:page_view"]);
  assert.deepEqual(granted.entries[1][2], { analytics_storage: "granted" }, "ad_* không bao giờ được cấp");

  const none = [
    ["denied", JSON.stringify({ v: 1, choice: "denied", at: Date.now() })],
    ["hết hạn", grant(Date.now() - CONSENT_TTL_MS - 60_000)],
    ["sai phiên bản", JSON.stringify({ v: 2, choice: "granted", at: Date.now() })],
    ["hỏng", "{hỏng"],
    ["trống", null],
  ];
  for (const [label, stored] of none) {
    const result = runLoader("https://tqccl.com/doi-chuan/", { stored });
    assert.equal(result.entries.filter((entry) => entry[0] === "consent" && entry[1] === "update").length, 0, label);
    assert.equal(result.entries.length, 4, label);
  }
});

test("loader vẫn dựng gtag khi storage bị chặn (mặc định từ chối)", () => {
  const result = runLoader("https://tqccl.com/doi-chuan/", { failStorage: true });
  assert.equal(result.entries.length, 4);
  assert.equal(result.entries[0][1], "default");
  assert.equal(result.scripts.length, 1);
});

test("loader không dựng gì ngoài domain chính và trên trang quản trị", () => {
  for (const url of [
    "http://localhost:4174/doi-chuan/",
    "http://127.0.0.1:4174/doi-chuan/",
    "https://tqccl.pages.dev/doi-chuan/",
    "https://www.tqccl.com/doi-chuan/",
    "https://tqccl.com.evil.test/doi-chuan/",
    "https://tqccl.com/quan-tri/",
    "https://tqccl.com/quan-tri",
    "https://tqccl.com/zh/quan-tri/",
    "https://tqccl.com/ja/quan-tri/",
  ]) {
    const result = runLoader(url, { stored: grant() });
    assert.equal(result.entries, null, url);
    assert.equal(result.gtag, "undefined", url);
    assert.deepEqual(result.scripts, [], url);
  }
});

test("loader giữ dataLayer có sẵn và không bao giờ ném lỗi vào trang", () => {
  const page = fakeWindow("https://tqccl.com/doi-chuan/");
  page.win.dataLayer = [["set", "x"]];
  vm.runInNewContext(ANALYTICS_LOADER_SCRIPT, { window: page.win });
  assert.deepEqual(json(page.win.dataLayer[0]), ["set", "x"]);
  assert.equal(page.win.dataLayer.length, 5);
  for (const win of [{}, { location: null }, { location: { hostname: "tqccl.com", pathname: "/" } }]) {
    assert.doesNotThrow(() => vm.runInNewContext(ANALYTICS_LOADER_SCRIPT, { window: win }));
  }
});

/** DOM giả vừa đủ cho initConsentBanner: phần tử có hidden/thuộc tính/addEventListener/focus, <html> có style + thuộc tính. */
function fakeDom(url, options) {
  const page = fakeWindow(url, options);
  const listeners = [];
  const state = { active: null };
  const element = (extra = {}) => ({
    hidden: true,
    focused: 0,
    handlers: {},
    attrs: new Map(),
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    focus() {
      this.focused += 1;
      state.active = this;
    },
    setAttribute(name, value) {
      this.attrs.set(name, String(value));
    },
    removeAttribute(name) {
      this.attrs.delete(name);
    },
    getAttribute(name) {
      return this.attrs.get(name) ?? null;
    },
    ...extra,
  });
  const choiceButton = element();
  const banner = element({ offsetHeight: 90, contains: (node) => node === banner || node === choiceButton });
  const opener = element({ attrs: new Map([["aria-expanded", "false"]]) });
  const main = element();
  const root = {
    attrs: new Map(),
    props: new Map(),
    setAttribute(name, value) {
      this.attrs.set(name, value);
    },
    removeAttribute(name) {
      this.attrs.delete(name);
    },
    style: {
      setProperty: (name, value) => root.props.set(name, value),
      removeProperty: (name) => root.props.delete(name),
    },
  };
  const doc = {
    documentElement: root,
    get activeElement() {
      return state.active;
    },
    getElementById: (id) => ({ "consent-banner": banner, "main-content": main })[id] ?? null,
    querySelectorAll: (selector) => (selector === "[data-consent-open]" ? [opener] : []),
  };
  page.win.addEventListener = (type, handler) => listeners.push([type, handler]);
  /** Bấm một nút trong thanh; `focused` mô phỏng trình duyệt có focus nút vừa bấm (Safari thì không). */
  const press = (choice, { focused = true } = {}) => {
    state.active = focused ? choiceButton : null;
    banner.handlers.click({ target: { closest: (selector) => (selector === "[data-consent-choice]" ? { dataset: { consentChoice: choice } } : null) } });
  };
  return { ...page, doc, banner, opener, main, root, listeners, state, press };
}

test("initConsentBanner: trang không bật GA giữ thanh và nút ẩn", () => {
  for (const url of ["http://localhost:4174/", "https://tqccl.com/quan-tri/"]) {
    const dom = fakeDom(url, { gtag: true });
    assert.equal(initConsentBanner({ doc: dom.doc, win: dom.win }), null, url);
    assert.equal(dom.banner.hidden, true, url);
    assert.equal(dom.opener.hidden, true, url);
  }
  const noLoader = fakeDom("https://tqccl.com/", { gtag: false });
  assert.equal(initConsentBanner({ doc: noLoader.doc, win: noLoader.win }), null, "chưa có gtag thì không hỏi đồng ý");
  assert.equal(initConsentBanner({ doc: { getElementById: () => null }, win: fakeWindow("https://tqccl.com/", { gtag: true }).win }), null);
});

test("initConsentBanner: hỏi khi chưa có lựa chọn, không cướp focus, ghi chiều cao cho CSS, nút footer báo thanh đang mở", () => {
  const dom = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true });
  assert.ok(initConsentBanner({ doc: dom.doc, win: dom.win }));
  assert.equal(dom.banner.hidden, false);
  assert.equal(dom.banner.focused, 0);
  assert.equal(dom.opener.hidden, false);
  assert.equal(dom.opener.getAttribute("aria-expanded"), "true");
  assert.equal(dom.root.attrs.get("data-consent-banner"), "open");
  assert.equal(dom.root.props.get("--consent-banner-height"), "90px");
});

test("initConsentBanner: Từ chối/Đồng ý ghi lựa chọn, ẩn thanh, gỡ dấu hiệu trên <html> và đưa focus tới vùng nội dung chính", () => {
  for (const choice of ["denied", "granted"]) {
    const dom = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true });
    initConsentBanner({ doc: dom.doc, win: dom.win });
    dom.press(choice);
    assert.equal(dom.banner.hidden, true);
    assert.equal(dom.root.attrs.has("data-consent-banner"), false);
    assert.equal(dom.root.props.has("--consent-banner-height"), false);
    assert.equal(dom.opener.getAttribute("aria-expanded"), "false");
    assert.deepEqual(dom.calls, [["consent", "update", { analytics_storage: choice }]]);
    assert.equal(JSON.parse(dom.store.get(CONSENT_STORAGE_KEY)).choice, choice);
    assert.equal(dom.opener.focused, 0, "lần hỏi đầu không có nút để trả focus");
    assert.equal(dom.main.focused, 1, "nút vừa bấm biến mất: focus tới vùng nội dung chính, không rơi về <body>");
    assert.equal(dom.main.getAttribute("tabindex"), "-1");
    dom.main.handlers.blur();
    assert.equal(dom.main.getAttribute("tabindex"), null, "tabindex tạm được gỡ khi focus đi chỗ khác");
  }
});

test("initConsentBanner: focus không nằm trong thanh (Safari không focus nút khi bấm) thì không kéo focus đi đâu", () => {
  const dom = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true });
  initConsentBanner({ doc: dom.doc, win: dom.win });
  dom.press("denied", { focused: false });
  assert.equal(dom.banner.hidden, true);
  assert.equal(dom.main.focused, 0);
  assert.equal(dom.main.getAttribute("tabindex"), null);
});

test("initConsentBanner: lựa chọn còn hạn giữ thanh ẩn; nút footer mở lại, focus vào thanh rồi trả về nút", () => {
  const dom = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true, stored: grant() });
  initConsentBanner({ doc: dom.doc, win: dom.win });
  assert.equal(dom.banner.hidden, true);
  assert.equal(dom.opener.hidden, false, "nút Cài đặt cookie vẫn hiện để đổi lựa chọn");
  assert.equal(dom.opener.getAttribute("aria-expanded"), "false");

  dom.opener.handlers.click();
  assert.equal(dom.banner.hidden, false);
  assert.equal(dom.banner.focused, 1);
  assert.equal(dom.opener.getAttribute("aria-expanded"), "true");
  dom.opener.handlers.click();
  assert.equal(dom.banner.hidden, true, "bấm lại nút khi thanh đang mở thì đóng, không ép chọn");
  assert.equal(dom.opener.getAttribute("aria-expanded"), "false");
  assert.equal(dom.opener.focused, 1);
  dom.opener.handlers.click();
  assert.equal(dom.banner.hidden, false);
  dom.press("denied");
  assert.equal(dom.banner.hidden, true);
  assert.equal(dom.opener.getAttribute("aria-expanded"), "false");
  assert.equal(dom.opener.focused, 2);
  assert.equal(dom.main.focused, 0, "đã có nút để trả focus thì không chuyển tới vùng nội dung chính");
  assert.equal(JSON.parse(dom.store.get(CONSENT_STORAGE_KEY)).choice, "denied");
});

test("initConsentBanner: bỏ qua click ngoài hai nút và đổi lựa chọn từ tab khác thì áp theo", () => {
  const dom = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true });
  initConsentBanner({ doc: dom.doc, win: dom.win });
  dom.banner.handlers.click({ target: { closest: () => null } });
  assert.equal(dom.banner.hidden, false);
  assert.deepEqual(dom.calls, []);

  const storage = dom.listeners.find(([type]) => type === "storage")[1];
  storage({ key: "theme" });
  assert.equal(dom.banner.hidden, false, "khóa khác bị bỏ qua");
  dom.store.set(CONSENT_STORAGE_KEY, grant());
  storage({ key: CONSENT_STORAGE_KEY });
  assert.equal(dom.banner.hidden, true);
  assert.equal(dom.opener.getAttribute("aria-expanded"), "false");
  assert.deepEqual(dom.calls, [["consent", "update", { analytics_storage: "granted" }]]);
});

test("initConsentBanner: dựng lại từ bfcache áp lựa chọn đã đổi ở trang khác, và không gửi lại lựa chọn gtag đã áp", () => {
  const dom = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true });
  initConsentBanner({ doc: dom.doc, win: dom.win });
  assert.deepEqual(dom.listeners.map(([type]) => type).sort(), ["pageshow", "storage"]);
  const pageshow = dom.listeners.find(([type]) => type === "pageshow")[1];
  dom.store.set(CONSENT_STORAGE_KEY, JSON.stringify({ v: 1, choice: "denied", at: Date.now() }));
  pageshow({ persisted: false });
  assert.equal(dom.banner.hidden, false, "tải mới (không phải bfcache) thì không làm gì");
  pageshow({ persisted: true });
  assert.equal(dom.banner.hidden, true);
  assert.deepEqual(dom.calls, [["consent", "update", { analytics_storage: "denied" }]]);

  const applied = fakeDom("https://tqccl.com/doi-chuan/", { gtag: true, stored: grant() });
  initConsentBanner({ doc: applied.doc, win: applied.win });
  applied.listeners.find(([type]) => type === "pageshow")[1]({ persisted: true });
  applied.listeners.find(([type]) => type === "storage")[1]({ key: null });
  assert.deepEqual(applied.calls, [], "gtag đã áp granted từ script <head>: không gửi update thừa");
});
