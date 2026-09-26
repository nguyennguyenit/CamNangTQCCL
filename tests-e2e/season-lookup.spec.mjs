import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/** Link điều hướng của mục: bảng desktop trong header hoặc menu mobile đang mở (footer cũng có link cùng tên). */
function navLink(page, name, mobile = false) {
  return (mobile ? page.locator('#section-menu-items') : page.locator('.site-nav')).getByRole('link', { name, exact: true });
}

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
  await page.goto('/cung-ton/');
  const seasonMenu = page.getByRole('combobox', {name:'Mùa', exact:true});
  await expect(seasonMenu).toBeVisible();
  await expect(seasonMenu.locator('option[value="anh-hung-menh-the"]')).toHaveText('PK-S26 · Anh Hùng Mệnh Thế');
  await expect(seasonMenu.locator('option[value="binh-dien-xuan-thu"]')).toHaveText('OG · Binh Diễn Xuân Thu');
  await expect(page.locator('#section-coexist > .coexist-head #season-controls')).toBeVisible();
  await expect(page.locator('#season-summary')).toBeHidden();
  await expect(page.getByRole('combobox',{name:'Phiên bản luật'})).toBeHidden();
  await expect(page.locator('#section-coexist input[type="search"], #section-coexist .clear-btn, #section-coexist .fchip, #section-coexist > .scope-note')).toHaveCount(0);
  await expect(page.locator('#section-coexist')).not.toContainText('Chưa xác định kịch bản');
  await expect(page.locator('#section-coexist .sgsdeck-score, #section-coexist .badge.tier')).toHaveCount(0);
  await expect(page.locator('#section-coexist .coexist-subteam').first()).toBeAttached();
  for (const scenarioId of ['anh-hung-menh-the','binh-dien-xuan-thu']) {
    await seasonMenu.selectOption(scenarioId);
    await expect(page.locator('#season-ruleset')).toHaveValue('');
    // Chỉ nhóm đang xem được dựng: 5 đội của một nhóm, không phải cả 5 nhóm của kịch bản.
    await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(5);
    await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(5);
    const coexistCards = page.locator('#section-coexist .coexist-subteam');
    expect(await coexistCards.evaluateAll(cards => cards.every(card => {
      const heroes = card.querySelector(':scope > .coexist-heroes');
      return heroes
        && heroes.querySelectorAll(':scope > .coexist-hero').length === 3
        && heroes.querySelectorAll(':scope > .coexist-hero > .coexist-hero-head > .coexist-hero-name').length === 3;
    }))).toBe(true);
  }
  await page.locator('a[data-section="khaihoang"]').click();
  await expect(page).toHaveURL('/khai-hoang/');
  await expect(navLink(page, 'Khai hoang')).toHaveAttribute('aria-current','page');
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
  await page.route(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/(?:doi-chuan|doi-khac|cung-ton|soi-doi-tu-anh|goi-y-doi-tu-kho)\/(?:\?.*)?$/, async route => {
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
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-a');
  await expect(page.locator('#season-config-detail')).toContainText('Điểm SGSDeck: 132.5');
  await expect(page.locator('#season-config-detail')).toContainText('Cấu hình: config-a · scenario-a · rules-a');
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-b');
  await expect(page).toHaveURL(/config=config-b/);
  await expect(page.locator('#season-config-detail')).toContainText('Chiến pháp 1: Hai');
  await expect(page.locator('#season-config-detail')).toContainText('Chưa có điểm SGSDeck');
  await page.getByRole('button',{name:'Đóng chi tiết'}).click();
  expect(new URL(page.url()).searchParams.has('config')).toBe(false);
  await page.goto('/doi-khac/?q=cuong');
  await page.reload();
  await expect(page.getByRole('searchbox',{name:'Tìm Đội khác',exact:true})).toHaveValue('cuong');
});
test('detail compares real inventory and changing a selected tactic removes its source score', async ({page}) => {
  await controlledBundle(page);
  await page.addInitScript(()=>localStorage.setItem('tqccl.rosterRecommend.scanState.v1', JSON.stringify({ownedHeroes:[{name:'Anh'},{name:'Bình'},{name:'Cường'}],ownedTactics:[{name:'Một'},{name:'Hai'},{name:'Ba'},{name:'Bốn'},{name:'Năm'},{name:'Sáu'}],lockedTeams:[],confirmed:true})));
  await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a&config=config-a');
  await expect(page.getByRole('button',{name:'Đối chiếu kho của tôi'})).toBeVisible();
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('Đủ tướng và chiến pháp');
  await expect(page.locator('.season-inventory-comparison')).toContainText('Binh thư: chưa kiểm chứng');
  await page.getByLabel('Tướng 1 · Chiến pháp 1',{exact:true}).selectOption('tactic:bay');
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toContainText('Chưa có điểm SGSDeck');
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('Thiếu chiến pháp: Bảy');
});
test('coexist keeps only the season filter and ignores stale filter query', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/cung-ton/?scenario=scenario-a&q=sentinel-missing&source=legacy');
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
  await page.goto('/doi-khac/?scenario=unknown&ruleset=rules-a');
  await expect(page.locator('#season-summary')).toContainText('không hợp lệ');
  await expect(page.locator('#season-config-detail')).toHaveCount(0);
  await expect(page.locator('#section-team-khac [data-config-id]')).toHaveCount(0);
  await page.route('**/data/season-team-configs.json',route=>route.fulfill({json:[]}));
  await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a');
  await expect(page.locator('#season-summary')).toContainText('Không xác thực');
  await expect(page.locator('#section-team-khac [data-config-id]')).toHaveCount(0);
});
for (const width of [320,375,768,1024]) test(`season controls and details remain usable at ${width}px in both themes`,async({page},testInfo)=>{
  await controlledBundle(page);
  await page.setViewportSize({width,height:800});
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-a');
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
  await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a&q=B%C3%ACnh&config=config-a');
  await expect(page.locator('#season-config-detail')).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'Tìm Đội khác',exact:true})).toHaveValue('Bình');
  await page.getByRole('button',{name:'Đóng chi tiết'}).click();
  await expect(page).toHaveURL(/q=B%C3%ACnh/);
  expect(new URL(page.url()).searchParams.has('config')).toBe(false);
  await expect(page.getByRole('searchbox',{name:'Tìm Đội khác',exact:true})).toHaveValue('Bình');
  // Đầu mục danh sách dùng h1 (artboard Main) và `focus()` của section trỏ vào đó.
  await expect(page.locator('#section-team-khac h1.reference-title')).toBeFocused();
});

