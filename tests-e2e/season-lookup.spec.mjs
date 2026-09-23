import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { replaceWebsiteDisplayPin, websiteDisplayFixture } from './fixtures/website-display-fixture.mjs';

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
  await page.goto('/#coexist');
  const seasonMenu = page.getByRole('combobox', {name:'Mùa', exact:true});
  await expect(seasonMenu).toBeVisible();
  await expect(seasonMenu.locator('option[value="anh-hung-menh-the"]')).toHaveText('PK-S26 · Anh Hùng Mệnh Thế');
  await expect(seasonMenu.locator('option[value="binh-dien-xuan-thu"]')).toHaveText('OG · Binh Diễn Xuân Thu');
  await expect(page.locator('#section-coexist > h2 + #season-controls')).toBeVisible();
  await expect(page.locator('#season-summary')).toBeHidden();
  await expect(page.getByRole('combobox',{name:'Phiên bản luật'})).toBeHidden();
  await expect(page.locator('#section-coexist input[type="search"], #section-coexist .clear-btn, #section-coexist .fchip, #section-coexist > .scope-note')).toHaveCount(0);
  await expect(page.locator('#section-coexist')).not.toContainText('Chưa xác định kịch bản');
  await expect(page.locator('#section-coexist .sgsdeck-score, #section-coexist .badge.tier')).toHaveCount(0);
  await expect(page.locator('#section-lookup [data-lookup-id^="hero:"]').first()).toBeAttached();
  for (const scenarioId of ['anh-hung-menh-the','binh-dien-xuan-thu']) {
    await seasonMenu.selectOption(scenarioId);
    await expect(page.locator('#season-ruleset')).toHaveValue('');
    await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(25);
    const coexistCards = page.locator('#section-coexist .coexist-subteam');
    expect(await coexistCards.evaluateAll(cards => cards.every(card => {
      const heroes = card.querySelector(':scope > .heroes');
      return heroes
        && heroes.querySelectorAll(':scope > .hero').length === 3
        && heroes.querySelectorAll(':scope > .hero > .hero-name > .hn').length === 3;
    }))).toBe(true);
  }
  await page.locator('[data-section="khaihoang"]').click();
  await expect(page.locator('#season-controls')).toBeHidden();
  await expect(page.locator('.tagline')).toContainText('mới nhất');
});

