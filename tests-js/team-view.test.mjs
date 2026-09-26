// Kiểu hiển thị Thẻ / Thẻ gọn / Bảng: URL > giá trị đã lưu > Thẻ, và storage hỏng không được chặn render.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_VIEW_STORAGE_KEY, canonicalTeamView, readStoredTeamView, resolveTeamView, writeStoredTeamView } from '../js/team-view.js';

const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    value: (key) => map.get(key) ?? null,
  };
};

const brokenStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
};

test('only the three documented view values survive canonicalization', () => {
  assert.equal(canonicalTeamView('the'), 'the');
  assert.equal(canonicalTeamView('luoi'), 'luoi');
  assert.equal(canonicalTeamView('bang'), 'bang');
  for (const hostile of ['cards', 'table', 'grid', 'Thẻ', 'lưới', '', null, undefined, 7, {}, 'toString', 'constructor']) {
    assert.equal(canonicalTeamView(hostile), null, `must reject ${String(hostile)}`);
  }
});

test('URL wins over stored value and storage wins over the Thẻ default', () => {
  const stored = memoryStorage({ [TEAM_VIEW_STORAGE_KEY]: 'bang' });
  assert.equal(resolveTeamView('the', stored), 'the');
  assert.equal(resolveTeamView('bang', memoryStorage()), 'bang');
  assert.equal(resolveTeamView(null, stored), 'bang');
  assert.equal(resolveTeamView('cards', stored), 'bang');
  assert.equal(resolveTeamView(null, memoryStorage()), 'the');
  assert.equal(resolveTeamView(null, memoryStorage({ [TEAM_VIEW_STORAGE_KEY]: 'cards' })), 'the');
  assert.equal(resolveTeamView(null, null), 'the');
});

test('storage read and write failures fall back to Thẻ without throwing', () => {
  assert.equal(readStoredTeamView(brokenStorage), null);
  assert.equal(resolveTeamView(null, brokenStorage), 'the');
  assert.equal(writeStoredTeamView(brokenStorage, 'bang'), false);
  const stored = memoryStorage();
  assert.equal(writeStoredTeamView(stored, 'luoi'), true);
  assert.equal(stored.value(TEAM_VIEW_STORAGE_KEY), 'luoi');
  assert.equal(resolveTeamView(null, stored), 'luoi');
  assert.equal(writeStoredTeamView(stored, 'bang'), true);
  assert.equal(stored.value(TEAM_VIEW_STORAGE_KEY), 'bang');
  // Giá trị lạ không bao giờ được ghi xuống storage.
  assert.equal(writeStoredTeamView(stored, 'cards'), true);
  assert.equal(stored.value(TEAM_VIEW_STORAGE_KEY), 'the');
});