import { refreshConfigProofs } from '../tests-js/fixtures/season-fixtures.mjs';
test('retired legacy tier selectors stay inert and the browser survives a missing tier artifact',async({page})=>{
  const section=page.locator('#section-team-khac');
  await page.goto('/doi-khac/');
  const baseline=await section.locator('.stats').textContent();
  await page.goto('/doi-khac/?tier=T0.5');
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
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-a');
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toHaveText('Chưa có điểm SGSDeck');
  await page.getByLabel('Tướng 1 · Tướng',{exact:true}).selectOption('hero:dung');
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toHaveText('Điểm SGSDeck: 132.5');
  await expect(page.locator('#season-config-detail').getByRole('link',{name:'Nguồn điểm SGSDeck'})).toBeVisible();
});
test('configuration details retain raw effect labels, multiline mechanics and required conditions',async({page})=>{
  const data=await seasonConsumerFixture();const config=data['season-team-configs'].find(item=>item.id==='config-conditional');
  config.effectBundles=[{id:'effect-a',labelRaw:'Hiệu ứng quân sư',effectsRaw:'Dòng cơ chế một\nDòng cơ chế hai',requirementIds:['advisor-condition'],evidenceRefs:['rule-proof']}];
  refreshConfigProofs(data);await controlledBundle(page,data);
  await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a&config=config-conditional');
  await expect(page.locator('#season-config-detail')).toContainText('Hiệu ứng quân sư');
  await expect(page.locator('#season-config-detail')).toContainText('Dòng cơ chế một\nDòng cơ chế hai');
  await expect(page.locator('#season-config-detail')).toContainText('Điều kiện: Cần quân sư chưa có trong kho kiểm chứng');
  await expect(page.locator('#season-config-detail')).toContainText('Chưa xác minh điều kiện');
});
test('validated source score with unknown upstream season still opens its exact configuration',async({page})=>{
  const data=await seasonConsumerFixture();data['season-team-evaluations'][0].sourceScore.sourceSeason=null;data['season-evidence'].find(item=>item.id==='score-proof').sourceSeason=null;
  await controlledBundle(page,data);await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a&config=config-a');
  await expect(page.locator('#season-config-detail')).toBeVisible();
  await expect(page.locator('#season-config-detail .sgsdeck-score')).toHaveText('Điểm SGSDeck: 132.5');
  await expect(page.locator('#section-team-khac .error')).toHaveCount(0);
});
for(const width of [375,1280]) test(`real Binh Dien review screenshot at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await page.goto('/cung-ton/?scenario=binh-dien-xuan-thu');
  await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(5);
  await expect(page.locator('#section-coexist .coexist-subteam')).toHaveCount(5);
  await page.locator('#season-scenario').focus();await expect(page.locator('#season-scenario')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`ui-real-binh-dien-${width}.png`)});
});
test('Team khác faction facet filters by derived faction without mutating the scope model',async({page})=>{
  await page.goto('/doi-khac/');
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
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-a');
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
  await controlledBundle(page,data);await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a');
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
  await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a&config=config-conditional');
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('chưa kiểm chứng');
  await expect(page.locator('.season-inventory-comparison')).not.toContainText('chưa thể đề xuất build');
});
test('keyboard facet toggles preserve focus and pressed state after filtering',async({page})=>{
  await page.goto('/doi-khac/');
  const facet=page.locator('#section-team-khac .fchip[data-focus-key^="faction:"]').first();
  const raw=(await facet.getAttribute('data-focus-key')).slice('faction:'.length);
  await facet.focus();await page.keyboard.press('Space');
  await expect(facet).toBeFocused();await expect(facet).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('faction'))).toBe(raw);
});

test('scenario history re-renders the scoped surface on Back and Forward',async({page})=>{
  await controlledBundle(page);
  const scenario=page.locator('#season-scenario');
  const summary=page.locator('#season-summary');
  const groups=page.locator('#section-coexist .coexist-scope-group');
  const query=key=>page.evaluate(k=>new URL(location.href).searchParams.get(k),key);
  const snap=async()=>({scenario:await scenario.inputValue(),summary:(await summary.textContent()).trim(),groups:await groups.count()});
  await page.goto('/cung-ton/');
  await expect(page.locator('#section-coexist')).toBeVisible();
  const baseline=await snap();
  const scenarioValue=(await scenario.locator('option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean)))[0];
  expect(scenarioValue,{message:'fixture phải có ít nhất một kịch bản đã review'}).toBeTruthy();

  await scenario.selectOption(scenarioValue);
  await expect.poll(()=>query('scenario')).toBe(scenarioValue);
  const after=await snap();
  expect(after.scenario).toBe(scenarioValue);

  // Back: URL, control đã chọn và bề mặt đã render phải cùng quay lại trạng thái trước.
  await page.goBack();
  await expect.poll(()=>query('scenario')).toBeNull();
  await expect(scenario).toHaveValue(baseline.scenario);
  await expect(summary).toHaveText(baseline.summary);
  await expect(groups).toHaveCount(baseline.groups);

  await page.goForward();
  await expect.poll(()=>query('scenario')).toBe(scenarioValue);
  await expect(scenario).toHaveValue(after.scenario);
  await expect(summary).toHaveText(after.summary);
  await expect(groups).toHaveCount(after.groups);
});

/* ---------- Phase 8: chọn kịch bản/nhóm và ô tổng quan Cùng Tồn ---------- */

const SEASON_DATASETS = ['season-registry','season-evidence','season-team-configs','season-team-evaluations','season-content-links','teams','coexist','heroes-dict','tactics','books-dict'];
async function realSeasonInputs() {
  const data = {};
  for (const name of SEASON_DATASETS) data[name] = JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
  return data;
}

test('coexist rows follow the season projection and the chosen group survives URL and reload', async ({page}) => {
  const {validateSeasonBundle, projectSeasonBrowse} = await import('../js/season-context.js');
  const data = await realSeasonInputs();
  const model = await validateSeasonBundle(structuredClone(data));
  const projected = projectSeasonBrowse(model, {kind: 'all-reference'});
  const expected = [...projected.coexist.applicable, ...projected.coexist.scenarioReference, ...projected.coexist.unknown];
  const scenarioOrder = [...new Set(expected.map(group => group.scenarioId))];
  expect(scenarioOrder, {message: 'dữ liệu thật phải có nhiều hơn một kịch bản'}).toHaveLength(2);
  const labels = new Map(data['season-registry'].filter(item => item.reviewStatus === 'reviewed').map(item => [item.id, item.labelVi]));

  await page.goto('/cung-ton/');
  const scenarioChips = page.locator('#section-coexist .coexist-scenario');
  await expect(scenarioChips).toHaveCount(scenarioOrder.length);
  await expect(scenarioChips).toHaveText(scenarioOrder.map(id => labels.get(id)));
  const groupLabels = () => page.locator('#section-coexist .coexist-group-chip .coexist-chip-label').allTextContents();
  for (const [index, scenarioId] of scenarioOrder.entries()) {
    await scenarioChips.nth(index).click();
    await expect(scenarioChips.nth(index)).toHaveAttribute('aria-pressed', 'true');
    const inScope = expected.filter(group => group.scenarioId === scenarioId);
    await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(inScope.length);
    const rendered = await groupLabels();
    expect(rendered).toEqual(inScope.map(group => group.content.groupLabel));
    // Không có hai nút cùng nhãn trong một hàng.
    expect(new Set(rendered).size).toBe(rendered.length);
  }

  // Nhóm đang chọn ghi `recordId` vào URL bằng replaceState (không thêm bước lịch sử) và reload giữ nhóm.
  const target = expected.filter(group => group.scenarioId === scenarioOrder[1])[1];
  const historyLength = await page.evaluate(() => history.length);
  await page.locator(`#section-coexist .coexist-group-chip[data-group-key="${target.recordId}"]`).click();
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveAttribute('data-group-key', target.recordId);
  expect(await page.evaluate(() => new URL(location.href).searchParams.get('group'))).toBe(target.recordId);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator('#section-coexist .coexist-group-title')).toContainText(target.content.groupLabel);
  const chosen = await page.locator('#section-coexist .coexist-group-title').textContent();

  await page.reload();
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveAttribute('data-group-key', target.recordId);
  await expect(page.locator('#section-coexist .coexist-group-title')).toHaveText(chosen);

  // Đổi Mùa sang phạm vi không còn nhóm này: về nhóm đầu và URL bỏ `group`.
  await page.locator('#season-scenario').selectOption(scenarioOrder[0]);
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.has('group'))).toBe(false);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(expected.filter(group => group.scenarioId === scenarioOrder[0]).length);
});

