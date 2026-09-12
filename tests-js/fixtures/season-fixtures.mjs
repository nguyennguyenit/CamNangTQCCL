import { createHash } from 'node:crypto';
import { seasonFingerprint, configFingerprintProjection, contentFingerprintProjection } from '../../js/season-context.js';
export const context = { scenarioId: 'scenario-a', rulesetId: 'rules-a' };

export function seasonFixture() {
  const provenance = { provider: 'fixture', region: 'VN', sourceUrl: 'https://example.org/season', fetchedAt: '2026-09-12' };
  const evidence = [
    { id: 'scenario-proof', kind: 'scenario-attribution', rulesetId: null },
    { id: 'rule-proof', kind: 'ruleset-applicability', rulesetId: 'rules-a' },
  ].map(({ id, kind, rulesetId }) => ({ schemaVersion: 1, id, provenance: { ...provenance }, canonicalRef: null, note: 'Test evidence only.', reviewStatus: 'reviewed', claim: { kind, scenarioId: 'scenario-a', rulesetId } }));
  const heroes = ['Anh', 'Bình', 'Cường', 'Dũng', 'Em', 'Giang'].map((viet) => ({ viet, chinese: viet, faction: 'Thục' }));
  const tactics = ['Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy'].map((viet) => ({ viet, chinese: viet }));
  const books = ['Binh thư một', 'Binh thư hai', 'Binh thư ba'].map((viet) => ({ viet, chinese: viet }));
  const teams = [{ id: 'team-a', name: 'Đội A', source: 'team-intro', faction: 'Thục', heroes: [] }];
  const config = { schemaVersion: 1, id: 'config-a', teamId: 'team-a', ...context, reviewStatus: 'reviewed', evidenceRefs: ['rule-proof'], unitTypes: ['Thương'],
    heroSlots: ['anh', 'binh', 'cuong'].map((name, i) => ({ heroRefs: [`hero:${name}`], tacticSlots: [['mot', 'hai'], ['ba', 'bon'], ['nam', 'sau']][i].map((id) => ({ tacticRefs: [`tactic:${id}`] })), bookSlots: ['mot', 'hai', 'ba'].map((id) => ({ bookRefs: [`book:binh-thu-${id}`] })), statFocusRaw: '' })),
    requirements: [], effectBundles: [], notes: '' };
  const data = {
    'season-registry': [{ schemaVersion: 1, id: 'scenario-a', labelVi: 'Kịch bản A', aliases: [], region: 'VN', kind: 'scenario', rulesets: [{ id: 'rules-a', label: 'Luật A', reviewStatus: 'reviewed', evidenceRefs: ['rule-proof'] }], sourceMappings: [], reviewStatus: 'reviewed', evidenceRefs: ['scenario-proof'] }],
    'season-evidence': evidence,
    'season-team-configs': [config],
    'season-team-evaluations': [{ schemaVersion: 1, id: 'eval-a', configId: config.id, ...context, rankings: [{ id: 'rank-a', tier: 'T0', evidenceRefs: ['rule-proof'] }], sourceScore: null, defaultRankingId: 'rank-a', reviewStatus: 'reviewed', reviewNote: 'Reviewed fixture ranking.' }],
    'season-content-links': [], teams, coexist: [], 'heroes-dict': heroes, tactics, 'books-dict': books,
  };
  refreshConfigProofs(data);
  return data;
}

export function refreshConfigProofs(data) {
  const encode = value => Array.isArray(value) ? value.map(encode) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, encode(value[k])])) : value;
  const keys = ['schemaVersion','id','teamId','scenarioId','rulesetId','unitTypes','heroSlots','requirements','effectBundles'];
  data['season-evidence'] = data['season-evidence'].filter(proof => !proof.id.startsWith('config-proof-'));
  for (const config of data['season-team-configs']) {
    const proofId = 'config-proof-' + config.id; config.evidenceRefs = [proofId];
    const configFingerprint = 'sha256:' + createHash('sha256').update(JSON.stringify(encode(Object.fromEntries(keys.map(k => [k,config[k]]))))).digest('hex');
    const proof = structuredClone(data['season-evidence'].find(p => p.id === 'rule-proof'));
    data['season-evidence'].push({...proof,id:proofId,configFingerprint});
    for (const evaluation of data['season-team-evaluations'].filter(e=>e.configId===config.id)) for (const ranking of evaluation.rankings) ranking.evidenceRefs=[proofId];
  }
  return data;
}

export function scoredSelection(config) {
  return { schemaVersion: 1, configId: config.id, scenarioId: config.scenarioId, rulesetId: config.rulesetId, unitType: config.unitTypes[0], heroSlots: config.heroSlots.map((slot) => ({ heroRef: slot.heroRefs[0], tacticRefs: slot.tacticSlots.map((s) => s.tacticRefs[0]), bookRefs: slot.bookSlots.map((s) => s.bookRefs[0]) })), requirementIds: [], effectBundleIds: [] };
}

