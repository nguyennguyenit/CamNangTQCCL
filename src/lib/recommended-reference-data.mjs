// Public reading view of exact source configurations, separate from gameplay eligibility.
import { toVietHanViet } from '../../js/hanviet.js';

const SOURCE_SCENARIOS = {'og-兵演春秋': 'binh-dien-xuan-thu'};
const FACTIONS = {'魏':'Ngụy','蜀':'Thục','吳':'Ngô','群':'Quần'};
const UNITS = {'騎':'Kỵ','盾':'Khiên','弓':'Cung','槍':'Thương','器械':'Khí giới'};
const TIERS = new Set(['T0','T0.5','T1','T1.5','T2','T3','功能隊']);
// Orthographic conversion for dictionary display lookup only; never creates canonical IDs.
const SPELLINGS = Object.fromEntries([...`呂吕 蒙蒙 關关 馬马 張张 飛飞 諸诸 劉刘 統统 孫孙 權权 維维 滿满 寵宠 喬乔 無无 雙双 異异 寧宁 許许 賈贾 詡诩 興兴 陸陆 遜逊 盧卢 貂貂 蟬蝉 騎骑 當当 勢势 陣阵 謀谋 敵敌 眾众 療疗 剛刚 並并 濟济 單单 奪夺 挾挟 戰战 彎弯 飲饮 鋒锋 斷断 擊击 歸归 虛虚 潛潜 龍龙 熾炽 燎燎 輜辎 營营 壘垒 軍军 獨独 鬥斗 決决 風风 驟骤 義义 從从 氣气 絕绝 臨临 萬万 帥帅 發发 衛卫 爭争 煩烦 湯汤 錦锦 靈灵 機机 動动 勝胜 魚鱼 鱗鳞 結结 進进 準准 錘锤 煉炼 銳锐 隱隐 後后 堅坚 識识 詭诡 勵励 誘诱 藏藏 蓄蓄 蓋盖 亂乱 書书 勇勇 謙谦`.split(' ')].map(pair=>[pair[0],pair[1]]));
const spelling = value => [...value].map(char=>SPELLINGS[char] || char).join('').replace(/\s+/g,'');

function displayName(raw, dictionary) {
  if (!raw) return '';
  const key = spelling(raw);
  const match = dictionary.find(item=>spelling(item.chinese || '') === key);
  if (match) return match.viet;
  // Keep the source wording whenever a complete transliteration is unavailable.
  const translated = toVietHanViet([...raw].map(char=>SPELLINGS[char] || char).join(''));
  return /[\u3400-\u9fff]/u.test(translated) ? raw : translated;
}

export function recommendedReferenceRows(evidence, dictionaries) {
  const scenarioId = SOURCE_SCENARIOS[evidence.sourceSeason?.label];
  if (!scenarioId || evidence.provider !== 'sgsdeck' || evidence.inventory?.missingDetails !== 0
      || evidence.records?.length !== evidence.inventory?.expected || !evidence.listSnapshotHash?.startsWith('sha256:')) {
    throw new Error('Incomplete Recommended source inventory');
  }
  const seen = new Set();
  return evidence.records.map(record=>{
    const {sourceConfigId:id, provenance, sourceSeason} = record;
    if (!/^[a-z0-9-]+$/.test(id) || seen.has(id) || sourceSeason?.label !== evidence.sourceSeason.label
        || record.sourceUrl !== `https://sgsdeck.com/recommended/${id}` || provenance?.sourceUrl !== record.sourceUrl
        || provenance.region !== 'TW' || record.heroes.length !== 3
        || (record.value !== null && (!Number.isFinite(record.value) || record.value < 0))) throw new Error('Invalid Recommended source configuration');
    seen.add(id);
    const heroes = record.heroes.map(hero=>({
      name:displayName(hero.nameRaw,dictionaries.heroes), baseName:displayName(hero.nameRaw,dictionaries.heroes),
      alternatives:[], tactics:hero.tacticSlotsRaw.map(name=>({name:displayName(name,dictionaries.tactics),alternatives:[]})),
      books:hero.bookSlotsRaw.map(name=>({name:displayName(name,dictionaries.books),alternatives:[]})),
    }));
    const tier = TIERS.has(record.tierRaw) ? record.tierRaw : null;
    return {
      teamId:`sgsdeck:${id}`, configId:null, classification:'sourceReference', scenarioId,
      tier:null, referenceTier:tier, sourceScore:null, referenceScore:record.value,
      sourceReference:{id,name:record.nameZh,url:record.sourceUrl,region:provenance.region,season:sourceSeason.label,
        fetchedAt:provenance.fetchedAt,snapshotHash:record.sourceSnapshotHash,listSnapshotHash:evidence.listSnapshotHash,
        heroes:record.heroes,notes:record.notesRaw},
      team:{id:`sgsdeck:${id}`,source:'sgsdeck-recommended',name:displayName(record.nameZh,[]),
        rawType:record.nameZh, faction:FACTIONS[record.factionRaw] || null,
        unitType:record.unitTypesRaw.map(unit=>UNITS[unit]).filter(Boolean),heroes,
        notes:[record.nameZh,record.notesRaw,...record.heroes.map(hero=>hero.nameRaw)].join('\n')},
    };
  });
}