test('coexist overview keeps every source field verbatim and counts from the rendered group', async ({page}) => {
  const links = JSON.parse(await readFile(new URL('../data/season-content-links.json', import.meta.url), 'utf8'));
  // Nhóm có `summaryRaw` chạm biên khoảng trắng: chuỗi đã nhận phải được giữ nguyên.
  const link = links.find(item => item.target.payload.summaryRaw !== item.target.payload.summaryRaw.trim());
  expect(link, {message: 'dữ liệu thật phải có nhóm chạm biên khoảng trắng'}).toBeTruthy();
  const payload = link.target.payload;
  await page.goto(`/cung-ton/?scenario=binh-dien-xuan-thu&group=${link.recordId}`);

  const group = page.locator('#section-coexist .coexist-group');
  await expect(group).toHaveCount(1);
  await expect(group.locator('.coexist-group-title')).toContainText(payload.groupLabel);
  await expect(group.locator('.scope-note')).toHaveText('Tham khảo kịch bản — chưa xác nhận theo phiên bản luật');
  // Nguyên văn, không tách câu: summaryRaw, ghi chú nhiều dòng và gợi ý khai hoang đều còn nguyên chuỗi.
  const raws = await group.locator('.coexist-raw-text').allTextContents();
  expect(raws[0]).toBe(payload.summaryRaw);
  expect(raws).toContain(payload.notesRaw.replace(/\r\n?/g, '\n'));
  expect(raws).toContain(payload.openingSuggestionsRaw.replace(/\r\n?/g, '\n'));
  expect(raws).toContain(link.target.source.disclaimerRaw);
  expect(raws.find(text => text === payload.notesRaw.replace(/\r\n?/g, '\n')).split('\n').length)
    .toBe(payload.notesRaw.replace(/\r\n?/g, '\n').split('\n').length);
  await expect(group.locator('.coexist-raw-text')).toHaveCount(4);
  await expect(group.locator('.coexist-source')).toHaveAttribute('href', link.target.source.url);
  await expect(group.locator('.coexist-source')).toHaveAttribute('rel', 'noopener noreferrer');

  // Số liệu tính độc lập trong test từ chính mảng tướng của nhóm.
  const names = payload.teams.flatMap(team => team.heroes.map(hero => hero.nameRaw.trim()));
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  const verdict = duplicates.length ? `có trùng: ${duplicates.join(', ')}` : 'không trùng';
  await expect(group.locator('.coexist-count-line')).toHaveText(`${payload.teams.length} đội · ${new Set(names).size} tướng · ${verdict}`);
  await expect(group.locator('.coexist-count-ok')).toHaveCount(duplicates.length ? 0 : 1);
  await expect(group.locator('.coexist-subteam')).toHaveCount(payload.teams.length);
  await expect(group.locator('.coexist-hero')).toHaveCount(payload.teams.length * 3);

  // Biên khoảng trắng: chuỗi nguồn đã nhận giữ nguyên (chỉ chuẩn hoá CRLF), không bị trim khi hiện.
  expect(raws[0]).toBe(payload.summaryRaw);
  expect(raws[0].trim()).not.toBe(raws[0]);
});

