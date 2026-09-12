import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createGuard } from './guard.mjs';

const KEY = 'docs/source.txt';
const BODY = 'literal harmless probe\nsecond line with dot.char\nRUBRIC absent here\n';
const REPORT_KEY = 'plans/reports/probe.md';

function baseSources() {
  return { [KEY]: BODY };
}

// Tạo thư mục tạm thật, dọn dẹp sau mỗi test
function tmp(t) {
  // macOS exposes /var as a system symlink; positive cases use canonical paths.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function reportTarget(dir) {
  const parent = path.join(dir, 'sandbox', 'reports');
  fs.mkdirSync(parent, { recursive: true });
  return path.join(parent, 'probe.md');
}

function entryOf(manifest, key) {
  if (Array.isArray(manifest)) return manifest.find((e) => e && e.path === key);
  if (manifest && typeof manifest === 'object') {
    const v = manifest[key];
    if (typeof v === 'string') return { path: key, sha256: v };
    if (v && typeof v === 'object') return { path: key, ...v };
  }
  return undefined;
}

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

test('list chỉ trả về khoá snapshot được cấp phép', () => {
  const g = createGuard({ sources: baseSources(), reportPath: null, reportKey: null });
  const res = g.dispatch({ op: 'list' });
  assert.equal(res.ok, true);
  assert.deepEqual([...res.paths].sort(), [KEY]);
});

test('read trả nội dung đúng và chặn mọi biến thể đường dẫn ngoài phạm vi', (t) => {
  const dir = tmp(t);
  const outside = path.join(dir, 'secret.txt');
  fs.writeFileSync(outside, 'OUTSIDE_SECRET');
  const g = createGuard({ sources: baseSources(), reportPath: null, reportKey: null });

  assert.equal(g.dispatch({ op: 'read', path: KEY }).content, BODY);

  const bad = [
    '../secret.txt',
    'docs/../../secret.txt',
    './docs/./../../etc/passwd',
    outside,
    '/etc/passwd',
    '..%2Fsecret.txt',
    '%2e%2e%2fsecret.txt',
    'docs%2Fsource.txt',
    'docs/source.txt/../../secret.txt',
    'docs/missing.txt',
    REPORT_KEY,
  ];
  for (const p of bad) {
    const r = g.dispatch({ op: 'read', path: p });
    assert.equal(r.ok, false, `phải từ chối: ${p}`);
    assert.equal(typeof r.error, 'string');
    assert.equal(r.content, undefined);
  }
  assert.equal(fs.readFileSync(outside, 'utf8'), 'OUTSIDE_SECRET');
});

test('search là literal, phân biệt hoa thường, không thấy file trên đĩa', (t) => {
  const dir = tmp(t);
  fs.writeFileSync(path.join(dir, 'rubric.md'), 'RUBRIC_SECRET_TOKEN grading notes');
  const g = createGuard({ sources: baseSources(), reportPath: null, reportKey: null });

  const hit = g.dispatch({ op: 'search', query: 'dot.char' });
  assert.equal(hit.ok, true);
  assert.equal(hit.matches.length, 1);
  assert.equal(hit.matches[0].path, KEY);
  assert.ok(hit.matches[0].text.includes('dot.char'));
  assert.equal(typeof hit.matches[0].line, 'number');

  for (const q of ['d.t', 'dot.*char', 'Literal', 'PROBE', 'RUBRIC_SECRET_TOKEN', 'grading notes']) {
    const r = g.dispatch({ op: 'search', query: q });
    assert.equal(r.ok, true, `truy vấn hợp lệ: ${q}`);
    assert.deepEqual(r.matches, [], `không được khớp: ${q}`);
  }
});

test('create_report ghi đúng byte một lần, không ghi đè, đọc/tìm được ngay', (t) => {
  const dir = tmp(t);
  const target = reportTarget(dir);
  const g = createGuard({ sources: baseSources(), reportPath: target, reportKey: REPORT_KEY });

  assert.equal(g.dispatch({ op: 'read', path: REPORT_KEY }).ok, false);

  const content = 'ket qua probe\nneedle-in-report\n';
  const made = g.dispatch({ op: 'create_report', path: REPORT_KEY, content });
  assert.equal(made.ok, true);
  assert.equal(fs.readFileSync(target, 'utf8'), content);

  const again = g.dispatch({ op: 'create_report', path: REPORT_KEY, content: 'OVERWRITE' });
  assert.equal(again.ok, false);
  assert.equal(fs.readFileSync(target, 'utf8'), content);

  assert.equal(g.dispatch({ op: 'read', path: REPORT_KEY }).content, content);
  const found = g.dispatch({ op: 'search', query: 'needle-in-report' });
  assert.deepEqual(found.matches.map((m) => m.path), [REPORT_KEY]);
  assert.deepEqual([...g.dispatch({ op: 'list' }).paths].sort(), [KEY, REPORT_KEY].sort());
});

