// Link nguồn của đội đã lưu (thuần): `source.key` đã qua `normalizeTeam` → `{family, id, variant}` → URL trang chi tiết.
// `source.key` chỉ ASCII: id nguồn có chữ Hán (hoặc quá dài) đã đổi sang `h-<16 hex>` (`sourceKeyPart`), nên tra ngược bằng cách
// băm từng id của bảng route `{r, l, k}` rồi so với phần id của khóa. Không suy id từ chữ của khóa.

import { sourceKeyPart } from "./my-teams-sources.js";
import { teamDetailHref } from "./team-detail-navigation.js";

const INDEX_URL = "/my-teams-source-index.json";
let indexPromise = null;

/**
 * `{ "kind:key": contentHash }` của nguồn hiện hành (`/my-teams-source-index.json`); một lần tải mỗi trang. Lỗi tải trả `null`
 * (không cache lỗi): chỉ làm mất nhãn "Bản gốc đã cập nhật" hoặc hash rỗng, không chặn lưu hay xem đội.
 */
export function loadSourceIndex(fetcher = globalThis.fetch) {
  indexPromise ??= (async () => {
    try {
      const response = await fetcher(INDEX_URL, { cache: "no-cache" });
      const body = response.ok ? await response.json() : null;
      return body && typeof body === "object" && !Array.isArray(body) ? body : null;
    } catch {
      return null;
    }
  })().then((index) => {
    if (!index) indexPromise = null;
    return index;
  });
  return indexPromise;
}

/** `source.kind` → họ trong bảng route (`r` Đội chuẩn, `l` Đội khác, `k` Khai hoang). `analyze` không có trang nguồn. */
const FAMILY_OF_KIND = { recommended: "r", legacy: "l", khaihoang: "k" };

/** Đích của `teamDetailHref` theo họ; chỉ Đội khác và Khai hoang có biến thể. */
function hrefTarget(family, id, variant) {
  if (family === "r") return { sourceConfigId: id };
  if (family === "l") return { legacyTeamId: id, legacyVariantId: variant };
  return { khaiHoangTeamId: id, khaiHoangVariantId: variant };
}

/**
 * @param tables `{r, l, k}`: id nguồn → route segment (cùng bảng đã đăng ký cho `teamDetailHref`).
 * @returns {{target(source), href(source, locale)}} cả hai trả `null` khi nguồn không có trang (analyze, kind lạ, id không còn).
 */
export function createSourceLinker(tables) {
  const reverse = {};
  for (const family of ["r", "l", "k"]) {
    reverse[family] = new Map(Object.keys(tables?.[family] ?? {}).map((id) => [sourceKeyPart(id), id]));
  }

  function target(source) {
    const family = FAMILY_OF_KIND[source?.kind];
    const key = source?.key;
    if (!family || typeof key !== "string" || !key) return null;
    const whole = reverse[family].get(key);
    if (whole !== undefined) return { family, id: whole, variant: null };
    // Id nguồn có thể chứa `~`, nên thử mọi vị trí tách phần id / biến thể, từ trái sang phải.
    for (let at = key.indexOf("~"); at > 0; at = key.indexOf("~", at + 1)) {
      const id = reverse[family].get(key.slice(0, at));
      const variant = key.slice(at + 1);
      if (id !== undefined && variant && family !== "r") return { family, id, variant };
    }
    return null;
  }

  function href(source, locale) {
    const found = target(source);
    if (!found) return null;
    return teamDetailHref(hrefTarget(found.family, found.id, found.variant), { locale });
  }

  return { target, href };
}
