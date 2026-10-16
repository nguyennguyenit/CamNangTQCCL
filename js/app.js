// Điều phối dữ liệu tĩnh và mục của MỘT trang mục: mỗi đường dẫn tự nạp dữ liệu, tự mount mục
// của mình. Không còn tab, hashchange hay switchSection — điều hướng giữa các mục là chuyển trang.

import { seasonConfigDetail, el, khaihoangTable } from "./render.js";
import { createLookupPayloadLoader, loadLookupBundle } from "./lookup-data.js";
import { initLookupPage } from "./lookup-page.js";
import { setLookupRouteHandlesFromJSON } from "./lookup-ids.js";
import { LOOKUP_GROUP_PAYLOADS } from "./unified-lookup.js";
import { initAnalyze } from "./analyze.js";
import { initRecruitTracker } from "./recruit-tracker.js";
import { initRosterRecommend } from "./roster-recommend-ui.js";
import { createByteLoader, displayValue, loadRawNameResolver, loadWebsiteDisplay, localizeData } from "./website-display.js";
import { L, currentLocale, localePath } from "./i18n.js";

import { COEXIST_LATEST_SCENARIO_ID, coexistGroups, coexistScenarioIds as coexistScenarioIdsOf, loadSeasonModel, readSeasonQuery, updateSeasonURL, BUNDLE_NOTICE } from './season-ui-state.js';
import { createSeasonCoexistSection, createRecommendedSection } from "./team-filter-section.js";
import { resolveBrowseState, projectSeasonBrowse } from './season-context.js';
import { loadRecommendedReference, referenceSectionState, setZhNameResolver } from './recommended-reference-state.js';
import { writeStoredTeamView, canonicalTeamView, TEAM_VIEW_CARDS } from "./team-view.js";
import {
  KHAIHOANG_TEAM_QUERY_KEY,
  KHAIHOANG_VARIANT_QUERY_KEY,
  captureReturnSnapshot,
  isNativeNavigationClick,
  khaiHoangPairFromUrl,
  khaiHoangCardHref,
  khaiHoangUrlWithPair,
  matchesReturnSnapshot,
  referenceDetailHref,
  migrateLegacyReferenceUrl,
  readReturnSnapshot,
  safeKhaiHoangVariants,
  setTeamRouteHandlesFromJSON,
  teamDetailHref,
  teamDetailPath,
  writeReturnSnapshot,
} from './team-detail-navigation.js';

const $ = (sel) => document.querySelector(sel);

/** Đội chuẩn/Đội khác: hai trang danh sách tham chiếu. */
const REFERENCE_SECTIONS = ['team-chuan', 'team-khac'];
/** Hai công cụ Beta: không có phạm vi mùa của layout (Soi đội tự chọn mùa Đội chuẩn trong công cụ). */
const TOOL_SECTIONS = ['analyze', 'roster-recommend'];
/** Mục dùng cả kho Tra cứu (tướng, chiến pháp, catalog): Theo dõi chiêu mộ và hai công cụ. */
const LOOKUP_SECTIONS = ['recruit-tracker', ...TOOL_SECTIONS];
/** Nguồn của kho Tra cứu mà publication hiển thị pin: manifest neo ba payload, `heroes-dict` là khóa số liệu. */
const LOOKUP_SOURCES = ['data/heroes-dict.json', 'data/tactics.json', 'data/lookup-catalog.json', 'data/lookup-manifest.json'];
/** Payload Tra cứu → khóa tài liệu của corpus. */
const LOOKUP_DOC_KEYS = Object.freeze({ 'heroes-dict.json': 'heroes', 'tactics.json': 'tactics', 'lookup-catalog.json': 'catalog' });
/** Khóa theo dõi bị bỏ khỏi URL trang mục ngay khi khởi động; mọi khóa khác giữ nguyên. */
const TRACKING_PARAM = /^(?:utm_.+|fbclid|gclid|msclkid)$/;

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

// Tier team là tùy chọn: thiếu file không được làm vỡ site (team không tier vẫn render).
async function loadOptionalJSON(path, fallback) {
  try {
    return await loadJSON(path);
  } catch {
    return fallback;
  }
}

/**
 * Binh thư của Tra cứu: `books-dict` nằm ngoài lookup manifest nên byte phải khớp hash build pin trên
 * chính trang (`#lookup-books-hash`); thiếu pin hoặc lệch hash thì nhóm Binh thư không nạp.
 */
