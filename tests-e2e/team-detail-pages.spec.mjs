import {test,expect} from '@playwright/test';

const publication=async request=>{
  const pin=await (await request.get('/data/recommended/current.json')).json();
  const load=async name=>(await request.get(`/data/recommended/${pin.generationId}/${name}`)).json();
  const [index,other,seasons]=await Promise.all([load('index.json'),load('other-teams.json'),load('seasons.json')]);
  return {pin,index,other,seasons};
};
const rawTeams=async request=>(await request.get('/data/teams.json')).json();
/** Final route segments come from the same inventory the build used, never from a re-derived slug. */
const routeHandles=async request=>{
  const html=await (await request.get('/doi-chuan/')).text();
  const match=html.match(/id="team-route-handles"[^>]*>([^<]+)<\/script>/);
  if (!match) throw new Error('Built Team chuẩn page lacks the team route handle map');
  return JSON.parse(match[1]);
};
const recommendedPath=(handles,id)=>`/doi-chuan/${encodeURIComponent(handles.r[id])}/`;
const legacyPath=(handles,id)=>`/doi-khac/${encodeURIComponent(handles.l[id])}/`;

test('Recommended detail loads directly, survives reload and shows verified source content',async({page,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records.find(item=>item.value!=null && item.heroes?.length===3);
  await page.goto(recommendedPath(handles,row.sourceConfigId));

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
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',/^\/(?:doi-chuan\/|doi-khac\/|khai-hoang\/)/);
  // Trang chi tiết không nạp ứng dụng mục hay dữ liệu gameplay.
  await expect(page.locator('script[type="module"][src="/js/app.js"]')).toHaveCount(0);
  await expect(page.locator('#season-controls')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('h1#team-detail-title')).toHaveText(row.displayNameVi || row.nameZh);
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('Recommended detail uses the TeamDetail shell: scope line, Tier seal, badges and score panel',async({page,request})=>{
  const {index,seasons}=await publication(request);
  const handles=await routeHandles(request);
  // Bản ghi đủ dữ liệu đầu trang: mùa/danh mục, tier, phe, loại binh, tên Trung và điểm.
  const row=index.records.find(item=>item.tierRaw && item.tierRaw!=='FUNC' && item.factionRaw && item.unitTypesRaw?.length && item.nameZh && item.value!=null);
  expect(row).toBeTruthy();
  await page.goto(recommendedPath(handles,row.sourceConfigId));
  const detail=page.locator('#team-detail-root');
  await expect(detail).toHaveAttribute('aria-busy','false');

  // Nhãn mùa · danh mục nằm trên tiêu đề trong `.detail-header`, không lặp ở thẻ danh sách.
  const kicker=page.locator('#team-detail-root .detail-header .scope-note.detail-kicker');
  await expect(kicker).toHaveCount(1);
  for (const part of [row.sourceSeasonCode,row.sourceSeasonNameVi,row.sourceCategoryNameVi].filter(Boolean)) {
    await expect(kicker).toContainText(part);
  }
  // Bản Việt chỉ một ngôn ngữ: tên Trung của nguồn không hiện kèm tiêu đề.
  await expect(page.locator('#team-detail-root .detail-header')).not.toContainText(row.nameZh);
  await expect(page.locator('#team-detail-root .detail-tier-value')).toHaveText(row.tierRaw);

  const badges=page.locator('#team-detail-root .detail-badges');
  await expect(badges.locator('.badge.faction')).toHaveText(seasons.displayLabels?.faction?.[row.factionRaw] || row.factionRaw);
  await expect(badges.locator('.badge.unit')).toHaveText(row.unitTypesRaw.map(unit=>seasons.displayLabels?.unit?.[unit] || unit));

  // Panel điểm: nhãn caps, số serif son + đơn vị; trang đội chuẩn không dẫn link nguồn ngoài.
  const panel=page.locator('#team-detail-root .detail-score-panel');
  await expect(panel.locator('.detail-panel-kicker')).toHaveText('Điểm nguồn');
  // Nguồn ghi chung, không nêu tên site nguồn trong panel điểm.
  await expect(panel.locator('.detail-panel-note')).not.toContainText('SGSDeck');
  await expect(panel.locator('.detail-score-value')).toHaveText(String(row.value));
  await expect(panel.locator('.detail-score-unit')).toHaveText('điểm');
  await expect(page.locator('#team-detail-root .detail-source-link')).toHaveCount(0);
  await expect(page.locator(`#team-detail-root a[href="${row.sourceUrl}"]`)).toHaveCount(0);
  // Chỉ một URL chi tiết cho mỗi đội: canonical là pathname, không kèm query/hash.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(`${recommendedPath(handles,row.sourceConfigId)}$`));
});

test('recommended hero cards keep role, tactic ordinals and books, linked to Tra cứu, without Chinese text',async({page,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records.find(item=>item.heroes?.length===3
    && item.heroes.every(holder=>(holder.tacticSlotsVi || []).some(Boolean))
    && item.heroes.every(holder=>(holder.bookSlotsVi || []).some(Boolean))
    && item.heroes.every(holder=>holder.nameRaw && /[\u3400-\u9fff]/u.test(holder.nameRaw)));
  expect(row).toBeTruthy();
  await page.goto(recommendedPath(handles,row.sourceConfigId));
  const cards=page.locator('#team-detail-body .detail-hero-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('.detail-hero-role')).toHaveText(['Chủ tướng','Phó tướng 1','Phó tướng 2']);
  for (const [position,holder] of row.heroes.entries()) {
    const card=cards.nth(position);
    await expect(card.locator('.detail-hero-name .hn')).toHaveText((holder.displayNameVi || holder.nameRaw).replace(/^(?:SP|CO|40Y)\s+/,''));
    const tactics=(holder.tacticSlotsVi || []).map((vi,slot)=>holder.tacticSlotKinds?.[slot]==='bond' ? null : (vi || holder.tacticSlotsRaw?.[slot])).filter(Boolean);
    await expect(card.locator('.detail-hero-tactics-vi')).toHaveText(tactics);
    // Ô chiến pháp / binh thư có hồ sơ Tra cứu là link `/tra-cuu/?id=…`; bản vi không kèm chữ Hán.
    await expect(card.locator('a.detail-hero-tactics-item').first()).toHaveAttribute('href',/^\/tra-cuu\/\?id=tactic%3A[a-z0-9-]+$/);
    await expect(card.locator('a.detail-hero-books-item').first()).toHaveAttribute('href',/^\/tra-cuu\/\?id=book%3A[a-z0-9-]+$/);
    expect(await card.innerText()).not.toMatch(/[\u3400-\u9fff]/u);
    const books=(holder.bookSlotsVi || []).map((vi,slot)=>vi || holder.bookSlotsRaw?.[slot]).filter(Boolean);
    await expect(card.locator('.detail-hero-books-vi')).toHaveText(books);
    await expect(card.locator('.detail-hero-label')).toHaveText(['Chiến pháp','Binh thư']);
  }
});

test('Đội khác detail drops the score panel content and Chinese name instead of faking them',async({page,request})=>{
  const teams=await rawTeams(request);
  const handles=await routeHandles(request);
  const team=teams.find(item=>item.nickname && item.faction && item.unitType?.length) || teams[0];
  await page.goto(legacyPath(handles,team.id));
  const detail=page.locator('#team-detail-root');
  await expect(detail).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#team-detail-body')).toBeVisible();
  // Đội khác không có điểm nguồn và tên Trung: hai phần đó không được render dưới dạng ô trống.
  await expect(detail.locator('.detail-score')).toHaveCount(0);
  await expect(detail.locator('.detail-title-zh')).toHaveCount(0);
  await expect(detail.locator('.detail-kicker')).toHaveCount(0);
  await expect(detail.locator('.detail-hero-role')).toHaveCount(0);
  // Panel không có điểm/nguồn: nút sao chép liên kết đứng trơn, không bọc trong khung có viền.
  const panel=detail.locator('#team-detail-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('#team-copy-link')).toBeVisible();
  expect(await panel.evaluate(node=>getComputedStyle(node).borderTopStyle)).toBe('none');
  if (team.faction) await expect(detail.locator('.detail-badges .badge.faction')).toHaveText(team.faction);
  for (const unit of team.unitType || []) await expect(detail.locator('.detail-badges .badge.unit')).toContainText(unit);
  await expect(detail.locator('.detail-source-link')).toHaveCount(0);
});

test('copy link reports the real clipboard result and offers a selected fallback',async({context,page,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records.find(item=>item.value!=null);
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const query=`?from=${encodeURIComponent('/doi-chuan/?season=' + row.sourceSeasonId)}`;
  await page.goto(`${recommendedPath(handles,row.sourceConfigId)}${query}`);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  const button=page.locator('#team-copy-link');
  await expect(button).toHaveAttribute('aria-label','Sao chép liên kết đội');
  await button.click();
  await expect(page.locator('#team-copy-status')).toHaveText('Đã sao chép liên kết');
  await expect(page.locator('#team-copy-fallback')).toBeHidden();
  // URL chia sẻ là trang chi tiết, không mang `from` (trạng thái danh sách riêng của người gửi).
  const shared=new URL(page.url());
  shared.searchParams.delete('from');
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(shared.href);
  expect(shared.search).toBe('');

  // Clipboard lỗi: không được báo thành công, phải chọn sẵn URL trong ô chỉ đọc.
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,get(){return {writeText:()=>Promise.reject(new Error('denied'))};}});
  });
  await page.reload();
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.locator('#team-copy-link').click();
  const fallback=page.locator('#team-copy-fallback');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveValue(shared.href);
  await expect(page.locator('#team-copy-status')).toHaveText('Không sao chép tự động được. Liên kết đã được chọn sẵn để bạn tự sao chép.');
  const selection=await page.evaluate(()=>{
    const input=document.querySelector('#team-copy-fallback');
    return {focused:document.activeElement === input,selected:input.value.slice(input.selectionStart,input.selectionEnd)};
  });
  expect(selection.focused).toBe(true);
  expect(selection.selected).toBe(shared.href);
});

test('Recommended detail renders note ownership once per source occurrence',async({page,request})=>{
  const {pin,index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records.find(item=>(item.displayNotes?.blocks || []).length>1);
  const details=await (await request.get(`/data/recommended/${pin.generationId}/details-${row.safeScopeKey}.json`)).json();
  const record=details.records.find(item=>item.sourceConfigId===row.sourceConfigId);
  const blocks=record.displayNotes.blocks;

  await page.goto(recommendedPath(handles,row.sourceConfigId));
  const paragraphs=page.locator('#team-detail-body .detail-note');
  await expect(paragraphs).toHaveCount(blocks.length);
  // Mỗi occurrence hiển thị đúng một lần, kể cả khi hai occurrence có cùng nội dung; nhãn tướng không tính vào văn bản.
  const rendered=(await paragraphs.evaluateAll(nodes=>nodes.map(node=>(node.querySelector('.detail-note-text') || node).textContent.trim()))).sort();
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
    const notesOf=root=>[...root.querySelectorAll('.detail-note')].map(node=>({
      owner:node.querySelector('.detail-note-owner')?.textContent ?? null,
      text:(node.querySelector('.detail-note-text') || node).textContent,
    }));
    const main=[...host.querySelectorAll(':scope > .detail-notes')];
    return {
      all:host.querySelectorAll('.detail-note').length,
      insideCards:host.querySelectorAll('.detail-hero-card .detail-note').length,
      main:main.flatMap(notesOf),
      alternative:notesOf(host.querySelector('.reference-alternative-group')),
    };
  });
  // Ghi chú tướng gom xuống khối "Ghi chú" (nhãn tên tướng), không nằm trong thẻ tướng.
  expect(ownership).toEqual({
    all:5,
    insideCards:0,
    main:[null,'A','B','C'].map(owner=>({owner,text:'Ghi chú đã duyệt'})),
    alternative:[{owner:'D',text:'Ghi chú đã duyệt'}],
  });
});

test('Recommended detail distinguishes absent slots from untranslated populated slots',async({page,request})=>{
  await page.goto(recommendedPath(await routeHandles(request),'team-epoddo'));
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
    const slotText=(card,block)=>{
      const container=card.querySelector(`.detail-hero-${block}-block`);
      const items=[...container.querySelectorAll(`.detail-hero-${block}-vi`)].map(node=>node.textContent);
      return items.length ? items.join(' · ') : container.querySelector('.detail-hero-missing')?.textContent;
    };
    return [...host.querySelectorAll('.detail-hero-card')].map(node=>({
      tactics:slotText(node,'tactics'),
      books:slotText(node,'books'),
      stat:node.querySelector('.detail-hero-stat')?.textContent,
    }));
  });
  expect(slots).toEqual([
    // Ô trống hoàn toàn: nguồn và bản dịch đều không có → nhãn "Chưa có dữ liệu".
    {tactics:'Chưa có dữ liệu',books:'Chưa có dữ liệu',stat:undefined},
    // Nguồn có chữ nhưng chưa dịch: hiện nhãn chờ dịch, không bịa chữ Việt.
    {tactics:'Nội dung tiếng Việt chưa sẵn sàng',books:'Nội dung tiếng Việt chưa sẵn sàng',stat:'Nội dung tiếng Việt chưa sẵn sàng'},
    {tactics:'Đột Trận',books:'Phá Trận',stat:'Toàn Võ Lực'},
  ]);
});

