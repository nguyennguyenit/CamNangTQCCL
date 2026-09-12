import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  EXECUTION_PROFILE_HASH,
  assertParity,
  createNativeEventInspector,
  decodeAgentResponse,
  decodeStructuredAgentResponse,
  runConversation,
} from './model-session.mjs';

test('terminal prose is observable but never dispatched as an action', () => {
  const text = '## Kết luận\nĐã đọc nguồn; chưa xác minh live.';
  assert.deepEqual(decodeAgentResponse(text), { actions: [], answer: text, format: 'terminal-text' });
  assert.deepEqual(decodeAgentResponse('{"actions":[{"op":"list"}],"answer":""}'), { actions: [{ op: 'list' }], answer: '' });
  for (const value of ['{broken', '[broken', 'null', '42', '', '{"actions":[],"answer":4}']) {
    assert.throws(() => decodeAgentResponse(value), /MALFORMED/);
  }
});

test('candidate rejects changed prompts, source bytes and permissions', () => {
  const packet = { prompt: 'probe', context: 'same', sources: { 'input.txt': 'real probe' }, reportKey: null };
  const baseline = {
    status: 'OBSERVED',
    parityHash: createHash('sha256').update(JSON.stringify(packet)).digest('hex'),
    executionProfileHash: EXECUTION_PROFILE_HASH,
  };
  assert.doesNotThrow(() => assertParity(packet, baseline));
  for (const status of ['ENVIRONMENT_BLOCKED', 'INCOMPLETE', 'NOT_RUN', 'MALFORMED']) {
    assert.throws(() => assertParity(packet, { ...baseline, status }), /BASELINE_NOT_OBSERVED/);
  }
  for (const delta of [{ prompt: 'changed' }, { sources: { 'input.txt': 'different' } }, { reportKey: 'new.md' }]) {
    assert.throws(() => assertParity({ ...packet, ...delta }, baseline), /INPUT_PARITY_MISMATCH/);
  }
  assert.throws(
    () => assertParity(packet, { ...baseline, executionProfileHash: 'old-profile' }),
    /EXECUTION_PROFILE_MISMATCH/,
  );
});

test('structured output is authoritative and contaminated prose is ignored', () => {
  const event = {
    result: '{"actions":[]}\n\nuser{"results":[{"ok":true}]}',
    structured_output: { actions: [{ op: 'read', path: 'docs/source.txt' }], answer: '' },
  };
  assert.deepEqual(decodeStructuredAgentResponse(event), event.structured_output);
  assert.throws(
    () => decodeStructuredAgentResponse({ result: '{"actions":[],"answer":"unsafe fallback"}' }),
    /MISSING_STRUCTURED_OUTPUT/,
  );
  assert.throws(
    () => decodeStructuredAgentResponse({ structured_output: { actions: [], answer: 4 } }),
    /MALFORMED/,
  );
  assert.throws(
    () => decodeStructuredAgentResponse({ structured_output: { actions: [], answer: '', results: [] } }),
    /MALFORMED/,
  );
});

test('native inspector permits only the pinned structured transport capability', () => {
  const inspector = createNativeEventInspector();
  inspector.observe({
    type: 'system', subtype: 'init', model: 'claude-opus-5', claude_code_version: '2.1.263',
    tools: ['StructuredOutput'], mcp_servers: [],
  });
  inspector.observe({ message: { content: [{ type: 'tool_use', name: 'StructuredOutput', id: 'tool-1', input: {
    actions: [{ op: 'shell', cmd: 'echo denied' }], answer: '',
  } }] } });
  assert.deepEqual(inspector.state(), { initialized: true, violation: false, structuredToolUses: 1 });

  for (const event of [
    { type: 'system', subtype: 'init', model: 'claude-opus-5', claude_code_version: '2.1.263', tools: [], mcp_servers: [] },
    { type: 'system', subtype: 'init', model: 'claude-opus-5', claude_code_version: '2.1.263', tools: ['StructuredOutput', 'Read'], mcp_servers: [] },
    { type: 'system', subtype: 'init', model: 'claude-opus-5', claude_code_version: '2.1.263', tools: ['StructuredOutput'], mcp_servers: [{}] },
    { message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } },
  ]) {
    const rejected = createNativeEventInspector();
    rejected.observe(event);
    assert.equal(rejected.state().violation, true);
  }
});

test('unknown structured actions reach the guard denial ledger', async () => {
  const { createGuard } = await import('./guard.mjs');
  const guard = createGuard({ sources: {}, reportPath: null, reportKey: null });
  const decoded = decodeStructuredAgentResponse({
    structured_output: { actions: [{ op: 'shell', cmd: 'echo denied' }], answer: '' },
  });
  assert.equal(guard.dispatch(decoded.actions[0]).error, 'ACTION_DENIED');
  assert.equal(guard.trace[0].action.op, 'shell');
  assert.equal(guard.trace[0].state, 'denied');
});

test('closure turn can answer but cannot execute further actions', async () => {
  const { createGuard } = await import('./guard.mjs');
  const guard = createGuard({ sources: {}, reportPath: null, reportKey: null });
  const replies = Array.from({ length: 5 }, () => ({ actions: [{ op: 'list' }], answer: '' }));
  replies.push({ actions: [{ op: 'create_report', path: 'plans/reports/denied.md', content: 'x' }], answer: '' });
  const incomplete = await runConversation({
    guard,
    invoke: async () => replies.shift(),
    actionRounds: 5,
    closureRounds: 1,
  });
  assert.equal(incomplete.status, 'INCOMPLETE');
  assert.equal(guard.trace.at(-1).error, 'ACTION_BUDGET_EXHAUSTED');

  const answeringGuard = createGuard({ sources: {}, reportPath: null, reportKey: null });
  const answers = Array.from({ length: 5 }, () => ({ actions: [{ op: 'list' }], answer: '' }));
  answers.push({ actions: [], answer: 'Kết luận sau lượt cuối.' });
  const observed = await runConversation({
    guard: answeringGuard,
    invoke: async () => answers.shift(),
    actionRounds: 5,
    closureRounds: 1,
  });
  assert.equal(observed.status, 'OBSERVED');
  assert.equal(observed.answer, 'Kết luận sau lượt cuối.');
});

test('independent guard instances never expose reports from another branch', async () => {
  const { createGuard } = await import('./guard.mjs');
  const a = createGuard({ sources: { 'own-report.md': 'branch-a-marker' } });
  const b = createGuard({ sources: { 'own-report.md': 'branch-b-marker' } });
  assert.equal(a.dispatch({ op: 'read', path: 'own-report.md' }).content, 'branch-a-marker');
  assert.deepEqual(b.dispatch({ op: 'search', query: 'branch-a-marker' }).matches, []);
});
