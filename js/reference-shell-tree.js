// Khung tương tác của mục Đội chuẩn / Đội khác dạng cây view thuần (`t`/`h`, không `document`): thanh công cụ, sidebar lọc
// (nhóm facet + chip) và vùng kết quả. Một định nghĩa cho bản dựng sẵn lúc build (`treeToHtml`) lẫn trình duyệt (`treeToDom`
// trong `createRecommendedSection`), nên hai bên không lệch nhau. Cây không mang sự kiện: trình duyệt gắn sự kiện sau
// `treeToDom` bằng delegation trên `data-*`/class có sẵn. Mọi hàm đọc ngôn ngữ qua `L()`/`currentLocale()`: build bọc trong `withLocale`.
// Module này cũng giữ các hàm thuần của chip (đếm/sắp facet, nhãn chữ, số lọc đang bật) và ba hàm nhãn chữ (`cjk`, `sourceText`,
// `safeLabel`) mà `team-filter-section.js` dùng chung cho tên mùa; nó không import ngược `team-filter-section.js`.

import { L, contentLocaleIsVietnamese, currentLocale } from './i18n.js';
import { FACTION_CODE, iconTree, sourceLabel, svgTree, t } from './render.js';
import { otherTeamFacetValues } from './other-team-groups.js';
import { SOURCE_TIER_ORDER, TIER_SOURCE_JP, jpTierSourceLabel, legacyLabelZh, referenceFacetValues, sourceTierLabel } from './recommended-reference-state.js';
import { TEAM_VIEW_CARDS, TEAM_VIEW_GRID, TEAM_VIEW_TABLE, canonicalTeamView } from './team-view.js';

// Nhóm chính Loại binh → Phe → Tier; Nhóm/Bộ đội hình thu gọn trong accordion.
export const PRIMARY_FACETS=['unit','faction','tier'];
export const SECONDARY_FACETS=['subcategory','source'];
const FACET_LABEL={unit:'Loại binh',faction:'Phe',tier:'Tier',subcategory:'Nhóm',source:'Bộ đội hình'};
const FACET_LABEL_HAN={
  zh:{tier:'等级',unit:'兵种',faction:'阵营',subcategory:'分组',source:'阵容合集'},
  ja:{tier:'ティア',unit:'兵種',faction:'勢力',subcategory:'グループ',source:'編成コレクション'},
};
const facetLabel=key=>L(FACET_LABEL[key],FACET_LABEL_HAN.zh[key],FACET_LABEL_HAN.ja[key]);

/** Ba kiểu hiển thị: Thẻ (mặc định, không ghi URL), Thẻ gọn (lưới tối đa 4 cột, `?view=luoi`), Bảng (`?view=bang`). */
export const VIEW_OPTIONS=[
  {value:TEAM_VIEW_CARDS,label:'Thẻ',aria:'Xem dạng thẻ',labelZh:'卡片',ariaZh:'以卡片显示',labelJa:'カード',ariaJa:'カード表示',icon:[
    svgTree('rect',{x:3,y:3,width:7.5,height:18,rx:1.5}),
    svgTree('rect',{x:13.5,y:3,width:7.5,height:18,rx:1.5}),
  ]},
  {value:TEAM_VIEW_GRID,label:'Thẻ gọn',aria:'Xem dạng thẻ gọn',labelZh:'紧凑卡片',ariaZh:'以紧凑卡片显示',labelJa:'コンパクトカード',ariaJa:'コンパクトカード表示',icon:[
    svgTree('rect',{x:3,y:3,width:7.5,height:7.5,rx:1.5}),svgTree('rect',{x:13.5,y:3,width:7.5,height:7.5,rx:1.5}),
    svgTree('rect',{x:3,y:13.5,width:7.5,height:7.5,rx:1.5}),svgTree('rect',{x:13.5,y:13.5,width:7.5,height:7.5,rx:1.5}),
  ]},
  {value:TEAM_VIEW_TABLE,label:'Bảng',aria:'Xem dạng bảng',labelZh:'表格',ariaZh:'以表格显示',labelJa:'表',ariaJa:'表で表示',icon:[
    svgTree('line',{x1:3,y1:6,x2:21,y2:6}),svgTree('line',{x1:3,y1:12,x2:21,y2:12}),svgTree('line',{x1:3,y1:18,x2:21,y2:18}),
  ]},
];