test('coexist group query is dropped when it leaves the scope, including on legacy URLs', async ({page}) => {
  const links = JSON.parse(await readFile(new URL('../data/season-content-links.json', import.meta.url), 'utf8'));
  const link = links.find(item => item.scenarioId === 'anh-hung-menh-the');
  // Nhóm ngoài phạm vi đang chọn bị bỏ ngay khi tải trang (URL cũ đã chia sẻ).
  await page.goto(`/cung-ton/?scenario=binh-dien-xuan-thu&group=${link.recordId}`);
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.has('group'))).toBe(false);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveCount(1);
  // Khóa lặp cũng là không hợp lệ.
  await page.goto(`/cung-ton/?group=a&group=b`);
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.has('group'))).toBe(false);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveCount(1);
});

test('coexist falls back to the legacy frame with the fields it has when the season bundle is unavailable', async ({page}) => {
  await page.route('**/data/season-evidence.json', route => route.fulfill({status: 503, body: ''}));
  await page.goto('/cung-ton/');
  await expect(page.locator('#season-summary')).toContainText('Không xác thực');
  const group = page.locator('#section-coexist .coexist-group');
  await expect(group).toHaveCount(1);
  await expect(group.locator('.scope-note')).toHaveText('Chưa xác định kịch bản — tham khảo đội hình nguồn');
  // Nhánh legacy chỉ có Tổng quan (summary): không nguồn, không lưu ý nguồn, không gợi ý khai hoang.
  await expect(group.locator('.coexist-raw-text')).toHaveCount(1);
  await expect(group.locator('.coexist-source')).toHaveCount(0);
  await expect(group.locator('.coexist-count-line')).toHaveText('5 đội · 15 tướng · không trùng');
  await expect(group.locator('.coexist-subteam')).toHaveCount(5);
  await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(5);
  await expect(page.locator('#section-coexist .coexist-scenario')).toBeHidden();
});

