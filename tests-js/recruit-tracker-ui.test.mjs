import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultRecruitTrackerState,
  createLimitedBanner,
  getRecruitTrackerSummary,
  recordBannerMiss,
  recordDailySlotFiveStar,
  recordDailySlotMiss,
  renameAccount,
} from "../js/recruit-tracker-store.js";
import { buildRecruitTrackerViewModel } from "../js/recruit-tracker.js";

const TODAY = "2026-07-10";

test("recruit tracker view model exposes compact daily, limited, history, and hero options", () => {
  let state = createDefaultRecruitTrackerState("2026-07-10T03:30:00+07:00");
  state = renameAccount(state, state.activeAccountId, "主账号 Main");
  const accountId = state.activeAccountId;
  state = recordDailySlotMiss(state, { accountId, date: TODAY, slotKey: "free_1" });
  state = recordDailySlotFiveStar(state, { accountId, date: TODAY, slotKey: "half_1", heroName: "SP Quan Vũ" });
  state = createLimitedBanner(state, { name: "Kỳ Tật Như Phong" });
  const limited = state.banners.find((banner) => banner.name === "Kỳ Tật Như Phong");
  state = recordBannerMiss(state, { accountId, bannerId: limited.id, pulls: 31, date: TODAY });

  const summary = getRecruitTrackerSummary(state, { accountId, date: TODAY });
  const viewModel = buildRecruitTrackerViewModel(summary, [
    { name: "Lưu Bị", chinese: "刘备" },
    { name: "SP Mã Siêu", chinese: "SP马超" },
  ]);

  assert.equal(viewModel.daily.title, "Danh tướng PK - Hằng ngày");
  assert.equal(viewModel.daily.pityText, "0/30");
  assert.deepEqual(viewModel.daily.slots.map((slot) => [slot.label, slot.statusLabel]), [
    ["Miễn phí 1", "Không ra"],
    ["Nửa giá 1", "Ra 5★"],
    ["Miễn phí 2", "Chưa quay"],
    ["Nửa giá 2", "Chưa quay"],
  ]);
  // Giá trị cho đồng hồ pity (thanh role=meter) lấy thẳng từ store: quá mốc vẫn hiện số thật, phần trăm kẹp 100.
  assert.deepEqual(viewModel.daily.pity, { value: 0, limit: 30, remaining: 30, isOverLimit: false, percent: 0 });
  assert.equal(viewModel.daily.todayDone, 2);
  assert.equal(viewModel.daily.pityText, `${viewModel.daily.pity.value}/${viewModel.daily.pity.limit}`);
  assert.equal(viewModel.limitedBanners[0].name, "Kỳ Tật Như Phong");
  assert.deepEqual(viewModel.limitedBanners[0].pity, { value: 31, limit: 30, remaining: 0, isOverLimit: true, percent: 100 });
  assert.equal(viewModel.limitedBanners[0].pityText, "31/30");
  assert.ok(viewModel.limitedBanners[0].warning);
  assert.doesNotMatch(viewModel.limitedBanners[0].warning, /[\u3400-\u9fff\uf900-\ufaff]/u);
  assert.equal(viewModel.daily.warning, "");
  assert.equal(viewModel.history[0].heroName, "SP Quan Vũ");
  assert.deepEqual(viewModel.heroOptions, ["Lưu Bị", "SP Mã Siêu"]);
});
