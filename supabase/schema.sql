-- Daily Ledger database
-- Run this whole file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  due_date date not null default current_date,
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.items enable row level security;

drop policy if exists "categories_select_own" on public.categories;
drop policy if exists "categories_insert_own" on public.categories;
drop policy if exists "categories_update_own" on public.categories;
drop policy if exists "categories_delete_own" on public.categories;

create policy "categories_select_own" on public.categories for select to authenticated using (user_id = auth.uid());
create policy "categories_insert_own" on public.categories for insert to authenticated with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories_delete_own" on public.categories for delete to authenticated using (user_id = auth.uid());

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;

create policy "items_select_own" on public.items for select to authenticated using (user_id = auth.uid());
create policy "items_insert_own" on public.items for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.categories c
    where c.id = category_id and c.user_id = auth.uid()
  )
);
create policy "items_update_own" on public.items for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.categories c
    where c.id = category_id and c.user_id = auth.uid()
  )
);
create policy "items_delete_own" on public.items for delete to authenticated using (user_id = auth.uid());

create index if not exists categories_user_sort_idx on public.categories(user_id, sort_order);
create index if not exists items_user_date_idx on public.items(user_id, due_date);
create index if not exists items_category_idx on public.items(category_id);
