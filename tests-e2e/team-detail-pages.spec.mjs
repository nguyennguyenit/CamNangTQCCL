import {test,expect} from '@playwright/test';

const publication=async request=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const load=async name=>(await request.get(`/data/recommended/${pin.generationId}/${name}`)).json();
  const [index,other,seasons]=await Promise.all([load('index.json'),load('other-teams.json'),load('seasons.json')]);
  return {pin,index,other,seasons};
};
const rawTeams=async request=>(await request.get('/data/teams.json')).json();
const recommendedPath=id=>`/teams/recommended/${encodeURIComponent(id)}/`;
const legacyPath=id=>`/teams/legacy/${encodeURIComponent(id)}/`;

test('Recommended detail loads directly, survives reload and shows verified source content',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records.find(item=>item.value!=null && item.heroes?.length===3);
  await page.goto(recommendedPath(row.sourceConfigId));

  const detail=page.locator('#team-detail-root');
  await expect(page.locator('h1#team-detail-title')).toHaveText(row.displayNameVi || row.nameZh);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(detail).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-detail-status')).toBeHidden();
  await expect(page.locator('.detail-score')).toHaveText(`${row.value} điểm`);
  await expect(detail.locator('.reference-detail-holder')).toHaveCount(3);
  await expect(detail.locator('.main-holder')).toHaveCount(1);
  await expect(detail.locator('.reference-detail-holder').first().locator('.main-holder')).toHaveText('C');
  await expect(detail).not.toContainText(/主將|副將\s*[12]?/);
  for (const holder of row.heroes) {
    for (const [slot,raw] of (holder.tacticSlotsRaw || []).entries()) {
      if (raw && holder.tacticSlotKinds?.[slot]!=='bond') await expect(detail).toContainText(holder.tacticSlotsVi?.[slot] || raw);
    }
  }
  await expect(detail.locator('.detail-source')).toContainText(row.sourceConfigId);
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',/^\/(\?|#)/);
  // The dedicated page must not boot the root application or its gameplay datasets.
  await expect(page.locator('#section-team-chuan')).toHaveCount(0);
  await expect(page.locator('#season-controls')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('h1#team-detail-title')).toHaveText(row.displayNameVi || row.nameZh);
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('Recommended detail renders note ownership once per source occurrence',async({page,request})=>{
  const {pin,index}=await publication(request);
  const row=index.records.find(item=>(item.displayNotes?.blocks || []).length>1);
  const details=await (await request.get(`/data/recommended/${pin.generationId}/details-${row.safeScopeKey}.json`)).json();
  const record=details.records.find(item=>item.sourceConfigId===row.sourceConfigId);
  const blocks=record.displayNotes.blocks;

  await page.goto(recommendedPath(row.sourceConfigId));
  const paragraphs=page.locator('#team-detail-body .detail-note');
  await expect(paragraphs).toHaveCount(blocks.length);
  // Mỗi occurrence hiển thị đúng một lần, kể cả khi hai occurrence có cùng nội dung.
  const rendered=(await paragraphs.allTextContents()).map(value=>value.trim()).sort();
  expect(rendered).toEqual(blocks.map(block=>block.textVi.trim()).sort());
  const ownership=await page.evaluate(async()=>{
    const {recommendedTeamDetailContent}=await import('/js/recommended-reference-render.js');
    const holder=name=>({displayNameVi:name,tacticSlotsRaw:[],tacticSlotsVi:[],bookSlotsRaw:[],bookSlotsVi:[],statFocusRaw:'',roleRaw:''});
    const fragment=recommendedTeamDetailContent({
      sourceConfigId:'ownership-probe',sourceUrl:'https://sgsdeck.com/recommended/ownership-probe',
      heroes:[holder('A'),holder('B'),holder('C')],
      alternativeHoldersRaw:[holder('D')],
      displayNotes:{schemaVersion:1,blocks:[
        {id:'p-team',owner:'team',holderIndex:null,textRaw:'Nguồn 1',textVi:'Ghi chú đã duyệt'},
        {id:'p-a',owner:'primary',holderIndex:0,textRaw:'Nguồn 2',textVi:'Ghi chú đã duyệt'},
        {id:'p-b',owner:'primary',holderIndex:1,textRaw:'Nguồn 3',textVi:'Ghi chú đã duyệt'},
        {id:'p-c',owner:'primary',holderIndex:2,textRaw:'Nguồn 4',textVi:'Ghi chú đã duyệt'},
        {id:'p-d',owner:'alternative',holderIndex:0,textRaw:'Nguồn 5',textVi:'Ghi chú đã duyệt'},
      ]},
      legacyReferences:[],
    });
    const host=document.createElement('div');
    host.append(fragment);
    const sectionFor=label=>[...host.querySelectorAll('.detail-section')].find(section=>section.querySelector(':scope > h2')?.textContent===label);
    return {
      all:host.querySelectorAll('.detail-note').length,
      team:sectionFor('Mô tả & điều kiện').querySelectorAll('.detail-note').length,
      primary:[...sectionFor('Cấu hình chính').querySelectorAll('.reference-detail-holder')].map(node=>node.querySelectorAll('.detail-note').length),
      alternative:[...sectionFor('Cấu hình thay thế').querySelectorAll('.reference-detail-holder')].map(node=>node.querySelectorAll('.detail-note').length),
      texts:[...host.querySelectorAll('.detail-note')].map(node=>node.textContent),
    };
  });
  expect(ownership).toEqual({
    all:5,
    team:1,
    primary:[1,1,1],
    alternative:[1],
    texts:Array(5).fill('Ghi chú đã duyệt'),
  });
});

test('Recommended detail distinguishes absent slots from untranslated populated slots',async({page})=>{
  await page.goto('/teams/recommended/team-epoddo/');
  const slots=await page.evaluate(async()=>{
    const {recommendedTeamDetailContent}=await import('/js/recommended-reference-render.js');
    const holder=(name,tacticRaw,tacticVi,bookRaw,bookVi,statRaw,statVi)=>({
      displayNameVi:name,
      tacticSlotsRaw:tacticRaw,
      tacticSlotsVi:tacticVi,
      bookSlotsRaw:bookRaw,
      bookSlotsVi:bookVi,
      statFocusRaw:statRaw,
      statFocusVi:statVi,
      roleRaw:'',
    });
    const fragment=recommendedTeamDetailContent({
      sourceConfigId:'slot-state-probe',
      sourceUrl:'https://sgsdeck.com/recommended/slot-state-probe',
      heroes:[
        holder('A',[''],[null],['','',''],[null,null,null],'',null),
        holder('B',['突陣'],[null],['破陣'],[null],'全武',null),
        holder('C',['Đột Trận'],['Đột Trận'],['Phá Trận'],['Phá Trận'],'Toàn Võ Lực','Toàn Võ Lực'),
      ],
      alternativeHoldersRaw:[],
      displayNotes:{schemaVersion:1,blocks:[]},
      legacyReferences:[],
    });
    const host=document.createElement('div');
    host.append(fragment);
    return [...host.querySelectorAll('.reference-detail-holder')].map(node=>({
      tactics:node.querySelector('.holder-tactics dd')?.textContent,
      books:node.querySelector('.holder-books dd')?.textContent,
      stat:node.querySelector('.holder-stat dd')?.textContent,
    }));
  });
  expect(slots).toEqual([
    {tactics:'Chưa có dữ liệu',books:'Chưa có dữ liệu',stat:'Chưa có dữ liệu'},
    {tactics:'Nội dung tiếng Việt chưa sẵn sàng',books:'Nội dung tiếng Việt chưa sẵn sàng',stat:'Nội dung tiếng Việt chưa sẵn sàng'},
    {tactics:'Đột Trận',books:'Phá Trận',stat:'Toàn Võ Lực'},
  ]);
});

test('legacy original keeps notes, counters, hero notes and every alternative',async({page,request})=>{
  const teams=await rawTeams(request);
  const team=teams.find(item=>item.notes && (item.counters?.good?.length || item.counters?.avoid?.length))
    || teams.find(item=>item.notes);
  await page.goto(legacyPath(team.id));

  await expect(page.locator('h1#team-detail-title')).toHaveText(team.nickname || team.name);
  await expect(page.locator('.detail-score')).toHaveText('Chưa có điểm nguồn');
  const body=page.locator('#team-detail-body');
  const holders=body.locator('.reference-detail-holder');
  await expect(holders).toHaveCount(team.heroes.length);
  await expect(holders.locator('.main-holder')).toHaveCount(1);
  await expect(holders.first().locator('.main-holder')).toHaveText('C');
  await expect(holders.nth(1).locator('.main-holder')).toHaveCount(0);
  await expect(body).toContainText(team.notes);
  for (const name of team.counters?.good || []) await expect(body.locator('.chip.good')).toContainText([name].map(String));
  for (const hero of team.heroes) {
    await expect(body).toContainText(hero.name);
    if (hero.note) await expect(body).toContainText(hero.note);
    for (const alternative of hero.alternatives || []) await expect(body).toContainText(alternative);
    for (const tactic of hero.tactics || []) {
      await expect(body).toContainText(tactic.name);
      for (const alternative of tactic.alternatives || []) await expect(body).toContainText(alternative);
    }
    for (const book of hero.books || []) {
      await expect(body).toContainText(book.name);
      for (const alternative of book.alternatives || []) await expect(body).toContainText(alternative);
    }
  }
  // Detail chips are static text, never filter controls.
  await expect(body.locator('button.chip')).toHaveCount(0);
});

test('hostile source text is rendered as text and never executed',async({page,request})=>{
  const teams=await rawTeams(request);
  await page.goto(legacyPath(teams[0].id));
  const hostile='<img src=x onerror="document.title=\'pwned\'">"><script>document.title="pwned"</script>';
  const rendered=await page.evaluate(async text=>{
    const module=await import('/js/recommended-reference-render.js');
    const fragment=module.legacyOriginalDetailContent({
      id:'probe',name:text,nickname:null,source:'team-intro',notes:text,
      heroes:[{name:text,baseName:text,alternatives:[text],variant:null,isSP:false,isCO:false,tactics:[{name:text,alternatives:[text]}],books:[{name:text,alternatives:[]}],note:text}],
      counters:{good:[text],avoid:[text]},
    },{});
    const host=document.createElement('div');
    host.append(fragment);
    document.body.append(host);
    return {text:host.textContent,injected:host.querySelectorAll('img,script').length,title:document.title};
  },hostile);
  expect(rendered.injected).toBe(0);
  expect(rendered.text).toContain(hostile);
  expect(rendered.title).not.toBe('pwned');
  await expect(page).toHaveTitle(/^(?!pwned).*/);
});
test('duplicate legacy content renders once while every reviewed locator remains visible',async({page,request})=>{
  const teams=await rawTeams(request);
  await page.goto(legacyPath(teams[0].id));
  const result=await page.evaluate(async()=>{
    const {recommendedTeamDetailContent}=await import('/js/recommended-reference-render.js');
    const content={
      id:'legacy-probe',name:'Đội probe',nickname:null,source:'team-intro',notes:'Nội dung duy nhất',
      heroes:[],counters:{good:[],avoid:[]},
    };
    const fingerprint='sha256:'+'a'.repeat(64);
    const fragment=recommendedTeamDetailContent({
      sourceConfigId:'recommended-probe',sourceUrl:'https://sgsdeck.com/recommended/recommended-probe',
      heroes:[],alternativeHoldersRaw:[],displayNotes:{schemaVersion:1,blocks:[]},
      legacyReferences:[
        {legacyTeamId:'legacy-probe',legacyVariantId:'variant-a',legacyContentSha256:fingerprint,evidenceRef:'review-a',legacyContent:content},
        {legacyTeamId:'legacy-probe',legacyVariantId:'variant-b',legacyContentSha256:fingerprint,evidenceRef:'review-b',legacyContent:content},
      ],
    });
    const host=document.createElement('div');
    host.append(fragment);
    return {
      bodies:host.querySelectorAll('.legacy-reference').length,
      provenance:host.querySelectorAll('.legacy-provenance').length,
      text:host.textContent,
    };
  });
  expect(result.bodies).toBe(1);
  expect(result.provenance).toBe(2);
  expect(result.text).toContain('variant-a');
  expect(result.text).toContain('review-a');
  expect(result.text).toContain('variant-b');
  expect(result.text).toContain('review-b');
});


test('only the exact admitted pair resolves a variant and a bad one links back to the original',async({page,request})=>{
  const {other}=await publication(request);
  const admitted=other.records[0];
  await page.goto(`${legacyPath(admitted.legacyTeamId)}?variant=${encodeURIComponent(admitted.legacyVariantId)}`);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-detail-root')).toContainText(admitted.legacyVariantId);

  await page.goto(`${legacyPath(admitted.legacyTeamId)}?variant=v-${'0'.repeat(64)}`);
  const alert=page.locator('#team-detail-status [role="alert"]');
  await expect(alert).toBeVisible();
  await expect(page.locator('h1#team-detail-title')).not.toBeEmpty();
  const original=page.locator('#team-detail-root a[href="'+legacyPath(admitted.legacyTeamId)+'"]');
  await expect(original).toBeVisible();
  // A rejected variant must never be answered with the original team content.
  await expect(page.locator('#team-detail-body')).toBeHidden();
  for (const suffix of ['?variant=','?variant=%2Fbad']) {
    await page.goto(`${legacyPath(admitted.legacyTeamId)}${suffix}`);
    await expect(page.locator('#team-detail-status [role="alert"]')).toBeVisible();
    await expect(page.locator('#team-detail-body')).toBeHidden();
    await expect(page.locator('#team-detail-root a[href="'+legacyPath(admitted.legacyTeamId)+'"]')).toBeVisible();
  }
  await original.click();
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('original pages stay readable while Recommended artifacts are unavailable',async({page,request})=>{
  const teams=await rawTeams(request);
  const {other}=await publication(request);
  const pending=teams.find(team=>!other.records.some(row=>row.legacyTeamId===team.id));
  await page.route('**/data/recommended/**',route=>route.abort());

  await page.goto(legacyPath(pending.id));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('h1#team-detail-title')).toHaveText(pending.nickname || pending.name);

  // Duplicate/pending originals are reachable directly but are not admitted into Team khác.
  await page.unroute('**/data/recommended/**');
  await page.goto('/#team-khac');
  await expect(page.locator(`#section-team-khac .reference-team-card[data-legacy-team-id="${pending.id}"]`)).toHaveCount(0);
});

test('Recommended detail fails closed when its payload cannot be verified',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  let currentRequests=0;
  await page.route('**/data/recommended/current.json',route=>{currentRequests+=1;return route.abort();});
  await page.route('**/data/recommended/*/details-*.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaVersion:1,records:[]})}));
  await page.goto(recommendedPath(row.sourceConfigId));
  await expect(page.locator('#team-detail-status [role="alert"]')).toBeVisible();
  await expect(page.locator('#team-detail-body')).toBeHidden();
  await expect(page.locator('#team-detail-retry')).toBeVisible();
  await expect(page.locator('#team-return-link')).toBeVisible();
  // A failed verification must not fall back to another generation or the current selector.
  expect(currentRequests).toBe(0);
});

test('card title and CTA are the same native link and modified clicks stay native',async({page,context,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}#team-chuan`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  const title=card.locator('.team-name a');
  const cta=card.getByRole('link',{name:'Xem chi tiết'});
  const href=await title.getAttribute('href');
  expect(href).toBe(await cta.getAttribute('href'));
  expect(href.startsWith(recommendedPath(row.sourceConfigId))).toBe(true);
  await expect(card).not.toHaveAttribute('tabindex','0');

  const before=await page.evaluate(()=>history.length);
  const popup=context.waitForEvent('page');
  await title.click({modifiers:['ControlOrMeta']});
  const opened=await popup;
  await opened.waitForURL('**/teams/recommended/**');
  expect(new URL(opened.url()).pathname).toBe(recommendedPath(row.sourceConfigId));
  await opened.close();
  expect(page.url()).toContain('#team-chuan');
  expect(await page.evaluate(()=>history.length)).toBe(before);
});

test('list to detail and back keeps query, tab and scroll position',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}#team-chuan`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));
  const scrolled=await page.evaluate(()=>Math.round(window.scrollY));
  expect(scrolled).toBeGreaterThan(0);
  await card.locator('.team-name a').evaluate(link=>link.click());
  await expect(page).toHaveURL(new RegExp(`teams/recommended/`));
  await expect(page.locator('#team-detail-body')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`season=${encodeURIComponent(row.sourceSeasonId)}`));
  await expect(page).toHaveURL(/#team-chuan$/);
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBeGreaterThan(scrolled/2);
  await page.goForward();
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('the return link restores the exact root state on a fresh load',async({page,request})=>{
  await page.setViewportSize({width:375,height:812});
  const {index}=await publication(request);
  const row=index.records.find(item=>item.sourceSeasonId==='pk-s24' && item.alternativeHoldersRaw?.length);
  expect(row).toBeTruthy();
  const query=row.displayNameVi || row.nameZh;
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}&q=${encodeURIComponent(query)}#team-chuan`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  const disclosure=page.locator('#section-team-chuan .filter-collapse-toggle');
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded','true');
  const scoreToggle=page.locator('#section-team-chuan .score-toggle');
  await scoreToggle.click();
  await expect(page.locator('#section-team-chuan .score-toggle')).toHaveAttribute('aria-expanded','true');
  const alternatives=card.locator(':scope > details.reference-alternatives');
  await alternatives.locator('summary').click();
  await expect(alternatives).toHaveAttribute('open','');
  await card.getByRole('link',{name:'Xem chi tiết'}).click();
  const back=page.locator('#team-return-link');
  await expect(back).toHaveAttribute('href',/q=/);
  await page.reload();
  await back.click();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(query);
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn')).toHaveValue(query);
  await expect(page.locator('#section-team-chuan .filter-collapse-toggle')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#section-team-chuan-filters')).not.toHaveClass(/collapsed/);
  await expect(page.locator('#section-team-chuan .score-toggle')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"] > details.reference-alternatives`)).toHaveAttribute('open','');
});

test('combined score, unit, faction and Vietnamese search survive detail reload and history',async({page,request})=>{
  const {index,seasons}=await publication(request);
  const seasonId='pk-s24';
  const seasonRows=index.records.filter(row=>row.sourceSeasonId===seasonId);
  const scores=[...new Set(seasonRows.map(row=>row.value).filter(value=>value!=null))]
    .sort((a,b)=>Number(b)-Number(a));
  const score=String(scores[10]);
  const row=seasonRows.find(item=>String(item.value)===score && item.factionRaw && item.unitTypesRaw?.length && item.displayNameVi);
  expect(row).toBeTruthy();
  const unit=row.unitTypesRaw[0];
  const faction=row.factionRaw;
  const unitLabel=seasons.displayLabels?.unit?.[unit] || unit;
  const factionLabel=seasons.displayLabels?.faction?.[faction] || faction;

  await page.setViewportSize({width:375,height:812});
  await page.goto(`/?season=${seasonId}#team-chuan`);
  const historyBefore=await page.evaluate(()=>history.length);
  await page.locator('#section-team-chuan .filter-collapse-toggle').click();
  await page.locator('#section-team-chuan .score-toggle').click();
  await page.locator(`#section-team-chuan .score-group .fchip[data-focus-key="score:${score}"]`).click();
  await page.locator(`#section-team-chuan .unit-group .fchip[data-focus-key="unit:${unit}"]`).click();
  await page.locator(`#section-team-chuan .faction-group .fchip[data-focus-key="faction:${faction}"]`).click();
  await page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn').fill(row.displayNameVi);
  await expect.poll(()=>page.evaluate(()=>history.length)).toBe(historyBefore);

  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  const rootScroll=await page.evaluate(()=>Math.round(scrollY));
  expect(rootScroll).toBeGreaterThan(0);
  await card.locator('.team-name a').click();
  await expect(page.locator('#team-detail-root')).toHaveAttribute('data-source-config-id',row.sourceConfigId);
  await expect(page.locator('.detail-source')).toContainText(row.sourceConfigId);
  await page.reload();
  await expect(page.locator('#team-detail-body')).toBeVisible();

  await page.locator('#team-return-link').click();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.getAll('score'))).toEqual([score]);
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.getAll('unit'))).toEqual([unit]);
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.getAll('faction'))).toEqual([faction]);
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn')).toHaveValue(row.displayNameVi);
  await expect(page.locator(`#section-team-chuan .score-group .fchip[data-focus-key="score:${score}"]`)).toHaveAttribute('aria-pressed','true');
  await expect(page.locator(`#section-team-chuan .unit-group .fchip[data-focus-key="unit:${unit}"]`)).toContainText(unitLabel);
  await expect(page.locator(`#section-team-chuan .faction-group .fchip[data-focus-key="faction:${faction}"]`)).toContainText(factionLabel);
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY))).toBeGreaterThan(rootScroll/2);
  await page.goBack();
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goForward();
  await expect(card).toBeVisible();
});

