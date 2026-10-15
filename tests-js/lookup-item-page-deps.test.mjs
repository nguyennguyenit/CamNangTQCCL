import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const JS = fileURLToPath(new URL('../js/', import.meta.url));

/** Every module the browser must fetch for an entry script: static imports, transitively. */
async function importClosure(entry) {
  const seen = new Map();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    const source = await readFile(file, 'utf8');
    seen.set(file, Buffer.byteLength(source));
    for (const match of source.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s*["'](\.[^"']+)["']|^\s*import\s*["'](\.[^"']+)["']/gmu)) {
      queue.push(normalize(join(dirname(file), match[1] ?? match[2])));
    }
  }
  return seen;
}

test('item page script loads a handful of small modules, not the rendering/lookup/season stack', async () => {
  const closure = await importClosure(join(JS, 'lookup-item-page.js'));
  const names = [...closure.keys()].map((file) => file.slice(JS.length));
  const total = [...closure.values()].reduce((sum, bytes) => sum + bytes, 0);
  // Search visitors arrive with nothing cached: the page only toggles panels and activates portraits.
  assert.ok(names.length <= 6, names.join(', '));
  assert.ok(total < 20_000, `${total} bytes: ${names.join(', ')}`);
  for (const heavy of ['render.js', 'unified-lookup.js', 'season-ui-state.js', 'recommended-reference-state.js', 'team-view.js']) {
    assert.ok(!names.includes(heavy), `${heavy} must not be fetched by an item page`);
  }
});
