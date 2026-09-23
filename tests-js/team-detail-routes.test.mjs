import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {
  legacyRoutePath,
  recommendedRoutePath,
  khaiHoangRoutePath,
  teamDetailCatalog,
  teamDetailHtmlPaths,
  findAdmittedVariant,
} from '../src/lib/team-detail-routes.ts';

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

/** Fixture ledger freezes the raw identifier as the handle; season codes are owned by the catalog. */
const frozenHandles=(recommendedIds,teams,khaiHoangTeams)=>({
  recommended:Object.fromEntries(recommendedIds.map(id=>[id,id])),
  legacy:Object.fromEntries(teams.map(team=>[team.id,team.id])),
  khaihoang:Object.fromEntries(khaiHoangTeams.map(team=>[team.id,team.id])),
});

/** Mirrors `slug()` in pipeline/team_route_handles.py; the fixture titles only need the ASCII path. */
const slug=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

/** The data owner assigns `id` as the ASCII slug of the current title; the fixture does the same. */
const khaiHoangTeam=(title,overrides={})=>({id:slug(title),title,...overrides});
const KHAIHOANG_TEAMS=[
  khaiHoangTeam('Gia Cát Khác · SP Mã Siêu · Pháp Chính'),
  khaiHoangTeam('Quan Ngân Bình · Nhạc Tiến'),
];

async function fixture({
  recommendedIds=['team-alpha','yxms-049-仙人盾-by大米'],
  seasonCodes={},
  teams,
  khaiHoangTeams=KHAIHOANG_TEAMS,
  variants=[['team-intro-0','v-'+'a'.repeat(64)]],
  legacyTeamsHash,
}={}) {
  const root=await mkdtemp(join(tmpdir(),'team-detail-routes-'));
  const generationId='1'.repeat(64);
  const generation=join(root,'recommended',generationId);
  await mkdir(generation,{recursive:true});
  const teamRows=teams || [legacyTeam('team-intro-0'),legacyTeam('team-intro-1'),legacyTeam('moi-phe-4')];
  const teamsBytes=bytes(teamRows);
  const teamsPath=join(root,'teams.json');
  await writeFile(teamsPath,teamsBytes);
  const khaiHoangBytes=bytes({teams:khaiHoangTeams});
  const khaiHoangPath=join(root,'khaihoang.json');
  await writeFile(khaiHoangPath,khaiHoangBytes);
  const byId=new Map(teamRows.map(team=>[team.id,team]));
  const scope='s-'+'2'.repeat(64);
  const records=recommendedIds.map(id=>recommendedRow(
    id,
    seasonCodes[id] === undefined ? {} : {sourceSeasonCode:seasonCodes[id]},
  ));
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

  const defaultHandles=frozenHandles(recommendedIds,teamRows,khaiHoangTeams);
  /** Writes an alternative ledger in the same root and returns its path. */
  const alternativeLedger=async(overrides={},name='alternative-ledger.json')=>{
    const handles=overrides.handles === undefined
      ? defaultHandles
      : overrides.handles === null
        ? null
        : {...defaultHandles,...overrides.handles};
    const path=join(root,name);
    await writeFile(path,bytes({
      schemaVersion:overrides.schemaVersion ?? 2,
      generationId:overrides.generationId ?? generationId,
      legacyTeamsSha256:overrides.legacyTeamsSha256 ?? `sha256:${hash(teamsBytes)}`,
      khaihoangSha256:overrides.khaihoangSha256 ?? `sha256:${hash(khaiHoangBytes)}`,
      note:'Handle URL đã review; gán một lần, không suy lại từ displayNameVi.',
      handles,
    }));
    return path;
  };

  return {
    root,
    recommendedRoot:join(root,'recommended'),
    teamsPath,
    khaiHoangPath,
    khaiHoangTeams,
    generationId,
    teamRows,
    defaultHandles,
    handlesPath:await alternativeLedger({},'team-route-handles.json'),
    alternativeLedger,
  };
}

