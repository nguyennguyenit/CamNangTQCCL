import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_BANNER_ID,
  createDefaultRecruitTrackerState,
  createLimitedBanner,
  getRecruitTrackerSummary,
  recordBannerFiveStar,
  recordBannerMiss,
  recordDailyFiveStar,
  recordDailyMisses,
  renameAccount,
  setBannerArchived,
  setPity,
  updateBanner,
} from "../js/recruit-tracker-store.js";
import { buildRecruitTrackerViewModel, expiryView, logDateLabel } from "../js/recruit-tracker.js";

const TODAY = "2026-07-10";
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;
let tick = Date.parse("2026-07-10T03:30:00.000Z");
/** Mốc thời gian tăng dần cho từng thao tác: thứ tự bảo hiểm của store theo `occurredAt`. */
const now = () => new Date((tick += 1000));

function viewOf(state, heroes = [], date = TODAY) {
  return buildRecruitTrackerViewModel(getRecruitTrackerSummary(state, { date }), heroes, { today: date });
}

function withLimited(state, fields) {
  const next = createLimitedBanner(state, { ...fields, now: now() });
  return { state: next, id: next.banners.at(-1).id };
}

test("empty account shows onboarding and quick buttons offer the full day", () => {
  const view = viewOf(createDefaultRecruitTrackerState());
  assert.equal(view.isEmpty, true);
  assert.equal(view.daily.title, "Danh tướng PK · Hôm nay");
  assert.deepEqual(view.daily.quick.map(({ label, pulls, disabled, sub }) => ({ label, pulls, disabled, sub })), [
    { label: "2 miễn phí", pulls: 2, disabled: false, sub: "Ghi +2 lượt không ra" },
    { label: "Đủ 4", pulls: 4, disabled: false, sub: "Ghi 4 lượt rẻ còn lại" },
  ]);
  assert.equal(view.daily.fiveStarDisabled, false);
  assert.equal(view.daily.hint, "");
  assert.deepEqual([view.stats.averageText, view.stats.averageSub], ["—", "chưa có 5★"]);
});

test("quick buttons clamp to the pulls left today and disable with a hint once the day is full", () => {
  let state = createDefaultRecruitTrackerState();
  const accountId = state.activeAccountId;
  state = recordDailyMisses(state, { accountId, date: TODAY, pulls: 3, now: now() });
  let view = viewOf(state);
  assert.equal(view.isEmpty, false);
  assert.equal(view.daily.todayDone, 3);
  assert.equal(view.daily.todayText, "Hôm nay 3/4");
  const [free, fill] = view.daily.quick;
  assert.equal(free.pulls, 1);
  assert.equal(free.sub, "Ghi +1 lượt không ra");
  assert.equal(free.ariaLabel, "2 miễn phí (ghi 1 lượt không ra)");
  assert.equal(fill.pulls, 1);
  assert.equal(fill.disabled, false);
  assert.equal(view.daily.cheapText, "hôm nay còn 1 lượt rẻ");

  state = recordDailyMisses(state, { accountId, date: TODAY, pulls: fill.pulls, now: now() });
  view = viewOf(state);
  assert.deepEqual(view.daily.quick.map((quick) => [quick.pulls, quick.disabled, quick.sub]), [
    [0, true, "Hôm nay đã đủ 4 lượt"],
    [0, true, "Hôm nay đã đủ 4 lượt"],
  ]);
  assert.equal(view.daily.quick[1].ariaLabel, "Đủ 4 (hôm nay đã đủ 4 lượt)");
  assert.equal(view.daily.fiveStarDisabled, true);
  assert.equal(view.daily.cheapText, "hôm nay đã đủ 4 lượt");
  assert.equal(view.daily.hint, "Hôm nay đã ghi đủ 4 lượt.");
  // Hôm sau: lượt rẻ về lại 4, bảo hiểm vẫn cộng dồn.
  const tomorrow = viewOf(state, [], "2026-07-11");
  assert.equal(tomorrow.daily.quick[1].pulls, 4);
  assert.equal(tomorrow.daily.pity.value, 4);
});

test("pity keeps the real count but clamps the percent, and warns only at or past the limit", () => {
  let state = createDefaultRecruitTrackerState();
  const accountId = state.activeAccountId;
  state = setPity(state, { accountId, bannerId: DAILY_BANNER_ID, value: 17, date: TODAY, now: now() });
  let limited;
  ({ state, id: limited } = withLimited(state, { name: "Kỳ Tật Như Phong" }));
  state = recordBannerMiss(state, { accountId, bannerId: limited, pulls: 31, date: TODAY, now: now() });

  const view = viewOf(state);
  assert.deepEqual(view.daily.pity, { value: 17, limit: 30, remaining: 13, isOverLimit: false, percent: 57 });
  assert.equal(view.daily.pityText, "17 / 30");
  // Ô chọn tài khoản mang bảo hiểm gói ngày của từng tài khoản.
  assert.deepEqual(view.accounts.map((account) => account.optionText), ["Chính · 17/30"]);
  assert.equal(view.daily.remainingText, "Còn 13 lượt");
  assert.equal(view.daily.warning, "");
  // Đồng bộ số không tính là lượt quay hôm nay.
  assert.equal(view.daily.todayDone, 0);

  const [banner] = view.limitedBanners;
  assert.equal(banner.name, "Kỳ Tật Như Phong");
  assert.deepEqual(banner.pity, { value: 31, limit: 30, remaining: 0, isOverLimit: true, percent: 100 });
  assert.equal(banner.pityText, "31 / 30");
  assert.equal(banner.warning, "Kiểm tra lại dữ liệu/quy tắc game");
  assert.doesNotMatch(banner.warning, CJK);
});

