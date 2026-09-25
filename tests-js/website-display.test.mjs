import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {readPublicArtifact, websiteDisplayPublicationSnapshot} from '../src/lib/root-static-artifacts.ts';
import {displayLocationKey, displayValue, loadWebsiteDisplay, localizeData} from '../js/website-display.js';

const bytes = value => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const generationId = `site-localization:${'a'.repeat(64)}`;
const recommendedPin = {schemaVersion: 1, generationId: 'b'.repeat(64), manifestSha256: 'c'.repeat(64)};

function publication() {
  const source = bytes('[{"id":"team-1"}]');
  const document = {
    schemaVersion: 1,
    generationId,
    sourceHashes: {'data/teams.json': hash(source)},
    recommendedPin,
    values: {[displayLocationKey('team-1', 'notes')]: 'Ghi chú tiếng Việt'},
  };
  const display = bytes(document);
  const result = {
    document,
    display,
    source,
    pin: {generationId, sha256: hash(display)},
    load: async path => path === 'website-display.json' ? result.display : result.source,
  };
  return result;
}
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

test('applies reviewed data bindings without mutating source identities or order', () => {
  const source = [{id: 'first', notes: '原文'}, {id: 'second', notes: 'Giữ nguyên'}];
  const publication = {
    values: {
      [displayLocationKey('data:data/teams.json:[0]', '[0].notes')]: 'Bản dịch đã duyệt',
    },
  };
  const localized = localizeData(publication, 'data/teams.json', source);
  assert.deepEqual(localized, [{id: 'first', notes: 'Bản dịch đã duyệt'}, {id: 'second', notes: 'Giữ nguyên'}]);
  assert.deepEqual(source, [{id: 'first', notes: '原文'}, {id: 'second', notes: 'Giữ nguyên'}]);
});