const build=(setup,handlesPath=setup.handlesPath)=>teamDetailCatalog({
  recommendedRoot:setup.recommendedRoot,
  teamsPath:setup.teamsPath,
  handlesPath,
  khaiHoangPath:setup.khaiHoangPath,
});

test('route builders are the single source of the Vietnamese path shape',()=>{
  assert.equal(recommendedRoutePath('pk-s24-tu-ma-phi-hung'),'/doi-chuan/pk-s24-tu-ma-phi-hung/');
  assert.equal(legacyRoutePath('hoang-ma-thuong'),'/doi-khac/hoang-ma-thuong/');
  assert.equal(recommendedRoutePath('pk-s24-仙人盾'),`/doi-chuan/${encodeURIComponent('pk-s24-仙人盾')}/`);
});

test('catalog routes every selected Recommended row and every raw original exactly once',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const catalog=await build(setup);

  assert.deepEqual(catalog.recommended.map(entry=>entry.sourceConfigId),['team-alpha','yxms-049-仙人盾-by大米']);
  assert.deepEqual(catalog.legacy.map(entry=>entry.legacyTeamId),['team-intro-0','team-intro-1','moi-phe-4']);
  // The final segment is the row's season code plus the frozen handle; every path derives from it.
  assert.equal(catalog.recommended[0].routeSegment,'pk-s24-team-alpha');
  assert.equal(catalog.recommended[0].routePath,'/doi-chuan/pk-s24-team-alpha/');
  assert.equal(catalog.recommended[0].htmlPath,'doi-chuan/pk-s24-team-alpha/index.html');
  assert.equal(catalog.recommended[1].routeSegment,'pk-s24-yxms-049-仙人盾-by大米');
  assert.equal(catalog.recommended[1].routePath,`/doi-chuan/${encodeURIComponent('pk-s24-yxms-049-仙人盾-by大米')}/`);
  assert.equal(catalog.recommended[1].htmlPath,'doi-chuan/pk-s24-yxms-049-仙人盾-by大米/index.html');
  assert.equal(catalog.legacy[0].routeSegment,'team-intro-0');
  assert.equal(catalog.legacy[0].routePath,'/doi-khac/team-intro-0/');
  assert.equal(catalog.legacy[0].htmlPath,'doi-khac/team-intro-0/index.html');

  // Originals that were never admitted into Team khác still have their own readable page.
  assert.deepEqual(catalog.legacy.find(entry=>entry.legacyTeamId==='moi-phe-4').variantIds,[]);
  assert.deepEqual(catalog.legacy.find(entry=>entry.legacyTeamId==='team-intro-0').variantIds,['v-'+'a'.repeat(64)]);

  assert.equal(catalog.htmlPaths.length,catalog.recommended.length+catalog.legacy.length+catalog.khaiHoang.length);
  assert.equal(new Set(catalog.htmlPaths).size,catalog.htmlPaths.length);
  assert.deepEqual(catalog.htmlPaths,await teamDetailHtmlPaths({
    recommendedRoot:setup.recommendedRoot,
    teamsPath:setup.teamsPath,
    handlesPath:setup.handlesPath,
    khaiHoangPath:setup.khaiHoangPath,
  }));
  assert.equal(catalog.legacyTeamsSha256,`sha256:${hash(await readFile(setup.teamsPath))}`);
  assert.equal(catalog.generationId,setup.generationId);
});

test('the season code in the final segment always comes from the row',async t=>{
  const setup=await fixture({recommendedIds:['team-alpha','team-beta'],seasonCodes:{'team-beta':'OG'}});
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  // The same frozen handle in two seasons stays two distinct pages.
  const ledger=await setup.alternativeLedger({handles:{recommended:{'team-alpha':'doi-ba-thuong','team-beta':'doi-ba-thuong'}}},'shared-handle.json');
  const catalog=await build(setup,ledger);

  assert.deepEqual(catalog.recommended.map(entry=>entry.routeSegment),['pk-s24-doi-ba-thuong','og-doi-ba-thuong']);
  assert.deepEqual(catalog.recommended.map(entry=>entry.routePath),['/doi-chuan/pk-s24-doi-ba-thuong/','/doi-chuan/og-doi-ba-thuong/']);
  assert.equal(new Set(catalog.htmlPaths).size,catalog.htmlPaths.length);
});

