// Fuzzy matcher chống hallucination (H1) — dùng chung Phase 2 (search dict) +
// Phase 4 (map Hán từ vision -> tên Việt canonical). 0 dependency.
//
// Đa ngõ vào: chữ Hán (so khớp `chinese`, fuzzy cho OCR sai), Hán-Việt / Việt bỏ
// dấu (so khớp `viet`/`hanViet`/`aliases` đã normalize). Trả record + score +
// confidence; dưới ngưỡng -> matched=false để UI gắn cờ "không chắc, kiểm tra".

import { normalizeText } from "./filters.js";

const HAS_CJK = /[一-鿿]/;

const CJK_OCR_ALIASES = {
  // Biến thể OCR thường gặp trên screenshot overlay nét vàng/trắng.
  "灵机": "临机",
  "荧薙": "焚辎",
};

/** Khoảng cách Levenshtein (edit distance), quy hoạch động O(m*n). */
export function levenshtein(a, b) {
  a = a || "";
  b = b || "";
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

/** Tỉ lệ tương đồng 0..1 = 1 - dist/maxLen. Hai chuỗi rỗng -> 1. */
export function ratio(a, b) {
  a = a || "";
  b = b || "";
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Ngưỡng confidence mặc định: dưới -> coi như không chắc. */
export const DEFAULT_THRESHOLD = 0.7;

/** Các chuỗi tìm kiếm phía Việt của 1 record (đã normalize). */
function vietCandidates(rec) {
  return [rec.viet, rec.hanViet, ...(rec.aliases || [])]
    .filter(Boolean)
    .map(normalizeText);
}

/** Điểm khớp tốt nhất giữa query và 1 record (0..1). */
function scoreRecord(query, rec, cjk) {
  if (cjk) {
    const cn = rec.chinese || "";
    if (!cn) return 0;
    if (cn === query) return 1;
    if (query.length >= 2 && cn.includes(query)) {
      const lenRatio = query.length / cn.length;
      const prefixBoost = cn.startsWith(query) ? 0.05 : 0;
      return Math.min(0.96, 0.84 + 0.14 * lenRatio + prefixBoost);
    }
    if (cn.length >= 2 && query.includes(cn)) return 0.9;
    return ratio(query, cn);
  }
  let best = 0;
  for (const cand of vietCandidates(rec)) {
    let s;
    if (cand === query) s = 1;
    else if (query.length >= 3 && cand.includes(query)) {
      // Substring: ưu tiên trùng dài hơn + khớp đầu chuỗi (prefix). Giữ < 1 để
      // exact luôn xếp trên.
      const lenRatio = query.length / cand.length;
      const prefixBoost = cand.startsWith(query) ? 0.05 : 0;
      s = Math.min(0.97, 0.8 + 0.12 * lenRatio + prefixBoost);
    } else s = ratio(query, cand);
    if (s > best) best = s;
  }
  return best;
}

function labelConfidence(score) {
  if (score >= 0.99) return "high";
  if (score >= 0.85) return "medium";
  return "low";
}

/**
 * Khớp 1 query về record tốt nhất trong dict.
 * @returns {{record, score, confidence, matched}}
 */
export function matchDict(query, dict, { threshold = DEFAULT_THRESHOLD } = {}) {
  const raw = (query || "").trim();
  const cjk = HAS_CJK.test(raw);
  const q = cjk ? (CJK_OCR_ALIASES[raw] || raw) : normalizeText(raw);
  let best = null;
  let bestScore = 0;
  for (const rec of dict) {
    const s = scoreRecord(q, rec, cjk);
    if (s > bestScore) {
      bestScore = s;
      best = rec;
    }
  }
  const matched = best != null && bestScore >= threshold;
  return {
    record: best,
    score: bestScore,
    confidence: matched ? labelConfidence(bestScore) : "low",
    matched,
  };
}

/**
 * Tìm nhiều kết quả xếp hạng (cho UI từ điển). Trả [{record, score}] giảm dần.
 * Query rỗng -> trả toàn bộ dict (giữ thứ tự gốc).
 */
export function searchDict(query, dict, { threshold = 0.45, limit = 60 } = {}) {
  const raw = (query || "").trim();
  if (!raw) return dict.map((record) => ({ record, score: 0 }));
  const cjk = HAS_CJK.test(raw);
  const q = cjk ? (CJK_OCR_ALIASES[raw] || raw) : normalizeText(raw);
  const scored = [];
  for (const rec of dict) {
    const s = scoreRecord(q, rec, cjk);
    if (s >= threshold) scored.push({ record: rec, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
