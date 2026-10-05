import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/** Link điều hướng của mục: bảng desktop trong header hoặc menu mobile đang mở (footer cũng có link cùng tên). */
function navLink(page, name, mobile = false) {
  return (mobile ? page.locator('#section-menu-items') : page.locator('.quick-nav')).getByRole('link', { name, exact: true });
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
  const season = page.locator('#section-coexist .reference-season-field select');
  await expect(season.locator('option')).toHaveText(['OG · Binh Diễn Xuân Thu', 'PK-S26 · Anh Hùng Mệnh Thế']);
  await expect(page.locator('#section-coexist select')).toHaveCount(1);
  await expect(page.locator('#season-scenario, #season-ruleset')).toHaveCount(0);
  // Không có `scenario` trong URL: mặc định mùa mới nhất, ghi bằng replaceState.
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('scenario'))).toBe('binh-dien-xuan-thu');
  await expect(season).toHaveValue('binh-dien-xuan-thu');
  await expect(page.locator('#section-coexist .reference-season-status')).toBeVisible();
  await expect(page.locator('#season-summary')).toBeHidden();
  await expect(page.locator('#section-coexist input[type="search"], #section-coexist .clear-btn, #section-coexist .fchip, #section-coexist > .scope-note')).toHaveCount(0);
  await expect(page.locator('#section-coexist')).not.toContainText('Chưa xác định kịch bản');
  // Badge cấp đội (`.reference-tier`, vd. "19C") là dữ liệu nguồn; không có điểm/tier mùa.
  await expect(page.locator('#section-coexist .config-score, #section-coexist .badge.tier:not(.reference-tier)')).toHaveCount(0);
  await expect(page.locator('#section-coexist .coexist-team-card').first()).toBeAttached();
  for (const scenarioId of ['anh-hung-menh-the','binh-dien-xuan-thu']) {
    await season.selectOption(scenarioId);
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('scenario'))).toBe(scenarioId);
    expect(await page.evaluate(() => new URL(location.href).searchParams.has('ruleset'))).toBe(false);
    await expect(page.locator('#section-coexist .reference-season-status')).toBeVisible({visible: scenarioId === 'binh-dien-xuan-thu'});
    // Chỉ nhóm đang xem được dựng: 5 đội của một nhóm, không phải cả 5 nhóm của kịch bản.
    await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(5);
    await expect(page.locator('#section-coexist .coexist-team-card')).toHaveCount(5);
    const coexistCards = page.locator('#section-coexist .coexist-team-card');
    expect(await coexistCards.evaluateAll(cards => cards.every(card => {
      const holders = card.querySelectorAll(':scope > .heroes > .reference-holder');
      return holders.length === 3
        && [...holders].every(holder => holder.querySelector(':scope > .hero-name'))
        && [...holders].map(holder => holder.dataset.role).join('|') === 'CHỦ|PHÓ 1|PHÓ 2';
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
  await expect(page.locator('#season-config-detail')).toContainText('Điểm: 132.5');
  await expect(page.locator('#season-config-detail')).toContainText('Cấu hình: config-a · scenario-a · rules-a');
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-b');
  await expect(page).toHaveURL(/config=config-b/);
  await expect(page.locator('#season-config-detail')).toContainText('Chiến pháp 1: Hai');
  await expect(page.locator('#season-config-detail')).toContainText('Chưa có điểm');
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
  await expect(page.locator('#season-config-detail .config-score')).toContainText('Chưa có điểm');
  await page.getByRole('button',{name:'Đối chiếu kho của tôi'}).click();
  await expect(page.locator('.season-inventory-comparison')).toContainText('Thiếu chiến pháp: Bảy');
});
test('coexist keeps only the season scope and ignores stale filter query', async ({page}) => {
  await controlledBundle(page);
  await page.goto('/cung-ton/?scenario=scenario-a&q=sentinel-missing&source=legacy');
  // Chỉ một mùa đã review trong fixture: ô chọn mùa có trong DOM nhưng ẩn; không có bộ chọn phạm vi cũ.
  await expect(page.locator('#section-coexist select')).toHaveCount(1);
  await expect(page.locator('#section-coexist .reference-season-field')).toBeHidden();
  await expect(page.locator('#season-scenario, #season-ruleset')).toHaveCount(0);
  await expect(page.locator('#section-coexist input[type="search"], #section-coexist .clear-btn, #section-coexist .fchip')).toHaveCount(0);
  await expect(page.locator('#section-coexist .coexist-team-card')).not.toHaveCount(0);
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
for (const width of [320,375,768,1024]) test(`season details remain usable at ${width}px in both themes`,async({page},testInfo)=>{
  await controlledBundle(page);
  await page.setViewportSize({width,height:800});
  await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-a');
  await expect(page.locator('#season-config-detail')).toBeVisible();
  const close=page.getByRole('button',{name:'Đóng chi tiết'});
  await close.focus();await expect(close).toBeFocused();
  for (const theme of ['light','dark']) {
    if (theme === 'dark') await page.locator('#theme-toggle').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.locator('#season-config-detail').screenshot({path:testInfo.outputPath(`scope-${width}-${theme}.png`)});
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
  await expect(page.locator('#season-config-detail .config-score')).toHaveText('Chưa có điểm');
  await page.getByLabel('Tướng 1 · Tướng',{exact:true}).selectOption('hero:dung');
  await expect(page.locator('#season-config-detail .config-score')).toHaveText('Điểm: 132.5');
  await expect(page.locator('#season-config-detail a[target="_blank"]')).toHaveCount(0);
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
  await expect(page.locator('#season-config-detail .config-score')).toHaveText('Điểm: 132.5');
  await expect(page.locator('#section-team-khac .error')).toHaveCount(0);
});
for(const width of [375,1280]) test(`real Binh Dien review screenshot at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await page.goto('/cung-ton/?scenario=binh-dien-xuan-thu');
  await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(5);
  await expect(page.locator('#section-coexist .coexist-team-card')).toHaveCount(5);
  const season=page.locator('#section-coexist .reference-season-field select');
  await expect(season).toHaveValue('binh-dien-xuan-thu');
  await expect(season.locator('option:checked')).toHaveText('OG · Binh Diễn Xuân Thu');
  await season.focus();await expect(season).toBeFocused();
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
test('coexist lists exact-pair applicable groups before scenario-only reference groups',async({page})=>{
  const data=await seasonConsumerFixture();const link=structuredClone(data['season-content-links'][0]);
  link.id='link-pair';link.recordId='source-group-pair';link.rulesetId='rules-a';
  link.target.payload.groupLabel='Nhóm áp dụng';link.target.payload.teams.forEach(team=>{team.recordId+='-pair';});
  const {contentFingerprintProjection}=await import('../js/season-context.js');
  link.target.contentFingerprint=await seasonFingerprint(contentFingerprintProjection(link.target.payload));
  const proof={...structuredClone(data['season-evidence'].find(item=>item.id==='source-attribution')),id:'source-pair-proof',claim:{kind:'ruleset-applicability',scenarioId:'scenario-a',rulesetId:'rules-a'}};
  data['season-evidence'].push(proof);link.evidenceRefs=['source-proof',proof.id];data['season-content-links'].push(link);
  await controlledBundle(page,data);await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a');
  const referenceLabel=data['season-content-links'][0].target.payload.groupLabel.trim();
  await expect(page.locator('#section-coexist .coexist-group-chip .coexist-chip-label')).toHaveText(['Nhóm áp dụng',referenceLabel]);
  await expect(page.locator('#section-coexist .coexist-group-chip').first()).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#section-coexist section.coexist-group')).toHaveAttribute('data-record-id','source-group-pair');
  await expect(page.locator('#season-summary')).toBeHidden();
  await expect(page.locator('#section-coexist > .scope-note')).toHaveCount(0);
  await expect(page.locator('#section-coexist .config-score, #section-coexist .badge.tier:not(.reference-tier)')).toHaveCount(0);
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
  const labels = new Map(data['season-registry'].filter(item => item.reviewStatus === 'reviewed').map(item => [item.id, item.labelVi]));
  // Ô chọn mùa đặt mùa mới nhất lên đầu, các mùa còn lại theo thứ tự registry.
  const latest = 'binh-dien-xuan-thu';
  const scenarioOrder = [latest, ...[...labels.keys()].filter(id => id !== latest)];
  expect(new Set(expected.map(group => group.scenarioId)), {message: 'dữ liệu thật phải có nhiều hơn một kịch bản'}).toEqual(new Set(scenarioOrder));

  await page.goto('/cung-ton/');
  const season = page.locator('#section-coexist .reference-season-field select');
  await expect(season.locator('option')).toHaveCount(scenarioOrder.length);
  await expect(season.locator('option')).toHaveText(scenarioOrder.map(id => labels.get(id)));
  expect(await season.locator('option').evaluateAll(nodes => nodes.map(node => node.value))).toEqual(scenarioOrder);
  await expect(season).toHaveValue(latest);
  const groupLabels = () => page.locator('#section-coexist .coexist-group-chip .coexist-chip-label').allTextContents();
  for (const scenarioId of [...scenarioOrder].reverse()) {
    await season.selectOption(scenarioId);
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('scenario'))).toBe(scenarioId);
    await expect(season).toHaveValue(scenarioId);
    const inScope = expected.filter(group => group.scenarioId === scenarioId);
    await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(inScope.length);
    const rendered = await groupLabels();
    expect(rendered).toEqual(inScope.map(group => group.content.groupLabel));
    // Không có hai nút cùng nhãn trong một hàng.
    expect(new Set(rendered).size).toBe(rendered.length);
  }

  // Nhóm đang chọn ghi `recordId` vào URL bằng replaceState (không thêm bước lịch sử) và reload giữ nhóm.
  const target = expected.filter(group => group.scenarioId === scenarioOrder[0])[1];
  const historyLength = await page.evaluate(() => history.length);
  await page.locator(`#section-coexist .coexist-group-chip[data-group-key="${target.recordId}"]`).click();
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveAttribute('data-group-key', target.recordId);
  expect(await page.evaluate(() => new URL(location.href).searchParams.get('group'))).toBe(target.recordId);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"] .coexist-chip-label')).toHaveText(target.content.groupLabel);
  await expect(page.locator('#section-coexist section.coexist-group')).toHaveAttribute('data-record-id', target.recordId);
  await expect(page.locator('#section-coexist section.coexist-group > h2')).toHaveText(target.content.groupLabel);

  await page.reload();
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveAttribute('data-group-key', target.recordId);
  await expect(page.locator('#section-coexist section.coexist-group')).toHaveAttribute('data-record-id', target.recordId);

  // Đổi kịch bản sang phạm vi không còn nhóm này: về nhóm đầu và URL bỏ `group`.
  await season.selectOption(scenarioOrder[1]);
  await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.has('group'))).toBe(false);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(expected.filter(group => group.scenarioId === scenarioOrder[1]).length);
});

test('coexist brief keeps every source field verbatim and counts from the rendered group', async ({page}) => {
  const links = JSON.parse(await readFile(new URL('../data/season-content-links.json', import.meta.url), 'utf8'));
  // Nhóm có `summaryRaw` chạm biên khoảng trắng: chuỗi đã nhận phải được giữ nguyên.
  const link = links.find(item => item.target.payload.summaryRaw !== item.target.payload.summaryRaw.trim());
  expect(link, {message: 'dữ liệu thật phải có nhóm chạm biên khoảng trắng'}).toBeTruthy();
  const payload = link.target.payload;
  await page.goto(`/cung-ton/?scenario=binh-dien-xuan-thu&group=${link.recordId}`);

  const group = page.locator('#section-coexist .coexist-group');
  await expect(group).toHaveCount(1);
  await expect(group).toHaveAttribute('data-record-id', link.recordId);
  await expect(page.locator('#section-coexist .coexist-group-chip[aria-pressed="true"] .coexist-chip-label')).toHaveText(payload.groupLabel);
  await expect(group.locator('.scope-note')).toHaveCount(0);
  // Nguyên văn, không tách câu: summaryRaw ở dòng tóm tắt; ghi chú nhiều dòng và gợi ý khai hoang
  // nằm trong phần gập (đóng mặc định) và đều còn nguyên chuỗi. Không dẫn link ra ngoài.
  const summary = await group.locator('.coexist-summary').textContent();
  expect(summary).toBe(payload.summaryRaw);
  const notes = group.locator('details.coexist-notes');
  await expect(notes).toHaveCount(1);
  await expect(notes).not.toHaveAttribute('open', /.*/);
  await expect(notes.locator('summary.coexist-notes-summary')).toHaveText('Ghi chú & gợi ý khai hoang');
  const raws = await group.locator('.coexist-raw-text').allTextContents();
  expect(raws).toContain(payload.notesRaw.replace(/\r\n?/g, '\n'));
  expect(raws).toContain(payload.openingSuggestionsRaw.replace(/\r\n?/g, '\n'));
  expect(raws).not.toContain(link.target.source.disclaimerRaw);
  expect(raws.find(text => text === payload.notesRaw.replace(/\r\n?/g, '\n')).split('\n').length)
    .toBe(payload.notesRaw.replace(/\r\n?/g, '\n').split('\n').length);
  await expect(group.locator('.coexist-raw-text')).toHaveCount(2);
  await expect(group.locator('a[target="_blank"]')).toHaveCount(0);

  // Số liệu tính độc lập trong test từ chính mảng tướng của nhóm.
  const names = payload.teams.flatMap(team => team.heroes.map(hero => hero.nameRaw.trim()));
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  const verdict = duplicates.length ? `có trùng: ${duplicates.join(', ')}` : 'không trùng';
  await expect(group.locator('.coexist-count-line')).toHaveText(`${payload.teams.length} đội · ${new Set(names).size} tướng · ${verdict}`);
  await expect(group.locator('.coexist-count-ok')).toHaveCount(duplicates.length ? 0 : 1);
  await expect(group.locator('.coexist-team-card')).toHaveCount(payload.teams.length);
  await expect(group.locator('.coexist-team-card .reference-holder')).toHaveCount(payload.teams.length * 3);

  // Biên khoảng trắng: chuỗi nguồn đã nhận giữ nguyên (chỉ chuẩn hoá CRLF), không bị trim khi hiện.
  expect(summary.trim()).not.toBe(summary);
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
  await expect(group.locator('.scope-note')).toHaveCount(0);
  // Nhánh legacy chỉ có Tổng quan (summary): không nguồn, không lưu ý nguồn, không gợi ý khai hoang.
  await expect(group.locator('.coexist-summary')).toHaveCount(1);
  await expect(group.locator('.coexist-notes, .coexist-raw-text')).toHaveCount(0);
  await expect(group.locator('.coexist-count-line')).toHaveText('5 đội · 15 tướng · không trùng');
  await expect(group.locator('.coexist-team-card')).toHaveCount(5);
  await expect(page.locator('#section-coexist .coexist-group-chip')).toHaveCount(5);
  await expect(page.locator('#section-coexist .reference-season-field')).toBeHidden();
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
    const season = page.locator('#section-coexist .reference-season-field select');
    const groups = page.locator('#section-coexist .coexist-group-chip');
    await expect(season.locator('option')).toHaveCount(2);
    await expect(groups).toHaveCount(5);

    // Đổi sang mùa KHÔNG đầu tiên khi ô chọn mùa đang focus: sau khi mục dựng lại, focus vẫn ở ô chọn mùa.
    const secondId = await season.locator('option').nth(1).getAttribute('value');
    await season.focus();
    await season.selectOption(secondId);
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get('scenario'))).toBe(secondId);
    await expect(season).toHaveValue(secondId);
    await expect(season).toBeFocused();
    await expect(groups).toHaveCount(5);
    // Tab đi tiếp sang hàng phiên bản, Shift+Tab quay lại đúng ô chọn mùa.
    await page.keyboard.press('Tab');
    expect((await active()).className).toContain('coexist-group-chip');
    await page.keyboard.press('Shift+Tab');
    await expect(season).toBeFocused();

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

    // Về mùa đầu (mới nhất): ô chọn mùa giữ focus dù URL đổi và hàng phiên bản dựng lại theo phạm vi mới.
    const firstId = await season.locator('option').first().getAttribute('value');
    await season.focus();
    await season.selectOption(firstId);
    await expect(season).toHaveValue(firstId);
    await expect(season).toBeFocused();
    await expect(groups).toHaveCount(5);
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.has('group'))).toBe(false);
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