// Hình icon là hằng cây: `treeToDom`/`treeToHtml` dựng node mới ở mỗi lần gọi nên dùng chung được.
export const chevron=[svgTree('polyline',{points:'6 9 12 15 18 9'})];
const filterIcon=[svgTree('line',{x1:4,y1:7,x2:20,y2:7}),svgTree('line',{x1:7,y1:12,x2:17,y2:12}),svgTree('line',{x1:10,y1:17,x2:14,y2:17})];
const searchIcon=[svgTree('circle',{cx:11,cy:11,r:7}),svgTree('line',{x1:16.5,y1:16.5,x2:21,y2:21})];

export const cjk=/[\u3400-\u9fff\uf900-\ufaff]/u;
// `sourceText`: trang không phải bản Việt hiện chữ nguồn (chữ Hán) thay cho lớp dịch Việt; hiện chỉ có bản zh.
export const sourceText=()=>!contentLocaleIsVietnamese(currentLocale());
export const safeLabel=value=>typeof value === 'string' && value.trim() && !cjk.test(value)
  ? value.trim()
  : 'Nội dung tiếng Việt chưa sẵn sàng';

// Bản zh: giá trị nguồn chữ Hán giữ nguyên, giá trị tiếng Việt của đội cũ đổi sang nhãn chữ Hán. `labels`: `displayLabels` của registry.
const displayLabel=(labels,kind,value)=>sourceText()
  ? (typeof value === 'string' && cjk.test(value) ? value : legacyLabelZh(kind,value) ?? String(value ?? ''))
  : safeLabel(labels?.[kind]?.[value] || value);

/**
 * Chữ chip của một giá trị facet. Luôn là chuỗi: giá trị lạ lấy từ URL (`?source=__proto__`) không được thành object, vì cây
 * coi mọi con là object là một nút cây.
 */
export const chipText=(labels,key,value)=>String(key==='tier'
  ? sourceTierLabel(value)
  : key==='source'
    ? (value===TIER_SOURCE_JP ? jpTierSourceLabel() : sourceLabel(value))
    : displayLabel(labels,key,value));

const tierRank=value=>{
  const index=SOURCE_TIER_ORDER.indexOf(value);
  return index<0 ? 999 : index;
};
/** So mã giá trị thô theo thứ tự code unit: khoá cuối của mọi phép sắp, không phụ thuộc locale. */
const compareCode=(a,b)=>a<b ? -1 : a>b ? 1 : 0;

/**
 * Facet `key` của một phạm vi: `[giá trị, số đếm]` sắp theo số đếm giảm dần (như artboard); hòa thì theo nhãn hiển thị bằng
 * `Intl.Collator` của ngôn ngữ trang (không dùng locale mặc định của tiến trình: Node lúc build và trình duyệt phải ra cùng
 * thứ tự), rồi mã thô làm khoá cuối. Tier theo `SOURCE_TIER_ORDER` (tier lạ về cuối), rồi mã thô. Giá trị đang chọn vẫn có mặt
 * khi phạm vi hiện tại không đếm được nó (số 0). `scopeItems`: mục của danh sách (Đội chuẩn: hàng đội; Đội khác: mục team).
 */
export function facetEntries({scopeItems,key,family,state,labels}) {
  const itemFacetValues=family==='other' ? otherTeamFacetValues : referenceFacetValues;
  const counts=new Map();
  for (const item of scopeItems) for (const value of itemFacetValues(item,key)) counts.set(value,(counts.get(value) || 0)+1);
  for (const value of state.filters?.[key] || []) if (!counts.has(value)) counts.set(value,0);
  if (key==='tier') return [...counts].sort(([a],[b])=>tierRank(a)-tierRank(b) || compareCode(a,b));
  const collator=new Intl.Collator(currentLocale(),{sensitivity:'variant'});
  const text=new Map([...counts.keys()].map(value=>[value,chipText(labels,key,value)]));
  return [...counts].sort(([a,countA],[b,countB])=>countB-countA || collator.compare(text.get(a),text.get(b)) || compareCode(a,b));
}

/** Chip đã chọn + từ khóa tìm: những lọc thu hẹp danh sách mà số của cả mùa trên nút kho không còn khớp. */
export function narrowingCount(state) {
  const facets=Object.values(state.filters || {}).reduce((total,values)=>total + (Array.isArray(values) ? values.length : 0),0);
  return facets + (state.query ? 1 : 0);
}

