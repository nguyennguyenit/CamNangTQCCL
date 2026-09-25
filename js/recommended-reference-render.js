import { el, icon, svgNode, FACTION_CODE, SOURCE_LABEL } from './render.js';
import { validateReferenceSourceUrl } from './recommended-reference-state.js';
import { teamDetailPath } from './team-detail-navigation.js';

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;
const UNAVAILABLE = 'Nội dung tiếng Việt chưa sẵn sàng';
const text = value => typeof value === 'string' && value.trim() && !CJK.test(value) ? value.trim() : UNAVAILABLE;
const localizedSlot = (raw,vi) => {
  const hasSource = typeof raw === 'string' ? Boolean(raw.trim()) : Boolean(raw);
  const hasDisplay = typeof vi === 'string' && Boolean(vi.trim());
  if (!hasSource && !hasDisplay) return {value:null,interactive:false};
  let value=hasDisplay ? text(vi) : UNAVAILABLE;
  if (value === UNAVAILABLE && hasSource) value=text(raw);
  return {value,interactive:value !== UNAVAILABLE};
};

const VARIANT_CLASS={SP:'sp',CO:'co','40Y':'y40'};

function holderNameNodes(holder) {
  const name=holder.displayNameVi || holder.nameRaw || '';
  const value=text(name);
  // Accept a separate prefix or one attached to Chinese text, never part of a Latin name.
  const match=value.match(/^(SP|CO|40Y)(?:\s+|(?=[\u3400-\u9fff]))(.+)$/u);
  if (!match) return [el('span',{class:'hn'},text(value))];
  return [
    el('span',{class:`pre ${VARIANT_CLASS[match[1]]}`},match[1]),
    ' ',
    el('span',{class:'hn'},match[2].trim()),
  ];
}

// Ô chiến pháp theo dữ liệu nguồn; tacticSlotKinds (nếu có) đánh dấu ô nào thực chất là duyên phận.
function tacticSlotEntries(holder) {
  const raw=holder.tacticSlotsRaw || [];
  const vi=holder.tacticSlotsVi || [];
  const kinds=holder.tacticSlotKinds || [];
  const length=Math.max(2,raw.length,vi.length);
  return Array.from({length},(_,index)=>({...localizedSlot(raw[index],vi[index]),bond:kinds[index] === 'bond'}));
}


/** Vai trò viết tắt theo vị trí trong đội; artboard Main/MainTable dùng đúng ba nhãn này. */
const HERO_ROLES = ['CHỦ','PHÓ 1','PHÓ 2'];

/** Ô chiến pháp: giá trị đã bản địa hoá mới bấm được để tìm, còn lại chỉ hiển thị. */
function tacticTag(entry,onTag) {
  if (!entry.value) return null;
  return entry.interactive
    ? el('button',{type:'button',class:'tag t-tactic',title:'Tìm chiến pháp này',onClick:event=>{event.stopPropagation();onTag?.(entry.value);}},entry.value)
    : el('span',{class:'tag t-tactic'},entry.value);
}

/**
 * Một dòng tướng của thẻ gọn: vai trò, tên, chiến pháp (nút tìm), binh thư dạng dòng.
 * Binh thư trống ghi một dòng nghiêng "Nguồn chưa ghi" thay cho ba tag "Chưa có dữ liệu".
 */