test('a Recommended row without a usable season code never becomes a route',async t=>{
  const cleanup=[];
  t.after(()=>Promise.all(cleanup.map(setup=>rm(setup.root,{recursive:true,force:true}))));

  for (const seasonCode of ['mùa mới','',null,7,'-S28']) {
    const setup=await fixture({seasonCodes:{'team-alpha':seasonCode}});
    cleanup.push(setup);
    await assert.rejects(build(setup),error=>{
      assert.match(error.message,/season code/i);
      assert.match(error.message,/team-alpha/);
      return true;
    },`must reject ${JSON.stringify(seasonCode)}`);
  }
});

test('the frozen ledger must cover the exact selected keys',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));

  const missingRecommended=await setup.alternativeLedger({handles:{recommended:{'team-alpha':'team-alpha'}}},'missing-recommended.json');
  await assert.rejects(build(setup,missingRecommended),error=>{
    assert.match(error.message,/missing/i);
    assert.match(error.message,/Recommended/i);
    assert.match(error.message,/yxms-049-仙人盾-by大米/);
    return true;
  });

  const extraRecommended=await setup.alternativeLedger({handles:{recommended:{...setup.defaultHandles.recommended,'team-ghost':'team-ghost'}}},'extra-recommended.json');
  await assert.rejects(build(setup,extraRecommended),error=>{
    assert.match(error.message,/unknown/i);
    assert.match(error.message,/team-ghost/);
    return true;
  });

  const missingLegacy=await setup.alternativeLedger({handles:{legacy:{'team-intro-0':'team-intro-0'}}},'missing-legacy.json');
  await assert.rejects(build(setup,missingLegacy),error=>{
    assert.match(error.message,/missing/i);
    assert.match(error.message,/moi-phe-4/);
    return true;
  });

  const extraLegacy=await setup.alternativeLedger({handles:{legacy:{...setup.defaultHandles.legacy,'team-ghost':'team-ghost'}}},'extra-legacy.json');
  await assert.rejects(build(setup,extraLegacy),error=>{
    assert.match(error.message,/unknown/i);
    assert.match(error.message,/team-ghost/);
    return true;
  });
});

test('the frozen ledger must still describe the selected publication',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));

  const staleGeneration=await setup.alternativeLedger({generationId:'9'.repeat(64)},'stale-generation.json');
  await assert.rejects(build(setup,staleGeneration),/generation/i);

  const staleTeams=await setup.alternativeLedger({legacyTeamsSha256:'sha256:'+'9'.repeat(64)},'stale-teams.json');
  await assert.rejects(build(setup,staleTeams),error=>{
    assert.match(error.message,/legacyTeamsSha256/);
    assert.match(error.message,/raw originals/i);
    return true;
  });

  const malformed=[
    ['schema-v1',{schemaVersion:1}],
    ['schema-v3',{schemaVersion:3}],
    ['blank-generation',{generationId:''}],
    ['bad-teams-hash',{legacyTeamsSha256:'not-a-digest'}],
    ['bad-khaihoang-hash',{khaihoangSha256:'not-a-digest'}],
    ['null-handles',{handles:null}],
    ['array-family',{handles:{recommended:[]}}],
    ['missing-family',{handles:{khaihoang:null}}],
    ['unknown-family',{handles:{extra:{}}}],
    ['numeric-handle',{handles:{legacy:{'team-intro-0':7}}}],
  ];
  for (const [name,overrides] of malformed) {
    const path=await setup.alternativeLedger(overrides,`malformed-${name}.json`);
    await assert.rejects(build(setup,path),/team route handle ledger/i,`must reject ${name}`);
  }

  await assert.rejects(build(setup,join(setup.root,'absent-ledger.json')),/ENOENT|no such file/i);
});

