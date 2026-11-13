// Cặp so ảnh của nhóm Quản trị: AdminTeamsMoi, AdminAnalyze, AdminAIFeatures, AdminUsersMoi, AdminUserBanMoi, AdminAuditMoi (+ …Mobile).
// Chỉ nhánh của nhóm này sửa file này. Hình dạng cặp và trạng thái mock: đầu file scripts/design-canvas/compare-moi.mjs.
// Chạy riêng nhóm: node scripts/design-canvas/compare-moi.mjs --only quan-tri --base <url preview>
// Cặp tách theo khu trong thư mục moi-pairs/quan-tri/ (compare-moi chỉ nạp file .mjs ngay trong moi-pairs/).
import doiCongDong from './quan-tri/doi-cong-dong.mjs';
import nguoiDung from './quan-tri/nguoi-dung.mjs';
import soiDoiAi from './quan-tri/soi-doi-ai.mjs';

export default [...doiCongDong, ...soiDoiAi, ...nguoiDung];
