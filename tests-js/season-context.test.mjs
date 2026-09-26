import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSeasonBundle, resolveBrowseState, resolveSeasonContext, projectSeasonCandidates, projectSeasonBrowse, resolveTeamConfig, resolveSelectionScore, selectionFromEntry, canonicalSeasonJSON, seasonFingerprint, configFingerprintProjection, contentFingerprintProjection, SeasonContextError } from '../js/season-context.js';
import { recommendTeams } from '../js/team-recommend-engine.js';
import { seasonFixture, refreshConfigProofs, scoredSelection, context } from './fixtures/season-fixtures.mjs';

test('bundle activates independently, immutable, and strict missing or extra artifacts fail safely', async () => {
  const data = seasonFixture(); const model = await validateSeasonBundle(refreshConfigProofs(data));
  data['season-team-configs'][0].notes = 'outside mutation';
  assert.equal(model.data['season-team-configs'][0].notes, '');
  assert.throws(() => { model.data['season-team-configs'][0].notes = 'mutation'; }, TypeError);
  for (const change of [d => delete d['season-evidence'], d => d.extra = [], d => d['season-registry'][0].bad = true]) {
    const invalid = seasonFixture(); change(invalid);
    await assert.rejects(validateSeasonBundle(invalid), e => e instanceof SeasonContextError && e.code === 'SEASON_BUNDLE_INVALID' && !e.message.includes('outside'));
  }
});

test('context restoration distinguishes no context, scenario only, exact pair and invalid pair', async () => {
  const model = await validateSeasonBundle(seasonFixture());
  assert.equal(resolveBrowseState(model, {}).kind, 'all-reference');
  assert.equal(resolveBrowseState(model, { scenarioId: context.scenarioId }).kind, 'scenario-reference');
  assert.equal(resolveBrowseState(model, { scenarioId: context.scenarioId }, { origin: 'scenario-change' }).kind, 'verified-pair');
  assert.equal(resolveBrowseState(model, context).kind, 'verified-pair');
  for (const pair of [{rulesetId:'rules-a'}, {scenarioId:'wrong'}, {...context,rulesetId:'wrong'}]) {
    assert.equal(resolveBrowseState(model, pair).kind, 'invalid');
    assert.equal(resolveSeasonContext(model,pair).ok,false);
  }
});

test('reviewed scenario attribution never authorizes rulesets or unreviewed configs', async () => {
  const bad = seasonFixture(); bad['season-registry'][0].rulesets[0].evidenceRefs = ['scenario-proof'];
  await assert.rejects(validateSeasonBundle(bad), SeasonContextError);
  const pending = seasonFixture(); pending['season-team-configs'][0].reviewStatus = 'pending';
  pending['season-team-evaluations'] = [];
  const model = await validateSeasonBundle(refreshConfigProofs(pending));
  assert.equal(projectSeasonCandidates(model,context).teams.length,0);
});

test('references resolve actual dictionary identity and ordered slots, not prefixes', async () => {
  for (const mutate of [d=>d['season-team-configs'][0].heroSlots[0].heroRefs=['hero:missing'], d=>d['season-team-configs'][0].heroSlots.pop(), d=>d['season-team-configs'][0].heroSlots[0].tacticSlots.pop(), d=>d['season-team-configs'][0].teamId='missing']) {
    const data=seasonFixture();mutate(data);await assert.rejects(validateSeasonBundle(refreshConfigProofs(data)),SeasonContextError);
  }
  const model=await validateSeasonBundle(seasonFixture());
  const projected=projectSeasonCandidates(model,context);
  assert.equal(projected.ok,true);assert.equal(projected.teams[0].id,'team-a');
  assert.equal(projected.teams[0].candidateKey,'config-a');
  assert.deepEqual(projected.teams[0].heroes.map(h=>h.name),['Anh','Bình','Cường']);
  assert.equal(projected.teamTier[0].candidateKey,'config-a');
});