async function loadLookupBooks(loadBytes) {
  const pin = JSON.parse($('#lookup-books-hash')?.textContent ?? 'null');
  if (typeof pin !== 'string') throw new Error('Thiếu pin binh thư');
  const bytes = await loadBytes('data/books-dict.json');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  if ('sha256:' + [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('') !== pin) throw new Error('books-dict không khớp pin');
  const books = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  if (!Array.isArray(books)) throw new Error('books-dict không hợp lệ');
  return books;
}

/** URL trang mục sạch khóa theo dõi: `replaceState` để không thêm bước lịch sử. */
function stripTrackingParams() {
  const url = new URL(location.href);
  const removed = [...url.searchParams.keys()].filter((key) => TRACKING_PARAM.test(key));
  if (!removed.length) return;
  for (const key of removed) url.searchParams.delete(key);
  history.replaceState(history.state, '', url);
}

/** Khóa đã nghỉ của Đội chuẩn/Đội khác (bộ lọc điểm, bộ chọn danh mục): bỏ qua và xóa khỏi URL ngay lần replaceState đầu. */
/**
 * Nhãn kịch bản/phiên bản luật theo ngôn ngữ. Registry chỉ có nhãn Việt (`labelVi` = "PK-S26 · Anh Hùng Mệnh Thế")
 * và không có tên chữ Hán gốc, nên bản zh hiện mã mùa trung tính ("PK-S26") thay vì chữ Việt; không có mã thì dùng id.
 */
function scenarioText(scenario) {
  if (!scenario) return '';
  if (currentLocale() !== 'zh') return scenario.labelVi;
  const code = scenario.labelVi.split(' · ')[0].trim();
  return /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code) ? code : scenario.id;
}
const rulesetText = rule => (rule && currentLocale() === 'zh' ? rule.id : rule?.label || '');

const RETIRED_REFERENCE_PARAMS = ['score', 'category'];
function stripRetiredReferenceParams(pageSection) {
  if (!REFERENCE_SECTIONS.includes(pageSection)) return;
  const url = new URL(location.href);
  const present = RETIRED_REFERENCE_PARAMS.filter((key) => url.searchParams.has(key));
  if (!present.length) return;
  for (const key of present) url.searchParams.delete(key);
  history.replaceState(history.state, '', url);
}

/** Khóa phạm vi mùa đã nghỉ ở hai công cụ (Soi đội, Gợi ý đội): link cũ không được mang trạng thái vô hình. */
const RETIRED_TOOL_PARAMS = ['scenario', 'ruleset', 'config'];
function stripRetiredToolParams(pageSection) {
  if (!TOOL_SECTIONS.includes(pageSection)) return;
  const url = new URL(location.href);
  const present = RETIRED_TOOL_PARAMS.filter((key) => url.searchParams.has(key));
  if (!present.length) return;
  for (const key of present) url.searchParams.delete(key);
  history.replaceState(history.state, '', url);
}

/** localStorage có thể bị chặn (chế độ riêng tư): đọc/ghi lựa chọn Thẻ/Bảng chỉ là ghi nhớ. */
function localStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

