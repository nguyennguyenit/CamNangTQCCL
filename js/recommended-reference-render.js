import { t, iconTree, svgTree, FACTION_CODE, UNRESOLVED_NAME, formatModifiedTactic, heroMentionNodes, sourceLabel, unitLabel, variantNameNodes } from './render.js';
import { legacyLabelZh, sourceTierLabel, sourceName } from './recommended-reference-state.js';
import { teamDetailPath } from './team-detail-navigation.js';
import { lookupItemPath } from './lookup-ids.js';
import { TEAM_VIEW_GRID, TEAM_VIEW_TABLE } from './team-view.js';
import { L, currentLocale, localePath, withLocale } from './i18n.js';
import { enableControl } from './view-tree.js';

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;
const isZh = () => currentLocale() === 'zh';
const unavailable = () => L('Nội dung tiếng Việt chưa sẵn sàng','内容尚未就绪');
/**
 * Chữ công khai của một giá trị nguồn. Bản vi: chuỗi còn chữ Hán không được hiện. Bản zh: dữ liệu không áp
 * bản dịch nên chữ Hán gốc là nội dung chính; tên Hán-Việt của dữ liệu cũ đổi sang chữ Hán qua `sourceName`.
 */
const text = value => {
  if (typeof value !== 'string' || !value.trim()) return unavailable();
  // Tên không tra được chữ Hán bị thay bằng "—" để không lộ tiếng Việt ở bản zh.
  if (isZh()) return sourceName(value.trim()) || UNRESOLVED_NAME;
  return CJK.test(value) ? unavailable() : value.trim();
};
/** Văn xuôi nguồn (ghi chú, mô tả): bản zh chỉ nhận chữ Hán gốc, văn tiếng Việt bị bỏ để trang không trộn ngôn ngữ. */
const prose = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (isZh()) return CJK.test(value) ? value.trim() : null;
  return text(value);
};
/** Bản zh: tên đã đổi được sang chữ Hán mới hiện; tên không tra được bị bỏ. Bản vi trả nguyên. */
const zhResolved = value => {
  if (!isZh()) return value;
  const name = sourceName(String(value ?? ''));
  return CJK.test(name) ? name : null;
};
const localizedSlot = (raw,vi) => {
  const hasSource = typeof raw === 'string' ? Boolean(raw.trim()) : Boolean(raw);
  const hasDisplay = typeof vi === 'string' && Boolean(vi.trim());
  if (!hasSource && !hasDisplay) return {value:null,interactive:false};
  // Bản zh luôn lấy giá trị nguồn (chữ Hán gốc); tên Hán-Việt của dữ liệu cũ được đổi qua `sourceName`.
  if (isZh()) {
    const value=text(hasSource && typeof raw === 'string' ? raw : vi);
    // Ô chiến pháp/binh thư không tra được chữ Hán thì bỏ hẳn ô, không hiện "—" như một chiến pháp.
    if (value === UNRESOLVED_NAME) return {value:null,interactive:false};
    return {value,interactive:value !== unavailable()};
  }
  const missing=unavailable();
  let value=hasDisplay ? text(vi) : missing;
  if (value === missing && hasSource) value=text(raw);
  return {value,interactive:value !== missing};
};

/** Tên tướng của một ô: bản vi ưu tiên tên Việt, bản zh ưu tiên tên nguồn chữ Hán. */
const holderName=holder=>{
  const name=text(isZh() ? holder.nameRaw || holder.displayNameVi || '' : holder.displayNameVi || holder.nameRaw || '');
  // Rút gọn tên trên giao diện Việt; tên nguồn và danh tính cấu hình vẫn giữ nguyên.
  return isZh() ? name : name.replace(/^CO Vô Song (Đại Kiều|Tiểu Kiều|Tinh Thái)$/, 'CO $1');
};

/** Tên tướng đúng như trang hiển thị theo ngôn ngữ `locale` (dùng cho JSON-LD của trang đội, không phụ thuộc ngôn ngữ toàn cục). */
export const holderDisplayName=(holder,locale)=>withLocale(locale,()=>holderName(holder));

function holderNameNodes(holder) {
  return variantNameNodes(holderName(holder));
}

/** Nguồn để trống ô tướng (đội hai tướng, parser đệm ô thứ ba): không phải bản dịch còn thiếu. */
const isSourceEmpty=holder=>holder?.slotState === 'source-empty';
function sourceEmptySeat(className) {
  const label=L('Để trống','留空');
  return t('span',{class:`${className} source-empty-seat`,role:'img','aria-label':label,title:label},'—');
}

/** Ghi chú nguồn chỉ rõ chiến pháp nào phải dùng bản cải tạo; không đổi tên gốc dùng để tìm kiếm. */
export function modifiedTacticPrefix(raw, notes) {
  if (typeof raw !== 'string' || !raw.trim() || typeof notes !== 'string') return null;
  const escaped=raw.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=notes.match(new RegExp(`${escaped}\\s*(?:需)?改造為\\s*([精轉拓])\\s*[·・]\\s*${escaped}(?=$|[\\s，。；、【（(])`,'u'));
  return match ? ({精:['Tinh','精'],轉:['Chuyển','轉'],拓:['Thác','拓']})[match[1]] : null;
}

// Ô chiến pháp theo dữ liệu nguồn; tacticSlotKinds (nếu có) đánh dấu ô nào thực chất là duyên phận.
function tacticSlotEntries(holder) {
  const raw=holder.tacticSlotsRaw || [];
  const vi=holder.tacticSlotsVi || [];
  const kinds=holder.tacticSlotKinds || [];
  const length=Math.max(2,raw.length,vi.length);
  return Array.from({length},(_,index)=>{
    const slot=localizedSlot(raw[index],vi[index]);
    const prefix=kinds[index] === 'bond' ? null : modifiedTacticPrefix(raw[index],holder.notesRaw);
    return {
      ...slot,
      value:prefix && slot.value && slot.value !== unavailable()
        ? `${L(...prefix)} · ${slot.value}` : formatModifiedTactic(slot.value),
      searchValue:slot.value,
      raw:raw[index],
      rawLabel:prefix ? `${prefix[1]} · ${raw[index]}` : formatModifiedTactic(raw[index]),
      index,
      bond:kinds[index] === 'bond',
    };
  });
}


