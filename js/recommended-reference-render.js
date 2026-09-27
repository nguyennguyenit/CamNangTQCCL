import { el, icon, svgNode, FACTION_CODE, UNRESOLVED_NAME, formatModifiedTactic, sourceLabel, unitLabel } from './render.js';
import { legacyLabelZh, sourceTierLabel, sourceName, validateReferenceSourceUrl } from './recommended-reference-state.js';
import { teamDetailPath } from './team-detail-navigation.js';
import { L, currentLocale, localePath } from './i18n.js';

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

const VARIANT_CLASS={SP:'sp',CO:'co','40Y':'y40'};

/** Tên tướng của một ô: bản vi ưu tiên tên Việt, bản zh ưu tiên tên nguồn chữ Hán. */
const holderName=holder=>{
  const name=text(isZh() ? holder.nameRaw || holder.displayNameVi || '' : holder.displayNameVi || holder.nameRaw || '');
  // Rút gọn tên trên giao diện Việt; tên nguồn và danh tính cấu hình vẫn giữ nguyên.
  return isZh() ? name : name.replace(/^CO Vô Song (Đại Kiều|Tiểu Kiều|Tinh Thái)$/, 'CO $1');
};

function holderNameNodes(holder) {
  const value=holderName(holder);
  // Accept a separate prefix or one attached to Chinese text, never part of a Latin name.
  const match=value.match(/^(SP|CO|40Y)(?:\s+|(?=[\u3400-\u9fff]))(.+)$/u);
  if (!match) return [el('span',{class:'hn'},value)];
  return [
    el('span',{class:`pre ${VARIANT_CLASS[match[1]]}`},match[1]),
    ' ',
    el('span',{class:'hn'},match[2].trim()),
  ];
}