test('legacy original keeps notes, counters, hero notes and every alternative',async({page,request})=>{
  const teams=await rawTeams(request);
  const handles=await routeHandles(request);
  const team=teams.find(item=>item.notes && (item.counters?.good?.length || item.counters?.avoid?.length))
    || teams.find(item=>item.notes);
  await page.goto(legacyPath(handles,team.id));

  await expect(page.locator('h1#team-detail-title')).toHaveText(team.nickname || team.name);
  // Đội khác không có điểm nguồn: phần điểm không được render (plan Phase 6 bước 3), panel chỉ còn hành động.
  await expect(page.locator('.detail-score')).toHaveCount(0);
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
  await page.goto(legacyPath(await routeHandles(request),teams[0].id));
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
  await page.goto(legacyPath(await routeHandles(request),teams[0].id));
  const result=await page.evaluate(async()=>{
    // The direct renderer needs the legacy route registry before it can build original-team links.
    const {setTeamRouteHandles}=await import('/js/team-detail-navigation.js');
    const unregistered=!setTeamRouteHandles({l:{'legacy-probe':'doi-probe-goc'}});
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
        {legacyTeamId:'legacy-unregistered',legacyVariantId:'variant-c',legacyContentSha256:fingerprint,evidenceRef:'review-c',legacyContent:content},
      ],
    });
    const host=document.createElement('div');
    host.append(fragment);
    return {
      unregistered,
      bodies:host.querySelectorAll('.legacy-reference').length,
      provenance:host.querySelectorAll('.legacy-provenance').length,
      links:[...host.querySelectorAll('.legacy-provenance a')].map(link=>link.getAttribute('href')),
      text:host.textContent,
    };
  });
  expect(result.unregistered).toBe(false);
  expect(result.bodies).toBe(2);
  expect(result.provenance).toBe(3);
  // Registered originals get the frozen route; an unregistered one never falls back to a path.
  expect(result.links).toEqual(['/doi-khac/doi-probe-goc/','/doi-khac/doi-probe-goc/',null]);
  expect(result.text).toContain('variant-a');
  expect(result.text).toContain('review-a');
  expect(result.text).toContain('variant-b');
  expect(result.text).toContain('review-b');
});


