import { normalizeText } from './filters.js';
import { canonicalHeroId } from './hero-identity.js';
import { L } from './i18n.js';
import { bookRowId } from './lookup-ids.js';

const ARTIFACTS = ['season-registry', 'season-evidence', 'season-team-configs', 'season-team-evaluations', 'season-content-links'];
const DATASETS = ['teams', 'coexist', 'heroes-dict', 'tactics', 'books-dict'];
const CONFIG_KEYS = ['schemaVersion', 'id', 'teamId', 'scenarioId', 'rulesetId', 'unitTypes', 'heroSlots', 'requirements', 'effectBundles'];
const TIERS = new Set(['T0', 'T0.5', 'T1', 'T1.5', 'T2', 'T3']);
const META_TIERS = new Set(['T0', 'T0.5', 'T1']);
const MODELS = new WeakMap();
/** Thông báo theo mã lỗi, mỗi mã một cặp [tiếng Việt, tiếng Trung]; chọn theo ngôn ngữ trang lúc tạo lỗi. */
const MESSAGES = {
  SEASON_BUNDLE_INVALID: ['Dữ liệu kịch bản không hợp lệ hoặc không đồng bộ.', '剧本数据无效或不同步。'],
  SEASON_CONTEXT_INVALID: ['Kịch bản hoặc phiên bản luật không hợp lệ.', '剧本或规则版本无效。'],
  SEASON_CONTEXT_REQUIRED: ['Chọn phiên bản luật đã xác minh để thực hiện thao tác này.', '请选择已验证的规则版本以执行此操作。'],
  CONFIG_NOT_FOUND: ['Không tìm thấy cấu hình phù hợp phạm vi.', '未找到符合范围的配置。'],
  CONFIG_AMBIGUOUS: ['Đội có nhiều cấu hình phù hợp; hãy chọn cấu hình cụ thể.', '该阵容有多个符合的配置，请选择具体配置。'],
  CANDIDATE_LIMIT_EXCEEDED: ['Quá nhiều cấu hình phù hợp phạm vi; chưa thể tạo gợi ý.', '符合范围的配置过多，暂时无法生成推荐。'],
};
const message = code => L(...(MESSAGES[code] || MESSAGES.SEASON_BUNDLE_INVALID));

export class SeasonContextError extends Error {
  constructor(code = 'SEASON_BUNDLE_INVALID') {
    super(message(code));
    this.name = 'SeasonContextError';
    this.code = Object.hasOwn(MESSAGES, code) ? code : 'SEASON_BUNDLE_INVALID';
  }
}
function fail() { throw new SeasonContextError(); }
function ensure(value) { if (!value) fail(); }
function object(value, required, optional = []) {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value));
  ensure(required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => required.includes(k) || optional.includes(k)));
  return value;
}
function list(value, size) { ensure(Array.isArray(value) && (size === undefined || value.length === size)); return value; }
function text(value, max = 512, raw = false) {
  ensure(typeof value === 'string' && [...value].length <= max);
  ensure(raw ? !/(?![\n\r\t])\p{C}/u.test(value) : value.length > 0 && value.trim() === value && !/\p{C}/u.test(value));
  return value;
}
function id(value) { return text(value, 128); }
function version(value) { ensure(value === 1); }
function review(value) { ensure(value === 'reviewed' || value === 'pending'); }
function ids(value, index, allowEmpty = true) {
  list(value); ensure(allowEmpty || value.length > 0); ensure(new Set(value).size === value.length);
  for (const key of value) { id(key); if (index) ensure(index.has(key)); }
  return value;
}
function index(rows, key = 'id') {
  const result = new Map();
  for (const row of list(rows)) { ensure(row && typeof row === 'object'); id(row[key]); ensure(!result.has(row[key])); result.set(row[key], row); }
  return result;
}
function pairKey(scenarioId, rulesetId) { return JSON.stringify([scenarioId, rulesetId]); }
function hash(value) { ensure(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value)); }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function modelIndex(model) { const value = MODELS.get(model); if (!value) fail(); return value; }
function resultError(code, extra = {}) { return { ok: false, code, message: message(code), ...extra }; }

/** Locale-independent Unicode code point order, matching Python sorted strings. */
export function compareSeasonIds(left, right) {
  const a = [...left], b = [...right];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const difference = a[i].codePointAt(0) - b[i].codePointAt(0);
    if (difference) return difference;
  }
  return a.length - b.length;
}

