// Bảng chuyển tiếp hash cũ của Landing: mọi dòng trong bảng của phase 2 cộng hash thù địch.
// Hàm phải tự đủ vì `index.astro` nhúng nguyên mã nguồn vào script inline chặn trong <head>.

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLegacyRoute } from '../js/legacy-routes.js';

const ORIGIN = 'https://tqccl.pages.dev';
const SECTION_PATHS = new Set([
  '/doi-chuan/',
  '/doi-khac/',
  '/cung-ton/',
  '/khai-hoang/',
  '/tra-cuu/',
  '/theo-doi-chieu-mo/',
  '/soi-doi-tu-anh/',
  '/goi-y-doi-tu-kho/',
]);
const resolve = (href) => resolveLegacyRoute(href, ORIGIN);

/** Mọi đích phải là URL root-relative cùng origin và trỏ vào đúng một trang mục. */
function assertSectionTarget(target, expected) {
  assert.equal(target, expected);
  const url = new URL(target, ORIGIN);
  assert.equal(url.origin, ORIGIN, `đích phải cùng origin: ${target}`);
  assert.ok(SECTION_PATHS.has(url.pathname), `đích phải là trang mục: ${target}`);
}

test('mỗi hash cũ đi đúng trang mục mới', () => {
  assertSectionTarget(resolve('/#team-chuan'), '/doi-chuan/');
  assertSectionTarget(resolve('/#team-khac'), '/doi-khac/');
  assertSectionTarget(resolve('/#coexist'), '/cung-ton/');
  assertSectionTarget(resolve('/#khaihoang'), '/khai-hoang/');
  assertSectionTarget(resolve('/#recruit-tracker'), '/theo-doi-chieu-mo/');
  assertSectionTarget(resolve('/#analyze'), '/soi-doi-tu-anh/');
  assertSectionTarget(resolve('/#roster-recommend'), '/goi-y-doi-tu-kho/');
});

test('alias cũ giữ nguyên nguồn như canonicalizeSectionHash trước đây', () => {
  assertSectionTarget(resolve('/#team-pk'), '/doi-khac/?source=team-intro');
  assertSectionTarget(resolve('/#meta-cu'), '/doi-khac/?source=moi-phe');
});

test('hash Tra cứu chỉ mang group/id, gộp với query ngoài', () => {
  assertSectionTarget(resolve('/#lookup'), '/tra-cuu/');
  assertSectionTarget(resolve('/#lookup?group=heroes'), '/tra-cuu/?group=heroes');
  assertSectionTarget(resolve('/#lookup?group=heroes&id=hero%3Aluu-bi'), '/tra-cuu/?group=heroes&id=hero%3Aluu-bi');
  // Alias `#heroes`/`#tactics` thành `group` của trang Tra cứu.
  assertSectionTarget(resolve('/#heroes'), '/tra-cuu/?group=heroes');
  assertSectionTarget(resolve('/#tactics'), '/tra-cuu/?group=tactics');
  // Query ngoài đi tiếp; hash là nguồn cụ thể hơn cho `group`/`id`.
  assertSectionTarget(resolve('/?season=s26#lookup?group=tactics'), '/tra-cuu/?season=s26&group=tactics');
  assertSectionTarget(resolve('/?group=equipment#lookup?group=tactics'), '/tra-cuu/?group=tactics');
  // Khóa khác trong hash bị bỏ, không đi vào đích.
  assertSectionTarget(resolve('/#lookup?group=heroes&next=https%3A%2F%2Fevil.example'), '/tra-cuu/?group=heroes');
});

test('hash giữ tại chỗ để trình duyệt cuộn anchor', () => {
  for (const hash of ['#nguon-du-lieu', '#tai-game', '#dau-trang']) {
    assert.equal(resolve(`/${hash}`), null, `${hash} phải ở lại /`);
  }
});

