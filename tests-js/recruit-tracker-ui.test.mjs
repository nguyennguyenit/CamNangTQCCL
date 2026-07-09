import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDefaultRecruitTrackerState,
  createLimitedBanner,
  getRecruitTrackerSummary,
  recordBannerMiss,
  recordDailySlotFiveStar,
  recordDailySlotMiss,
} from "../js/recruit-tracker-store.js";
import { buildRecruitTrackerViewModel } from "../js/recruit-tracker.js";

const TODAY = "2026-07-10";

test("recruit tracker view model exposes compact daily, limited, history, and hero options", () => {
  let state = createDefaultRecruitTrackerState("2026-07-10T03:30:00+07:00");
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

  assert.equal(viewModel.accountLabel, "Main");
  assert.equal(viewModel.daily.title, "Danh tướng PK - Hằng ngày");
  assert.equal(viewModel.daily.pityText, "0/30");
  assert.deepEqual(viewModel.daily.slots.map((slot) => [slot.label, slot.statusLabel]), [
    ["Miễn phí 1", "Không ra"],
    ["Nửa giá 1", "Ra 5★"],
    ["Miễn phí 2", "Chưa quay"],
    ["Nửa giá 2", "Chưa quay"],
  ]);
  assert.equal(viewModel.limitedBanners[0].name, "Kỳ Tật Như Phong");
  assert.equal(viewModel.limitedBanners[0].warning, "Kiểm tra lại dữ liệu/game rule");
  assert.equal(viewModel.history[0].heroName, "SP Quan Vũ");
  assert.deepEqual(viewModel.heroOptions, ["Lưu Bị", "SP Mã Siêu"]);
});