test('unroutable and colliding handles never become routes',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const shared=await fixture({recommendedIds:['team-alpha','team-beta']});
  t.after(()=>rm(shared.root,{recursive:true,force:true}));

  for (const handle of ['../secret','teams/legacy','.','team%2fx','team id','x/../y','']) {
    const path=await setup.alternativeLedger({handles:{recommended:{...setup.defaultHandles.recommended,'team-alpha':handle}}},`unroutable-${Buffer.from(handle).toString('hex')}.json`);
    await assert.rejects(build(setup,path),error=>{
      assert.match(error.message,/handle/i);
      assert.match(error.message,/team-alpha/);
      return true;
    },`must reject recommended handle ${JSON.stringify(handle)}`);
  }

  const unroutableLegacy=await setup.alternativeLedger({handles:{legacy:{...setup.defaultHandles.legacy,'moi-phe-4':'/moi-phe-4'}}},'unroutable-legacy.json');
  await assert.rejects(build(setup,unroutableLegacy),/handle/i);

  // The SC-prefixed path is the emitted identity, so two rows may share a handle only across seasons.
  const duplicateRecommended=await shared.alternativeLedger({handles:{recommended:{'team-alpha':'same','team-beta':'same'}}},'duplicate-recommended.json');
  await assert.rejects(build(shared,duplicateRecommended),error=>{
    assert.match(error.message,/duplicate/i);
    assert.match(error.message,/doi-chuan\/pk-s24-same/i);
    return true;
  });

  const duplicateLegacy=await setup.alternativeLedger({handles:{legacy:{...setup.defaultHandles.legacy,'team-intro-1':'team-intro-0'}}},'duplicate-legacy.json');
  await assert.rejects(build(setup,duplicateLegacy),error=>{
    assert.match(error.message,/duplicate/i);
    assert.match(error.message,/team-intro-0/);
    assert.match(error.message,/team-intro-1/);
    return true;
  });
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

test('a custom project root must supply the ledger that belongs to it',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const defaultCatalog=await teamDetailCatalog();
  assert.equal(defaultCatalog.recommended.length,1366);

  // Reusing the worktree ledger for a foreign root fails loudly instead of emitting foreign routes.
  const worktreeLedger=new URL('../pipeline/team-route-handles.json',import.meta.url).pathname;
  await assert.rejects(build(setup,worktreeLedger),error=>{
    assert.match(error.message,/team route handle ledger/i);
    return true;
  });

  // A foreign ledger with the default publication is rejected for the same reason.
  await assert.rejects(
    teamDetailCatalog({handlesPath:setup.handlesPath,khaiHoangPath:setup.khaiHoangPath}),
    /team route handle ledger/i,
  );

  // Custom roots are never served from the default cache, and they never poison it.
  const custom=await teamDetailCatalog({recommendedRoot:setup.recommendedRoot,teamsPath:setup.teamsPath,handlesPath:setup.handlesPath,khaiHoangPath:setup.khaiHoangPath});
  assert.equal(custom.recommended.length,2);
  assert.equal(custom.htmlPaths.length,7);
  assert.equal(custom.generationId,setup.generationId);
  const cached=await teamDetailCatalog();
  assert.equal(cached.generationId,defaultCatalog.generationId);
  assert.equal(cached.recommended.length,1366);
  assert.equal(cached.htmlPaths.length,1549);
});

