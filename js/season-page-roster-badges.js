// Trang mùa cũ của Đội chuẩn (`/doi-chuan/<mã mùa>/`) là trang tĩnh không chạy js/app.js. Script này chỉ làm một
// việc: nếu máy có kho (khách: kho local; đã đăng nhập: cache cloud của chính người đó) thì tải dữ liệu cần thiết,
// gắn badge "Ráp được / Thiếu N món" lên các thẻ đã dựng sẵn và thêm dòng tóm tắt. Máy chưa có kho: không tải gì,
// trang giữ nguyên. Trang trả về từ bfcache được vẽ lại: gỡ badge/tóm tắt cũ, hỏi lại phiên, đọc lại kho.
import { loadSession } from "./community-api.js";
import { createLookupPayloadLoader } from "./lookup-data.js";
import { loadRecommendedReference, setTacticDisplayName } from "./recommended-reference-state.js";
import { buildListCoverage, readOwnedRoster } from "./roster-list-coverage.js";
import { decorateCoverageBadges, rosterSummaryNode } from "./roster-list-badges.js";
import { createByteLoader, readTacticDisplayTable } from "./website-display.js";

function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Dữ liệu chung của trang (generation Đội chuẩn, từ điển): tải một lần khi máy có kho, dùng lại khi vẽ lại. */
let pageData = null;
function loadPageData(pinNode) {
  if (!pageData) {
    const loadBytes = createByteLoader();
    const loadLookupPayload = createLookupPayloadLoader(loadBytes);
    const loadRecommendedBytes = async (path) => {
      const response = await fetch(`/data/recommended/${path}`);
      if (!response.ok) throw new Error(`/data/recommended/${path}: ${response.status}`);
      return response.arrayBuffer();
    };
    pageData = Promise.all([
      loadRecommendedReference(JSON.parse(pinNode.textContent), loadRecommendedBytes),
      loadLookupPayload("heroes-dict.json"),
      loadLookupPayload("tactics.json"),
    ]).catch((error) => {
      pageData = null;
      throw error;
    });
  }
  return pageData;
}

/** Gỡ badge và dòng tóm tắt đã gắn (lượt vẽ trước). */
function clearRosterDecorations(section) {
  decorateCoverageBadges(section, null);
  for (const old of section.querySelectorAll(".reference-roster-summary")) old.remove();
}

let paintRun = 0;

async function paintSeasonPageRosterBadges({ fresh = false } = {}) {
  const section = document.getElementById("section-season-page");
  const pinNode = document.getElementById("recommended-publication");
  if (!section || !pinNode) return;
  const run = ++paintRun;
  clearRosterDecorations(section);
  const user = await loadSession({ probe: false, fresh });
  const roster = readOwnedRoster(storage(), { userId: user?.id ?? null });
  if (!roster) return;

  const [model, heroesDict, tacticsDict] = await loadPageData(pinNode);
  // Một lượt vẽ mới đã bắt đầu (trang lại vừa trả về từ bfcache): lượt này bỏ, không gắn trùng.
  if (run !== paintRun) return;
  // Bản vi: tên chiến pháp hiện theo tên game VN hiện hành (bảng nhúng lúc build). Bản zh dùng `nameZh` của độ phủ.
  setTacticDisplayName(readTacticDisplayTable());

  // Mùa của trang lấy từ chính các thẻ đã dựng: mọi thẻ của trang thuộc cùng một mùa nguồn.
  const records = model.index.records;
  const firstKey = section.querySelector('[data-source-config-id]:not([data-source-config-id=""])')?.dataset.sourceConfigId;
  const seasonId = records.find((record) => record.sourceConfigId === firstKey)?.sourceSeasonId;
  if (!seasonId) return;
  const coverage = buildListCoverage({ records, seasonId, heroesDict, tacticsDict, roster });
  if (!coverage.summary.total) return;
  clearRosterDecorations(section);
  decorateCoverageBadges(section, coverage.byConfigId);
  section.querySelector(".reference-head-text")?.append(rosterSummaryNode(coverage.summary, { line: true }));
}

const paint = (options) => paintSeasonPageRosterBadges(options).catch((error) => console.error(error));
paint();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) paint({ fresh: true });
});
