import {test,expect} from '@playwright/test';


for (const width of [320,375,768,1280]) {
  for (const theme of ['light','dark']) {
    test(`recommended browser is usable at ${width}px in ${theme}`,async({page})=>{
      await page.setViewportSize({width,height:800});
      await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
      await page.goto('/#team-chuan');
      if (width <= 820) await page.locator('#section-menu-toggle').click();
      await expect(page.getByRole('tab',{name:'Team chuẩn',exact:true})).toBeVisible();
      await expect(page.getByRole('tab',{name:'Team khác',exact:true})).toBeVisible();
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
  await expect(page.getByRole('tab',{name:'Team khác',exact:true})).toHaveClass(/active/);
  await page.goto('/#meta-cu');
  await expect(page).toHaveURL(/source=moi-phe.*#team-khac|#team-khac.*source=moi-phe/);
});

test('cards expose holders tactics books and a native detail link',async({page})=>{
  await page.goto('/#team-chuan');
  const card=page.locator('#section-team-chuan .reference-team-card').first();
  await expect(card.locator('.reference-holder')).toHaveCount(3);
  await expect(card.locator('.tactics .tag').first()).toBeVisible();
  await expect(card.locator('.books .tag').first()).toBeVisible();
  await card.getByRole('link',{name:'Xem chi tiết'}).click();
  await expect(page).toHaveURL(/\/teams\/recommended\//);
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('Team khác honors explicit seasons and does not leak facets into Team chuẩn',async({page})=>{
  await page.goto('/?faction=Thục#team-khac');
  await expect(page.locator('#section-team-khac .reference-team-card').first()).toBeVisible();
  await page.getByRole('tab',{name:'Team chuẩn',exact:true}).click();
  await expect(page).not.toHaveURL(/faction=/);
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  await page.getByRole('tab',{name:'Team khác',exact:true}).click();
  const season=page.locator('#section-team-khac').getByLabel('Mùa nguồn',{exact:true});
  const known=await season.locator('option').evaluateAll(options=>options.map(option=>option.value).find(value=>value!=='all'&&value!=='unknown'));
  await season.selectOption(known);
  await expect(page.locator('#section-team-khac .reference-team-card')).toHaveCount(0);
});

test('season scope changes stay on the browser and keep the URL authoritative',async({page})=>{
  await page.goto('/#team-chuan');
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  const category=page.locator('#section-team-chuan').getByLabel('Danh mục nguồn');
  const next=await category.locator('option').evaluateAll(options=>options[1]?.value);
  await category.selectOption(next);
  await expect(page).toHaveURL(new RegExp(`category=${encodeURIComponent(next)}`));
  await expect(page).not.toHaveURL(/detail=/);
});

test('old legacy reference links replace into the dedicated original page',async({page})=>{
  await page.goto('/?legacyTeam=team-intro-14#team-khac');
  await expect(page).toHaveURL(/\/teams\/legacy\/team-intro-14\//);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('h1#team-detail-title')).not.toBeEmpty();
});

test('gameplay config keeps precedence over old reference selectors',async({page})=>{
  await page.goto('/#team-chuan');
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  await page.getByRole('button',{name:'Cùng Tồn',exact:true}).click();
  await page.locator('#section-team-chuan .reference-team-card').first().getByRole('button',{name:'Chi tiết'}).click();
  await expect(page.locator('#recommended-team-detail')).toBeVisible();
  await page.getByRole('tab',{name:'Cùng Tồn',exact:true}).click();

  await expect(page).not.toHaveURL(/detail=/);
  await page.goto('/?config=missing&legacyTeam=team-intro-14#analyze');
  await expect(page).not.toHaveURL(/teams\/legacy/);
  await expect(page.locator('#season-detail-mount')).toContainText('Không có cấu hình này');
});

test('surface snapshots restore gameplay queries without leaking them into Team chuẩn',async({page})=>{
  await page.goto('/?scenario=binh-dien-xuan-thu&q=quan+su#coexist');
  await expect(page.getByLabel('Tìm Cùng Tồn')).toHaveValue('quan su');
  await page.getByRole('tab',{name:'Team chuẩn',exact:true}).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page).toHaveURL(/scenario=binh-dien-xuan-thu/);
  await page.getByRole('tab',{name:'Cùng Tồn',exact:true}).click();
  await expect(page).toHaveURL(/q=quan\+su/);
  await expect(page.getByLabel('Tìm Cùng Tồn')).toHaveValue('quan su');
  await page.getByLabel('Tìm Cùng Tồn').fill('cap nhat');
  await page.getByRole('tab',{name:'Team chuẩn',exact:true}).click();
  await page.getByRole('tab',{name:'Cùng Tồn',exact:true}).click();
  await expect(page.getByLabel('Tìm Cùng Tồn')).toHaveValue('cap nhat');
});

test('root keeps other tabs usable during an isolated Recommended outage',async({page})=>{
  await page.route('**/data/recommended/**',route=>route.abort());
  await page.goto('/#analyze');
  await expect(page.locator('#section-analyze .ana-status')).toBeAttached();
  await expect(page.locator('#section-team-chuan .error')).toBeAttached();
  await expect(page.locator('#section-team-khac .error')).toBeAttached();
  // Old reference selectors cannot be resolved without the publication, so the root stays put.
  await page.goto('/?detail=missing-reference#analyze');
  await expect(page).not.toHaveURL(/teams\/recommended/);
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
  await page.getByRole('tab',{name:'Cùng Tồn',exact:true}).click();
  release();
  await expect(page).not.toHaveURL(/detail=/);
  await expect(page.locator('#recommended-team-detail')).toHaveCount(0);

});

test('source detail preserves alternative holders and prefers available Vietnamese names',async({page,request})=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const index=await (await request.get(`/data/recommended/${pin.generationId}/index.json`)).json();
  const row=index.records.find(row=>row.sourceConfigId==='team-b8ink3');
  const alternatives=row.alternativeHoldersRaw;
  await page.goto('/teams/recommended/team-b8ink3/');
  const groups=page.locator('#team-detail-body .reference-alternative-group');
  await expect(groups).toHaveCount(Math.ceil(alternatives.length/3));
  const holders=groups.locator('.reference-detail-holder');
  await expect(holders).toHaveCount(alternatives.length);
  for (const [index,holder] of alternatives.entries()) {
    const displayName=holder.displayNameVi || holder.nameRaw;
    await expect(holders.nth(index).locator('h4 .hn')).toHaveText(displayName.replace(/^(SP|CO|40Y)\s+/,''));
    for (const [slot,raw] of holder.tacticSlotsRaw.entries()) {
      if (raw) await expect(holders.nth(index)).toContainText(holder.tacticSlotsVi?.[slot] || raw);
    }
  }
});

test('Back and Forward restore URL-owned reference snapshots without rewriting history',async({page})=>{
  await page.goto('/?q=sentinel#team-chuan');
  await page.getByRole('tab',{name:'Team khác',exact:true}).click();
  await page.goBack();
  await expect(page).toHaveURL(/q=sentinel.*#team-chuan/);
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Team chuẩn')).toHaveValue('sentinel');
  await page.goForward();
  await expect(page).toHaveURL(/#team-khac/);
  await expect(page.getByRole('tab',{name:'Team khác',exact:true})).toHaveClass(/active/);
});

const scopedCount=(records,predicate)=>records.filter(predicate).length;
const referenceData=async request=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const load=async name=>(await request.get(`/data/recommended/${pin.generationId}/${name}`)).json();
  const [seasons,index,other]=await Promise.all([load('seasons.json'),load('index.json'),load('other-teams.json')]);
  return {seasons,index,other};
};

test('localized facet chips filter with raw values, show scoped counts and keep the same card membership',async({page,request})=>{
  const {seasons,index}=await referenceData(request);
  await page.setViewportSize({width:375,height:812});
  await page.goto('/#team-chuan');
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await section.getByRole('button',{name:'Bộ lọc'}).click();
  const groups=await section.locator('.fgroup .flabel').allTextContents();
  // Primary order is Loại binh → Điểm → Phe; the retired Tier facet is gone.
  expect(groups.slice(0,3)).toEqual(['Loại binh','Điểm','Phe']);
  expect(groups).not.toContain('Tier');
  const chip=section.locator('.fchip[data-focus-key^="faction:"]').first();
  const raw=(await chip.getAttribute('data-focus-key')).slice('faction:'.length);
  const label=seasons.displayLabels?.faction?.[raw] || raw;
  const season=seasons.defaultSourceSeasonId;
  const scoped=scopedCount(index.records,row=>row.sourceSeasonId===season && (row.factionRaw ?? row.faction)===raw);
  await expect(chip).toHaveText(`${label} (${scoped})`);
  if (seasons.displayLabels?.faction?.[raw]) {
    expect(await chip.textContent()).not.toMatch(/[\u3400-\u9fff]/);
    await expect(chip).toHaveAttribute('title',raw);
  }
  const matching=await section.locator(`.reference-team-card[data-faction="${raw}"]`).count();
  expect(matching).toBe(scoped);
  await chip.click();
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('faction'))).toBe(raw);
  await expect(section.locator('.reference-team-card')).toHaveCount(matching);
  await expect(section.locator(`.reference-team-card[data-faction="${raw}"]`)).toHaveCount(matching);
  // Scoped counts stay anchored to season/category, not to the active selection.
  await expect(chip).toHaveText(`${label} (${scoped})`);
});

test('mobile keeps search and the native season select outside the collapsed filters and has no season search box',async({page,request})=>{
  const {seasons}=await referenceData(request);
  const options=seasons.seasonOptions || [];
  const active=options.find(item=>item.sourceSeasonId===seasons.defaultSourceSeasonId) || options[0];
  const target=options.find(item=>item.sourceSeasonId!==active.sourceSeasonId);
  await page.setViewportSize({width:375,height:812});
  await page.goto('/#team-chuan');
  const section=page.locator('#section-team-chuan');
  const season=section.getByLabel('Mùa nguồn',{exact:true});
  await expect(section.getByLabel('Tìm mùa nguồn')).toHaveCount(0);
  await expect(section.locator('#section-team-chuan-filters')).toHaveClass(/collapsed/);
  await expect(season).toBeVisible();
  await expect(section.getByLabel('Tìm Team chuẩn')).toBeVisible();
  await expect(season).toHaveValue(active.sourceSeasonId);
  const activeOption=season.locator(`option[value="${active.sourceSeasonId}"]`);
  if (active.displayNameVi) await expect(activeOption).toContainText(active.displayNameVi);
  else await expect(activeOption).toContainText(active.nameRaw);
  const untranslated=options.find(item=>!item.displayNameVi && item.nameRaw);
  if (untranslated) await expect(season.locator(`option[value="${untranslated.sourceSeasonId}"]`)).toContainText(untranslated.nameRaw);
  await season.selectOption(target.sourceSeasonId);
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('season'))).toBe(target.sourceSeasonId);
  await expect(season).toHaveValue(target.sourceSeasonId);
  await expect(season).toBeVisible();
  await expect(section.getByLabel('Tìm Team chuẩn')).toBeVisible();
});

test('empty category, uncollected season and an unmatched filter read as different states',async({page,request})=>{
  const {seasons}=await referenceData(request);
  const scopes=seasons.scopes || [];
  const empty=scopes.find(scope=>scope.state==='empty-category');
  const uncollected=scopes.find(scope=>scope.state==='uncollected-season');
  const section=page.locator('#section-team-chuan');
  const scopeUrl=scope=>`/?season=${encodeURIComponent(scope.sourceSeasonId)}&category=${encodeURIComponent(scope.sourceCategoryId)}#team-chuan`;
  await page.goto(scopeUrl(empty));
  await expect(section.locator('.empty')).toHaveText('Nguồn xác nhận danh mục này hiện không có đội.');
  await expect(section.locator('.scope-note')).toContainText('không có đội');
  if (uncollected) {
    await page.goto(scopeUrl(uncollected));
    await expect(section.locator('.empty')).toHaveText('Mùa nguồn chưa được thu thập.');
  }
  const complete=scopes.find(scope=>scope.state==='complete');
  await page.goto(`${scopeUrl(complete).slice(0,-'#team-chuan'.length)}&q=khong-ton-tai-tren-doi#team-chuan`);
  await expect(section.locator('.empty')).toHaveText('Không có đội khớp bộ lọc.');
  await expect(section.locator('.fchip').first()).toBeAttached();
});

test('the source scope caption lives on the detail page and never on a card',async({page,request})=>{
  const {seasons,index,other}=await referenceData(request);
  const row=index.records.find(item=>item.sourceSeasonId===seasons.defaultSourceSeasonId && item.sourceConfigId);
  const option=(seasons.seasonOptions || []).find(item=>item.sourceSeasonId===row.sourceSeasonId);
  const expectedCode=option?.displayCode || row.sourceSeasonLabel || row.sourceSeasonId;
  const expectedCategory=seasons.displayLabels?.category?.[row.sourceCategoryId] || row.sourceCategoryId;
  await page.goto('/#team-chuan');
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await expect(card.locator('.scope-note')).toHaveCount(0);
  await expect(card).not.toContainText(expectedCode);
  await page.goto(`/teams/recommended/${encodeURIComponent(row.sourceConfigId)}/`);
  const detailNote=page.locator('#team-detail-root .detail-header .scope-note').last();
  await expect(detailNote).toContainText(expectedCode);
  await expect(detailNote).toContainText(expectedCategory);
  if (option?.displayNameVi) await expect(detailNote).toContainText(option.displayNameVi);
  const legacy=other.records.find(item=>item.sourceLabel);
  await page.goto('/#team-khac');
  const legacyCard=page.locator(`#section-team-khac .reference-team-card[data-legacy-team-id="${legacy.legacyTeamId}"]`);
  await expect(legacyCard).toBeVisible();
  await expect(legacyCard.locator('.scope-note')).toHaveCount(0);
});

for (const [sourceConfigId,codes] of [
  ['og-bingyan-40y-lvbu-b',['40Y',null,'SP']],
  ['og-bingyan-wunv-cavalry-hubaoqi',['CO',null,'CO']],
]) {
  test(`holder variant prefixes render as badges on card and detail of ${sourceConfigId}`,async({page,request})=>{
    const {index}=await referenceData(request);
    const row=index.records.find(item=>item.sourceConfigId===sourceConfigId);
    const assertHeadings=async headings=>{
      for (const [position,code] of codes.entries()) {
        const name=row.heroes[position].displayNameVi;
        const heading=headings.nth(position);
        await expect(heading.locator('.pre')).toHaveCount(code ? 1 : 0);
        if (code) await expect(heading.locator('.pre')).toHaveText(code);
        await expect(heading.locator('.hn')).toHaveText(code ? name.slice(code.length+1) : name);
        if (code==='CO') await expect(heading.locator('.hn')).toContainText('Vô Song');
      }
    };
    await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}#team-chuan`);
    const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${sourceConfigId}"]`);
    await expect(card).toBeVisible();
    await assertHeadings(card.locator('.reference-holder .hero-name'));
    await page.goto(`/teams/recommended/${encodeURIComponent(sourceConfigId)}/`);
    await expect(page.locator('#team-detail-body')).toBeVisible();
    await assertHeadings(page.locator('#team-detail-body .reference-detail-holder h3'));
  });
}

test('bond slots read as Duyên phận and never as selectable tactics',async({page,request})=>{
  const {index}=await referenceData(request);
  const row=index.records.find(item=>item.sourceConfigId==='s27-han-hanshi-gong-1');
  const holderIndex=row.heroes.findIndex(hero=>hero.tacticSlotsRaw.includes('桃園結義'));
  expect(holderIndex).toBeGreaterThanOrEqual(0);
  const hero=row.heroes[holderIndex];
  const bondIndex=hero.tacticSlotsRaw.indexOf('桃園結義');
  expect(hero.tacticSlotKinds?.[bondIndex]).toBe('bond');
  const tactics=hero.tacticSlotsRaw
    .map((raw,slot)=>hero.tacticSlotsVi?.[slot] || raw || 'Chưa có dữ liệu')
    .filter((_,slot)=>slot!==bondIndex);
  const bond='Kết Nghĩa Vườn Đào';
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}#team-chuan`);
  const cardHolder=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"] .reference-holder`).nth(holderIndex);
  await expect(cardHolder.locator('.bonds .slot-label')).toHaveText('Duyên phận:');
  await expect(cardHolder.locator('.bonds .t-bond')).toHaveText(bond);
  await expect(cardHolder.locator('.bonds button')).toHaveCount(0);
  await expect(cardHolder.locator('.tactics .t-tactic')).toHaveText(tactics);
  await expect(cardHolder.locator('.tactics')).not.toContainText(bond);
  await page.goto(`/teams/recommended/${encodeURIComponent(row.sourceConfigId)}/`);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  const detailHolder=page.locator('#team-detail-body .reference-detail-holder').nth(holderIndex);
  await expect(detailHolder.locator('.holder-bonds dd')).toHaveText(bond);
  await expect(detailHolder.locator('.holder-tactics dd')).toHaveText(tactics.join(' · '));
});

