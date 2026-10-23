import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {buildLookupCorpus, LOOKUP_GROUPS} from '../js/unified-lookup.js';
import {LOOKUP_GROUP_SLUGS, lookupSlug} from '../js/lookup-ids.js';
import {lookupDetailRoutes, parseLookupDetailLedger} from '../src/lib/lookup-detail-routes.ts';

const readJson = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

async function realCorpus() {
  const [heroes, tactics, catalog, books] = await Promise.all(
    ['data/heroes-dict.json', 'data/tactics.json', 'data/lookup-catalog.json', 'data/books-dict.json'].map(readJson),
  );
  const corpus = buildLookupCorpus({heroes, tactics, catalog, books});
  return {
    corpus,
    ids: Object.fromEntries(LOOKUP_GROUPS.map(group => [group, corpus.groups[group].map(item => item.id)])),
  };
}

const canonical = value => (value && typeof value === 'object'
  ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  : JSON.stringify(value));
const seal = ledger => ({...ledger, handlesSha256: createHash('sha256').update(canonical({handles: ledger.handles, retired: ledger.retired})).digest('hex')});

test('frozen ledger covers every corpus item and resolves both ways', async () => {
  const {corpus, ids} = await realCorpus();
  const routes = await lookupDetailRoutes({corpusIds: ids});
  assert.equal(routes.entries.length, Object.values(ids).flat().length);
  for (const group of LOOKUP_GROUPS) {
    for (const item of corpus.groups[group]) {
      const route = routes.byId.get(item.id);
      assert.equal(route.group, group);
      assert.equal(routes.entries.find(entry => entry.id === item.id), route);
      assert.equal(route.path, `/tra-cuu/${LOOKUP_GROUP_SLUGS[group]}/${route.slug}/`);
    }
  }
  assert.equal(routes.byId.get('hero:khong-co-slug-nay'), undefined);
  assert.equal(routes.byId.has('equipment-special:anything'), false);
});

test('đổi tên Việt của binh thư không tạo route mới: id cố định, slug giữ nguyên, bảng ngoại lệ rỗng', async () => {
  const [heroes, tactics, catalog, books] = await Promise.all(
    ['data/heroes-dict.json', 'data/tactics.json', 'data/lookup-catalog.json', 'data/books-dict.json'].map(readJson),
  );
  const row = books.find(item => item.id === 'book:di-truc-bao-oan');
  assert.ok(row, 'books-dict.json phải mang id cố định');
  const renamed = books.map(item => (item === row ? {...item, viet: 'Lấy Thẳng Báo Oán', aliases: [item.viet]} : item));
  const corpus = buildLookupCorpus({heroes, tactics, catalog, books: renamed});
  const ids = Object.fromEntries(LOOKUP_GROUPS.map(group => [group, corpus.groups[group].map(item => item.id)]));
  const routes = await lookupDetailRoutes({corpusIds: ids});
  assert.equal(routes.byId.get('book:di-truc-bao-oan').path, '/tra-cuu/binh-thu/di-truc-bao-oan/');
  assert.equal(ids.books.length, 68);
  assert.deepEqual(routes.exceptions, {});
});

test('slug rule: Python slug() and JS lookupSlug agree on every corpus name', async () => {
  const {corpus} = await realCorpus();
  const names = [...new Set(LOOKUP_GROUPS.flatMap(group => corpus.groups[group].map(item => item.nameVi)).filter(name => typeof name === 'string'))];
  names.push('  Đặng Ngải ', 'Tinh · Phong Thi Trận', 'Lữ Mông (SP)', 'đĐ', '');
  const run = spawnSync('python3', ['-c', 'import json,sys\nfrom pipeline.lookup_route_handles import slug\nprint(json.dumps([slug(n) for n in json.load(sys.stdin)], ensure_ascii=False))'], {
    cwd: new URL('..', import.meta.url), input: JSON.stringify(names), encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), names.map(lookupSlug));
});

test('retired ids keep their slug reserved without producing a route; the section is part of the digest', async () => {
  const {ids} = await realCorpus();
  const ledger = await readJson('pipeline/lookup-route-handles.json');
  const [first, second] = ids.heroes;
  const retire = seal(structuredClone({...ledger, retired: {...ledger.retired, heroes: {'hero:da-nghi': 'da-nghi'}}}));
  const routes = await parseLookupDetailLedger(retire, ids);
  assert.equal(routes.entries.length, Object.values(ids).flat().length);
  assert.equal(routes.byId.has('hero:da-nghi'), false);
  assert.throws(() => parseLookupDetailLedger({...retire, retired: {...retire.retired, heroes: {'hero:da-nghi': 'khac'}}}, ids), /handlesSha256/);
  const clash = seal({...ledger, retired: {...ledger.retired, heroes: {'hero:da-nghi': ledger.handles.heroes[first]}}});
  assert.throws(() => parseLookupDetailLedger(clash, ids), /shared by/);
  const both = seal({...ledger, retired: {...ledger.retired, heroes: {[second]: 'x'}}});
  assert.throws(() => parseLookupDetailLedger(both, ids), /both live and retired/);
});

test('ledger that differs from the corpus key set is refused', async () => {
  const {ids} = await realCorpus();
  const ledger = await readJson('pipeline/lookup-route-handles.json');
  const missing = structuredClone(ids);
  missing.heroes.push('hero:chua-cap');
  assert.throws(() => parseLookupDetailLedger(ledger, missing), /missing .*hero:chua-cap/);
  const unknown = structuredClone(ids);
  unknown.tactics.pop();
  assert.throws(() => parseLookupDetailLedger(ledger, unknown), /unknown/);
});

test('hand-edited, duplicate, malformed or stale-pinned ledgers are refused', async () => {
  const {ids} = await realCorpus();
  const ledger = await readJson('pipeline/lookup-route-handles.json');
  const edit = mutate => { const copy = structuredClone(ledger); mutate(copy); return copy; };
  const [first, second] = ids.heroes;
  assert.throws(() => parseLookupDetailLedger(edit(l => { l.handles.heroes[first] = 'sua-tay'; }), ids), /handlesSha256/);
  assert.throws(() => parseLookupDetailLedger(seal(edit(l => { l.handles.heroes[second] = l.handles.heroes[first]; })), ids), /shared by/);
  assert.throws(() => parseLookupDetailLedger(seal(edit(l => { l.handles.heroes[first] = 'Sai Dạng'; })), ids), /lowercase ASCII slug/);
  assert.throws(() => parseLookupDetailLedger(ledger, ids, {generationId: 'lookup:other'}), /generationId/);
  assert.throws(() => parseLookupDetailLedger(edit(l => { delete l.note; }), ids), /keys/);
});