test('worktree publication yields the real route inventory and pins the real originals',async()=>{
  const catalog=await teamDetailCatalog();
  const teamsBytes=await readFile(new URL('../data/teams.json',import.meta.url));
  const teams=JSON.parse(teamsBytes.toString());
  const khaiHoangBytes=await readFile(new URL('../data/khaihoang.json',import.meta.url));
  const khaiHoangTeams=JSON.parse(khaiHoangBytes.toString()).teams;
  const ledger=JSON.parse(await readFile(new URL('../pipeline/team-route-handles.json',import.meta.url),'utf8'));

  assert.equal(catalog.legacyTeamsSha256,`sha256:${hash(teamsBytes)}`);
  assert.equal(catalog.generationId,ledger.generationId);
  assert.equal(catalog.legacy.length,teams.length);
  assert.deepEqual(catalog.legacy.map(entry=>entry.legacyTeamId).sort(),teams.map(team=>team.id).sort());
  assert.equal(catalog.recommended.length,Object.keys(ledger.handles.recommended).length);
  assert.equal(catalog.recommended.length,1366);
  assert.equal(catalog.legacy.length,166);
  assert.equal(new Set(catalog.recommended.map(entry=>entry.sourceConfigId)).size,catalog.recommended.length);
  assert.equal(catalog.htmlPaths.length,catalog.recommended.length+catalog.legacy.length+catalog.khaiHoang.length);
  assert.equal(new Set(catalog.htmlPaths).size,catalog.htmlPaths.length);
  assert.ok(catalog.variants.length>0);

  // The plan's locked examples must be exactly what this catalog emits.
  const recommended=Object.fromEntries(catalog.recommended.map(entry=>[entry.sourceConfigId,entry]));
  assert.equal(recommended['team-b8ink3'].routeSegment,'pk-s24-tu-ma-phi-hung');
  assert.equal(recommended['team-b8ink3'].routePath,'/doi-chuan/pk-s24-tu-ma-phi-hung/');
  assert.equal(recommended['team-b8ink3'].htmlPath,'doi-chuan/pk-s24-tu-ma-phi-hung/index.html');
  assert.equal(recommended['og-bingyan-40y-lvbu-b'].routePath,'/doi-chuan/og-40y-lu-bo-cung-vuong-di/');
  const legacy=Object.fromEntries(catalog.legacy.map(entry=>[entry.legacyTeamId,entry]));
  assert.equal(legacy['team-intro-1'].routePath,'/doi-khac/hoang-ma-thuong/');

  // Every route derives from its own segment plus the handle the ledger froze.
  for (const entry of catalog.recommended) {
    assert.ok(entry.routeSegment.endsWith(`-${ledger.handles.recommended[entry.sourceConfigId]}`),entry.sourceConfigId);
    assert.match(entry.routeSegment,/^[a-z0-9-]+$/,entry.sourceConfigId);
    assert.ok(Buffer.byteLength(entry.routeSegment)<=128,entry.sourceConfigId);
    assert.equal(entry.routePath,recommendedRoutePath(entry.routeSegment));
    assert.equal(entry.htmlPath,`doi-chuan/${entry.routeSegment}/index.html`);
    assert.match(entry.safeScopeKey,/^s-[0-9a-f]{64}$/);
  }
  for (const entry of catalog.legacy) {
    assert.equal(entry.routeSegment,ledger.handles.legacy[entry.legacyTeamId]);
    assert.equal(entry.routePath,legacyRoutePath(entry.routeSegment));
    assert.equal(entry.htmlPath,`doi-khac/${entry.routeSegment}/index.html`);
  }
  for (const variant of catalog.variants) {
    assert.ok(catalog.legacy.some(entry=>entry.legacyTeamId===variant.legacyTeamId));
    assert.equal(findAdmittedVariant(catalog,variant.legacyTeamId,variant.legacyVariantId).legacyVariantId,variant.legacyVariantId);
  }

  // Khai hoang identity is pinned here and its pages ship in the same emitted inventory.
  assert.equal(ledger.schemaVersion,2);
  assert.equal(catalog.khaiHoangSha256,`sha256:${hash(khaiHoangBytes)}`);
  assert.equal(catalog.khaiHoang.length,khaiHoangTeams.length);
  assert.equal(catalog.khaiHoang.length,17);
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.khaiHoangTeamId),khaiHoangTeams.map(team=>team.id));
  assert.equal(new Set(catalog.khaiHoang.map(entry=>entry.handle)).size,catalog.khaiHoang.length);
  for (const [index,entry] of catalog.khaiHoang.entries()) {
    assert.equal(entry.handle,ledger.handles.khaihoang[entry.khaiHoangTeamId]);
    assert.equal(entry.title,khaiHoangTeams[index].title);
    assert.equal(entry.sourceSha256,catalog.khaiHoangSha256);
    assert.equal(entry.routeSegment,entry.handle);
    assert.equal(entry.routePath,khaiHoangRoutePath(entry.handle));
    assert.equal(entry.htmlPath,`khai-hoang/${entry.handle}/index.html`);
  }
  assert.deepEqual(
    catalog.htmlPaths.filter(path=>path.startsWith('khai-hoang/')),
    catalog.khaiHoang.map(entry=>entry.htmlPath).sort(),
  );
  assert.equal(catalog.htmlPaths.length,1366+166+17);
});