test('compact cards keep complete source content, native links and non-navigating chips',async({page,request})=>{
  const {seasons,index}=await referenceData(request);
  const row=index.records.find(item=>item.value!=null && item.heroes?.length===3 && (item.alternativeHoldersRaw || []).length>0 && (item.unitTypesRaw || []).length>0);
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}#team-chuan`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();

  // Tier badge và caption phạm vi đã bỏ khỏi thẻ; điểm nguồn ở góc phải trên.
  await expect(card.locator('.badge.tier')).toHaveCount(0);
  await expect(card.locator('.scope-note')).toHaveCount(0);
  const score=card.locator('.reference-score');
  await expect(score).toHaveText(String(row.value));
  const title=card.locator('.team-name a');
  const [titleBox,scoreBox,cardBox]=await Promise.all([title.boundingBox(),score.boundingBox(),card.boundingBox()]);
  expect(scoreBox.x).toBeGreaterThanOrEqual(titleBox.x+titleBox.width-1);
  expect(scoreBox.y+scoreBox.height).toBeLessThanOrEqual(cardBox.y+cardBox.height/2);

  // Nhãn loại binh và phe tiếng Việt hiển thị được, không chỉ là data attribute.
  for (const unit of row.unitTypesRaw) await expect(card.locator('.units')).toContainText(seasons.displayLabels?.unit?.[unit] || unit);
  await expect(card.locator('.badge.faction')).toHaveText(seasons.displayLabels?.faction?.[row.factionRaw] || row.factionRaw);

  // Ba holder vẫn đủ; chỉ holder đầu có nhãn Chủ tướng, không render vai trò raw của ba hàng.
  const primaryHolders=card.locator(':scope > .heroes > .reference-holder');
  await expect(primaryHolders).toHaveCount(3);
  await expect(primaryHolders.locator('.main-holder')).toHaveCount(1);
  await expect(primaryHolders.first().locator('.main-holder')).toHaveText('C');
  await expect(primaryHolders.nth(1).locator('.main-holder')).toHaveCount(0);
  await expect(primaryHolders.nth(2).locator('.main-holder')).toHaveCount(0);
  for (const [position,holder] of row.heroes.entries()) {
    const view=primaryHolders.nth(position);
    for (const [slot,raw] of (holder.tacticSlotsRaw || []).entries()) {
      if (raw && holder.tacticSlotKinds?.[slot]!=='bond') await expect(view.locator('.tactics')).toContainText(holder.tacticSlotsVi?.[slot] || raw);
    }
    for (const [slot,raw] of (holder.bookSlotsRaw || []).entries()) {
      if (raw) await expect(view.locator('.books')).toContainText(holder.bookSlotsVi?.[slot] || raw);
    }
  }

  // Phương án thay thế nằm trong disclosure mở được bằng bàn phím, không mất nội dung.
  const alternatives=card.locator('details.reference-alternatives');
  const first=row.alternativeHoldersRaw[0];
  const firstName=first.displayNameVi || first.nameRaw;
  await expect(alternatives.locator('summary')).toContainText(String(row.alternativeHoldersRaw.length));
  await expect(alternatives.locator('.reference-holder').first()).toBeHidden();
  await alternatives.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(alternatives).toHaveAttribute('open','');
  await expect(alternatives.locator('.reference-holder')).toHaveCount(row.alternativeHoldersRaw.length);
  const alternativeHolders=alternatives.locator('.reference-holder');
  await expect(alternativeHolders.locator('.main-holder')).toHaveCount(Math.ceil(row.alternativeHoldersRaw.length/3));
  for (let index=0;index<row.alternativeHoldersRaw.length;index+=1) {
    await expect(alternativeHolders.nth(index).locator('.main-holder')).toHaveCount(index%3===0 ? 1 : 0);
  }
  await expect(alternatives.locator('.reference-holder').first()).toContainText(firstName.replace(/^(SP|CO|40Y)\s+/,''));

  // Title và CTA là cùng một link thật; chip chiến pháp chỉ tìm kiếm.
  const cta=card.getByRole('link',{name:'Xem chi tiết'});
  expect(await title.getAttribute('href')).toBe(await cta.getAttribute('href'));
  const tactic=primaryHolders.locator('.tactics .t-tactic').first();
  const tacticText=(await tactic.textContent()).trim();
  await tactic.click();
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page).toHaveURL(/#team-chuan/);
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(tacticText);
});