test('unresolved default tier stays null and opt-in cannot bypass mandatory requirements',async()=>{
  const data=seasonFixture();data['season-team-evaluations'][0].rankings.push({id:'rank-b',tier:'T1',evidenceRefs:['rule-proof']});data['season-team-evaluations'][0].defaultRankingId=null;
  let model=await validateSeasonBundle(refreshConfigProofs(data));
  assert.equal(projectSeasonCandidates(model,context).teams.length,0);
  assert.equal(projectSeasonCandidates(model,context,{experimentalUntiered:true}).teamTier[0].rankings.length,0);
  data['season-team-configs'][0].requirements=[{id:'advisor',kind:'advisor',mandatory:true,reviewStatus:'reviewed',descriptionRaw:'Cần quân sư',evidenceRefs:['rule-proof']}];
  model=await validateSeasonBundle(refreshConfigProofs(data));const result=projectSeasonCandidates(model,context,{experimentalUntiered:true});
  assert.equal(result.teams.length,0);assert.equal(result.diagnostics[0].code,'REQUIREMENT_UNVERIFIED');
  assert.equal(projectSeasonBrowse(model,resolveBrowseState(model,context)).applicable.length,1);
  data['season-team-configs'][0].requirements[0].supported=true;
  await assert.rejects(validateSeasonBundle(refreshConfigProofs(data)),SeasonContextError);
});

test('candidate cap counts eligible configs after scope and policy, never truncates executable input',async()=>{
  const data=seasonFixture();const config=data['season-team-configs'][0], evaluation=data['season-team-evaluations'][0];
  data['season-team-configs']=Array.from({length:501},(_,i)=>({...structuredClone(config),id:`config-${i}`}));
  data['season-team-evaluations']=data['season-team-configs'].map((c,i)=>({...structuredClone(evaluation),id:`eval-${i}`,configId:c.id}));
  let model=await validateSeasonBundle(refreshConfigProofs(data));let projected=projectSeasonCandidates(model,context);
  assert.equal(projected.ok,false);assert.equal(projected.code,'CANDIDATE_LIMIT_EXCEEDED');assert.deepEqual(projected.limits,{maxCandidates:500,candidateCount:501});assert.deepEqual(projected.teams,[]);
  data['season-team-configs'][0].reviewStatus='pending';data['season-team-evaluations'].shift();
  model=await validateSeasonBundle(refreshConfigProofs(data));projected=projectSeasonCandidates(model,context);
  assert.equal(projected.ok,true);assert.equal(projected.teams.length,500);
});

test('exact lookup rejects ambiguity and wrong context instead of selecting first team config',async()=>{
  const data=seasonFixture();data['season-team-configs'].push({...structuredClone(data['season-team-configs'][0]),id:'config-b'});
  const model=await validateSeasonBundle(refreshConfigProofs(data));
  const ambiguous=resolveTeamConfig(model,{teamId:'team-a',context});
  assert.equal(ambiguous.code,'CONFIG_AMBIGUOUS');assert.equal(ambiguous.choices.configIds.length,2);
  assert.equal(resolveTeamConfig(model,{configId:'config-b',context}).config.id,'config-b');
  assert.equal(resolveTeamConfig(model,{configId:'config-a',context:{...context,rulesetId:'missing'}}).ok,false);
});

test('canonical fingerprint bytes preserve Unicode and array order, reject unsafe numbers',async()=>{
  const value={z:['Thương',2],a:{đ:'ữ'}};const expected='{"a":{"đ":"ữ"},"z":["Thương",2]}';
  assert.equal(canonicalSeasonJSON(value),expected);
  assert.equal(await seasonFingerprint(value),`sha256:${createHash('sha256').update(expected).digest('hex')}`);
  assert.throws(()=>canonicalSeasonJSON({a:1.2}));assert.throws(()=>canonicalSeasonJSON({a:Number.MAX_SAFE_INTEGER+1}));
});

async function scoreFixture(){
  const data=seasonFixture(),config=data['season-team-configs'][0];config.heroSlots[0].tacticSlots[0].tacticRefs.push('tactic:bay');
  refreshConfigProofs(data);
  const selection=scoredSelection(config);
  data['season-team-evaluations'][0].sourceScore={provider:'sgsdeck',value:132.5,sourceConfigId:'source-a',sourceSeason:{label:'Fixture'},provenance:{provider:'sgsdeck',region:'VN',sourceUrl:'https://example.org/recommended',fetchedAt:'2026-09-12'},evidenceRefs:['score-proof'],sourceSnapshotHash:`sha256:${'a'.repeat(64)}`,configFingerprint:await seasonFingerprint(configFingerprintProjection(config)),selectionFingerprint:await seasonFingerprint(selection),scoredSelection:selection};
  data['season-evidence'].push({...structuredClone(data['season-evidence'].find(p=>p.id===config.evidenceRefs[0])),id:'score-proof',provenance:{...data['season-team-evaluations'][0].sourceScore.provenance},snapshotHash:data['season-team-evaluations'][0].sourceScore.sourceSnapshotHash,sourceSeason:structuredClone(data['season-team-evaluations'][0].sourceScore.sourceSeason)});
  return data;
}

