-- Đồng bộ kho Gợi ý đội và Đội của tôi: mỗi bản ghi nhỏ (hộp, món kho, mùa, đội khóa, món bù, nhóm, đội) của một user.
-- Hợp đồng: docs/roster-sync.md. updated_at = mốc Lamport phía client (ms) để gộp LWW; rev = số thứ tự tăng dần theo user,
-- cấp lại mỗi lần dòng được ghi, dùng làm con trỏ kéo (GET /api/roster?since=<rev>). Số 0011 vì 0007–0010 đã có chủ.
create table roster_records (
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null check (kind in ('box', 'owned', 'season', 'locked', 'override', 'group', 'team')),
  id text not null,
  box_id text,                       -- null chỉ với kind = 'box'
  updated_at integer not null,       -- ms, đóng dấu Lamport phía client, khoá LWW
  rev integer not null,              -- tăng dần theo user, con trỏ kéo
  deleted integer not null default 0 check (deleted in (0, 1)),
  payload text not null,             -- bản xoá chỉ giữ {id, updatedAt, deletedAt, boxId}
  primary key (user_id, kind, id),
  check ((kind = 'box') = (box_id is null))
);
create index roster_records_user_rev_idx on roster_records (user_id, rev);
create index roster_records_user_kind_live_idx on roster_records (user_id, kind, deleted);
create index roster_records_user_box_idx on roster_records (user_id, box_id);
