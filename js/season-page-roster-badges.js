// Trang mùa cũ của Đội chuẩn (`/doi-chuan/<mã mùa>/`) là trang tĩnh không chạy js/app.js. Script này chỉ làm một
// việc: nếu máy có kho (khách: kho local; đã đăng nhập: cache cloud của chính người đó) thì tải dữ liệu cần thiết,
// gắn badge "Ráp được / Thiếu N món" lên các thẻ đã dựng sẵn và thêm dòng tóm tắt. Máy chưa có kho: không tải gì,
// trang giữ nguyên.
import { currentLocale } from "./i18n.js";
import { loadSession } from "./community-api.js";
import { createLookupPayloadLoader } from "./lookup-data.js";
import { loadRecommendedReference, setTacticDisplayName, setZhNameResolver } from "./recommended-reference-state.js";
import { buildListCoverage, readOwnedRoster } from "./roster-list-coverage.js";
import { decorateCoverageBadges, rosterSummaryNode } from "./roster-list-badges.js";
import { createByteLoader, loadRawNameResolver, readTacticDisplayTable } from "./website-display.js";

function storage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

async function initSeasonPageRosterBadges() {
  const section = document.getElementById("section-season-page");
  const pinNode = document.getElementById("recommended-publication");
  if (!section || !pinNode) return;
  const user = await loadSession({ probe: false });
  const roster = readOwnedRoster(storage(), { userId: user?.id ?? null });
  if (!roster) return;

  const loadBytes = createByteLoader();
  const loadLookupPayload = createLookupPayloadLoader(loadBytes);
  const loadRecommendedBytes = async (path) => {
    const response = await fetch(`/data/recommended/${path}`);
    if (!response.ok) throw new Error(`/data/recommended/${path}: ${response.status}`);
    return response.arrayBuffer();
  };
  const [model, heroesDict, tacticsDict, rawNames] = await Promise.all([
    loadRecommendedReference(JSON.parse(pinNode.textContent), loadRecommendedBytes),
    loadLookupPayload("heroes-dict.json"),
    loadLookupPayload("tactics.json"),
    // Tên Hán gốc chỉ cần cho bản zh (tên món thiếu trong title của badge); lỗi thì tên lùi về bản gốc.
    currentLocale() === "zh" ? loadRawNameResolver(loadBytes).catch(() => null) : null,
  ]);
  if (rawNames) setZhNameResolver(rawNames);
  setTacticDisplayName(readTacticDisplayTable());

  // Mùa của trang lấy từ chính các thẻ đã dựng: mọi thẻ của trang thuộc cùng một mùa nguồn.
  const records = model.index.records;
  const firstKey = section.querySelector("[data-source-config-id]")?.dataset.sourceConfigId;
  const seasonId = records.find((record) => record.sourceConfigId === firstKey)?.sourceSeasonId;
  if (!seasonId) return;
  const coverage = buildListCoverage({ records, seasonId, heroesDict, tacticsDict, roster });
  if (!coverage.summary.total) return;
  decorateCoverageBadges(section, coverage.byConfigId);
  section.querySelector(".reference-head-text")?.append(rosterSummaryNode(coverage.summary));
}

initSeasonPageRosterBadges().catch((error) => console.error(error));
