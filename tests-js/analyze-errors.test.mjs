import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYZE_ACTION_ERROR,
  ANALYZE_GENERIC_ERROR,
  callWorker,
  callWorkerExplain,
  describeAnalyzeError,
  localizeWorkerError,
  validateWorkerResult,
} from '../js/analyze.js';

test('known and unknown upstream errors never expose provider text', () => {
  assert.equal(localizeWorkerError('服务器内部错误', 500), ANALYZE_GENERIC_ERROR);
  assert.equal(localizeWorkerError('unexpected provider stack trace', 500), ANALYZE_GENERIC_ERROR);
  assert.equal(describeAnalyzeError(new Error('服务器内部错误'), ANALYZE_ACTION_ERROR), ANALYZE_ACTION_ERROR);
});

test('worker failures are thrown as bounded localized errors', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    async json() { return {error: '服务器内部错误'}; },
  });
  await assert.rejects(
    callWorker('data:image/png;base64,AA==', 'token'),
    error => error.localized === true && error.message === ANALYZE_GENERIC_ERROR && !/服务器/u.test(error.message),
  );
});

test('successful malformed or mode-mismatched responses are rejected', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const payload of [
    {json: async () => { throw new SyntaxError('invalid JSON'); }},
    {json: async () => ({heroes: [{nameCn: '关羽'}]})},
  ]) {
    globalThis.fetch = async () => ({ok: true, status: 200, ...payload});
    await assert.rejects(
      callWorker('data:image/png;base64,AA==', 'token', 'scanTactics'),
      error => error.localized === true && error.message === ANALYZE_GENERIC_ERROR,
    );
  }
});

test('mode validators accept nonempty Worker envelopes including tactics-only teams', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const cases = [
    ['scanHeroes', {heroes: [{nameCn: '关羽', level: 50, redStars: 3}]}],
    ['scanTactics', {tactics: [{nameCn: '草船借箭'}]}],
    ['scanBuiltTeams', {teams: [{teamName: 'Đội số 1', heroesCn: [], tacticsCn: ['草船借箭']}]}],
    ['analyzeTeamImage', {heroes: [{nameCn: '关羽', tacticsCn: [], booksCn: [], statFocusCn: ''}]}],
  ];
  for (const [mode, payload] of cases) {
    globalThis.fetch = async () => ({ok: true, status: 200, async json() { return payload; }});
    assert.deepEqual(await callWorker('data:image/png;base64,AA==', 'token', mode), payload);
  }
});

test('Worker AI and configuration failures get their own Vietnamese sentences', () => {
  const overloaded = localizeWorkerError('Dịch vụ AI đang quá tải, thử lại sau', 503);
  const upstream = localizeWorkerError('Dịch vụ AI tạm lỗi, thử lại sau', 502);
  const unknown502 = localizeWorkerError('unexpected gateway text', 502);
  const unconfigured = localizeWorkerError('Dịch vụ soi ảnh chưa được cấu hình', 503);
  const paused = localizeWorkerError('unexpected text', 503);
  const sentences = [overloaded, upstream, unconfigured, paused];
  for (const sentence of sentences) {
    assert.notEqual(sentence, ANALYZE_GENERIC_ERROR);
    assert.doesNotMatch(sentence, /\d/u);
  }
  assert.equal(new Set(sentences).size, sentences.length);
  assert.equal(unknown502, upstream);
});

const EXPLAIN_CONTEXT = {
  locale: 'vi',
  hero: 'Quan Vũ',
  missing: {name: 'Uy Chấn Hoa Hạ', effect: 'Gây sát thương binh nhận.'},
  substitute: {name: 'Hoành Qua Dược Mã', effect: 'Gây sát thương binh nhận lên toàn địch.'},
  configCount: 2,
};