test('only the exact admitted pair resolves a variant and a bad one links back to the original',async({page,request})=>{
  const {other}=await publication(request);
  const handles=await routeHandles(request);
  const admitted=other.records[0];
  const originalPath=legacyPath(handles,admitted.legacyTeamId);
  await page.goto(`${originalPath}?variant=${encodeURIComponent(admitted.legacyVariantId)}`);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-detail-root')).toContainText(admitted.legacyVariantId);

  await page.goto(`${originalPath}?variant=v-${'0'.repeat(64)}`);
  const alert=page.locator('#team-detail-status [role="alert"]');
  await expect(alert).toBeVisible();
  await expect(page.locator('h1#team-detail-title')).not.toBeEmpty();
  const original=page.locator('#team-detail-root a[href="'+originalPath+'"]');
  await expect(original).toBeVisible();
  // The original-team action must point at the new route, never at the retired family.
  const originalHrefs=await original.evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  expect(originalHrefs.length).toBeGreaterThan(0);
  expect(originalHrefs.every(href=>href===originalPath)).toBe(true);
  expect(originalPath.startsWith('/doi-khac/')).toBe(true);
  // A rejected variant must never be answered with the original team content.
  await expect(page.locator('#team-detail-body')).toBeHidden();
  for (const suffix of ['?variant=','?variant=%2Fbad']) {
    await page.goto(`${originalPath}${suffix}`);
    await expect(page.locator('#team-detail-status [role="alert"]')).toBeVisible();
    await expect(page.locator('#team-detail-body')).toBeHidden();
    await expect(page.locator('#team-detail-root a[href="'+originalPath+'"]')).toBeVisible();
  }
  await original.click();
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('original pages stay readable while Recommended artifacts are unavailable',async({page,request})=>{
  const teams=await rawTeams(request);
  const handles=await routeHandles(request);
  const {other}=await publication(request);
  const pending=teams.find(team=>!other.records.some(row=>row.legacyTeamId===team.id));
  await page.route('**/data/recommended/**',route=>route.abort());

  await page.goto(legacyPath(handles,pending.id));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('h1#team-detail-title')).toHaveText(pending.nickname || pending.name);

  // Duplicate/pending originals are reachable directly but are not admitted into Team khác.
  await page.unroute('**/data/recommended/**');
  await page.goto('/doi-khac/');
  await expect(page.locator(`#section-team-khac .reference-team-card[data-legacy-team-id="${pending.id}"]`)).toHaveCount(0);
});

test('Recommended detail fails closed when its payload cannot be verified',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  let currentRequests=0;
  await page.route('**/data/recommended/current.json',route=>{currentRequests+=1;return route.abort();});
  await page.route('**/data/recommended/*/details-*.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schemaVersion:1,records:[]})}));
  await page.goto(recommendedPath(await routeHandles(request),row.sourceConfigId));
  await expect(page.locator('#team-detail-status [role="alert"]')).toBeVisible();
  await expect(page.locator('#team-detail-body')).toBeHidden();
  await expect(page.locator('#team-detail-retry')).toBeVisible();
  await expect(page.locator('#team-return-link')).toBeVisible();
  // A failed verification must not fall back to another generation or the current selector.
  expect(currentRequests).toBe(0);
});

test('card title and CTA are the same native link and modified clicks stay native',async({page,context,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records[0];
  const detailPath=recommendedPath(handles,row.sourceConfigId);
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  const title=card.locator('.team-name a');
  const cta=card.getByRole('link',{name:'Chi tiết'});
  const href=await title.getAttribute('href');
  expect(href).toBe(await cta.getAttribute('href'));
  // Path is exactly the frozen catalog route; the only query is the safe return origin.
  expect(href.split('?')[0]).toBe(detailPath);
  expect(new URLSearchParams(href.split('?')[1] || '').get('from')).toBe(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
  // Both anchors carry the stable delegation marker instead of a pinned path prefix.
  await expect(title).toHaveAttribute('data-team-detail-link','');
  await expect(cta).toHaveAttribute('data-team-detail-link','');
  await expect(card).not.toHaveAttribute('tabindex','0');

  const before=await page.evaluate(()=>history.length);
  const popup=context.waitForEvent('page');
  await title.click({modifiers:['ControlOrMeta']});
  const opened=await popup;
  await opened.waitForURL('**/doi-chuan/**');
  expect(new URL(opened.url()).pathname).toBe(detailPath);
  await opened.close();
  expect(new URL(page.url()).pathname).toBe('/doi-chuan/');
  expect(await page.evaluate(()=>history.length)).toBe(before);
});

test('every rendered team card links to its catalog route and never to a retired path',async({page,request})=>{
  const handles=await routeHandles(request);
  const cardLinks=async section=>page.locator(`${section} .reference-team-card`).evaluateAll(nodes=>nodes.map(node=>({
    sourceConfigId:node.dataset.sourceConfigId || null,
    legacyTeamId:node.dataset.legacyTeamId || null,
    href:node.querySelector('.team-name a')?.getAttribute('href') ?? null,
  })));

  await page.goto('/doi-chuan/');
  await expect(page.locator('#section-team-chuan .reference-team-card').first()).toBeVisible();
  const recommended=await cardLinks('#section-team-chuan');
  expect(recommended.length).toBeGreaterThan(0);
  for (const card of recommended) {
    expect(card.sourceConfigId,JSON.stringify(card)).toBeTruthy();
    const segment=handles.r[card.sourceConfigId];
    expect(segment,card.sourceConfigId).toBeTruthy();
    // Only the path is pinned here; the safe return query is appended by the root surface.
    expect(card.href.split('?')[0],card.sourceConfigId).toBe(`/doi-chuan/${encodeURIComponent(segment)}/`);
  }

  await page.goto('/doi-khac/');
  await expect(page.locator('#section-team-khac .reference-team-card').first()).toBeVisible();
  const legacy=await cardLinks('#section-team-khac');
  expect(legacy.length).toBeGreaterThan(0);
  for (const card of legacy) {
    expect(card.legacyTeamId,JSON.stringify(card)).toBeTruthy();
    const segment=handles.l[card.legacyTeamId];
    expect(segment,card.legacyTeamId).toBeTruthy();
    expect(card.href.split('?')[0],card.legacyTeamId).toBe(`/doi-khac/${encodeURIComponent(segment)}/`);
  }
});

test('list to detail and back keeps query, tab and scroll position',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records[0];
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await page.evaluate(()=>window.scrollTo({top:600,behavior:'instant'}));
  const scrolled=await page.evaluate(()=>Math.round(window.scrollY));
  expect(scrolled).toBeGreaterThan(0);
  await card.locator('.team-name a').evaluate(link=>link.click());
  await expect(page).toHaveURL(new RegExp(`doi-chuan/`));
  await expect(page.locator('#team-detail-body')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`season=${encodeURIComponent(row.sourceSeasonId)}`));
  await expect(page).toHaveURL(/\/doi-chuan\/\?season=/);
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
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}&q=${encodeURIComponent(query)}`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  const disclosure=page.locator('#section-team-chuan .filter-collapse-toggle');
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded','true');
  const alternatives=card.locator(':scope > details.reference-alternatives');
  await alternatives.locator('summary').click();
  await expect(alternatives).toHaveAttribute('open','');
  await card.getByRole('link',{name:'Chi tiết'}).click();
  const back=page.locator('#team-return-link');
  await expect(back).toHaveAttribute('href',/q=/);
  await page.reload();
  await back.click();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('q'))).toBe(query);
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn')).toHaveValue(query);
  await expect(page.locator('#section-team-chuan .filter-collapse-toggle')).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#section-team-chuan-filters')).not.toHaveClass(/collapsed/);
});

test('view mode, unit, faction and Vietnamese search survive detail reload and history',async({page,request})=>{
  const {index,seasons}=await publication(request);
  const handles=await routeHandles(request);
  const seasonId='pk-s24';
  const seasonRows=index.records.filter(row=>row.sourceSeasonId===seasonId);
  // Cần bản ghi có route handle: bảng chỉ dựng link chi tiết khi handle tồn tại.
  const row=seasonRows.find(item=>handles.r[item.sourceConfigId] && item.factionRaw && item.unitTypesRaw?.length && item.displayNameVi);
  expect(row).toBeTruthy();
  const unit=row.unitTypesRaw[0];
  const faction=row.factionRaw;
  const unitLabel=seasons.displayLabels?.unit?.[unit] || unit;
  const factionLabel=seasons.displayLabels?.faction?.[faction] || faction;

  await page.setViewportSize({width:375,height:812});
  await page.goto(`/doi-chuan/?season=${seasonId}`);
  const section=page.locator('#section-team-chuan');
  const historyBefore=await page.evaluate(()=>history.length);
  await page.locator('#section-team-chuan .filter-collapse-toggle').click();
  await page.locator(`#section-team-chuan .unit-group .fchip[data-focus-key="unit:${unit}"]`).click();
  await page.locator(`#section-team-chuan .faction-group .fchip[data-focus-key="faction:${faction}"]`).click();
  await page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn').fill(row.displayNameVi);
  // Đổi sang Bảng chỉ replaceState: không thêm bước lịch sử và không mất bộ lọc.
  await page.locator('#section-team-chuan .view-btn[data-view="bang"]').click();
  await expect.poll(()=>page.evaluate(()=>history.length)).toBe(historyBefore);

  const tableRow=page.locator(`#section-team-chuan .reference-table tbody tr[data-reference-key="${row.sourceConfigId}"]`);
  await expect(tableRow).toBeVisible();
  await tableRow.scrollIntoViewIfNeeded();
  const rootScroll=await page.evaluate(()=>Math.round(scrollY));
  expect(rootScroll).toBeGreaterThan(0);
  await tableRow.locator('.reference-table-name').click();
  await expect(page.locator('#team-detail-root')).toHaveAttribute('data-source-config-id',row.sourceConfigId);
  await expect(page.locator('.detail-source')).toContainText(row.sourceConfigId);
  await page.reload();
  await expect(page.locator('#team-detail-body')).toBeVisible();

  await page.locator('#team-return-link').click();
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.getAll('unit'))).toEqual([unit]);
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.getAll('faction'))).toEqual([faction]);
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('view'))).toBe('bang');
  await expect(page.locator('#section-team-chuan').getByLabel('Tìm Đội chuẩn')).toHaveValue(row.displayNameVi);
  await expect(page.locator('#section-team-chuan .view-btn[data-view="bang"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator(`#section-team-chuan .unit-group .fchip[data-focus-key="unit:${unit}"]`)).toContainText(unitLabel);
  await expect(page.locator(`#section-team-chuan .faction-group .fchip[data-focus-key="faction:${faction}"]`)).toContainText(factionLabel);
  await expect(page.locator(`#section-team-chuan .reference-table tbody tr[data-reference-key="${row.sourceConfigId}"]`)).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Math.round(scrollY))).toBeGreaterThan(rootScroll/2);
  // Lịch sử: tiến/lùi giữa danh sách (Bảng) và trang chi tiết vẫn đúng chiều.
  await page.goBack();
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#section-team-chuan .view-btn[data-view="bang"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator(`#section-team-chuan .reference-table tbody tr[data-reference-key="${row.sourceConfigId}"]`)).toBeVisible();
});

