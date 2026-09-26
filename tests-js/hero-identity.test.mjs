import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canonicalHeroId,
  heroFamilyId,
  heroSlotAlternatives,
  normalizeHeroSlot,
} from "../js/hero-identity.js";

test("SP, CO và bản thường có canonical ID riêng nhưng chung family", () => {
  assert.equal(canonicalHeroId("SP Tuân Úc"), "hero:sp-tuan-uc");
  assert.equal(canonicalHeroId("Tuân Úc"), "hero:tuan-uc");
  assert.equal(canonicalHeroId("CO Chân Cơ"), "hero:co-chan-co");
  assert.equal(canonicalHeroId("Chân Cơ"), "hero:chan-co");

  assert.equal(heroFamilyId("SP Tuân Úc"), "hero-family:tuan-uc");
  assert.equal(heroFamilyId("Tuân Úc"), "hero-family:tuan-uc");
  assert.equal(heroFamilyId("CO Chân Cơ"), "hero-family:chan-co");
});

test("40Y có ID riêng, chung family và map sang variant other", () => {
  assert.equal(canonicalHeroId("40Y Lữ Bố"), "hero:40y-lu-bo");
  assert.equal(heroFamilyId("40Y Lữ Bố"), "hero-family:lu-bo");
  assert.equal(heroSlotAlternatives("40Y Lữ Bố")[0].variant, "other");

  const slot = normalizeHeroSlot({
    name: "Lữ Bố",
    baseName: "Lữ Bố",
    is40Y: true,
    isSP: false,
    isCO: false,
  });
  assert.equal(slot.alternatives[0].displayName, "40Y Lữ Bố");
  assert.equal(slot.alternatives[0].canonicalId, "hero:40y-lu-bo");
  assert.equal(slot.alternatives[0].variant, "other");
});

test("prefix chỉ áp dụng cho alternative được ghi tên", () => {
  const alternatives = heroSlotAlternatives("SP Lữ Mông/Trình Phổ");

  assert.deepEqual(
    alternatives.map(({ displayName, canonicalId }) => ({ displayName, canonicalId })),
    [
      { displayName: "SP Lữ Mông", canonicalId: "hero:sp-lu-mong" },
      { displayName: "Trình Phổ", canonicalId: "hero:trinh-pho" },
    ],
  );
});

test("artifact flags khôi phục identity đầy đủ mà không đổi baseName browser", () => {
  const slot = normalizeHeroSlot({
    name: "SP Tuân Úc(S)",
    baseName: "Tuân Úc",
    alternatives: ["Trình Phổ"],
    isSP: true,
    isCO: false,
  });

  assert.equal(slot.alternatives[0].displayName, "SP Tuân Úc");
  assert.equal(slot.alternatives[0].canonicalId, "hero:sp-tuan-uc");
  assert.equal(slot.alternatives[0].familyId, "hero-family:tuan-uc");
  assert.equal(slot.alternatives[1].canonicalId, "hero:trinh-pho");
  assert.equal(slot.slotId, "slot:hero:sp-tuan-uc|hero:trinh-pho");
});

test("combined slot được thỏa bởi đúng một alternative", () => {
  const slot = normalizeHeroSlot("SP Lữ Mông/Trình Phổ");
  const owned = new Set(["hero:trinh-pho"]);

  assert.equal(slot.alternatives.some(({ canonicalId }) => owned.has(canonicalId)), true);
  assert.equal(slot.alternatives.length, 2);
});

test("control characters và annotation bị loại khỏi canonical identity", () => {
  assert.equal(canonicalHeroId("  SP\u0000 Tuân Úc (S)  "), "hero:sp-tuan-uc");
  assert.equal(heroFamilyId("CO Chân Cơ（Cung S）"), "hero-family:chan-co");
});