import { createHash } from 'node:crypto';
import { seasonConsumerFixture } from '../tests-js/fixtures/season-fixtures.mjs';
async function controlledBundle(page, data = null) {
  data ||= await seasonConsumerFixture();
  const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  data['heroes-dict'] = data['heroes-dict'].map(row => ({
    id: `hero:${slug(row.viet)}`, chinese: row.chinese, hanViet: row.hanViet ?? row.viet, viet: row.viet,
    aliases: [], faction: row.faction ?? null, stars: null, cost: null,
    stats: { luc: '', tri: '', thong: '', toc: '', chinh: '', mi: '' },
    troopApt: { ky: null, thuan: null, cung: null, thuong: null, khiGioi: null },
    selfTacticCn: null, inheritTacticCn: null, roleTag: null, roleTagViet: null,
    iconUrl: null, isSP: false, linkScore: null, pending: false,
    lookup: {
      conditions: [], missingFields: [], revisions: [], variant: 'base',
      selfTacticId: null, inheritTacticId: null, advisorId: null,
      growth: { luc: null, tri: null, thong: null, toc: null, chinh: null, mi: null },
      otherAptitudes: { infantry: null, navy: null },
      categoryVi: null, exclusiveTitleVi: null,
      civil: { roleVi: null, bonusVi: null, specialtyVi: null, tacticBonusVi: null },
      civilInnatePoints: null, collectibleBonusVi: null, redRulesVi: null,
      flags: { isCollectible: null, isDynamicOpen: null, isMusou: null, isCO: null, isSp: null },
    },
  }));
  data.tactics = data.tactics.map(row => ({
    id: `tactic:${slug(row.viet)}`, chinese: row.chinese, hanViet: row.hanViet ?? row.viet, viet: row.viet,
    aliases: [], type: null, quality: null, effect: null, effectViet: null,
    target: null, targetViet: null, troopFit: [], source: null, sourceHeroCn: null,
    iconUrl: null, linkScore: null, pending: true,
    lookup: {
      conditions: [], missingFields: [], revisions: [], activationRate: null,
      cooldown: null, maxUsers: null, pointCost: null, effectTypeVi: null,
      exchangeConditionVi: null, acquiredFromVi: [], inheritedFromIds: [], conflictsVi: null,
    },
  }));
  const lookupCatalog = { schemaVersion: 1, advisors: [], buildings: [], equipment: [], specials: [], troopMods: [] };
  const lookupPayloads = {
    'heroes-dict.json': JSON.stringify(data['heroes-dict']),
    'tactics.json': JSON.stringify(data.tactics),
    'lookup-catalog.json': JSON.stringify(lookupCatalog),
  };
  const lookupFiles = Object.fromEntries(Object.entries(lookupPayloads).sort(([left], [right]) => left.localeCompare(right)).map(([name, body]) => [name, createHash('sha256').update(body).digest('hex')]));
  const lookupManifest = {
    schemaVersion: 1,
    generationId: `lookup:${createHash('sha256').update(`${JSON.stringify(lookupFiles)}\n`).digest('hex')}`,
    files: lookupFiles,
  };
  const routeData = { ...data, 'lookup-catalog': lookupCatalog, 'lookup-manifest': lookupManifest };
  const routeBodies = Object.fromEntries(
    Object.entries(routeData).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const pinnedKeys = {
    'teams': 'data/teams.json',
    'coexist': 'data/coexist.json',
    'khaihoang': 'data/khaihoang.json',
    'season-content-links': 'data/season-content-links.json',
    'heroes-dict': 'data/heroes-dict.json',
    'tactics': 'data/tactics.json',
    'lookup-catalog': 'data/lookup-catalog.json',
    'lookup-manifest': 'data/lookup-manifest.json',
  };
  const displayOverrides = Object.fromEntries(
    Object.entries(pinnedKeys)
      .filter(([key]) => key in routeBodies)
      .map(([key, path]) => [path, routeBodies[key]]),
  );
  const website = websiteDisplayFixture(displayOverrides, {
    dropValuesFor: ['data/teams.json', 'data/coexist.json', 'data/khaihoang.json'],
  });
  const hashes = Object.fromEntries(Object.entries(data).map(([key,value]) => [key, 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex')]));
  await page.route('**/data/*.json', async route => {
    const key = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json','');
    if (key === 'website-display') return route.fulfill({contentType:'application/json',body:website.body});
    if (key in routeBodies) return route.fulfill({contentType:'application/json',body:routeBodies[key]});
    return route.continue();
  });
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    const html = replaceWebsiteDisplayPin(
      (await response.text()).replace(/(<script[^>]*id="season-artifact-hashes"[^>]*>)[\s\S]*?(<\/script>)/, (_,start,end)=> start + JSON.stringify(hashes) + end),
      website.pin,
    );
    await route.fulfill({response,body:html});
  });
  return data;
}
test('verified fixture preserves exact config identity, ordered detail and source score', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#coexist');
  await expect(page.locator('#season-config-detail')).toContainText('Điểm SGSDeck: 132.5');
  await expect(page.locator('#season-config-detail')).toContainText('Cấu hình: config-a · scenario-a · rules-a');
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-b#coexist');
  await expect(page).toHaveURL(/config=config-b/);
  await expect(page.locator('#season-config-detail')).toContainText('Chiến pháp 1: Hai');
  await expect(page.locator('#season-config-detail')).toContainText('Chưa có điểm SGSDeck');
  await page.getByRole('button',{name:'Đóng chi tiết'}).click();
  expect(new URL(page.url()).searchParams.has('config')).toBe(false);
  await page.goto('/?q=cuong#team-khac');
  await page.reload();
  await expect(page.getByRole('searchbox',{name:'Tìm Đội khác',exact:true})).toHaveValue('cuong');
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
  await page.getByRole('button',{name:'Xác nhận dữ liệu đã đọc'}).click();
  await page.getByRole('button',{name:'Gợi ý 5 đội',exact:true}).click();
  await expect(page.locator('.roster-results > section:first-child [data-config-id="config-a"]')).toHaveCount(1);
  await expect(page.locator('.roster-results')).toContainText('Điểm SGSDeck: 132.5');
  await page.locator('#season-ruleset').selectOption('');
  await expect(page.locator('.roster-results')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Gợi ý 5 đội',exact:true})).toBeDisabled();
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
test('coexist keeps only the season filter and ignores stale filter query', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=scenario-a&q=sentinel-missing&source=legacy#coexist');
  await expect(page.getByRole('combobox',{name:'Mùa',exact:true})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Phiên bản luật'})).toBeHidden();
  await expect(page.locator('#section-coexist input[type="search"], #section-coexist .clear-btn, #section-coexist .fchip')).toHaveCount(0);
  await expect(page.locator('#section-coexist .coexist-subteam')).not.toHaveCount(0);
  await expect(page.locator('#section-coexist')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#section-coexist img')).toHaveCount(0);
  await expect(page.locator('#section-coexist')).toContainText('Cải tạo');
});
test('invalid scope and mixed bundle never activate scoped cards or gameplay', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/?scenario=unknown&ruleset=rules-a#team-pk');
  await expect(page.locator('#season-summary')).toContainText('không hợp lệ');
  await expect(page.locator('#section-team-pk .team-card')).toHaveCount(0);
  await page.route('**/data/season-team-configs.json',route=>route.fulfill({json:[]}));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await expect(page.locator('#season-summary')).toContainText('Không xác thực');
  await expect(page.getByRole('button',{name:'Xác nhận dữ liệu đã đọc'})).toBeDisabled();
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
  await expect(page.getByRole('button',{name:'Xác nhận dữ liệu đã đọc'})).toBeDisabled();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('tqccl.rosterRecommend.scanState.v1')));
  expect(stored.ownedHeroes).toEqual([]);expect(stored.confirmed).toBe(false);
});
for (const width of [320,375,768,1024]) test(`season controls and details remain usable at ${width}px in both themes`,async({page},testInfo)=>{
  await controlledBundle(page);
  await page.setViewportSize({width,height:800});
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#coexist');
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
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&q=B%C3%ACnh&config=config-a#team-khac');
  await expect(page.locator('#season-config-detail')).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'Tìm Đội khác',exact:true})).toHaveValue('Bình');
  await page.getByRole('button',{name:'Đóng chi tiết'}).click();
  await expect(page).toHaveURL(/q=B%C3%ACnh/);
  expect(new URL(page.url()).searchParams.has('config')).toBe(false);
  await expect(page.getByRole('searchbox',{name:'Tìm Đội khác',exact:true})).toHaveValue('Bình');
  await expect(page.locator('#section-team-khac h2')).toBeFocused();
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
  await page.getByRole('button',{name:'Xác nhận dữ liệu đã đọc'}).click();
  await page.getByRole('button',{name:'Gợi ý 5 đội',exact:true}).click();
  if(count===500) await expect(page.locator('.roster-results > section:first-child [data-config-id="config-a"]')).toHaveCount(1);
  else {await expect(page.locator('#section-roster-recommend .error')).toContainText('500');await expect(page.locator('.roster-results')).toHaveCount(0);}
});
test('retired legacy tier selectors stay inert and the browser survives a missing tier artifact',async({page})=>{
  const section=page.locator('#section-team-khac');
  await page.goto('/#team-khac');
  const baseline=await section.locator('.stats').textContent();
  await page.goto('/?tier=T0.5#team-khac');
  await expect(section.locator('.scope-note[role="status"]')).toContainText('không còn áp dụng');
  await expect(section.locator('.stats')).toHaveText(baseline);
  await expect(section.locator('.badge.tier, .historical-tier')).toHaveCount(0);
  await expect(section.locator('[data-config-id]')).toHaveCount(0);
  await page.route('**/data/team-tier.json',route=>route.fulfill({status:404,body:''}));
  await page.reload();
  await expect(section.locator('.team-card').first()).toBeVisible();
  await expect(section.locator('.stats')).toHaveText(baseline);
  await expect(section.locator('.error')).toHaveCount(0);
});
test('scoped recommendation exposes usable add-team actions and original source score',async({page})=>{
  await controlledBundle(page);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1',JSON.stringify({ownedHeroes:['Anh','Bình','Cường'].map(name=>({name})),ownedTactics:['Một','Hai','Ba','Bốn','Năm','Sáu'].map(name=>({name})),lockedTeams:[],confirmed:false})));
  await page.goto('/?scenario=scenario-a&ruleset=rules-a#roster-recommend');
  await page.getByRole('button',{name:'Xác nhận dữ liệu đã đọc'}).click();
  await page.getByRole('button',{name:'Gợi ý 5 đội',exact:true}).click();
  const added=page.locator('.roster-results > section').nth(1);
  await expect(added.getByRole('button',{name:'Mở đội'})).toHaveCount(1);
  await expect(added).toContainText('Điểm SGSDeck: 132.5');
  await added.getByRole('button',{name:'Mở đội'}).click();
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
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#coexist');
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toHaveText('Chưa có điểm SGSDeck');
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
  await expect(page.getByRole('button',{name:'Xác nhận dữ liệu đã đọc'})).toBeEnabled();
});

