/**
 * Script inline ngay sau thân dựng sẵn của trang chi tiết Đội khác (`src/components/pages/LegacyDetail.astro`). Mỗi trang có
 * đúng một phương án (`#team-detail-root[data-legacy-variant-id]`); URL cũ `?variant=<mã đó>` trùng nội dung dựng sẵn nên giữ
 * nguyên thân, chỉ `variant` khác mã đó mới ẩn thân + huy hiệu tới khi `js/team-detail.js` đối chiếu rồi báo lỗi (không nháy sai
 * nội dung). Một nguồn cho trang và cho verifier (`scripts/verify-astro-dist.mjs` kiểm trang phát đúng chuỗi này).
 */
export const LEGACY_VARIANT_GUARD_SCRIPT = "(function(r,v){if(v!==null&&v!==r.dataset.legacyVariantId)document.getElementById('team-detail-body').hidden=document.getElementById('team-detail-badges').hidden=true;})(document.getElementById('team-detail-root'),new URLSearchParams(location.search).get('variant'));";
