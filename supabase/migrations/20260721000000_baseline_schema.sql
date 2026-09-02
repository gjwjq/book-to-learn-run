-- BOOK TO LEARN & RUN의 후속 마이그레이션이 빈 프로젝트에서도 재현되도록
-- 최초 공통 테이블만 멱등적으로 준비합니다. 기존 데이터와 테이블은 삭제하지 않습니다.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '회원',
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists name text not null default '회원',
  add column if not exists role text not null default 'member',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.books (
  id text primary key,
  title text not null,
  author text not null,
  publisher text,
  published_date date,
  category text not null default '기타',
  keywords text[] not null default '{}'::text[],
  description text,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.books
  add column if not exists title text,
  add column if not exists author text,
  add column if not exists publisher text,
  add column if not exists published_date date,
  add column if not exists category text not null default '기타',
  add column if not exists keywords text[] not null default '{}'::text[],
  add column if not exists description text,
  add column if not exists thumbnail text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- 초기 버전에서 사용하던 테이블입니다. 최신 대출/예약 테이블로 이전된 뒤에도
-- 예전 마이그레이션의 트리거와 정리 함수가 실패하지 않도록 유지합니다.
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text references public.books(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text references public.books(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 20260806_inquiry_multiple_images.sql이 파일명 정렬상 문의 본체보다 먼저 실행돼도
-- 안전하도록 문의 기본 스키마를 이 단계에서 마련합니다.
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  image_path text,
  image_paths text[] not null default '{}'::text[],
  is_secret boolean not null default false,
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  answered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.favorites enable row level security;
alter table public.inquiries enable row level security;

drop policy if exists "members view own profile" on public.profiles;
create policy "members view own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "visitors view books" on public.books;
create policy "visitors view books"
  on public.books for select to anon, authenticated
  using (true);

drop policy if exists "members manage own favorites" on public.favorites;
create policy "members manage own favorites"
  on public.favorites for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.profiles to authenticated;
grant select on public.books to anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

commit;