test('tool pages drop old scenario links; Gợi ý đội keeps ?season= and fills from legacy teams only as reference', async ({page, request}) => {
  // Gợi ý đội chỉ chạy trên kho đã đọc (kho rỗng khoá nút Xác nhận): gieo tướng/chiến pháp của một đội legacy.
  // Chế độ Meta chỉ xét đội cũ có bậc T0–T1 trong team-tier.
  const tiers = await (await request.get('/data/team-tier.json')).json();
  const metaIds = new Set(tiers.filter(entry => entry.rankings.some(ranking => ['T0', 'T0.5', 'T1'].includes(ranking.tier))).map(entry => entry.teamId));
  const team = (await (await request.get('/data/teams.json')).json()).find(item => metaIds.has(item.id));
  await page.addInitScript(state => localStorage.setItem('tqccl.rosterRecommend.scanState.v1', JSON.stringify(state)), {
    ownedHeroes: team.heroes.map(hero => ({name: hero.name || hero.baseName})),
    ownedTactics: team.heroes.flatMap(hero => (hero.tactics || []).map(tactic => ({name: tactic.name}))),
    lockedTeams: [],
    confirmed: false,
    updatedAt: '2026-07-25T00:00:00.000Z',
  });
  await page.goto('/soi-doi-tu-anh/?scenario=x&ruleset=y&config=z&q=giu');
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  await expect(page).toHaveURL('/soi-doi-tu-anh/?q=giu');
  await expect(page.locator('#season-controls, #season-scenario, #season-ruleset, #season-summary')).toHaveCount(0);
  await expect(page.locator('#section-analyze .ana-drop')).toBeVisible();
  await expect(page.locator('#section-analyze')).not.toContainText('Tất cả — tham khảo');

  await page.goto('/goi-y-doi-tu-kho/?scenario=x&ruleset=y&season=pk-s28');
  await expect(page.locator('body')).toHaveAttribute('data-boot', 'ready');
  await expect(page).toHaveURL('/goi-y-doi-tu-kho/?season=pk-s28');
  await expect(page.locator('#season-controls, #season-scenario, #season-ruleset, #season-summary')).toHaveCount(0);
  await expect(page.getByLabel('Mùa bạn đang chơi')).toHaveValue('pk-s28');
  await page.getByRole('button', {name: 'Xác nhận dữ liệu đã đọc'}).click();
  await page.getByRole('button', {name: 'Gợi ý 5 đội', exact: true}).click();
  const results = page.locator('#section-roster-recommend .roster-results');
  await expect(results).toBeVisible();
  // Đội cũ chỉ lấp chỗ trống của mùa: mọi hàng mang nhãn "Tham khảo – đội cũ" đứng sau mọi hàng của mùa.
  const rows = results.locator('.roster-team-list').first().locator('.roster-result-team');
  await expect(rows.first()).toBeVisible();
  const legacyFlags = await rows.evaluateAll(nodes => nodes.map(node => node.querySelector('.roster-status[data-status="legacy"]')?.textContent ?? null));
  const firstLegacy = legacyFlags.findIndex(flag => flag !== null);
  if (firstLegacy >= 0) expect(legacyFlags.slice(firstLegacy)).toEqual(legacyFlags.slice(firstLegacy).map(() => 'Tham khảo – đội cũ'));
});

