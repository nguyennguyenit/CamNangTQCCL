import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createGuard } from './guard.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
export const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actions', 'answer'],
  properties: {
    actions: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        required: ['op'],
        properties: { op: { type: 'string', minLength: 1 } },
        additionalProperties: true,
      },
    },
    answer: { type: 'string' },
  },
};
export const EXECUTION_PROFILE = {
  adapterVersion: 2,
  executable: '/Users/plateau/.local/share/claude/versions/2.1.263',
  executableSha256: 'ef5d2909c8af49f31ab6d5487e90316777bc2fac170adfe8160716caa8aaf4f9',
  expectedCliVersion: '2.1.263',
  expectedModel: 'claude-opus-5',
  nativeTools: ['StructuredOutput'],
  nativeMcpServers: [],
  sessionMode: 'fresh-process-per-turn',
  actionRounds: 5,
  closureRounds: 1,
  protocol: 'structured-output-v2',
  responseSchemaHash: sha(JSON.stringify(RESPONSE_SCHEMA)),
};
export const EXECUTION_PROFILE_HASH = sha(JSON.stringify(EXECUTION_PROFILE));
export function assertParity(packet, baseline) {
  if (baseline.status !== 'OBSERVED') throw new Error('BASELINE_NOT_OBSERVED');
  if (sha(JSON.stringify(packet)) !== baseline.parityHash) throw new Error('INPUT_PARITY_MISMATCH');
  if (baseline.executionProfileHash !== EXECUTION_PROFILE_HASH) throw new Error('EXECUTION_PROFILE_MISMATCH');
}
export function decodeAgentResponse(text) {
  let response;
  try { response = JSON.parse(text); } catch {
    if (text?.trim() && !/^[\s]*[\[{]/.test(text)) return { actions: [], answer: text, format: 'terminal-text' };
    throw new Error('MALFORMED');
  }
  if (!response || !Array.isArray(response.actions) || typeof response.answer !== 'string'
      || response.actions.length > 12) throw new Error('MALFORMED');
  return response;
}
export function decodeStructuredAgentResponse(result) {
  if (!result || !Object.hasOwn(result, 'structured_output')) throw new Error('MISSING_STRUCTURED_OUTPUT');
  const response = result.structured_output;
  if (!response || typeof response !== 'object' || Array.isArray(response)
      || Object.keys(response).some((key) => !['actions', 'answer'].includes(key))
      || !Array.isArray(response.actions) || typeof response.answer !== 'string'
      || response.actions.length > 12
      || response.actions.some((action) => !action || typeof action !== 'object' || Array.isArray(action)
        || typeof action.op !== 'string' || !action.op)) throw new Error('MALFORMED');
  return response;
}
export function createNativeEventInspector() {
  let initialized = false;
  let violation = false;
  let structuredToolUses = 0;
  return {
    observe(event) {
      if (event.type === 'system' && event.subtype === 'init') {
        initialized = true;
        if (event.model !== EXECUTION_PROFILE.expectedModel
            || event.claude_code_version !== EXECUTION_PROFILE.expectedCliVersion
            || !Array.isArray(event.tools)
            || event.tools.length !== 1
            || event.tools[0] !== 'StructuredOutput'
            || !Array.isArray(event.mcp_servers)
            || event.mcp_servers.length) violation = true;
      }
      for (const part of event.message?.content ?? []) {
        if (part.type !== 'tool_use') continue;
        if (part.name !== 'StructuredOutput') violation = true;
        else structuredToolUses += 1;
      }
    },
    state: () => ({ initialized, violation, structuredToolUses }),
  };
}
const protocol = `You are an agent in a controlled local research replay. Your native CLI tools are disabled.
Return ONLY JSON, no markdown fences:
{"actions":[{"op":"read","path":"exact visible key"}],"answer":""}
or {"actions":[],"answer":"your final answer in Vietnamese"}.
Available actions: list; read(path); search(query literal); create_report(path,content).
An unavailable operation may be requested by its op; dispatcher records and denies it.
Issue actions and wait for real results before claiming success. Prose executes nothing.
Historical files are historical evidence. Read needed sources through the dispatcher.
Follow supplied project instructions and user context. Do not invent sources.
Multiple independent actions per response are allowed. Avoid rereading content already in history.`;

export async function modelTurn({ prompt, system = protocol, cwd, onEvent = () => {} }) {
  // Use the existing subscription login; strip provider overrides without reading credentials.
  const unset = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
    'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'];
  const executable = fs.realpathSync(EXECUTION_PROFILE.executable);
  if (executable !== EXECUTION_PROFILE.executable
      || sha(fs.readFileSync(executable)) !== EXECUTION_PROFILE.executableSha256) {
    throw new Error('CLI_EXECUTABLE_MISMATCH');
  }
  const args = [...unset.flatMap((key) => ['-u', key]), executable, '--safe-mode', '--tools', '',
    '--no-session-persistence', '--output-format', 'stream-json', '--verbose',
    '--json-schema', JSON.stringify(RESPONSE_SCHEMA), '--system-prompt', system, '-p'];
  return await new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/env', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    onEvent({ type: 'process', pid: child.pid, cwd, args: args.slice(0, -3) });
    let buffer = '', errorText = '', result, timedOut = false, escalation;
    const inspector = createNativeEventInspector();
    let settled = false, protocolError = null;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); clearTimeout(escalation);
      if (error) reject(error); else resolve(value);
    };
    const stop = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch {} };
    const timer = setTimeout(() => {
      timedOut = true; stop();
      escalation = setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
        child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
        finish(new Error('MODEL_TIMEOUT'));
      }, 2000);
    }, 240_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdin.on('error', (error) => { stop(); finish(new Error(`MODEL_INPUT_FAILED: ${error.code}`)); });
    child.stdout.on('data', (chunk) => {
      if (settled) return;
      buffer += chunk;
      if (buffer.length > 2_000_000) { stop(); finish(new Error('MODEL_OUTPUT_LIMIT')); return; }
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { protocolError = 'PROTOCOL_PARSE_ERROR'; stop(); continue; }
        try { onEvent(event); } catch { stop(); finish(new Error('TRACE_WRITE_FAILED')); return; }
        inspector.observe(event);
        if (inspector.state().violation) stop();
        if (event.type === 'result') result = event;
      }
    });
    child.stderr.on('data', (chunk) => { errorText = (errorText + chunk).slice(-1000); });
    child.on('error', (error) => { stop(); finish(error); });
    child.on('close', (code) => {
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer); onEvent(event); inspector.observe(event);
          if (event.type === 'result') result = event;
        } catch { protocolError = 'PROTOCOL_PARSE_ERROR'; }
      }
      if (timedOut) return finish(new Error('MODEL_TIMEOUT'));
      if (protocolError) return finish(new Error(protocolError));
      const inspected = inspector.state();
      if (inspected.violation) return finish(new Error('UNEXPECTED_RUNTIME_PROFILE'));
      if (code || result?.is_error || !result || !inspected.initialized) return finish(new Error(`MODEL_FAILED: ${result?.result ?? errorText.slice(0, 300)}`));
      finish(null, result);
    });
    child.stdin.end(prompt);
  });
}