test('a shared link without origin still offers the matching family scope',async({page,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records[0];
  const recommendedReturn=`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`;
  await page.goto(recommendedPath(handles,row.sourceConfigId));
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',recommendedReturn);
  const teams=await rawTeams(request);
  await page.goto(legacyPath(handles,teams[0].id));
  await expect(page.locator('#team-return-link')).toHaveAttribute('href','/doi-khac/');
});
test('legacy detail return links normalize the old Team chuẩn source URL',async({page,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records.find(item=>item.sourceConfigId && item.sourceSeasonId);
  const sectionUrl=`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}`;
  const oldFrom=`/?season=${encodeURIComponent(row.sourceSeasonId)}#team-chuan`;
  await page.goto(`${recommendedPath(handles,row.sourceConfigId)}?from=${encodeURIComponent(oldFrom)}`);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',sectionUrl);
  await page.locator('#team-return-link').click();
  await expect(page).toHaveURL(sectionUrl);
  await expect(page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`)).toBeVisible();
});

test('tracking keys are stripped while faction and scroll survive detail history',async({page,request})=>{
  const {index,seasons}=await publication(request);
  const row=index.records.find(item=>item.sourceConfigId && item.factionRaw && item.sourceSeasonId===seasons.defaultSourceSeasonId);
  const faction=row.factionRaw;
  await page.goto(`/doi-chuan/?fbclid=x&faction=${encodeURIComponent(faction)}`);
  const card=page.locator(`#section-team-chuan .reference-team-card[data-source-config-id="${row.sourceConfigId}"]`);
  await expect(card).toBeVisible();
  await expect.poll(()=>new URL(page.url()).searchParams.get('faction')).toBe(faction);
  expect(new URL(page.url()).searchParams.has('fbclid')).toBe(false);
  await card.scrollIntoViewIfNeeded();
  const scrollY=await page.evaluate(()=>Math.round(window.scrollY));
  expect(scrollY).toBeGreaterThan(0);
  await card.locator('.team-name a').click();
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(`/doi-chuan/?faction=${encodeURIComponent(faction)}`);
  await expect.poll(()=>new URL(page.url()).searchParams.get('faction')).toBe(faction);
  await expect.poll(()=>page.evaluate(()=>Math.round(window.scrollY))).toBeGreaterThan(scrollY/2);
  await expect(card).toBeVisible();
});

test('theme is applied before paint and survives cross-section Back navigation',async({page})=>{
  await page.addInitScript(()=>{
    if(localStorage.getItem('theme')===null) localStorage.setItem('theme','dark');
    document.addEventListener('DOMContentLoaded',()=>{
      window.themeAtDOMContentLoaded=document.documentElement.dataset.theme;
    },{once:true});
  });
  await page.goto('/doi-chuan/');
  await expect.poll(()=>page.evaluate(()=>window.themeAtDOMContentLoaded)).toBe('dark');
  await page.goto('/doi-khac/');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.goBack();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});


test('old reference links replace into dedicated routes while config keeps gameplay precedence',async({page,request})=>{
  const {index}=await publication(request);
  const handles=await routeHandles(request);
  const row=index.records[0];
  const legacyTeamId='team-intro-14';
  const legacyDetail=legacyPath(handles,legacyTeamId);
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}&detail=${encodeURIComponent(row.sourceConfigId)}`);
  await expect(page).toHaveURL(new RegExp(`/doi-chuan/[^/?]+/`));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-return-link')).toHaveAttribute('href',new RegExp(`season=${encodeURIComponent(row.sourceSeasonId)}`));

  await page.goto(`/doi-khac/?legacyTeam=${legacyTeamId}`);
  await expect(page).toHaveURL(new RegExp(`doi-khac/${handles.l[legacyTeamId]}/`));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goto(`/doi-khac/?legacyTeam=${legacyTeamId}&legacyVariant=%2Fbad`);
  await expect(page).toHaveURL(/variant=%2Fbad/);
  await expect(page.locator('#team-detail-status [role="alert"]')).toBeVisible();
  await expect(page.locator('#team-detail-body')).toBeHidden();
  await expect(page.locator('#team-detail-root a[href="'+legacyDetail+'"]')).toBeVisible();

  await page.goto(`/cung-ton/?config=missing&legacyTeam=${legacyTeamId}`);
  await expect(page).not.toHaveURL(/doi-khac/);
  await expect(page.locator('#season-detail-mount')).toContainText('Không có cấu hình này');
  await page.goto(`/cung-ton/?config=missing&detail=${encodeURIComponent(row.sourceConfigId)}`);
  await expect(page).not.toHaveURL(/doi-chuan/);
});

test('retired team routes serve the static 404 while their replacements resolve',async({page,request})=>{
  const handles=await routeHandles(request);
  const {index}=await publication(request);
  const teams=await rawTeams(request);
  const recommendedId='team-b8ink3';
  expect(index.records.some(row=>row.sourceConfigId===recommendedId)).toBe(true);
  expect(handles.r[recommendedId]).toBe('pk-s24-tu-ma-phi-hung');

  // The old family is a hard cutover: no redirect, no shell, just the static 404.
  for (const retired of [`/teams/recommended/${recommendedId}/`,`/teams/legacy/${teams[0].id}/`]) {
    const response=await request.get(retired);
    expect(response.status(),retired).toBe(404);
    expect(await response.text()).toContain('Không tìm thấy trang');
  }
  await page.goto(`/teams/recommended/${recommendedId}/`);
  await expect(page.locator('#not-found-title')).toBeVisible();
  await expect(page.locator('#section-team-chuan')).toHaveCount(0);

  // The replacement route for the same identity still serves the real page.
  expect((await request.get(recommendedPath(handles,recommendedId))).status()).toBe(200);
  expect((await request.get(legacyPath(handles,teams[0].id))).status()).toBe(200);
});

test('unknown routes serve the static 404 instead of the root shell',async({page,request})=>{
  await page.setViewportSize({width:375,height:812});
  const missing=await request.get('/doi-chuan/khong-ton-tai/');
  expect(missing.status()).toBe(404);
  const missingKhaiHoang=await request.get('/khai-hoang/khong-ton-tai/');
  expect(missingKhaiHoang.status()).toBe(404);
  expect(await missingKhaiHoang.text()).toContain('Không tìm thấy trang');
  await page.goto('/doi-chuan/khong-ton-tai/');
  await expect(page.locator('#not-found-title')).toBeVisible();
  await expect(page.locator('#section-team-chuan')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Về trang chủ'})).toHaveAttribute('href','/');
  const themeBefore=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.locator('#theme-toggle').click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(themeBefore);
  await page.locator('#section-menu-toggle').click();
  await expect(page.locator('#section-menu-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#section-menu-items')).toBeVisible();

  const teams=await rawTeams(request);
  const nested=await request.get(`${legacyPath(await routeHandles(request),teams[0].id)}data/teams.json`);
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
  await page.goto(legacyPath(await routeHandles(request),teams[0].id));
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
  await page.goto(`/doi-chuan/?season=${encodeURIComponent(row.sourceSeasonId)}&q=${encodeURIComponent(query)}`);
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
  const handles=await routeHandles(request);
  const [first,second]=index.records;
  await page.goto('/doi-chuan/');
  const start=await page.evaluate(()=>history.length);
  await page.goto(recommendedPath(handles,first.sourceConfigId));
  await page.goto(recommendedPath(handles,second.sourceConfigId));
  expect(await page.evaluate(()=>history.length)).toBe(start+2);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(handles.r[first.sourceConfigId]));
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/doi-chuan/');
  expect(await page.evaluate(()=>history.length)).toBe(start+2);
});

const khaiHoangPath=(handles,teamId)=>`/khai-hoang/${encodeURIComponent(handles.k[teamId])}/`;

test('Khai hoang detail loads directly, pins its verified source and never boots the root app',async({page,request})=>{
  const handles=await routeHandles(request);
  const [teamId]=Object.keys(handles.k);
  expect(teamId,JSON.stringify(handles.k)).toBeTruthy();
  const path=khaiHoangPath(handles,teamId);
  expect((await request.get(path)).status()).toBe(200);

  await page.goto(path);
  const root=page.locator('#team-detail-root');
  await expect(root).toHaveAttribute('data-family','khaihoang');
  await expect(root).toHaveAttribute('data-khaihoang-team-id',teamId);
  await expect(root).toHaveAttribute('data-khaihoang-sha256',/^sha256:[0-9a-f]{64}$/);
  await expect(page.locator('h1#team-detail-title')).not.toBeEmpty();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await expect(page.locator('#team-detail-body')).not.toBeEmpty();
  await expect(page.locator('#team-detail-status')).toBeHidden();
  await expect(page.locator('#team-return-link')).toHaveAttribute('href','/khai-hoang/');
  // Canonical luôn là pathname: deep-link `variant`/`from` không tạo URL thứ hai.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(`${path}$`));
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content','article');
  await expect(page.locator('script[src="/js/khaihoang-detail.js"]')).toHaveCount(1);
  await expect(page.locator('script[type="module"][src="/js/app.js"]')).toHaveCount(0);
  await expect(page.locator('#season-controls')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#team-detail-body')).toBeVisible();
});

test('every Khai hoang team has a reachable detail route in the published sitemap',async({request})=>{
  const handles=await routeHandles(request);
  const teamIds=Object.keys(handles.k);
  expect(teamIds.length).toBeGreaterThan(0);
  const sitemap=await (await request.get('/sitemap.xml')).text();
  const pathnames=[...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(([,location])=>new URL(location).pathname);
  expect(new Set(pathnames).size).toBe(pathnames.length);
  for(const teamId of teamIds){
    const path=khaiHoangPath(handles,teamId);
    expect(pathnames,teamId).toContain(path);
    expect((await request.get(path)).status(),path).toBe(200);
  }
});

test('a source-empty third seat reads as an empty seat on the Recommended detail page',async({page,request})=>{
  const {index}=await publication(request);
  const row=index.records.find(record=>record.sourceConfigId.startsWith('yxms-005'));
  await page.goto(recommendedPath(await routeHandles(request),row.sourceConfigId));
  const body=page.locator('#team-detail-body');
  await expect(body.locator('.detail-hero-card').first()).toBeVisible();
  await expect(body).not.toContainText('Nội dung tiếng Việt chưa sẵn sàng');
  const seat=body.locator('.detail-hero-card').nth(2);
  await expect(seat.locator('.detail-hero-role')).toHaveText('Phó tướng 2');
  await expect(seat.getByRole('img',{name:'Nguồn để trống'})).toHaveText('—');
});

test('copy link on a Khai hoang detail keeps the chosen variant and drops from',async({context,page,request})=>{
  const handles=await routeHandles(request);
  const {teams}=await (await request.get('/data/khaihoang.json')).json();
  const team=teams.find(item=>(item.variants||[]).length && handles.k[item.id]);
  const variant=team.variants[0].id;
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const path=khaiHoangPath(handles,team.id);
  await page.goto(`${path}?from=${encodeURIComponent('/khai-hoang/?q=x')}&variant=${encodeURIComponent(variant)}`);
  await expect(page.locator('#team-detail-body')).toBeVisible();
  await page.locator('#team-copy-link').click();
  await expect(page.locator('#team-copy-status')).toHaveText('Đã sao chép liên kết');
  const expected=new URL(path,page.url());
  expected.searchParams.set('variant',variant);
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(expected.href);
});

test('a changed teams.json reads as a verification failure and an unreachable one as a network failure',async({page,request})=>{
  const teams=await rawTeams(request);
  const path=legacyPath(await routeHandles(request),teams[0].id);
  await page.route('**/data/teams.json',async route=>{
    const response=await route.fetch();
    return route.fulfill({response,body:`${await response.text()}\n`});
  });
  await page.goto(path);
  const alert=page.locator('#team-detail-status [role="alert"]');
  await expect(alert).toContainText('Không thể xác minh dữ liệu đội hình');
  await expect(alert).not.toContainText('Hãy kiểm tra kết nối');

  await page.unroute('**/data/teams.json');
  await page.route('**/data/teams.json',route=>route.abort());
  await page.goto(path);
  await expect(alert).toContainText('Hãy kiểm tra kết nối');
});

test('Đội chuẩn and Đội khác details fetch only the display publication and teams.json, each once',async({page,request})=>{
  const handles=await routeHandles(request);
  const {index}=await publication(request);
  const teams=await rawTeams(request);
  for (const path of [recommendedPath(handles,index.records[0].sourceConfigId),legacyPath(handles,teams[0].id)]) {
    const requests=[];
    const record=req=>{const {pathname}=new URL(req.url());if (pathname.startsWith('/data/') && !pathname.startsWith('/data/recommended/')) requests.push(pathname);};
    page.on('request',record);
    await page.goto(path);
    await expect(page.locator('#team-detail-root')).toHaveAttribute('aria-busy','false');
    await expect(page.locator('#team-detail-body')).toBeVisible();
    page.off('request',record);
    expect(requests.sort(),path).toEqual(['/data/teams.json','/data/website-display.json']);
  }
});

test('Khai hoang detail keeps the title right under the back link',async({page,request})=>{
  await page.setViewportSize({width:1280,height:900});
  const gap=async()=>{
    await expect(page.locator('#team-detail-body')).toBeVisible();
    await expect(page.locator('#team-detail-panel')).toBeVisible();
    return page.evaluate(()=>document.querySelector('h1#team-detail-title').getBoundingClientRect().top
      - document.querySelector('#team-return-link').getBoundingClientRect().bottom);
  };
  const {index}=await publication(request);
  await page.goto(recommendedPath(await routeHandles(request),index.records[0].sourceConfigId));
  const recommendedGap=await gap();
  await page.goto('/khai-hoang/chu-thai-truong-phi-truong-xuan-hoa/');
  const khaiHoangGap=await gap();
  expect(khaiHoangGap).toBeLessThanOrEqual(recommendedGap);
});