test('Cùng Tồn has exactly one scenario control and it owns the URL, reload and Back', async ({page}) => {
  const reviewed = JSON.parse(await readFile(new URL('../data/season-registry.json', import.meta.url), 'utf8'))
    .filter(item => item.reviewStatus === 'reviewed');
  expect(reviewed.length, {message: 'dữ liệu thật phải có ít nhất hai kịch bản đã review'}).toBeGreaterThan(1);
  // Mùa mới nhất đứng đầu ô chọn mùa và là mặc định; các mùa còn lại theo thứ tự registry.
  const latest = 'binh-dien-xuan-thu';
  const registry = [...reviewed.filter(item => item.id === latest), ...reviewed.filter(item => item.id !== latest)];
  const query = () => page.evaluate(() => new URL(location.href).searchParams.get('scenario'));
  const section = page.locator('#section-coexist');
  const season = section.locator('.reference-season-field select');
  const status = section.locator('.reference-season-status');
  const shows = async index => {
    await expect(season).toHaveValue(registry[index].id);
    await expect(season.locator('option:checked')).toHaveText(registry[index].labelVi);
    await expect(status).toBeVisible({visible: registry[index].id === latest});
    await expect.poll(query).toBe(registry[index].id);
  };
  await page.goto('/cung-ton/');
  await expect(season.locator('option')).toHaveText(registry.map(item => item.labelVi));
  await expect(section.locator('select, [role="combobox"]')).toHaveCount(1);
  await expect(page.locator('#season-scenario, #season-ruleset')).toHaveCount(0);
  await shows(0);
  const before = await page.evaluate(() => history.length);
  await season.selectOption(registry[1].id);
  await shows(1);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await page.reload();
  await shows(1);
  await page.goBack();
  await shows(0);
  await page.goForward();
  await shows(1);
});

test('closing a Cùng Tồn configuration returns focus to the Cùng Tồn heading', async ({page}) => {
  await controlledBundle(page);
  for (const close of ['button', 'Escape']) {
    await page.goto('/cung-ton/?scenario=scenario-a&ruleset=rules-a&config=config-a');
    const closeButton = page.getByRole('button', {name: 'Đóng chi tiết'});
    await expect(closeButton).toBeVisible();
    if (close === 'button') await closeButton.click();
    else { await closeButton.focus(); await page.keyboard.press('Escape'); }
    await expect(page.locator('#season-config-detail')).toHaveCount(0);
    await expect(page.locator('#section-coexist h1.reference-title')).toBeFocused();
  }
});
