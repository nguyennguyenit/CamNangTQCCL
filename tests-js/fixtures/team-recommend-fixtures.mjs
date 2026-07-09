export const fixtureTeams = [
  {
    id: "t0-alpha",
    name: "Alpha T0",
    source: "team-intro",
    heroes: [
      { baseName: "Hứa Du", name: "Hứa Du", tactics: [{ name: "Thuyền Cỏ Mượn Tên", alternatives: [] }] },
      { baseName: "Mã Siêu", name: "SP Mã Siêu", tactics: [{ name: "Đương Phong Thôi Quyết", alternatives: [] }] },
      { baseName: "Quan Ngân Bình", name: "Quan Ngân Bình", tactics: [{ name: "Giải Phiền Vệ", alternatives: [] }] },
    ],
  },
  {
    id: "t0-beta",
    name: "Beta T0 Missing Hero",
    source: "team-intro",
    heroes: [
      { baseName: "Hứa Du", name: "Hứa Du", tactics: [{ name: "Tạm Lánh Sóng Gió", alternatives: [] }] },
      { baseName: "Hoàng Mã", name: "Hoàng Mã", tactics: [{ name: "Lâm Nguy Cứu Chủ", alternatives: [] }] },
      { baseName: "Tào Tháo", name: "Tào Tháo", tactics: [{ name: "Phong Thi Trận", alternatives: [] }] },
    ],
  },
  {
    id: "t1-variant",
    name: "Variant Team",
    source: "team-intro",
    heroes: [
      { baseName: "Chu Du", name: "Chu Du", tactics: [{ name: "Đoạt Hồn Hiệp Phách", alternatives: ["Thừa Địch Bất Ngu"] }] },
      { baseName: "Lỗ Túc", name: "Lỗ Túc", tactics: [{ name: "Phong Thi Trận", alternatives: [] }] },
      { baseName: "Trần Dực", name: "Trần Dực", tactics: [{ name: "Toàn Quân Đồng Lòng", alternatives: [] }] },
    ],
  },
  {
    id: "t1-conflict",
    name: "Conflict Team",
    source: "team-intro",
    heroes: [
      { baseName: "Cam Ninh", name: "Cam Ninh", tactics: [{ name: "Đương Phong Thôi Quyết", alternatives: [] }] },
      { baseName: "Thái Sử Từ", name: "Thái Sử Từ", tactics: [{ name: "Thôi Phong Đoạn Nhẫn", alternatives: [] }] },
      { baseName: "Chu Thái", name: "Chu Thái", tactics: [{ name: "Quân Cẩm Phàm", alternatives: [] }] },
    ],
  },
  {
    id: "t1-gamma",
    name: "Gamma Team",
    source: "team-intro",
    heroes: [
      { baseName: "SP Quách Gia", name: "SP Quách Gia", tactics: [{ name: "Dốc Sức Tính Kế", alternatives: [] }] },
      { baseName: "CO Chân Cơ", name: "CO Chân Cơ", tactics: [{ name: "Phi Hùng Quân", alternatives: [] }] },
      { baseName: "Tào Tháo", name: "Tào Tháo", tactics: [{ name: "Tạm Lánh Sóng Gió", alternatives: [] }] },
    ],
  },
  {
    id: "t1-delta",
    name: "Delta Team",
    source: "team-intro",
    heroes: [
      { baseName: "SP Quan Vũ", name: "SP Quan Vũ", tactics: [{ name: "Trung Dũng Nghĩa Liệt", alternatives: [] }] },
      { baseName: "SP Hoàng Trung", name: "SP Hoàng Trung", tactics: [{ name: "Cưỡi Ngựa Nghìn Dặm", alternatives: [] }] },
      { baseName: "Lưu Bị", name: "Lưu Bị", tactics: [{ name: "An Ủi Quân Dân", alternatives: [] }] },
    ],
  },
  {
    id: "t2-epsilon",
    name: "Epsilon Team",
    source: "team-intro",
    heroes: [
      { baseName: "Tôn Quyền", name: "Tôn Quyền", tactics: [{ name: "Nhất Kỵ Đương Thiên", alternatives: [] }] },
      { baseName: "Tô Tín", name: "Tô Tín", tactics: [{ name: "Lõa Y Huyết Chiến", alternatives: [] }] },
      { baseName: "Lăng Thống", name: "Lăng Thống", tactics: [{ name: "Hổ Báo Kỵ", alternatives: [] }] },
    ],
  },
  {
    id: "t2-zeta",
    name: "Zeta Team",
    source: "team-intro",
    heroes: [
      { baseName: "Trương Giác", name: "Trương Giác", tactics: [{ name: "Thái Bình Đạo Pháp", alternatives: [] }] },
      { baseName: "Chu Thiệu", name: "Chu Thiệu", tactics: [{ name: "Lính Giáp Mây", alternatives: [] }] },
      { baseName: "Tả Từ", name: "Tả Từ", tactics: [{ name: "Cắt Xương Trị Độc", alternatives: [] }] },
    ],
  },
];

export const fixtureTier = [
  { teamId: "t0-alpha", rankings: [{ tier: "T0", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t0-beta", rankings: [{ tier: "T0", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t1-variant", rankings: [{ tier: "T1", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t1-conflict", rankings: [{ tier: "T1", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t1-gamma", rankings: [{ tier: "T1", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t1-delta", rankings: [{ tier: "T1", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t2-epsilon", rankings: [{ tier: "T2", source: "fixture", updatedAt: "2026-07-10" }] },
  { teamId: "t2-zeta", rankings: [{ tier: "T2", source: "fixture", updatedAt: "2026-07-10" }] },
];