test('score validates exact hashes and invalidates changed, missing and wrong-holder selections',async()=>{
  const data=await scoreFixture();const model=await validateSeasonBundle(refreshConfigProofs(data)), selection=data['season-team-evaluations'][0].sourceScore.scoredSelection;
  assert.equal(resolveSelectionScore(model,'config-a',selection).value,132.5);
  for(const mutate of [s=>s.heroSlots[0].tacticRefs[0]='tactic:bay',s=>s.heroSlots.reverse(),s=>s.heroSlots[0].bookRefs.pop(),s=>s.rulesetId='wrong']){
    const altered=structuredClone(selection);mutate(altered);assert.equal(resolveSelectionScore(model,'config-a',altered),null);
  }
  data['season-team-evaluations'][0].sourceScore.selectionFingerprint=`sha256:${'b'.repeat(64)}`;
  await assert.rejects(validateSeasonBundle(refreshConfigProofs(data)),SeasonContextError);
});

test('final portfolio alternative does not inherit original source score',async()=>{
  const data=await scoreFixture(),model=await validateSeasonBundle(refreshConfigProofs(data)),projected=projectSeasonCandidates(model,context);
  const result=recommendTeams({...projected,seasonContext:context,ownedHeroes:['Anh','Bình','Cường'],ownedTactics:['Hai','Ba','Bốn','Năm','Sáu','Bảy']});
  const entry=result.portfolioTeams[0];assert.equal(entry.configId,'config-a');
  const selection=selectionFromEntry(model,entry);assert.ok(selection);
  assert.equal(selection.heroSlots[0].tacticRefs[0],'tactic:bay');
  assert.equal(resolveSelectionScore(model,entry.configId,selection),null);
});

test('current real registry without reviewed rules remains valid scenario reference',async()=>{
  const data=seasonFixture();for(const key of ['season-registry','season-evidence'])data[key]=JSON.parse(await readFile(new URL(`../data/${key}.json`,import.meta.url).pathname.replace('/tests-js/data/','/data/'),'utf8'));
  data['season-team-configs']=[];data['season-team-evaluations']=[];
  const model=await validateSeasonBundle(refreshConfigProofs(data));const scenario=model.data['season-registry'].find(s=>s.id==='binh-dien-xuan-thu');
  assert.ok(scenario);assert.equal(resolveBrowseState(model,{scenarioId:scenario.id},{origin:'scenario-change'}).kind,'scenario-reference');
  assert.equal(projectSeasonCandidates(model,{scenarioId:scenario.id}).ok,false);
});

async function referenceFixture(){
  const data=seasonFixture();
  const source={id:'fixture-sheet',url:'https://example.org/sheet',sheetId:'sheet-fixture',gid:'123',format:'csv',snapshotHash:`sha256:${'c'.repeat(64)}`,disclaimerRaw:'Tham khảo nguồn\nGiữ nguyên điều kiện.'};
  const team={recordId:'source-team-a',sourceLocator:{csvRecordStart:2,csvRecordEnd:4,lineStart:2,lineEnd:7},teamNameRaw:'Đội A (chủ lực)',teamName:'Đội A',unitTacticEffectsRaw:'Cải tạo\nGiữ điều kiện',heroes:['Anh (quân sư)','Bình','Cường'].map(name=>({nameRaw:name,tacticSlotsRaw:['Lựa chọn A / B',''],statFocusRaw:'1/2 Trí\n1/2 Thống',bookSlotsRaw:['Binh thư','','']}))};
  team.contentFingerprint=await seasonFingerprint(contentFingerprintProjection(team));
  const payload={groupLabel:'Nhóm A',summaryRaw:'Dòng một\nDòng hai',openingSuggestionsRaw:'Gợi ý khai hoang',notesRaw:'<img src=x onerror=alert(1)>',teams:[team]};
  data['season-evidence'].push({schemaVersion:1,id:'source-proof',provenance:{provider:'google-sheets',region:'VN',sourceUrl:source.url,fetchedAt:'2026-09-12'},canonicalRef:null,note:'Source only',reviewStatus:'reviewed',claim:{kind:'source-observation',scenarioId:null,rulesetId:null},snapshotHash:source.snapshotHash});
  data['season-evidence'].push({...structuredClone(data['season-evidence'][0]),id:'source-attribution',provenance:{...data['season-evidence'].at(-1).provenance}});
  data['season-content-links']=[{schemaVersion:1,id:'link-a',kind:'coexist',recordId:'source-group-a',scenarioId:'scenario-a',rulesetId:null,configIds:[],reviewStatus:'reviewed',evidenceRefs:['source-attribution','source-proof'],target:{type:'source-owned-coexist',source,payload,contentFingerprint:await seasonFingerprint(contentFingerprintProjection(payload))}}];
  data.coexist=[{groupLabel:'Unknown old group',teams:[]}];
  return data;
}

