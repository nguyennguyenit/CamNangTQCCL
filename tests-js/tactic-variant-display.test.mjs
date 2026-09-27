import test from 'node:test';
import assert from 'node:assert/strict';
import { modifiedTacticPrefix } from '../js/recommended-reference-render.js';
import { formatModifiedTactic } from '../js/render.js';

test('tactic variants follow the exact upgrade stated in the source note', () => {
  assert.deepEqual(modifiedTacticPrefix('白毦兵', '白毦兵需改造為 轉·白毦兵（選【轉·彎弓】轉弓兵）'), ['Chuyển', '轉']);
  assert.deepEqual(modifiedTacticPrefix('解煩衛', '解煩衛需改造為 精·解煩衛，選【精研】【武魁】'), ['Tinh', '精']);
  assert.equal(modifiedTacticPrefix('白毦兵', '靈機一動需改造為 精·靈機一動'), null);
  assert.equal(modifiedTacticPrefix('解煩衛', ''), null);
});

test('existing modified tactic labels retain their prefix with consistent spacing', () => {
  assert.equal(formatModifiedTactic('Tinh·Lính Giáp Mây'), 'Tinh · Lính Giáp Mây');
  assert.equal(formatModifiedTactic('Chuyển·Bạch Nhị Binh'), 'Chuyển · Bạch Nhị Binh');
  assert.equal(formatModifiedTactic('Giải Phiền Vệ'), 'Giải Phiền Vệ');
});
