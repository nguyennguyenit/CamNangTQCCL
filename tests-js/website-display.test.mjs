import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {readPublicArtifact, websiteDisplayPublicationSnapshot} from '../src/lib/root-static-artifacts.ts';
import {createRawNameResolver, displayLocationKey, displayText, displayValue, loadWebsiteDisplay, localName, localizeData} from '../js/website-display.js';

const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const generationId = `site-localization:${'a'.repeat(64)}`;
const recommendedPin = {schemaVersion: 1, generationId: 'b'.repeat(64), manifestSha256: 'c'.repeat(64)};

function publication(sources = {'data/teams.json': bytes('[{"id":"team-1"}]')}) {
  const document = {
    schemaVersion: 1,
    generationId,
    sourceHashes: Object.fromEntries(Object.entries(sources).map(([path, content]) => [path, hash(content)])),
    recommendedPin,
    values: {[displayLocationKey('team-1', 'notes')]: 'Ghi chú tiếng Việt'},
  };
  const display = bytes(document);
  const result = {
    document,
    display,
    pin: {generationId, sha256: hash(display)},
    load: async path => path === 'website-display.json' ? result.display : sources[path],
  };
  return result;
}

const threeSources = () => ({
  'data/teams.json': bytes('[{"id":"team-1"}]'),
  'data/coexist.json': bytes('[]'),
  'data/khaihoang.json': bytes('{"teams":[]}'),
});