function holderView(holder,onTag,{index=0}={}) {
  const entries=tacticSlotEntries(holder);
  const bonds=entries.filter(entry=>entry.bond && entry.value);
  const tactics=entries.filter(entry=>!entry.bond).map(entry=>tacticTag(entry,onTag)).filter(Boolean);
  const books=Array.from({length:3},(_,slot)=>localizedSlot(holder.bookSlotsRaw?.[slot],holder.bookSlotsVi?.[slot]).value).filter(Boolean);
  return el('div',{class:'hero reference-holder',dataset:{role:HERO_ROLES[index]||''}},[
    el('span',{class:'reference-role'},HERO_ROLES[index]||''),
    el('div',{class:'hero-name'},holderNameNodes(holder)),
    tactics.length ? el('div',{class:'line tactics'},tactics) : null,
    bonds.length ? el('div',{class:'line bonds'},[
      el('span',{class:'slot-label'},'Duyên phận:'),
      ...bonds.map(entry=>el('span',{class:'tag t-bond'},entry.value)),
    ]) : null,
    el('p',{class:'line books'},[
      'Binh thư · ',
      books.length
        ? el('span',{class:'reference-book-values'},books.join(' · '))
        : el('span',{class:'reference-books-missing'},'Nguồn chưa ghi'),
    ]),
  ]);
}

const slotLine=(raw,vi)=>(raw || []).map((value,index)=>localizedSlot(value,vi?.[index]).value).filter(Boolean).join(' · ');
const entryLine=entries=>entries.map(entry=>entry.value).filter(Boolean).join(' · ');
const noteParagraph=value=>el('p',{class:'detail-note'},text(value));
const fact=(cls,label,value)=>el('div',{class:cls},[el('dt',{},label),el('dd',{},value)]);
const detailSlotValue=value=>value || 'Chưa có dữ liệu';

/** Một holder trên trang chi tiết; ghi chú đi kèm đúng chủ sở hữu, không gộp aggregate. */
function detailHolder(holder,{level='h3',notes=[],isMain=false}={}) {
  const entries=tacticSlotEntries(holder);
  const bonds=entries.filter(entry=>entry.bond && entry.value);
  const statFocus=localizedSlot(holder.statFocusRaw,holder.statFocusVi).value;
  return el('section',{class:'reference-detail-holder season-slot'},[
    el(level,{},[
      ...holderNameNodes(holder),
      isMain ? el('span',{class:'badge role main-holder',title:'Chủ tướng','aria-label':'Chủ tướng'},'C') : null,
    ]),
    el('dl',{class:'detail-facts'},[
      fact('holder-tactics','Chiến pháp',detailSlotValue(entryLine(entries.filter(entry=>!entry.bond)))),
      bonds.length ? fact('holder-bonds','Duyên phận',entryLine(bonds)) : null,
      fact('holder-books','Binh thư',detailSlotValue(slotLine(holder.bookSlotsRaw,holder.bookSlotsVi))),
      fact(
        holder.statFocusKind === 'note' ? 'holder-stat-note' : 'holder-stat',
        holder.statFocusKind === 'note' ? 'Lưu ý' : 'Cộng điểm',
        detailSlotValue(statFocus),
      ),
    ].filter(Boolean)),
    ...notes.map(noteParagraph),
  ]);
}

const section=(title,children)=>{
  const items=[].concat(children).filter(Boolean);
  if (!items.length) return null;
  return el('section',{class:'detail-section'},[el('h2',{},title),...items]);
};

/**
 * Tên hàng danh sách: bản ghi đội chuẩn dùng tên đã bản địa hoá, đội gốc ưu tiên `nickname` trước `name`
 * (contract bước 6). Chỉ nhận chuỗi đã có tiếng Việt, không để chữ Hán hay nhãn "chưa sẵn sàng" làm tiêu đề.
 */
function rowDisplayName(row) {
  const candidates=row.sourceConfigId
    ? [row.displayNameVi,row.nameZh,row.name,row.nickname]
    : [row.nickname,row.name,row.displayNameVi,row.nameZh];
  const safe=candidates.find(value=>typeof value === 'string' && value.trim() && !CJK.test(value));
  return safe ? safe.trim() : UNAVAILABLE;
}

