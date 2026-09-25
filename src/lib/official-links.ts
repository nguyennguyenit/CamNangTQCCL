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
}

export const EXTERNAL_REL = 'noopener noreferrer';

/** Link tới khu vực trong Landing (Phase 4 dựng hai anchor này). */
export const DATA_SOURCE_HREF = '/#nguon-du-lieu';
export const DOWNLOAD_HREF = '/#tai-game';

function link(label: string, href: string, description?: string): SiteLink {
  return {label, href, external: href.startsWith('http'), ...(description ? {description} : {})};
}

export const OFFICIAL_LINKS: SiteLink[] = [
  link('Trang chủ game', 'https://tqccl.vntth.com/', 'Website chính thức của nhà phát hành'),
  link('Đổi quà', 'https://game-notice.vntth.com/64102ce206c21e0ac034b0b9/index', 'Trang đổi thưởng'),
  link('Web nạp', 'https://shop.vntth.com/s3g/vn', 'Cửa hàng nạp trên web'),
  link('Tra xem tư cách trở về', 'https://tqccl.vntth.com/prism-m0gbm2e5/index?access=s3gvn_website', 'Dành cho người chơi quay lại'),
  link('Chăm sóc khách hàng', 'mailto:s3g.service@thienthuonghoa.com', 's3g.service@thienthuonghoa.com'),
];

export const COMMUNITY_LINKS: SiteLink[] = [
  link('Fanpage Facebook', 'https://www.facebook.com/tamquocchi.chienluoc'),
  link('Nhóm Facebook', 'https://www.facebook.com/groups/707102010925675'),
  link('YouTube', 'https://www.youtube.com/@tamquocchi-chienluoc'),
];

export const DOWNLOAD_LINKS: SiteLink[] = [
  link('App Store', 'https://apps.apple.com/vn/app/id1616630100'),
  link('Google Play', 'https://play.google.com/store/apps/details?id=com.vntth.sgzzlb.gp.vn&gl=vn'),
  link('Máy tính (Windows)', 'https://global-package-publish.qookkagames.com/s3gsource/13/s3g_vn_0610.pc.exe'),
];