test('ghi ra vị trí không phải mục tiêu bị từ chối và không đụng file khác', (t) => {
  const dir = tmp(t);
  const target = reportTarget(dir);
  const other = path.join(dir, 'sandbox', 'reports', 'other.md');
  fs.writeFileSync(other, 'ORIGINAL');
  const g = createGuard({ sources: baseSources(), reportPath: target, reportKey: REPORT_KEY });

  for (const p of ['plans/reports/other.md', other, '../other.md', KEY, 'plans/reports/probe.md/../other.md']) {
    if (p === REPORT_KEY) continue;
    const r = g.dispatch({ op: 'create_report', path: p, content: 'PWNED' });
    assert.equal(r.ok, false, `phải từ chối ghi: ${p}`);
  }
  assert.equal(fs.readFileSync(other, 'utf8'), 'ORIGINAL');
  assert.equal(fs.existsSync(target), false);
});

test('symlink ở lá bị từ chối, file ngoài không đổi', (t) => {
  const dir = tmp(t);
  const outside = path.join(dir, 'outside.md');
  fs.writeFileSync(outside, 'OUTSIDE');
  const parent = path.join(dir, 'sandbox', 'reports');
  fs.mkdirSync(parent, { recursive: true });
  const target = path.join(parent, 'probe.md');
  fs.symlinkSync(outside, target);

  const g = createGuard({ sources: baseSources(), reportPath: target, reportKey: REPORT_KEY });
  const r = g.dispatch({ op: 'create_report', path: REPORT_KEY, content: 'PWNED' });
  assert.equal(r.ok, false);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'OUTSIDE');
});

test('symlink ở thư mục cha bị từ chối, không tạo hiệu ứng bên ngoài', (t) => {
  const dir = tmp(t);
  const real = path.join(dir, 'elsewhere');
  fs.mkdirSync(real, { recursive: true });
  const linkParent = path.join(dir, 'sandbox', 'reports');
  fs.mkdirSync(path.dirname(linkParent), { recursive: true });
  fs.symlinkSync(real, linkParent);
  const target = path.join(linkParent, 'probe.md');

  const g = createGuard({ sources: baseSources(), reportPath: target, reportKey: REPORT_KEY });
  const r = g.dispatch({ op: 'create_report', path: REPORT_KEY, content: 'PWNED' });
  assert.equal(r.ok, false);
  assert.deepEqual(fs.readdirSync(real), []);
});

test('create_report bị từ chối khi không có mục tiêu được cấp', () => {
  const g = createGuard({ sources: baseSources(), reportPath: null, reportKey: null });
  const r = g.dispatch({ op: 'create_report', path: REPORT_KEY, content: 'x' });
  assert.equal(r.ok, false);
});

test('op lạ và payload sai kiểu bị từ chối mà không ném lỗi', () => {
  const g = createGuard({ sources: baseSources(), reportPath: null, reportKey: null });
  const actions = [
    { op: 'shell', cmd: 'rm -rf /' },
    { op: 'delegate', agent: 'other' },
    { op: 'network', url: 'https://example.com' },
    { op: 'write', path: KEY, content: 'x' },
    { op: 'list', extra: 1, path: '..' },
    { op: 'read' },
    { op: 'read', path: null },
    { op: 'read', path: { toString: () => KEY } },
    { op: 'read', path: [KEY] },
    { op: 'search' },
    { op: 'search', query: 42 },
    { op: 'create_report', path: REPORT_KEY, content: 12 },
    {},
    { op: '' },
    null,
    'list',
    42,
  ];
  for (const a of actions) {
    const r = g.dispatch(a);
    assert.equal(typeof r, 'object');
    if (a && a.op === 'list' && r.ok === true) continue;
    assert.equal(r.ok, false, `phải từ chối: ${JSON.stringify(a)}`);
    assert.equal(typeof r.error, 'string');
  }
});

test('manifest khớp sha256 và sources bất biến sau constructor', () => {
  const sources = baseSources();
  const g = createGuard({ sources, reportPath: null, reportKey: null });
  const e = entryOf(g.manifest, KEY);
  assert.ok(e, 'manifest phải có mục cho snapshot');
  assert.equal(e.path, KEY);
  assert.equal(e.sha256, sha(BODY));

  sources[KEY] = 'TAMPERED';
  sources['docs/injected.txt'] = 'INJECTED';
  assert.equal(g.dispatch({ op: 'read', path: KEY }).content, BODY);
  assert.equal(g.dispatch({ op: 'read', path: 'docs/injected.txt' }).ok, false);
  assert.deepEqual([...g.dispatch({ op: 'list' }).paths].sort(), [KEY]);
  assert.equal(entryOf(g.manifest, KEY).sha256, sha(BODY));
});

test('trace ghi mọi yêu cầu kể cả op sai và giữ nguyên action gốc', () => {
  const g = createGuard({ sources: baseSources(), reportPath: null, reportKey: null });
  const mutable = { op: 'read', path: KEY };
  g.dispatch(mutable);
  mutable.op = 'shell';
  mutable.path = '../secret';
  g.dispatch({ op: 'network', url: 'https://evil.test' });
  g.dispatch({ op: 'read', path: '../secret.txt' });

  assert.equal(g.trace.length, 3);
  assert.equal(g.trace[0].action.op, 'read');
  assert.equal(g.trace[0].action.path, KEY);
  assert.equal(g.trace[0].ok, true);
  assert.equal(g.trace[1].action.op, 'network');
  assert.equal(g.trace[1].ok, false);
  assert.equal(g.trace[2].ok, false);
});