/** Vai trò viết tắt theo vị trí trong đội; `data-role` giữ khóa tiếng Việt cố định cho CSS. */
const HERO_ROLE_KEYS = ['CHỦ','PHÓ 1','PHÓ 2'];
/** Nhãn hiển thị của vai trò; artboard Main/MainTable dùng đúng ba nhãn này. */
const heroRoles = () => [L('CHỦ','主将'),L('PHÓ 1','副将1'),L('PHÓ 2','副将2')];

/**
 * Ô chiến pháp: giá trị đã bản địa hoá mới bấm được để tìm, còn lại chỉ hiển thị. Nút mang giá trị tìm
 * trong `data-tactic-search`; client gắn sự kiện bằng `bindTacticTags` sau `treeToDom`.
 */
function tacticTag(entry) {
  if (!entry.value) return null;
  return entry.interactive
    ? t('button',{type:'button',class:'tag t-tactic',title:L('Tìm chiến pháp này','搜索此战法'),dataset:{tacticSearch:entry.searchValue}},entry.value)
    : t('span',{class:'tag t-tactic'},entry.value);
}

/** Gắn sự kiện "tìm chiến pháp" cho mọi nút `data-tactic-search` trong `root`; `onTag(giá trị)` nhận chữ để tìm. */
export function bindTacticTags(root,onTag) {
  for (const button of root.querySelectorAll('button[data-tactic-search]')) {
    button.addEventListener('click',event=>{event.stopPropagation();onTag?.(button.dataset.tacticSearch);});
    enableControl(button);
  }
}

/**
 * Một dòng tướng của thẻ gọn: vai trò, tên, chiến pháp (nút tìm), binh thư dạng dòng.
 * Binh thư trống ghi một dòng nghiêng "Chưa ghi" thay cho ba tag "Chưa có dữ liệu".
 */
function holderView(holder,{index=0}={}) {
  const role=heroRoles()[index] || '';
  const dataset={role:HERO_ROLE_KEYS[index] || ''};
  if (isSourceEmpty(holder)) {
    return t('div',{class:'hero reference-holder',dataset},[
      t('span',{class:'reference-role'},role),
      t('div',{class:'hero-name'},sourceEmptySeat('hn')),
    ]);
  }
  const entries=tacticSlotEntries(holder);
  const bonds=entries.filter(entry=>entry.bond && entry.value);
  const tactics=entries.filter(entry=>!entry.bond).map(tacticTag).filter(Boolean);
  const books=Array.from({length:3},(_,slot)=>localizedSlot(holder.bookSlotsRaw?.[slot],holder.bookSlotsVi?.[slot]).value).filter(Boolean);
  return t('div',{class:'hero reference-holder',dataset},[
    t('span',{class:'reference-role'},role),
    t('div',{class:'hero-name'},holderNameNodes(holder)),
    tactics.length ? t('div',{class:'line tactics'},tactics) : null,
    bonds.length ? t('div',{class:'line bonds'},[
      t('span',{class:'slot-label'},L('Duyên phận:','缘分：')),
      ...bonds.map(entry=>t('span',{class:'tag t-bond'},entry.value)),
    ]) : null,
    t('p',{class:'line books'},books.length
      ? t('span',{class:'reference-book-values'},books.join(' · '))
      : t('span',{class:'reference-books-missing'},L('Chưa ghi','未注明'))),
  ]);
}

const noteParagraph=value=>{
  const note=prose(value);
  return note ? t('p',{class:'detail-note'},note) : null;
};
const fact=(cls,label,value)=>t('div',{class:cls},[t('dt',{},label),t('dd',{},value)]);

/**
 * Link hồ sơ Tra cứu của một ô chiến pháp / binh thư. `links` do build tính (`src/lib/team-detail-pages.ts`):
 * `{tactic:{khoá:id}, book:{khoá:id}}`, khoá là tên nguồn chữ Hán, thiếu thì tên Việt. Không có mã thì `null`.
 */
function lookupHref(links,kind,raw,vi) {
  const key=[raw,vi].map(value=>typeof value === 'string' ? value.trim() : '').find(Boolean);
  const table=links?.[kind];
  if (!key || !table || typeof table !== 'object' || !Object.hasOwn(table,key)) return null;
  const path=typeof table[key] === 'string' ? lookupItemPath(table[key]) : null;
  return path ? localePath(path) : null;
}

