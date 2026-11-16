-- Token API cá nhân (personal access token) cho tool bên ngoài ghi Theo dõi chiêu mộ không cần cookie.
-- Chỉ lưu SHA-256 hex của token (token_hash), không lưu token thô; hint = 4 ký tự cuối để user nhận diện.
-- expires_at null = không hạn; revoked_at khác null = đã thu hồi. Xoá user cascade.
create table api_tokens (
  id text primary key,
  user_id text not null references "user" ("id") on delete cascade,
  name text not null,
  token_hash text not null unique,
  hint text not null,
  scope text not null check (scope in ('recruit:write')),
  created_at integer not null,
  last_used_at integer,
  expires_at integer,
  revoked_at integer
);
create index api_tokens_user_idx on api_tokens (user_id, created_at);