/** Nguồn để trống ô tướng (đội hai tướng, parser đệm ô thứ ba): không phải bản dịch còn thiếu. */
const isSourceEmpty=holder=>holder?.slotState === 'source-empty';
function sourceEmptySeat(className) {
  const label=L('Nguồn để trống','来源留空');
  return el('span',{class:`${className} source-empty-seat`,role:'img','aria-label':label,title:label},'—');
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

/** Ô chiến pháp: giá trị đã bản địa hoá mới bấm được để tìm, còn lại chỉ hiển thị. */
function tacticTag(entry,onTag) {
  if (!entry.value) return null;
  return entry.interactive
    ? el('button',{type:'button',class:'tag t-tactic',title:L('Tìm chiến pháp này','搜索此战法'),onClick:event=>{event.stopPropagation();onTag?.(entry.searchValue);}},entry.value)
    : el('span',{class:'tag t-tactic'},entry.value);
}

/**
 * Một dòng tướng của thẻ gọn: vai trò, tên, chiến pháp (nút tìm), binh thư dạng dòng.
 * Binh thư trống ghi một dòng nghiêng "Nguồn chưa ghi" thay cho ba tag "Chưa có dữ liệu".
 */
function holderView(holder,onTag,{index=0}={}) {
  const role=heroRoles()[index] || '';
  const dataset={role:HERO_ROLE_KEYS[index] || ''};
  if (isSourceEmpty(holder)) {
    return el('div',{class:'hero reference-holder',dataset},[
      el('span',{class:'reference-role'},role),
      el('div',{class:'hero-name'},sourceEmptySeat('hn')),
    ]);
  }
  const entries=tacticSlotEntries(holder);
  const bonds=entries.filter(entry=>entry.bond && entry.value);
  const tactics=entries.filter(entry=>!entry.bond).map(entry=>tacticTag(entry,onTag)).filter(Boolean);
  const books=Array.from({length:3},(_,slot)=>localizedSlot(holder.bookSlotsRaw?.[slot],holder.bookSlotsVi?.[slot]).value).filter(Boolean);
  return el('div',{class:'hero reference-holder',dataset},[
    el('span',{class:'reference-role'},role),
    el('div',{class:'hero-name'},holderNameNodes(holder)),
    tactics.length ? el('div',{class:'line tactics'},tactics) : null,
    bonds.length ? el('div',{class:'line bonds'},[
      el('span',{class:'slot-label'},L('Duyên phận:','缘分：')),
      ...bonds.map(entry=>el('span',{class:'tag t-bond'},entry.value)),
    ]) : null,
    el('p',{class:'line books'},books.length
      ? el('span',{class:'reference-book-values'},books.join(' · '))
      : el('span',{class:'reference-books-missing'},L('Nguồn chưa ghi','来源未注明'))),
  ]);
}

const noteParagraph=value=>{
  const note=prose(value);
  return note ? el('p',{class:'detail-note'},note) : null;
};
const fact=(cls,label,value)=>el('div',{class:cls},[el('dt',{},label),el('dd',{},value)]);

/** Chữ Hán nguồn chỉ hiển thị như chữ phụ ở bản vi; bản zh đã lấy chữ Hán làm chữ chính nên bỏ. */
const hanText=value=>!isZh() && typeof value === 'string' && CJK.test(value) ? value.trim() : null;

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

/** Huy hiệu phe + loại binh của đầu trang chi tiết; phần thiếu dữ liệu bỏ hẳn, không để ô trống. */
export function detailBadges(row,labels) {
  const nodes=[];
  const rawFaction=row?.factionRaw ?? row?.faction;
  const faction=kindLabel(labels,'faction',rawFaction);
  if (faction) {
    const code=factionCode(labels,rawFaction);
    nodes.push(el('span',{class:code ? `badge faction f-${code}` : 'badge faction'},faction));
  }
  for (const raw of (row?.unitTypesRaw?.length ? row.unitTypesRaw : (row?.unitType || []))) {
    const label=kindLabel(labels,'unit',raw);
    if (label) nodes.push(el('span',{class:'badge unit'},label));
  }
  return nodes;
}

/** Vai trò đầy đủ của thẻ tướng trên trang chi tiết (artboard TeamDetail). */
const detailHeroRoles=()=>[L('Chủ tướng','主将'),L('Phó tướng 1','副将1'),L('Phó tướng 2','副将2')];

/**
 * Một thẻ tướng của trang chi tiết (artboard TeamDetail): đầu thẻ vai trò + chỉ số, tên Việt và tên Trung,
 * chiến pháp có số thứ tự, duyên phận, binh thư hai cột, ghi chú đúng chủ sở hữu.
 * Dữ liệu thiếu thì bỏ phần đó; ô rỗng chỉ hiện nhãn "Chưa có dữ liệu" khi cả nguồn lẫn bản dịch đều trống.
 */
function detailHeroCard(holder,{role=null,level='h3',isMain=false,notes=[],legacy=false}={}) {
  if (!legacy && isSourceEmpty(holder)) {
    return el('section',{class:'reference-detail-holder detail-hero-card'},[
      role ? el('header',{class:'detail-hero-head'},el('span',{class:'detail-hero-role'},role)) : null,
      el(level,{class:'detail-hero-name'},sourceEmptySeat('hn')),
    ].filter(Boolean));
  }
  const entries=legacy ? [] : tacticSlotEntries(holder);
  const tactics=legacy
    ? (holder.tactics || []).map(item=>({value:text(item.name),zh:null})).filter(item=>item.value !== UNRESOLVED_NAME)
    : entries.filter(entry=>!entry.bond && entry.value).map(entry=>({value:entry.value,zh:hanText(entry.rawLabel)}));
  const bonds=legacy ? [] : entries.filter(entry=>entry.bond && entry.value);
  const books=legacy
    ? (holder.books || []).map(item=>({value:text(item.name),zh:null})).filter(item=>item.value !== UNRESOLVED_NAME)
    : Array.from({length:3},(_,slot)=>{
      const raw=holder.bookSlotsRaw?.[slot];
      const value=localizedSlot(raw,holder.bookSlotsVi?.[slot]).value;
      return value ? {value,zh:hanText(raw)} : null;
    }).filter(Boolean);
  const stat=legacy ? null : localizedSlot(holder.statFocusRaw,holder.statFocusVi);
  const statText=stat?.value
    ? (holder.statFocusKind === 'note' && stat.value !== unavailable() ? L(`Lưu ý: ${stat.value}`,`注意：${stat.value}`) : stat.value)
    : null;
  const zh=legacy ? null : hanText(holder.nameRaw);
  /**
   * Danh sách ô giá trị của thẻ: chiến pháp là `ol` có số thứ tự (artboard), binh thư là `ul` hai cột
   * "tên Việt · chữ Hán" không có số trang trí.
   */
  const pips=(items,cls,{stacked=true,ordinal=true}={})=>items.length
    ? el(ordinal ? 'ol' : 'ul',{class:cls},items.map((item,index)=>{
      const value=[
        el('span',{class:`${cls}-vi`},item.value),
        item.zh ? el('span',{class:`${cls}-zh`,lang:'zh-Hant'},item.zh) : null,
      ].filter(Boolean);
      return el('li',{class:`${cls}-item`},[
        ordinal ? el('span',{class:`${cls}-index`,'aria-hidden':'true'},String(index+1)) : null,
        ...(stacked ? [el('span',{class:`${cls}-text`},value)] : value),
      ].filter(Boolean));
    }))
    : el('p',{class:'detail-hero-missing'},L('Chưa có dữ liệu','暂无数据'));
  const block=(label,body,cls='')=>el('div',{class:`detail-hero-block ${cls}`.trim()},[el('span',{class:'detail-hero-label'},label),body]);
  const head=[role ? el('span',{class:'detail-hero-role'},role) : null,statText ? el('span',{class:'detail-hero-stat'},statText) : null].filter(Boolean);
  const mainLabel=L('Chủ tướng','主将');
  return el('section',{class:'reference-detail-holder detail-hero-card'},[
    head.length ? el('header',{class:'detail-hero-head'},head) : null,
    el(level,{class:'detail-hero-name'},[
      ...(legacy ? [text(holder.name)] : holderNameNodes(holder)),
      isMain ? el('span',{class:'badge role main-holder',title:mainLabel,'aria-label':mainLabel},L('C','主')) : null,
    ]),
    zh ? el('span',{class:'detail-hero-zh',lang:'zh-Hant'},zh) : null,
    block(L('Chiến pháp','战法'),pips(tactics,'detail-hero-tactics'),'detail-hero-tactics-block'),
    bonds.length ? el('div',{class:'detail-hero-block detail-hero-bonds'},[
      el('span',{class:'detail-hero-label'},L('Duyên phận','缘分')),
      el('span',{class:'detail-hero-bond-list'},bonds.map(entry=>el('span',{class:'tag t-bond'},entry.value))),
    ]) : null,
    block(L('Binh thư','兵书'),pips(books,'detail-hero-books',{stacked:false,ordinal:false}),'detail-hero-books-block'),
    ...notes.map(noteParagraph),
  ].filter(Boolean));
}

/** Ghi chú nguồn đánh số theo artboard TeamDetail; không có ghi chú thì không dựng khối. */
function detailNotes(notes) {
  if (!notes.length) return null;
  return el('section',{class:'detail-section detail-notes'},[
    el('h2',{},L('Ghi chú nguồn','来源备注')),
    el('ol',{class:'detail-note-list'},notes.map(note=>el('li',{class:'detail-note'},note))),
  ]);
}

const section=(title,children)=>{
  const items=[].concat(children).filter(Boolean);
  if (!items.length) return null;
  return el('section',{class:'detail-section'},[el('h2',{},title),...items]);
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
  if (row.sourceConfigId && row.tierRaw) nodes.push(el('span',{class:'badge tier reference-tier',title:L('Tier nguồn','来源等级')},sourceTierLabel(row.tierRaw)));
  if (faction.label) nodes.push(el('span',{class:`reference-faction f-${faction.code}`},faction.label));
  if (units.length) nodes.push(el('span',{class:'reference-units'},units.join(' · ')));
  if (!nodes.length) return null;
  return el('p',{class:'reference-meta'},nodes.flatMap((node,index)=>index ? [' · ',node] : [node]));
}

// Điểm nguồn giữ đúng độ chính xác nguồn; thiếu điểm là ô ấn trống "—" (không phải 0) cùng khuôn với
// ô có điểm, để thẻ Đội chuẩn và Đội khác chung một bố cục đầu thẻ.
const scoreBadge=row=>row.value != null
  ? el('span',{class:'reference-score-wrap'},[
    el('span',{class:'badge score reference-score',title:L('Điểm nguồn','来源评分')},String(row.value)),
    ' ',
    el('span',{class:'reference-score-unit'},L('điểm','分')),
  ])
  : el('span',{class:'reference-score-wrap is-missing',title:L('Chưa có điểm nguồn','暂无来源评分')},[
    el('span',{class:'badge score reference-score missing-score','aria-hidden':'true'},'—'),
    el('span',{class:'visually-hidden'},L('Chưa có điểm nguồn','暂无来源评分')),
    el('span',{class:'reference-score-unit','aria-hidden':'true'},L('điểm','分')),
  ]);

/** Tên các phương án thay thế của dữ liệu cũ; bản zh chỉ giữ tên đổi được sang chữ Hán. */
const alternativeNames=values=>(values || []).map(zhResolved).filter(Boolean);

function legacyAlternativeLines(content) {
  return (content?.heroes || []).flatMap(hero=>[
    ...alternativeNames(hero.alternatives).map(value=>[hero.name,L('Tướng thay','替换武将'),value]),
    ...(hero.tactics || []).flatMap(item=>alternativeNames(item.alternatives).map(value=>[hero.name,L(`Chiến pháp ${item.name}`,`战法 ${zhResolved(item.name) ?? ''}`.trim()),value])),
    ...(hero.books || []).flatMap(item=>alternativeNames(item.alternatives).map(value=>[hero.name,L(`Binh thư ${item.name}`,`兵书 ${zhResolved(item.name) ?? ''}`.trim()),value])),
  ].map(([owner,label,value])=>el('p',{class:'alternative-line'},`${text(owner)} · ${label}: ${value}`)));
}

/** Phương án thay thế đầy đủ nhưng thu gọn trong disclosure có nhãn và số lượng. */
function alternativesDisclosure(row,onTag) {
  const holders=row.alternativeHoldersRaw || [];
  const nodes=holders.length ? holders.map((holder,index)=>holderView(holder,onTag,{index})) : legacyAlternativeLines(row.legacyContent);
  if (!nodes.length) return null;
  return el('details',{class:'reference-alternatives'},[
    el('summary',{},L(`Thay thế (${nodes.length})`,`替换方案（${nodes.length}）`)),
    el('div',{class:'alternative-body'},nodes),
  ]);
}

/** Nhãn "Sợ …" lấy từ counters `avoid` của nội dung đội gốc đã đối chiếu; đội không có thì bỏ dòng. */
function fearLine(row) {
  const contents=[row.legacyContent,...(row.legacyReferences || []).map(reference=>reference.legacyContent)].filter(Boolean);
  const values=[...new Set(contents.flatMap(content=>alternativeNames(content.counters?.avoid)))];
  if (!values.length) return null;
  return el('p',{class:'reference-fear'},[el('strong',{},L('Sợ','怕')),' ',values.join(' · ')]);
}

const detailHrefFor=(href,children,cls)=>href
  ? el('a',{class:cls,href,dataset:{teamDetailLink:''}},children)
  : el('span',{class:cls},children);

/** Khóa danh tính của một đội trong danh sách (`data-reference-key` của thẻ và hàng bảng). */
export const referenceRowKey=row=>row.sourceConfigId || row.legacyVariantId || row.legacyTeamId || '';

/** Title và CTA là link thật tới cùng href; click có modifier vẫn là hành vi trình duyệt.
 *  `data-faction-code` tô gáy thẻ theo màu phe (trang trí; tên phe vẫn là chữ trong dòng meta). */
export function recommendedTeamCard(row,{onTag,href,labels}={}) {
  const name=rowDisplayName(row);
  const fear=fearLine(row);
  return el('article',{class:'team-card reference-team-card',dataset:{referenceKey:referenceRowKey(row),sourceConfigId:row.sourceConfigId || '',legacyTeamId:row.legacyTeamId || '',faction:row.factionRaw || row.faction || '',factionCode:factionOf(row,labels).code}},[
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
      href ? el('a',{class:'ana-link-btn',href,dataset:{teamDetailLink:''}},[L('Chi tiết','详情'),icon([svgNode('line',{x1:5,y1:12,x2:19,y2:12}),svgNode('polyline',{points:'13 6 19 12 13 18'})],{size:16})]) : null,
    ].filter(Boolean)),
  ]);
}