test('requests every listed source before the first one answers', async () => {
  const sources = threeSources();
  const fixture = publication(sources);
  const requested = [];
  const pending = [];
  const loading = loadWebsiteDisplay(fixture.pin, path => {
    if (path === 'website-display.json') return Promise.resolve(fixture.display);
    requested.push(path);
    return new Promise(resolve => pending.push(() => resolve(sources[path])));
  }, recommendedPin, {paths: ['data/teams.json', 'data/coexist.json']});
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(requested.sort(), ['data/coexist.json', 'data/teams.json']);
  while (pending.length) {
    pending.shift()();
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  await loading;
});

test('loads and verifies only the listed sources', async () => {
  const fixture = publication(threeSources());
  const requested = [];
  const loaded = await loadWebsiteDisplay(fixture.pin, path => {
    requested.push(path);
    return fixture.load(path);
  }, recommendedPin, {paths: ['data/khaihoang.json']});
  assert.deepEqual(requested, ['website-display.json', 'data/khaihoang.json']);
  assert.deepEqual(localizeData(loaded, 'data/khaihoang.json', {teams: []}), {teams: []});
  assert.throws(() => localizeData(loaded, 'data/teams.json', [{id: 'team-1'}]), /chưa được xác minh: data\/teams\.json/);
});

test('rejects a requested source the publication does not pin', async () => {
  const fixture = publication();
  await assert.rejects(
    loadWebsiteDisplay(fixture.pin, fixture.load, recommendedPin, {paths: ['data/team-tier.json']}),
    /Dữ liệu hiển thị không hợp lệ/,
  );
});

test('refuses to localize a source that was never verified', () => {
  const unverified = {values: {[displayLocationKey('data:data/teams.json:[0]', '[0].notes')]: 'Chưa kiểm'}};
  assert.throws(() => localizeData(unverified, 'data/teams.json', [{notes: '原文'}]), /chưa được xác minh/);
});

test('loads a fully pinned publication and resolves only reviewed display values', async () => {
  const fixture = publication();
  const loaded = await loadWebsiteDisplay(fixture.pin, fixture.load, recommendedPin);
  assert.equal(displayValue(loaded, 'team-1', 'notes'), 'Ghi chú tiếng Việt');
  assert.throws(() => displayValue(loaded, 'team-1', 'missing'), /chưa sẵn sàng/);
  assert.ok(Object.isFrozen(loaded));
  assert.ok(Object.isFrozen(loaded.values));
});

test('accepts browser ArrayBuffer responses without changing verified bytes', async () => {
  const fixture = publication();
  const loaded = await loadWebsiteDisplay(
    fixture.pin,
    async path => {
      const value = await fixture.load(path);
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    },
    recommendedPin,
  );
  assert.equal(displayValue(loaded, 'team-1', 'notes'), 'Ghi chú tiếng Việt');
});

test('rejects changed sidecar bytes, dependencies, and Recommended identity', async () => {
  const fixture = publication();
  await assert.rejects(
    loadWebsiteDisplay({...fixture.pin, sha256: 'd'.repeat(64)}, fixture.load, recommendedPin),
    /mã kiểm tra/,
  );
  await assert.rejects(
    loadWebsiteDisplay(fixture.pin, async path => path === 'website-display.json' ? fixture.display : bytes('changed'), recommendedPin),
    /đã thay đổi/,
  );
  await assert.rejects(
    loadWebsiteDisplay(fixture.pin, fixture.load, {...recommendedPin, generationId: 'e'.repeat(64)}),
  );
});

test('rejects extra schema fields, unsafe source paths, and malformed display locations', async () => {
  for (const mutate of [
    document => { document.extra = true; },
    document => { document.sourceHashes = {'../private.json': 'a'.repeat(64)}; },
    document => { document.values = {'not-json': 'value'}; },
  ]) {
    const fixture = publication();
    mutate(fixture.document);
    fixture.display = bytes(fixture.document);
    fixture.pin.sha256 = hash(fixture.display);
    await assert.rejects(loadWebsiteDisplay(fixture.pin, fixture.load, recommendedPin), /không hợp lệ/);
  }
});

test('server routes keep serving the bytes captured with one website publication snapshot', async t => {
  const root = await mkdtemp(join(tmpdir(), 'website-display-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const recommendedRoot = join(root, 'src/data/recommended-reference');
  const generation = 'b'.repeat(64);
  const generationRoot = join(recommendedRoot, generation);
  await mkdir(join(root, 'data'), {recursive: true});
  await mkdir(generationRoot, {recursive: true});
  const recommendedFiles = {
    'index.json': bytes({records: []}),
    'other-teams.json': bytes({records: []}),
    'seasons.json': bytes({records: []}),
    'hero-summaries.json': bytes({schemaVersion: 1, provenance: {catalogSha256: `sha256:${'0'.repeat(64)}`,
      recommendedJoin: 'heroes[].nameRaw ↔ chinese|aliases', otherJoin: 'holders[].nameRaw ↔ hanViet',
      unmatchedSlots: {recommended: 0, other: 0}, ambiguousSlots: {recommended: 0, other: 0}}, summaries: {}}),
  };
  for (const [name, content] of Object.entries(recommendedFiles)) await writeFile(join(generationRoot, name), content);
  const manifest = {
    schemaVersion: 1,
    generationId: generation,
    dedupKeyVersion: 1,
    allowedScopeKeys: [],
    files: Object.fromEntries(Object.entries(recommendedFiles).map(([name, content]) => [
      name,
      {bytes: content.byteLength, sha256: hash(content)},
    ])),
  };
  const manifestBytes = bytes(manifest);
  const manifestSha256 = hash(manifestBytes);
  await writeFile(join(generationRoot, 'manifest.json'), manifestBytes);
  await writeFile(join(recommendedRoot, 'current.json'), bytes({schemaVersion: 1, generationId: generation, manifestSha256}));

  const teams = bytes('[{\"id\":\"captured\"}]');
  await writeFile(join(root, 'data/teams.json'), teams);
  const displayDocument = {
    schemaVersion: 1,
    generationId,
    sourceHashes: {'data/teams.json': hash(teams)},
    recommendedPin: {schemaVersion: 1, generationId: generation, manifestSha256},
    values: {[displayLocationKey('captured', 'name')]: 'Đã chụp'},
  };
  const displayBytes = bytes(displayDocument);
  await writeFile(join(root, 'data/website-display.json'), displayBytes);
  const publicManifest = [
    {kind: 'data', routeParam: 'teams', sourceBasename: 'teams.json', publicationClass: 'runtime', mimeType: 'application/json'},
    {kind: 'data', routeParam: 'website-display', sourceBasename: 'website-display.json', publicationClass: 'runtime', mimeType: 'application/json'},
  ];

  const snapshot = await websiteDisplayPublicationSnapshot({rootDir: root, manifest: publicManifest});
  await writeFile(join(root, 'data/teams.json'), bytes('[{\"id\":\"mutated\"}]'));
  await writeFile(join(root, 'data/website-display.json'), bytes('{}'));
  const [teamRoute, displayRoute] = await Promise.all([
    readPublicArtifact({kind: 'data', routeParam: 'teams', rootDir: root, manifest: publicManifest}),
    readPublicArtifact({kind: 'data', routeParam: 'website-display', rootDir: root, manifest: publicManifest}),
  ]);
  assert.deepEqual(teamRoute.bytes, snapshot.publicFiles['teams.json']);
  assert.deepEqual(displayRoute.bytes, snapshot.bytes);
  assert.deepEqual(teamRoute.bytes, Buffer.from(teams));
});

test('applies reviewed data bindings without mutating source identities or order', async () => {
  const source = [{id: 'first', notes: '原文'}, {id: 'second', notes: 'Giữ nguyên'}];
  const fixture = publication({'data/teams.json': bytes(source)});
  fixture.document.values = {[displayLocationKey('data:data/teams.json:[0]', '[0].notes')]: 'Bản dịch đã duyệt'};
  fixture.display = bytes(fixture.document);
  fixture.pin.sha256 = hash(fixture.display);
  const verified = await loadWebsiteDisplay(fixture.pin, fixture.load, recommendedPin);
  const localized = localizeData(verified, 'data/teams.json', source);
  assert.deepEqual(localized, [{id: 'first', notes: 'Bản dịch đã duyệt'}, {id: 'second', notes: 'Giữ nguyên'}]);
  assert.deepEqual(source, [{id: 'first', notes: '原文'}, {id: 'second', notes: 'Giữ nguyên'}]);
});

test('Chinese pages keep the verified source text and never apply the Vietnamese overlay', async () => {
  const fixture = publication();
  fixture.document.values[displayLocationKey('data:data/teams.json:[0]', '[0].notes')] = 'Ghi chú tiếng Việt';
  fixture.display = bytes(fixture.document);
  fixture.pin.sha256 = hash(fixture.display);
  const loaded = await loadWebsiteDisplay(fixture.pin, fixture.load, recommendedPin, {paths: ['data/teams.json']});
  const source = [{id: 'team-1', notes: '原文'}];
  assert.deepEqual(localizeData(loaded, 'data/teams.json', source, 'vi'), [{id: 'team-1', notes: 'Ghi chú tiếng Việt'}]);
  const raw = localizeData(loaded, 'data/teams.json', source, 'zh-Hans');
  assert.deepEqual(raw, source);
  assert.notEqual(raw, source);
  // Bản Trung vẫn đòi nguồn đã xác minh.
  assert.throws(() => localizeData(loaded, 'data/coexist.json', [], 'zh'), /chưa được xác minh/);
});

test('display text prefers the page language and falls back to the other side', () => {
  assert.equal(displayText('Tào Tháo', '曹操', 'vi'), 'Tào Tháo');
  assert.equal(displayText('Tào Tháo', '曹操', 'zh'), '曹操');
  assert.equal(displayText('Tào Tháo', ' ', 'zh'), 'Tào Tháo');
  assert.equal(displayText('', '曹操', 'vi'), '曹操');
});

test('raw-name resolver maps Hán-Việt names back to source Chinese only on Chinese pages', () => {
  const resolve = createRawNameResolver(
    [{chinese: 'SP 關羽', hanViet: 'SP Quan Vũ', viet: 'SP Quan Vũ'}, {chinese: '', viet: 'Rỗng'}],
    [{chinese: '以逸待勞', viet: 'Lấy Nhàn Chờ Mệt', hanViet: 'Dĩ Dật Đãi Lao'}],
  );
  assert.equal(resolve('SP Quan Vũ'), 'SP 關羽');
  assert.equal(resolve('sp quan vũ (S)'), 'SP 關羽');
  assert.equal(resolve('Dĩ Dật Đãi Lao'), '以逸待勞');
  assert.equal(resolve('Rỗng'), null);
  assert.equal(resolve('Không có'), null);
  assert.equal(localName('Lấy Nhàn Chờ Mệt', resolve, 'zh'), '以逸待勞');
  assert.equal(localName('Lấy Nhàn Chờ Mệt', resolve, 'vi'), 'Lấy Nhàn Chờ Mệt');
  assert.equal(localName('Không có', resolve, 'zh'), 'Không có');
});

test('combined "A/B" slots resolve only when every part resolves', () => {
  const resolve = createRawNameResolver([{chinese: '呂蒙', viet: 'Lữ Mông'}, {chinese: '程普', viet: 'Trình Phổ'}]);
  assert.equal(resolve('Lữ Mông/Trình Phổ'), '呂蒙/程普');
  assert.equal(resolve('Lữ Mông/Không có'), null);
  assert.equal(resolve('Lữ Mông/'), null);
});
