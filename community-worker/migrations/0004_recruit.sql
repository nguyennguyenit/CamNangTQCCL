-- Đồng bộ "Theo dõi chiêu mộ": mỗi bản ghi (tài khoản game, banner, lượt quay) của một user.
-- updated_at = mốc sửa phía client (ms) để gộp LWW; rev = số thứ tự tăng dần theo user, cấp lại
-- mỗi lần dòng được ghi, dùng làm con trỏ kéo thay đổi (GET /api/recruit?since=<rev>).
create table recruit_records (
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null check (kind in ('account', 'banner', 'event')),
  id text not null,
  updated_at integer not null,
  rev integer not null,
  payload text not null,
  primary key (user_id, kind, id)
);
create index recruit_records_user_rev_idx on recruit_records (user_id, rev);
