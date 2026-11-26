import { test } from "node:test";
import assert from "node:assert/strict";
import { SEARCH_DEBOUNCE_MS, createSearchTracker, normalizeSearchTerm } from "../js/lookup-search-tracking.js";

/** Bộ hẹn giờ giả: `advance(ms)` chạy các hẹn đã tới hạn theo thứ tự thời gian. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at <= now && timers.delete(id)) timer.fn();
      }
    },
    pending: () => timers.size,
  };
}

function setup(group = "heroes") {
  const clock = fakeClock();
  const events = [];
  const tracker = createSearchTracker({ group, report: (name, params) => events.push([name, params]), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  return { clock, events, tracker };
}

test("normalizeSearchTerm: cắt khoảng trắng, tối đa 50 ký tự", () => {
  assert.equal(normalizeSearchTerm("  Mã Siêu  "), "Mã Siêu");
  assert.equal(normalizeSearchTerm(null), "");
  assert.equal(normalizeSearchTerm("a".repeat(80)), "a".repeat(50));
  assert.equal(normalizeSearchTerm(`${"a".repeat(49)} bcd`), "a".repeat(49));
});

test("không báo theo từng phím: chỉ một sự kiện sau khi ngừng gõ ≥1 s", () => {
  const { clock, events, tracker } = setup();
  for (const text of ["Mã", "Mã S", "Mã Si", "Mã Siê", "Mã Siêu"]) {
    tracker.input(text);
    clock.advance(300);
  }
  assert.deepEqual(events, []);
  clock.advance(SEARCH_DEBOUNCE_MS);
  assert.deepEqual(events, [["search", { search_term: "Mã Siêu", lookup_group: "heroes" }]]);
});

test("từ khóa dưới 2 ký tự (sau khi cắt) không báo và hủy hẹn đang chờ", () => {
  const { clock, events, tracker } = setup("tactics");
  tracker.input("Mã Siêu");
  tracker.input(" M ");
  assert.equal(clock.pending(), 0);
  clock.advance(5000);
  assert.deepEqual(events, []);
});

test("không báo lại cùng từ khóa liền kề, báo lại khi đổi từ khóa", () => {
  const { clock, events, tracker } = setup("equipment");
  tracker.input("kiếm");
  clock.advance(SEARCH_DEBOUNCE_MS);
  tracker.input("kiếm ");
  clock.advance(SEARCH_DEBOUNCE_MS);
  assert.equal(events.length, 1);
  tracker.input("giáp");
  clock.advance(SEARCH_DEBOUNCE_MS);
  tracker.input("kiếm");
  clock.advance(SEARCH_DEBOUNCE_MS);
  assert.deepEqual(events.map(([, params]) => params.search_term), ["kiếm", "giáp", "kiếm"]);
  assert.ok(events.every(([, params]) => params.lookup_group === "equipment"));
});

test("từ khóa dài bị cắt còn 50 ký tự", () => {
  const { clock, events, tracker } = setup();
  tracker.input("x".repeat(120));
  clock.advance(SEARCH_DEBOUNCE_MS);
  assert.equal(events[0][1].search_term.length, 50);
});