test('source reference stays out of applicable counts, preserves raw text, and unknown stays all-reference only',async()=>{
  const data=await referenceFixture(),model=await validateSeasonBundle(data);
  const scoped=projectSeasonBrowse(model,resolveBrowseState(model,context));
  assert.equal(scoped.coexist.applicable.length,0);assert.equal(scoped.coexist.scenarioReference.length,1);assert.equal(scoped.coexist.unknown.length,0);
  assert.equal(scoped.coexist.scenarioReference[0].content.notesRaw,'<img src=x onerror=alert(1)>');
  assert.equal(scoped.coexist.scenarioReference[0].content.teams[0].heroes[0].statFocusRaw,'1/2 Trí\n1/2 Thống');
  const all=projectSeasonBrowse(model,resolveBrowseState(model,{}));assert.equal(all.coexist.unknown.length,1);
  const scenario=projectSeasonBrowse(model,resolveBrowseState(model,{scenarioId:'scenario-a'}));assert.equal(scenario.coexist.scenarioReference.length,1);
});

test('source discriminator, nested slots, unsafe URLs and stale content hashes reject the whole bundle',async()=>{
  for(const mutate of [d=>d['season-content-links'][0].target.locator={groupIndex:0},d=>d['season-content-links'][0].target.source.url='javascript:alert(1)',d=>d['season-content-links'][0].target.payload.teams[0].heroes.pop(),d=>d['season-content-links'][0].target.payload.notesRaw='Changed',d=>d['season-content-links'][0].recordId='source-team-a']){
    const data=await referenceFixture();mutate(data);await assert.rejects(validateSeasonBundle(data),SeasonContextError);
  }
});

test('reference requires both same-source scenario attribution and matching snapshot observation',async()=>{
  for(const change of ['attribution','observation']){
    const data=await referenceFixture();const proof=data['season-evidence'].find(p=>p.id===(change==='attribution'?'source-attribution':'source-proof'));
    if(change==='attribution')proof.provenance.sourceUrl='https://example.org/other';else proof.claim={kind:'scenario-attribution',scenarioId:'scenario-a',rulesetId:null};
    await assert.rejects(validateSeasonBundle(data),SeasonContextError);
  }
});

test('legacy locator resolves only one fingerprint match and rejects mismatched position or duplicate content',async()=>{
  const data=seasonFixture();data.coexist=[{groupLabel:'Legacy A',teams:[]}];
  data['season-content-links']=[{schemaVersion:1,id:'legacy-a',kind:'coexist',recordId:'legacy-group-a',scenarioId:null,rulesetId:null,configIds:[],reviewStatus:'pending',evidenceRefs:[],target:{type:'legacy-locator',dataset:'coexist',locator:{groupIndex:0},contentFingerprint:await seasonFingerprint(data.coexist[0])}}];
  let model=await validateSeasonBundle(data);assert.equal(projectSeasonBrowse(model,resolveBrowseState(model,{})).coexist.unknown.length,1);
  data.coexist.push(structuredClone(data.coexist[0]));await assert.rejects(validateSeasonBundle(data),SeasonContextError);
});

test('config review cannot be reused after fingerprinted content changes',async()=>{
  const data=seasonFixture();data['season-team-configs'][0].heroSlots[0].statFocusRaw='Changed allocation';
  await assert.rejects(validateSeasonBundle(data),SeasonContextError);
});

test('Python-generated canonical and configuration golden vectors match JavaScript',async()=>{
  const vectors=JSON.parse(await readFile(new URL('../tests/fixtures/season-fingerprint-vectors.json',import.meta.url),'utf8'));
  assert.equal(canonicalSeasonJSON(configFingerprintProjection(vectors.config)),vectors.configCanonical);
  assert.equal(await seasonFingerprint(configFingerprintProjection(vectors.config)),vectors.configFingerprint);
  assert.equal(await seasonFingerprint(vectors.unicodeValue),vectors.unicodeFingerprint);
});