/** Recursively sorted JSON; arrays preserve order, Unicode remains literal. */
export function canonicalSeasonJSON(value) {
  if (typeof value === 'string') { ensure(!/[\uD800-\uDFFF]/u.test(value)); return JSON.stringify(value); }
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { ensure(Number.isSafeInteger(value)); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalSeasonJSON).join(',')}]`;
  ensure(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype);
  return `{${Object.keys(value).sort(compareSeasonIds).map(k => `${canonicalSeasonJSON(k)}:${canonicalSeasonJSON(value[k])}`).join(',')}}`;
}
export async function seasonFingerprint(value) {
  const bytes = new TextEncoder().encode(canonicalSeasonJSON(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}
export function configFingerprintProjection(config) { return Object.fromEntries(CONFIG_KEYS.map(key => [key, config[key]])); }
export function contentFingerprintProjection(value) {
  if (Array.isArray(value)) return value.map(contentFingerprintProjection);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['sourceLocator', 'contentFingerprint', 'recordId'].includes(key)).map(([key, item]) => [key, contentFingerprintProjection(item)]));
}
function sourceSeason(value) {
  if (value === null) return;
  object(value, [], ['label', 'number', 'scenarioName']); ensure(Object.keys(value).length > 0);
  for (const key of ['label', 'scenarioName']) if (key in value) text(value[key]);
  if ('number' in value) ensure(Number.isSafeInteger(value.number) && value.number >= 0 && value.number <= 10000);
}
// Bản phát chỉ giữ vùng/ngày của provenance; pipeline đã kiểm khớp nơi lấy dữ liệu trước khi phát.
function provenance(value) {
  object(value, ['region', 'fetchedAt'], ['sourceUpdatedAt']);
  text(value.region, 32); stamp(value.fetchedAt);
  if ('sourceUpdatedAt' in value) stamp(value.sourceUpdatedAt);
}
function stamp(value) {
  text(value, 40); ensure(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/u.test(value));
  const day = value.slice(0, 10), parsed = new Date(day); ensure(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day);
  ensure(Number.isFinite(Date.parse(value)));
  if (value.length > 10) {
    ensure(Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60);
    const offset = value.match(/[+-](\d{2}):(\d{2})$/u);
    if (offset) ensure(Number(offset[1]) < 24 && Number(offset[2]) < 60);
  }
}
function refs(value, proofs, reviewed = false) {
  ids(value, proofs, !reviewed); const resolved = value.map(key => proofs.get(key));
  if (reviewed) ensure(resolved.every(proof => proof.reviewStatus === 'reviewed'));
  return resolved;
}
function claimMatches(proof, kind, scenarioId, rulesetId) {
  return proof.reviewStatus === 'reviewed' && proof.claim.kind === kind && proof.claim.scenarioId === scenarioId && proof.claim.rulesetId === rulesetId;
}
function requireClaim(proofs, kind, scenarioId, rulesetId = null, mapping) {
  ensure(proofs.some(proof => claimMatches(proof, kind, scenarioId, rulesetId) && (!mapping || proof.provenance.region === mapping.provenance.region && canonicalSeasonJSON(proof.sourceSeason ?? null) === canonicalSeasonJSON(mapping.sourceSeason))));
}
function scope(record, state, reviewed = false) {
  const { scenarioId, rulesetId } = record;
  if (scenarioId === null) { ensure(rulesetId === null && !reviewed); return; }
  id(scenarioId); ensure(state.scenarios.has(scenarioId));
  if (rulesetId !== null) { id(rulesetId); ensure(state.rules.has(pairKey(scenarioId, rulesetId))); }
  if (reviewed) {
    ensure(state.scenarios.get(scenarioId).reviewStatus === 'reviewed');
    if (rulesetId !== null) ensure(state.rules.get(pairKey(scenarioId, rulesetId)).reviewStatus === 'reviewed');
  }
}
function dictionary(rows, kind) {
  const result = new Map();
  for (const row of list(rows)) {
    ensure(row && typeof row === 'object');
    const name = row.viet;
    // Unmapped dictionary rows are not canonical identities.
    if (typeof name !== 'string' || !name.trim()) continue;
    // Binh thư: id cố định của dòng; dòng không có id hợp lệ không phải danh tính canonical (không lùi về slug tên).
    if (kind === 'book' && !bookRowId(row)) continue;
    const key = kind === 'hero' ? canonicalHeroId(name) : kind === 'book' ? row.id : kind === 'tactic' && typeof row.id === 'string' && row.id.startsWith('tactic:') ? row.id : `${kind}:${normalizeText(name).replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '')}`;
    const previous = result.get(key);
    if (previous && (previous.viet !== row.viet || previous.chinese !== row.chinese)) result.set(key, null);
    else if (!result.has(key)) result.set(key, row);
  }
  return result;
}
function canonicalRefs(value, dictionaryIndex, allowEmpty = false) {
  ids(value, dictionaryIndex, allowEmpty); for (const ref of value) ensure(dictionaryIndex.get(ref));
}
function validateRegistry(state) {
  const { scenarios, proofs, rules } = state;
  for (const scenario of scenarios.values()) {
    object(scenario, ['schemaVersion', 'id', 'labelVi', 'aliases', 'region', 'kind', 'rulesets', 'sourceMappings', 'reviewStatus', 'evidenceRefs']);
    version(scenario.schemaVersion); text(scenario.labelVi); list(scenario.aliases).forEach(alias => text(alias)); ensure(new Set(scenario.aliases).size === scenario.aliases.length); ensure(scenario.region === 'VN' && ['introductory', 'scenario'].includes(scenario.kind)); review(scenario.reviewStatus);
    for (const rule of index(scenario.rulesets).values()) {
      object(rule, ['id', 'label', 'reviewStatus', 'evidenceRefs']); text(rule.label); review(rule.reviewStatus); rules.set(pairKey(scenario.id, rule.id), rule);
    }
  }
  for (const proof of proofs.values()) {
    object(proof, ['schemaVersion', 'id', 'provenance', 'canonicalRef', 'reviewStatus', 'claim'], ['sourceSeason', 'snapshotHash', 'configFingerprint']);
    version(proof.schemaVersion); provenance(proof.provenance); review(proof.reviewStatus);
    if ('sourceSeason' in proof) sourceSeason(proof.sourceSeason);
    if ('snapshotHash' in proof) hash(proof.snapshotHash);
    object(proof.claim, ['kind', 'scenarioId', 'rulesetId']); scope(proof.claim, state);
    const kind = proof.claim.kind;
    ensure(['scenario-attribution', 'ruleset-applicability', 'source-observation'].includes(kind));
    ensure(kind === 'scenario-attribution' ? proof.claim.scenarioId !== null && proof.claim.rulesetId === null : kind === 'ruleset-applicability' ? proof.claim.scenarioId !== null && proof.claim.rulesetId !== null : proof.claim.scenarioId === null && proof.claim.rulesetId === null);
    if ('configFingerprint' in proof) { hash(proof.configFingerprint); ensure(kind === 'ruleset-applicability'); }
    if (proof.canonicalRef !== null) {
      object(proof.canonicalRef, ['kind', 'id']); ensure(proof.reviewStatus === 'reviewed'); id(proof.canonicalRef.id);
      const lookup = { hero: state.heroes, tactic: state.tactics, book: state.books }[proof.canonicalRef.kind];
      ensure(lookup?.get(proof.canonicalRef.id));
    }
  }
  for (const scenario of scenarios.values()) {
    const reviewed = scenario.reviewStatus === 'reviewed';
    const evidence = refs(scenario.evidenceRefs, proofs, reviewed);
    if (reviewed) requireClaim(evidence, 'scenario-attribution', scenario.id);
    for (const rule of scenario.rulesets) {
      const reviewedRule = rule.reviewStatus === 'reviewed'; const evidence = refs(rule.evidenceRefs, proofs, reviewedRule);
      if (reviewedRule) { ensure(reviewed); requireClaim(evidence, 'ruleset-applicability', scenario.id, rule.id); }
    }
    for (const mapping of list(scenario.sourceMappings)) {
      object(mapping, ['sourceSeason', 'provenance', 'rulesetId', 'reviewStatus', 'evidenceRefs']); sourceSeason(mapping.sourceSeason); provenance(mapping.provenance); review(mapping.reviewStatus);
      scope({ scenarioId: scenario.id, rulesetId: mapping.rulesetId }, state, mapping.reviewStatus === 'reviewed');
      const evidence = refs(mapping.evidenceRefs, proofs, mapping.reviewStatus === 'reviewed');
      if (mapping.reviewStatus === 'reviewed') requireClaim(evidence, mapping.rulesetId === null ? 'scenario-attribution' : 'ruleset-applicability', scenario.id, mapping.rulesetId, mapping);
    }
  }
}
async function validateConfigs(state) {
  for (const config of state.configs.values()) {
    object(config, [...CONFIG_KEYS, 'reviewStatus', 'evidenceRefs', 'notes']); version(config.schemaVersion); id(config.teamId); ensure(state.teams.has(config.teamId)); review(config.reviewStatus);
    scope(config, state, config.reviewStatus === 'reviewed'); ensure(config.scenarioId !== null && config.rulesetId !== null);
    ids(config.unitTypes, null, false); ensure(config.unitTypes.every(unit => ['Kỵ', 'Cung', 'Thương', 'Khiên', 'Xe'].includes(unit))); text(config.notes, 20000, true);
    for (const slot of list(config.heroSlots, 3)) {
      object(slot, ['heroRefs', 'tacticSlots', 'bookSlots', 'statFocusRaw']); canonicalRefs(slot.heroRefs, state.heroes); text(slot.statFocusRaw, 20000, true);
      for (const tactic of list(slot.tacticSlots, 2)) { object(tactic, ['tacticRefs']); canonicalRefs(tactic.tacticRefs, state.tactics); }
      for (const book of list(slot.bookSlots, 3)) { object(book, ['bookRefs']); canonicalRefs(book.bookRefs, state.books, true); }
    }
    const requirements = index(config.requirements);
    for (const requirement of requirements.values()) {
      object(requirement, ['id', 'kind', 'mandatory', 'reviewStatus', 'descriptionRaw', 'evidenceRefs']);
      ensure(['advisor', 'proficiency', 'order', 'troop-mod', 'other'].includes(requirement.kind) && typeof requirement.mandatory === 'boolean'); review(requirement.reviewStatus); text(requirement.descriptionRaw, 20000, true); ensure(requirement.descriptionRaw.trim()); refs(requirement.evidenceRefs, state.proofs, requirement.reviewStatus === 'reviewed');
    }
    for (const bundle of index(config.effectBundles).values()) {
      object(bundle, ['id', 'labelRaw', 'effectsRaw', 'requirementIds', 'evidenceRefs']); text(bundle.labelRaw, 20000, true); text(bundle.effectsRaw, 20000, true); ensure(bundle.labelRaw.trim() && bundle.effectsRaw.trim()); ids(bundle.requirementIds, requirements); refs(bundle.evidenceRefs, state.proofs, config.reviewStatus === 'reviewed');
    }
    const evidence = refs(config.evidenceRefs, state.proofs, config.reviewStatus === 'reviewed');
    const fingerprint = await seasonFingerprint(configFingerprintProjection(config)); state.configHashes.set(config.id, fingerprint);
    if (config.reviewStatus === 'reviewed') {
      ensure(config.rulesetId !== null);
      ensure(evidence.some(proof => claimMatches(proof, 'ruleset-applicability', config.scenarioId, config.rulesetId) && proof.configFingerprint === fingerprint));
    }
  }
}
function validateSelection(selection, config) {
  object(selection, ['schemaVersion', 'configId', 'scenarioId', 'rulesetId', 'unitType', 'heroSlots', 'requirementIds', 'effectBundleIds']); version(selection.schemaVersion);
  ensure(selection.configId === config.id && selection.scenarioId === config.scenarioId && selection.rulesetId === config.rulesetId && config.unitTypes.includes(selection.unitType));
  const heroIds = [], tacticIds = [];
  list(selection.heroSlots, 3).forEach((slot, i) => {
    object(slot, ['heroRef', 'tacticRefs', 'bookRefs']); ensure(config.heroSlots[i].heroRefs.includes(slot.heroRef)); heroIds.push(slot.heroRef);
    list(slot.tacticRefs, 2).forEach((ref, j) => { ensure(config.heroSlots[i].tacticSlots[j].tacticRefs.includes(ref)); tacticIds.push(ref); });
    list(slot.bookRefs, 3).forEach((ref, j) => ensure(config.heroSlots[i].bookSlots[j].bookRefs.includes(ref)));
  });
  ensure(new Set(heroIds).size === heroIds.length && new Set(tacticIds).size === tacticIds.length);
  const requirements = index(config.requirements), bundles = index(config.effectBundles);
  ids(selection.requirementIds, requirements); ids(selection.effectBundleIds, bundles);
  ensure(canonicalSeasonJSON(selection.requirementIds) === canonicalSeasonJSON([...selection.requirementIds].sort(compareSeasonIds)) && canonicalSeasonJSON(selection.effectBundleIds) === canonicalSeasonJSON([...selection.effectBundleIds].sort(compareSeasonIds)));
  ensure(config.requirements.filter(r => r.mandatory).every(r => selection.requirementIds.includes(r.id)));
  ensure(selection.requirementIds.every(key => requirements.get(key).reviewStatus === 'reviewed'));
  ensure(selection.effectBundleIds.every(key => bundles.get(key).requirementIds.every(ref => selection.requirementIds.includes(ref))));
}
async function validateEvaluations(state) {
  for (const evaluation of state.evaluations.values()) {
    object(evaluation, ['schemaVersion', 'id', 'configId', 'scenarioId', 'rulesetId', 'rankings', 'sourceScore', 'defaultRankingId', 'reviewStatus', 'reviewNote']); version(evaluation.schemaVersion); review(evaluation.reviewStatus); text(evaluation.reviewNote, 20000, true);
    const config = state.configs.get(evaluation.configId); ensure(config && evaluation.scenarioId === config.scenarioId && evaluation.rulesetId === config.rulesetId);
    scope(evaluation, state, evaluation.reviewStatus === 'reviewed');
    if (evaluation.reviewStatus === 'reviewed') ensure(config.reviewStatus === 'reviewed');
    ensure(!state.evaluationByConfig.has(config.id)); state.evaluationByConfig.set(config.id, evaluation);
    const rankings = index(evaluation.rankings);
    for (const ranking of rankings.values()) { object(ranking, ['id', 'tier', 'evidenceRefs']); ensure(TIERS.has(ranking.tier)); const evidence = refs(ranking.evidenceRefs, state.proofs, evaluation.reviewStatus === 'reviewed'); if (evaluation.reviewStatus === 'reviewed') ensure(evidence.some(proof => claimMatches(proof, 'ruleset-applicability', config.scenarioId, config.rulesetId) && proof.configFingerprint === state.configHashes.get(config.id))); }
    if (evaluation.defaultRankingId !== null) ensure(rankings.has(evaluation.defaultRankingId) && evaluation.reviewStatus === 'reviewed' && evaluation.reviewNote.trim());
    const score = evaluation.sourceScore;
    if (score === null) continue;
    object(score, ['value', 'sourceConfigId', 'sourceSeason', 'provenance', 'evidenceRefs', 'sourceSnapshotHash', 'configFingerprint', 'selectionFingerprint', 'scoredSelection']);
    ensure(evaluation.reviewStatus === 'reviewed' && typeof score.value === 'number' && Number.isFinite(score.value) && score.value >= 0); id(score.sourceConfigId); sourceSeason(score.sourceSeason); provenance(score.provenance); const scoreProofs = refs(score.evidenceRefs, state.proofs, true); ensure(scoreProofs.some(proof => claimMatches(proof, 'ruleset-applicability', config.scenarioId, config.rulesetId) && proof.configFingerprint === score.configFingerprint && proof.provenance.region === score.provenance.region && proof.snapshotHash === score.sourceSnapshotHash && canonicalSeasonJSON(proof.sourceSeason ?? null) === canonicalSeasonJSON(score.sourceSeason)));
    hash(score.sourceSnapshotHash); hash(score.configFingerprint); hash(score.selectionFingerprint); validateSelection(score.scoredSelection, config);
    ensure(score.configFingerprint === state.configHashes.get(config.id) && score.selectionFingerprint === await seasonFingerprint(score.scoredSelection));
    state.scoreSelections.set(config.id, canonicalSeasonJSON(score.scoredSelection));
  }
}
function sourceLocator(locator) {
  object(locator, ['csvRecordStart', 'csvRecordEnd', 'lineStart', 'lineEnd']); ensure(Object.values(locator).every(n => Number.isSafeInteger(n) && n >= 1));
  ensure(locator.csvRecordEnd - locator.csvRecordStart === 2 && locator.lineEnd >= locator.lineStart);
}
async function validateContent(state) {
  const located = new Set(), sourceRecords = new Set();
  for (const link of state.links.values()) {
    object(link, ['schemaVersion', 'id', 'kind', 'recordId', 'scenarioId', 'rulesetId', 'configIds', 'reviewStatus', 'evidenceRefs', 'target']); version(link.schemaVersion); ensure(link.kind === 'coexist'); id(link.recordId); ensure(!sourceRecords.has(link.recordId)); sourceRecords.add(link.recordId); review(link.reviewStatus); scope(link, state, link.reviewStatus === 'reviewed');
    const evidence = refs(link.evidenceRefs, state.proofs, link.reviewStatus === 'reviewed');
    if (link.reviewStatus === 'reviewed') requireClaim(evidence, link.rulesetId === null ? 'scenario-attribution' : 'ruleset-applicability', link.scenarioId, link.rulesetId);
    ids(link.configIds, state.configs);
    for (const key of link.configIds) { const config = state.configs.get(key); ensure(link.reviewStatus === 'reviewed' && config.reviewStatus === 'reviewed' && config.scenarioId === link.scenarioId && config.rulesetId === link.rulesetId && config.evidenceRefs.some(ref => link.evidenceRefs.includes(ref))); }
    const target = link.target; ensure(target && typeof target === 'object');
    if (target.type === 'legacy-locator') {
      object(target, ['type', 'dataset', 'locator', 'contentFingerprint']); ensure(target.dataset === 'coexist'); object(target.locator, ['groupIndex']);
      ensure(Number.isSafeInteger(target.locator.groupIndex) && target.locator.groupIndex >= 0); hash(target.contentFingerprint);
      const matches = state.legacyHashes.flatMap((value, i) => value === target.contentFingerprint ? [i] : []);
      ensure(matches.length === 1 && matches[0] === target.locator.groupIndex);
      ensure(!located.has(pairKey(link.recordId, pairKey(link.scenarioId, link.rulesetId)))); located.add(pairKey(link.recordId, pairKey(link.scenarioId, link.rulesetId)));
      state.content.set(link.id, state.data.coexist[matches[0]]);
    } else if (target.type === 'source-owned-coexist') {
      object(target, ['type', 'source', 'contentFingerprint', 'payload']);
      object(target.source, ['id', 'format', 'snapshotHash', 'disclaimerRaw']);
      id(target.source.id); ensure(target.source.format === 'csv'); hash(target.source.snapshotHash); text(target.source.disclaimerRaw, 20000, true); ensure(target.source.disclaimerRaw.trim());
      hash(target.contentFingerprint); const payload = target.payload;
      object(payload, ['groupLabel', 'summaryRaw', 'openingSuggestionsRaw', 'notesRaw', 'teams']);
      text(payload.groupLabel); for (const key of ['summaryRaw', 'openingSuggestionsRaw', 'notesRaw']) text(payload[key], 20000, true);
      ensure(list(payload.teams).length > 0);
      for (const team of payload.teams) {
        object(team, ['recordId', 'sourceLocator', 'contentFingerprint', 'teamNameRaw', 'teamName', 'unitTacticEffectsRaw', 'heroes']); id(team.recordId); ensure(!sourceRecords.has(team.recordId)); sourceRecords.add(team.recordId);
        sourceLocator(team.sourceLocator); hash(team.contentFingerprint);
        text(team.teamName); for (const key of ['teamNameRaw', 'unitTacticEffectsRaw']) text(team[key], 20000, true); ensure(team.teamNameRaw.trim());
        for (const hero of list(team.heroes, 3)) {
          object(hero, ['nameRaw', 'tacticSlotsRaw', 'statFocusRaw', 'bookSlotsRaw']); text(hero.nameRaw, 20000, true); ensure(hero.nameRaw.trim()); text(hero.statFocusRaw, 20000, true);
          list(hero.tacticSlotsRaw, 2).forEach(value => text(value, 20000, true)); list(hero.bookSlotsRaw, 3).forEach(value => text(value, 20000, true));
        }
        ensure(team.contentFingerprint === await seasonFingerprint(contentFingerprintProjection(team)));
      }
      ensure(target.contentFingerprint === await seasonFingerprint(contentFingerprintProjection(payload)));
      ensure(evidence.some(proof => claimMatches(proof, 'source-observation', null, null) && proof.snapshotHash === target.source.snapshotHash));
      state.content.set(link.id, payload);
    } else fail();
  }
}

/** Accepts exactly five filename-without-extension sidecars and five canonical datasets. */
export async function validateSeasonBundle(input) {
  try {
    object(input, [...ARTIFACTS, ...DATASETS]); const data = structuredClone(input); for (const key of [...ARTIFACTS, ...DATASETS]) list(data[key]);
    const state = { data, scenarios: index(data['season-registry']), proofs: index(data['season-evidence']), configs: index(data['season-team-configs']), evaluations: index(data['season-team-evaluations']), links: index(data['season-content-links']), teams: index(data.teams), heroes: dictionary(data['heroes-dict'], 'hero'), tactics: dictionary(data.tactics, 'tactic'), books: dictionary(data['books-dict'], 'book'), rules: new Map(), configHashes: new Map(), evaluationByConfig: new Map(), scoreSelections: new Map(), content: new Map(), legacyHashes: [] };
    validateRegistry(state); await validateConfigs(state); await validateEvaluations(state);
    state.legacyHashes = await Promise.all(data.coexist.map(seasonFingerprint)); await validateContent(state);
    const model = freeze({ data }); MODELS.set(model, state); return model;
  } catch (error) { if (error instanceof SeasonContextError) throw error; throw new SeasonContextError(); }
}

/** Pure restoration: only an explicit new UI scenario selection may auto-select its sole reviewed rule. */
export function resolveBrowseState(model, selection = {}, { origin = 'restore' } = {}) {
  const state = modelIndex(model);
  const invalid = () => ({ kind: 'invalid', seasonContext: null, diagnostics: [resultError('SEASON_CONTEXT_INVALID')] });
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) || Object.keys(selection).some(k => !['scenarioId', 'rulesetId'].includes(k))) return invalid();
  const { scenarioId, rulesetId } = selection;
  if (scenarioId === undefined && rulesetId === undefined) return { kind: 'all-reference', seasonContext: null, diagnostics: [] };
  const scenario = state.scenarios.get(scenarioId);
  if (!scenario || scenario.reviewStatus !== 'reviewed') return invalid();
  if (rulesetId === undefined) {
    const reviewed = scenario.rulesets.filter(rule => rule.reviewStatus === 'reviewed');
    if (origin === 'scenario-change' && reviewed.length === 1) return resolveBrowseState(model, { scenarioId, rulesetId: reviewed[0].id });
    return { kind: 'scenario-reference', scenarioId, seasonContext: null, diagnostics: [] };
  }
  if (state.rules.get(pairKey(scenarioId, rulesetId))?.reviewStatus !== 'reviewed') return invalid();
  return { kind: 'verified-pair', scenarioId, rulesetId, seasonContext: { scenarioId, rulesetId }, diagnostics: [] };
}
export function resolveSeasonContext(model, context) {
  const browseState = resolveBrowseState(model, context);
  return browseState.kind === 'verified-pair' ? { ok: true, context: browseState.seasonContext } : resultError(browseState.kind === 'invalid' ? 'SEASON_CONTEXT_INVALID' : 'SEASON_CONTEXT_REQUIRED');
}
function requirementResults(config) {
  return config.requirements.map(requirement => ({ requirementId: requirement.id, supported: false, status: 'unknown', reason: requirement.reviewStatus === 'reviewed' ? 'unsupported-requirement' : 'unreviewed-requirement' }));
}
function displayConfig(state, config) {
  const canonical = state.teams.get(config.teamId), evaluation = state.evaluationByConfig.get(config.id);
  const reviewedEvaluation = evaluation?.reviewStatus === 'reviewed' ? evaluation : null;
  const effectiveRanking = reviewedEvaluation?.rankings.find(row => row.id === reviewedEvaluation.defaultRankingId) ?? null;
  const hero = ref => state.heroes.get(ref).viet;
  const choice = (slot, key, lookup) => ({ name: lookup.get(slot[key][0])?.viet || '', alternatives: slot[key].slice(1).map(ref => lookup.get(ref).viet) });
  const team = { ...canonical, id: config.teamId, configId: config.id, candidateKey: config.id, unitType: [...config.unitTypes], notes: config.notes, heroes: config.heroSlots.map(slot => {
    const name = hero(slot.heroRefs[0]);
    return { name, baseName: name.replace(/^(SP|CO)\s+/u, ''), isSP: /^SP\s/u.test(name), isCO: /^CO\s/u.test(name), alternatives: slot.heroRefs.slice(1).map(hero), tactics: slot.tacticSlots.map(s => choice(s, 'tacticRefs', state.tactics)), books: slot.bookSlots.map(s => choice(s, 'bookRefs', state.books)), statFocus: slot.statFocusRaw };
  }) };
  return { configId: config.id, candidateKey: config.id, teamId: config.teamId, config, team, evaluation: reviewedEvaluation, tier: effectiveRanking?.tier ?? null, sourceScore: reviewedEvaluation?.sourceScore ?? null, requirementResults: requirementResults(config), seasonContext: config.rulesetId === null ? null : { scenarioId: config.scenarioId, rulesetId: config.rulesetId } };
}
function classify(record, browseState) {
  if (record.scenarioId === null || record.reviewStatus !== 'reviewed') return browseState.kind === 'all-reference' ? 'unknown' : null;
  if (browseState.kind === 'all-reference') return 'scenarioReference';
  if (record.scenarioId !== browseState.scenarioId) return null;
  if (browseState.kind === 'scenario-reference') return 'scenarioReference';
  if (browseState.kind === 'verified-pair' && record.rulesetId === browseState.rulesetId) return 'applicable';
  return record.rulesetId === null ? 'scenarioReference' : null;
}
export function projectSeasonBrowse(model, browseState) {
  const state = modelIndex(model), output = { applicable: [], scenarioReference: [], unknown: [], coexist: { applicable: [], scenarioReference: [], unknown: [] }, diagnostics: [] };
  const resolved = browseState?.kind === 'all-reference' ? resolveBrowseState(model, {}) : browseState?.kind === 'scenario-reference' ? resolveBrowseState(model, { scenarioId: browseState.scenarioId }) : browseState?.kind === 'verified-pair' ? resolveBrowseState(model, { scenarioId: browseState.scenarioId, rulesetId: browseState.rulesetId }) : null;
  if (!resolved || resolved.kind === 'invalid') { output.diagnostics.push(resultError('SEASON_CONTEXT_INVALID')); return output; }
  for (const config of state.configs.values()) { const group = classify(config, resolved); if (group) output[group].push(displayConfig(state, config)); }
  const linkedLegacy = new Set();
  for (const link of state.links.values()) {
    if (link.target.type === 'legacy-locator') linkedLegacy.add(link.target.locator.groupIndex);
    const group = classify(link, resolved);
    if (group) output.coexist[group].push({ linkId: link.id, recordId: link.recordId, scenarioId: link.scenarioId, rulesetId: link.rulesetId, source: link.target.type === 'source-owned-coexist' ? link.target.source : null, content: state.content.get(link.id), configIds: link.configIds, reviewStatus: link.reviewStatus, classification: group });
  }
  if (resolved.kind === 'all-reference') {
    state.data.coexist.forEach((content, i) => { if (!linkedLegacy.has(i)) output.coexist.unknown.push({ recordId: null, content, source: null, classification: 'unknown' }); });
    const configuredTeams = new Set([...state.configs.values()].map(c => c.teamId));
    for (const team of state.teams.values()) if (!configuredTeams.has(team.id)) output.unknown.push({ teamId: team.id, team, configId: null, tier: null, sourceScore: null, requirementResults: [] });
  }
  return output;
}
export function projectSeasonCandidates(model, context, policy = {}) {
  const state = modelIndex(model), resolved = resolveSeasonContext(model, context);
  if (!resolved.ok) return { ...resolved, teams: [], teamTier: [], diagnostics: [resolved] };
  const diagnostics = [], eligible = [];
  for (const config of state.configs.values()) {
    if (config.reviewStatus !== 'reviewed' || config.scenarioId !== context.scenarioId || config.rulesetId !== context.rulesetId) continue;
    const display = displayConfig(state, config);
    const unmet = config.requirements.filter(r => r.mandatory).map(r => display.requirementResults.find(result => result.requirementId === r.id));
    if (unmet.length) { diagnostics.push({ code: 'REQUIREMENT_UNVERIFIED', configId: config.id, teamId: config.teamId, requirements: unmet }); continue; }
    if (policy.mode !== 'all' && !META_TIERS.has(display.tier) && !(policy.experimentalUntiered === true && display.tier === null)) continue;
    eligible.push(display);
  }
  const limits = { maxCandidates: 500, candidateCount: eligible.length };
  if (eligible.length > 500) return { ...resultError('CANDIDATE_LIMIT_EXCEEDED'), limits, teams: [], teamTier: [], diagnostics: [...diagnostics, { code: 'CANDIDATE_LIMIT_EXCEEDED', limits }] };
  for (const lock of policy.lockedTeams ?? []) if (![...state.configs.values()].some(config => config.reviewStatus === 'reviewed' && config.scenarioId === context.scenarioId && config.rulesetId === context.rulesetId && config.teamId === lock.teamId && (!lock.configId || config.id === lock.configId))) diagnostics.push({ code: 'LOCKED_TEAM_OUT_OF_SCOPE', teamId: lock.teamId, ...(lock.configId ? { configId: lock.configId } : {}) });
  return { ok: true, seasonContext: { ...context }, teams: eligible.map(item => item.team), teamTier: eligible.map(item => ({ teamId: item.teamId, candidateKey: item.configId, configId: item.configId, rankings: item.tier === null ? [] : [{ tier: item.tier }] })), diagnostics, limits };
}
export function resolveTeamConfig(model, request = {}) {
  const state = modelIndex(model);
  if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some(key => !['teamId', 'configId', 'context'].includes(key))) return resultError('CONFIG_NOT_FOUND');
  const { teamId, configId, context } = request;
  if (teamId === undefined && configId === undefined) return resultError('CONFIG_NOT_FOUND');
  try { if (teamId !== undefined) id(teamId); if (configId !== undefined) id(configId); } catch { return resultError('CONFIG_NOT_FOUND'); }
  const resolved = resolveSeasonContext(model, context);
  if (!resolved.ok) return resolved;
  const choices = [...state.configs.values()].filter(config => config.reviewStatus === 'reviewed' && config.scenarioId === context.scenarioId && config.rulesetId === context.rulesetId && (teamId === undefined || config.teamId === teamId) && (configId === undefined || config.id === configId));
  if (!choices.length) return resultError('CONFIG_NOT_FOUND');
  if (choices.length > 1) {
    const configIds = choices.map(config => config.id).sort(compareSeasonIds);
    return resultError('CONFIG_AMBIGUOUS', { choices: { kind: 'team-config', teamId: teamId ?? choices[0].teamId, configIds: configIds.slice(0, 20), totalCount: configIds.length, omittedCount: Math.max(0, configIds.length - 20) } });
  }
  const display = displayConfig(state, choices[0]); return { ok: true, config: choices[0], team: display.team, evaluation: display.evaluation };
}
export function resolveSelectionScore(model, configId, actualSelection) {
  const state = modelIndex(model), evaluation = state.evaluationByConfig.get(configId);
  if (!evaluation?.sourceScore || evaluation.reviewStatus !== 'reviewed' || !actualSelection) return null;
  try { return canonicalSeasonJSON(actualSelection) === state.scoreSelections.get(configId) ? evaluation.sourceScore : null; } catch { return null; }
}
/** Derives only explicit final choices or unambiguous fixed values; never fills from scoredSelection. */
export function selectionFromEntry(model, entry) {
  const state = modelIndex(model), config = state.configs.get(entry?.configId);
  if (!config || entry.team?.id !== config.teamId || !entry.seasonContext || entry.seasonContext.scenarioId !== config.scenarioId || entry.seasonContext.rulesetId !== config.rulesetId) return null;
  if (config.unitTypes.length !== 1 || config.requirements.length || config.effectBundles.length || config.heroSlots.some(slot => slot.bookSlots.some(book => book.bookRefs.length !== 1))) return null;
  try {
    const assignments = entry.heroAssignments; ensure(Array.isArray(assignments) && assignments.length === 3);
    const selection = { schemaVersion: 1, configId: config.id, scenarioId: config.scenarioId, rulesetId: config.rulesetId, unitType: config.unitTypes[0], heroSlots: config.heroSlots.map((slot, i) => {
      const heroRef = assignments[i].canonicalId;
      const selected = [0, 1].map(slotIndex => { const matches = entry.tacticSelections.filter(t => t.holderId === heroRef && t.slotIndex === slotIndex); ensure(matches.length === 1); return matches[0].selectedTacticId; });
      return { heroRef, tacticRefs: selected, bookRefs: slot.bookSlots.map(book => book.bookRefs[0]) };
    }), requirementIds: [], effectBundleIds: [] };
    validateSelection(selection, config); return selection;
  } catch { return null; }
}