for(const width of [375,1280]) test(`real Binh Dien review screenshot at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await page.goto('/?scenario=binh-dien-xuan-thu#coexist');
  await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(25);
  await page.locator('#season-scenario').focus();await expect(page.locator('#season-scenario')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`ui-real-binh-dien-${width}.png`)});
});
test('Team khác faction facet filters by derived faction without mutating the scope model',async({page})=>{
  await page.goto('/#team-khac');
  const section=page.locator('#section-team-khac');
  const facet=section.locator('.fchip[data-focus-key^="faction:"]').first();
  const raw=(await facet.getAttribute('data-focus-key')).slice('faction:'.length);
  const scopedLabel=await facet.textContent();
  const total=await section.locator('.team-card').count();
  await facet.click();
  await expect(facet).toHaveAttribute('aria-pressed','true');
  const cards=section.locator('.team-card');
  await expect(cards.first()).toBeVisible();
  expect(await cards.evaluateAll((nodes,value)=>nodes.every(node=>node.dataset.faction===value),raw)).toBe(true);
  await expect(facet).toHaveText(scopedLabel);
  await section.getByRole('button',{name:'Xóa lọc'}).click();
  await expect(section.locator('.team-card')).toHaveCount(total);
});
test('opening detail keeps its close control below the sticky navigation',async({page})=>{
  await controlledBundle(page);await page.setViewportSize({width:1024,height:800});
  await page.goto('/?scenario=scenario-a&ruleset=rules-a&config=config-a#coexist');
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
  await expect(page.locator('#season-summary')).toBeHidden();
  await expect(page.locator('#section-coexist > .scope-note')).toHaveCount(0);
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
test('keyboard facet toggles preserve focus and pressed state after filtering',async({page})=>{
  await page.goto('/#team-khac');
  const facet=page.locator('#section-team-khac .fchip[data-focus-key^="faction:"]').first();
  const raw=(await facet.getAttribute('data-focus-key')).slice('faction:'.length);
  await facet.focus();await page.keyboard.press('Space');
  await expect(facet).toBeFocused();await expect(facet).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('faction'))).toBe(raw);
});
