import test from "node:test";
import assert from "node:assert/strict";
import { isNetworkError } from "../js/detail-actions.js";

test("fetch bị chặn hoặc HTTP lỗi là lỗi mạng", () => {
  assert.equal(isNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkError(new TypeError("NetworkError when attempting to fetch resource.")), true);
  assert.equal(isNetworkError(new TypeError("Load failed")), true);
  assert.equal(isNetworkError(new Error("/data/teams.json: 503")), true);
});

test("dữ liệu đổi, sai hoặc thiếu là lỗi xác minh, không phải lỗi mạng", () => {
  for (const message of [
    "Dữ liệu đã thay đổi: data/teams.json",
    "Dữ liệu đội gốc không khớp vân tay của trang.",
    "Thiếu vân tay dữ liệu đội gốc.",
    "Không tìm thấy vị trí nội dung tiếng Việt",
  ]) {
    assert.equal(isNetworkError(new Error(message)), false, message);
  }
  assert.equal(isNetworkError(new SyntaxError("Unexpected token < in JSON")), false);
  assert.equal(isNetworkError(undefined), false);
});
