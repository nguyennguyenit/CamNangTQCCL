import { el, tierClass } from './render.js';
import { validateReferenceSourceUrl } from './recommended-reference-state.js';

const text = value => value || 'Chưa có dữ liệu';

function holderView(holder,onTag) {
  const slots=(values,viValues,count,cls)=>Array.from({length:count},(_,index)=>{
    const value=viValues?.[index] || values?.[index];
    return value
      ? el('button',{type:'button',class:`tag ${cls}`,onClick:event=>{event.stopPropagation();onTag?.(value);}},text(value))
      : el('span',{class:`tag ${cls} missing-slot`},'Chưa có dữ liệu');
  });
  return el('div',{class:'hero reference-holder'},[
    el('div',{class:'hero-name'},[el('span',{class:'hn'},text(holder.displayNameVi || holder.nameRaw))]),
    el('div',{class:'line tactics'},slots(holder.tacticSlotsRaw,holder.tacticSlotsVi,2,'t-tactic')),
    el('div',{class:'line books'},slots(holder.bookSlotsRaw,holder.bookSlotsVi,3,'t-book')),
  ]);
}

const slotLine=(raw,vi)=>(raw || []).map((value,index)=>text(vi?.[index] || value)).join(' · ');

function detailedHolder(holder) {
  return el('section',{class:'reference-detail-holder'},[
    el('h3',{},text(holder.displayNameVi || holder.nameRaw)),
    el('p',{},`Chiến pháp: ${slotLine(holder.tacticSlotsRaw,holder.tacticSlotsVi)}`),
    el('p',{},`Binh thư: ${slotLine(holder.bookSlotsRaw,holder.bookSlotsVi)}`),
    el('p',{},`Cộng điểm: ${text(holder.statFocusRaw)}`),
    holder.notesRaw ? el('p',{},holder.notesRaw) : null,
  ]);
}

export function recommendedTeamCard(row,{onTag,onOpen}={}) {
  const card=el('article',{class:'team-card reference-team-card',tabindex:'0',dataset:{sourceConfigId:row.sourceConfigId || '',legacyTeamId:row.legacyTeamId || '',faction:row.factionRaw || row.faction || ''}},[
    el('div',{class:'team-head'},[
      el('h3',{class:'team-name'},text(row.displayNameVi || row.nameZh || row.name)),
      row.tierRaw ? el('span',{class:`badge tier ${/^T[0-9.]+$/.test(row.tierRaw)?tierClass(row.tierRaw):'t-func'}`},row.tierRaw === '功能隊' ? 'FUNC' : row.tierRaw) : row.historicalTier != null ? el('span',{class:'badge tier historical-tier'},`Tier lịch sử — tham khảo: ${row.historicalTier}`) : null,
    ]),
    el('div',{class:'heroes'},(row.heroes || row.holders || []).map(holder=>holderView(holder,onTag))),
    el('p',{class:'scope-note'},row.sourceLabel || [row.sourceSeasonLabel || row.sourceSeasonId,row.sourceCategoryId].filter(Boolean).join(' · ') || 'Nguồn chưa xác định'),
    row.value != null ? el('p',{class:'sgsdeck-score'},`Điểm nguồn: ${row.value}`) : null,
    el('button',{type:'button',class:'ana-link-btn',onClick:()=>onOpen?.(row)},'Chi tiết'),
  ]);
  card.addEventListener('keydown',event=>{if ((event.key==='Enter'||event.key===' ') && event.target===card){event.preventDefault();onOpen?.(row);}});
  return card;
}

export function recommendedTeamDetail(row,{onClose}={}) {
  const family=row.sourceConfigId?'recommended':'other';
  const source=validateReferenceSourceUrl(family,row,row.sourceUrl);
  const detail=el('article',{class:'season-config-detail reference-detail',id:'recommended-team-detail',tabindex:'-1'},[
    el('div',{class:'team-head'},[el('h2',{},text(row.displayNameVi || row.nameZh || row.name)),el('button',{type:'button',class:'clear-btn',onClick:onClose,'aria-label':'Đóng chi tiết'},'Đóng')]),
    ...(row.heroes || row.holders || []).map(detailedHolder),
    ...Array.from({length:Math.ceil((row.alternativeHoldersRaw || []).length / 3)},(_,index)=>{
      const holders=row.alternativeHoldersRaw.slice(index*3,index*3+3);
      return el('section',{class:'reference-alternative-group'},[
        el('h3',{},`Cấu hình thay thế ${index+1}`),
        ...holders.map(detailedHolder),
      ]);
    }),
    row.introRaw ? el('p',{},row.introRaw) : null,
    row.notesRaw ? el('p',{},row.notesRaw) : null,
    row.authorRaw ? el('p',{},`Tác giả: ${row.authorRaw}`) : null,
    source ? el('a',{href:source,target:'_blank',rel:'noopener noreferrer'},'Mở nguồn') : el('p',{class:'scope-note'},'Liên kết nguồn không hợp lệ hoặc chưa có.'),
  ]);
  detail.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();onClose?.();}});
  return detail;
}

export function legacyOriginalDetail(team,{onClose}={}) {
  const detail=el('article',{class:'season-config-detail reference-detail',id:'legacy-team-detail',tabindex:'-1'},[
    el('div',{class:'team-head'},[el('h2',{},text(team.name)),el('button',{type:'button',class:'clear-btn',onClick:onClose,'aria-label':'Đóng chi tiết'},'Đóng')]),
    ...(team.heroes || []).map(hero=>el('section',{class:'reference-detail-holder'},[
      el('h3',{},text(hero.name)),
      el('p',{},`Chiến pháp: ${(hero.tactics || []).map(item=>item.name).join(' · ') || 'Chưa có dữ liệu'}`),
      el('p',{},`Binh thư: ${(hero.books || []).map(item=>item.name).join(' · ') || 'Chưa có dữ liệu'}`),
      hero.alternatives?.length ? el('p',{},`Tướng thay thế: ${hero.alternatives.join(' · ')}`) : null,
      ...(hero.tactics || []).filter(item=>item.alternatives?.length).map(item=>el('p',{},`${item.name} có thể thay bằng: ${item.alternatives.join(' · ')}`)),
      hero.note ? el('p',{},hero.note) : null,
    ])),
    el('p',{class:'scope-note'},team.source || 'Nguồn chưa xác định'),
    team.notes ? el('p',{},team.notes) : null,
  ]);
  detail.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();onClose?.();}});
  return detail;
}