/** Dòng "■ phe · binh" của thẻ và ô đội của bảng: chỉ phần có dữ liệu, phần thiếu bỏ hẳn. */
function metaLine(row,labels) {
  const raw=row.factionRaw ?? row.faction;
  const faction=raw ? text(labels?.faction?.[raw] || raw) : '';
  const units=(row.unitTypesRaw?.length ? row.unitTypesRaw : (row.unit || []))
    .map(value=>text(labels?.unit?.[value] || value))
    .filter(Boolean);
  const nodes=[];
  if (faction) nodes.push(el('span',{class:`reference-faction f-${FACTION_CODE[faction] || 'none'}`},faction));
  if (units.length) nodes.push(el('span',{class:'reference-units'},units.join(' · ')));
  if (!nodes.length) return null;
  return el('p',{class:'reference-meta'},nodes.flatMap((node,index)=>index ? [' · ',node] : [node]));
}

// Điểm nguồn giữ đúng độ chính xác nguồn; thiếu điểm là nhãn trung tính, không phải 0.
const scoreBadge=row=>row.value != null
  ? el('span',{class:'reference-score-wrap'},[
    el('span',{class:'badge score reference-score',title:'Điểm nguồn'},String(row.value)),
    ' ',
    el('span',{class:'reference-score-unit'},'điểm'),
  ])
  : el('span',{class:'badge score reference-score missing-score'},'Chưa có điểm nguồn');

function legacyAlternativeLines(content) {
  return (content?.heroes || []).flatMap(hero=>[
    ...(hero.alternatives || []).map(value=>[hero.name,'Tướng thay',value]),
    ...(hero.tactics || []).flatMap(item=>(item.alternatives || []).map(value=>[hero.name,`Chiến pháp ${item.name}`,value])),
    ...(hero.books || []).flatMap(item=>(item.alternatives || []).map(value=>[hero.name,`Binh thư ${item.name}`,value])),
  ].map(([owner,label,value])=>el('p',{class:'alternative-line'},`${text(owner)} · ${label}: ${value}`)));
}

/** Phương án thay thế đầy đủ nhưng thu gọn trong disclosure có nhãn và số lượng. */
function alternativesDisclosure(row,onTag) {
  const holders=row.alternativeHoldersRaw || [];
  const nodes=holders.length ? holders.map((holder,index)=>holderView(holder,onTag,{index})) : legacyAlternativeLines(row.legacyContent);
  if (!nodes.length) return null;
  return el('details',{class:'reference-alternatives'},[
    el('summary',{},`Thay thế (${nodes.length})`),
    el('div',{class:'alternative-body'},nodes),
  ]);
}

/** Nhãn "Sợ …" lấy từ counters `avoid` của nội dung đội gốc đã đối chiếu; đội không có thì bỏ dòng. */
function fearLine(row) {
  const contents=[row.legacyContent,...(row.legacyReferences || []).map(reference=>reference.legacyContent)].filter(Boolean);
  const values=[...new Set(contents.flatMap(content=>content.counters?.avoid || []))];
  if (!values.length) return null;
  return el('p',{class:'reference-fear'},[el('strong',{},'Sợ'),' ',values.join(' · ')]);
}

const detailHrefFor=(href,children,cls)=>href
  ? el('a',{class:cls,href,dataset:{teamDetailLink:''}},children)
  : el('span',{class:cls},children);

/** Title và CTA là link thật tới cùng href; click có modifier vẫn là hành vi trình duyệt. */
export function recommendedTeamCard(row,{onTag,href,labels}={}) {
  const name=rowDisplayName(row);
  const fear=fearLine(row);
  return el('article',{class:'team-card reference-team-card',dataset:{referenceKey:row.sourceConfigId || row.legacyVariantId || row.legacyTeamId || '',sourceConfigId:row.sourceConfigId || '',legacyTeamId:row.legacyTeamId || '',faction:row.factionRaw || row.faction || ''}},[
    el('header',{class:'reference-card-head'},[
      el('div',{class:'reference-card-title'},[
        el('h3',{class:'team-name'},href ? el('a',{href,dataset:{teamDetailLink:''}},name) : name),
        metaLine(row,labels),
      ]),
      scoreBadge(row),
    ]),
    el('div',{class:'heroes'},(row.heroes || row.holders || []).map((holder,index)=>holderView(holder,onTag,{index}))),
    alternativesDisclosure(row,onTag),
    el('footer',{class:'reference-card-foot'},[
      fear,
      href ? el('a',{class:'ana-link-btn',href,dataset:{teamDetailLink:''}},['Chi tiết',icon([svgNode('line',{x1:5,y1:12,x2:19,y2:12}),svgNode('polyline',{points:'13 6 19 12 13 18'})],{size:16})]) : null,
    ].filter(Boolean)),
  ]);
}

