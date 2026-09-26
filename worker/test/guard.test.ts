import { describe, it, expect } from "vitest";
import { validateImage, corsHeaders, preflight } from "../src/guard";

// Dựng base64 từ bytes (Node Buffer; guard dùng atob global của Node).
function b64(bytes: number[]): string {
  return Buffer.from(Uint8Array.from(bytes)).toString("base64");
}
const pad = (head: number[], len = 100) => head.concat(Array(Math.max(0, len - head.length)).fill(0));
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);

describe("validateImage (H4 input guard)", () => {
  it("nhận PNG hợp lệ", () => {
    const r = validateImage(b64(PNG), 1_500_000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mime).toBe("image/png");
  });
  it("nhận JPEG + chấp nhận data URI tiền tố", () => {
    const r = validateImage("data:image/jpeg;base64," + b64(JPEG), 1_500_000);
    expect(r.ok).toBe(true);
  });
  it("từ chối ảnh quá lớn (413)", () => {
    const big = b64(pad([0x89, 0x50, 0x4e, 0x47], 2000));
    const r = validateImage(big, 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(413);
  });
  it("từ chối không phải ảnh (415)", () => {
    const r = validateImage(b64(pad([0x00, 0x01, 0x02, 0x03])), 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(415);
  });
  it("từ chối base64 hỏng (400)", () => {
    const r = validateImage("@@@not-base64@@@", 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect([400, 415]).toContain(r.status);
  });
  it("từ chối thiếu ảnh (400)", () => {
    const r = validateImage(undefined, 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
  it("từ chối ảnh quá nhỏ (400)", () => {
    const r = validateImage(b64([0x89, 0x50, 0x4e, 0x47]), 1_500_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  // Bảo toàn hành vi (tối ưu guard không được đổi kết quả với base64 chuẩn trình duyệt tạo).
  it("biên kích thước giải mã đúng maxBytes với 0/1/2 ký tự '='", () => {
    for (const size of [300, 301, 302]) {
      const encoded = b64(pad([0x89, 0x50, 0x4e, 0x47], size));
      expect(encoded.match(/=*$/)![0].length).toBe([0, 2, 1][size % 3]);
      expect(validateImage(encoded, size).ok).toBe(true);
      const over = validateImage(encoded, size - 1);
      expect(over.ok).toBe(false);
      if (!over.ok) expect(over.status).toBe(413);
    }
  });
  it("ký tự base64 sai ở giữa chuỗi -> 400", () => {
    const encoded = b64(PNG);
    for (const bad of ["*", "=", "-"]) {
      const middle = Math.floor(encoded.length / 2);
      const r = validateImage(encoded.slice(0, middle) + bad + encoded.slice(middle + 1), 1_500_000);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });
  it("nhận diện PNG/JPEG/WebP qua magic bytes và dataUri giữ nguyên phần base64 của input", () => {
    const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    for (const [bytes, mime] of [[PNG, "image/png"], [JPEG, "image/jpeg"], [WEBP, "image/webp"]] as const) {
      const encoded = b64(bytes);
      for (const input of [encoded, `data:image/gif;base64,${encoded}`]) {
        const r = validateImage(input, 1_500_000);
        expect(r).toEqual({ ok: true, mime, dataUri: `data:${mime};base64,${encoded}` });
      }
    }
  });
});

describe("CORS", () => {
  it("preflight 204 + header origin", () => {
    const res = preflight("https://x.github.io");
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://x.github.io");
  });
  it("corsHeaders giới hạn methods", () => {
    expect(corsHeaders("*")["Access-Control-Allow-Methods"]).toContain("POST");
  });
});
