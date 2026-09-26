import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PUBLIC_ARTIFACTS } from '../src/lib/public-artifact-manifest.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// 1501: syntax that needs a newer ECMAScript target than the ES2022 (Safari 16) baseline.
const NEWER_SYNTAX_DIAGNOSTIC = 1501;

test('every published browser module parses on the ES2022 (Safari 16) baseline', () => {
  const files = PUBLIC_ARTIFACTS.filter(artifact => artifact.kind === 'js').map(artifact => `${ROOT}js/${artifact.sourceBasename}`);
  assert.ok(files.length > 0);
  const program = ts.createProgram(files, { target: ts.ScriptTarget.ES2022, allowJs: true, checkJs: true, noResolve: true, noEmit: true });
  const offending = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()]
    .filter(diagnostic => diagnostic.code === NEWER_SYNTAX_DIAGNOSTIC)
    .map(diagnostic => `${diagnostic.file?.fileName.slice(ROOT.length)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
  assert.deepEqual(offending, []);
});