test('Team khác cards keep real counter chips that search without leaving the browser',async({page,request})=>{
  const {other}=await referenceData(request);
  const legacy=other.records.find(item=>item.legacyContent?.counters?.good?.length);
  const good=legacy.legacyContent.counters.good[0];
  await page.goto('/#team-khac');
  const section=page.locator('#section-team-khac');
  const card=section.locator(`.reference-team-card[data-legacy-team-id="${legacy.legacyTeamId}"]`);
  await expect(card).toBeVisible();
  for (const name of legacy.legacyContent.counters.good) await expect(card.locator('.counters')).toContainText(name);
  for (const name of legacy.legacyContent.counters.avoid || []) await expect(card.locator('.counters')).toContainText(name);
  await card.locator('.counters .chip.good').first().click();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(good);
  await expect(section.locator(`.reference-team-card[data-legacy-team-id="${legacy.legacyTeamId}"]`)).toHaveCount(1);
});

test('score facet keeps selections visible outside the collapsed eight and only filters',async({page,request})=>{
  const {index}=await referenceData(request);
  const seasonId=[...new Set(index.records.map(row=>row.sourceSeasonId))]
    .map(id=>({id,values:new Set(index.records.filter(row=>row.sourceSeasonId===id).map(row=>row.value))}))
    .sort((a,b)=>b.values.size-a.values.size)[0];
  expect(seasonId.values.size).toBeGreaterThanOrEqual(36);
  const scoped=index.records.filter(row=>row.sourceSeasonId===seasonId.id);
  const numeric=[...new Set(scoped.filter(row=>row.value!=null).map(row=>row.value))].sort((a,b)=>b-a);
  const target=numeric[20];
  const expected=scoped.filter(row=>row.value===target).length;
  await page.goto(`/?season=${encodeURIComponent(seasonId.id)}#team-chuan`);
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  const group=section.locator('.fgroup.score-group');
  await expect(group.locator('.fchip')).toHaveCount(8);
  const visible=await group.locator('.fchip').allTextContents();
  expect(visible.map(text=>Number(text.replace(/\s*\(\d+\)$/,'')))).toEqual(numeric.slice(0,8));
  const expand=group.getByRole('button',{name:/Xem tất cả mức điểm/});
  await expect(expand).toHaveAttribute('aria-expanded','false');
  const before=await section.locator('.reference-team-card').count();
  await expand.click();
  const collapse=group.getByRole('button',{name:'Thu gọn'});
  await expect(collapse).toHaveAttribute('aria-expanded','true');
  await expect(group.locator('.fchip')).toHaveCount(numeric.length+(scoped.some(row=>row.value==null)?1:0));
  await expect(section.locator('.reference-team-card')).toHaveCount(before);
  const chip=group.locator(`.fchip[data-focus-key="score:${target}"]`);
  await chip.click();
  expect(await page.evaluate(()=>new URL(location.href).searchParams.getAll('score'))).toEqual([String(target)]);
  await expect(section.locator('.reference-team-card')).toHaveCount(expected);
  await collapse.click();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('aria-pressed','true');
  await expect(group.locator('.fchip')).toHaveCount(9);
  await expect(section.locator('.reference-team-card')).toHaveCount(expected);
  await section.getByRole('button',{name:'Xóa lọc'}).click();
  expect(await page.evaluate(()=>new URL(location.href).searchParams.getAll('score'))).toEqual([]);
  await expect(section.locator('.reference-team-card')).toHaveCount(before);
});

