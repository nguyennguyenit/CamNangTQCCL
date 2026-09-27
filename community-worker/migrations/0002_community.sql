-- Bảng ứng dụng cộng đồng. Thời gian lưu epoch milliseconds (INTEGER); API trả ISO 8601.

-- Bình luận trên trang chi tiết đội. page_key không có tiền tố locale; lang tách vi/zh.
create table comments (
  id text not null primary key,
  page_key text not null,
  lang text not null check (lang in ('vi', 'zh')),
  user_id text not null references "user" ("id") on delete cascade,
  body text not null,
  created_at integer not null
);
create index comments_page_lang_created_idx on comments (page_key, lang, created_at desc, id desc);
create index comments_created_idx on comments (created_at desc, id desc);
create index comments_user_idx on comments (user_id);

-- Ảnh tải lên (chiến báo chờ gửi / media bài viết). object_key là khoá R2.
create table uploads (
  id text not null primary key,
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null check (kind in ('report', 'post')),
  object_key text not null unique,
  content_type text not null,
  size integer not null,
  status text not null check (status in ('pending', 'attached')),
  created_at integer not null
);
create index uploads_status_created_idx on uploads (status, created_at);

-- Chiến báo. Ảnh nằm ở R2 image_key (reports/<id>); chỉ approved là công khai.
create table battle_reports (
  id text not null primary key,
  page_key text not null,
  lang text not null check (lang in ('vi', 'zh')),
  user_id text not null references "user" ("id") on delete cascade,
  image_key text,
  result text not null check (result in ('win', 'loss', 'draw')),
  ally_heroes text not null,
  enemy_heroes text not null,
  note text,
  season text,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  reviewed_by text,
  reviewed_at integer,
  created_at integer not null
);
create index battle_reports_page_lang_status_created_idx on battle_reports (page_key, lang, status, created_at desc, id desc);
create index battle_reports_page_status_idx on battle_reports (page_key, status);
create index battle_reports_status_created_idx on battle_reports (status, created_at desc, id desc);
create index battle_reports_user_created_idx on battle_reports (user_id, created_at desc, id desc);

-- Bài viết blog (Markdown). Duy nhất theo (lang, slug) và (lang, translation_key).
create table posts (
  id text not null primary key,
  slug text not null,
  lang text not null check (lang in ('vi', 'zh')),
  translation_key text,
  title text not null,
  description text not null,
  body_markdown text not null,
  faq text not null,
  tags text not null,
  cover_image text,
  status text not null check (status in ('draft', 'published')),
  author_id text,
  author_name text not null,
  published_at integer,
  updated_at integer not null,
  created_at integer not null
);
create unique index posts_lang_slug_uidx on posts (lang, slug);
create unique index posts_lang_translation_key_uidx on posts (lang, translation_key) where translation_key is not null;
create index posts_status_published_idx on posts (status, published_at desc);

-- Bộ đếm rate limit theo cửa sổ cố định: key = "<hành động>:<userId>:<windowStart>".
create table rate_limits (
  key text not null primary key,
  count integer not null,
  expires_at integer not null
);
create index rate_limits_expires_idx on rate_limits (expires_at);
