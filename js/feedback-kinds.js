// Loại góp ý (thứ tự hiển thị) dùng chung cho hộp thoại ở footer (SiteLayout.astro) và tab Góp ý của trang
// quản trị. Mã loại khớp FEEDBACK_KINDS của community-worker (src/routes/feedback.ts).
export const FEEDBACK_KINDS = Object.freeze([
  Object.freeze({ id: 'feature', vi: 'Đề xuất tính năng', zh: '功能建议' }),
  Object.freeze({ id: 'bug', vi: 'Báo cáo lỗi', zh: '错误报告' }),
  Object.freeze({ id: 'wrong_info', vi: 'Thông tin sai', zh: '信息有误' }),
  Object.freeze({ id: 'other', vi: 'Khác', zh: '其他' }),
]);