export async function runConversation({ guard, invoke, actionRounds = 5, closureRounds = 1, transcript = [] }) {
  for (let turn = 0; turn < actionRounds; turn++) {
    const response = await invoke({ transcript, closure: false, turn });
    transcript.push({ role: 'agent', content: response });
    if (!response.actions.length && response.answer) {
      return { status: 'OBSERVED', answer: response.answer, transcript };
    }
    if (!response.actions.length) return { status: 'MALFORMED', transcript };
    for (const action of response.actions) {
      transcript.push({ role: 'tool', action, result: guard.dispatch(action) });
    }
  }
  for (let turn = 0; turn < closureRounds; turn++) {
    const response = await invoke({ transcript, closure: true, turn });
    transcript.push({ role: 'agent', content: response });
    if (!response.actions.length && response.answer) {
      return { status: 'OBSERVED', answer: response.answer, transcript };
    }
    for (const action of response.actions) {
      transcript.push({ role: 'tool', action, result: guard.reject(action, 'ACTION_BUDGET_EXHAUSTED') });
    }
    return { status: response.actions.length ? 'INCOMPLETE' : 'MALFORMED', transcript };
  }
  return { status: 'INCOMPLETE', transcript };
}

export async function runCase({ packet, instructions = '', outputPath, reportPath = null,
  actionRounds = EXECUTION_PROFILE.actionRounds, closureRounds = EXECUTION_PROFILE.closureRounds }) {
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'research-replay-')));
  const guard = createGuard({ sources: packet.sources, reportPath, reportKey: packet.reportKey ?? null });
  const transcript = [], native = [];
  const run = { id: packet.id, parityHash: sha(JSON.stringify(packet)), instructionHash: sha(instructions),
    executionProfile: EXECUTION_PROFILE, executionProfileHash: EXECUTION_PROFILE_HASH,
    manifest: guard.manifest, trace: guard.trace, transcript, native, status: 'NOT_RUN', startedAt: new Date().toISOString() };
  const persist = () => fs.writeFileSync(outputPath, JSON.stringify(run, null, 2) + '\n');
  try {
    const conversation = await runConversation({ guard, transcript, actionRounds, closureRounds,
      invoke: async ({ closure }) => {
      const prompt = JSON.stringify({ user: packet.prompt, context: packet.context,
        projectInstructions: instructions, visibleSources: guard.manifest,
        reportTarget: packet.reportKey ?? null, actionRoundsRemaining: closure ? 0 : undefined,
        closureRequired: closure || undefined, history: transcript });
      const result = await modelTurn({ prompt, cwd: scratch, onEvent: (event) => { native.push(event); persist(); } });
      const response = decodeStructuredAgentResponse(result);
      persist();
      return response;
    }});
    run.status = conversation.status;
    if (conversation.answer) run.answer = conversation.answer;
    run.format = 'structured-output-v2';
  } catch (error) { run.status = 'ENVIRONMENT_BLOCKED'; run.error = error.message; }
  finally { run.endedAt = new Date().toISOString(); persist(); fs.rmSync(scratch, { recursive: true, force: true }); }
  return run;
}
