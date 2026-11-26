import { test } from "node:test";
import assert from "node:assert/strict";
import { withLocale } from "../js/i18n.js";
import { tokenRowView } from "../js/recruit-tokens.js";

const NOW = Date.UTC(2026, 10, 15, 3, 0, 0);
const DAY = 86_400_000;
const base = { id: "t1", name: "tqkh", hint: "AbCd", scope: "recruit:write", createdAt: NOW - DAY, lastUsedAt: null, expiresAt: NOW + 90 * DAY, revokedAt: null };

test("token còn hạn: thu hồi được, hiện đuôi và hạn", () => {
  const row = tokenRowView(base, NOW);
  assert.equal(row.status, "active");
  assert.equal(row.revocable, true);
  assert.equal(row.hint, "…AbCd");
  assert.match(row.statusText, /^Hạn đến \d{2}\/\d{2}\/2027$/u);
  assert.equal(row.lastUsedText, "Chưa dùng");
});

test("không hạn, hết hạn đúng mốc, đã thu hồi (thu hồi thắng hết hạn)", () => {
  assert.equal(tokenRowView({ ...base, expiresAt: null }, NOW).statusText, "Không hạn");
  const expired = tokenRowView({ ...base, expiresAt: NOW }, NOW);
  assert.equal(expired.status, "expired");
  assert.equal(expired.revocable, false);
  const revoked = tokenRowView({ ...base, expiresAt: NOW - DAY, revokedAt: NOW - 2 * DAY }, NOW);
  assert.equal(revoked.status, "revoked");
  assert.equal(revoked.revocable, false);
  assert.match(revoked.statusText, /^Đã thu hồi /u);
});

test("bản zh dùng chữ Trung", () => {
  const row = withLocale("zh", () => tokenRowView({ ...base, lastUsedAt: NOW }, NOW));
  assert.match(row.statusText, /^有效期至 /u);
  assert.match(row.lastUsedText, /^最后使用 /u);
});