/** Lọc đang bật = chip đã chọn + từ khóa tìm + lọc kho; dùng cho badge "Bộ lọc" và trạng thái "Xóa lọc". `hasCoverage`: mùa đang xem có độ phủ kho. */
export const activeFilterCount=(state,hasCoverage)=>narrowingCount(state) + (hasCoverage && state.rosterFilter ? 1 : 0);

// Cờ `hidden` của ba phần tử cuối vùng kết quả: một luật cho `render()` của trình duyệt và cho bản dựng sẵn.
/** Thông báo ẩn khi không có chữ. */
export const referenceNoticeHidden=text=>!text;
/** "Xem thêm" ẩn khi đã hiện hết (`shown` mục đang hiện trên `total` mục của danh sách đã lọc). */
export const referenceMoreHidden=(shown,total)=>shown>=total;
/** Dòng "không có đội" ẩn khi danh sách còn mục. */
export const referenceEmptyHidden=total=>total>0;

/** Số đếm "N / M đội": N đội đang hiện sau lọc, M đội của cả phạm vi. */
export const referenceCountTrees=({count,scopeCount})=>[
  t('strong',{},String(count)),
  L(` / ${scopeCount} đội`,` / ${scopeCount} 队`,` / ${scopeCount}編成`),
];

const viewButtonTree=(option,on)=>t('button',{
  type:'button',class:`view-btn view-btn-${option.value}${on ? ' on' : ''}`,dataset:{view:option.value},'aria-pressed':String(on),
  'aria-label':L(option.aria,option.ariaZh,option.ariaJa),title:L(option.aria,option.ariaZh,option.ariaJa),
},[iconTree(option.icon,{size:16}),t('span',{class:'view-btn-label'},L(option.label,option.labelZh,option.labelJa))]);

/**
 * Thanh công cụ: ô tìm, nút "Bộ lọc" (chỉ hiện trên mobile; `aria-controls` trỏ sidebar `${mountId}-filters`), số đếm và nhóm
 * kiểu hiển thị (`aria-pressed` theo `state.view`). `title`: tiêu đề mục (nhãn ô tìm); `count`/`scopeCount`: số đội đang hiện / của
 * cả phạm vi; `activeCount`: số lọc đang bật (huy hiệu của nút, ẩn khi 0).
 */
export function referenceToolbarTree({mountId,title,state,count,scopeCount,activeCount}) {
  const active=canonicalTeamView(state.view) || TEAM_VIEW_CARDS;
  return t('div',{class:'reference-toolbar'},[
    t('label',{class:'search reference-search'},[
      iconTree(searchIcon),
      t('input',{type:'search',class:'reference-search-input','aria-label':L(`Tìm ${title}`,`搜索${title}`,`${title}を検索`),placeholder:L('Tìm tướng, chiến pháp, binh thư…','搜索武将、战法、兵书…','武将・戦法・兵法書を検索…')}),
    ]),
    t('button',{type:'button',class:'filter-collapse-toggle','aria-controls':`${mountId}-filters`,'aria-expanded':'false'},[
      iconTree(filterIcon,{size:18}),
      t('span',{class:'filter-toggle-label'},L('Bộ lọc','筛选','絞り込み')),
      t('span',{class:'filter-count','aria-hidden':'true',hidden:activeCount===0},String(activeCount)),
    ]),
    t('span',{class:'stats reference-count',role:'status'},referenceCountTrees({count,scopeCount})),
    t('div',{class:'reference-view-toggle',role:'group','aria-label':L('Kiểu hiển thị','显示方式','表示形式')},
      VIEW_OPTIONS.map(option=>viewButtonTree(option,option.value===active))),
  ]);
}

// Mã màu phe tra theo nhãn Việt của registry (hoặc giá trị Việt của đội cũ), không theo chữ hiển thị; chỉ nhận khoá có thật.
const factionCode=(labels,value)=>{
  const name=labels?.faction?.[value] ?? value;
  return typeof name === 'string' && Object.hasOwn(FACTION_CODE,name) ? FACTION_CODE[name] : null;
};

