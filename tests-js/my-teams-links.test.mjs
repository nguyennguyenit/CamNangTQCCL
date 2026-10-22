import { test } from "node:test";
import assert from "node:assert/strict";
import { createSourceLinker } from "../js/my-teams-links.js";
import { setTeamRouteHandles } from "../js/team-detail-navigation.js";
import { sourceKeyPart, variantKey } from "../js/my-teams-sources.js";
import { admittedVariants, khaiHoang, recommendedRecords } from "./support/my-teams-fixtures.mjs";

// Bảng {r, l, k} dựng từ dữ liệu thật: id thật, segment tổng hợp (đúng dạng `routableIdentifier`).
const tables = {
  r: Object.fromEntries(recommendedRecords.map((row, index) => [row.sourceConfigId, `r-${index}`])),
  l: Object.fromEntries([...new Set(admittedVariants.map((row) => row.legacyTeamId))].map((id, index) => [id, `l-${index}`])),
  k: Object.fromEntries(khaiHoang.teams.map((team, index) => [team.id, `k-${index}`])),
};
const HAN_ID = recommendedRecords.map((row) => row.sourceConfigId).find((id) => /[^\x00-\x7f]/u.test(id));
const LEGACY = admittedVariants.find((row) => row.legacyVariantId);
const KH = khaiHoang.teams.find((team) => team.variants?.length);

test("#9c link nguồn: Đội chuẩn (kể cả id chữ Hán đã băm), Đội khác + biến thể, Khai hoang + biến thể, vi và zh", () => {
  assert.equal(setTeamRouteHandles(tables), true);
  const linker = createSourceLinker(tables);
  const ascii = recommendedRecords.find((row) => !/[^\x00-\x7f]/u.test(row.sourceConfigId)).sourceConfigId;
  assert.equal(linker.href({ kind: "recommended", key: sourceKeyPart(ascii) }, "vi"), `/doi-chuan/${tables.r[ascii]}/`);
  assert.match(sourceKeyPart(HAN_ID), /^h-[0-9a-f]{16}$/u);
  assert.equal(linker.href({ kind: "recommended", key: sourceKeyPart(HAN_ID) }, "zh"), `/zh/doi-chuan/${tables.r[HAN_ID]}/`);

  assert.equal(linker.href({ kind: "legacy", key: variantKey(LEGACY.legacyTeamId, null) }, "vi"), `/doi-khac/${tables.l[LEGACY.legacyTeamId]}/`);
  assert.equal(
    linker.href({ kind: "legacy", key: variantKey(LEGACY.legacyTeamId, LEGACY.legacyVariantId) }, "vi"),
    `/doi-khac/${tables.l[LEGACY.legacyTeamId]}/?variant=${LEGACY.legacyVariantId}`,
  );
  const variant = KH.variants[0].id;
  assert.equal(linker.href({ kind: "khaihoang", key: variantKey(KH.id, variant) }, "zh"), `/zh/khai-hoang/${tables.k[KH.id]}/?variant=${variant}`);
  assert.equal(linker.href({ kind: "khaihoang", key: variantKey(KH.id, null) }, "vi"), `/khai-hoang/${tables.k[KH.id]}/`);
});

test("#9c nguồn không có link: analyze, kind lạ, khóa không tra ra, biến thể gắn vào Đội chuẩn", () => {
  const linker = createSourceLinker(tables);
  assert.equal(linker.href({ kind: "analyze", key: "analyze-0123456789abcdef" }, "vi"), null);
  assert.equal(linker.href({ kind: "nope", key: "x" }, "vi"), null);
  assert.equal(linker.href({ kind: "legacy", key: "khong-co-doi-nay" }, "vi"), null);
  assert.equal(linker.href({ kind: "recommended", key: `${sourceKeyPart(HAN_ID)}~v` }, "vi"), null);
  assert.equal(linker.href(null, "vi"), null);
  assert.equal(linker.target({ kind: "khaihoang", key: variantKey(KH.id, "jp-s23") })?.variant, "jp-s23");
});
