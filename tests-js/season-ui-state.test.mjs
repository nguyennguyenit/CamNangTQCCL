import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeRosterScanState } from '../js/roster-scan-state.js';
import { readSeasonQuery, updateSeasonURL, compareSeasonInventory, filterSeasonRows, validateTeamFilters, loadSeasonModel } from '../js/season-ui-state.js';
import { validateSeasonBundle, projectSeasonBrowse } from '../js/season-context.js';
import { seasonConsumerFixture } from './fixtures/season-fixtures.mjs';
import { createHash } from 'node:crypto';

test('serialized inventory retains locked configuration identity across scope changes', () => {
  const lock={teamName:'Locked',teamId:'team-a',configId:'config-a',seasonContext:{scenarioId:'scenario-a',rulesetId:'rules-a'},heroes:['Anh'],tactics:['Một']};
  assert.deepEqual(serializeRosterScanState({lockedTeams:[lock]}).lockedTeams,[lock]);
});
test('hash activation rejects changed referenced bytes and allows only the full bundle', async()=>{
  const data=await seasonConsumerFixture();
  const encoded=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,new TextEncoder().encode(JSON.stringify(value))]));
  const hashes=Object.fromEntries(Object.entries(encoded).map(([key,bytes])=>[key,'sha256:'+createHash('sha256').update(bytes).digest('hex')]));
  const model=await loadSeasonModel(hashes,key=>encoded[key]);assert.equal(model.data.teams.length,2);
  encoded.teams=new TextEncoder().encode(JSON.stringify([...data.teams,{id:'unexpected'}]));
  await assert.rejects(loadSeasonModel(hashes,key=>encoded[key]),/Không xác thực/);
  delete hashes['season-evidence'];await assert.rejects(loadSeasonModel(hashes,key=>encoded[key]));
});
test('restored scenario URL stays reference while duplicate context stays invalid',async()=>{
  const model=await validateSeasonBundle(await seasonConsumerFixture());
  assert.equal(readSeasonQuery('https://local/?scenario=scenario-a',model).browse.kind,'scenario-reference');
  assert.equal(readSeasonQuery('https://local/?scenario=scenario-a&scenario=scenario-a',model).browse.kind,'invalid');
  assert.equal(readSeasonQuery('https://local/?ruleset=rules-a',model).browse.kind,'invalid');
});
test('filter query preserves OR groups, ignores obsolete stars and sorts original unbounded score',async()=>{
  const model=await validateSeasonBundle(await seasonConsumerFixture());
  const state=readSeasonQuery('https://local/?scenario=scenario-a&ruleset=rules-a&stars=0&unit=Thương&unit=invalid&sort=sgsdeck-score',model);
  const rows=projectSeasonBrowse(model,state.browse).applicable;
  const query=validateTeamFilters(rows,state);
  assert.equal(filterSeasonRows(rows,query).length,3);
  assert.equal(filterSeasonRows(rows,query)[0].sourceScore.value,132.5);
  assert.deepEqual(query.filters.unit,['Thương']);assert.equal(query.notices.length,2);
  const next=updateSeasonURL('https://local/?scenario=scenario-a&config=config-a#meta-cu',{q:'Bình',unit:['Thương','Cung'],config:null});
  assert.equal(next.hash,'#meta-cu');assert.equal(next.searchParams.get('scenario'),'scenario-a');assert.deepEqual(next.searchParams.getAll('unit'),['Thương','Cung']);
});
test('inventory comparison keeps SP distinct, detects duplicate holders and retained locked resources',()=>{
  const result=compareSeasonInventory({heroSlots:[{heroRef:'hero:sp-anh',tacticRefs:['tactic:mot','tactic:hai']},{heroRef:'hero:binh',tacticRefs:['tactic:mot','tactic:ba']}],requirementIds:['condition'],effectBundleIds:[]},{ownedHeroes:[{name:'Anh'},{name:'Bình'}],ownedTactics:[{name:'Một'},{name:'Hai'},{name:'Ba'}],lockedTeams:[{heroes:['Bình'],tactics:['Một']}]});
  assert.deepEqual(result.missingHeroes,['hero:sp-anh']);assert.equal(result.duplicateTactics,true);assert.deepEqual(result.lockedHeroes,['hero:binh']);assert.equal(result.requirementsUnknown,true);
});
test('repeated or empty scalar filter/config values are discarded with a notice',async()=>{
  const model=await validateSeasonBundle(await seasonConsumerFixture());
  const state=readSeasonQuery('https://local/?config=config-a&config=config-b&sort=tier&sort=sgsdeck-score&q=Anh&q=Bình',model);
  assert.equal(state.configId,null);assert.equal(state.query,'');assert.equal(state.sort,'tier');
  assert.ok(state.notices.some(value=>value.includes('không hợp lệ')));
  assert.ok(readSeasonQuery('https://local/?config=',model).notices.length);
});