test('ambiguous configuration choices are sorted, bounded twenty, and report total omitted count',async()=>{
  const data=seasonFixture(),config=data['season-team-configs'][0];
  data['season-team-configs']=Array.from({length:21},(_,i)=>({...structuredClone(config),id:`config-${String(20-i).padStart(2,'0')}`}));data['season-team-evaluations']=[];
  const model=await validateSeasonBundle(refreshConfigProofs(data));const result=resolveTeamConfig(model,{teamId:'team-a',context});
  assert.deepEqual(result.choices,{kind:'team-config',teamId:'team-a',configIds:Array.from({length:20},(_,i)=>`config-${String(i).padStart(2,'0')}`),totalCount:21,omittedCount:1});
  assert.equal(projectSeasonBrowse(model,resolveBrowseState(model,context)).applicable.length,21);
});

test('score evidence source season cannot be borrowed from another source season',async()=>{
  const data=await scoreFixture();data['season-evidence'].find(p=>p.id==='score-proof').sourceSeason={label:'Different source season'};
  await assert.rejects(validateSeasonBundle(data),SeasonContextError);
});

test('Unicode canonical key ordering uses code points matching Python, including supplementary characters',()=>{
  assert.equal(canonicalSeasonJSON({'𐀀':1,'\uE000':2}),'{'+'"\uE000":2,"𐀀":1}');
});

test('tier cannot borrow generic ruleset evidence that does not bind the exact config fingerprint',async()=>{
  const data=seasonFixture();data['season-team-evaluations'][0].rankings[0].evidenceRefs=['rule-proof'];
  await assert.rejects(validateSeasonBundle(data),SeasonContextError);
});

test('complete scored selections reject duplicate heroes, duplicate tactics and unreviewed conditions',async()=>{
  for(const kind of ['hero','tactic','requirement']){
    const data=await scoreFixture(),config=data['season-team-configs'][0],score=data['season-team-evaluations'][0].sourceScore;
    if(kind==='hero'){config.heroSlots[1].heroRefs.push('hero:anh');score.scoredSelection.heroSlots[1].heroRef='hero:anh';}
    if(kind==='tactic'){config.heroSlots[1].tacticSlots[0].tacticRefs.push('tactic:mot');score.scoredSelection.heroSlots[1].tacticRefs[0]='tactic:mot';}
    if(kind==='requirement'){config.requirements=[{id:'condition',kind:'other',mandatory:true,reviewStatus:'pending',descriptionRaw:'Unknown condition',evidenceRefs:[]}];score.scoredSelection.requirementIds=['condition'];}
    refreshConfigProofs(data);score.configFingerprint=await seasonFingerprint(configFingerprintProjection(config));score.selectionFingerprint=await seasonFingerprint(score.scoredSelection);
    const proof=data['season-evidence'].find(p=>p.id==='score-proof');proof.configFingerprint=score.configFingerprint;
    await assert.rejects(validateSeasonBundle(data),SeasonContextError);
  }
});

test('locked context warning depends on applicability, not recommendation tier filtering',async()=>{
  const data=seasonFixture();data['season-team-evaluations'][0].rankings[0].tier='T3';
  const model=await validateSeasonBundle(data);
  const scoped=projectSeasonCandidates(model,context,{lockedTeams:[{teamId:'team-a',configId:'config-a'}]});
  assert.equal(scoped.teams.length,0);assert.equal(scoped.diagnostics.some(d=>d.code==='LOCKED_TEAM_OUT_OF_SCOPE'),false);
  const outside=projectSeasonCandidates(model,context,{lockedTeams:[{teamId:'another-team'}]});
  assert.equal(outside.diagnostics[0].code,'LOCKED_TEAM_OUT_OF_SCOPE');
});

test('provenance rejects browser-normalized non-authority URLs and invalid clock times',async()=>{
  for(const update of [{sourceUrl:'https:example.org/path'},{fetchedAt:'2026-09-12T24:00:00Z'}]){
    const data=seasonFixture();Object.assign(data['season-evidence'][0].provenance,update);
    await assert.rejects(validateSeasonBundle(data),SeasonContextError);
  }
});

test('exact config lookup requires an explicit valid team or config identity',async()=>{
  const model=await validateSeasonBundle(seasonFixture());
  for(const request of [{context},{teamId:'',context},{configId:null,context},{configId:'config-a',context,unrecognized:true},null]){
    assert.equal(resolveTeamConfig(model,request).ok,false);
  }
});