test('Khai hoang route contract: an injected source yields the emitted routes and pins',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const catalog=await build(setup);
  const sourceBytes=await readFile(setup.khaiHoangPath);

  assert.equal(khaiHoangRoutePath('gia-cat-khac-sp-ma-sieu-phap-chinh'),'/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/');
  assert.equal(catalog.khaiHoangSha256,`sha256:${hash(sourceBytes)}`);
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.khaiHoangTeamId),setup.khaiHoangTeams.map(team=>team.id));
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.title),setup.khaiHoangTeams.map(team=>team.title));
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.handle),setup.khaiHoangTeams.map(team=>team.id));
  assert.equal(catalog.khaiHoang[0].routeSegment,'gia-cat-khac-sp-ma-sieu-phap-chinh');
  assert.equal(catalog.khaiHoang[0].routePath,'/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/');
  assert.equal(catalog.khaiHoang[0].htmlPath,'khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/index.html');
  for (const entry of catalog.khaiHoang) assert.equal(entry.sourceSha256,catalog.khaiHoangSha256);

  // The injected source owns the emitted inventory: every prospective route is a real page path.
  assert.equal(catalog.htmlPaths.length,catalog.recommended.length+catalog.legacy.length+catalog.khaiHoang.length);
  assert.deepEqual(
    catalog.htmlPaths.filter(path=>path.startsWith('khai-hoang/')),
    catalog.khaiHoang.map(entry=>entry.htmlPath).sort(),
  );
  assert.deepEqual(catalog.htmlPaths,await teamDetailHtmlPaths({
    recommendedRoot:setup.recommendedRoot,
    teamsPath:setup.teamsPath,
    handlesPath:setup.handlesPath,
    khaiHoangPath:setup.khaiHoangPath,
  }));
});

test('Khai hoang route contract: a v2 ledger reads the v1 Recommended publication',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const catalog=await build(setup);
  const ledger=JSON.parse(await readFile(setup.handlesPath,'utf8'));

  assert.equal(ledger.schemaVersion,2);
  assert.equal(ledger.khaihoangSha256,`sha256:${hash(await readFile(setup.khaiHoangPath))}`);
  assert.deepEqual(Object.keys(ledger.handles).sort(),['khaihoang','legacy','recommended']);
  assert.equal(catalog.generationId,setup.generationId);
  assert.equal(catalog.recommended.length,2);
  assert.equal(catalog.legacy.length,3);
  const published=await Promise.all([
    readFile(join(setup.recommendedRoot,'current.json'),'utf8'),
    readFile(join(setup.recommendedRoot,setup.generationId,'manifest.json'),'utf8'),
    readFile(join(setup.recommendedRoot,setup.generationId,'index.json'),'utf8'),
  ]);
  assert.deepEqual(published.map(document=>JSON.parse(document).schemaVersion),[1,1,1]);
});

