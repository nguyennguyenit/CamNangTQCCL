import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {teamDetailCatalog,findAdmittedVariant} from '../src/lib/team-detail-routes.ts';

const bytes=value=>Buffer.from(JSON.stringify(value)+'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');

const holder=name=>({nameRaw:name,displayNameVi:name,tacticSlotsRaw:[],tacticSlotsVi:[],bookSlotsRaw:['','',''],bookSlotsVi:[null,null,null],statFocusRaw:'',notesRaw:'',roleRaw:'主將'});
const recommendedRow=(sourceConfigId,overrides={})=>({
  sourceConfigId,
  safeScopeKey:'s-'+'2'.repeat(64),
  displayNameVi:`Đội ${sourceConfigId}`,
  nameZh:'潛龍貂蟬',
  value:113,
  tierRaw:'T0',
  heroes:[holder('A'),holder('B'),holder('C')],
  alternativeHoldersRaw:[],
  displayNotes:{schemaVersion:1,blocks:[]},
  legacyReferences:[],
  sourceSeasonId:'pk-s24',
  sourceSeasonCode:'PK-S24',
  sourceSeasonNameVi:'Bá Vương Thảo Nghịch',
  sourceCategoryId:'交戰',
  sourceCategoryNameVi:'Giao chiến',
  sourceUrl:`https://sgsdeck.com/recommended/${sourceConfigId}`,
  ...overrides,
});
const legacyTeam=(id,overrides={})=>({
  id,source:'team-intro',name:`Đội ${id}`,nickname:null,rawType:'Thương',unitType:['Thương'],
  faction:null,stars:null,status:'meta',
  heroes:[{name:'Tuân Úc',baseName:'Tuân Úc',alternatives:[],variant:null,isSP:false,isCO:false,tactics:[],books:[],note:null}],
  counters:{good:[],avoid:[]},notes:null,...overrides,
});
const admittedRow=(legacyTeamId,legacyVariantId,legacyContent)=>({
  classification:'distinct',dedupKeyVersion:1,legacyTeamId,legacyVariantId,
  name:legacyContent.name,nickname:legacyContent.nickname,source:legacyContent.source,
  sourceLabel:'Giới thiệu',holders:[],legacyContent,
  legacyContentSha256:'sha256:'+'3'.repeat(64),
});

async function fixture({recommendedIds=['team-alpha','yxms-049-仙人盾-by大米'],teams,variants=[['team-intro-0','v-'+'a'.repeat(64)]],legacyTeamsHash}={}) {
  const root=await mkdtemp(join(tmpdir(),'team-detail-routes-'));
  const generationId='1'.repeat(64);
  const generation=join(root,'recommended',generationId);
  await mkdir(generation,{recursive:true});
  const teamRows=teams || [legacyTeam('team-intro-0'),legacyTeam('team-intro-1'),legacyTeam('moi-phe-4')];
  const teamsBytes=bytes(teamRows);
  const teamsPath=join(root,'teams.json');
  await writeFile(teamsPath,teamsBytes);
  const byId=new Map(teamRows.map(team=>[team.id,team]));
  const scope='s-'+'2'.repeat(64);
  const records=recommendedIds.map(recommendedRow);
  const payloads={
    'seasons.json':bytes({schemaVersion:1,seasonOptions:[],scopes:[]}),
    'index.json':bytes({schemaVersion:1,records}),
    'other-teams.json':bytes({schemaVersion:1,records:variants.map(([teamId,variantId])=>admittedRow(teamId,variantId,byId.get(teamId) || legacyTeam(teamId)))}),
    [`details-${scope}.json`]:bytes({schemaVersion:1,records}),
  };
  const files=Object.fromEntries(Object.entries(payloads).map(([name,data])=>[name,{sha256:hash(data),bytes:data.length}]));
  for (const [name,data] of Object.entries(payloads)) await writeFile(join(generation,name),data);
  const manifest=bytes({
    schemaVersion:1,generationId,dedupKeyVersion:1,allowedScopeKeys:[scope],files,
    legacyTeamsHash:legacyTeamsHash || `sha256:${hash(teamsBytes)}`,
    counts:{recommended:records.length,other:variants.length},
  });
  await writeFile(join(generation,'manifest.json'),manifest);
  await writeFile(join(root,'recommended','current.json'),bytes({schemaVersion:1,generationId,manifestSha256:hash(manifest)}));
  return {root,recommendedRoot:join(root,'recommended'),teamsPath,generationId,teamRows};
}

const build=async setup=>teamDetailCatalog({recommendedRoot:setup.recommendedRoot,teamsPath:setup.teamsPath});

test('catalog routes every selected Recommended row and every raw original exactly once',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const catalog=await build(setup);

  assert.deepEqual(catalog.recommended.map(entry=>entry.sourceConfigId),['team-alpha','yxms-049-仙人盾-by大米']);
  assert.deepEqual(catalog.legacy.map(entry=>entry.legacyTeamId),['team-intro-0','team-intro-1','moi-phe-4']);
  assert.equal(catalog.recommended[0].routePath,'/teams/recommended/team-alpha/');
  assert.equal(catalog.recommended[1].routePath,`/teams/recommended/${encodeURIComponent('yxms-049-仙人盾-by大米')}/`);
  assert.equal(catalog.legacy[0].routePath,'/teams/legacy/team-intro-0/');
  assert.equal(catalog.recommended[0].htmlPath,'teams/recommended/team-alpha/index.html');
  assert.equal(catalog.legacy[0].htmlPath,'teams/legacy/team-intro-0/index.html');

  // Originals that were never admitted into Team khác still have their own readable page.
  const unadmitted=catalog.legacy.find(entry=>entry.legacyTeamId==='moi-phe-4');
  assert.deepEqual(unadmitted.variantIds,[]);
  assert.deepEqual(catalog.legacy.find(entry=>entry.legacyTeamId==='team-intro-0').variantIds,['v-'+'a'.repeat(64)]);

  assert.equal(catalog.htmlPaths.length,catalog.recommended.length+catalog.legacy.length);
  assert.equal(new Set(catalog.htmlPaths).size,catalog.htmlPaths.length);
  assert.equal(catalog.legacyTeamsSha256,`sha256:${hash(await readFile(setup.teamsPath))}`);
  assert.equal(catalog.generationId,setup.generationId);
});

