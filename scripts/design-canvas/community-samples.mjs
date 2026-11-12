// Dữ liệu mẫu Đội cộng đồng + quản trị cho các công cụ chụp trang thật với `/api/**` giả lập
// (`capture-community.mjs` dựng artboard, `compare-moi.mjs` so ảnh 28 artboard Thiết kế mới). Đội mẫu lấy tướng +
// chiến pháp thật của Đội khác (id catalog) để thẻ hiện tên và chân dung đúng.
export const SEASON = { id: 's1', labelVi: 'Mùa 1', labelZh: '第一赛季', openedAt: '2026-10-01T00:00:00.000Z' };
export const SEASONS = { open: SEASON, seasons: [SEASON] };
export const AUTHORS = [
  { id: 'u2', name: 'Gia Cát', image: null }, { id: 'u3', name: 'Quan Vũ', image: null }, { id: 'u7', name: 'Tiểu Kiều', image: null },
];
// Tướng + chiến pháp lấy từ data/teams.json (Đội khác), đổi sang id catalog.
export const SAMPLES = [
  ['Vũ Tung Úc', ['hero:sp-quan-vu', 'hero:sp-hoang-phu-tung', 'hero:sp-tuan-uc'], [['tactic:trung-dung-nghia-liet', 'tactic:xe-dao-chuoc-dich'], ['tactic:phong-thi-tran', 'tactic:thuyen-co-muon-ten'], ['tactic:uy-muu-vo-dich', 'tactic:khong-danh-ma-thang']], 'thuong'],
  ['Phi Bình Vân', ['hero:truong-phi', 'hero:quan-ngan-binh', 'hero:trieu-van'], [['tactic:hoanh-tao-thien-quan', 'tactic:dai-kich-si'], ['tactic:thinh-khi-linh-dich', 'tactic:tat-phong-sau-vu'], ['tactic:loa-y-huyet-chien', 'tactic:duong-phong-thoi-quyet']], 'ky'],
  ['Mông Tốn Túc', ['hero:sp-lu-mong', 'hero:luc-ton', 'hero:lo-tuc'], [['tactic:duong-phong-thoi-quyet', 'tactic:binh-vo-thuong-the'], ['tactic:tien-thanh-ky-lu', 'tactic:cat-xuong-tri-doc'], ['tactic:tam-lanh-song-gio', 'tactic:bach-nhi-binh']], 'cung'],
  ['Lượng Hưng Bào', ['hero:sp-gia-cat-luong', 'hero:quan-hung', 'hero:truong-bao'], [['tactic:bat-mon-kim-toa-tran', 'tactic:khong-danh-ma-thang'], ['tactic:cuoi-ngua-nghin-dam', 'tactic:cuong-dung-vo-tien'], ['tactic:linh-thanh-chau', 'tactic:thuyen-co-muon-ten']], 'thuan'],
  ['Úc Liêu Cơ', ['hero:sp-tuan-uc', 'hero:truong-lieu', 'hero:vuong-nguyen-co'], [['tactic:thuyen-co-muon-ten', 'tactic:duong-phong-thoi-quyet'], ['tactic:mau-gianh-loi-the', 'tactic:bao-le-vo-nhan'], ['tactic:tam-lanh-song-gio', 'tactic:khong-danh-ma-thang']], 'thuong'],
  ['Phổ Siêu Úc', ['hero:trinh-pho', 'hero:sp-ma-sieu', 'hero:sp-tuan-uc'], [['tactic:tiem-long-tran', 'tactic:thuyen-co-muon-ten'], ['tactic:duong-phong-thoi-quyet', 'tactic:mau-gianh-loi-the'], ['tactic:lam-nguy-cuu-chu', 'tactic:giai-phien-ve']], 'khiGioi'],
];
export const VOTES = [[42, 3, 9, 12], [31, 5, 6, 8], [27, 2, 4, 5], [18, 6, 2, 3], [12, 1, 1, 2], [7, 2, 0, 1]];
export const teamItem = (index, overrides = {}) => {
  const [title, heroes, tactics, troop] = SAMPLES[index];
  const [upVotes, downVotes, evidenceCount, commentCount] = VOTES[index];
  return {
    id: `t${index + 1}`, title, season: SEASON, heroes, tactics, troop, author: AUTHORS[index % AUTHORS.length],
    upVotes, downVotes, evidenceCount, points: upVotes - downVotes, commentCount, imageCount: 1, textLang: 'vi',
    createdAt: `2026-10-${String(20 - index * 2).padStart(2, '0')}T08:00:00.000Z`, ...overrides,
  };
};
export const ANALYSIS = {
  playstyle: 'SP Quan Vũ mở đầu bằng Trung Dũng Nghĩa Liệt để giữ nhịp sát thương binh nhận; Hoàng Phủ Tung dựng Phong Thỉ Trận cho chủ tướng.\nSP Tuân Úc hồi máu và giảm sát thương mưu lược qua Uy Mưu Vô Địch, giữ đội bền đến hiệp 8.',
  strengths: 'Bền đầu trận, đánh tốt các đội mưu lược thuần.',
  weaknesses: 'Thiếu khống chế; gặp đội Kỵ cường công sớm dễ mất chủ tướng.',
  counters: 'Đội Cung mưu lược, Đội Thuẫn hồi máu.',
  counteredBy: 'Phi Bình Vân, đội Kỵ đánh nhanh.',
  substitutes: 'Thiếu SP Tuân Úc: dùng Tuân Úc thường, đổi Uy Mưu Vô Địch sang Lâm Nguy Cứu Chủ.',
};
export const teamDetail = (index, overrides = {}) => ({
  ...teamItem(index), status: 'approved', heroKey: [...SAMPLES[index][1]].sort().join(','), myVote: 1, seasonOpen: true,
  analysis: ANALYSIS, ...overrides,
});
export const REPORTS = [
  { id: 'r1', result: 'win', allyHeroes: ['关羽', '皇甫嵩', '荀彧'], enemyHeroes: ['张飞', '关银屏', '赵云'], note: 'Thắng ở hiệp 6, Quan Vũ còn 40% binh.', season: null, lang: 'vi', imageUrl: null, createdAt: '2026-10-19T08:00:00.000Z', author: AUTHORS[1] },
  { id: 'r2', result: 'loss', allyHeroes: ['关羽', '皇甫嵩', '荀彧'], enemyHeroes: ['吕蒙', '陆逊', '鲁肃'], note: 'Thua đội Cung hỏa công, nên đổi binh thư.', season: null, lang: 'vi', imageUrl: null, createdAt: '2026-10-18T08:00:00.000Z', author: AUTHORS[2] },
];
export const COMMENTS = [
  { id: 'c1', body: 'Đội này đánh PK rất ổn ở đầu mùa, nhớ lên đủ binh thư Tĩnh Tâm cho Tuân Úc.', lang: 'vi', createdAt: '2026-10-19T09:00:00.000Z', author: AUTHORS[2], canDelete: false },
  { id: 'c2', body: 'Thay Hoàng Phủ Tung bằng Từ Thịnh được không mọi người?', lang: 'vi', createdAt: '2026-10-18T12:00:00.000Z', author: AUTHORS[1], canDelete: false },
];
export const AI_READ = {
  screen: 'teamDetail',
  sides: [{ side: 'left', heroes: [
    { nameCn: '关羽', tacticsCn: ['忠勇义烈', '刮骨疗毒'], booksCn: [], statFocusCn: '' },
    { nameCn: '皇甫嵩', tacticsCn: ['锋矢阵', '草船借箭'], booksCn: [], statFocusCn: '' },
    { nameCn: '荀彧', tacticsCn: ['威谋靡亢', '不战而屈'], booksCn: [], statFocusCn: '' },
  ] }],
};
export const adminTeam = (index, overrides = {}) => teamItem(index, {
  author: { ...AUTHORS[index % AUTHORS.length], email: ['gia***@example.com', 'qua***@example.com', 'tie***@example.com'][index % 3], emailMasked: true },
  status: 'pending', rejectReason: null, deleting: false, ...overrides,
});
export const TEAM_AUDIT = [
  { id: 'a5', actor: { id: 'u5', role: 'moderator', label: 'Kiểm duyệt A' }, action: 'team.approve', target: { type: 'community_team', id: 't2', label: 'Phi Bình Vân' }, subjectUserId: 'u3', reason: null, meta: null, status: 'ok', createdAt: '2026-10-21T10:00:00.000Z' },
  { id: 'a4', actor: { id: 'u9', role: 'root', label: 'Quản trị' }, action: 'season.open', target: { type: 'community_season', id: 's1', label: 'Mùa 1' }, subjectUserId: null, reason: null, meta: null, status: 'ok', createdAt: '2026-10-01T00:00:00.000Z' },
];
