-- Góp ý / báo lỗi từ nút ở footer. Khách ẩn danh gửi được (user_id null); email tuỳ chọn để trả lời.
-- page là đường dẫn trang đang xem (có tiền tố locale, vd /zh/tra-cuu/).
create table feedback (
  id text not null primary key,
  kind text not null check (kind in ('feature', 'bug', 'wrong_info', 'other')),
  title text not null,
  body text not null,
  email text,
  page text,
  lang text not null check (lang in ('vi', 'zh')),
  user_id text references "user" ("id") on delete set null,
  status text not null check (status in ('new', 'done')),
  created_at integer not null
);
create index feedback_created_idx on feedback (created_at desc, id desc);
create index feedback_status_created_idx on feedback (status, created_at desc, id desc);