for (const [count, fullBox, missingResource] of [
  [61, false, 'hero'], [81, true, 'hero'],
  [61, false, 'tactic'], [81, true, 'tactic'],
  [500, false, 'hero'], [500, true, 'hero'],
]) {
  test(`seasonal feasibility reaches the last of ${count} configs with missing ${missingResource}s (fullBox=${fullBox})`, async () => {
    const data = seasonFixture();
    const original = data['season-team-configs'][0];
    const evaluation = data['season-team-evaluations'][0];
    data.teams.push({ ...structuredClone(data.teams[0]), id: 'team-owned', name: 'Owned team' });
    data['season-team-configs'] = Array.from({ length: count }, (_, index) => {
      const config = structuredClone(original);
      config.id = `config-${String(index).padStart(3, '0')}`;
      if (index === count - 1) config.teamId = 'team-owned';
      else if (missingResource === 'hero') config.heroSlots.forEach((slot, i) => {
        slot.heroRefs = [['hero:dung', 'hero:em', 'hero:giang'][i]];
      });
      else config.heroSlots[0].tacticSlots[0].tacticRefs = ['tactic:bay'];
      return config;
    });
    data['season-team-evaluations'] = data['season-team-configs'].map(config => ({
      ...structuredClone(evaluation), id: `eval-${config.id}`, configId: config.id,
    }));
    const model = await validateSeasonBundle(refreshConfigProofs(data));
    const projected = projectSeasonCandidates(model, context);
    assert.equal(projected.ok, true);
    assert.equal(projected.limits.candidateCount, count);
    const result = recommendTeams({
      ...projected, ownedHeroes: ['Anh', 'Bình', 'Cường'],
      ownedTactics: ['Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu'], fullBox, maxTeams: 1,
    });
    assert.deepEqual(result.portfolioTeams.map(entry => entry.configId), [`config-${String(count - 1).padStart(3, '0')}`]);
  });
}

for (const fullBox of [false, true]) {
  test(`seasonal same-team configs do not crowd out a compatible team (fullBox=${fullBox})`, async () => {
    const data = seasonFixture();
    const original = data['season-team-configs'][0];
    const evaluation = data['season-team-evaluations'][0];
    data.teams.push({ ...structuredClone(data.teams[0]), id: 'team-second', name: 'Second team' });
    const extraTactics = Array.from({ length: 6 }, (_, i) => ({ viet: `Extra ${i + 1}`, chinese: `Extra ${i + 1}` }));
    data.tactics.push(...extraTactics);
    data['season-team-configs'] = Array.from({ length: 61 }, (_, index) => {
      const config = structuredClone(original);
      config.id = `config-${String(index).padStart(3, '0')}`;
      if (index === 60) {
        config.teamId = 'team-second';
        config.heroSlots.forEach((slot, i) => {
          slot.heroRefs = [['hero:dung', 'hero:em', 'hero:giang'][i]];
          slot.tacticSlots.forEach((tactic, j) => { tactic.tacticRefs = [`tactic:extra-${i * 2 + j + 1}`]; });
        });
      }
      return config;
    });
    data['season-team-evaluations'] = data['season-team-configs'].map(config => ({
      ...structuredClone(evaluation), id: `eval-${config.id}`, configId: config.id,
    }));
    const model = await validateSeasonBundle(refreshConfigProofs(data));
    const projected = projectSeasonCandidates(model, context);
    assert.equal(projected.ok, true);
    const result = recommendTeams({
      ...projected, ownedHeroes: data['heroes-dict'].map(hero => hero.viet),
      ownedTactics: data.tactics.map(tactic => tactic.viet), fullBox, maxTeams: 2,
    });
    assert.deepEqual(result.portfolioTeams.map(entry => entry.configId), ['config-000', 'config-060']);
    assert.equal(new Set(result.portfolioTeams.map(entry => entry.team.id)).size, 2);
  });
}

test('raw text keeps newline, carriage return and tab but rejects other control, format and private-use characters', async () => {
  const outcome = async notes => {
    const data = seasonFixture(); data['season-team-configs'][0].notes = notes;
    try { await validateSeasonBundle(refreshConfigProofs(data)); return 'ok'; } catch (error) { assert.ok(error instanceof SeasonContextError); return 'rejected'; }
  };
  assert.equal(await outcome('Dòng 1\nDòng 2\r\n\tthụt lề'), 'ok');
  for (const bad of ['a\u0000b', 'a\u0007b', 'a\u200bb', 'a\ue000b']) assert.equal(await outcome(bad), 'rejected', JSON.stringify(bad));
});
