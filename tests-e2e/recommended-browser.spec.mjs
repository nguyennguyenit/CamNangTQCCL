import {test,expect} from '@playwright/test';

/** Link điều hướng của mục: bảng desktop trong header hoặc menu mobile đang mở (footer cũng có link cùng tên). */
function navLink(page, name, mobile = false) {
  return (mobile ? page.locator('#section-menu-items') : page.locator('.site-nav')).getByRole('link', { name, exact: true });
}

/** Detail routes come from the frozen inventory the build embedded, never from a re-derived slug. */
const routeHandles=async request=>{
  const html=await (await request.get('/doi-chuan/')).text();
  const match=html.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error('Built Team chuẩn page lacks the team route handle map');
  return JSON.parse(match[1]);
};
const recommendedPath=async(request,id)=>`/doi-chuan/${encodeURIComponent((await routeHandles(request)).r[id])}/`;


for (const width of [320,375,768,1280]) {
  for (const theme of ['light','dark']) {
    test(`recommended browser is usable at ${width}px in ${theme}`,async({page})=>{
      await page.setViewportSize({width,height:800});
      await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
      await page.goto('/doi-chuan/');
      if (width < 1280) await page.locator('#section-menu-toggle').click();
      await expect(navLink(page, 'Đội chuẩn', width < 1280)).toHaveAttribute('aria-current','page');
      await expect(navLink(page, 'Đội khác', width < 1280)).toHaveAttribute('href','/doi-khac/');
      if (width < 1280) await page.locator('.site-menu-close').click();
      await expect(page.getByLabel('Phiên bản luật')).toBeHidden();
      await expect(page.locator('#section-team-chuan').getByLabel('Mùa nguồn',{exact:true})).toBeVisible();
      await expect(page.getByLabel('Tìm Đội chuẩn')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      await page.screenshot({path:test.info().outputPath(`recommended-${width}-${theme}.png`),fullPage:true});
    });
  }
}

test('historical hashes redirect to the canonical Team khác source views',async({page})=>{
  await page.goto('/#team-pk');
  await expect(page).toHaveURL(/\/doi-khac\/\?source=team-intro$/);
  await expect(navLink(page, 'Đội khác')).toHaveAttribute('aria-current','page');
  await page.goto('/#meta-cu');
  await expect(page).toHaveURL(/\/doi-khac\/\?source=moi-phe$/);
});

test('cards expose holders tactics books and a native detail link',async({page})=>{
  await page.goto('/doi-chuan/');
  const card=page.locator('#section-team-chuan .reference-team-card').first();
  await expect(card.locator('.reference-holder')).toHaveCount(3);
  await expect(card.locator('.reference-role').first()).toHaveText('CHỦ');
  await expect(card.locator('.tactics .tag').first()).toBeVisible();
  await expect(card.locator('.books').first()).toContainText('Binh thư ·');
  await card.getByRole('link',{name:'Chi tiết'}).click();
  await expect(page).toHaveURL(/\/doi-chuan\//);
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('Team khác honors explicit factions and seasons',async({page})=>{
  await page.goto('/doi-khac/?faction=Thục');
  await expect(page.locator('#section-team-khac .reference-team-card').first()).toBeVisible();
  const season=page.locator('#section-team-khac').getByLabel('Mùa nguồn',{exact:true});
  const known=await season.locator('option').evaluateAll(options=>options.map(option=>option.value).find(value=>value!=='all'&&value!=='unknown'));
  await season.selectOption(known);
  await expect(page.locator('#section-team-khac .reference-team-card')).toHaveCount(0);
});

test('season scope changes stay on the browser; a retired category key is stripped and never narrows the list',async({page,request})=>{
  const {seasons,index}=await referenceData(request);
  const section=page.locator('#section-team-chuan');
  const inDefault=index.records.filter(row=>row.sourceSeasonId===seasons.defaultSourceSeasonId);
  // Danh mục không khớp ít nhất một đội của mùa mặc định: nếu còn được áp dụng thì danh sách sẽ hụt.
  const category=index.records.map(row=>row.sourceCategoryId).find(value=>value&&inDefault.some(row=>row.sourceCategoryId!==value));
  expect(category,{message:'cần một danh mục thu hẹp được mùa mặc định'}).toBeTruthy();
  await page.goto(`/doi-chuan/?category=${encodeURIComponent(category)}`);
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await expect(page).not.toHaveURL(/category=/);
  await expect(section.locator('.reference-team-card')).toHaveCount(inDefault.length);
  await expect(section.getByLabel('Danh mục nguồn')).toHaveCount(0);
  const season=section.getByLabel('Mùa nguồn',{exact:true});
  const next=await season.locator('option').evaluateAll((options,current)=>options.map(option=>option.value).find(value=>value!==current),seasons.defaultSourceSeasonId);
  await season.selectOption(next);
  await expect(page).toHaveURL(new RegExp(`season=${encodeURIComponent(next)}`));
  await expect(page).not.toHaveURL(/detail=/);
});

test('old legacy reference links replace into the dedicated original page',async({page})=>{
  await page.goto('/doi-khac/?legacyTeam=team-intro-14');
  await expect(page).toHaveURL(/\/doi-khac\/lieu-co-ky\//);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('h1#team-detail-title')).not.toBeEmpty();
});

test('gameplay config keeps precedence over old reference selectors',async({page})=>{
  await page.goto('/doi-chuan/');
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  await navLink(page, 'Cùng Tồn').click();
  await expect(page).toHaveURL('/cung-ton/');
  await expect(page).not.toHaveURL(/detail=/);
  await page.goto('/cung-ton/?config=missing&legacyTeam=team-intro-14');
  await expect(page).not.toHaveURL(/doi-khac/);
  await expect(page.locator('#season-detail-mount')).toContainText('Không có cấu hình này');
});


test('a section surfaces its own error during an isolated Recommended outage',async({page})=>{
  await page.route('**/data/recommended/**',route=>route.abort());
  await page.goto('/doi-chuan/');
  await expect(page.locator('#section-team-chuan .error')).toBeAttached();
  await expect(page.locator('body')).toHaveAttribute('data-page-section','team-chuan');
  await page.goto('/doi-chuan/?detail=missing-reference');
  await expect(page).toHaveURL('/doi-chuan/?detail=missing-reference');
  await expect(page.locator('#section-team-chuan .error')).toBeAttached();
});

test('source detail preserves alternative holders and prefers available Vietnamese names',async({page,request})=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const index=await (await request.get(`/data/recommended/${pin.generationId}/index.json`)).json();
  const row=index.records.find(row=>row.sourceConfigId==='team-b8ink3');
  const alternatives=row.alternativeHoldersRaw;
  await page.goto('/doi-chuan/pk-s24-tu-ma-phi-hung/');
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
  await page.goto('/doi-chuan/?q=sentinel');
  await navLink(page, 'Đội khác').click();
  await expect(page).toHaveURL('/doi-khac/');
  await page.goBack();
  await expect(page).toHaveURL('/doi-chuan/?q=sentinel');
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn')).toHaveValue('sentinel');
  await page.goForward();
  await expect(page).toHaveURL('/doi-khac/');
  await expect(navLink(page, 'Đội khác')).toHaveAttribute('aria-current','page');
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
  await page.goto('/doi-chuan/');
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await section.getByRole('button',{name:'Bộ lọc'}).click();
  const groups=await section.locator('.fgroup .flabel').allTextContents();
  // Bộ lọc điểm đã bỏ: nhóm chính là Loại binh → Phe, Nhóm/Nguồn thu gọn phía sau.
  expect(groups.slice(0,2)).toEqual(['Loại binh','Phe']);
  expect(groups).not.toContain('Điểm');
  expect(groups).not.toContain('Tier');
  const chip=section.locator('.fchip[data-focus-key^="faction:"]').first();
  const raw=(await chip.getAttribute('data-focus-key')).slice('faction:'.length);
  const label=seasons.displayLabels?.faction?.[raw] || raw;
  const season=seasons.defaultSourceSeasonId;
  const scoped=scopedCount(index.records,row=>row.sourceSeasonId===season && (row.factionRaw ?? row.faction)===raw);
  await expect(chip).toHaveText(`${label} ${scoped}`);
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
  await expect(chip).toHaveText(`${label} ${scoped}`);
});

test('mobile keeps search and the native season select outside the collapsed filters and has no season search box',async({page,request})=>{
  const {seasons}=await referenceData(request);
  const options=seasons.seasonOptions || [];
  const active=options.find(item=>item.sourceSeasonId===seasons.defaultSourceSeasonId) || options[0];
  const target=options.find(item=>item.sourceSeasonId!==active.sourceSeasonId);
  await page.setViewportSize({width:375,height:812});
  await page.goto('/doi-chuan/');
  const section=page.locator('#section-team-chuan');
  const season=section.getByLabel('Mùa nguồn',{exact:true});
  await expect(section.getByLabel('Tìm mùa nguồn')).toHaveCount(0);
  await expect(section.locator('#section-team-chuan-filters')).toHaveClass(/collapsed/);
  await expect(season).toBeVisible();
  await expect(section.getByLabel('Tìm Đội chuẩn')).toBeVisible();
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
  await expect(section.getByLabel('Tìm Đội chuẩn')).toBeVisible();
});

test('uncollected season and an unmatched filter read as different states',async({page,request})=>{
  const {seasons}=await referenceData(request);
  const scopes=seasons.scopes || [];
  const uncollected=scopes.find(scope=>scope.state==='uncollected-season');
  const section=page.locator('#section-team-chuan');
  const seasonUrl=scope=>`/doi-chuan/?season=${encodeURIComponent(scope.sourceSeasonId)}`;
  if (uncollected) {
    await page.goto(seasonUrl(uncollected));
    await expect(section.locator('.empty')).toHaveText('Mùa nguồn chưa được thu thập.');
    await expect(section.locator('.scope-note')).toContainText('chưa được thu thập');
  }
  const complete=scopes.find(scope=>scope.state==='complete');
  await page.goto(`${seasonUrl(complete)}&q=khong-ton-tai-tren-doi`);
  await expect(section.locator('.empty')).toHaveText('Không có đội khớp bộ lọc.');
  await expect(section.locator('.fchip').first()).toBeAttached();
});

test('the source scope caption lives on the detail page and never on a card',async({page,request})=>{
  const {seasons,index,other}=await referenceData(request);
  const row=index.records.find(item=>item.sourceSeasonId===seasons.defaultSourceSeasonId && item.sourceConfigId);
  const option=(seasons.seasonOptions || []).find(item=>item.sourceSeasonId===row.sourceSeasonId);
  const expectedCode=option?.displayCode || row.sourceSeasonLabel || row.sourceSeasonId;
  const expectedCategory=seasons.displayLabels?.category?.[row.sourceCategoryId] || row.sourceCategoryId;
  await page.goto('/doi-chuan/');
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await expect(card.locator('.scope-note')).toHaveCount(0);
  await expect(card).not.toContainText(expectedCode);
  await page.goto(await recommendedPath(request,row.sourceConfigId));
  const detailNote=page.locator('#team-detail-root .detail-header .scope-note').last();
  await expect(detailNote).toContainText(expectedCode);
  await expect(detailNote).toContainText(expectedCategory);
  if (option?.displayNameVi) await expect(detailNote).toContainText(option.displayNameVi);
  const legacy=other.records.find(item=>item.sourceLabel);
  await page.goto('/doi-khac/');
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
    await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
    const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${sourceConfigId}"]`);
    await expect(card).toBeVisible();
    await assertHeadings(card.locator('.reference-holder .hero-name'));
    // Nhãn biến thể đứng cùng hàng, ngay trước tên (không rớt thành một dòng riêng phía trên tên).
    for (const heading of await card.locator('.reference-holder .hero-name:has(.pre)').all()) {
      const [badge,name]=await Promise.all([heading.locator('.pre').boundingBox(),heading.locator('.hn').boundingBox()]);
      expect(badge.x+badge.width).toBeLessThanOrEqual(name.x);
      expect(Math.abs(badge.y-name.y)).toBeLessThan(badge.height);
    }
    await page.goto(await recommendedPath(request,sourceConfigId));
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
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
  const cardHolder=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"] .reference-holder`).nth(holderIndex);
  await expect(cardHolder.locator('.bonds .slot-label')).toHaveText('Duyên phận:');
  await expect(cardHolder.locator('.bonds .t-bond')).toHaveText(bond);
  await expect(cardHolder.locator('.bonds button')).toHaveCount(0);
  await expect(cardHolder.locator('.tactics .t-tactic')).toHaveText(tactics);
  await expect(cardHolder.locator('.tactics')).not.toContainText(bond);
  await page.goto(await recommendedPath(request,row.sourceConfigId));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  const detailHolder=page.locator('#team-detail-body .reference-detail-holder').nth(holderIndex);
  await expect(detailHolder.locator('.detail-hero-bonds .detail-hero-label')).toHaveText('Duyên phận');
  await expect(detailHolder.locator('.detail-hero-bond-list .t-bond')).toHaveText(bond);
  await expect(detailHolder.locator('.detail-hero-tactics-vi')).toHaveText(tactics);
  await expect(detailHolder.locator('.detail-hero-tactics-block')).not.toContainText(bond);
});

test('compact cards keep complete source content, native links and non-navigating chips',async({page,request})=>{
  const {seasons,index}=await referenceData(request);
  const row=index.records.find(item=>item.value!=null && item.heroes?.length===3 && (item.alternativeHoldersRaw || []).length>0 && (item.unitTypesRaw || []).length>0);
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
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

  // Dòng "■ phe · binh": phe và loại binh tiếng Việt hiển thị được, không chỉ là data attribute.
  const meta=card.locator('.reference-meta');
  await expect(meta.locator('.reference-faction')).toHaveText(seasons.displayLabels?.faction?.[row.factionRaw] || row.factionRaw);
  for (const unit of row.unitTypesRaw) await expect(meta.locator('.reference-units')).toContainText(seasons.displayLabels?.unit?.[unit] || unit);

  // Ba hàng tướng đủ, vai trò viết tắt theo đúng thứ tự; huy hiệu Chủ tướng chỉ còn ở trang chi tiết.
  const primaryHolders=card.locator(':scope > .heroes > .reference-holder');
  await expect(primaryHolders).toHaveCount(3);
  await expect(primaryHolders.locator('.reference-role')).toHaveText(['CHỦ','PHÓ 1','PHÓ 2']);
  await expect(card.locator('.main-holder')).toHaveCount(0);
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
  await expect(alternativeHolders.locator('.reference-role')).toHaveText(
    row.alternativeHoldersRaw.map((_,index)=>['CHỦ','PHÓ 1','PHÓ 2'][index%3]),
  );
  await expect(alternatives.locator('.reference-holder').first()).toContainText(firstName.replace(/^(SP|CO|40Y)\s+/,''));

  // Title và CTA là cùng một link thật; nút chiến pháp chỉ tìm kiếm.
  const cta=card.getByRole('link',{name:'Chi tiết'});
  expect(await title.getAttribute('href')).toBe(await cta.getAttribute('href'));
  const tactic=primaryHolders.locator('.tactics .t-tactic').first();
  const tacticText=(await tactic.textContent()).trim();
  await tactic.click();
  expect(new URL(page.url()).pathname).toBe('/doi-chuan/');
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(tacticText);
});

test('absent book slots stay noninteractive and distinct from missing translations',async({page,request})=>{
  const {index}=await referenceData(request);
  const row=index.records.find(item=>
    item.heroes?.length===3
    && item.heroes.every(holder=>
      (holder.bookSlotsRaw || []).every(value=>!String(value || '').trim())
      && !String(holder.statFocusRaw || '').trim(),
    ),
  );
  expect(row).toBeTruthy();
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await expect(card.locator('.books button')).toHaveCount(0);
  await expect(card.locator('.books')).toHaveCount(3);
  await expect(card.locator('.books .reference-books-missing')).toHaveText(['Nguồn chưa ghi','Nguồn chưa ghi','Nguồn chưa ghi']);
  await expect(card.locator('.books').filter({hasText:'Nội dung tiếng Việt chưa sẵn sàng'})).toHaveCount(0);
  await card.getByRole('link',{name:'Chi tiết'}).click();
  // Chi tiết giữ nguyên phân biệt "nguồn trống" với "chưa dịch": cả ba thẻ đều ghi nhãn trống, không bịa chữ.
  await expect(page.locator('#team-detail-body .detail-hero-books-block .detail-hero-missing')).toHaveText([
    'Chưa có dữ liệu',
    'Chưa có dữ liệu',
    'Chưa có dữ liệu',
  ]);
  await expect(page.locator('#team-detail-body .detail-hero-books-block').first()).not.toContainText('Nội dung tiếng Việt chưa sẵn sàng');
  // Chỉ số trống hoàn toàn: đầu thẻ chỉ còn vai trò, không có ô chỉ số rỗng.
  await expect(page.locator('#team-detail-body .detail-hero-stat')).toHaveCount(0);
  await expect(page.locator('#team-detail-body .detail-hero-role')).toHaveText(['Chủ tướng','Phó tướng 1','Phó tướng 2']);
});

test('Team khác cards read the "Sợ …" line from legacy counters without chips',async({page,request})=>{
  const {other}=await referenceData(request);
  const legacy=other.records.find(item=>item.legacyContent?.counters?.avoid?.length);
  const avoid=legacy.legacyContent.counters.avoid;
  await page.goto('/doi-khac/');
  const section=page.locator('#section-team-khac');
  const card=section.locator(`.reference-team-card[data-legacy-team-id="${legacy.legacyTeamId}"]`);
  await expect(card).toBeVisible();
  const fear=card.locator('.reference-fear');
  await expect(fear).toContainText('Sợ');
  for (const name of avoid) await expect(fear).toContainText(name);
  // Chip ⚔/⚠ đã bỏ khỏi thẻ: chỉ còn nút chiến pháp, mọi nút khác biến mất.
  await expect(card.locator('.counters, .chip')).toHaveCount(0);
  await expect(card.locator('button:not(.t-tactic)')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  // Đội chuẩn không có bản ghi nào ghi đội sợ → thẻ không giữ khoảng trống cho dòng này.
  await page.goto('/doi-chuan/');
  await expect(page.locator('#section-team-chuan .reference-fear')).toHaveCount(0);
});

test('a retired score filter is ignored, stripped from the URL and never filters the list',async({page,request})=>{
  const {index}=await referenceData(request);
  const seasonId=index.records[0].sourceSeasonId;
  const total=index.records.filter(row=>row.sourceSeasonId===seasonId).length;
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(seasonId)}&score=113`);
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card')).toHaveCount(total);
  await expect(section.locator('.fgroup .flabel')).not.toContainText(['Điểm']);
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).search)).toBe(`?season=${encodeURIComponent(seasonId)}`);
  await expect(page).toHaveURL(new RegExp(`/doi-chuan/\\?season=${encodeURIComponent(seasonId)}$`));
});

test('retired tier and sort selectors are reported and dropped without touching gameplay scope',async({page,request})=>{
  const {index}=await referenceData(request);
  const seasonId=index.records[0].sourceSeasonId;
  const total=index.records.filter(row=>row.sourceSeasonId===seasonId).length;
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(seasonId)}&tier=T1&sort=score&scenario=binh-dien-xuan-thu`);
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.scope-note')).toContainText('không còn áp dụng');
  await expect(section.locator('.reference-team-card')).toHaveCount(total);
  await expect(section.locator('.fgroup .flabel')).not.toContainText(['Tier']);
  await expect(page).toHaveURL(/scenario=binh-dien-xuan-thu/);
});

const gridColumns=page=>page.evaluate(()=>new Set([...document.querySelectorAll('#section-team-chuan .team-grid > .reference-team-card')]
  .slice(0,12).map(card=>Math.round(card.getBoundingClientRect().x))).size);

// Lưới thẻ gọn: 2 cột khi còn sidebar, 1 cột khi sidebar thu thành panel.
for (const [width,columns] of [[1440,2],[1100,2],[800,1],[375,1],[320,1]]) {
  test(`reference grid renders ${columns} readable columns at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/doi-chuan/');
    const card=page.locator('#section-team-chuan .reference-team-card').first();
    await expect(card).toBeVisible();
    expect(await gridColumns(page)).toBe(columns);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    const overlap=await page.evaluate(()=>{
      const card=document.querySelector('#section-team-chuan .reference-team-card');
      const title=card.querySelector('.team-name').getBoundingClientRect();
      const score=card.querySelector('.reference-score').getBoundingClientRect();
      const box=card.getBoundingClientRect();
      const inside=[...card.querySelectorAll('.reference-holder,.reference-meta,.ana-link-btn,details.reference-alternatives')]
        .every(node=>node.getBoundingClientRect().right<=box.right+1);
      return {overlaps:title.right>score.left+1 && title.top<score.bottom && score.top<title.bottom,inside};
    });
    expect(overlap.overlaps).toBe(false);
    expect(overlap.inside).toBe(true);
    await page.screenshot({path:test.info().outputPath(`reference-grid-${width}.png`),fullPage:false});
  });
}

test('compact cards drop the hero panel and give tactic buttons a 44px mobile hit box',async({page,request})=>{
  const {index}=await referenceData(request);
  const row=index.records.find(item=>item.heroes?.length===3 && item.value!=null);
  await page.setViewportSize({width:390,height:812});
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
  const section=page.locator('#section-team-chuan');
  const card=section.locator(`.reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  const measured=await card.locator('.reference-holder').first().evaluate(holder=>{
    const tactic=holder.querySelector('.t-tactic');
    const books=holder.querySelector('.books');
    const style=getComputedStyle(holder);
    const cardStyle=getComputedStyle(holder.closest('.reference-team-card'));
    const box=tactic.getBoundingClientRect();
    const neighbour=tactic.nextElementSibling?.getBoundingClientRect();
    return {
      hit:{height:Math.round(box.height),width:Math.round(box.width)},
      overlapWithNeighbour:neighbour
        ? box.right>neighbour.left+0.5 && box.bottom>neighbour.top+0.5 && neighbour.bottom>box.top+0.5
        : false,
      heroBackground:style.backgroundColor,
      cardBackground:cardStyle.backgroundColor,
      heroRadius:style.borderRadius,
      tacticColor:getComputedStyle(tactic).color,
      booksDisplay:getComputedStyle(books).display,
      booksText:books.textContent,
    };
  });
  // A5: vùng bấm chiến pháp ≥ 44px và không chồng lên nút bên cạnh.
  expect(measured.hit.height).toBeGreaterThanOrEqual(44);
  expect(measured.hit.width).toBeGreaterThanOrEqual(44);
  expect(measured.overlapWithNeighbour).toBe(false);
  // Thẻ gọn không còn vỏ panel của component chung.
  expect(measured.heroBackground).toBe(measured.cardBackground);
  expect(measured.heroRadius).toBe('0px');
  expect(measured.booksDisplay).toBe('block');
  expect(measured.booksText.startsWith('Binh thư · ')).toBe(true);
  const tactic=card.locator('.reference-holder').first().locator('.t-tactic').first();
  const text=(await tactic.textContent()).trim();
  await tactic.click();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(text);
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
});

test('the legacy table names rows by nickname before name without touching identity',async({page,request})=>{
  const {other}=await referenceData(request);
  const legacy=other.records.find(item=>item.nickname && item.name && item.nickname!==item.name);
  expect(legacy,{message:'cần một bản ghi đội gốc có nickname khác name'}).toBeTruthy();
  await page.goto('/doi-khac/?view=bang');
  const section=page.locator('#section-team-khac');
  const row=section.locator(`.reference-table tbody tr[data-reference-key="${legacy.legacyVariantId || legacy.legacyTeamId}"]`);
  await expect(row).toBeVisible();
  await expect(row.locator('.reference-table-name')).toHaveText(legacy.nickname);
  expect(legacy.nickname).not.toBe(legacy.name);
  const href=await row.locator('.reference-table-name').getAttribute('href');
  await row.locator('.reference-table-name').click();
  await expect(page).toHaveURL(new RegExp(href.split('?')[0]));
  await expect(page.locator('#team-detail-root')).toHaveAttribute('data-legacy-team-id',legacy.legacyTeamId);
  if (legacy.legacyVariantId) await expect(page).toHaveURL(new RegExp(`variant=${encodeURIComponent(legacy.legacyVariantId)}`));
  await expect(page.locator('#team-detail-root')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('Thẻ/Bảng remembers the choice, keeps filters and lets the URL win over storage',async({page})=>{
  await page.goto('/doi-chuan/');
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('tqccl.teamView.v1'))).toBeNull();
  // Đổi chế độ giữ nguyên bộ lọc đang bật và không thêm bước lịch sử.
  const historyBefore=await page.evaluate(()=>history.length);
  await page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn').fill('Lữ Bố');
  const filtered=await section.locator('.reference-team-card').count();
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThan(25);
  await section.locator('.view-btn[data-view="bang"]').click();
  await expect(page).toHaveURL(/view=bang/);
  await expect(page).toHaveURL(/q=L/);
  expect(await page.evaluate(()=>history.length)).toBe(historyBefore);
  expect(await page.evaluate(()=>localStorage.getItem('tqccl.teamView.v1'))).toBe('bang');
  await expect(section.locator('.view-btn[data-view="bang"]')).toHaveAttribute('aria-pressed','true');
  await expect(section.locator('.reference-table tbody tr')).toHaveCount(filtered);
  // Nạp lại trang không có `view`: dùng giá trị đã lưu, vẫn giữ từ khóa tìm.
  await page.goto('/doi-chuan/?q=L%E1%BB%AF%20B%E1%BB%91');
  await expect(section.locator('.reference-table tbody tr')).toHaveCount(filtered);
  await expect(section.locator('.view-btn[data-view="the"]')).toHaveAttribute('aria-pressed','false');
  // Trang Đội khác dùng chung lựa chọn đã lưu.
  await page.goto('/doi-khac/');
  await expect(page.locator('#section-team-khac .reference-table tbody tr').first()).toBeVisible();
  // Quay về Thẻ rồi mở URL Bảng đã chia sẻ: URL thắng giá trị đã lưu.
  await page.locator('#section-team-khac .view-btn[data-view="the"]').click();
  await expect(page).not.toHaveURL(/view=/);
  expect(await page.evaluate(()=>localStorage.getItem('tqccl.teamView.v1'))).toBe('the');
  await expect(page.locator('#section-team-khac .reference-team-card').first()).toBeVisible();
  await page.goto('/doi-chuan/?view=bang');
  await expect(page.locator('#section-team-chuan .reference-table tbody tr').first()).toBeVisible();
  await expect(page.locator('#section-team-chuan .view-btn[data-view="bang"]')).toHaveAttribute('aria-pressed','true');
});

// Lưới gọn: số cột theo bề rộng vùng kết quả (tối đa 4), URL `view=luoi` được giữ và nhớ cho cả hai trang.
for (const [width,columns] of [[1440,4],[1280,3],[1024,2],[390,1]]) {
  test(`4-column grid view renders ${columns} compact columns at ${width}px on both team pages`,async({page})=>{
    await page.setViewportSize({width,height:900});
    for (const [path,section] of [['/doi-chuan/','#section-team-chuan'],['/doi-khac/','#section-team-khac']]) {
      await page.goto(`${path}?view=luoi`);
      await expect(page.locator(`${section} .team-grid-dense > .reference-team-card`).first()).toBeVisible();
      await expect(page).toHaveURL(/view=luoi/);
      await expect(page.locator(`${section} .view-btn[data-view="luoi"]`)).toHaveAttribute('aria-pressed','true');
      const layout=await page.evaluate(selector=>{
        const cards=[...document.querySelectorAll(`${selector} .team-grid-dense > .reference-team-card`)].slice(0,12);
        const inside=cards.every(card=>{
          const box=card.getBoundingClientRect();
          const title=card.querySelector('.team-name').getBoundingClientRect();
          const score=card.querySelector('.reference-score-wrap').getBoundingClientRect();
          return title.right<=score.left+1
            && [...card.querySelectorAll('.reference-holder,.reference-meta,.ana-link-btn')].every(node=>node.getBoundingClientRect().right<=box.right+1);
        });
        return {
          columns:new Set(cards.map(card=>Math.round(card.getBoundingClientRect().x))).size,
          inside,
          overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
        };
      },section);
      expect(layout.columns).toBe(columns);
      expect(layout.inside).toBe(true);
      expect(layout.overflow).toBe(false);
    }
  });
}

test('2 cột / 4 cột / Bảng share one remembered choice and one card anatomy across both pages',async({page})=>{
  await page.goto('/doi-chuan/');
  const chuan=page.locator('#section-team-chuan');
  await expect(chuan.locator('.reference-team-card').first()).toBeVisible();
  await chuan.locator('.view-btn[data-view="luoi"]').click();
  await expect(page).toHaveURL(/view=luoi/);
  expect(await page.evaluate(()=>localStorage.getItem('tqccl.teamView.v1'))).toBe('luoi');
  await page.goto('/doi-khac/');
  const khac=page.locator('#section-team-khac');
  await expect(khac.locator('.team-grid-dense > .reference-team-card').first()).toBeVisible();
  await expect(khac.locator('.view-btn[data-view="luoi"]')).toHaveAttribute('aria-pressed','true');
  // Thẻ thiếu điểm vẫn có ô ấn cùng khuôn, đọc được là "Chưa có điểm nguồn" (không phải 0).
  const missing=khac.locator('.reference-team-card .reference-score-wrap.is-missing').first();
  await expect(missing).toBeVisible();
  await expect(missing.locator('.visually-hidden')).toHaveText('Chưa có điểm nguồn');
  await expect(missing.locator('.reference-score')).toHaveText('—');
  // Hai trang cùng cấu tạo thẻ: gáy phe, đầu thẻ, ba hàng tướng, chân thẻ có CTA.
  const anatomy=section=>page.locator(section).locator('.reference-team-card').first().evaluate(card=>({
    faction:Boolean(card.dataset.factionCode),
    parts:[...card.children].map(child=>child.className.split(' ')[0]).filter(name=>name!=='reference-alternatives'),
    roles:[...card.querySelectorAll(':scope > .heroes > .reference-holder .reference-role')].map(role=>role.textContent),
  }));
  const other=await anatomy('#section-team-khac');
  await khac.locator('.view-btn[data-view="the"]').click();
  await expect(page).not.toHaveURL(/view=/);
  expect(await page.evaluate(()=>localStorage.getItem('tqccl.teamView.v1'))).toBe('the');
  await page.goto('/doi-chuan/');
  await expect(chuan.locator('.team-grid:not(.team-grid-dense) > .reference-team-card').first()).toBeVisible();
  const recommended=await anatomy('#section-team-chuan');
  expect(other).toEqual(recommended);
  expect(recommended.parts).toEqual(['reference-card-head','heroes','reference-card-foot']);
  expect(recommended.roles).toEqual(['CHỦ','PHÓ 1','PHÓ 2']);
});

test('list to detail and Back from the table view restores view, filters, exact identities and scroll',async({page,request})=>{
  await page.goto('/doi-chuan/');
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  // Một bộ lọc thật (Loại binh), rồi chuyển sang Bảng.
  const raw=(await section.locator('.fchip[data-focus-key^="unit:"]').first().getAttribute('data-focus-key')).slice('unit:'.length);
  await section.locator(`.fchip[data-focus-key="unit:${raw}"]`).click();
  await section.locator('.view-btn[data-view="bang"]').click();
  await expect(page).toHaveURL(/view=bang/);
  const rows=section.locator('.reference-table tbody tr');
  await expect(rows.first()).toBeVisible();
  const renderedKeys=()=>rows.evaluateAll(nodes=>nodes.map(node=>node.dataset.referenceKey).sort());
  const keys=await renderedKeys();
  expect(keys.length).toBeGreaterThan(1);
  const scrolled=await page.evaluate(()=>{
    document.documentElement.style.scrollBehavior='auto';
    window.scrollTo(0,900);
    return Math.round(window.scrollY);
  });
  expect(scrolled).toBeGreaterThan(0);

  // Bấm đúng link đang render của hàng đầu (không tự dựng URL) rồi chờ trang chi tiết tải xong.
  // Dùng click DOM thật để Playwright không tự cuộn phần tử vào khung nhìn — mốc cuộn đã ghi phải là
  // mốc của người dùng, không phải mốc do công cụ cuộn hộ.
  const first=rows.first();
  const key=await first.getAttribute('data-reference-key');
  await first.locator('.reference-table-name').evaluate(node=>node.click());
  await expect(page.locator('#team-detail-root')).toHaveAttribute('data-source-config-id',key);
  await expect(page.locator('#team-detail-root')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/view=bang/);
  await expect(page).toHaveURL(new RegExp(`unit=${encodeURIComponent(raw)}`));
  await expect(section.locator('.view-btn[data-view="bang"]')).toHaveAttribute('aria-pressed','true');
  await expect(section.locator(`.fchip[data-focus-key="unit:${raw}"]`)).toHaveAttribute('aria-pressed','true');
  // Danh tính khôi phục phải đúng từng bản ghi, không chỉ đúng số hàng.
  await expect.poll(renderedKeys).toEqual(keys);
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBe(scrolled);
});

test('same-document season history re-renders the same records on Back and Forward',async({page,request})=>{
  const {seasons,index}=await referenceData(request);
  const section=page.locator('#section-team-chuan');
  const season=section.getByLabel('Mùa nguồn',{exact:true});
  const recordKey=row=>row.sourceConfigId||row.legacyVariantId||row.legacyTeamId;
  const sorted=keys=>[...new Set(keys)].sort();
  const recordsFor=sourceSeasonId=>index.records.filter(row=>row.sourceSeasonId===sourceSeasonId);
  // Danh tính thẻ đang render là `data-reference-key` (sourceConfigId/legacyVariantId/legacyTeamId).
  const renderedKeys=()=>section.locator('.reference-team-card').evaluateAll(cards=>cards.map(card=>card.dataset.referenceKey).sort());
  const query=key=>page.evaluate(k=>new URL(location.href).searchParams.get(k),key);

  // Mùa đích phải thật sự đổi membership — không dùng bước tuỳ chọn.
  const defaultIds=sorted(recordsFor(seasons.defaultSourceSeasonId).map(recordKey));
  const target=(seasons.seasonOptions||[])
    .map(option=>({season:option.sourceSeasonId,ids:sorted(recordsFor(option.sourceSeasonId).map(recordKey))}))
    .find(item=>item.ids.length&&item.ids.join()!==defaultIds.join());
  expect(target,{message:'cần một mùa khác mùa mặc định có đội để kiểm lịch sử'}).toBeTruthy();

  await page.goto('/doi-chuan/');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  const baseline={ids:await renderedKeys(),season:await season.inputValue()};
  expect(baseline.ids.length).toBeGreaterThan(0);

  await season.selectOption(target.season);
  await expect.poll(()=>query('season')).toBe(target.season);
  await expect.poll(renderedKeys).toEqual(target.ids);
  expect(target.ids).not.toEqual(baseline.ids);

  // Back/Forward: URL, control, số thẻ và chính danh tính bản ghi phải quay lại đúng từng bước.
  await page.goBack();
  await expect(page).toHaveURL(/\/doi-chuan\/$/);
  await expect(season).toHaveValue(baseline.season);
  await expect(section.locator('.reference-team-card')).toHaveCount(baseline.ids.length);
  await expect.poll(renderedKeys).toEqual(baseline.ids);

  await page.goForward();
  await expect.poll(()=>query('season')).toBe(target.season);
  await expect(season).toHaveValue(target.season);
  await expect(section.locator('.reference-team-card')).toHaveCount(target.ids.length);
  await expect.poll(renderedKeys).toEqual(target.ids);
});

test('list to detail and Back restores the rendered list filters and scroll position',async({page,request})=>{
  const handles=await routeHandles(request);
  const id=Object.keys(handles.r)[0];
  await page.goto('/doi-chuan/');
  const section=page.locator('#section-team-chuan');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  const raw=(await section.locator('.fchip[data-focus-key^="faction:"]').first().getAttribute('data-focus-key')).slice('faction:'.length);
  const chip=section.locator(`.fchip[data-focus-key="faction:${raw}"]`);
  if (!(await chip.count())) await section.getByRole('button',{name:'Bộ lọc'}).click();
  await section.locator(`.fchip[data-focus-key="faction:${raw}"]`).click();
  await expect(page).toHaveURL(new RegExp(`faction=${encodeURIComponent(raw)}`));
  const filtered=await section.locator('.reference-team-card').count();
  // `html { scroll-behavior: smooth }`: ép cuộn tức thời để mốc ghi lại là vị trí cuối, không phải giữa animation.
  const scrolled=await page.evaluate(()=>{
    document.documentElement.style.scrollBehavior='auto';
    window.scrollTo(0,900);
    return Math.round(window.scrollY);
  });
  expect(scrolled).toBeGreaterThan(0);

  await page.goto(`/doi-chuan/${encodeURIComponent(handles.r[id])}/`);
  await expect(page.locator('#team-detail-root')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`faction=${encodeURIComponent(raw)}`));
  await expect(section.locator('.reference-team-card')).toHaveCount(filtered);
  await expect(section.locator(`.fchip[data-focus-key="faction:${raw}"]`)).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBe(scrolled);
});

test('ô vuông phe trong bộ lọc được vẽ thật (content của ::before) ở 1440 và 390 (P05-B1)', async ({page})=>{
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({width,height:900});
      await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
      await page.goto('/doi-chuan/');
      const row = page.locator('#section-team-chuan .reference-filters .fchip.f-quan').first();
      const square = await row.evaluate((node)=>{
        const style = getComputedStyle(node,'::before');
        const chip = node.getBoundingClientRect();
        const label = node.querySelector('.fchip-label').getBoundingClientRect();
        return {
          content: style.content,
          width: Math.round(Number.parseFloat(style.width)),
          height: Math.round(Number.parseFloat(style.height)),
          background: style.backgroundColor,
          display: style.display,
          squareLeftOfLabel: node.getBoundingClientRect().left <= label.left,
          chipWidth: Math.round(chip.width),
        };
      });
      expect(square.content, `${width}/${theme}: content`).toBe('""');
      expect(square.display, `${width}/${theme}: hiển thị`).not.toBe('none');
      expect(square.width, `${width}/${theme}: rộng ô vuông`).toBe(8);
      expect(square.height, `${width}/${theme}: cao ô vuông`).toBe(8);
      expect(square.background, `${width}/${theme}: màu phe`).not.toBe('rgba(0, 0, 0, 0)');
      expect(square.squareLeftOfLabel, `${width}/${theme}: ô vuông trước nhãn`).toBe(true);
    }
  }
});

test('N5-3: `view` chỉ có nghĩa khi bằng `luoi` hoặc `bang`; `?view=the` và giá trị lạ bị bỏ khỏi URL',async({page})=>{
  const section=page.locator('#section-team-chuan');
  const params=()=>page.evaluate(()=>Object.fromEntries(new URL(location.href).searchParams));
  // `the` là mặc định của `resolveTeamView` nên URL phải về dạng không tham số, và vẫn giữ nguyên các khóa khác.
  await page.goto('/doi-chuan/?view=the');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await expect.poll(params).toEqual({});
  await page.goto('/doi-chuan/?view=the&q=L%E1%BB%AF%20B%E1%BB%91');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await expect.poll(params).toEqual({q:'Lữ Bố'});
  // `luoi` và `bang` là hai giá trị có nghĩa: giữ đúng một tham số, bỏ bản lặp.
  await page.goto('/doi-chuan/?view=bang');
  await expect(section.locator('.reference-table tbody tr').first()).toBeVisible();
  await expect.poll(params).toEqual({view:'bang'});
  await page.goto('/doi-chuan/?view=bang&view=the');
  await expect(section.locator('.reference-table tbody tr').first()).toBeVisible();
  await expect.poll(params).toEqual({view:'bang'});
  await page.goto('/doi-chuan/?view=luoi&view=bang');
  await expect(section.locator('.team-grid-dense > .reference-team-card').first()).toBeVisible();
  await expect.poll(params).toEqual({view:'luoi'});
  // Giá trị lạ: vẫn báo cho người dùng ở lượt đọc đầu, đồng thời URL được chuẩn hoá.
  await page.goto('/doi-chuan/?view=khong-hop-le');
  await expect(section.locator('.reference-team-card').first()).toBeVisible();
  await expect(section.locator('.reference-notice')).toContainText('Kiểu hiển thị không hợp lệ');
  await expect.poll(params).toEqual({});
  // Chuẩn hoá bằng `replaceState`: mục lịch sử của lần nạp này bị viết lại nên Back rời trang, không quay
  // lại chính URL `?view=the`.
  await page.goto('/doi-chuan/');
  await page.goto('/doi-chuan/?view=the');
  await expect.poll(params).toEqual({});
  await page.goBack();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).pathname)).toBe('/doi-chuan/');
  await expect.poll(params).toEqual({});
});

test('N5-4: panel lọc mobile đóng bằng Escape và trả focus về nút "Bộ lọc"; desktop không đổi',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/doi-chuan/');
  const section=page.locator('#section-team-chuan');
  const toggle=section.locator('.filter-collapse-toggle');
  const chip=section.locator('.reference-filters .fchip').first();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(chip).toBeVisible();
  await chip.focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toBeFocused();
  await expect(chip).toBeHidden();
  // Bàn phím vẫn mở lại được, và lần mở sau Escape vẫn đóng.
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(chip).toBeVisible();
  await chip.focus();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toBeFocused();
  // Desktop: nút bị ẩn nên Escape không đóng sidebar và không cướp focus.
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/doi-chuan/');
  await expect(toggle).toBeHidden();
  const firstChip=section.locator('.reference-filters .fchip').first();
  await expect(firstChip).toBeVisible();
  await firstChip.focus();
  await page.keyboard.press('Escape');
  await expect(firstChip).toBeVisible();
  await expect(firstChip).toBeFocused();
});
