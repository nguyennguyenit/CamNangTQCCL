import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
function trackedScreenshotHashes() {
  const files = execFileSync('git', ['ls-files', '-z', '--', '*.png'], {cwd:repositoryRoot,encoding:'utf8'}).split('\0').filter(Boolean);
  return Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(join(repositoryRoot, path))).digest('hex')]));
}
let originalScreenshotHashes;
test.beforeAll(() => { originalScreenshotHashes = trackedScreenshotHashes(); });
test.afterAll(() => {
  expect(trackedScreenshotHashes(), 'Browser tests must preserve committed screenshot evidence').toEqual(originalScreenshotHashes);
});

test.beforeEach(async ({page}) => {
  await page.route('https://challenges.cloudflare.com/**', route => route.fulfill({contentType:'application/javascript',body:'window.turnstile={render(){},reset(){}};'}));
});
test('real scenario-only scope remains reference and preserves Khai hoang', async ({page}) => {
  await page.goto('/#team-pk');
  await expect(page.getByLabel('Kịch bản đang chơi', {exact:true})).toBeVisible();
  await expect(page.locator('#season-summary')).toContainText('Tất cả — tham khảo');
  await expect(page.locator('#section-team-pk .badge.stars')).toHaveCount(0);
  await expect(page.locator('#section-heroes .badge.stars').first()).toBeAttached();
  const values = await page.locator('#season-scenario option').evaluateAll(nodes => nodes.map(n=>n.value).filter(Boolean));
  await page.locator('#season-scenario').selectOption(values.find(v=>v.includes('binh')) || values.at(-1));
  await expect(page.locator('#season-summary')).toContainText('tham khảo');
  await expect(page.locator('#season-ruleset')).toHaveValue('');
  await page.locator('[data-section="coexist"]').click();
  await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(25);
  await page.locator('[data-section="khaihoang"]').click();
  await expect(page.locator('#season-controls')).toBeHidden();
  await expect(page.locator('.tagline')).toContainText('mới nhất');
});