/** Nhãn hiển thị của một giá trị nguồn (phe, loại binh) từ `seasons.json`: own-property, chỉ nhận chuỗi. */
export function labelValue(labels,kind,raw) {
  if (typeof raw !== 'string' || !raw) return null;
  const table=labels?.[kind];
  if (!table || typeof table !== 'object') return null;
  const value=Object.hasOwn(table,raw) ? table[raw] : null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Nhãn phe / loại binh theo ngôn ngữ trang. Bản vi: nhãn Việt của registry, hoặc chính giá trị khi không
 * có chữ Hán. Bản zh: giá trị nguồn chữ Hán giữ nguyên, giá trị tiếng Việt của dữ liệu cũ đổi sang chữ Hán.
 */
function kindLabel(labels,kind,raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value=raw.trim();
  if (isZh()) return CJK.test(value) ? value : legacyLabelZh(kind,value) ?? null;
  return labelValue(labels,kind,value) || (CJK.test(value) ? null : value);
}

/** Mã màu phe (`nguy`/`thuc`/…) tra theo nhãn Việt, không phụ thuộc ngôn ngữ hiển thị. */
const factionCode=(labels,raw)=>FACTION_CODE[labelValue(labels,'faction',raw) ?? raw] || null;

/** Huy hiệu phe + loại binh của đầu trang chi tiết (mảng cây view); phần thiếu dữ liệu bỏ hẳn, không để ô trống. */
export function detailBadges(row,labels,{locale}={}) {
  return withLocale(locale,()=>badgeTrees(row,labels));
}

function badgeTrees(row,labels) {
  const nodes=[];
  const rawFaction=row?.factionRaw ?? row?.faction;
  const faction=kindLabel(labels,'faction',rawFaction);
  if (faction) {
    const code=factionCode(labels,rawFaction);
    nodes.push(t('span',{class:code ? `badge faction f-${code}` : 'badge faction'},faction));
  }
  for (const raw of (row?.unitTypesRaw?.length ? row.unitTypesRaw : (row?.unitType || []))) {
    const label=kindLabel(labels,'unit',raw);
    if (label) nodes.push(t('span',{class:'badge unit'},label));
  }
  return nodes;
}

/** Vai trò đầy đủ của thẻ tướng trên trang chi tiết (artboard TeamDetail). */
const detailHeroRoles=()=>[L('Chủ tướng','主将'),L('Phó tướng 1','副将1'),L('Phó tướng 2','副将2')];

const arrowIcon=()=>iconTree([svgTree('path',{d:'M9 6l6 6-6 6'})],{size:14,stroke:2});

/** Ô giá trị của thẻ: có hồ sơ Tra cứu thì là link, không có thì chỉ là chữ. */
const lookupItem=(cls,href,children)=>href
  ? t('a',{class:`${cls} is-link`,href,title:L('Mở trong Tra cứu','在图鉴查询中打开')},[...children,t('span',{class:`${cls}-go`,'aria-hidden':'true'},arrowIcon())])
  : t('span',{class:cls},children);

/** Tên hiển thị của chủ ghi chú: tên tướng theo ngôn ngữ trang. */
const holderLabel=(holder,{legacy=false}={})=>legacy ? text(holder?.name) : holderName(holder || {});

/**
 * Một thẻ tướng của trang chi tiết (artboard TeamDetail): đầu thẻ vai trò + chỉ số, tên, chiến pháp có số
 * thứ tự, duyên phận, binh thư. Chiến pháp / binh thư có hồ sơ Tra cứu thì là link. Chỉ một ngôn ngữ mỗi
 * trang: bản vi không kèm chữ Hán, bản zh không kèm tên Việt. Ghi chú tướng không nằm trong thẻ mà gom xuống
 * khối "Ghi chú" bên dưới (`detailNotes`).
 */
function detailHeroCard(holder,{role=null,level='h3',isMain=false,legacy=false,links=null}={}) {
  if (!legacy && isSourceEmpty(holder)) {
    return t('section',{class:'reference-detail-holder detail-hero-card is-empty'},[
      role ? t('header',{class:'detail-hero-head'},t('span',{class:'detail-hero-role'},role)) : null,
      t(level,{class:'detail-hero-name'},sourceEmptySeat('hn')),
    ].filter(Boolean));
  }
  const entries=legacy ? [] : tacticSlotEntries(holder);
  const tactics=legacy
    ? (holder.tactics || []).map(item=>({value:text(item.name),raw:null,vi:item.name})).filter(item=>item.value !== UNRESOLVED_NAME)
    : entries.filter(entry=>!entry.bond && entry.value).map(entry=>({value:entry.value,raw:entry.raw,vi:holder.tacticSlotsVi?.[entry.index]}));
  const bonds=legacy ? [] : entries.filter(entry=>entry.bond && entry.value);
  const books=legacy
    ? (holder.books || []).map(item=>({value:text(item.name),raw:null,vi:item.name})).filter(item=>item.value !== UNRESOLVED_NAME)
    : Array.from({length:3},(_,slot)=>{
      const raw=holder.bookSlotsRaw?.[slot];
      const vi=holder.bookSlotsVi?.[slot];
      const value=localizedSlot(raw,vi).value;
      return value ? {value,raw,vi} : null;
    }).filter(Boolean);
  const stat=legacy ? null : localizedSlot(holder.statFocusRaw,holder.statFocusVi);
  const statText=stat?.value
    ? (holder.statFocusKind === 'note' && stat.value !== unavailable() ? L(`Lưu ý: ${stat.value}`,`注意：${stat.value}`) : stat.value)
    : null;
  const missing=()=>t('p',{class:'detail-hero-missing'},L('Chưa có dữ liệu','暂无数据'));
  const tacticList=tactics.length
    ? t('ol',{class:'detail-hero-tactics'},tactics.map((item,index)=>t('li',{},lookupItem(
      'detail-hero-tactics-item',
      lookupHref(links,'tactic',item.raw,item.vi),
      [t('span',{class:'detail-hero-tactics-index','aria-hidden':'true'},String(index+1)),t('span',{class:'detail-hero-tactics-vi'},item.value)],
    ))))
    : missing();
  const bookList=books.length
    ? t('ul',{class:'detail-hero-books'},books.map(item=>t('li',{},lookupItem(
      'detail-hero-books-item',
      lookupHref(links,'book',item.raw,item.vi),
      [t('span',{class:'detail-hero-books-vi'},item.value)],
    ))))
    : missing();
  const block=(label,body,cls)=>t('div',{class:`detail-hero-block ${cls}`},[t('span',{class:'detail-hero-label'},label),body]);
  const head=[role ? t('span',{class:'detail-hero-role'},role) : null,statText ? t('span',{class:'detail-hero-stat'},statText) : null].filter(Boolean);
  const mainLabel=L('Chủ tướng','主将');
  return t('section',{class:`reference-detail-holder detail-hero-card${isMain ? ' is-main' : ''}`},[
    head.length ? t('header',{class:'detail-hero-head'},head) : null,
    t(level,{class:'detail-hero-name'},[
      ...(legacy ? [text(holder.name)] : holderNameNodes(holder)),
      isMain ? t('span',{class:'badge role main-holder',title:mainLabel,'aria-label':mainLabel},L('C','主')) : null,
    ]),
    block(L('Chiến pháp','战法'),tacticList,'detail-hero-tactics-block'),
    bonds.length ? t('div',{class:'detail-hero-block detail-hero-bonds'},[
      t('span',{class:'detail-hero-label'},L('Duyên phận','缘分')),
      t('span',{class:'detail-hero-bond-list'},bonds.map(entry=>t('span',{class:'tag t-bond'},entry.value))),
    ]) : null,
    block(L('Binh thư','兵书'),bookList,'detail-hero-books-block'),
  ].filter(Boolean));
}

/**
 * Khối "Ghi chú" dưới đội hình: ghi chú chung của đội rồi ghi chú từng tướng (nhãn tên tướng). Ghi chú văn
 * xuôi đi qua `prose` nên mỗi trang chỉ một ngôn ngữ. Không còn ghi chú nào thì không dựng khối.
 */
function detailNotes(teamNotes,holderNotes=[],{level='h2',names=holderNotes.map(note=>note.label)}={}) {
  const body=value=>heroMentionNodes(value,names);
  const items=[
    ...teamNotes.map(value=>prose(value)).filter(Boolean).map(value=>t('li',{class:'detail-note'},body(value))),
    ...holderNotes.flatMap(({label,values})=>values.map(value=>prose(value)).filter(Boolean).map(value=>t('li',{class:'detail-note detail-note-holder'},[
      label ? t('span',{class:'detail-note-owner'},label) : null,
      t('span',{class:'detail-note-text'},body(value)),
    ].filter(Boolean)))),
  ];
  if (!items.length) return null;
  return t('section',{class:'detail-section detail-notes'},[
    t(level,{class:'detail-notes-title'},L('Ghi chú','备注')),
    t('ul',{class:'detail-note-list'},items),
  ]);
}

const section=(title,children)=>{
  const items=[].concat(children).filter(Boolean);
  if (!items.length) return null;
  return t('section',{class:'detail-section'},[t('h2',{},title),...items]);
};

/** Bản zh: tên đội ghép từ tên tướng chữ Hán (tên/biệt danh đội cũ chỉ có bản tiếng Việt). */
const lineupTitle=holders=>(holders || [])
  .filter(holder=>holder && !isSourceEmpty(holder))
  .map(holder=>holder.displayNameVi !== undefined || holder.nameRaw !== undefined ? holderName(holder) : text(holder.name))
  .filter(name=>name !== UNRESOLVED_NAME)
  .join(' · ');

/**
 * Tên hàng danh sách: bản ghi đội chuẩn dùng tên đã bản địa hoá, đội gốc ưu tiên `nickname` trước `name`
 * (contract bước 6). Bản vi chỉ nhận chuỗi đã có tiếng Việt; bản zh dùng tên chữ Hán nguồn, đội gốc ghép tên tướng.
 */
function rowDisplayName(row) {
  if (isZh()) {
    const raw=[row.nameZh].find(value=>typeof value === 'string' && CJK.test(value));
    return raw ? raw.trim() : lineupTitle(row.heroes || row.holders) || unavailable();
  }
  const candidates=row.sourceConfigId
    ? [row.displayNameVi,row.nameZh,row.name,row.nickname]
    : [row.nickname,row.name,row.displayNameVi,row.nameZh];
  const safe=candidates.find(value=>typeof value === 'string' && value.trim() && !CJK.test(value));
  return safe ? safe.trim() : unavailable();
}

/** Nhãn phe hiển thị + mã màu phe (`nguy`/`thuc`/…/`none`) của một bản ghi đội. */
function factionOf(row,labels) {
  const raw=row.factionRaw ?? row.faction;
  return {label:kindLabel(labels,'faction',raw) ?? '',code:factionCode(labels,raw) || 'none'};
}

/** Dòng "■ phe · binh" của thẻ và ô đội của bảng: chỉ phần có dữ liệu, phần thiếu bỏ hẳn. */
function metaLine(row,labels) {
  const faction=factionOf(row,labels);
  const units=(row.unitTypesRaw?.length ? row.unitTypesRaw : (row.unit || []))
    .map(value=>kindLabel(labels,'unit',value))
    .filter(Boolean);
  const nodes=[];
  if (row.sourceConfigId && row.tierRaw) nodes.push(t('span',{class:'badge tier reference-tier',title:'Tier'},sourceTierLabel(row.tierRaw)));
  if (faction.label) nodes.push(t('span',{class:`reference-faction f-${faction.code}`},faction.label));
  if (units.length) nodes.push(t('span',{class:'reference-units'},units.join(' · ')));
  if (!nodes.length) return null;
  return t('p',{class:'reference-meta'},nodes.flatMap((node,index)=>index ? [' · ',node] : [node]));
}

// Điểm giữ đúng độ chính xác của dữ liệu; thiếu điểm là ô ấn trống "—" (không phải 0) cùng khuôn với
// ô có điểm, để thẻ Đội chuẩn và Đội khác chung một bố cục đầu thẻ.
const scoreBadge=row=>row.value != null
  ? t('span',{class:'reference-score-wrap'},[
    t('span',{class:'badge score reference-score',title:L('Điểm','评分')},String(row.value)),
    ' ',
    t('span',{class:'reference-score-unit'},L('điểm','分')),
  ])
  : t('span',{class:'reference-score-wrap is-missing',title:L('Chưa có điểm','暂无评分')},[
    t('span',{class:'badge score reference-score missing-score','aria-hidden':'true'},'—'),
    t('span',{class:'visually-hidden'},L('Chưa có điểm','暂无评分')),
    t('span',{class:'reference-score-unit','aria-hidden':'true'},L('điểm','分')),
  ]);

/** Tên các phương án thay thế của dữ liệu cũ; bản zh chỉ giữ tên đổi được sang chữ Hán. */
const alternativeNames=values=>(values || []).map(zhResolved).filter(Boolean);

function legacyAlternativeLines(content) {
  return (content?.heroes || []).flatMap(hero=>[
    ...alternativeNames(hero.alternatives).map(value=>[hero.name,L('Tướng thay','替换武将'),value]),
    ...(hero.tactics || []).flatMap(item=>alternativeNames(item.alternatives).map(value=>[hero.name,L(`Chiến pháp ${item.name}`,`战法 ${zhResolved(item.name) ?? ''}`.trim()),value])),
    ...(hero.books || []).flatMap(item=>alternativeNames(item.alternatives).map(value=>[hero.name,L(`Binh thư ${item.name}`,`兵书 ${zhResolved(item.name) ?? ''}`.trim()),value])),
  ].map(([owner,label,value])=>t('p',{class:'alternative-line'},`${text(owner)} · ${label}: ${value}`)));
}

/** Phương án thay thế đầy đủ nhưng thu gọn trong disclosure có nhãn và số lượng. */
function alternativesDisclosure(row) {
  const holders=row.alternativeHoldersRaw || [];
  const nodes=holders.length ? holders.map((holder,index)=>holderView(holder,{index})) : legacyAlternativeLines(row.legacyContent);
  if (!nodes.length) return null;
  return t('details',{class:'reference-alternatives'},[
    t('summary',{},L(`Thay thế (${nodes.length})`,`替换方案（${nodes.length}）`)),
    t('div',{class:'alternative-body'},nodes),
  ]);
}

/** Nhãn "Sợ …" lấy từ counters `avoid` của nội dung đội gốc đã đối chiếu; đội không có thì bỏ dòng. */
function fearLine(row) {
  const contents=[row.legacyContent,...(row.legacyReferences || []).map(reference=>reference.legacyContent)].filter(Boolean);
  const values=[...new Set(contents.flatMap(content=>alternativeNames(content.counters?.avoid)))];
  if (!values.length) return null;
  return t('p',{class:'reference-fear'},[t('strong',{},L('Sợ','怕')),' ',values.join(' · ')]);
}

const detailHrefFor=(href,children,cls)=>href
  ? t('a',{class:cls,href,dataset:{teamDetailLink:''}},children)
  : t('span',{class:cls},children);

/** Khóa danh tính của một đội trong danh sách (`data-reference-key` của thẻ và hàng bảng). */
export const referenceRowKey=row=>row.sourceConfigId || row.legacyVariantId || row.legacyTeamId || '';

/** Title và CTA là link thật tới cùng href; click có modifier vẫn là hành vi trình duyệt.
 *  `data-faction-code` tô gáy thẻ theo màu phe (trang trí; tên phe vẫn là chữ trong dòng meta).
 *  Trả cây view; chip chiến pháp bấm được mang `data-tactic-search` (`bindTacticTags`). `locale` ép ngôn ngữ
 *  khi dựng ngoài trình duyệt. */
export function recommendedTeamCard(row,{href,labels,locale}={}) {
  return withLocale(locale,()=>teamCardTree(row,href,labels));
}

function teamCardTree(row,href,labels) {
  const name=rowDisplayName(row);
  const fear=fearLine(row);
  return t('article',{class:'team-card reference-team-card',dataset:{referenceKey:referenceRowKey(row),sourceConfigId:row.sourceConfigId || '',legacyTeamId:row.legacyTeamId || '',faction:row.factionRaw || row.faction || '',factionCode:factionOf(row,labels).code}},[
    t('header',{class:'reference-card-head'},[
      t('div',{class:'reference-card-title'},[
        t('h3',{class:'team-name'},href ? t('a',{href,dataset:{teamDetailLink:''}},name) : name),
        metaLine(row,labels),
      ]),
      scoreBadge(row),
    ]),
    t('div',{class:'heroes'},(row.heroes || row.holders || []).map((holder,index)=>holderView(holder,{index}))),
    alternativesDisclosure(row),
    t('footer',{class:'reference-card-foot'},[
      fear,
      href ? t('a',{class:'ana-link-btn',href,dataset:{teamDetailLink:''}},[L('Chi tiết','详情'),iconTree([svgTree('line',{x1:5,y1:12,x2:19,y2:12}),svgTree('polyline',{points:'13 6 19 12 13 18'})],{size:16})]) : null,
    ].filter(Boolean)),
  ]);
}

/** Nguồn Cùng Tồn ghi biến thể 40 năm dạng hậu tố ("Lữ Bố 40th"): đưa về tiền tố `40Y` để dùng chung chip biến thể. */
const coexistHeroName=name=>String(name ?? '').replace(/^(.+?)\s*40th$/iu,'40Y $1');

/**
 * Thẻ một đội Cùng Tồn (cây view): cùng khung và dòng tướng (vai trò · tên · chiến pháp · binh thư) với thẻ Đội chuẩn.
 * `team` đã bản địa hoá (`coexistGroupModel` của render.js): `{name, level, unitTacticEffects, heroes:[{name, tag,
 * tactics, books, statFocus, advisorSkill}]}`; chiến pháp chỉ hiển thị, không bấm tìm như Đội chuẩn.
 */
export function coexistTeamCard(team,{locale}={}) {
  return withLocale(locale,()=>coexistCardTree(team));
}

function coexistCardTree(team) {
  const meta=[
    team.level ? t('span',{class:'badge tier reference-tier',title:L('Cấp độ đội','阵容等级')},team.level) : null,
    team.unitTacticEffects ? t('span',{class:'coexist-card-upgrade'},L(`Cải tạo: ${team.unitTacticEffects}`,`改造：${team.unitTacticEffects}`)) : null,
  ].filter(Boolean);
  return t('article',{class:'team-card reference-team-card coexist-team-card',dataset:{factionCode:'none'}},[
    t('header',{class:'reference-card-head'},[
      t('div',{class:'reference-card-title'},[
        t('h3',{class:'team-name'},team.name),
        meta.length ? t('p',{class:'reference-meta'},meta.flatMap((node,index)=>index ? [' · ',node] : [node])) : null,
      ]),
    ]),
    t('div',{class:'heroes'},(team.heroes || []).map((hero,index)=>{
      const extra=[
        hero.statFocus ? `+ ${hero.statFocus}` : null,
        hero.advisorSkill ? L(`QS: ${hero.advisorSkill}`,`军师：${hero.advisorSkill}`) : null,
      ].filter(Boolean);
      return t('div',{class:'hero reference-holder',dataset:{role:HERO_ROLE_KEYS[index] || ''}},[
        t('span',{class:'reference-role'},heroRoles()[index] || ''),
        t('div',{class:'hero-name'},variantNameNodes(coexistHeroName(hero.name))),
        hero.tactics.length ? t('div',{class:'line tactics'},hero.tactics.map(value=>t('span',{class:'tag t-tactic'},value))) : null,
        t('p',{class:'line books'},hero.books.length
          ? t('span',{class:'reference-book-values'},hero.books.join(' · '))
          : t('span',{class:'reference-books-missing'},L('Chưa ghi','未注明'))),
        hero.tag || extra.length ? t('p',{class:'line books coexist-hero-extra'},[
          hero.tag ? t('span',{class:'coexist-hero-tag'},hero.tag) : null,
          extra.join(' · '),
        ].filter(Boolean)) : null,
      ].filter(Boolean));
    })),
  ]);
}

const tableCell=(children,cls)=>t('td',{class:cls},children);

/** Ô tướng của bảng: tên (kèm nhãn biến thể) + chiến pháp chữ son; thiếu chỗ thì "—". */
function tableHeroCell(holder) {
  if (!holder) return tableCell('—','reference-table-hero');
  if (isSourceEmpty(holder)) return tableCell(sourceEmptySeat('reference-table-holder'),'reference-table-hero');
  const tactics=tacticSlotEntries(holder).filter(entry=>!entry.bond && entry.value).map(entry=>entry.value);
  return tableCell([
    t('span',{class:'reference-table-holder'},holderNameNodes(holder)),
    ...tactics.map(value=>t('span',{class:'reference-table-tactic'},value)),
  ],'reference-table-hero');
}

/**
 * Bảng 5 cột dùng chung cho cả hai nguồn: Recommended đọc `displayNameVi`/`heroes`/`tacticSlotsVi`/`value`,
 * đội gốc đọc `nickname || name`/`holders` và điểm vắng là "—" (không bịa 0).
 * Hàng mang `data-reference-key` để test bám danh tính bản ghi, không bám số lượng.
 */
export function recommendedTeamTable(rows,{hrefFor,labels,locale}={}) {
  return withLocale(locale,()=>{
    const head=t('tr',{},[
      t('th',{scope:'col',class:'reference-table-team'},L('Đội','队伍')),
      t('th',{scope:'col'},L('Chủ tướng','主将')),
      t('th',{scope:'col'},L('Phó 1','副将1')),
      t('th',{scope:'col'},L('Phó 2','副将2')),
      t('th',{scope:'col',class:'reference-table-score-head'},L('Điểm','评分')),
    ]);
    return t('table',{class:'reference-table'},[t('thead',{},head),t('tbody',{},rows.map(row=>tableRowTree(row,hrefFor,labels)))]);
  });
}

/** Một hàng của bảng; danh sách dựng theo lượt nối thêm hàng vào `tbody` sẵn có. */
export function recommendedTeamTableRow(row,{hrefFor,labels,locale}={}) {
  return withLocale(locale,()=>tableRowTree(row,hrefFor,labels));
}

function tableRowTree(row,hrefFor,labels) {
  const href=hrefFor?.(row);
  const name=rowDisplayName(row);
  const holders=(row.heroes || row.holders || []).slice(0,3);
  const lineup=holders.filter(holder=>!isSourceEmpty(holder)).map(holderName).filter(Boolean).join(' · ');
  return t('tr',{dataset:{referenceKey:referenceRowKey(row)}},[
    t('th',{scope:'row',class:'reference-table-team'},[
      detailHrefFor(href,name,'reference-table-name'),
      metaLine(row,labels),
      t('span',{class:'reference-table-lineup'},lineup),
    ]),
    ...Array.from({length:3},(_,index)=>tableHeroCell(holders[index])),
    tableCell(row.value != null ? String(row.value) : '—','reference-table-score'),
  ]);
}

/** Một mục của danh sách đội: thẻ (hai chế độ thẻ) hoặc hàng bảng. */
export function teamItemTree(row,mode,{hrefFor,labels,locale}={}) {
  return mode===TEAM_VIEW_TABLE
    ? recommendedTeamTableRow(row,{hrefFor,labels,locale})
    : recommendedTeamCard(row,{href:hrefFor?.(row),labels,locale});
}

/** Khối các mục: bảng trong khung, hoặc lưới thẻ (`luoi` là lưới gọn). */
function teamRowsTree(items,mode,{hrefFor,labels,locale}={}) {
  return mode===TEAM_VIEW_TABLE
    ? t('div',{class:'reference-table-frame'},recommendedTeamTable(items,{hrefFor,labels,locale}))
    : t('div',{class:mode===TEAM_VIEW_GRID?'team-grid team-grid-dense':'team-grid'},items.map(row=>teamItemTree(row,mode,{hrefFor,labels,locale})));
}

/** Tier của một đội; đội chưa xếp hạng thuộc nhóm `unranked`. */
export const tierOf=row=>row.tierRaw || 'unranked';

/** Nhóm theo Tier, giữ nguyên thứ tự projector (đã xếp theo Tier nguồn và điểm). */
export function groupRowsByTier(items) {
  const groups=new Map();
  for (const row of items) {
    if (!groups.has(tierOf(row))) groups.set(tierOf(row),[]);
    groups.get(tierOf(row)).push(row);
  }
  return groups;
}

/** Một nhóm Tier; `total` là số đội của nhóm trên toàn bộ danh sách đã lọc, không chỉ lượt đang hiện. */
export function tierSectionTree(tier,items,{index,total,mode,mountId,hrefFor,labels,locale}) {
  return withLocale(locale,()=>{
    const label=tier==='unranked' ? L('Chưa xếp hạng','未评级') : sourceTierLabel(tier);
    const headingId=`${mountId}-tier-heading-${index}`;
    return t('section',{class:'reference-tier-section',dataset:{tier},'aria-labelledby':headingId},[
      t('h2',{class:'reference-tier-heading',id:headingId},[
        t('span',{},label),
        t('span',{class:'reference-tier-count'},L(` · ${total} đội`,` · ${total} 队`)),
      ]),
      teamRowsTree(items,mode,{hrefFor,labels,locale}),
    ]);
  });
}

/**
 * Phần thân danh sách đội (cây view) của `rows` đã lọc: Đội chuẩn nhóm theo Tier, Đội khác một khối. Chỉ dựng
 * `limit` đội đầu (mặc định tất cả); số đội của từng nhóm Tier vẫn đếm trên toàn bộ `rows`.
 */
export function recommendedListTrees(rows,{family,mode,limit=rows.length,labels,hrefFor,mountId,locale}={}) {
  const visible=rows.slice(0,limit);
  if (family!=='recommended') return [teamRowsTree(visible,mode,{hrefFor,labels,locale})];
  return [...groupRowsByTier(visible)].map(([tier,items],index)=>tierSectionTree(tier,items,{
    index,mode,mountId,hrefFor,labels,locale,
    total:rows.filter(row=>tierOf(row)===tier).length,
  }));
}

function notesByOwner(record) {
  const blocks=record.displayNotes?.blocks;
  if (!Array.isArray(blocks)) {
    return {team:[unavailable()],primary:new Map(),alternative:new Map(),projected:false};
  }
  const team=[];
  const primary=new Map();
  const alternative=new Map();
  for (const block of blocks) {
    // Bản zh dùng nguyên văn nguồn (`textRaw`), bản vi dùng bản dịch (`textVi`).
    const value=(isZh() ? block?.textRaw : block?.textVi) || unavailable();
    const bucket=block.owner === 'primary' ? primary : block.owner === 'alternative' ? alternative : null;
    if (!bucket) { team.push(value); continue; }
    const index=Number.isInteger(block.holderIndex) ? block.holderIndex : -1;
    if (index < 0) { team.push(value); continue; }
    bucket.set(index,[...(bucket.get(index) || []),value]);
  }
  return {team,primary,alternative,projected:true};
}

function legacyContentSections(content,{title,provenance=[],links=null}={}) {
  const counters=content.counters || {};
  const counterList=(values,cls)=>t('ul',{class:'counters'},values.map(value=>t('li',{class:`chip ${cls}`},String(value))));
  const good=alternativeNames(counters.good);
  const avoid=alternativeNames(counters.avoid);
  const heroAlternatives=(content.heroes || []).flatMap(hero=>{
    const heroNames=alternativeNames(hero.alternatives);
    const rows=[
      heroNames.length ? fact('legacy-hero-alternatives',L('Tướng thay thế','替换武将'),heroNames.join(' · ')) : null,
      ...(hero.tactics || []).filter(item=>alternativeNames(item.alternatives).length).map(item=>fact('legacy-tactic-alternatives',L(`Chiến pháp ${item.name}`,`战法 ${zhResolved(item.name) ?? ''}`.trim()),alternativeNames(item.alternatives).join(' · '))),
      ...(hero.books || []).filter(item=>alternativeNames(item.alternatives).length).map(item=>fact('legacy-book-alternatives',L(`Binh thư ${item.name}`,`兵书 ${zhResolved(item.name) ?? ''}`.trim()),alternativeNames(item.alternatives).join(' · '))),
    ].filter(Boolean);
    return rows.length ? [t('section',{class:'legacy-alternative-group'},[t('h3',{},text(hero.name)),t('dl',{class:'detail-facts'},rows)])] : [];
  });
  const heroCards=(content.heroes || []).map((hero,index)=>detailHeroCard({
    name: hero.name, tactics: hero.tactics, books: hero.books,
  },{isMain: index === 0, legacy: true, links}));
  const heroNotes=(content.heroes || []).filter(hero=>hero.note).map(hero=>({label:holderLabel(hero,{legacy:true}),values:[hero.note]}));
  return [
    title ? t('h3',{class:'legacy-content-title'},title) : null,
    ...provenance,
    section(L('Cấu hình gốc','原始配置'),heroCards.length ? t('div',{class:'detail-hero-grid'},heroCards) : null),
    detailNotes([],heroNotes,{names:(content.heroes || []).map(hero=>holderLabel(hero,{legacy:true}))}),
    section(L('Mô tả & cách vận hành','说明与玩法'),content.notes ? noteParagraph(content.notes) : null),
    section(L('Khắc chế','克制关系'),[
      good.length ? t('div',{class:'counter-group'},[t('h3',{},L('Khắc chế tốt','克制')),counterList(good,'good')]) : null,
      avoid.length ? t('div',{class:'counter-group'},[t('h3',{},L('Nên tránh','应避开')),counterList(avoid,'avoid')]) : null,
    ].filter(Boolean)),
    section(L('Phương án thay thế','替换方案'),heroAlternatives),
  ].filter(Boolean);
}

/** Tiêu đề đội gốc: bản vi dùng biệt danh/tên đội, bản zh ghép tên tướng chữ Hán. */
const legacyTitle=(content,fallback)=>isZh()
  ? lineupTitle(content.heroes) || fallback
  : content.nickname || content.name || fallback;

/** Nội dung chi tiết Team chuẩn cho trang riêng; trả mảng cây view (các section), không tự tạo article/h1. */
export function recommendedTeamDetailContent(record,{legacyTeams=[],labels=null,lookupLinks=null,locale}={}) {
  return withLocale(locale,()=>recommendedDetailTrees(record,{legacyTeams,lookupLinks}));
}

function recommendedDetailTrees(record,{legacyTeams,lookupLinks}) {
  const out=[];
  const notes=notesByOwner(record);
  const holders=record.heroes || record.holders || [];
  const alternatives=record.alternativeHoldersRaw || [];
  const roles=detailHeroRoles();
  const links=lookupLinks;

  const heroCards=holders.map((holder,index)=>detailHeroCard(holder,{
    role:roles[index] || null,
    isMain:index===0,
    links,
  }));
  if (heroCards.length) out.push(section(L('Đội hình','阵容'),t('div',{class:'detail-hero-grid'},heroCards)));
  // Ghi chú đội + ghi chú từng tướng gom về một khối dưới đội hình, không nằm trong thẻ tướng.
  const holderNotes=(owners,bucket,offset=0)=>owners.map((holder,position)=>({
    label:isSourceEmpty(holder) ? null : holderLabel(holder),
    values:notes.projected ? bucket.get(offset+position) || [] : [],
  }));
  const lineupNames=[...holders,...alternatives].filter(holder=>!isSourceEmpty(holder)).map(holder=>holderLabel(holder));
  const teamNotes=detailNotes(notes.team,holderNotes(holders,notes.primary),{names:lineupNames});
  if (teamNotes) out.push(teamNotes);

  const groups=Array.from({length:Math.ceil(alternatives.length/3)},(_,index)=>{
    const slice=alternatives.slice(index*3,index*3+3);
    return t('section',{class:'reference-alternative-group'},[
      t('h3',{},L(`Cấu hình thay thế ${index+1}`,`替换配置 ${index+1}`)),
      t('div',{class:'detail-hero-grid'},slice.map((holder,position)=>detailHeroCard(holder,{
        level:'h4',
        role:roles[position] || null,
        isMain:position===0,
        links,
      }))),
      detailNotes([],holderNotes(slice,notes.alternative,index*3),{level:'h4',names:lineupNames}),
    ].filter(Boolean));
  });
  const alternativeSection=section(L('Cấu hình thay thế','替换配置'),groups);
  if (alternativeSection) out.push(alternativeSection);

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
    const provenance=references.map(reference=>t('div',{class:'legacy-provenance'},[
      t('p',{class:'scope-note'},L(
        `Đội gốc: ${reference.legacyTeamId}${reference.legacyVariantId ? ` · biến thể ${reference.legacyVariantId}` : ''}`,
        `原始队伍：${reference.legacyTeamId}${reference.legacyVariantId ? ` · 变体 ${reference.legacyVariantId}` : ''}`,
      )),
      t('p',{class:'scope-note'},L(
        `Bằng chứng rà soát: ${reference.evidenceRef || 'Chưa ghi'} · ${reference.legacyContentSha256 || ''}`,
        `核对依据：${reference.evidenceRef || '未注明'} · ${reference.legacyContentSha256 || ''}`,
      )),
      // Route chưa đăng ký trả `null`: giữ link không href, không để `localePath(null)` thành "/".
      t('p',{class:'detail-link-row'},t('a',{class:'detail-link',href:(path=>path ? localePath(path) : null)(teamDetailPath({legacyTeamId:reference.legacyTeamId}))},L('Xem trang đội gốc','查看原始队伍页面'))),
    ]));
    out.push(t('section',{class:'detail-section legacy-reference'},[
      t('h2',{},L('Nội dung đội gốc đã đối chiếu','已核对的原始队伍内容')),
      ...legacyContentSections(localizedContent,{
        title:legacyTitle(localizedContent,first.legacyTeamId),
        provenance,
        links,
      }),
    ]));
  }

  const seasonValue=isZh()
    ? record.sourceSeasonCode || record.sourceSeasonId
    : [record.sourceSeasonCode || record.sourceSeasonId,record.sourceSeasonNameVi].filter(Boolean).join(' · ');
  const categoryValue=isZh() ? record.sourceCategoryId : record.sourceCategoryNameVi || record.sourceCategoryId;
  out.push(t('section',{class:'detail-section detail-source'},[
    t('h2',{},L('Phạm vi','范围')),
    t('dl',{class:'detail-facts'},[
      seasonValue ? fact('source-season',L('Mùa','赛季'),seasonValue) : null,
      categoryValue ? fact('source-category',L('Danh mục','分类'),categoryValue) : null,
    ].filter(Boolean)),
    record.introRaw ? noteParagraph(record.introRaw) : null,
  ].filter(Boolean)));
  return out;
}

