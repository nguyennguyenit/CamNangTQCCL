import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ANALYZE_ACTION_ERROR,
  ANALYZE_GENERIC_ERROR,
  callWorker,
  describeAnalyzeError,
  localizeWorkerError,
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
