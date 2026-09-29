-- Soi đội: tín hiệu lỗi để đo độ chính xác đọc ảnh chiến báo.
-- scan_stats: đếm ẩn danh cộng dồn theo ngày UTC (không ảnh, không tên, không IP).
create table scan_stats (
  day text not null,
  screen text not null check (screen in ('battleReport', 'teamDetail', 'other')),
  side text not null check (side in ('left', 'right')),
  events integer not null default 0,
  cells_read integer not null default 0,
  cells_edited integer not null default 0,
  cells_unclear integer not null default 0,
  primary key (day, screen, side)
);

-- scan_samples: ảnh người dùng chủ động gửi (đã đồng ý); admin duyệt rồi xuất thành fixture bộ ảnh chuẩn.
-- image_key null sau khi bị từ chối (đã xoá ảnh R2). ai_read/confirmed là JSON.
create table scan_samples (
  id text not null primary key,
  user_id text not null references "user" ("id") on delete cascade,
  image_key text,
  screen text not null check (screen in ('battleReport', 'teamDetail', 'other')),
  side text not null check (side in ('left', 'right')),
  lang text not null check (lang in ('vi', 'zh')),
  ai_read text not null,
  confirmed text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text references "user" ("id") on delete set null,
  reviewed_at integer,
  created_at integer not null
);
create index scan_samples_status_created_idx on scan_samples (status, created_at desc, id desc);