/** Loại binh gốc của đội cũ (`"Thương(★★★★)"`, `"Kỵ/Cung(…)"`): bản zh đổi từng tên binh sang chữ Hán, giữ phần sao. */
const rawTypeLabel=value=>isZh()
  ? String(value).replace(/^[^(（]+/u,names=>names.split('/').map(name=>unitLabel(name.trim())).join('/'))
  : value;

/** Nội dung đội gốc; dùng cho trang original và cho biến thể đã được admit. */
export function legacyOriginalDetailContent(team,{variant,locale}={}) {
  return withLocale(locale,()=>legacyOriginalTrees(team,variant));
}

function legacyOriginalTrees(team,variant) {
  const out=[...legacyContentSections(team,{})];
  out.push(t('section',{class:'detail-section detail-source'},[
    t('h2',{},L('Phạm vi','范围')),
    t('dl',{class:'detail-facts'},[
      fact('source-legacy-id',L('Mã đội gốc','原始队伍编号'),t('code',{translate:'no'},team.id || L('Chưa có','暂无'))),
      fact('source-label',L('Bộ đội hình','阵容合集'),team.source ? sourceLabel(team.source) : L('Chưa xác định','不明')),
      team.rawType ? fact('source-raw-type',L('Loại binh gốc','原始兵种'),rawTypeLabel(team.rawType)) : null,
      variant ? fact('source-variant',L('Biến thể đã đối chiếu','已核对的变体'),t('code',{translate:'no'},variant.legacyVariantId)) : null,
      variant?.legacyContentSha256 ? fact('source-variant-proof',L('Vân tay nội dung','内容指纹'),t('code',{translate:'no'},variant.legacyContentSha256)) : null,
    ].filter(Boolean)),
  ]));
  return out;
}