const tableCell=(children,cls)=>el('td',{class:cls},children);

/** Ô tướng của bảng: tên (kèm nhãn biến thể) + chiến pháp chữ son; thiếu chỗ thì "—". */
function tableHeroCell(holder) {
  if (!holder) return tableCell('—','reference-table-hero');
  const tactics=tacticSlotEntries(holder).filter(entry=>!entry.bond && entry.value).map(entry=>entry.value);
  return tableCell([
    el('span',{class:'reference-table-holder'},holderNameNodes(holder)),
    ...tactics.map(value=>el('span',{class:'reference-table-tactic'},value)),
  ],'reference-table-hero');
}

/**
 * Bảng 5 cột dùng chung cho cả hai nguồn: Recommended đọc `displayNameVi`/`heroes`/`tacticSlotsVi`/`value`,
 * đội gốc đọc `nickname || name`/`holders` và điểm vắng là "—" (không bịa 0).
 * Hàng mang `data-reference-key` để test bám danh tính bản ghi, không bám số lượng.
 */
export function recommendedTeamTable(rows,{hrefFor,labels}={}) {
  const head=el('tr',{},[
    el('th',{scope:'col',class:'reference-table-team'},'Đội'),
    el('th',{scope:'col'},'Chủ tướng'),
    el('th',{scope:'col'},'Phó 1'),
    el('th',{scope:'col'},'Phó 2'),
    el('th',{scope:'col',class:'reference-table-score-head'},'Điểm'),
  ]);
  const body=rows.map(row=>{
    const href=hrefFor?.(row);
    const name=rowDisplayName(row);
    const holders=(row.heroes || row.holders || []).slice(0,3);
    const lineup=holders.map(holder=>text(holder.displayNameVi || holder.nameRaw)).filter(Boolean).join(' · ');
    return el('tr',{dataset:{referenceKey:row.sourceConfigId || row.legacyVariantId || row.legacyTeamId || ''}},[
      el('th',{scope:'row',class:'reference-table-team'},[
        detailHrefFor(href,name,'reference-table-name'),
        metaLine(row,labels),
        el('span',{class:'reference-table-lineup'},lineup),
      ]),
      ...Array.from({length:3},(_,index)=>tableHeroCell(holders[index])),
      tableCell(row.value != null ? String(row.value) : '—','reference-table-score'),
    ]);
  });
  return el('table',{class:'reference-table'},[el('thead',{},head),el('tbody',{},body)]);
}

function notesByOwner(record) {
  const blocks=record.displayNotes?.blocks;
  if (!Array.isArray(blocks)) {
    return {team:[UNAVAILABLE],primary:new Map(),alternative:new Map(),projected:false};
  }
  const team=[];
  const primary=new Map();
  const alternative=new Map();
  for (const block of blocks) {
    const value=block?.textVi || UNAVAILABLE;
    if (!value) continue;
    const bucket=block.owner === 'primary' ? primary : block.owner === 'alternative' ? alternative : null;
    if (!bucket) { team.push(value); continue; }
    const index=Number.isInteger(block.holderIndex) ? block.holderIndex : -1;
    if (index < 0) { team.push(value); continue; }
    bucket.set(index,[...(bucket.get(index) || []),value]);
  }
  return {team,primary,alternative,projected:true};
}