test('không hash: chỉ query mang khóa root cũ mới suy ra Đội chuẩn', () => {
  assertSectionTarget(resolve('/?season=s26'), '/doi-chuan/?season=s26');
  assertSectionTarget(resolve('/?score=113'), '/doi-chuan/?score=113');
  assertSectionTarget(resolve('/?detail=cfg-1'), '/doi-chuan/?detail=cfg-1');
  assertSectionTarget(resolve('/?legacyTeam=team-intro-4&legacyVariant=v1'), '/doi-chuan/?legacyTeam=team-intro-4&legacyVariant=v1');
  assertSectionTarget(resolve('/?khTeam=a&khVariant=b'), '/doi-chuan/?khTeam=a&khVariant=b');
  // Chỉ khóa lạ hoặc URL rỗng thì ở lại Landing.
  assert.equal(resolve('/'), null);
  assert.equal(resolve('/?utm_source=x&fbclid=y'), null);
  // Khóa root cũ xuất hiện là đủ (kể cả giá trị rỗng) vì SPA cũ ghi hash cho mọi mục khác mặc định.
  assertSectionTarget(resolve('/?q='), '/doi-chuan/?q=');
});

test('query trước hash được giữ nguyên khi chuyển mục', () => {
  assertSectionTarget(resolve('/?season=s26#team-chuan'), '/doi-chuan/?season=s26');
  assertSectionTarget(resolve('/?config=x&legacyTeam=y#analyze'), '/soi-doi-tu-anh/?config=x&legacyTeam=y');
  // `URLSearchParams` mã hóa khoảng trắng thành `+` khi dựng lại query.
  assertSectionTarget(resolve(`/?q=${encodeURIComponent('mã siêu')}#khaihoang`), '/khai-hoang/?q=m%C3%A3+si%C3%AAu');
  assertSectionTarget(resolve('/?faction=Th%E1%BB%A5c#team-pk'), `/doi-khac/?faction=${encodeURIComponent('Thục')}&source=team-intro`);
});

test('hash khác và hash thù địch luôn ở lại Landing hoặc về đúng một trang mục', () => {
  const hostile = [
    '/#xyz',
    '/#lookup?id=javascript:alert(1)',
    '/#lookup//evil.example',
    '/#%2F%2Fevil.example',
    '/#lookup?group=x&next=https://evil.example',
    '/#lookup?group=javascript:alert(1)',
    '/#lookup?id=../../data/sgsdeck/index.json',
    '/#team-chuan//evil.example',
    '/#team-chuan?next=https%3A%2F%2Fevil.example',
    '/#heroes?group=javascript:alert(1)',
    '/#%23team-chuan',
    '/#team-chuan%0Ajavascript:alert(1)',
    '/?season=x#team-chuan%20%2F%2Fevil.example',
  ];
  for (const href of hostile) {
    const target = resolve(href);
    if (target === null) continue;
    const url = new URL(target, ORIGIN);
    assert.equal(url.origin, ORIGIN, `${href} rò khỏi origin: ${target}`);
    assert.ok(SECTION_PATHS.has(url.pathname), `${href} trỏ ngoài 8 trang mục: ${target}`);
    assert.equal(url.hash, '', `${href} không được giữ hash: ${target}`);
  }
  // Cụ thể: id không phải định danh hợp lệ vẫn nằm trong trang Tra cứu, không thành scheme.
  const lookup = resolve('/#lookup?id=javascript:alert(1)');
  assert.equal(new URL(lookup, ORIGIN).origin, ORIGIN);
  assert.equal(new URL(lookup, ORIGIN).pathname, '/tra-cuu/');
  assert.equal(new URL(lookup, ORIGIN).searchParams.get('id'), 'javascript:alert(1)');
  // Hash lạ ở lại nguyên URL.
  assert.equal(resolve('/#xyz'), null);
  assert.equal(resolve('/#lookup//evil.example'), null);
  assert.equal(resolve('/#%2F%2Fevil.example'), null);
});