async function main() {
  const pageSection = document.body.dataset.pageSection || '';
  const mount = pageSection ? $(`#section-${pageSection}`) : null;
  // app.js chỉ được nạp ở trang mục; thiếu mount là lỗi build nên không giữ trang ở trạng thái chờ.
  if (!mount) {
    document.body.dataset.boot = 'ready';
    return;
  }
  // Bảng route handle phải sẵn sàng trước migrate và mọi lần dựng href.
  setTeamRouteHandlesFromJSON($('#team-route-handles')?.textContent);
  // Slug trang riêng của từng mục Tra cứu: thẻ dựng lại trong trình duyệt phải trỏ đúng cùng link với HTML dựng sẵn.
  setLookupRouteHandlesFromJSON($('#lookup-route-handles')?.textContent);
  stripTrackingParams();
  stripRetiredReferenceParams(pageSection);
  stripRetiredToolParams(pageSection);
  // Layout sở hữu payload: có `#season-controls` nghĩa là trang này có phạm vi mùa. app.js
  // không giữ danh sách mục nào của riêng nó, nên thêm/bớt trang chỉ cần sửa layout.
  const controls = $('#season-controls');
  const seasonScoped = controls !== null;
  let websiteDisplay = null;
  try {
    // Một bộ nạp cho cả trang: publication, mô hình mùa và kho Tra cứu đọc chung byte, mỗi file một request.
    const loadBytes = createByteLoader();
    const loadData = name => loadBytes(name).then(bytes => JSON.parse(new TextDecoder().decode(bytes)));
    const recommendedPin = JSON.parse($('#recommended-publication').textContent);
    // Mỗi trang chỉ tải và xác minh nguồn chính nó đọc. Đội gốc: Gợi ý đội, hoặc link cũ `legacyTeam`
    // cần nhận diện đội để chuyển tiếp (URL có `config` không chuyển tiếp). Soi đội đối chiếu với
    // generation Đội chuẩn/Đội khác nên không cần kho đội gốc.
    const bootParams = new URL(location.href).searchParams;
    const needsTeams = pageSection === 'roster-recommend' || (bootParams.has('legacyTeam') && !bootParams.has('config'));
    const needsLookup = LOOKUP_SECTIONS.includes(pageSection);
    // Trang nhóm Tra cứu chỉ xác minh manifest + payload của nhóm; payload hồ sơ tải lười khi mở hồ sơ.
    const lookupGroup = pageSection === 'lookup' ? document.body.dataset.lookupGroup : null;
    const lookupPayloads = lookupGroup ? LOOKUP_GROUP_PAYLOADS[lookupGroup] : null;
    if (lookupGroup && !lookupPayloads) throw new Error(`Nhóm Tra cứu không hợp lệ: ${lookupGroup}`);
    const websitePin = JSON.parse($('#website-display-publication').textContent);
    // Phần thân dựng sẵn của bốn mục đội chỉ được nhận lại khi build dựng từ đúng publication mà trang này xác minh.
    const adoptPrerendered = mount.dataset.ssrSource === websitePin.sha256;
    websiteDisplay = await loadWebsiteDisplay(
      websitePin,
      loadBytes,
      recommendedPin,
      {paths: [
        ...(needsTeams ? ['data/teams.json'] : []),
        ...(pageSection === 'coexist' ? ['data/coexist.json'] : []),
        ...(pageSection === 'khaihoang' ? ['data/khaihoang.json'] : []),
        ...(needsLookup ? LOOKUP_SOURCES : []),
        ...(lookupPayloads?.entry.length ? ['data/lookup-manifest.json', ...lookupPayloads.entry.map(name => `data/${name}`)] : []),
      ]},
    );
    const loadLookupPayload = createLookupPayloadLoader(loadBytes);
    const loadLookupDocs = async names => Object.fromEntries(
      await Promise.all(names.map(async name => [LOOKUP_DOC_KEYS[name], await loadLookupPayload(name)])),
    );
    const [teamsSource, coexistSource, khaihoangSource, booksDict] = await Promise.all([
      needsTeams ? loadData("data/teams.json") : null,
      pageSection === 'coexist' ? loadData("data/coexist.json") : null,
      pageSection === 'khaihoang' ? loadData("data/khaihoang.json") : null,
      pageSection === 'analyze' ? loadData("books-dict") : null,
    ]);
    const teams = teamsSource && localizeData(websiteDisplay, "data/teams.json", teamsSource);
    const coexist = coexistSource && localizeData(websiteDisplay, "data/coexist.json", coexistSource);
    const khaihoang = khaihoangSource && localizeData(websiteDisplay, "data/khaihoang.json", khaihoangSource);
    // Controller Khai hoang do renderer dựng; app chỉ bơm callback và giữ lựa chọn qua snapshot.
    let khaiHoangUI = null;
    // Inventory của Khai hoang: chỉ ID còn tồn tại mới được ghi vào snapshot phục hồi.
    const khaihoangInventory = new Map(
      (!khaihoang || Array.isArray(khaihoang) ? [] : khaihoang.teams || [])
        .map(team => [team.id, new Set((team.variants || []).map(variant => variant.id))]),
    );
    // Kho Tra cứu, tier (chỉ Gợi ý đội) và mô hình mùa độc lập nhau: tải song song, lỗi của từng phần tự xử lý.
    const [lookupBundle, teamTier, seasonModel, rawNames, lookupBooks, lookupDocs] = await Promise.all([
      needsLookup ? loadLookupBundle(loadBytes).catch(() => null) : null,
      pageSection === 'roster-recommend' ? loadOptionalJSON("/data/team-tier.json", []) : [],
      // Phạm vi mùa chỉ có payload ở 3 trang mục; thiếu hash là trang không dùng đến mô hình mùa.
      controls && $('#season-artifact-hashes')
        ? loadSeasonModel(JSON.parse($('#season-artifact-hashes').textContent), loadBytes)
          .catch(() => null) // Legacy display stays available with an explicit notice.
        : null,
      // Bản Trung: bộ tra tên Hán gốc cho dữ liệu cũ chỉ lưu tên Hán-Việt; lỗi chỉ làm tên lùi về Hán-Việt.
      // Trang Tra cứu chỉ cần bộ này khi mở hồ sơ tướng nên tải lười ở đó.
      lookupGroup ? null : loadRawNameResolver(loadBytes).catch(() => null),
      // Binh thư chỉ có ở trang nhóm Binh thư; lỗi chỉ làm lưới trống.
      lookupGroup === 'books' ? loadLookupBooks(loadBytes).catch(() => []) : [],
      lookupPayloads ? loadLookupDocs(lookupPayloads.entry).catch(() => null) : null,
    ]);
    if (rawNames) setZhNameResolver(rawNames);
    if ((needsLookup && !lookupBundle) || (lookupPayloads && !lookupDocs)) {
      mount.append(el("p", { class: "error", role: "alert" }, L("Dữ liệu Tra cứu hiện không khả dụng. Các mục đội hình vẫn hoạt động.", "图鉴查询数据暂不可用。阵容相关栏目仍可正常使用。")));
    }
    const heroesDict = lookupBundle?.heroes ?? [];
    const tactics = lookupBundle?.tactics ?? [];
    // Generation Đội chuẩn chỉ tải khi trang thật sự cần: hai trang danh sách ngay lúc boot, các trang
    // khác (Tra cứu, Khai hoang, Công cụ) chỉ qua `loadRecommended()` nếu có nơi hỏi tới. Nhờ vậy trang
    // Tra cứu không kéo `index.json`/`other-teams.json` khi chưa mở hồ sơ; promise lỗi bị xóa để thử lại.
    let recommendedModel = null;
    let recommendedPending = null;
    const loadRecommendedBytes = async path => {
      const response = await fetch(`/data/recommended/${path}`);
      if (!response.ok) throw new Error(`/data/recommended/${path}: ${response.status}`);
      return response.arrayBuffer();
    };
    const loadRecommended = () => {
      if (!recommendedPending) {
        recommendedPending = loadRecommendedReference(recommendedPin, loadRecommendedBytes)
          .then(model => { recommendedModel = model; return model; })
          .catch(error => { recommendedPending = null; throw error; });
      }
      return recommendedPending;
    };
    if (REFERENCE_SECTIONS.includes(pageSection)) {
      try { await loadRecommended(); } catch { /* Recommended views render an isolated unavailable state below. */ }
    }
    // URL tham chiếu cũ đi tiếp bằng identity thật; bảng route handle đã phát cho mọi trang mục nên
    // nhận diện Đội chuẩn không cần nạp index.
    const migration = migrateLegacyReferenceUrl(location.href, {
      hasRecommended: id => teamDetailPath({ sourceConfigId: id }) !== null,
      hasLegacy: id => teams?.some(team => team.id === id) ?? false,
    });
    if (migration) { location.replace(migration.target); return; }
    // Cùng Tồn có đúng một điều khiển mùa (ô chọn của mục) và URL `scenario` sở hữu lựa chọn. URL chưa có
    // `scenario` thì chọn mùa của nhóm trong `group` (link cũ đã chia sẻ), không thì mùa mới nhất;
    // ghi bằng replaceState để không thêm bước lịch sử.
    const reviewedScenarioIds = seasonModel
      ? seasonModel.data['season-registry'].filter(item => item.reviewStatus === 'reviewed').map(item => item.id)
      : [];
    // Ô chọn mùa Cùng Tồn đặt mùa mới nhất lên đầu, các mùa còn lại giữ thứ tự registry.
    const coexistScenarioIds = coexistScenarioIdsOf(seasonModel);
    if (pageSection === 'coexist' && coexistScenarioIds.length && !new URL(location.href).searchParams.has('scenario')) {
      const groupParam = new URL(location.href).searchParams.getAll('group');
      const linked = groupParam.length === 1
        ? seasonModel.data['season-content-links'].find(link => link.recordId === groupParam[0])?.scenarioId
        : null;
      const scenario = coexistScenarioIds.includes(linked) ? linked : coexistScenarioIds[0];
      history.replaceState(history.state, '', updateSeasonURL(location.href, {scenario}));
    }
    let browse = seasonModel ? readSeasonQuery(location.href, seasonModel).browse : null;
    let projection = seasonModel ? projectSeasonBrowse(seasonModel, browse) : null;
    const sections = {};
    let openedConfig = null;
    const detailMount = controls ? el('div',{id:'season-detail-mount'}) : null;
    controls?.after(detailMount);
    detailMount?.addEventListener('keydown',event=>{
      if (event.key !== 'Escape' || !detailMount.querySelector('#season-config-detail')) return;
      event.preventDefault();
      navigateQuery({config:null});
      sections[pageSection]?.focus?.();
    });
    /** Nút nhập kho của chi tiết cấu hình là link thật tới công cụ Gợi ý đội (không mang phạm vi mùa). */
    const rosterImportHref = () => localePath('/goi-y-doi-tu-kho/');
    const coexistUI = pageSection === 'coexist' ? createSeasonCoexistSection({
      mount,
      // Nhãn kịch bản lấy từ registry đã xác thực; nhóm không gắn kịch bản dùng nhãn riêng của mục.
      scenarioLabel: scenarioId => scenarioText(seasonModel?.data['season-registry'].find(item => item.id === scenarioId)),
      onGroup: syncCoexistGroup,
      adopt: adoptPrerendered,
      onScenario: scenarioId => {
        const next = resolveBrowseState(seasonModel, {scenarioId}, {origin:'scenario-change'});
        navigateQuery({scenario:next.scenarioId, ruleset:next.rulesetId, config:null}, true);
      },
    }) : null;
    // Đóng chi tiết cấu hình trả focus về đầu mục Cùng Tồn như hai trang danh sách đội.
    if (coexistUI) sections.coexist = coexistUI;
    /**
     * Nhóm Cùng Tồn đang xem nằm trong query của chính trang mục; chỉ `replaceState` (không render lại)
     * để đổi nhóm và nhóm cũ hết hợp lệ đều không tạo thêm bước lịch sử.
     */
    function syncCoexistGroup(key) {
      if (pageSection !== 'coexist') return;
      const next = String(updateSeasonURL(location.href, {group: key ?? null}));
      if (next === location.href) return;
      history.replaceState(history.state, '', next);
    }
    function renderTeams() {
      if (!seasonModel) return;
      const state = readSeasonQuery(location.href,seasonModel);
      const detailKey=JSON.stringify([state.configId,state.browse]);
      if (openedConfig === detailKey && detailMount.childElementCount) return;
      openedConfig = detailKey;
      detailMount.replaceChildren();
      if (!state.configId) return;
      // Chỉ dựng đúng hàng được mở: nhóm phân loại theo thứ tự ưu tiên, hàng đầu tiên khớp `configId`.
      let row = null;
      for (const classification of ['applicable','scenarioReference','unknown']) {
        const match = projection[classification].find(item=>item.configId === state.configId);
        if (match) { row = {...match,classification}; break; }
      }
      if (!row) { detailMount.append(el('p',{class:'error',role:'status'},L('Không có cấu hình này trong phạm vi đã chọn.','所选范围内没有此配置。'))); return; }
      detailMount.append(seasonConfigDetail(row,seasonModel,{
        onClose:()=>{
          navigateQuery({config:null});
          sections[pageSection]?.focus?.();
        },
        importHref:rosterImportHref(),
      }));
    }
    const navigateQuery = (changes, push = false) => {
      const url = updateSeasonURL(location.href, changes);
      history[push ? 'pushState' : 'replaceState'](history.state, '', url);
      const params = new URL(location.href).searchParams;
      if (detailMount) detailMount.hidden = !['config','detail','legacyTeam'].some(key=>params.has(key)) && !REFERENCE_SECTIONS.includes(pageSection);
      renderScope();
    };
    const navigateReference = (changes, push = false) => {
      // Kiểu hiển thị được ghi nhớ theo trình duyệt; URL chỉ mang `view=luoi|bang`, Thẻ là mặc định.
      if (Object.hasOwn(changes, 'view')) writeStoredTeamView(localStore(), changes.view);
      const url = new URL(location.href);
      for (const [key,value] of Object.entries(changes)) {
        url.searchParams.delete(key);
        if (Array.isArray(value)) value.forEach(item=>url.searchParams.append(key,item));
        else if (value !== null && value !== undefined && value !== '') url.searchParams.set(key,value);
      }
      history[push ? 'pushState' : 'replaceState'](history.state, '', url);
      renderReference();
      const params = new URL(location.href).searchParams;
      if (detailMount) detailMount.hidden = !['config','detail','legacyTeam'].some(key=>params.has(key)) && !REFERENCE_SECTIONS.includes(pageSection);
    };
    const sessionStore = () => {
      try { return globalThis.sessionStorage; } catch { return null; }
    };
    const referenceHref = row => referenceDetailHref(row, {from:location.href});
    // Snapshot chỉ là trạng thái giao diện; lỗi storage không được chặn điều hướng.
    const rememberReturn = () => {
      const tab = pageSection;
      const snapshot = captureReturnSnapshot({
        href:location.href,
        scrollY:window.scrollY,
        tab,
        disclosures:sections[tab]?.getDisclosureState?.() || {
          filters:$(`#section-${tab}-filters`)?.classList.contains('collapsed') === false,
        },
        // Chỉ root Khai hoang đã mount mới ghi map; map rỗng vẫn là lựa chọn hợp lệ của người dùng.
        khaihoangVariants:khaiHoangUI?.getVariants(),
        khaihoangInventory,
      });
      if (!snapshot) return;
      history.replaceState({...history.state,teamReturn:snapshot},'',location.href);
      writeReturnSnapshot(snapshot,sessionStore());
    };
    // Chỉ trang Khai hoang mới ghi cặp đang chọn vào URL của chính nó.
    const syncKhaiHoangRoot = (teamId, variantId) => {
      if (pageSection !== 'khaihoang') return;
      const url = khaiHoangUrlWithPair(location.href,{teamId,variantId});
      if (url === `${location.pathname}${location.search}${location.hash}`) return;
      history.replaceState(history.state,'',url);
    };
    const onReferenceNavigate = event => { if (isNativeNavigationClick(event)) rememberReturn(); };
    const khaiHoangSelections = snapshot => snapshot && Object.hasOwn(snapshot,'khaihoangVariants')
      ? safeKhaiHoangVariants(snapshot.khaihoangVariants,khaihoangInventory)
      : null;
    const restoreReturnState = () => {
      const fromHistory = history.state?.teamReturn;
      const historySnapshot = fromHistory && matchesReturnSnapshot(fromHistory,location.href)
        ? captureReturnSnapshot({
            href:location.href,
            scrollY:fromHistory.scrollY,
            tab:fromHistory.tab,
            disclosures:fromHistory.disclosures,
            khaihoangVariants:fromHistory.khaihoangVariants,
            khaihoangInventory,
          })
        : null;
      const historySelections = khaiHoangSelections(historySnapshot);
      const sessionSnapshot = historySelections === null
        ? readReturnSnapshot(location.href,sessionStore(),{khaihoangInventory})
        : null;
      // Snapshot history cũ thiếu map không được che map mới hơn trong session; map rỗng thì có quyền.
      const selections = historySelections ?? khaiHoangSelections(sessionSnapshot);
      if (khaiHoangUI && (selections !== null || pageSection === 'khaihoang')) {
        const next = {...(selections || {})};
        if (pageSection === 'khaihoang') {
          const pair = khaiHoangPairFromUrl(location.href);
          const params = new URL(location.href).searchParams;
          const teamParams = params.getAll(KHAIHOANG_TEAM_QUERY_KEY);
          const variantParams = params.getAll(KHAIHOANG_VARIANT_QUERY_KEY);
          if (teamParams.length === 1 && variantParams.length <= 1 && khaihoangInventory.has(pair.teamId)
            && (variantParams.length === 0 || (pair.variantId && khaihoangInventory.get(pair.teamId).has(pair.variantId)))) {
            next[pair.teamId] = pair.variantId;
          }
        }
        khaiHoangUI.setVariants(next);
      }
      const snapshot = historySnapshot || sessionSnapshot;
      if (!snapshot) return;
      const section=sections[snapshot.tab || pageSection];
      if (section?.setDisclosureState) section.setDisclosureState(snapshot.disclosures);
      else section?.setFiltersExpanded?.(snapshot.disclosures?.filters);
      if (!snapshot.scrollY) return;
      requestAnimationFrame(()=>window.scrollTo({top:snapshot.scrollY,behavior:'instant'}));
    };
    function renderReference() {
      if (!REFERENCE_SECTIONS.includes(pageSection) || !recommendedModel) return;
      const registry = recommendedModel.seasons || {};
      // URL > giá trị đã lưu > Thẻ; cả hai trang danh sách dùng chung một lựa chọn (cùng hàm với bản dựng sẵn).
      sections['team-chuan']?.update(recommendedModel.index.records,referenceSectionState('recommended',location.href,registry,localStore()),registry);
      sections['team-khac']?.update(recommendedModel.other.records,referenceSectionState('other',location.href,registry,localStore()),registry);
      canonicaliseView();
    }
    /** N5-3: `view` chỉ có nghĩa khi là `luoi` hoặc `bang`; `?view=the` (mặc định) và giá trị lạ/lặp bị bỏ
     *  khỏi URL để mọi đường link cùng nghĩa có cùng một hình dạng. Chạy sau khi render nên thông báo về giá
     *  trị không hợp lệ vẫn hiện ở lượt đọc đầu; `replaceState` nên không thêm mục lịch sử. */
    function canonicaliseView() {
      const url = new URL(location.href);
      const values = url.searchParams.getAll('view');
      const canonical = canonicalTeamView(values[0]);
      const meaningful = canonical !== null && canonical !== TEAM_VIEW_CARDS;
      if (!values.length || (values.length === 1 && meaningful)) return;
      url.searchParams.delete('view');
      if (meaningful) url.searchParams.set('view', canonical);
      history.replaceState(history.state, '', url);
    }
    // Cùng Tồn không có select phạm vi: ô chọn mùa của mục là điều khiển duy nhất.
    const scopeSelects = seasonScoped && pageSection !== 'coexist';
    const scenarioSelect = scopeSelects ? el('select', {id:'season-scenario'}, [el('option',{value:''},L('Tất cả — tham khảo','全部 — 仅供参考')), ...reviewedScenarioIds.map(id => el('option',{value:id},scenarioText(seasonModel.data['season-registry'].find(scenario=>scenario.id===id))))]) : null;
    const rulesetSelect = scopeSelects ? el('select', {id:'season-ruleset', 'aria-label':L('Phiên bản luật','规则版本')}) : null;
    const rulesetControl = scopeSelects ? el('label',{id:'season-ruleset-control',for:'season-ruleset'},[L('Phiên bản luật','规则版本'),rulesetSelect]) : null;
    const summary = seasonScoped ? el('p', {id:'season-summary', role:'status', class:'scope-note'}) : null;
    if (seasonScoped) {
      controls.replaceChildren(...(scopeSelects ? [el('div',{class:'reference-scope-controls'},[el('label',{for:'season-scenario'},[L('Mùa','赛季'),scenarioSelect]),rulesetControl])] : []), summary);
      // Đội chuẩn/Đội khác giữ khối phạm vi ẩn (URL vẫn đọc được); Cùng Tồn chỉ giữ dòng tóm tắt ẩn.
      controls.hidden = true;
      summary.hidden = pageSection === 'coexist';
      if (scopeSelects && !seasonModel) { scenarioSelect.disabled = true; rulesetSelect.disabled = true; }
    }
    scenarioSelect?.addEventListener('change', () => {
      const next = resolveBrowseState(seasonModel, scenarioSelect.value ? {scenarioId:scenarioSelect.value} : {}, {origin:'scenario-change'});
      navigateQuery({scenario:next.scenarioId, ruleset:next.rulesetId, config:null}, true);
    });
    rulesetSelect?.addEventListener('change', () => navigateQuery({ruleset:rulesetSelect.value,config:null},true));
    function renderScope() {
      if (!seasonScoped) return;
      browse = seasonModel ? readSeasonQuery(location.href, seasonModel).browse : null;
      projection = seasonModel ? projectSeasonBrowse(seasonModel, browse) : null;
      const scenario = seasonModel?.data['season-registry'].find(item=>item.id === browse?.scenarioId);
      const rule = scenario?.rulesets.find(item=>item.id === browse?.rulesetId);
      if (scopeSelects) {
        scenarioSelect.value = scenario?.id || '';
        rulesetSelect.replaceChildren(el('option',{value:''},L('Chưa chọn — tham khảo','未选择 — 仅供参考')), ...(scenario?.rulesets || []).filter(rule=>rule.reviewStatus === 'reviewed').map(rule=>el('option',{value:rule.id},rulesetText(rule))));
        rulesetSelect.value = browse?.rulesetId || '';
        rulesetSelect.disabled = !scenario || !scenario.rulesets.some(rule=>rule.reviewStatus === 'reviewed');
      }
      summary.textContent = !seasonModel ? BUNDLE_NOTICE : browse.kind === 'invalid' ? L('Kịch bản hoặc phiên bản luật không hợp lệ. Hãy chọn lại phạm vi.','剧本或规则版本无效，请重新选择范围。') : browse.kind === 'all-reference' ? L('Tất cả — tham khảo','全部 — 仅供参考') : `${scenarioText(scenario)} · ${browse.kind === 'verified-pair' ? rulesetText(rule) : scenario?.rulesets.some(rule=>rule.reviewStatus === 'reviewed') ? L('Chưa chọn phiên bản luật — tham khảo','未选择规则版本 — 仅供参考') : L('Chưa có phiên bản luật được xác minh — tham khảo','暂无已验证的规则版本 — 仅供参考')}`;
      if (coexistUI) {
        const groups = projection ? coexistGroups(projection) : coexist.map(content=>({content,source:null}));
        // `group` không hợp lệ (kể cả lặp khóa) được coi là "có yêu cầu": mục tự về nhóm đầu và bỏ khỏi URL.
        const groupParams = new URL(location.href).searchParams.getAll('group');
        coexistUI.update(groups, groupParams.length === 0 ? null : groupParams.length === 1 ? groupParams[0] : '', {
          scenarios: coexistScenarioIds,
          selected: browse?.scenarioId ?? null,
          latest: coexistScenarioIds.includes(COEXIST_LATEST_SCENARIO_ID) ? COEXIST_LATEST_SCENARIO_ID : null,
        });
      }
      renderTeams();
    }
    if (pageSection === 'team-chuan') {
      sections['team-chuan'] = recommendedModel
        ? createRecommendedSection({mount,family:'recommended',onQuery:navigateReference,hrefFor:referenceHref,onNavigate:onReferenceNavigate,adopt:adoptPrerendered})
        : null;
    } else if (pageSection === 'team-khac') {
      sections['team-khac'] = recommendedModel
        ? createRecommendedSection({mount,family:'other',onQuery:navigateReference,hrefFor:referenceHref,onNavigate:onReferenceNavigate,adopt:adoptPrerendered})
        : null;
    }
    if (REFERENCE_SECTIONS.includes(pageSection) && !recommendedModel) {
      // Lên đầu mục: sau thẻ dựng sẵn (tối đa 60 đội) thông báo sẽ nằm ngoài tầm nhìn.
      mount.prepend(el('p',{class:'error',role:'status'}, pageSection === 'team-chuan'
        ? L('Dữ liệu đội chuẩn hiện không khả dụng. Các mục khác vẫn hoạt động.', '推荐阵容数据暂不可用。其他栏目仍可正常使用。')
        : L('Dữ liệu đội khác hiện không khả dụng. Các mục khác vẫn hoạt động.', '其他阵容数据暂不可用。其他栏目仍可正常使用。')));
    }
    const refresh = () => {
      if (detailMount) detailMount.hidden = !new URL(location.href).searchParams.has('config') && !REFERENCE_SECTIONS.includes(pageSection);
      renderScope();
      renderReference();
      khaiHoangUI?.updateLinks();
    };
    // Mount controller Khai hoang trước restore: restoration ghi lựa chọn vào card đã dựng,
    // href tự đủ state cho Cmd/Ctrl-click và copy link mà không cần sửa URL nguồn.
    if (pageSection === 'khaihoang') {
      khaiHoangUI = khaihoangTable(khaihoang, {
        // Trang Khai hoang do build dựng sẵn: nhận lại nguyên DOM đó, chỉ gắn sự kiện.
        adopt: adoptPrerendered ? mount.querySelector(':scope > .khaihoang') : null,
        hrefFor: (teamId, variantId) => khaiHoangCardHref(teamId, variantId, {from: location.href}),
        // Primary click: đồng bộ cặp đang bấm rồi mới ghi snapshot, không preventDefault.
        onNavigate: (event, teamId, variantId) => {
          if (!isNativeNavigationClick(event)) return;
          syncKhaiHoangRoot(teamId, variantId);
          rememberReturn();
        },
        // Đổi select: URL mục theo cặp mới và snapshot được làm mới ngay.
        onChange: (teamId, variantId) => {
          syncKhaiHoangRoot(teamId, variantId);
          rememberReturn();
        },
      });
      // Thẻ dựng sẵn đã nằm trong mount: giữ nguyên node (không mất focus của người đã tab vào thẻ trước khi boot).
      if (khaiHoangUI.element.parentNode !== mount) mount.replaceChildren(khaiHoangUI.element);
      // Link `#cham-su`/`#mo` đã có đích từ HTML dựng sẵn, nhưng khi nhận lại DOM hay dựng mới, cuộn lại cho chắc.
      if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
    refresh();
    // Trạng thái đầu (URL, kiểu hiển thị) đã dựng xong: hiện lại phần dựng sẵn bị ẩn TRƯỚC khi khôi phục, vì focus() không
    // vào được phần tử đang `visibility: hidden`. Cùng một task với restore nên lựa chọn Khai hoang không kịp nháy.
    delete mount.dataset.ssrStale;
    restoreReturnState();
    // Back/Forward đổi URL: đọc lại và render trạng thái do URL sở hữu (mùa, bộ lọc, chi tiết
    // cấu hình) TRƯỚC khi khôi phục disclosure/lựa chọn/scroll.
    // Tra cứu giữ listener popstate riêng của nó trong `initLookupPage`.
    window.addEventListener("popstate", () => {
      refresh();
      restoreReturnState();
    });
    window.addEventListener('pageshow', event => { if (event.persisted) restoreReturnState(); });
    // Scroll mới nhất phải vào snapshot trước khi rời trang bằng paste/copy URL.
    window.addEventListener('pagehide', rememberReturn);
    // Tên Hán nguồn của binh thư (phồn thể, tên cũ) do build nhúng từ bảng danh tính đã duyệt.
    const bookAliases = JSON.parse($('#lookup-book-aliases')?.textContent || 'null') ?? {};
    // Trang Trang bị / Quân sư: tên tướng mang đặc kỹ độc quyền / kỹ năng do build nhúng sẵn (không tải heroes-dict).
    const ownerHeroes = JSON.parse($('#lookup-owner-heroes')?.textContent || 'null');
    if (lookupGroup && lookupDocs) initLookupPage({
      group: lookupGroup,
      mount,
      docs: { ...lookupDocs, ...(ownerHeroes ? { heroes: ownerHeroes } : {}), books: lookupBooks, bookAliases },
      loadProfileDocs: () => loadLookupDocs(lookupPayloads.profile),
      summary: lookupGroup === 'heroes' ? {
        pin: recommendedPin,
        loadBytes: loadRecommendedBytes,
        // Khóa nối của số liệu là chính kho Tra cứu đang phát (hash `heroes-dict` của publication).
        catalogSha256: websiteDisplay?.sourceHashes?.["data/heroes-dict.json"] ?? null,
      } : lookupGroup === 'tactics' ? {
        pin: recommendedPin,
        loadBytes: loadRecommendedBytes,
        // Số liệu chiến pháp nối qua cả kho chiến pháp lẫn kho tướng (ID tướng mang) của publication.
        tacticCatalogSha256: websiteDisplay?.sourceHashes?.["data/tactics.json"] ?? null,
        heroCatalogSha256: websiteDisplay?.sourceHashes?.["data/heroes-dict.json"] ?? null,
      } : null,
      // Bản Trung: bộ tra tên Hán gốc (có binh thư) cho khối "Trong cẩm nang"; bản Việt trả null, không tải gì.
      loadRawNames: () => loadRawNameResolver(loadBytes),
    });

    // Kết quả công cụ giữ nguyên trang người dùng: đội chuẩn theo mùa và đội gốc đi trang chi tiết riêng.
    const onOpenTeam = (team) => {
      const href = teamDetailHref(team.source === 'season' ? {sourceConfigId:team.id} : {legacyTeamId:team.id},{from:location.href});
      if (!href) return;
      rememberReturn();
      location.assign(href);
    };
    if (lookupBundle) {
      if (pageSection === 'recruit-tracker') initRecruitTracker({ heroesDict, mount });
      // Soi đội nạp generation Đội chuẩn lười (lần đầu cần đối chiếu); link đội qua route chi tiết chung.
      if (pageSection === 'analyze') initAnalyze({ heroesDict, tacticsDict: tactics, booksDict, loadRecommended, teamHref: referenceHref, onNavigate: onReferenceNavigate }, mount);
      if (pageSection === 'roster-recommend') initRosterRecommend({ teams, teamTier, heroesDict, tacticsDict: tactics, loadRecommended, onOpenTeam }, mount);
    } else if (['recruit-tracker', 'analyze', 'roster-recommend'].includes(pageSection)) {
      mount.append(el("p", { class: "error", role: "status" }, L("Tính năng này cần dữ liệu Tra cứu đang không khả dụng.", "此功能需要的图鉴查询数据暂不可用。")));
    }
  } catch (err) {
    console.error(err);
    // Bản Việt dùng mẫu lỗi đã duyệt trong publication; bản Trung không áp lớp dịch Việt nên dùng câu riêng.
    const template = websiteDisplay
      ? L(displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate"), "数据加载失败：{message}。请刷新页面，如问题持续请联系管理员。")
      : L("Không thể tải dữ liệu. Hãy tải lại trang hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.", "无法加载数据。请刷新页面，如问题持续请联系管理员。");
    mount.prepend(el("p", { class: "error", role: "alert" }, template.replace("{message}", L("không xác định", "未知错误"))));
  } finally {
    // Lỗi boot: thà hiện thân dựng sẵn (kèm thông báo lỗi ở trên) còn hơn để trống.
    delete mount.dataset.ssrStale;
    // Tín hiệu cho e2e: mount xong, kể cả khi nhánh trên đã lỗi.
    document.body.dataset.boot = 'ready';
  }
}

main();