test("log rows read as miss, 5★ with its pull count, and pity sync, newest first, with relative dates and daily slots", () => {
  let state = createDefaultRecruitTrackerState();
  state = renameAccount(state, state.activeAccountId, "主账号 Main", { now: now() });
  const accountId = state.activeAccountId;
  state = setPity(state, { accountId, bannerId: DAILY_BANNER_ID, value: 23, date: "2026-07-09", now: now() });
  state = recordDailyMisses(state, { accountId, date: TODAY, pulls: 2, now: now() });
  state = recordDailyFiveStar(state, { accountId, date: TODAY, hitAt: 2, pullsAfter: 0, heroName: "Tào Tháo", heroValueClass: "Chủ lực", note: "đẹp", now: now() });

  const view = viewOf(state, [{ name: "Lưu Bị", chinese: "刘备" }, { name: "SP Mã Siêu", chinese: "SP马超" }]);
  assert.deepEqual(view.log.map((row) => [row.date, row.dateLabel, row.text, row.bannerName, row.slotText]), [
    [TODAY, "Hôm nay", "★ Tào Tháo · lượt 27", "Danh tướng PK", ""],
    [TODAY, "Hôm nay", "+2 không ra", "Danh tướng PK", "Lượt 1–2/4"],
    ["2026-07-09", "Hôm qua", "Đồng bộ 23 lượt", "Danh tướng PK", ""],
  ]);
  assert.equal(view.log[0].valueLabel, "Chủ lực");
  assert.equal(view.log[0].valueBadgeClass, "rt-value-accent");
  assert.equal(view.log[0].note, "đẹp");
  assert.equal(view.log[1].valueLabel, "");
  // Sau 5★ bảo hiểm về 0; hôm nay đã quay 4 lượt.
  assert.equal(view.daily.pity.value, 0);
  assert.equal(view.daily.todayDone, 4);
  assert.deepEqual(view.heroOptions, ["Lưu Bị", "SP Mã Siêu"]);
  for (const row of view.log) assert.doesNotMatch(row.text, CJK);
});

test("stats summarise average pulls per 5★, total 5★ and the daily streak", () => {
  let state = createDefaultRecruitTrackerState();
  const accountId = state.activeAccountId;
  state = recordDailyMisses(state, { accountId, date: "2026-07-08", pulls: 4, now: now() });
  state = recordDailyMisses(state, { accountId, date: "2026-07-09", pulls: 4, now: now() });
  state = recordDailyFiveStar(state, { accountId, date: TODAY, hitAt: 2, pullsAfter: 2, heroName: "Lưu Bị", now: now() });
  let limited;
  ({ state, id: limited } = withLimited(state, { name: "Gói A" }));
  state = recordBannerFiveStar(state, { accountId, bannerId: limited, pulls: 21, heroName: "Tôn Quyền", date: TODAY, now: now() });

  const view = viewOf(state);
  assert.equal(view.stats.fiveStars, 2);
  assert.equal(view.stats.averagePulls, 15.5);
  assert.equal(view.stats.streakDays, 3);
  assert.deepEqual(
    [view.stats.averageText, view.stats.averageSub, view.stats.fiveStarsSub, view.stats.streakSub],
    ["15,5", "thấp hơn mốc 30", "0 Chủ lực", "ngày liên tiếp"],
  );
});

test("limited banners show the expiry countdown and split archived ones out", () => {
  let state = createDefaultRecruitTrackerState();
  let soon;
  let past;
  ({ state, id: soon } = withLimited(state, { name: "Sắp hết", expiresAt: "2026-07-13" }));
  ({ state, id: past } = withLimited(state, { name: "Đã qua", expiresAt: "2026-07-01" }));
  state = setBannerArchived(state, past, true, { now: now() });
  let view = viewOf(state);
  assert.deepEqual(view.activeBanners.map((item) => [item.name, item.expiry.text, item.expiry.tone]), [["Sắp hết", "còn 3 ngày", ""]]);
  assert.deepEqual(view.archivedBanners.map((item) => [item.name, item.expiry.text, item.expiry.expired, item.expiry.tone]), [["Đã qua", "hết hạn", true, "avoid"]]);

  state = updateBanner(state, soon, { expiresAt: "" }, { now: now() });
  view = viewOf(state);
  assert.deepEqual(view.activeBanners[0].expiry, { text: "", expired: false, tone: "" });
  assert.deepEqual(expiryView("2026-07-10", TODAY), { text: "hết hạn hôm nay", expired: false, tone: "warn" });
  assert.deepEqual(expiryView("2026-07-11", TODAY), { text: "còn 1 ngày", expired: false, tone: "" });
});

test("log dates read as today, yesterday, day/month this year and the full date for older years", () => {
  assert.deepEqual(
    ["2026-07-10", "2026-07-09", "2026-01-31", "2025-12-31"].map((date) => logDateLabel(date, TODAY)),
    ["Hôm nay", "Hôm qua", "31/01", "31/12/2025"],
  );
});