test('retired tier and sort selectors are reported and dropped without touching gameplay scope',async({page,request})=>{
  const {index}=await referenceData(request);
  const seasonId=index.records[0].sourceSeasonId;
  const total=index.records.filter(row=>row.sourceSeasonId===seasonId).length;
  await page.goto(`/?season=${encodeURIComponent(seasonId)}&tier=T1&sort=score&scenario=binh-dien-xuan-thu#team-chuan`);
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.scope-note')).toContainText('không còn áp dụng');
  await expect(section.locator('.reference-team-card')).toHaveCount(total);
  await expect(section.locator('.fgroup .flabel')).not.toContainText(['Tier']);
  await expect(page).toHaveURL(/scenario=binh-dien-xuan-thu/);
});

const gridColumns=page=>page.evaluate(()=>new Set([...document.querySelectorAll('#section-team-chuan .team-grid > .reference-team-card')]
  .slice(0,12).map(card=>Math.round(card.getBoundingClientRect().x))).size);

for (const [width,columns] of [[1440,4],[1100,3],[800,2],[375,1],[320,1]]) {
  test(`reference grid renders ${columns} readable columns at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/#team-chuan');
    const card=page.locator('#section-team-chuan .reference-team-card').first();
    await expect(card).toBeVisible();
    expect(await gridColumns(page)).toBe(columns);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    const overlap=await page.evaluate(()=>{
      const card=document.querySelector('#section-team-chuan .reference-team-card');
      const title=card.querySelector('.team-name').getBoundingClientRect();
      const score=card.querySelector('.reference-score').getBoundingClientRect();
      const box=card.getBoundingClientRect();
      const inside=[...card.querySelectorAll('.reference-holder,.counters,.ana-link-btn,details.reference-alternatives')]
        .every(node=>node.getBoundingClientRect().right<=box.right+1);
      return {overlaps:title.right>score.left+1 && title.top<score.bottom && score.top<title.bottom,inside};
    });
    expect(overlap.overlaps).toBe(false);
    expect(overlap.inside).toBe(true);
    await page.screenshot({path:test.info().outputPath(`reference-grid-${width}.png`),fullPage:false});
  });
}