// One controlled corpus for browser/MCP parity; never published as game data.
export async function seasonConsumerFixture() {
  const data = seasonFixture();
  const config = data['season-team-configs'][0];
  config.heroSlots[0].tacticSlots[0].tacticRefs.push('tactic:bay');
  const sibling = structuredClone(config);
  sibling.id = 'config-b';
  sibling.heroSlots[0].tacticSlots.reverse();
  const conditional = structuredClone(config);
  conditional.id = 'config-conditional';
  conditional.teamId = 'team-conditional';
  conditional.requirements = [{ id: 'advisor-condition', kind: 'advisor', mandatory: true, reviewStatus: 'reviewed', descriptionRaw: 'Cần quân sư chưa có trong kho kiểm chứng', evidenceRefs: ['rule-proof'] }];
  data.teams.push({ ...structuredClone(data.teams[0]), id: conditional.teamId, name: 'Đội cần quân sư' });
  data['season-team-configs'].push(sibling, conditional);
  const originalEvaluation = data['season-team-evaluations'][0];
  for (const candidate of [sibling, conditional]) {
    data['season-team-evaluations'].push({ ...structuredClone(originalEvaluation), id: 'eval-' + candidate.id, configId: candidate.id });
  }
  refreshConfigProofs(data);
  const selection = scoredSelection(config);
  const score = {
    provider: 'sgsdeck', value: 132.5, sourceConfigId: 'source-a', sourceSeason: { label: 'Fixture' },
    provenance: { provider: 'sgsdeck', region: 'VN', sourceUrl: 'https://example.org/recommended', fetchedAt: '2026-09-12' },
    evidenceRefs: ['score-proof'], sourceSnapshotHash: `sha256:${'a'.repeat(64)}`,
    configFingerprint: await seasonFingerprint(configFingerprintProjection(config)),
    selectionFingerprint: await seasonFingerprint(selection), scoredSelection: selection,
  };
  originalEvaluation.sourceScore = score;
  data['season-evidence'].push({ ...structuredClone(data['season-evidence'].find(proof => proof.id === config.evidenceRefs[0])), id: 'score-proof', provenance: { ...score.provenance }, snapshotHash: score.sourceSnapshotHash, sourceSeason: { ...score.sourceSeason } });
  const source = { id: 'fixture-sheet', url: 'https://example.org/sheet', sheetId: 'sheet-fixture', gid: '123', format: 'csv', snapshotHash: `sha256:${'c'.repeat(64)}`, disclaimerRaw: 'Tham khảo nguồn\nGiữ nguyên điều kiện.' };
  const team = {
    recordId: 'source-team-a', sourceLocator: { csvRecordStart: 2, csvRecordEnd: 4, lineStart: 2, lineEnd: 7 },
    teamNameRaw: 'Đội A (chủ lực)', teamName: 'Đội A', unitTacticEffectsRaw: 'Cải tạo\nGiữ điều kiện',
    heroes: ['Anh (quân sư)', 'Bình', 'Cường'].map(nameRaw => ({ nameRaw, tacticSlotsRaw: ['Lựa chọn A / B', ''], statFocusRaw: '1/2 Trí\n1/2 Thống', bookSlotsRaw: ['Binh thư', '', ''] })),
  };
  team.contentFingerprint = await seasonFingerprint(contentFingerprintProjection(team));
  const payload = { groupLabel: 'Nhóm A', summaryRaw: 'Dòng một\nDòng hai', openingSuggestionsRaw: 'Gợi ý khai hoang', notesRaw: '<img src=x onerror=alert(1)>', teams: [team] };
  const sourceProvenance = { provider: 'google-sheets', region: 'VN', sourceUrl: source.url, fetchedAt: '2026-09-12' };
  data['season-evidence'].push({ schemaVersion: 1, id: 'source-proof', provenance: sourceProvenance, canonicalRef: null, note: 'Source fixture only', reviewStatus: 'reviewed', claim: { kind: 'source-observation', scenarioId: null, rulesetId: null }, snapshotHash: source.snapshotHash });
  data['season-evidence'].push({ ...structuredClone(data['season-evidence'][0]), id: 'source-attribution', provenance: { ...sourceProvenance } });
  data['season-content-links'] = [{ schemaVersion: 1, id: 'link-a', kind: 'coexist', recordId: 'source-group-a', scenarioId: context.scenarioId, rulesetId: null, configIds: [], reviewStatus: 'reviewed', evidenceRefs: ['source-attribution', 'source-proof'], target: { type: 'source-owned-coexist', source, payload, contentFingerprint: await seasonFingerprint(contentFingerprintProjection(payload)) } }];
  data.coexist = [{ groupLabel: 'Unknown old group', teams: [] }];
  return data;
}