test('Khai hoang route contract: source hash, missing, duplicate and unroutable identities are rejected',async t=>{
  const cleanup=[];
  t.after(()=>Promise.all(cleanup.map(setup=>rm(setup.root,{recursive:true,force:true}))));

  const setup=await fixture(); cleanup.push(setup);
  const [firstId,secondId]=setup.khaiHoangTeams.map(team=>team.id);

  const staleSource=await setup.alternativeLedger({khaihoangSha256:'sha256:'+'9'.repeat(64)},'stale-khaihoang-source.json');
  await assert.rejects(build(setup,staleSource),error=>{
    assert.match(error.message,/khaihoangSha256/);
    assert.match(error.message,/Khai hoang source/i);
    return true;
  });

  const missing=await setup.alternativeLedger({handles:{khaihoang:{[firstId]:firstId}}},'missing-khaihoang.json');
  await assert.rejects(build(setup,missing),error=>{
    assert.match(error.message,/missing/i);
    assert.match(error.message,new RegExp(secondId));
    return true;
  });

  const unknown=await setup.alternativeLedger({handles:{khaihoang:{...setup.defaultHandles.khaihoang,'doi-ghost':'doi-ghost'}}},'unknown-khaihoang.json');
  await assert.rejects(build(setup,unknown),error=>{
    assert.match(error.message,/unknown/i);
    assert.match(error.message,/doi-ghost/);
    return true;
  });

  const duplicate=await setup.alternativeLedger({handles:{khaihoang:{...setup.defaultHandles.khaihoang,[secondId]:firstId}}},'duplicate-khaihoang.json');
  await assert.rejects(build(setup,duplicate),error=>{
    assert.match(error.message,/duplicate/i);
    assert.match(error.message,new RegExp(firstId));
    return true;
  });

  for (const handle of ['../secret','khai hoang','',7]) {
    const unroutable=await setup.alternativeLedger({handles:{khaihoang:{...setup.defaultHandles.khaihoang,[secondId]:handle}}},`unroutable-khaihoang-${Buffer.from(String(handle)).toString('hex')}.json`);
    await assert.rejects(build(setup,unroutable),error=>{
      assert.match(error.message,/handle/i);
      assert.match(error.message,new RegExp(secondId));
      return true;
    },`must reject Khai hoang handle ${JSON.stringify(handle)}`);
  }

  const duplicateSource=await fixture({khaiHoangTeams:[...setup.khaiHoangTeams,khaiHoangTeam(setup.khaiHoangTeams[0].title,{id:firstId})]});
  cleanup.push(duplicateSource);
  await assert.rejects(build(duplicateSource),/duplicate Khai hoang identifier/i);

  const missingId=await fixture({khaiHoangTeams:[{title:'Đội thiếu id'}]});
  cleanup.push(missingId);
  await assert.rejects(build(missingId),/Khai hoang team has no id/i);

  const missingTitle=await fixture({khaiHoangTeams:[{id:'doi-thieu-title',title:''}]});
  cleanup.push(missingTitle);
  await assert.rejects(build(missingTitle),/has no title/i);

  const emptySource=await fixture({khaiHoangTeams:[]});
  cleanup.push(emptySource);
  await assert.rejects(build(emptySource),/must contain teams/i);
});

test('Khai hoang route contract: titles and reordering never move a frozen handle',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));
  const frozen=JSON.parse(await readFile(setup.handlesPath,'utf8')).handles.khaihoang;
  const reordered=[...setup.khaiHoangTeams].reverse().map(team=>({...team,title:`${team.title} · bản mới`}));
  const renamedBytes=bytes({teams:reordered});
  await writeFile(setup.khaiHoangPath,renamedBytes);
  const ledger=await setup.alternativeLedger({khaihoangSha256:`sha256:${hash(renamedBytes)}`},'renamed-khaihoang.json');
  const catalog=await build(setup,ledger);

  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.khaiHoangTeamId),reordered.map(team=>team.id));
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.handle),reordered.map(team=>frozen[team.id]));
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.title),reordered.map(team=>team.title));
  for (const entry of catalog.khaiHoang) {
    assert.equal(entry.handle,entry.khaiHoangTeamId);
    assert.equal(entry.handle.includes('ban-moi'),false);
    assert.equal(entry.routePath,khaiHoangRoutePath(frozen[entry.khaiHoangTeamId]));
  }
  // The frozen assignment is untouched by the title edit, and the edited titles would have moved it.
  assert.deepEqual(JSON.parse(await readFile(setup.handlesPath,'utf8')).handles.khaihoang,frozen);
  const [firstTeam]=reordered;
  assert.notEqual(slug(firstTeam.title),frozen[firstTeam.id]);
});