for (const width of [1440, 320]) {
  test(`coexist selectors keep keyboard focus and continuation after Enter/Space at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.goto('/cung-ton/');
    const active = () => page.evaluate(() => ({
      tag: document.activeElement?.tagName,
      className: document.activeElement?.className || '',
      groupKey: document.activeElement?.dataset?.groupKey || null,
      pressed: document.activeElement?.getAttribute('aria-pressed') || null,
    }));
    const scenarios = page.locator('#section-coexist .coexist-scenario');
    const groups = page.locator('#section-coexist .coexist-group-chip');
    await expect(scenarios).toHaveCount(2);
    await expect(groups).toHaveCount(5);

    // Enter trên kịch bản KHÔNG đầu tiên: nút vẫn giữ focus và vẫn là nút đang chọn.
    const secondScenario = scenarios.nth(1);
    await secondScenario.focus();
    await page.keyboard.press('Enter');
    await expect(secondScenario).toHaveAttribute('aria-pressed', 'true');
    await expect(secondScenario).toBeFocused();
    expect((await active()).className).toContain('coexist-scenario');
    expect((await active()).pressed).toBe('true');
    await expect(groups).toHaveCount(5);
    // Tab đi tiếp sang hàng nhóm (không quay về đầu hàng vừa bấm), Shift+Tab quay lại đúng nút kịch bản.
    await page.keyboard.press('Tab');
    expect((await active()).className).toContain('coexist-group-chip');
    await page.keyboard.press('Shift+Tab');
    await expect(secondScenario).toBeFocused();

    // Space trên nhóm KHÔNG đầu tiên: chip giữ focus, đang chọn và URL ghi đúng khóa nhóm đó.
    const thirdGroup = groups.nth(2);
    const thirdKey = await thirdGroup.getAttribute('data-group-key');
    await thirdGroup.focus();
    await page.keyboard.press('Space');
    await expect(thirdGroup).toHaveAttribute('aria-pressed', 'true');
    await expect(thirdGroup).toBeFocused();
    expect((await active()).groupKey).toBe(thirdKey);
    expect(await page.evaluate(() => new URL(location.href).searchParams.get('group'))).toBe(thirdKey);
    // Tab đi tiếp tới nhóm kế tiếp, Shift+Tab quay lại đúng nhóm vừa bấm.
    await page.keyboard.press('Tab');
    expect((await active()).groupKey).toBe(await groups.nth(3).getAttribute('data-group-key'));
    await page.keyboard.press('Shift+Tab');
    await expect(thirdGroup).toBeFocused();
    expect((await active()).groupKey).toBe(thirdKey);

    // Đổi Mùa không được cướp focus của điều khiển đang dùng; phạm vi mới chỉ còn một kịch bản nên hàng
    // kịch bản ẩn và Tab đi tiếp vào hàng nhóm thay vì quay về đầu trang.
    await page.locator('#season-scenario').focus();
    await page.locator('#season-scenario').selectOption('binh-dien-xuan-thu');
    await expect(page.locator('#season-scenario')).toBeFocused();
    await expect(scenarios.first()).toBeHidden();
    await expect(groups).toHaveCount(5);
    await page.keyboard.press('Tab');
    expect((await active()).className).toContain('coexist-group-chip');
  });
}

/* ---------- Hai trang công cụ: không có phạm vi mùa ---------- */

test('config-detail inventory link opens the roster tool without season keys', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/doi-khac/?scenario=scenario-a&ruleset=rules-a&config=config-a');
  // Kho đang trống: chi tiết cấu hình đề nghị mở công cụ gợi ý đội để nhập kho.
  await page.getByRole('button', {name: 'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('Chưa có kho để đối chiếu.');
  const link = page.getByRole('link', {name: 'Mở scan / nhập kho'});
  await expect(link).toHaveAttribute('href', '/goi-y-doi-tu-kho/');
  await link.click();
  await expect(page).toHaveURL('/goi-y-doi-tu-kho/');
  await expect(page.locator('#section-roster-recommend .tool-head')).toBeVisible();
});

test('tool pages drop old season links and run on the legacy teams', async ({page}) => {
  await page.goto('/soi-doi-tu-anh/?scenario=x&ruleset=y&config=z&q=giu');
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  await expect(page).toHaveURL('/soi-doi-tu-anh/?q=giu');
  await expect(page.locator('#season-controls, #season-scenario, #season-ruleset, #season-summary')).toHaveCount(0);
  await expect(page.locator('#section-analyze .ana-drop')).toBeVisible();
  await expect(page.locator('#section-analyze')).not.toContainText('Tất cả — tham khảo');

  await page.goto('/goi-y-doi-tu-kho/?scenario=x&ruleset=y');
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  await expect(page).toHaveURL('/goi-y-doi-tu-kho/');
  await expect(page.locator('#season-controls, #season-scenario, #season-ruleset, #season-summary')).toHaveCount(0);
  await page.getByRole('button', {name: 'Xác nhận dữ liệu đã đọc'}).click();
  await page.getByRole('button', {name: 'Gợi ý 5 đội', exact: true}).click();
  await expect(page.locator('#section-roster-recommend .roster-results')).toBeVisible();
});
