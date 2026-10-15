import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');

// Mirror of the registered MCP tool names (mcp-worker/src/research/research-contracts.ts
// RESEARCH_TOOL_NAMES). Hardcoded on purpose: the Worker source is TypeScript and must not
// be parsed from here. Update both when the tool surface changes.
const REGISTERED_TOOLS = new Set([
  'tqccl_get_playbook',
  'tqccl_search',
  'tqccl_get_entity',
  'tqccl_find_teams',
  'tqccl_get_team',
  'tqccl_normalize_entities',
  'tqccl_recommend_teams',
]);

const EVAL_SPLITS = new Set(['dev', 'holdout']);
const EVAL_KINDS = new Set(['positive', 'negative', 'behavior']);

function skillDirs() {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('tqccl-'))
    .map((e) => path.join(SKILLS_DIR, e.name));
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, `${file}: missing frontmatter`);
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

const dirs = skillDirs();

test('expected skills exist', () => {
  const names = dirs.map((d) => path.basename(d)).sort();
  for (const n of ['tqccl-coexist-team-builder', 'tqccl-lookup', 'tqccl-research']) {
    assert.ok(names.includes(n), `missing skill ${n}`);
  }
});

for (const dir of dirs) {
  const name = path.basename(dir);
  const skillFile = path.join(dir, 'SKILL.md');

  test(`${name}: frontmatter name + description < 200 chars`, () => {
    const fm = frontmatter(skillFile);
    assert.equal(fm.name, name);
    assert.ok(fm.description && fm.description.length > 0, 'description required');
    assert.ok(fm.description.length < 200, `description is ${fm.description.length} chars`);
  });

  test(`${name}: relative Markdown links resolve`, () => {
    for (const file of walk(dir).filter((f) => f.endsWith('.md'))) {
      const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
      for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = m[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
        const rel = decodeURIComponent(target.split('#')[0]);
        assert.ok(fs.existsSync(path.resolve(path.dirname(file), rel)), `${path.relative(ROOT, file)}: broken link ${target}`);
      }
    }
  });

  test(`${name}: only registered tqccl_* tool names are mentioned`, () => {
    for (const file of walk(dir).filter((f) => /\.(md|ya?ml|json)$/.test(f))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\btqccl_[a-z_]+\b/g)) {
        assert.ok(REGISTERED_TOOLS.has(m[0]), `${path.relative(ROOT, file)}: unknown tool name ${m[0]}`);
      }
    }
  });

  test(`${name}: no absolute /Users/ paths`, () => {
    for (const file of walk(dir)) {
      assert.ok(!fs.readFileSync(file, 'utf8').includes('/Users/'), `${path.relative(ROOT, file)} contains /Users/`);
    }
  });

  test(`${name}: evals/evals.json parses with required fields`, () => {
    const file = path.join(dir, 'evals', 'evals.json');
    assert.ok(fs.existsSync(file), 'evals/evals.json missing');
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.skill, name);
    assert.ok(Array.isArray(data.cases) && data.cases.length > 0, 'cases required');
    const ids = new Set();
    for (const c of data.cases) {
      assert.ok(typeof c.id === 'string' && c.id, 'case id');
      assert.ok(!ids.has(c.id), `duplicate case id ${c.id}`);
      ids.add(c.id);
      assert.ok(EVAL_KINDS.has(c.kind), `${c.id}: kind`);
      assert.ok(EVAL_SPLITS.has(c.split), `${c.id}: split`);
      assert.ok(typeof c.prompt === 'string' && c.prompt, `${c.id}: prompt`);
      assert.ok(Array.isArray(c.expect) && c.expect.length > 0, `${c.id}: expect[] required`);
      if (c.kind === 'negative' || c.kind === 'positive') {
        assert.ok(['tqccl-lookup', 'tqccl-coexist-team-builder', 'tqccl-research', 'none'].includes(c.routeTo), `${c.id}: routeTo`);
      }
    }
    assert.ok(data.cases.some((c) => c.split === 'holdout'), 'needs a holdout subset');
    assert.ok(data.cases.some((c) => c.kind === 'positive'), 'needs a positive routing case');
    assert.ok(data.cases.some((c) => c.kind === 'negative'), 'needs a negative routing case');
    if (data.conversationsRef) {
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), data.conversationsRef)), 'conversationsRef must resolve');
    }
  });
}
