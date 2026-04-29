alter table public.profiles
add column if not exists last_login_at timestamptz;
