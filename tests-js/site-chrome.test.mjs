// Unit test cho `syncLanguageSwitch` (js/site-chrome.js) bằng DOM giả tối thiểu (không có jsdom ở repo này): link đổi ngôn
// ngữ ghép query/hash của trang đang xem nhưng không bao giờ phát lại `from` của link chi tiết cũ, và khi không có `from`
// thì giữ NGUYÊN chuỗi query (không re-encode `%20`/`%3A`), vì E2E khóa href chính xác của các link này.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCATION_REPLACED_EVENT, syncLanguageSwitch } from "../js/site-chrome.js";

/** Link ngôn ngữ giả: `href` do layout phát; sự kiện được gọi tay qua `emit`. */
function languageLink(href) {
  const attributes = new Map([["href", href]]);
  const listeners = new Map();
  return {
    dataset: {},
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    addEventListener: (type, handler) => listeners.set(type, handler),
    emit: (type) => listeners.get(type)?.(),
  };
}

/** Trang ở `pageHref` với các link ngôn ngữ có href gốc `baseHrefs`; `go(url)` đổi URL trang như history API, `fire(type)` phát sự kiện lên window. */
function setup(pageHref, baseHrefs) {
  const links = baseHrefs.map(languageLink);
  const windowListeners = new Map();
  const windowTarget = { location: new URL(pageHref), addEventListener: (type, handler) => windowListeners.set(type, handler) };
  syncLanguageSwitch({ documentTarget: { querySelectorAll: () => links }, windowTarget });
  return {
    links,
    hrefs: () => links.map((link) => link.getAttribute("href")),
    go: (href) => { windowTarget.location = new URL(href); },
    fire: (type) => windowListeners.get(type)?.(),
  };
}

const KHAIHOANG = "/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/";

test("link đổi ngôn ngữ trên trang chi tiết giữ variant nhưng không phát lại from của link cũ", () => {
  const page = setup(`https://tqccl.com${KHAIHOANG}?variant=v&from=%2Fkhai-hoang%2F`, [KHAIHOANG, `/zh${KHAIHOANG}`, `/ja${KHAIHOANG}`]);
  assert.deepEqual(page.hrefs(), [`${KHAIHOANG}?variant=v`, `/zh${KHAIHOANG}?variant=v`, `/ja${KHAIHOANG}?variant=v`]);
  // from đứng đầu, đứng giữa, lặp nhiều lần: đều bị bỏ; khóa chỉ giống tên (`fromage`) và hash giữ nguyên.
  page.go(`https://tqccl.com${KHAIHOANG}?from=a&variant=v&from=b&fromage=1#top`);
  page.links[1].emit("pointerdown");
  assert.equal(page.links[1].getAttribute("href"), `/zh${KHAIHOANG}?variant=v&fromage=1#top`);
  // Chỉ có from thì không còn dấu `?` lẻ.
  page.go(`https://tqccl.com${KHAIHOANG}?from=%2Fkhai-hoang%2F`);
  page.links[2].emit("click");
  assert.equal(page.links[2].getAttribute("href"), `/ja${KHAIHOANG}`);
});

test("không có from thì query của trang được giữ đúng nguyên chuỗi, không re-encode", () => {
  const search = "?variant=a%20b&q=%3A%2F&id=tactic%3Aan-ui-quan-dan";
  const page = setup(`https://tqccl.com/doi-khac/tan-ngo-thuong/${search}#top`, ["/doi-khac/tan-ngo-thuong/", "/zh/doi-khac/tan-ngo-thuong/"]);
  assert.deepEqual(page.hrefs(), [`/doi-khac/tan-ngo-thuong/${search}#top`, `/zh/doi-khac/tan-ngo-thuong/${search}#top`]);
  // Trang không có query: href gốc nguyên vẹn, không thêm `?`.
  const plain = setup("https://tqccl.com/doi-chuan/", ["/doi-chuan/", "/zh/doi-chuan/"]);
  assert.deepEqual(plain.hrefs(), ["/doi-chuan/", "/zh/doi-chuan/"]);
});

test("link luôn ghép lại từ href gốc của layout, không cộng dồn query lần trước; link có query riêng hoặc khác origin giữ nguyên", () => {
  const page = setup("https://tqccl.com/doi-chuan/?q=a", ["/zh/doi-chuan/", "/zh/doi-chuan/?season=all", "https://other.example/zh/doi-chuan/"]);
  assert.deepEqual(page.hrefs(), ["/zh/doi-chuan/?q=a", "/zh/doi-chuan/?season=all", "https://other.example/zh/doi-chuan/"]);
  page.go("https://tqccl.com/doi-chuan/?q=b&view=bang#x");
  for (const link of page.links) link.emit("focus");
  assert.deepEqual(page.hrefs(), ["/zh/doi-chuan/?q=b&view=bang#x", "/zh/doi-chuan/?season=all#x", "https://other.example/zh/doi-chuan/"]);
});

test("trang tự bỏ `variant` khỏi URL rồi phát LOCATION_REPLACED_EVENT: link đổi ngôn ngữ theo ngay, không đợi tương tác", () => {
  const DETAIL = "/doi-khac/vu-sieu-binh/";
  const page = setup(`https://tqccl.com${DETAIL}?variant=v-1#top`, [`/zh${DETAIL}`, `/ja${DETAIL}`]);
  assert.deepEqual(page.hrefs(), [`/zh${DETAIL}?variant=v-1#top`, `/ja${DETAIL}?variant=v-1#top`]);
  page.go(`https://tqccl.com${DETAIL}#top`);
  page.fire(LOCATION_REPLACED_EVENT);
  assert.deepEqual(page.hrefs(), [`/zh${DETAIL}#top`, `/ja${DETAIL}#top`]);
});