test('tên thuộc tính kế thừa của Object không được coi là hash hợp lệ', () => {
  for (const name of [
    'constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty',
    'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'prototype',
  ]) {
    assert.equal(resolve(`/#${name}`), null, `#${name} phải ở lại Landing`);
    assert.equal(resolve(`/#${name}?group=heroes`), null, `#${name}?group=… phải ở lại Landing`);
    assert.equal(resolve(`/#${name}?id=hero%3Aluu-bi`), null, `#${name}?id=… phải ở lại Landing`);
    assert.equal(resolve(`/#${name}?source=team-intro`), null);
  }
  // Hash hợp lệ vẫn đi đúng đích sau khi thêm kiểm own-property.
  assertSectionTarget(resolve('/#heroes'), '/tra-cuu/?group=heroes');
  assertSectionTarget(resolve('/#team-chuan'), '/doi-chuan/');
  assertSectionTarget(resolve('/#team-pk'), '/doi-khac/?source=team-intro');
});

test('chỉ nhận URL cùng origin, phần còn lại trả null', () => {
  for (const href of [
    'https://evil.example/#team-chuan',
    'https://evil.example/',
    '//evil.example/#analyze',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'not a url',
    '',
    null,
    undefined,
    123,
    {},
  ]) {
    assert.equal(resolve(href), null, `phải từ chối ${String(href)}`);
  }
  // Cùng origin dạng tuyệt đối vẫn chuyển được.
  assertSectionTarget(resolve(`${ORIGIN}/#team-chuan`), '/doi-chuan/');
  // Origin rỗng vẫn dựng đích root-relative an toàn.
  assert.equal(resolveLegacyRoute('/#analyze'), '/soi-doi-tu-anh/');
  assert.equal(resolveLegacyRoute('https://evil.example/#analyze', ''), null);
});

test('hash trùng khóa group/id giữ nguyên số lần để parser Tra cứu báo lỗi', () => {
  assertSectionTarget(resolve('/#lookup?group=heroes&group=tactics'), '/tra-cuu/?group=heroes&group=tactics');
  assertSectionTarget(resolve('/#lookup?id=hero%3Aluu-bi&id=hero%3Atao-thao'), '/tra-cuu/?id=hero%3Aluu-bi&id=hero%3Atao-thao');
});

test('resolveLegacyRoute tự đủ để nhúng vào script inline của Landing', () => {
  // `index.astro` dùng `resolveLegacyRoute.toString()`; tham chiếu ra ngoài sẽ hỏng bản nhúng.
  const standalone = new Function(`return (${resolveLegacyRoute.toString()});`)();
  assert.equal(standalone('/#team-chuan', ORIGIN), '/doi-chuan/');
  assert.equal(standalone('/#lookup?group=heroes', ORIGIN), '/tra-cuu/?group=heroes');
  assert.equal(standalone('/#xyz', ORIGIN), null);
  // Bản nhúng cũng phải từ chối tên thuộc tính kế thừa (bảng tra own-property).
  assert.equal(standalone('/#constructor', ORIGIN), null);
  assert.equal(standalone('/#__proto__', ORIGIN), null);
  assert.equal(standalone('/#toString?group=heroes', ORIGIN), null);
  assert.equal(standalone('/?score=113', ORIGIN), '/doi-chuan/?score=113');
  // Bản nhúng không được kéo theo cú pháp module (import/export).
  assert.doesNotMatch(resolveLegacyRoute.toString(), /\b(?:import|export)\b/);
});

test('URL gốc bản Trung chuyển tới trang mục bản Trung', () => {
  assert.equal(resolve('/zh/#team-khac'), '/zh/doi-khac/');
  assert.equal(resolve('/zh/#meta-cu'), '/zh/doi-khac/?source=moi-phe');
  assert.equal(resolve('/zh/#heroes'), '/zh/tra-cuu/?group=heroes');
  assert.equal(resolve('/zh/?q=abc'), '/zh/doi-chuan/?q=abc');
  assert.equal(resolve('/zh/#nguon-du-lieu'), null);
  // Tiền tố phải là đúng đoạn `/zh`, không phải mọi đường bắt đầu bằng "zh".
  assert.equal(resolve('/zhx/#team-khac'), '/doi-khac/');
});
