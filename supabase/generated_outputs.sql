create extension if not exists pgcrypto;

create table if not exists public.saved_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  title text,
  author text,
  file_name text,
  thumbnail_data text,
  source_type text,
  output_length text,
  tone text,
  source_text text,
  simplified_text text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists saved_outputs_user_id_created_at_idx
  on public.saved_outputs (user_id, created_at desc);

alter table public.saved_outputs enable row level security;

drop policy if exists "Users can read their own generated outputs"
  on public.saved_outputs;

create policy "Users can read their own generated outputs"
  on public.saved_outputs
  for select
  to authenticated
  using (auth.uid() = user_id);
