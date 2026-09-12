import {test,expect} from '@playwright/test';

for (const width of [320,375,768,1280]) {
  for (const theme of ['light','dark']) {
    test(`recommended browser is usable at ${width}px in ${theme}`,async({page})=>{
      await page.setViewportSize({width,height:800});
      await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
      await page.goto('/#team-chuan');
      if (width <= 820) await page.locator('#section-menu-toggle').click();
      await expect(page.getByRole('button',{name:'Team chuẩn',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'Team khác',exact:true})).toBeVisible();
      if (width <= 820) await page.locator('#section-menu-toggle').click();
      await expect(page.getByLabel('Phiên bản luật')).toBeHidden();
      await expect(page.locator('#section-team-chuan').getByLabel('Mùa nguồn',{exact:true})).toBeVisible();
      await expect(page.getByLabel('Tìm Team chuẩn')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({path:test.info().outputPath(`recommended-${width}-${theme}.png`),fullPage:true});
    });
  }
}

test('historical hashes canonicalize to Team khác source views',async({page})=>{
  await page.goto('/#team-pk');
  await expect(page).toHaveURL(/source=team-intro.*#team-khac|#team-khac.*source=team-intro/);
  await expect(page.getByRole('button',{name:'Team khác',exact:true})).toHaveClass(/active/);
  await page.goto('/#meta-cu');
  await expect(page).toHaveURL(/source=moi-phe.*#team-khac|#team-khac.*source=moi-phe/);
});

test('cards expose holders tactics books and readable detail',async({page})=>{
  await page.goto('/#team-chuan');
  const card=page.locator('#section-team-chuan .reference-team-card').first();
  await expect(card.locator('.reference-holder')).toHaveCount(3);
  await expect(card.locator('.tactics .tag').first()).toBeVisible();
  await expect(card.locator('.books .tag').first()).toBeVisible();
  await card.getByRole('button',{name:'Chi tiết'}).click();
  await expect(page.locator('#recommended-team-detail')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('Team khác honors explicit seasons and does not leak facets into Team chuẩn',async({page})=>{
  await page.goto('/?faction=Thục#team-khac');
  await expect(page.locator('#section-team-khac .reference-team-card').first()).toBeVisible();
  await page.getByRole('button',{name:'Team chuẩn',exact:true}).click();
  await expect(page).not.toHaveURL(/faction=/);
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  await page.getByRole('button',{name:'Team khác',exact:true}).click();
  const season=page.locator('#section-team-khac').getByLabel('Mùa nguồn',{exact:true});
  const known=await season.locator('option').evaluateAll(options=>options.map(option=>option.value).find(value=>value!=='all'&&value!=='unknown'));
  await season.selectOption(known);
  await expect(page.locator('#section-team-khac .reference-team-card')).toHaveCount(0);
});

test('scope changes invalidate delayed detail requests',async({page})=>{
  let release;
  let requested;
  const released=new Promise(resolve=>{release=resolve;});
  const started=new Promise(resolve=>{requested=resolve;});
  await page.route('**/data/recommended/*/details-*.json',async route=>{
    requested();
    await released;
    await route.continue();
  });
  await page.goto('/#team-chuan');
  await page.locator('#section-team-chuan .reference-team-card').first().getByRole('button',{name:'Chi tiết'}).click();
  await started;
  const category=page.locator('#section-team-chuan').getByLabel('Danh mục nguồn');
  const next=await category.locator('option').evaluateAll(options=>options[1]?.value);
  await category.selectOption(next);
  release();
  await expect(page).not.toHaveURL(/detail=/);
  await expect(page.locator('#recommended-team-detail')).toHaveCount(0);
});

test('legacy gameplay team opens exact original detail without changing consumer tab',async({page})=>{
  await page.goto('/?legacyTeam=team-intro-14#analyze');
  await expect(page.locator('.nav-tab[data-section="analyze"]')).toHaveClass(/active/);
  await expect(page.locator('#legacy-team-detail')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#legacy-team-detail')).toHaveCount(0);
  await expect(page).not.toHaveURL(/legacyTeam=/);
});

test('leaving reference tabs clears detail state and gameplay config takes precedence',async({page})=>{
  await page.goto('/#team-chuan');
  await page.locator('#section-team-chuan .reference-team-card').first().getByRole('button',{name:'Chi tiết'}).click();
  await expect(page.locator('#recommended-team-detail')).toBeVisible();
  await page.getByRole('button',{name:'Cùng Tồn',exact:true}).click();
  await expect(page).not.toHaveURL(/detail=/);
  await expect(page.locator('#recommended-team-detail')).toHaveCount(0);
  await page.goto('/?config=missing&legacyTeam=team-intro-14#analyze');
  await expect(page.locator('#legacy-team-detail')).toHaveCount(0);
  await expect(page.locator('#season-detail-mount')).toContainText('Không có cấu hình này');
});

test('surface snapshots restore gameplay queries without leaking them into Team chuẩn',async({page})=>{
  await page.goto('/?scenario=binh-dien-xuan-thu&q=quan+su#coexist');
  await expect(page.getByLabel('Tìm Cùng Tồn')).toHaveValue('quan su');
  await page.getByRole('button',{name:'Team chuẩn',exact:true}).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page).toHaveURL(/scenario=binh-dien-xuan-thu/);
  await page.getByRole('button',{name:'Cùng Tồn',exact:true}).click();
  await expect(page).toHaveURL(/q=quan\+su/);
  await expect(page.getByLabel('Tìm Cùng Tồn')).toHaveValue('quan su');
  await page.getByLabel('Tìm Cùng Tồn').fill('cap nhat');
  await page.getByRole('button',{name:'Team chuẩn',exact:true}).click();
  await page.getByRole('button',{name:'Cùng Tồn',exact:true}).click();
  await expect(page.getByLabel('Tìm Cùng Tồn')).toHaveValue('cap nhat');
});

test('original gameplay detail survives an isolated Recommended outage',async({page})=>{
  await page.route('**/data/recommended/**',route=>route.abort());
  await page.goto('/?legacyTeam=team-intro-14#analyze');
  await expect(page.locator('#legacy-team-detail')).toBeVisible();
  await expect(page.locator('#legacy-team-detail h2')).not.toBeEmpty();
  await expect(page.locator('#section-team-chuan .error')).toBeAttached();
  await page.goto('/?detail=missing-reference#analyze');
  await expect(page.locator('#section-analyze .ana-status')).toBeAttached();
  await expect(page.locator('#recommended-team-detail')).toHaveCount(0);
});

test('gameplay navigation invalidates a delayed Recommended detail',async({page})=>{
  let release;
  let requested;
  const released=new Promise(resolve=>{release=resolve;});
  const started=new Promise(resolve=>{requested=resolve;});
  await page.route('**/data/recommended/*/details-*.json',async route=>{
    requested();
    await released;
    await route.continue();
  });
  await page.goto('/#team-chuan');
  await page.locator('#section-team-chuan .reference-team-card').first().getByRole('button',{name:'Chi tiết'}).click();
  await started;
  await page.getByRole('button',{name:'Cùng Tồn',exact:true}).click();
  release();
  await expect(page).not.toHaveURL(/detail=/);
  await expect(page.locator('#recommended-team-detail')).toHaveCount(0);
});

test('source detail preserves alternative holders and prefers available Vietnamese names',async({page,request})=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const index=await (await request.get(`/data/recommended/${pin.generationId}/index.json`)).json();
  const row=index.records.find(row=>row.sourceConfigId==='team-b8ink3');
  const alternatives=row.alternativeHoldersRaw;
  await page.goto('/?detail=team-b8ink3#team-chuan');
  const groups=page.locator('#recommended-team-detail .reference-alternative-group');
  await expect(groups).toHaveCount(Math.ceil(alternatives.length/3));
  const holders=groups.locator('.reference-detail-holder');
  await expect(holders).toHaveCount(alternatives.length);
  for (const [index,holder] of alternatives.entries()) {
    await expect(holders.nth(index).locator('h3')).toHaveText(holder.displayNameVi || holder.nameRaw);
    for (const [slot,raw] of holder.tacticSlotsRaw.entries()) {
      if (raw) await expect(holders.nth(index)).toContainText(holder.tacticSlotsVi?.[slot] || raw);
    }
  }
});

test('Back and Forward restore URL-owned reference snapshots without rewriting history',async({page})=>{
  await page.goto('/?q=sentinel#team-chuan');
  await page.getByRole('button',{name:'Team khác',exact:true}).click();
  await page.goBack();
  await expect(page).toHaveURL(/q=sentinel.*#team-chuan/);
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Team chuẩn')).toHaveValue('sentinel');
  await page.goForward();
  await expect(page).toHaveURL(/#team-khac/);
  await expect(page.getByRole('button',{name:'Team khác',exact:true})).toHaveClass(/active/);
});

const unaccent=value=>(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const referenceData=async request=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const load=async name=>(await request.get(`/data/recommended/${pin.generationId}/${name}`)).json();
  const [seasons,index,other]=await Promise.all([load('seasons.json'),load('index.json'),load('other-teams.json')]);
  return {seasons,index,other};
};

test('localized facet chips filter with raw values and keep the same card membership',async({page,request})=>{
  const {seasons}=await referenceData(request);
  await page.setViewportSize({width:375,height:812});
  await page.goto('/#team-chuan');
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await section.getByRole('button',{name:'Bộ lọc'}).click();
  const chip=section.locator('.fchip[data-focus-key^="faction:"]').first();
  const raw=(await chip.getAttribute('data-focus-key')).slice('faction:'.length);
  await expect(chip).toHaveText(seasons.displayLabels?.faction?.[raw] || raw);
  if (seasons.displayLabels?.faction?.[raw]) {
    expect(await chip.textContent()).not.toMatch(/[\u3400-\u9fff]/);
    await expect(chip).toHaveAttribute('title',raw);
  }
  const matching=await section.locator(`.reference-team-card[data-faction="${raw}"]`).count();
  expect(matching).toBeGreaterThan(0);
  await chip.click();
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('faction'))).toBe(raw);
  await expect(section.locator('.reference-team-card')).toHaveCount(matching);
  await expect(section.locator(`.reference-team-card[data-faction="${raw}"]`)).toHaveCount(matching);
});

test('season search matches Chinese and Vietnamese while the active season stays selected',async({page,request})=>{
  const {seasons}=await referenceData(request);
  const options=seasons.seasonOptions || [];
  const active=options.find(item=>item.sourceSeasonId===seasons.defaultSourceSeasonId) || options[0];
  const target=options.find(item=>item.sourceSeasonId!==active.sourceSeasonId && item.nameRaw);
  await page.goto('/#team-chuan');
  const section=page.locator('#section-team-chuan');
  const season=section.getByLabel('Mùa nguồn',{exact:true});
  const seasonSearch=section.getByLabel('Tìm mùa nguồn');
  await expect(season).toHaveValue(active.sourceSeasonId);
  const activeOption=season.locator(`option[value="${active.sourceSeasonId}"]`);
  if (active.displayNameVi) await expect(activeOption).toContainText(active.displayNameVi);
  else await expect(activeOption).toContainText(active.nameRaw);
  const untranslated=options.find(item=>!item.displayNameVi && item.nameRaw);
  if (untranslated) await expect(season.locator(`option[value="${untranslated.sourceSeasonId}"]`)).toContainText(untranslated.nameRaw);
  const terms=[target.nameRaw,target.displayCode,target.displayNameVi && unaccent(target.displayNameVi)].filter(Boolean);
  for (const term of terms) {
    await seasonSearch.fill(term);
    await expect(season.locator(`option[value="${target.sourceSeasonId}"]`)).toHaveCount(1);
    await expect(season).toHaveValue(active.sourceSeasonId);
  }
  await seasonSearch.fill('');
  await season.selectOption(target.sourceSeasonId);
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('season'))).toBe(target.sourceSeasonId);
  await expect(season).toHaveValue(target.sourceSeasonId);
});

test('card and detail name the same source season while Team khác keeps its raw source label',async({page,request})=>{
  const {seasons,index,other}=await referenceData(request);
  const row=index.records.find(item=>item.sourceSeasonId===seasons.defaultSourceSeasonId && item.sourceConfigId);
  const option=(seasons.seasonOptions || []).find(item=>item.sourceSeasonId===row.sourceSeasonId);
  const expectedCode=option?.displayCode || row.sourceSeasonLabel || row.sourceSeasonId;
  const expectedCategory=seasons.displayLabels?.category?.[row.sourceCategoryId] || row.sourceCategoryId;
  await page.goto(`/?detail=${row.sourceConfigId}#team-chuan`);
  const cardNote=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"] .scope-note`).first();
  await expect(cardNote).toContainText(expectedCode);
  await expect(cardNote).toContainText(expectedCategory);
  if (option?.displayNameVi) await expect(cardNote).toContainText(option.displayNameVi);
  const detailNote=page.locator('#recommended-team-detail .scope-note').first();
  await expect(detailNote).toHaveText((await cardNote.textContent()).trim());
  const legacy=other.records.find(item=>item.sourceLabel);
  await page.goto('/#team-khac');
  const legacyNote=page.locator(`#section-team-khac .reference-team-card[data-legacy-team-id="${legacy.legacyTeamId}"] .scope-note`).first();
  await expect(legacyNote).toHaveText(legacy.sourceLabel);
});