test('a shared link without origin still offers the matching family scope',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  await page.goto(recommendedPath(row.sourceConfigId));
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',/#team-chuan$/);
  const teams=await rawTeams(request);
  await page.goto(legacyPath(teams[0].id));
  await expect(page.locator('#team-return-link')).toHaveAttribute('href','/#team-khac');
});

test('old reference links replace into dedicated routes while config keeps gameplay precedence',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}&detail=${encodeURIComponent(row.sourceConfigId)}#team-chuan`);
  await expect(page).toHaveURL(new RegExp(`teams/recommended/`));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',new RegExp(`season=${encodeURIComponent(row.sourceSeasonId)}`));

  await page.goto('/?legacyTeam=team-intro-14#team-khac');
  await expect(page).toHaveURL(/teams\/legacy\/team-intro-14\//);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goto('/?legacyTeam=team-intro-14&legacyVariant=%2Fbad#team-khac');
  await expect(page).toHaveURL(/variant=%2Fbad/);
  await expect(page.locator('#team-detail-status [role="alert"]')).toBeVisible();
  await expect(page.locator('#team-detail-body')).toBeHidden();

  await page.goto('/?config=missing&legacyTeam=team-intro-14#analyze');
  await expect(page).not.toHaveURL(/teams\/legacy/);
  await expect(page.locator('#season-detail-mount')).toContainText('Không có cấu hình này');
  await page.goto(`/?config=missing&detail=${encodeURIComponent(row.sourceConfigId)}#analyze`);
  await expect(page).not.toHaveURL(/teams\/recommended/);
});