test('callWorkerExplain posts a text-only explainSubstitute request and returns { explanation }', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({url, init});
    return {ok: true, status: 200, async json() { return {explanation: 'Cả hai gây sát thương binh nhận.', extra: 1}; }};
  };
  assert.deepEqual(await callWorkerExplain(EXPLAIN_CONTEXT, 'token-1'), {explanation: 'Cả hai gây sát thương binh nhận.'});
  assert.equal(sent.length, 1);
  assert.equal(sent[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(sent[0].init.body), {mode: 'explainSubstitute', turnstileToken: 'token-1', context: EXPLAIN_CONTEXT});
});

test('callWorkerExplain rejects empty, oversized or mis-shaped explanations', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const payload of [
    {explanation: ''},
    {explanation: '   '},
    {explanation: 'x'.repeat(601)},
    {explanation: ['a']},
    {heroes: [{nameCn: '关羽', tacticsCn: [], booksCn: [], statFocusCn: ''}]},
  ]) {
    globalThis.fetch = async () => ({ok: true, status: 200, async json() { return payload; }});
    await assert.rejects(
      callWorkerExplain(EXPLAIN_CONTEXT, 'token'),
      error => error.localized === true && error.message === ANALYZE_GENERIC_ERROR,
    );
  }
});

test('callWorkerExplain maps Worker errors to fixed localized sentences', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const cannotExplain = localizeWorkerError('Không giải thích được', 422);
  assert.notEqual(cannotExplain, localizeWorkerError('unexpected text', 422), 'explain 422 must not reuse the image sentence');
  for (const [status, raw, expected] of [
    [422, 'Không giải thích được', cannotExplain],
    [429, 'Bạn thử quá nhiều lần, đợi chút', localizeWorkerError('Bạn thử quá nhiều lần, đợi chút', 429)],
    [400, 'Ngữ cảnh không hợp lệ', localizeWorkerError('Body JSON không hợp lệ', 400)],
    [502, 'upstream provider 402 detail', localizeWorkerError('Dịch vụ AI tạm lỗi, thử lại sau', 502)],
  ]) {
    globalThis.fetch = async () => ({ok: false, status, async json() { return {error: raw}; }});
    await assert.rejects(callWorkerExplain(EXPLAIN_CONTEXT, 'token'), error => {
      assert.equal(error.localized, true);
      assert.equal(error.status, status);
      assert.equal(describeAnalyzeError(error, ANALYZE_ACTION_ERROR), expected);
      assert.doesNotMatch(error.message, /upstream|\d/u);
      return true;
    });
  }
});

const HERO_READ = {nameCn: '曹操', tacticsCn: ['魅惑'], booksCn: [], statFocusCn: ''};

test('validateWorkerResult analyzeTeamImage: dạng {heroes} hợp lệ, hero hỏng bị loại', () => {
  assert.equal(validateWorkerResult('analyzeTeamImage', {heroes: [HERO_READ]}), true);
  assert.equal(validateWorkerResult('analyzeTeamImage', {heroes: []}), false);
  assert.equal(validateWorkerResult('analyzeTeamImage', {heroes: [{...HERO_READ, nameCn: ' '}]}), false);
  assert.equal(validateWorkerResult('analyzeTeamImage', {heroes: [{...HERO_READ, tacticsCn: 'x'}]}), false);
  assert.equal(validateWorkerResult('analyzeTeamImage', null), false);
});

test('validateWorkerResult analyzeTeamImage: nhận 2 phe, từ chối khi một tướng hỏng hoặc thiếu phe', () => {
  const two = {screen: 'battleReport', sides: [{side: 'left', heroes: [HERO_READ]}, {side: 'right', heroes: [HERO_READ]}]};
  assert.equal(validateWorkerResult('analyzeTeamImage', two), true);
  const bad = {sides: [{side: 'left', heroes: [HERO_READ]}, {side: 'right', heroes: [{...HERO_READ, booksCn: [1]}]}]};
  assert.equal(validateWorkerResult('analyzeTeamImage', bad), false);
  assert.equal(validateWorkerResult('analyzeTeamImage', {screen: 'other', sides: []}), false);
});