function legacyContentSections(content,{title,provenance=[]}={}) {
  const counters=content.counters || {};
  const counterList=(values,cls)=>el('ul',{class:'counters'},values.map(value=>el('li',{class:`chip ${cls}`},String(value))));
  const heroAlternatives=(content.heroes || []).flatMap(hero=>{
    const rows=[
      hero.alternatives?.length ? fact('legacy-hero-alternatives','Tướng thay thế',hero.alternatives.join(' · ')) : null,
      ...(hero.tactics || []).filter(item=>item.alternatives?.length).map(item=>fact('legacy-tactic-alternatives',`Chiến pháp ${item.name}`,item.alternatives.join(' · '))),
      ...(hero.books || []).filter(item=>item.alternatives?.length).map(item=>fact('legacy-book-alternatives',`Binh thư ${item.name}`,item.alternatives.join(' · '))),
    ].filter(Boolean);
    return rows.length ? [el('section',{class:'legacy-alternative-group'},[el('h3',{},text(hero.name)),el('dl',{class:'detail-facts'},rows)])] : [];
  });
  return [
    title ? el('h3',{class:'legacy-content-title'},title) : null,
    ...provenance,
    section('Cấu hình gốc',(content.heroes || []).map((hero,index)=>el('section',{class:'reference-detail-holder season-slot'},[
      el('h3',{},[
        text(hero.name),
        index===0 ? el('span',{class:'badge role main-holder',title:'Chủ tướng','aria-label':'Chủ tướng'},'C') : null,
      ]),
      el('dl',{class:'detail-facts'},[
        fact('holder-tactics','Chiến pháp',(hero.tactics || []).map(item=>item.name).join(' · ') || 'Chưa có dữ liệu'),
        fact('holder-books','Binh thư',(hero.books || []).map(item=>item.name).join(' · ') || 'Chưa có dữ liệu'),
      ]),
      hero.note ? noteParagraph(hero.note) : null,
    ]))),
    section('Mô tả & cách vận hành',content.notes ? noteParagraph(content.notes) : null),
    section('Khắc chế',[
      counters.good?.length ? el('div',{class:'counter-group'},[el('h3',{},'Khắc chế tốt'),counterList(counters.good,'good')]) : null,
      counters.avoid?.length ? el('div',{class:'counter-group'},[el('h3',{},'Nên tránh'),counterList(counters.avoid,'avoid')]) : null,
    ].filter(Boolean)),
    section('Phương án thay thế',heroAlternatives),
  ].filter(Boolean);
}