test('unknown routes serve the static 404 instead of the root shell',async({page,request})=>{
  await page.setViewportSize({width:375,height:812});
  const missing=await request.get('/teams/recommended/khong-ton-tai/');
  expect(missing.status()).toBe(404);
  await page.goto('/teams/recommended/khong-ton-tai/');
  await expect(page.locator('#not-found-title')).toBeVisible();
  await expect(page.locator('#section-team-chuan')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Về trang chủ'})).toHaveAttribute('href','/');
  const themeBefore=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.locator('#theme-toggle').click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(themeBefore);
  await page.locator('#section-menu-toggle').click();
  await expect(page.locator('.section-nav')).toHaveClass(/open/);

  const teams=await rawTeams(request);
  const nested=await request.get(`/teams/legacy/${teams[0].id}/data/teams.json`);
  expect(nested.status()).toBe(404);
  expect(await nested.text()).not.toContain('"id"');
  const notFoundArtifact=await request.get('/404.html');
  expect(await notFoundArtifact.text()).toContain('Không tìm thấy trang');
});

test('theme toggle works on detail pages even when localStorage is denied',async({page,request})=>{
  const teams=await rawTeams(request);
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('denied');}});
  });
  await page.goto(legacyPath(teams[0].id));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  const before=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.locator('#theme-toggle').click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(before);
});

test('detail pages keep working when sessionStorage writes are denied',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  const query=row.heroes[0].displayNameVi || row.heroes[0].nameRaw;
  await page.addInitScript(()=>{
    const denied=()=>{throw new Error('denied');};
    Object.defineProperty(window,'sessionStorage',{configurable:true,get(){return {getItem:denied,setItem:denied,removeItem:denied};}});
  });
  await page.goto(`/?season=${encodeURIComponent(row.sourceSeasonId)}&q=${encodeURIComponent(query)}#team-chuan`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await card.locator('.team-name a').click();
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',/q=/);
  await page.goBack();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(query);
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn')).toHaveValue(query);
});

test('multi-page history does not loop or restore a foreign entry',async({page,request})=>{
  const {index}=await publication(request);
  const [first,second]=index.records;
  await page.goto('/#team-chuan');
  const start=await page.evaluate(()=>history.length);
  await page.goto(recommendedPath(first.sourceConfigId));
  await page.goto(recommendedPath(second.sourceConfigId));
  expect(await page.evaluate(()=>history.length)).toBe(start+2);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(first.sourceConfigId).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#team-chuan$/);
  expect(await page.evaluate(()=>history.length)).toBe(start+2);
});