function facetChipTree({key,selected,value,count,labels}) {
  const code=key==='faction' ? factionCode(labels,value) : null;
  const on=selected.includes(value);
  const text=chipText(labels,key,value);
  return t('button',{
    type:'button',class:`fchip ${key}-chip${code ? ` f-${code}` : ''}${on ? ' on' : ''}`,'aria-pressed':String(on),
    title:sourceText() || text===value ? null : value,dataset:{focusKey:`${key}:${value}`},
  },[
    t('span',{class:'fchip-check','aria-hidden':'true'}),
    t('span',{class:'fchip-label'},text),
    ' ',
    t('span',{class:'fchip-count'},String(count)),
  ]);
}

function facetGroupTree({mountId,key,entries,state,labels,openFacets}) {
  if (!entries.length) return null;
  const selected=state.filters?.[key] || [];
  const secondary=SECONDARY_FACETS.includes(key);
  const open=secondary && openFacets.has(key);
  const rowId=`${mountId}-${key}-values`;
  // Nhóm phụ thu gọn mặc định: chip vẫn nằm trong DOM nhưng `hidden` giữ đúng trạng thái.
  const row=t('div',{class:'chip-row',id:rowId,hidden:secondary && !open},entries.map(([value,count])=>facetChipTree({key,selected,value,count,labels})));
  const label=secondary
    ? t('button',{type:'button',class:'flabel flabel-toggle','aria-expanded':String(open),'aria-controls':rowId,dataset:{focusKey:`${key}:toggle`}},[facetLabel(key),iconTree(chevron,{size:16})])
    : t('div',{class:'flabel'},facetLabel(key));
  return t('div',{class:`fgroup ${key}-group${secondary?' secondary':''}`},[label,row]);
}

/**
 * Con của sidebar lọc: đầu sidebar (`h2` + "Xóa lọc", khoá khi `activeCount` là 0) rồi các nhóm facet có chip. Chip mang
 * `data-focus-key` (`khoá:giá trị`, nhóm phụ là `khoá:toggle`) để trình duyệt nhận diện chip khi gắn sự kiện và giữ focus khi
 * dựng lại. `labels`: `displayLabels` của registry; `openFacets`: tập nhóm phụ đang mở.
 */
export function referenceFiltersChildrenTree({mountId,scopeItems,state,labels,family,openFacets,activeCount}) {
  return [
    t('div',{class:'reference-filter-head'},[
      t('h2',{class:'reference-filter-title'},L('Bộ lọc','筛选','絞り込み')),
      t('button',{type:'button',class:'clear-btn',disabled:activeCount===0},L('Xóa lọc','清除筛选','絞り込みを解除')),
    ]),
    ...[...PRIMARY_FACETS,...SECONDARY_FACETS]
      .map(key=>facetGroupTree({mountId,key,entries:facetEntries({scopeItems,key,family,state,labels}),state,labels,openFacets}))
      .filter(Boolean),
  ];
}

/**
 * Vùng kết quả: thanh kho (ẩn, trình duyệt tự vẽ), thông báo, danh sách (`viewTree`), "Xem thêm" và dòng "không có đội". Cờ `hidden`
 * của ba phần tử sau tính bằng `referenceNoticeHidden`/`referenceMoreHidden`/`referenceEmptyHidden`; nút bên trong "Xem thêm" do
 * trình duyệt dựng theo lượt.
 */
export function referenceResultsBodyTree({noticeText,emptyText,emptyHidden,moreHidden,viewTree}) {
  return t('div',{class:'reference-results-body'},[
    t('div',{class:'reference-roster-bar',hidden:true}),
    t('p',{class:'scope-note reference-notice',role:'status',hidden:referenceNoticeHidden(noticeText)},noticeText || null),
    viewTree,
    t('div',{class:'lookup-more-row reference-more',hidden:moreHidden}),
    t('p',{class:'empty reference-empty',hidden:emptyHidden},emptyText || null),
  ]);
}

/**
 * Khung của danh sách: `.reference-browser > .reference-results > [toolbar, aside.reference-filters.collapsed#${mountId}-filters,
 * vùng kết quả]`. Tham số là hợp của ba cây thành phần.
 */
export function referenceShellTree(params) {
  return t('div',{class:'reference-browser'},[
    t('div',{class:'reference-results'},[
      referenceToolbarTree(params),
      t('aside',{class:'reference-filters collapsed',id:`${params.mountId}-filters`,'aria-label':L('Bộ lọc','筛选','絞り込み')},referenceFiltersChildrenTree(params)),
      referenceResultsBodyTree(params),
    ]),
  ]);
}
