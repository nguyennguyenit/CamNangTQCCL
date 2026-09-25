import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {recommendedPublicationSnapshot,readRecommendedArtifact} from '../src/lib/recommended-reference-artifacts.ts';

const bytes=value=>Buffer.from(JSON.stringify(value)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');

/** Payload "Trong cẩm nang" rỗng nhưng đúng cấu trúc (fixture không có tướng khớp). */
function summariesPayload(){
  return bytes({schemaVersion:1,provenance:{catalogSha256:`sha256:${'0'.repeat(64)}`,
    recommendedJoin:'heroes[].nameRaw ↔ chinese|aliases',otherJoin:'holders[].nameRaw ↔ hanViet',
    unmatchedSlots:{recommended:0,other:0},ambiguousSlots:{recommended:0,other:0}},summaries:{}});
}

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'recommended-artifacts-'));
  const id='1'.repeat(64), generation=join(root,id); await mkdir(generation);
  const scope='s-'+'2'.repeat(64);
  const payloads={
    'seasons.json':bytes({seasons:[]}),
    'index.json':bytes({records:[]}),
    'other-teams.json':bytes({records:[]}),
    'hero-summaries.json':summariesPayload(),
    [`details-${scope}.json`]:bytes({records:[]}),
  };
  const files=Object.fromEntries(Object.entries(payloads).map(([name,data])=>[name,{sha256:hash(data),bytes:data.length}]));
  for(const [name,data] of Object.entries(payloads)) await writeFile(join(generation,name),data);
  const manifest=bytes({schemaVersion:1,generationId:id,dedupKeyVersion:1,allowedScopeKeys:[scope],files}); await writeFile(join(generation,'manifest.json'),manifest);
  await writeFile(join(root,'current.json'),bytes({schemaVersion:1,generationId:id,manifestSha256:hash(manifest)}));
  return {root,id};
}

test('selected generation exposes only declared exact bytes',async()=>{
  const {root,id}=await fixture(); const snapshot=await recommendedPublicationSnapshot(root);
  assert.equal(snapshot.pin.generationId,id);
  assert.deepEqual(Buffer.from((await readRecommendedArtifact(id,'seasons',root)).bytes),snapshot.files['seasons.json']);
  await assert.rejects(readRecommendedArtifact(id,'../seasons',root));
  await assert.rejects(readRecommendedArtifact('2'.repeat(64),'seasons',root));
});

test('rogue and symlink files invalidate the whole snapshot',async()=>{
  const first=await fixture(); await writeFile(join(first.root,first.id,'rogue.json'),'{}');
  await assert.rejects(recommendedPublicationSnapshot(first.root),/inventory/);
  const second=await fixture(); await rm(join(second.root,second.id,'other-teams.json')); await symlink(join(second.root,second.id,'seasons.json'),join(second.root,second.id,'other-teams.json'));
  await assert.rejects(recommendedPublicationSnapshot(second.root));
});
