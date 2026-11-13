// Khối "Trong cẩm nang" của bài viết chọn mục theo chủ đề: khớp nguyên từ sau NFC, không khớp nhầm chuỗi con.
import { test } from "node:test";
import assert from "node:assert/strict";
import { blogGuideTopic } from "../src/lib/blog-guide-link.ts";

test("chủ đề khớp theo nguyên từ: 'kho' không khớp Khoảng cách / Khoá đội / Khoa học", () => {
  for (const tag of ["Khoảng cách", "Khoá đội", "Khoa học", "khống chế"]) assert.equal(blogGuideTopic([tag]), "doi-chuan", tag);
  assert.equal(blogGuideTopic(["Kho"]), "goi-y-doi");
  assert.equal(blogGuideTopic(["Sắp xếp kho tướng"]), "goi-y-doi");
  assert.equal(blogGuideTopic(["Gợi ý đội"]), "goi-y-doi");
});

test("chủ đề nhập ở dạng NFD vẫn khớp như NFC; NFD 'khống chế' không khớp 'kho'", () => {
  assert.equal(blogGuideTopic(["Khai hoang".normalize("NFD")]), "khai-hoang");
  assert.equal(blogGuideTopic(["Chạm Sứ".normalize("NFD")]), "khai-hoang");
  assert.equal(blogGuideTopic(["khống chế".normalize("NFD")]), "doi-chuan");
  assert.equal(blogGuideTopic(["Gợi ý đội".normalize("NFD")]), "goi-y-doi");
});

test("mục đầu khớp thắng; chữ Hán khớp chuỗi con; không chủ đề thì Đội chuẩn", () => {
  assert.equal(blogGuideTopic(["Kho", "Khai hoang"]), "khai-hoang");
  assert.equal(blogGuideTopic(["开荒攻略"]), "khai-hoang");
  assert.equal(blogGuideTopic(["库存"]), "goi-y-doi");
  assert.equal(blogGuideTopic([]), "doi-chuan");
});
