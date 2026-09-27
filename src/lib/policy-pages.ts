/**
 * Các trang chính sách: nguồn duy nhất cho menu "Về cẩm nang" (header Landing, menu mobile, footer)
 * và danh sách trang tĩnh của sitemap/verifier. Đường dẫn là bản Việt; bản Trung nằm dưới `/zh/`.
 */
export interface PolicyPage {
  path: string;
  label: {vi: string; zh: string};
  description: {vi: string; zh: string};
}

export const POLICY_PAGES = [
  {
    path: '/dieu-khoan-su-dung/',
    label: {vi: 'Điều khoản sử dụng', zh: '使用条款'},
    description: {vi: 'Quy định khi dùng cẩm nang và công cụ', zh: '使用手册与工具的规定'},
  },
  {
    path: '/chinh-sach-bao-mat/',
    label: {vi: 'Chính sách bảo mật', zh: '隐私政策'},
    description: {vi: 'Dữ liệu thu thập, nơi lưu và cách xoá', zh: '收集哪些数据、存放位置与删除方式'},
  },
  {
    path: '/quy-tac-cong-dong/',
    label: {vi: 'Quy tắc cộng đồng', zh: '社区规范'},
    description: {vi: 'Nội quy bình luận và chiến báo', zh: '评论与战报的规则'},
  },
  {
    path: '/mien-tru-trach-nhiem/',
    label: {vi: 'Miễn trừ trách nhiệm', zh: '免责声明'},
    description: {vi: 'Bản quyền game, nguồn dữ liệu, giới hạn', zh: '游戏版权、数据来源与责任限制'},
  },
] as const satisfies readonly PolicyPage[];

/** Hộp thư liên hệ chung của mọi trang chính sách (cũng là tài khoản quản trị). */
export const POLICY_CONTACT_EMAIL = 'nguyennlt.ncc@gmail.com';