const tableCell=(children,cls)=>el('td',{class:cls},children);

/** Ô tướng của bảng: tên (kèm nhãn biến thể) + chiến pháp chữ son; thiếu chỗ thì "—". */
function tableHeroCell(holder) {
  if (!holder) return tableCell('—','reference-table-hero');
  if (isSourceEmpty(holder)) return tableCell(sourceEmptySeat('reference-table-holder'),'reference-table-hero');
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
    el('th',{scope:'col',class:'reference-table-team'},L('Đội','队伍')),
    el('th',{scope:'col'},L('Chủ tướng','主将')),
    el('th',{scope:'col'},L('Phó 1','副将1')),
    el('th',{scope:'col'},L('Phó 2','副将2')),
    el('th',{scope:'col',class:'reference-table-score-head'},L('Điểm','评分')),
  ]);
  return el('table',{class:'reference-table'},[el('thead',{},head),el('tbody',{},rows.map(row=>recommendedTeamTableRow(row,{hrefFor,labels})))]);
}

/** Một hàng của bảng; danh sách dựng theo lượt nối thêm hàng vào `tbody` sẵn có. */
export function recommendedTeamTableRow(row,{hrefFor,labels}={}) {
  const href=hrefFor?.(row);
  const name=rowDisplayName(row);
  const holders=(row.heroes || row.holders || []).slice(0,3);
  const lineup=holders.filter(holder=>!isSourceEmpty(holder)).map(holderName).filter(Boolean).join(' · ');
  return el('tr',{dataset:{referenceKey:referenceRowKey(row)}},[
    el('th',{scope:'row',class:'reference-table-team'},[
      detailHrefFor(href,name,'reference-table-name'),
      metaLine(row,labels),
      el('span',{class:'reference-table-lineup'},lineup),
    ]),
    ...Array.from({length:3},(_,index)=>tableHeroCell(holders[index])),
    tableCell(row.value != null ? String(row.value) : '—','reference-table-score'),
  ]);
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

function legacyContentSections(content,{title,provenance=[]}={}) {
  const counters=content.counters || {};
  const counterList=(values,cls)=>el('ul',{class:'counters'},values.map(value=>el('li',{class:`chip ${cls}`},String(value))));
  const good=alternativeNames(counters.good);
  const avoid=alternativeNames(counters.avoid);
  const heroAlternatives=(content.heroes || []).flatMap(hero=>{
    const heroNames=alternativeNames(hero.alternatives);
    const rows=[
      heroNames.length ? fact('legacy-hero-alternatives',L('Tướng thay thế','替换武将'),heroNames.join(' · ')) : null,
      ...(hero.tactics || []).filter(item=>alternativeNames(item.alternatives).length).map(item=>fact('legacy-tactic-alternatives',L(`Chiến pháp ${item.name}`,`战法 ${zhResolved(item.name) ?? ''}`.trim()),alternativeNames(item.alternatives).join(' · '))),
      ...(hero.books || []).filter(item=>alternativeNames(item.alternatives).length).map(item=>fact('legacy-book-alternatives',L(`Binh thư ${item.name}`,`兵书 ${zhResolved(item.name) ?? ''}`.trim()),alternativeNames(item.alternatives).join(' · '))),
    ].filter(Boolean);
    return rows.length ? [el('section',{class:'legacy-alternative-group'},[el('h3',{},text(hero.name)),el('dl',{class:'detail-facts'},rows)])] : [];
  });
  const heroCards=(content.heroes || []).map((hero,index)=>detailHeroCard({
    name: hero.name, tactics: hero.tactics, books: hero.books, note: hero.note,
  },{isMain: index === 0, legacy: true, notes: hero.note ? [hero.note] : []}));
  return [
    title ? el('h3',{class:'legacy-content-title'},title) : null,
    ...provenance,
    section(L('Cấu hình gốc','原始配置'),heroCards.length ? el('div',{class:'detail-hero-grid'},heroCards) : null),
    section(L('Mô tả & cách vận hành','说明与玩法'),content.notes ? noteParagraph(content.notes) : null),
    section(L('Khắc chế','克制关系'),[
      good.length ? el('div',{class:'counter-group'},[el('h3',{},L('Khắc chế tốt','克制')),counterList(good,'good')]) : null,
      avoid.length ? el('div',{class:'counter-group'},[el('h3',{},L('Nên tránh','应避开')),counterList(avoid,'avoid')]) : null,
    ].filter(Boolean)),
    section(L('Phương án thay thế','替换方案'),heroAlternatives),
  ].filter(Boolean);
}

/** Tiêu đề đội gốc: bản vi dùng biệt danh/tên đội, bản zh ghép tên tướng chữ Hán. */
const legacyTitle=(content,fallback)=>isZh()
  ? lineupTitle(content.heroes) || fallback
  : content.nickname || content.name || fallback;

/** Nội dung chi tiết Team chuẩn cho trang riêng; trả fragment, không tự tạo article/h1. */
export function recommendedTeamDetailContent(record,{legacyTeams=[],labels=null}={}) {
  const fragment=document.createDocumentFragment();
  const notes=notesByOwner(record);
  const holders=record.heroes || record.holders || [];
  const alternatives=record.alternativeHoldersRaw || [];
  const source=validateReferenceSourceUrl('recommended',record,record.sourceUrl);
  const roles=detailHeroRoles();

  const heroCards=holders.map((holder,index)=>detailHeroCard(holder,{
    role:roles[index] || null,
    isMain:index===0,
    notes:notes.projected ? notes.primary.get(index) || [] : [],
  }));
  if (heroCards.length) fragment.append(section(L('Đội hình','阵容'),el('div',{class:'detail-hero-grid'},heroCards)));
  const teamNotes=detailNotes(notes.team);
  if (teamNotes) fragment.append(teamNotes);

  const groups=Array.from({length:Math.ceil(alternatives.length/3)},(_,index)=>{
    const slice=alternatives.slice(index*3,index*3+3);
    return el('section',{class:'reference-alternative-group'},[
      el('h3',{},L(`Cấu hình thay thế ${index+1}`,`替换配置 ${index+1}`)),
      el('div',{class:'detail-hero-grid'},slice.map((holder,position)=>detailHeroCard(holder,{
        level:'h4',
        role:roles[position] || null,
        isMain:position===0,
        notes:notes.projected ? notes.alternative.get(index*3+position) || [] : [],
      }))),
    ]);
  });
  const alternativeSection=section(L('Cấu hình thay thế','替换配置'),groups);
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
      el('p',{class:'scope-note'},L(
        `Đội gốc: ${reference.legacyTeamId}${reference.legacyVariantId ? ` · biến thể ${reference.legacyVariantId}` : ''}`,
        `原始队伍：${reference.legacyTeamId}${reference.legacyVariantId ? ` · 变体 ${reference.legacyVariantId}` : ''}`,
      )),
      el('p',{class:'scope-note'},L(
        `Bằng chứng rà soát: ${reference.evidenceRef || 'Chưa ghi'} · ${reference.legacyContentSha256 || ''}`,
        `核对依据：${reference.evidenceRef || '未注明'} · ${reference.legacyContentSha256 || ''}`,
      )),
      // Route chưa đăng ký trả `null`: giữ link không href, không để `localePath(null)` thành "/".
      el('p',{class:'detail-link-row'},el('a',{class:'detail-link',href:(path=>path ? localePath(path) : null)(teamDetailPath({legacyTeamId:reference.legacyTeamId}))},L('Xem trang đội gốc','查看原始队伍页面'))),
    ]));
    fragment.append(el('section',{class:'detail-section legacy-reference'},[
      el('h2',{},L('Nội dung đội gốc đã đối chiếu','已核对的原始队伍内容')),
      ...legacyContentSections(localizedContent,{
        title:legacyTitle(localizedContent,first.legacyTeamId),
        provenance,
      }),
    ]));
  }

  const seasonValue=isZh()
    ? record.sourceSeasonCode || record.sourceSeasonId
    : [record.sourceSeasonCode || record.sourceSeasonId,record.sourceSeasonNameVi].filter(Boolean).join(' · ');
  const categoryValue=isZh() ? record.sourceCategoryId : record.sourceCategoryNameVi || record.sourceCategoryId;
  fragment.append(el('section',{class:'detail-section detail-source'},[
    el('h2',{},L('Nguồn & phạm vi','来源与范围')),
    el('dl',{class:'detail-facts'},[
      fact('source-config',L('Mã cấu hình nguồn','来源配置编号'),el('code',{translate:'no'},record.sourceConfigId || L('Chưa có','暂无'))),
      seasonValue ? fact('source-season',L('Mùa nguồn','来源赛季'),seasonValue) : null,
      categoryValue ? fact('source-category',L('Danh mục','分类'),categoryValue) : null,
      record.authorRaw ? fact('source-author',L('Tác giả','作者'),record.authorRaw) : null,
    ].filter(Boolean)),
    record.introRaw ? noteParagraph(record.introRaw) : null,
    source
      ? el('p',{},el('a',{class:'detail-link',href:source,target:'_blank',rel:'noopener noreferrer'},L('Mở nguồn tham khảo','打开参考来源')))
      : el('p',{class:'scope-note'},L('Liên kết nguồn không hợp lệ hoặc chưa có.','来源链接无效或暂无。')),
  ].filter(Boolean)));
  return fragment;
}

