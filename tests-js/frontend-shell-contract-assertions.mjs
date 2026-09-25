import assert from "node:assert/strict";

export const FRONTEND_SECTIONS = [
  "team-chuan",
  "team-khac",
  "coexist",
  "khaihoang",
  "lookup",
  "recruit-tracker",
  "analyze",
  "roster-recommend",
];

function attributeValues(html, attribute) {
  return [...html.matchAll(new RegExp(`${attribute}=["']([^"']+)["']`, "g"))]
    .map((match) => match[1]);
}

export function assertFrontendShellContract(html, {
  stylesheetPattern,
  scriptPattern,
  section = null,
} = {}) {
  assert.match(html, /<html[^>]+lang=["']vi["']/);
  // Landing mang đúng tên thương hiệu; trang mục thêm tên mục ở trước.
  assert.match(html, /<title>[^<]*Cẩm Nang Game Tam Quốc Chí - Chiến Lược<\/title>/);
  assert.match(html, /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.png["']/);
  assert.match(html, /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/);
  assert.match(html, stylesheetPattern);
  assert.match(html, scriptPattern);

  const tabSections = attributeValues(html, "data-section");
  const ids = new Set(attributeValues(html, "id"));
  assert.deepEqual(tabSections, FRONTEND_SECTIONS);
  assert.equal(new Set(tabSections).size, FRONTEND_SECTIONS.length);
  // Trang mục chỉ có đúng mount của mình; nav liệt kê đủ 8 đường dẫn.
  if (section) {
    assert.ok(FRONTEND_SECTIONS.includes(section), `unknown section ${section}`);
    assert.match(html, new RegExp(`<body[^>]+data-page-section=["']${section}["']`));
    assert.ok(ids.has(`section-${section}`), `missing mount for ${section}`);
    for (const other of FRONTEND_SECTIONS) {
      if (other !== section) assert.ok(!ids.has(`section-${other}`), `${section} must not mount ${other}`);
    }
    assert.match(html, new RegExp(`id=["']section-${section}["'][^>]+class=["']section active["']`));
    assert.match(html, new RegExp(`class=["']nav-tab active["'][^>]+data-section=["']${section}["'][^>]+aria-current=["']page["']`));
  }

  assert.match(html, /id=["']section-menu-toggle["']/);
  assert.match(html, /aria-controls=["']section-menu-items["']/);
  assert.match(html, /aria-expanded=["']false["']/);
  assert.match(html, /id=["']section-menu-items["']/);
  assert.match(html, /id=["']theme-toggle["']/);
}
