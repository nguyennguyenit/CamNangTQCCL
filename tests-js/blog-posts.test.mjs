import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchBlogPosts,
  relatedPosts,
  renderBlogMarkdown,
  translationOf,
  validatePostsPayload,
} from "../src/lib/blog-posts.ts";

const post = (overrides = {}) => ({
  id: "p1",
  slug: "doi-hinh-mua-moi",
  lang: "vi",
  translationKey: "mua-moi",
  title: "Đội hình mùa mới",
  description: "Tóm tắt đội hình mạnh đầu mùa.",
  bodyMarkdown: "## Mở đầu\n\nNội dung.",
  faq: [{ q: "Chơi đội nào?", a: "Đội Thục." }],
  tags: ["mùa mới"],
  coverImage: null,
  status: "published",
  author: { name: "Nguyên" },
  publishedAt: "2026-09-20T08:00:00.000Z",
  updatedAt: "2026-09-21T08:00:00.000Z",
  createdAt: "2026-09-19T08:00:00.000Z",
  ...overrides,
});

const ENV = { COMMUNITY_API_ORIGIN: "https://community.example" };
const respond = (body, init = {}) => async () =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200, ...init });

test("payload validation rejects bad slug, lang, status, dates and duplicates", () => {
  assert.equal(validatePostsPayload({ items: [post()] }).length, 1);
  const rejects = {
    "slug with uppercase": [post({ slug: "Doi-Hinh" })],
    "slug with path": [post({ slug: "../etc" })],
    "unknown lang": [post({ lang: "en" })],
    "draft leaked": [post({ status: "draft" })],
    "epoch date": [post({ publishedAt: 1760000000000 })],
    "empty title": [post({ title: "   " })],
    "javascript cover": [post({ coverImage: "javascript:alert(1)" })],
    "duplicate slug in one language": [post(), post({ id: "p2" })],
    "duplicate id": [post(), post({ slug: "khac", lang: "zh" })],
    "duplicate translationKey in one language": [post(), post({ id: "p2", slug: "khac" })],
  };
  for (const [label, items] of Object.entries(rejects)) {
    assert.throws(() => validatePostsPayload({ items }), /Blog posts payload invalid/u, label);
  }
  assert.throws(() => validatePostsPayload([post()]), /items/u);
  // Cùng slug ở hai ngôn ngữ là hợp lệ: vi và zh là hai URL khác nhau.
  assert.equal(validatePostsPayload({ items: [post(), post({ id: "p2", lang: "zh" })] }).length, 2);
});

test("build without COMMUNITY_API_ORIGIN publishes no posts and never calls the API", async () => {
  const posts = await fetchBlogPosts({
    env: {},
    fetchImpl: async () => {
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(posts, []);
});

test("build with COMMUNITY_API_ORIGIN fails closed on API errors and invalid payloads", async () => {
  await assert.rejects(fetchBlogPosts({ env: ENV, fetchImpl: respond({}, { status: 503 }) }), /HTTP 503/u);
  await assert.rejects(fetchBlogPosts({ env: ENV, fetchImpl: respond("<html>oops</html>") }), /not JSON/u);
  await assert.rejects(fetchBlogPosts({ env: ENV, fetchImpl: respond({ items: [post({ lang: "fr" })] }) }), /lang/u);
  await assert.rejects(
    fetchBlogPosts({ env: ENV, fetchImpl: async () => { throw new TypeError("fetch failed"); } }),
    /fetch failed/u,
  );
  await assert.rejects(fetchBlogPosts({ env: { COMMUNITY_API_ORIGIN: "ftp://x" }, fetchImpl: respond({ items: [] }) }), /http/u);
});

test("fetched posts are newest first with locale paths, headings and reading time", async () => {
  let requested;
  const posts = await fetchBlogPosts({
    env: ENV,
    fetchImpl: async (url) => {
      requested = String(url);
      return new Response(JSON.stringify({
        items: [
          post(),
          post({ id: "p2", slug: "moi-nhat", publishedAt: "2026-09-25T00:00:00.000Z", translationKey: null }),
          post({ id: "p3", lang: "zh", title: "新赛季阵容" }),
        ],
      }));
    },
  });
  assert.equal(requested, "https://community.example/api/posts");
  assert.deepEqual(posts.map((item) => item.path), ["/bai-viet/moi-nhat/", "/bai-viet/doi-hinh-mua-moi/", "/zh/bai-viet/doi-hinh-mua-moi/"]);
  assert.deepEqual(posts[0].headings, [{ depth: 2, id: "mo-dau", text: "Mở đầu" }]);
  assert.equal(posts[0].readingMinutes, 1);
  assert.equal(translationOf(posts[1], posts)?.path, "/zh/bai-viet/doi-hinh-mua-moi/");
  assert.equal(translationOf(posts[0], posts), null);
  // Liên quan: cùng ngôn ngữ, chung thẻ; bản dịch tiếng Trung không được tính.
  assert.deepEqual(relatedPosts(posts[1], posts).map((item) => item.id), ["p2"]);
});

test("markdown drops raw HTML, comments and unsafe URLs", () => {
  const { html } = renderBlogMarkdown([
    "Chữ <script>alert(1)</script> <img src=x onerror=alert(1)> <b onclick=\"x()\">đậm</b>",
    "",
    "<div onclick=\"evil()\">khối</div>",
    "",
    "<!-- ghi chú -->",
    "",
    "[xấu](javascript:alert(1)) [dữ liệu](data:text/html,x) ![ảnh](javascript:x)",
  ].join("\n"));
  assert.doesNotMatch(html, /<script|<div|<b\b|onerror|onclick|<!--|javascript:|data:/iu);
  assert.match(html, /<a>xấu<\/a>/u);
  assert.doesNotMatch(html, /<img/u);
});

test("markdown marks only off-site links as external and keeps same-site links in the tab", () => {
  const { html } = renderBlogMarkdown(
    "[ngoài](https://example.com/a) [trong](/doi-chuan/) [tuyệt đối](https://tqccl.com/tra-cuu/) [thư](mailto:a@b.vn) ![ảnh](/api/media/k1)",
  );
  assert.match(html, /<a href="https:\/\/example\.com\/a" rel="noopener noreferrer" target="_blank">ngoài<\/a>/u);
  assert.match(html, /<a href="\/doi-chuan\/">trong<\/a>/u);
  assert.match(html, /<a href="https:\/\/tqccl\.com\/tra-cuu\/">tuyệt đối<\/a>/u);
  assert.match(html, /<a href="mailto:a@b\.vn" rel="noopener noreferrer">thư<\/a>/u);
  assert.match(html, /<img src="\/api\/media\/k1" alt="ảnh" loading="lazy" decoding="async">/u);
});

test("markdown demotes h1, gives headings unique ids and lists h2/h3 for the table of contents", () => {
  const { html, headings } = renderBlogMarkdown("# Tựa\n\n## Mở đầu\n\n### Chi tiết 诸葛亮\n\n#### Sâu\n\n## Mở đầu\n\n## Blog FAQ\n");
  assert.doesNotMatch(html, /<h1/u);
  assert.deepEqual(headings.map(({ depth, id }) => [depth, id]), [
    [2, "tua"],
    [2, "mo-dau"],
    [3, "chi-tiet-诸葛亮"],
    [2, "mo-dau-2"],
    [2, "blog-faq-2"],
  ]);
  assert.match(html, /<h4 id="sau">Sâu<\/h4>/u);
});