test('only the exact admitted ID pair resolves a variant',async t=>{
  const setup=await fixture({variants:[['team-intro-0','v-'+'a'.repeat(64)],['team-intro-1','v-'+'b'.repeat(64)]]});
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const catalog=await build(setup);

  assert.equal(findAdmittedVariant(catalog,'team-intro-0','v-'+'a'.repeat(64)).legacyTeamId,'team-intro-0');
  // Variant of a different original must never resolve on this route.
  assert.equal(findAdmittedVariant(catalog,'team-intro-0','v-'+'b'.repeat(64)),null);
  assert.equal(findAdmittedVariant(catalog,'team-intro-0','v-'+'c'.repeat(64)),null);
  assert.equal(findAdmittedVariant(catalog,'moi-phe-4','v-'+'a'.repeat(64)),null);
  assert.equal(findAdmittedVariant(catalog,'../team-intro-0','v-'+'a'.repeat(64)),null);
  assert.equal(findAdmittedVariant(catalog,'team-intro-0',''),null);
});

test('unknown, duplicate and traversal identifiers never become routes',async t=>{
  const cleanup=[];
  t.after(()=>Promise.all(cleanup.map(setup=>rm(setup.root,{recursive:true,force:true}))));

  const ok=await fixture(); cleanup.push(ok);
  const catalog=await build(ok);
  assert.equal(catalog.recommended.find(entry=>entry.sourceConfigId==='team-unknown'),undefined);
  assert.equal(catalog.legacy.find(entry=>entry.legacyTeamId==='team-unknown'),undefined);

  const duplicateRecommended=await fixture({recommendedIds:['team-alpha','team-alpha']}); cleanup.push(duplicateRecommended);
  await assert.rejects(build(duplicateRecommended),/duplicate/i);

  const duplicateLegacy=await fixture({teams:[legacyTeam('team-intro-0'),legacyTeam('team-intro-0')],variants:[]}); cleanup.push(duplicateLegacy);
  await assert.rejects(build(duplicateLegacy),/duplicate/i);

  for (const unsafe of ['../secret','teams/legacy','.','team%2fx','team id']) {
    const bad=await fixture({recommendedIds:[unsafe]}); cleanup.push(bad);
    await assert.rejects(build(bad),/identifier/i,`must reject ${unsafe}`);
  }

  const unsafeLegacy=await fixture({teams:[legacyTeam('..')],variants:[]}); cleanup.push(unsafeLegacy);
  await assert.rejects(build(unsafeLegacy),/identifier/i);

  const unknownVariantTeam=await fixture({variants:[['team-not-in-raw','v-'+'a'.repeat(64)]]}); cleanup.push(unknownVariantTeam);
  await assert.rejects(build(unknownVariantTeam),/unknown legacy team/i);
});

test('selected publication must match the exact raw originals it was built from',async t=>{
  const stale=await fixture({legacyTeamsHash:'sha256:'+'9'.repeat(64)});
  t.after(()=>rm(stale.root,{recursive:true,force:true}));
  await assert.rejects(build(stale),/legacy teams hash/i);

  const drifted=await fixture();
  t.after(()=>rm(drifted.root,{recursive:true,force:true}));
  await writeFile(drifted.teamsPath,bytes([legacyTeam('team-intro-0'),legacyTeam('team-intro-1'),legacyTeam('moi-phe-4'),legacyTeam('moi-phe-5')]));
  await assert.rejects(build(drifted),/legacy teams hash/i);
});

test('worktree publication yields the real route inventory and pins the real originals',async()=>{
  const catalog=await teamDetailCatalog();
  const teamsBytes=await readFile(new URL('../data/teams.json',import.meta.url));
  const teams=JSON.parse(teamsBytes.toString());

  assert.equal(catalog.legacyTeamsSha256,`sha256:${hash(teamsBytes)}`);
  assert.equal(catalog.legacy.length,teams.length);
  assert.deepEqual(catalog.legacy.map(entry=>entry.legacyTeamId).sort(),teams.map(team=>team.id).sort());
  assert.ok(catalog.recommended.length>0);
  assert.equal(new Set(catalog.recommended.map(entry=>entry.sourceConfigId)).size,catalog.recommended.length);
  assert.equal(catalog.htmlPaths.length,catalog.recommended.length+catalog.legacy.length);
  assert.ok(catalog.variants.length>0);
  for (const variant of catalog.variants) {
    assert.ok(catalog.legacy.some(entry=>entry.legacyTeamId===variant.legacyTeamId));
    assert.equal(findAdmittedVariant(catalog,variant.legacyTeamId,variant.legacyVariantId).legacyVariantId,variant.legacyVariantId);
  }
  for (const entry of catalog.recommended) {
    assert.match(entry.safeScopeKey,/^s-[0-9a-f]{64}$/);
    assert.ok(!entry.htmlPath.includes('..'));
  }
});