/** Loại binh nguồn của đội cũ (`"Thương(★★★★)"`, `"Kỵ/Cung(…)"`): bản zh đổi từng tên binh sang chữ Hán, giữ phần sao. */
const rawTypeLabel=value=>isZh()
  ? String(value).replace(/^[^(（]+/u,names=>names.split('/').map(name=>unitLabel(name.trim())).join('/'))
  : value;

/** Nội dung đội gốc; dùng cho trang original và cho biến thể đã được admit. */
export function legacyOriginalDetailContent(team,{variant}={}) {
  const fragment=document.createDocumentFragment();
  fragment.append(...legacyContentSections(team,{}));
  fragment.append(el('section',{class:'detail-section detail-source'},[
    el('h2',{},L('Nguồn & phạm vi','来源与范围')),
    el('dl',{class:'detail-facts'},[
      fact('source-legacy-id',L('Mã đội gốc','原始队伍编号'),el('code',{translate:'no'},team.id || L('Chưa có','暂无'))),
      fact('source-label',L('Nguồn','来源'),team.source ? sourceLabel(team.source) : L('Nguồn chưa xác định','来源不明')),
      team.rawType ? fact('source-raw-type',L('Loại binh nguồn','来源兵种'),rawTypeLabel(team.rawType)) : null,
      variant ? fact('source-variant',L('Biến thể đã đối chiếu','已核对的变体'),el('code',{translate:'no'},variant.legacyVariantId)) : null,
      variant?.legacyContentSha256 ? fact('source-variant-proof',L('Vân tay nội dung','内容指纹'),el('code',{translate:'no'},variant.legacyContentSha256)) : null,
    ].filter(Boolean)),
  ]));
  return fragment;
}