test('Khai hoang route contract: the frozen ledger and the raw data assemble the real routes',async()=>{
  // Injected repository paths only: no default published snapshot and no build.
  const catalog=await teamDetailCatalog({
    recommendedRoot:new URL('../src/data/recommended-reference/',import.meta.url).pathname.replace(/\/$/,''),
    teamsPath:new URL('../data/teams.json',import.meta.url).pathname,
    handlesPath:new URL('../pipeline/team-route-handles.json',import.meta.url).pathname,
    khaiHoangPath:new URL('../data/khaihoang.json',import.meta.url).pathname,
  });
  const ledger=JSON.parse(await readFile(new URL('../pipeline/team-route-handles.json',import.meta.url),'utf8'));
  const khaiHoangBytes=await readFile(new URL('../data/khaihoang.json',import.meta.url));
  const khaiHoangTeams=JSON.parse(khaiHoangBytes.toString()).teams;

  // The wire shape Python writes and TypeScript reads: one ledger schema, one source hash key.
  assert.equal(ledger.schemaVersion,2);
  assert.match(ledger.khaihoangSha256,/^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(ledger.handles).sort(),['khaihoang','legacy','recommended']);

  assert.equal(catalog.khaiHoangSha256,`sha256:${hash(khaiHoangBytes)}`);
  assert.equal(catalog.khaiHoang.length,khaiHoangTeams.length);
  assert.equal(catalog.khaiHoang.length,17);
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.khaiHoangTeamId),khaiHoangTeams.map(team=>team.id));
  assert.deepEqual(catalog.khaiHoang.map(entry=>entry.title),khaiHoangTeams.map(team=>team.title));
  for (const entry of catalog.khaiHoang) {
    assert.equal(entry.handle,ledger.handles.khaihoang[entry.khaiHoangTeamId]);
    assert.equal(entry.routePath,khaiHoangRoutePath(entry.handle));
    assert.equal(entry.htmlPath,`khai-hoang/${entry.handle}/index.html`);
    assert.equal(entry.sourceSha256,catalog.khaiHoangSha256);
  }
  // The emitted inventory covers the Khai hoang pages alongside the two published families.
  assert.equal(catalog.htmlPaths.length,catalog.recommended.length+catalog.legacy.length+catalog.khaiHoang.length);
  assert.deepEqual(
    catalog.htmlPaths.filter(path=>path.startsWith('khai-hoang/')),
    catalog.khaiHoang.map(entry=>entry.htmlPath).sort(),
  );
});

test('Khai hoang route contract: a custom root never falls back to the live Khai hoang source',async t=>{
  const setup=await fixture();
  t.after(()=>rm(setup.root,{recursive:true,force:true}));

  // A custom root that does not name its Khai hoang source is refused outright.
  await assert.rejects(
    teamDetailCatalog({recommendedRoot:setup.recommendedRoot,teamsPath:setup.teamsPath,handlesPath:setup.handlesPath}),
    /must supply its own Khai hoang source/i,
  );
  await assert.rejects(
    teamDetailCatalog({recommendedRoot:setup.recommendedRoot,teamsPath:setup.teamsPath,handlesPath:setup.handlesPath,khaiHoangBytes:undefined}),
    /must supply its own Khai hoang source/i,
  );

  // The repository ledger cannot describe the fixture source ...
  await assert.rejects(
    build(setup,new URL('../pipeline/team-route-handles.json',import.meta.url).pathname),
    /team route handle ledger/i,
  );
  // ... and the fixture source cannot describe the repository publication or ledger.
  await assert.rejects(teamDetailCatalog({khaiHoangPath:setup.khaiHoangPath}),/khaiHoangSha256/i);

  // The fixture run resolves only the injected bytes: the repository Khai hoang file is never read
  // for it, and its own hash is never the one the fixture catalog reports.
  const repositoryBytes=await readFile(new URL('../data/khaihoang.json',import.meta.url));
  const fixtureCatalog=await build(setup);
  assert.equal(fixtureCatalog.khaiHoangSha256,`sha256:${hash(await readFile(setup.khaiHoangPath))}`);
  assert.notEqual(fixtureCatalog.khaiHoangSha256,`sha256:${hash(repositoryBytes)}`);
  assert.equal(fixtureCatalog.khaiHoang.length,setup.khaiHoangTeams.length);
});
