import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const validKey = (key) => typeof key === 'string' && key.length > 0
  && !key.startsWith('/') && !key.includes('\\') && !key.includes('%')
  && !key.includes('\0') && key.split('/').every((part) => part && part !== '.' && part !== '..');

// Sources are copied into memory. Model requests never become filesystem reads.
export function createGuard({ sources, reportPath = null, reportKey = null }) {
  const snapshots = new Map(Object.entries(sources));
  for (const [key, value] of snapshots) {
    if (!validKey(key) || typeof value !== 'string') throw new Error('Invalid source snapshot');
  }
  const manifest = [...snapshots].map(([key, value]) => ({ path: key, sha256: hash(value) }));
  const trace = [];
  const allowedFields = {
    list: ['op'], read: ['op', 'path'], search: ['op', 'query'],
    create_report: ['op', 'path', 'content'],
  };

  function execute(action) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return deny('INVALID_ACTION');
    const fields = Object.hasOwn(allowedFields, action.op) ? allowedFields[action.op] : null;
    if (!fields) return deny('ACTION_DENIED');
    if (Object.keys(action).some((key) => !fields.includes(key))) return deny('INVALID_ACTION');
    if (action.op === 'list') return { ok: true, paths: [...snapshots.keys()] };
    if (action.op === 'read') {
      if (!validKey(action.path) || !snapshots.has(action.path)) return deny('READ_DENIED');
      return { ok: true, content: snapshots.get(action.path) };
    }
    if (action.op === 'search') {
      if (typeof action.query !== 'string' || !action.query || action.query.length > 500) return deny('INVALID_QUERY');
      const matches = [];
      for (const [key, value] of snapshots) {
        value.split('\n').forEach((text, index) => {
          if (text.includes(action.query)) matches.push({ path: key, line: index + 1, text });
        });
      }
      return { ok: true, matches: matches.slice(0, 100), truncated: matches.length > 100 };
    }
    if (!reportPath || !validKey(reportKey) || action.path !== reportKey) return deny('WRITE_DENIED');
    if (typeof action.content !== 'string' || Buffer.byteLength(action.content) > 100_000) return deny('INVALID_CONTENT');
    // Only trusted controller configuration supplies a physical target. Reject
    // symlink parents; the model has no operation capable of swapping directories.
    const target = path.resolve(reportPath);
    const parent = path.dirname(target);
    if (fs.realpathSync(parent) !== parent) return deny('NON_CANONICAL_PARENT');
    let fd;
    try {
      fd = fs.openSync(target, 'wx', 0o600);
      fs.writeFileSync(fd, action.content, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    snapshots.set(reportKey, action.content);
    return { ok: true, path: reportKey, sha256: hash(action.content) };
  }

  function dispatch(action) {
    let copy;
    try { copy = JSON.parse(JSON.stringify(action)); }
    catch { copy = { malformed: true }; }
    // Record intent before any effect, including unknown operations and denials.
    const entry = { sequence: trace.length + 1, action: copy, ok: false, state: 'attempted' };
    trace.push(entry);
    let result;
    try { result = execute(action); }
    catch (error) { result = deny(error.code === 'EEXIST' ? 'ALREADY_EXISTS' : 'IO_DENIED'); }
    Object.assign(entry, result, { state: result.ok ? 'allowed' : 'denied' });
    return result;
  }

  function reject(action, error = 'ACTION_DENIED') {
    let copy;
    try { copy = JSON.parse(JSON.stringify(action)); }
    catch { copy = { malformed: true }; }
    const result = deny(error);
    trace.push({ sequence: trace.length + 1, action: copy, ok: false, state: 'denied', ...result });
    return result;
  }

  return { dispatch, reject, trace, manifest };
}

function deny(error) { return { ok: false, error }; }