import { createHash } from 'node:crypto';
import { seasonConsumerFixture } from '../tests-js/fixtures/season-fixtures.mjs';
async function controlledBundle(page, data = null) {
  data ||= await seasonConsumerFixture();
  const hashes = Object.fromEntries(Object.entries(data).map(([key,value]) => [key, 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex')]));
  await page.route('**/data/*.json', async route => {
    const key = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');
    if (key in data) return route.fulfill({contentType:'application/json',body:JSON.stringify(data[key])});
    return route.continue();
  });
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/(<script[^>]*id="season-artifact-hashes"[^>]*>)[\s\S]*?(<\/script>)/, (_,start,end)=> start + JSON.stringify(hashes) + end);
    await route.fulfill({response,body:html});
  });
  return data;
}
test('verified fixture displays separate config cards, ordered detail and exact source score', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#team-pk');
  await expect(page.locator('[data-config-id="config-a"]')).toHaveCount(1);
  await expect(page.locator('[data-config-id="config-b"]')).toHaveCount(1);
  await expect(page.locator('[data-config-id="config-a"]')).toContainText('Điểm SGSDeck: 132.5');
  await expect(page.locator('[data-config-id="config-a"]')).toContainText('Kịch bản A · Luật A');
  await page.locator('[data-config-id="config-b"]').getByRole('button',{name:'Chi tiết cấu hình'}).click();
  await expect(page).toHaveURL(/config=config-b/);
  await expect(page.locator('#season-config-detail')).toContainText('Chiến pháp 1: Hai');
  await expect(page.locator('#season-config-detail')).toContainText('Chưa có điểm SGSDeck');
  await page.goBack();
  await expect(page.locator('#season-config-detail')).toBeHidden();
  await page.locator('#section-team-pk input[type="search"]').fill('cuong');
  await expect(page).toHaveURL(/q=cuong/);
  await page.reload();
  await expect(page.locator('#section-team-pk input[type="search"]')).toHaveValue('cuong');
});
test('detail compares real inventory and changing a selected tactic removes its source score', async ({page}) => {
  await controlledBundle(page);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1', JSON.stringify({ownedHeroes:[{name:'Anh'},{name:'Bình'},{name:'Cường'}],ownedTactics:[{name:'Một'},{name:'Hai'},{name:'Ba'},{name:'Bốn'},{name:'Năm'},{name:'Sáu'}],lockedTeams:[],confirmed:true})));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#team-pk');
  await expect(page.getByRole('button',{name:'Đối chiếu kho của tôi'})).toBeVisible();
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('Đủ tướng và chiến pháp');
  await expect(page.locator('.season-inventory-comparison')).toContainText('Binh thư: chưa kiểm chứng');
  await page.getByLabel('Tướng 1 · Chiến pháp 1',{exact:true}).selectOption('tactic:bay');
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toContainText('Chưa có điểm SGSDeck');
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('Thiếu chiến pháp: Bảy');
});
test('roster runs exact configs, then scope change clears portfolio and confirmation while retaining inventory', async ({page}) => {
  await controlledBundle(page);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1', JSON.stringify({ownedHeroes:[{name:'Anh'},{name:'Bình'},{name:'Cường'}],ownedTactics:['Một','Hai','Ba','Bốn','Năm','Sáu'].map(name=>({name})),lockedTeams:[],confirmed:true})));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await page.getByRole('button',{name:'Xác nhận dữ liệu scan'}).click();
  await page.getByRole('button',{name:'Gợi ý 5 team',exact:true}).click();
  await expect(page.locator('.roster-results > section:first-child [data-config-id="config-a"]')).toHaveCount(1);
  await expect(page.locator('.roster-results')).toContainText('Điểm SGSDeck: 132.5');
  await page.locator('#season-ruleset').selectOption('');
  await expect(page.locator('.roster-results')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Gợi ý 5 team',exact:true})).toBeDisabled();
  await expect(page.locator('#section-roster-recommend')).toContainText('Chọn phiên bản luật');
  const state = await page.evaluate(()=>JSON.parse(localStorage.getItem('tqccl.rosterRecommend.scanState.v1')));
  expect(state.ownedHeroes).toHaveLength(3);
  expect(state.confirmed).toBe(false);
});
test('scenario-only analysis blocks matching and offers explicit out-of-scope reference choice', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=scenario-a#analyze');
  await expect(page.locator('#section-analyze .season-gameplay-notice')).toContainText('Chọn phiên bản luật');
  await expect(page.getByRole('button',{name:'Soi đội',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Xem đội ngoài phạm vi để tham khảo')).toBeVisible();
});
test('coexist search uses scoped raw text, retains query and escapes source markup', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=scenario-a&q=sentinel-missing#coexist');
  await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(0);
  await page.locator('#section-coexist input[type="search"]').fill('quan su');
  await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(1);
  await expect(page.locator('#section-coexist')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#section-coexist img')).toHaveCount(0);
  await expect(page.locator('#section-coexist')).toContainText('Cải tạo');
  await page.reload();
  await expect(page.locator('#section-coexist input[type="search"]')).toHaveValue('quan su');
});
test('invalid scope and mixed bundle never activate scoped cards or gameplay', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=unknown&ruleset=rules-a#team-pk');
  await expect(page.locator('#season-summary')).toContainText('không hợp lệ');
  await expect(page.locator('#section-team-pk .team-card')).toHaveCount(0);
  await page.route('**/data/season-team-configs.json',route=>route.fulfill({json:[]}));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await expect(page.locator('#season-summary')).toContainText('Không xác thực');
  await expect(page.getByRole('button',{name:'Xác nhận dữ liệu scan'})).toBeDisabled();
});
test('late roster scan response cannot restore scope confirmation or inventory changes', async ({page}) => {
  await controlledBundle(page);
  await page.route('https://challenges.cloudflare.com/**',route=>route.fulfill({contentType:'application/javascript',body:"window.turnstile={render(_node,options){options.callback('fixture-token');},reset(){}};"}));
  let release, arrived;
  const requestArrived=new Promise(resolve=>{arrived=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  await page.route('https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/**',async route=>{arrived();await gate;await route.fulfill({json:{heroes:[{name:'Anh',chinese:'Anh'}]}});});
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await page.locator('.roster-scan-card input[type="file"]').first().setInputFiles({name:'scan.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/XP8W3QAAAABJRU5ErkJggg==','base64')});
  await page.getByRole('button',{name:'Đọc Tướng',exact:true}).click();
  await requestArrived;
  await page.locator('#season-ruleset').selectOption('');
  release();
  await expect(page.getByRole('button',{name:'Đọc Tướng',exact:true})).toBeEnabled();
  await expect(page.locator('.roster-review-panel').first()).toContainText('Chưa đọc tướng');
  await expect(page.getByRole('button',{name:'Xác nhận dữ liệu scan'})).toBeDisabled();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tqccl.rosterRecommend.scanState.v1')));
  expect(stored.ownedHeroes).toEqual([]);expect(stored.confirmed).toBe(false);
});
for (const width of [320,375,768,1024]) test(`season controls and details remain usable at ${width}px in both themes`,async({page},testInfo)=>{
  await controlledBundle(page);
  await page.setViewportSize({width,height:800});
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#team-pk');
  await expect(page.locator('#season-config-detail')).toBeVisible();
  await page.locator('#season-scenario').focus();await expect(page.locator('#season-scenario')).toBeFocused();
  for (const theme of ['light','dark']) {
    if (theme === 'dark') await page.locator('#theme-toggle').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const styles=await page.locator('#season-scenario').evaluate(node=>({background:getComputedStyle(node).backgroundColor,height:node.getBoundingClientRect().height,panel:getComputedStyle(document.documentElement).getPropertyValue('--panel').trim()}));
    expect(styles.height).toBeGreaterThanOrEqual(44);
    expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');
    await page.locator('#season-controls').screenshot({path:testInfo.outputPath(`scope-${width}-${theme}.png`)});
    if ([375,1024].includes(width)) await page.screenshot({fullPage:true,path:testInfo.outputPath(`ui-detail-${width}-${theme}.png`)});
  }
});
test('closing details after a search preserves current filters and returns keyboard focus',async({page})=>{
  await controlledBundle(page);
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#team-pk');
  await page.locator('[data-config-id="config-a"]').getByRole('button',{name:'Chi tiết cấu hình'}).click();
  await page.locator('#section-team-pk input[type="search"]').fill('Bình');
  await page.getByRole('button',{name:'Đóng chi tiết'}).click();
  await expect(page).toHaveURL(/q=B%C3%ACnh/);
  expect(new URL(page.url()).searchParams.has('config')).toBe(false);
  await expect(page.locator('#section-team-pk input[type="search"]')).toHaveValue('Bình');
  await expect(page.locator('#section-team-pk > h2')).toBeFocused();
});

import { refreshConfigProofs } from '../tests-js/fixtures/season-fixtures.mjs';
for (const count of [500,501]) test(`roster enforces scoped candidate boundary ${count}`,async({page})=>{
  const data=await seasonConsumerFixture();
  const original=data['season-team-configs'][0], evaluation=data['season-team-evaluations'][0];
  for(let index=2;index<count;index++){
    const config={...structuredClone(original),id:`config-limit-${index}`};
    data['season-team-configs'].push(config);
    data['season-team-evaluations'].push({...structuredClone(evaluation),id:`eval-limit-${index}`,configId:config.id,sourceScore:null});
  }
  refreshConfigProofs(data);
  await controlledBundle(page,data);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1',JSON.stringify({ownedHeroes:['Anh','Bình','Cường'].map(name=>({name})),ownedTactics:['Một','Hai','Ba','Bốn','Năm','Sáu'].map(name=>({name})),lockedTeams:[],confirmed:false})));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await page.getByRole('button',{name:'Xác nhận dữ liệu scan'}).click();
  await page.getByRole('button',{name:'Gợi ý 5 team',exact:true}).click();
  if(count===500) await expect(page.locator('.roster-results > section:first-child [data-config-id="config-a"]')).toHaveCount(1);
  else {await expect(page.locator('#section-roster-recommend .error')).toContainText('500');await expect(page.locator('.roster-results')).toHaveCount(0);}
});
test('all-reference keeps historical tiers separately from executable configuration tiers',async({page})=>{
  await page.goto('/?tier=T0#team-pk');
  await expect(page.locator('#section-team-pk .team-card .badge.tier').first()).toBeVisible();
  await expect(page.locator('#section-team-pk')).toContainText('Tier lịch sử — tham khảo');
  await expect(page.locator('#section-team-pk > .stats')).toContainText('0 cấu hình áp dụng');
  await expect(page.locator('#section-team-pk')).toContainText('2026-07-03');
  await page.locator('#season-scenario').selectOption('binh-dien-xuan-thu');
  await expect(page.locator('#section-team-pk .badge.tier')).toHaveCount(0);
  await page.goBack();
  await expect(page.locator('#section-team-pk .badge.tier').first()).toBeVisible();
  await page.route('**/data/team-tier.json',route=>route.fulfill({status:404,body:''}));
  await page.reload();
  await expect(page.locator('#section-team-pk .team-card').first()).toBeVisible();
  await expect(page.locator('#section-team-pk .badge.tier')).toHaveCount(0);
});
test('scoped recommendation exposes usable add-team actions and original source score',async({page})=>{
  await controlledBundle(page);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1',JSON.stringify({ownedHeroes:['Anh','Bình','Cường'].map(name=>({name})),ownedTactics:['Một','Hai','Ba','Bốn','Năm','Sáu'].map(name=>({name})),lockedTeams:[],confirmed:false})));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await page.getByRole('button',{name:'Xác nhận dữ liệu scan'}).click();
  await page.getByRole('button',{name:'Gợi ý 5 team',exact:true}).click();
  const added=page.locator('.roster-results > section').nth(1);
  await expect(added.getByRole('button',{name:'Mở team'})).toHaveCount(1);
  await expect(added).toContainText('Điểm SGSDeck: 132.5');
  await added.getByRole('button',{name:'Mở team'}).click();
  await expect(page).toHaveURL(/config=config-a/);
  await expect(page.locator('#season-config-detail')).toBeVisible();
});
import { seasonFingerprint, configFingerprintProjection } from '../js/season-context.js';
test('card score follows its displayed hero selection rather than another valid scored alternative',async({page})=>{
  const data=await seasonConsumerFixture();const config=data['season-team-configs'][0];
  config.heroSlots[0].heroRefs.push('hero:dung');refreshConfigProofs(data);
  const score=data['season-team-evaluations'][0].sourceScore;
  score.scoredSelection.heroSlots[0].heroRef='hero:dung';
  score.configFingerprint=await seasonFingerprint(configFingerprintProjection(config));
  score.selectionFingerprint=await seasonFingerprint(score.scoredSelection);
  data['season-evidence'].find(item=>item.id==='score-proof').configFingerprint=score.configFingerprint;
  await controlledBundle(page,data);
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#team-pk');
  const card=page.locator('[data-config-id="config-a"]');
  await expect(card).toContainText('Chưa có điểm SGSDeck');
  await card.getByRole('button',{name:'Chi tiết cấu hình'}).click();
  await page.getByLabel('Tướng 1 · Tướng',{exact:true}).selectOption('hero:dung');
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toHaveText('Điểm SGSDeck: 132.5');
  await expect(page.locator('#season-config-detail').getByRole('link',{name:'Nguồn điểm SGSDeck'})).toBeVisible();
});
test('configuration details retain raw effect labels, multiline mechanics and required conditions',async({page})=>{
  const data=await seasonConsumerFixture();const config=data['season-team-configs'].find(item=>item.id==='config-conditional');
  config.effectBundles=[{id:'effect-a',labelRaw:'Hiệu ứng quân sư',effectsRaw:'Dòng cơ chế một\nDòng cơ chế hai',requirementIds:['advisor-condition'],evidenceRefs:['rule-proof']}];
  refreshConfigProofs(data);await controlledBundle(page,data);
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-conditional#team-pk');
  await expect(page.locator('#season-config-detail')).toContainText('Hiệu ứng quân sư');
  await expect(page.locator('#season-config-detail')).toContainText('Dòng cơ chế một\nDòng cơ chế hai');
  await expect(page.locator('#season-config-detail')).toContainText('Điều kiện: Cần quân sư chưa có trong kho kiểm chứng');
  await expect(page.locator('#season-config-detail')).toContainText('Chưa xác minh điều kiện');
});
test('validated source score with unknown upstream season still opens its exact configuration',async({page})=>{
  const data=await seasonConsumerFixture();data['season-team-evaluations'][0].sourceScore.sourceSeason=null;data['season-evidence'].find(item=>item.id==='score-proof').sourceSeason=null;
  await controlledBundle(page,data);await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#team-pk');
  await expect(page.locator('#season-config-detail')).toBeVisible();
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toHaveText('Điểm SGSDeck: 132.5');
  await expect(page.locator('#section-team-pk .error')).toHaveCount(0);
});
test('unavailable season bundle keeps no-context legacy gameplay with an ordinary search query',async({page})=>{
  await page.route('**/data/season-evidence.json',route=>route.fulfill({status:503,body:''}));
  await page.goto('/?q=legacy#roster-recommend');
  await expect(page.locator('#season-summary')).toContainText('Không xác thực');
  await expect(page.getByRole('button',{name:'Xác nhận dữ liệu scan'})).toBeEnabled();
});

for(const width of [375,1280]) test(`real Binh Dien review screenshot at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await page.goto('/?scenario=binh-dien-xuan-thu#coexist');
  await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(25);
  await page.locator('#season-scenario').focus();await expect(page.locator('#season-scenario')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`ui-real-binh-dien-${width}.png`)});
});
test('legacy Team PK retains derived faction facets without mutating the validated bundle',async({page})=>{
  await page.goto('/#team-pk');
  await expect(page.locator('#section-team-pk .fchip').filter({hasText:/^Thục \(/})).toHaveCount(1);
  await page.locator('#section-team-pk .fchip').filter({hasText:/^Thục \(/}).click();
  await expect(page.locator('#section-team-pk .team-card').first()).toBeVisible();
  await expect(page.locator('#section-team-pk .team-card:not(.fa-thuc)')).toHaveCount(0);
});
test('opening detail keeps its close control below the sticky navigation',async({page})=>{
  await controlledBundle(page);await page.setViewportSize({width:1024,height:800});
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#team-pk');
  await page.locator('[data-config-id="config-a"]').getByRole('button',{name:'Chi tiết cấu hình'}).click();
  const close=await page.getByRole('button',{name:'Đóng chi tiết'}).boundingBox();const header=await page.locator('.top-header').boundingBox();
  expect(close.y).toBeGreaterThanOrEqual(header.y+header.height);
});
test('coexist distinguishes exact-pair applicable groups from scenario-only reference counts',async({page})=>{
  const data=await seasonConsumerFixture();const link=structuredClone(data['season-content-links'][0]);
  link.id='link-pair';link.recordId='source-group-pair';link.rulesetId='rules-a';
  link.target.payload.groupLabel='Nhóm áp dụng';link.target.payload.teams.forEach(team=>{team.recordId+='-pair';});
  const {contentFingerprintProjection}=await import('../js/season-context.js');
  link.target.contentFingerprint=await seasonFingerprint(contentFingerprintProjection(link.target.payload));
  const proof={...structuredClone(data['season-evidence'].find(item=>item.id==='source-attribution')),id:'source-pair-proof',claim:{kind:'ruleset-applicability',scenarioId:'scenario-a',rulesetId:'rules-a'}};
  data['season-evidence'].push(proof);link.evidenceRefs=['source-proof',proof.id];data['season-content-links'].push(link);
  await controlledBundle(page,data);await page.goto('/?scenario=scenario-a&ruleset=rules-a#coexist');
  await expect(page.getByRole('heading',{name:'Áp dụng theo phiên bản luật (1)',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tham khảo kịch bản (1)',exact:true})).toBeVisible();
  await expect(page.locator('#section-coexist > .scope-note')).toContainText('1 nhóm áp dụng · 1 nhóm tham khảo');
  await expect(page.locator('#section-coexist .sgsdeck-score, #section-coexist .badge.tier')).toHaveCount(0);
});
test('optional unverified conditions remain informational in inventory comparison',async({page})=>{
  const data=await seasonConsumerFixture();data['season-team-configs'].find(item=>item.id==='config-conditional').requirements[0].mandatory=false;refreshConfigProofs(data);
  await controlledBundle(page,data);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1',JSON.stringify({ownedHeroes:['Anh','Bình','Cường'].map(name=>({name})),ownedTactics:['Một','Hai','Ba','Bốn','Năm','Sáu'].map(name=>({name})),lockedTeams:[],confirmed:false})));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-conditional#team-pk');
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('chưa kiểm chứng');
  await expect(page.locator('.season-inventory-comparison')).not.toContainText('chưa thể đề xuất build');
});
test('keyboard facet and source toggles preserve focus and pressed state after filtering',async({page})=>{
  await controlledBundle(page);await page.goto('/?scenario=scenario-a&ruleset=rules-a#team-pk');
  const facet=page.locator('#section-team-pk .fchip').filter({hasText:/^Thục \(/});
  await facet.focus();await page.keyboard.press('Space');
  await expect(facet).toBeFocused();await expect(facet).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-section="coexist"]').click();
  const source=page.locator('#section-coexist .fchip').filter({hasText:'Bảng Cùng Tồn'});
  await source.focus();await page.keyboard.press('Space');
  await expect(source).toBeFocused();await expect(source).toHaveAttribute('aria-pressed','true');
});
