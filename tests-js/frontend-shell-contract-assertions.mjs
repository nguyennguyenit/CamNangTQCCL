import assert from "node:assert/strict";

export const FRONTEND_SECTIONS = [
  "team-chuan",
  "team-khac",
  "coexist",
  "khaihoang",
  "heroes",
  "tactics",
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
} = {}) {
  assert.match(html, /<html[^>]+lang=["']vi["']/);
  assert.match(html, /<title>Cẩm Nang Game Tam Quốc Chí - Chiến Lược<\/title>/);
  assert.match(html, /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.png["']/);
  assert.match(html, /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/);
  assert.match(html, stylesheetPattern);
  assert.match(html, scriptPattern);

  const tabSections = attributeValues(html, "data-section");
  const ids = new Set(attributeValues(html, "id"));
  assert.deepEqual(tabSections, FRONTEND_SECTIONS);
  assert.equal(new Set(tabSections).size, FRONTEND_SECTIONS.length);
  for (const section of FRONTEND_SECTIONS) {
    assert.ok(ids.has(`section-${section}`), `missing mount for ${section}`);
  }
  assert.match(html, /class=["']nav-tab active["'][^>]+data-section=["']team-chuan["']/);
  assert.match(html, /id=["']section-team-chuan["'][^>]+class=["']section active["']/);

  assert.match(html, /id=["']section-menu-toggle["']/);
  assert.match(html, /aria-controls=["']section-menu-items["']/);
  assert.match(html, /aria-expanded=["']false["']/);
  assert.match(html, /id=["']section-menu-items["']/);
  assert.match(html, /id=["']theme-toggle["']/);
}
