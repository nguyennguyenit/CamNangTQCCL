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
    // Mục đang xem: link phẳng hoặc mục trong menu thả — luôn kèm data-section + aria-current.
    assert.match(html, new RegExp(`class=["'][^"']*\\bactive\\b[^"']*["'][^>]*data-section=["']${section}["'][^>]*aria-current=["']page["']`));
  }

  assert.match(html, /id=["']section-menu-toggle["']/);
  assert.match(html, /aria-controls=["']section-menu-items["']/);
  assert.match(html, /aria-expanded=["']false["']/);
  assert.match(html, /id=["']section-menu-items["']/);
  // Một bộ điều khiển theme, hai nút: nút header và nút trong đầu menu mobile.
  assert.match(html, /id=["']theme-toggle["'][^>]*data-theme-toggle/);
  assert.match(html, /id=["']theme-toggle-menu["'][^>]*data-theme-toggle/);
  assert.equal((html.match(/data-theme-toggle/g) ?? []).length, 2);

  // Menu thả: mỗi nút có aria-controls trỏ tới panel đang ẩn (không có JS thì mọi mục vẫn vào được từ footer).
  const menuButtons = [...html.matchAll(/<button[^>]*data-dropdown-button[^>]*>/g)].map(([tag]) => tag);
  assert.ok(menuButtons.length >= 2, "desktop phải có ít nhất 2 menu thả (Công cụ, Game)");
  for (const tag of menuButtons) {
    const controls = tag.match(/aria-controls=["']([^"']+)["']/)?.[1];
    assert.ok(controls, `nút menu thả phải có aria-controls: ${tag}`);
    assert.match(html, new RegExp(`id=["']${controls}["'][^>]*hidden`));
    // Panel là danh sách link (disclosure), không phải `role=menu` ⇒ không khai aria-haspopup.
    assert.doesNotMatch(tag, /aria-haspopup/, `nút menu thả không được có aria-haspopup: ${tag}`);
  }

  // Footer dùng chung mọi pageKind: chip ngày build, cột link, dải Game chính thức, chữ credit đã duyệt.
  assert.match(html, /class=["'][^"']*site-footer/);
  assert.match(html, /class=["']footer-chip["'][^>]*>\s*<span[^>]*footer-dot[^>]*><\/span>Dữ liệu cập nhật \d{2}\/\d{2}\/\d{4}/);
  assert.match(html, /id=["']tai-game["']|href=["']\/#tai-game["']/);
  assert.match(html, /href=["']\/#nguon-du-lieu["']/);
  assert.match(html, /Được xây dựng bởi/);
  // Góp ý là kênh thật (hộp thoại gửi tới /api/feedback), không phải chữ giữ chỗ trỏ tới kênh chưa có.
  assert.match(html, /<button[^>]*data-feedback-open[^>]*aria-controls=["']feedback-dialog["'][^>]*hidden/);
  assert.match(html, /<dialog id=["']feedback-dialog["'][^>]*>\s*<form[^>]*data-feedback-form/);
  assert.doesNotMatch(html, /\[KÊNH LIÊN HỆ\]/);

  // Link ra ngoài mở tab mới luôn kèm cả hai giá trị rel; không dùng ảnh/logo nhà phát hành.
  const targetBlank = [...html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/g)].map(([tag]) => tag);
  assert.ok(targetBlank.length >= 17, `shell phải mở tab mới cho mọi link HTTP(S): ${targetBlank.length}`);
  for (const tag of targetBlank) {
    assert.match(tag, /href=["']https?:/i, `chỉ link HTTP(S) mới mở tab mới: ${tag}`);
    assert.match(tag, /rel=["'][^"']*noopener[^"']*["']/, `thiếu noopener: ${tag}`);
    assert.match(tag, /rel=["'][^"']*noreferrer[^"']*["']/, `thiếu noreferrer: ${tag}`);
  }
  // mailto không mở tab mới và không được gắn chữ ẩn "(mở tab mới)".
  const mailto = [...html.matchAll(/<a\b[^>]*href=["']mailto:[^"']*["'][^>]*>[\s\S]{0,400}?<\/a>/g)].map(([tag]) => tag);
  assert.ok(mailto.length >= 1, 'shell phải có link mailto CSKH');
  for (const tag of mailto) {
    assert.doesNotMatch(tag, /target=["']_blank["']/, `mailto không mở tab mới: ${tag}`);
    assert.doesNotMatch(tag, /mở tab mới/, `mailto không có chữ ẩn mở tab mới: ${tag}`);
  }
}
