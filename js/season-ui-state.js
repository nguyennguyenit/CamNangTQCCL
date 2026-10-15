// Browser state adapter; all season facts and eligibility come from the shared resolver.
import { validateSeasonBundle, resolveBrowseState, compareSeasonIds } from './season-context.js';
import { normalizeText } from './filters.js';
import { L } from './i18n.js';

export const SEASON_ARTIFACTS = Object.freeze(['season-registry', 'season-evidence', 'season-team-configs', 'season-team-evaluations', 'season-content-links', 'teams', 'coexist', 'heroes-dict', 'tactics', 'books-dict']);
const QUERY_FILTERS = Object.freeze(['faction', 'unit', 'tier', 'source']);
export const BUNDLE_NOTICE = L('Không xác thực được bộ dữ liệu mùa. Đang hiển thị dữ liệu cũ để tham khảo; tính năng theo mùa chưa khả dụng.', '无法验证赛季数据包。当前显示旧数据供参考；按赛季的功能暂不可用。');
export async function loadSeasonModel(hashes, loadBytes) {
  if (!hashes || Object.keys(hashes).length !== SEASON_ARTIFACTS.length) throw new Error(BUNDLE_NOTICE);
  const entries = await Promise.all(SEASON_ARTIFACTS.map(async name => {
    const bytes = await loadBytes(name);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const actual = 'sha256:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== hashes[name]) throw new Error(BUNDLE_NOTICE);
    return [name, JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes))];
  }));
  return validateSeasonBundle(Object.fromEntries(entries));
}
/** Mùa Cùng Tồn mới nhất (đang diễn ra): mặc định khi URL chưa chọn mùa và đứng đầu ô chọn mùa. */
export const COEXIST_LATEST_SCENARIO_ID = 'binh-dien-xuan-thu';
/** Mùa đã review của Cùng Tồn theo thứ tự ô chọn mùa: mùa mới nhất lên đầu, còn lại giữ thứ tự registry. */
export function coexistScenarioIds(model) {
  const reviewed = model ? model.data['season-registry'].filter(item => item.reviewStatus === 'reviewed').map(item => item.id) : [];
  return reviewed.includes(COEXIST_LATEST_SCENARIO_ID) ? [COEXIST_LATEST_SCENARIO_ID, ...reviewed.filter(id => id !== COEXIST_LATEST_SCENARIO_ID)] : reviewed;
}
/** Nhóm Cùng Tồn của một phép chiếu theo thứ tự hiển thị: áp dụng, tham khảo theo kịch bản, chưa rõ. */
export const coexistGroups = projection => [...projection.coexist.applicable, ...projection.coexist.scenarioReference, ...projection.coexist.unknown];
export function readSeasonQuery(url, model) {
  const params = new URL(url).searchParams;
  const selection = {};
  for (const [key, field] of [['scenario', 'scenarioId'], ['ruleset', 'rulesetId']]) {
    if (params.has(key)) selection[field] = params.getAll(key).length === 1 ? params.get(key) : '';
  }
  const invalidScalar = ['q','sort','config'].some(key=>params.getAll(key).length > 1 || (key !== 'q' && params.has(key) && !params.get(key)));
  return {
    browse: model ? resolveBrowseState(model, selection) : null,
    filters: Object.fromEntries(QUERY_FILTERS.map(key => [key, [...new Set(params.getAll(key))]])),
    query: params.getAll('q').length === 1 ? params.get('q') : '', sort: params.getAll('sort').length === 1 ? params.get('sort') || 'tier' : 'tier',
    configId: params.getAll('config').length === 1 ? params.get('config') : null,
    notices: [...(params.has('stars') ? [L('Bộ lọc sao cũ đã được bỏ.', '旧的星级筛选已移除。')] : []), ...(invalidScalar ? [L('Tham số tìm kiếm hoặc cấu hình không hợp lệ đã được bỏ.', '无效的搜索或配置参数已被忽略。')] : [])],
  };
}
export function updateSeasonURL(url, changes) {
  const next = new URL(url);
  for (const [key, value] of Object.entries(changes)) {
    next.searchParams.delete(key);
    for (const item of Array.isArray(value) ? value : [value]) if (item !== null && item !== undefined && item !== '') next.searchParams.append(key, item);
  }
  return next;
}

import { canonicalHeroId } from './hero-identity.js';
export function compareSeasonInventory(selection, inventory) {
  const identity = (name, kind) => {
    try { return kind === 'hero' ? canonicalHeroId(name) : 'tactic:' + normalizeText(name).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); } catch { return ''; }
  };
  const ownedHeroes = new Set(inventory.ownedHeroes.map(item=>identity(item.name,'hero')));
  const ownedTactics = new Set(inventory.ownedTactics.map(item=>identity(item.name,'tactic')));
  const lockedHeroes = new Set(inventory.lockedTeams.flatMap(team=>team.heroes).map(name=>identity(name,'hero')));
  const lockedTactics = new Set(inventory.lockedTeams.flatMap(team=>team.tactics).map(name=>identity(name,'tactic')));
  const heroes = selection.heroSlots.map(slot=>slot.heroRef);
  const tactics = selection.heroSlots.flatMap(slot=>slot.tacticRefs);
  return {
    missingHeroes:heroes.filter(ref=>!ownedHeroes.has(ref)), missingTactics:tactics.filter(ref=>!ownedTactics.has(ref)),
    lockedHeroes:heroes.filter(ref=>lockedHeroes.has(ref)), lockedTactics:tactics.filter(ref=>lockedTactics.has(ref)),
    duplicateHeroes:new Set(heroes).size !== heroes.length, duplicateTactics:new Set(tactics).size !== tactics.length,
    requirementsUnknown:selection.requirementIds.length > 0 || selection.effectBundleIds.length > 0,
  };
}

/** Explicit first alternatives are the visible card selection, never copied from source scoring. */
export function defaultSeasonSelection(config) {
  return {schemaVersion:1,configId:config.id,scenarioId:config.scenarioId,rulesetId:config.rulesetId,unitType:config.unitTypes[0],heroSlots:config.heroSlots.map(slot=>({heroRef:slot.heroRefs[0],tacticRefs:slot.tacticSlots.map(s=>s.tacticRefs[0] || ''),bookRefs:slot.bookSlots.map(s=>s.bookRefs[0] || '')})),requirementIds:config.requirements.map(r=>r.id).sort(compareSeasonIds),effectBundleIds:config.effectBundles.map(r=>r.id).sort(compareSeasonIds)};
}