/** Nội dung chi tiết Team chuẩn cho trang riêng; trả fragment, không tự tạo article/h1. */
export function recommendedTeamDetailContent(record,{legacyTeams=[]}={}) {
  const fragment=document.createDocumentFragment();
  const notes=notesByOwner(record);
  const holders=record.heroes || record.holders || [];
  const alternatives=record.alternativeHoldersRaw || [];
  const source=validateReferenceSourceUrl('recommended',record,record.sourceUrl);

  fragment.append(section('Cấu hình chính',el('div',{class:'season-hero-slot'},holders.map((holder,index)=>detailHolder(holder,{
    isMain:index===0,
    notes:notes.projected ? notes.primary.get(index) || [] : [],
  })))));
  const teamNotes=section('Mô tả & điều kiện',notes.team.map(noteParagraph));
  if (teamNotes) fragment.append(teamNotes);

  const groups=Array.from({length:Math.ceil(alternatives.length/3)},(_,index)=>{
    const slice=alternatives.slice(index*3,index*3+3);
    return el('section',{class:'reference-alternative-group'},[
      el('h3',{},`Cấu hình thay thế ${index+1}`),
      el('div',{class:'season-hero-slot'},slice.map((holder,position)=>detailHolder(holder,{
        level:'h4',
        isMain:position===0,
        notes:notes.projected ? notes.alternative.get(index*3+position) || [] : [],
      }))),
    ]);
  });
  const alternativeSection=section('Cấu hình thay thế',groups);
  if (alternativeSection) fragment.append(alternativeSection);

  const legacyReferenceGroups=new Map();
  for (const reference of record.legacyReferences || []) {
    if (!reference.legacyContent) continue;
    const key=`${reference.legacyTeamId}|${reference.legacyContentSha256}`;
    const group=legacyReferenceGroups.get(key) || {content:reference.legacyContent,references:[]};
    group.references.push(reference);
    legacyReferenceGroups.set(key,group);
  }
  for (const {content,references} of legacyReferenceGroups.values()) {
    const first=references[0];
    const localizedContent=legacyTeams.find(team=>team.id===first.legacyTeamId) || content;
    const provenance=references.map(reference=>el('div',{class:'legacy-provenance'},[
      el('p',{class:'scope-note'},`Đội gốc: ${reference.legacyTeamId}${reference.legacyVariantId ? ` · biến thể ${reference.legacyVariantId}` : ''}`),
      el('p',{class:'scope-note'},`Bằng chứng rà soát: ${reference.evidenceRef || 'Chưa ghi'} · ${reference.legacyContentSha256 || ''}`),
      el('p',{class:'detail-link-row'},el('a',{class:'detail-link',href:teamDetailPath({legacyTeamId:reference.legacyTeamId})},'Xem trang đội gốc')),
    ]));
    fragment.append(el('section',{class:'detail-section legacy-reference'},[
      el('h2',{},'Nội dung đội gốc đã đối chiếu'),
      ...legacyContentSections(localizedContent,{
        title:localizedContent.nickname || localizedContent.name || first.legacyTeamId,
        provenance,
      }),
    ]));
  }

  fragment.append(el('section',{class:'detail-section detail-source'},[
    el('h2',{},'Nguồn & phạm vi'),
    el('dl',{class:'detail-facts'},[
      fact('source-config','Mã cấu hình nguồn',el('code',{translate:'no'},record.sourceConfigId || 'Chưa có')),
      record.sourceSeasonCode || record.sourceSeasonId ? fact('source-season','Mùa nguồn',[record.sourceSeasonCode || record.sourceSeasonId,record.sourceSeasonNameVi].filter(Boolean).join(' · ')) : null,
      record.sourceCategoryNameVi || record.sourceCategoryId ? fact('source-category','Danh mục',record.sourceCategoryNameVi || record.sourceCategoryId) : null,
      record.authorRaw ? fact('source-author','Tác giả',record.authorRaw) : null,
    ].filter(Boolean)),
    record.introRaw ? noteParagraph(record.introRaw) : null,
    source
      ? el('p',{},el('a',{href:source,target:'_blank',rel:'noopener noreferrer'},'Mở nguồn SGSDeck trong thẻ mới'))
      : el('p',{class:'scope-note'},'Liên kết nguồn không hợp lệ hoặc chưa có.'),
  ]));
  return fragment;
}

/** Nội dung đội gốc; dùng cho trang original và cho biến thể đã được admit. */
export function legacyOriginalDetailContent(team,{variant}={}) {
  const fragment=document.createDocumentFragment();
  fragment.append(...legacyContentSections(team,{}));
  fragment.append(el('section',{class:'detail-section detail-source'},[
    el('h2',{},'Nguồn & phạm vi'),
    el('dl',{class:'detail-facts'},[
      fact('source-legacy-id','Mã đội gốc',el('code',{translate:'no'},team.id || 'Chưa có')),
      fact('source-label','Nguồn',SOURCE_LABEL[team.source] || team.source || 'Nguồn chưa xác định'),
      team.rawType ? fact('source-raw-type','Loại binh nguồn',team.rawType) : null,
      variant ? fact('source-variant','Biến thể đã đối chiếu',el('code',{translate:'no'},variant.legacyVariantId)) : null,
      variant?.legacyContentSha256 ? fact('source-variant-proof','Vân tay nội dung',el('code',{translate:'no'},variant.legacyContentSha256)) : null,
    ].filter(Boolean)),
  ]));
  return fragment;
}
