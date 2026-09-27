/**
 * Liên kết game chính thức, cộng đồng và tải game — nguồn duy nhất cho header, menu mobile,
 * footer và Landing. Mọi mục giữ sẵn `rel` nên chỗ render không tự đặt lại quy ước link ngoài.
 * Nguồn URL: plans/reports/brainstorm-260923-2033-official-game-links-menu.md §1 (quét 2026-09-23).
 */
export interface SiteLink {
  label: string;
  href: string;
  /** Link http(s) mở tab mới kèm `rel`; `mailto:` không cần. */
  external: boolean;
  /** Chỉ mục có mô tả một dòng mới khai (artboard LandingMenu · LandingMenuMobile). */
  description?: string;
  /** Nhãn bản Trung (`/zh/`); vắng thì nhãn là tên riêng dùng chung (YouTube, App Store…). */
  labelZh?: string;
  descriptionZh?: string;
}

/** Nhãn theo ngôn ngữ trang: bản zh dùng `labelZh` khi có, không bao giờ hiện nhãn tiếng Việt cạnh chữ Trung. */
export function localizedLinkLabel(link: SiteLink, locale: 'vi' | 'zh'): string {
  return locale === 'zh' && link.labelZh ? link.labelZh : link.label;
}

export function localizedLinkDescription(link: SiteLink, locale: 'vi' | 'zh'): string | undefined {
  return locale === 'zh' && link.descriptionZh ? link.descriptionZh : link.description;
}

export const EXTERNAL_REL = 'noopener noreferrer';

/** Link tới khu vực trong Landing (Phase 4 dựng hai anchor này). */
export const DATA_SOURCE_HREF = '/#nguon-du-lieu';
export const DOWNLOAD_HREF = '/#tai-game';

function link(label: string, href: string, description?: string, zh?: {label: string; description?: string}): SiteLink {
  return {
    label,
    href,
    external: href.startsWith('http'),
    ...(description ? {description} : {}),
    ...(zh ? {labelZh: zh.label, ...(zh.description ? {descriptionZh: zh.description} : {})} : {}),
  };
}

export const OFFICIAL_LINKS: SiteLink[] = [
  link('Trang chủ game', 'https://tqccl.vntth.com/', 'Website chính thức của nhà phát hành', {label: '游戏官网', description: '发行商官方网站'}),
  link('Đổi quà', 'https://game-notice.vntth.com/64102ce206c21e0ac034b0b9/index', 'Trang đổi thưởng', {label: '兑换礼包', description: '兑奖页面'}),
  link('Web nạp', 'https://shop.vntth.com/s3g/vn', 'Cửa hàng nạp trên web', {label: '网页充值', description: '网页版充值商城'}),
  link('Tra xem tư cách trở về', 'https://tqccl.vntth.com/prism-m0gbm2e5/index?access=s3gvn_website', 'Dành cho người chơi quay lại', {label: '回归资格查询', description: '面向回归玩家'}),
  link('Chăm sóc khách hàng', 'mailto:s3g.service@thienthuonghoa.com', 's3g.service@thienthuonghoa.com', {label: '客服', description: 's3g.service@thienthuonghoa.com'}),
];

export const COMMUNITY_LINKS: SiteLink[] = [
  link('Fanpage Facebook', 'https://www.facebook.com/tamquocchi.chienluoc', undefined, {label: 'Facebook 主页'}),
  link('Nhóm Facebook', 'https://www.facebook.com/groups/707102010925675', undefined, {label: 'Facebook 群组'}),
  link('YouTube', 'https://www.youtube.com/@tamquocchi-chienluoc'),
];

/** Trang chủ game — nguồn của câu "Liên kết lấy từ website chính thức" ở mục Tải game (Landing). */
export const OFFICIAL_GAME_SITE_HREF = OFFICIAL_LINKS[0].href;

export const APP_STORE_LINK: SiteLink = link('App Store', 'https://apps.apple.com/vn/app/id1616630100');
export const GOOGLE_PLAY_LINK: SiteLink = link('Google Play', 'https://play.google.com/store/apps/details?id=com.vntth.sgzzlb.gp.vn&gl=vn');
export const DESKTOP_DOWNLOAD_LINK: SiteLink = link('Máy tính (Windows)', 'https://global-package-publish.qookkagames.com/s3gsource/13/s3g_vn_0610.pc.exe', undefined, {label: '电脑版（Windows）'});

export const DOWNLOAD_LINKS: SiteLink[] = [APP_STORE_LINK, GOOGLE_PLAY_LINK, DESKTOP_DOWNLOAD_LINK];
