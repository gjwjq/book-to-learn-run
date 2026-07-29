-- 회원 도서 추가 요청과 관리자 승인 등록 기능

begin;

create table if not exists public.book_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  isbn text,
  title text not null,
  author text not null,
  publisher text,
  published_date date,
  category text not null default '기타',
  keywords text[] not null default '{}',
  description text,
  short_description text,
  thumbnail text,
  source_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create unique index if not exists book_requests_one_pending_external_id
  on public.book_requests (lower(external_id))
  where status = 'pending';

create index if not exists book_requests_requester_idx
  on public.book_requests (requester_id, requested_at desc);

create index if not exists book_requests_pending_idx
  on public.book_requests (requested_at asc)
  where status = 'pending';

alter table public.book_requests enable row level security;

drop policy if exists "members view own book requests" on public.book_requests;
create policy "members view own book requests"
  on public.book_requests for select
  to authenticated
  using (requester_id = auth.uid() or public.is_admin());

grant select on public.book_requests to authenticated;
revoke insert, update, delete on public.book_requests from anon, authenticated;

create or replace function public.request_book_addition(request_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  next_external_id text := left(trim(coalesce(request_data ->> 'externalId', '')), 500);
  next_title text := left(trim(coalesce(request_data ->> 'title', '')), 300);
  next_author text := left(trim(coalesce(request_data ->> 'author', '')), 300);
  next_keywords text[] := '{}';
  new_request_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if public.is_admin() then
    raise exception '관리자 계정은 도서 추가 요청을 보낼 수 없습니다';
  end if;
  if next_external_id = '' or next_title = '' or next_author = '' then
    raise exception '도서 정보가 올바르지 않습니다';
  end if;

  if exists (
    select 1
    from public.books
    where lower(regexp_replace(trim(title), '\s+', ' ', 'g'))
            = lower(regexp_replace(next_title, '\s+', ' ', 'g'))
      and lower(regexp_replace(trim(author), '\s+', ' ', 'g'))
            = lower(regexp_replace(next_author, '\s+', ' ', 'g'))
  ) then
    raise exception '이미 도서관에 등록된 도서입니다';
  end if;

  if exists (
    select 1
    from public.book_requests
    where lower(external_id) = lower(next_external_id)
      and status = 'pending'
  ) then
    raise exception '이미 추가 요청된 도서입니다';
  end if;

  if jsonb_typeof(request_data -> 'keywords') = 'array' then
    select coalesce(array(
      select left(trim(keyword), 60)
      from jsonb_array_elements_text(request_data -> 'keywords') as item(keyword)
      where trim(keyword) <> ''
      limit 8
    ), '{}')
    into next_keywords;
  end if;

  insert into public.book_requests (
    requester_id,
    external_id,
    isbn,
    title,
    author,
    publisher,
    published_date,
    category,
    keywords,
    description,
    short_description,
    thumbnail,
    source_url
  )
  values (
    current_user_id,
    next_external_id,
    nullif(left(trim(coalesce(request_data ->> 'isbn', '')), 30), ''),
    next_title,
    next_author,
    nullif(left(trim(coalesce(request_data ->> 'publisher', '')), 200), ''),
    case
      when coalesce(request_data ->> 'publishedDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
        then (request_data ->> 'publishedDate')::date
      else null
    end,
    coalesce(nullif(left(trim(coalesce(request_data ->> 'category', '')), 80), ''), '기타'),
    next_keywords,
    nullif(left(trim(coalesce(request_data ->> 'description', '')), 4000), ''),
    nullif(left(trim(coalesce(request_data ->> 'shortDescription', '')), 500), ''),
    nullif(left(trim(coalesce(request_data ->> 'thumbnail', '')), 1000), ''),
    nullif(left(trim(coalesce(request_data ->> 'sourceUrl', '')), 1000), '')
  )
  returning id into new_request_id;

  return new_request_id;
exception
  when unique_violation then
    raise exception '이미 추가 요청된 도서입니다';
end;
$$;

revoke all on function public.request_book_addition(jsonb) from public, anon;
grant execute on function public.request_book_addition(jsonb) to authenticated;

create or replace function public.admin_list_book_requests()
returns table (
  request_id uuid,
  requester_id uuid,
  requester_login_id text,
  requester_name text,
  requester_email text,
  external_id text,
  isbn text,
  title text,
  author text,
  publisher text,
  published_date date,
  category text,
  keywords text[],
  description text,
  short_description text,
  thumbnail text,
  source_url text,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select
    request.id,
    request.requester_id,
    profile.login_id,
    profile.name,
    auth_user.email::text,
    request.external_id,
    request.isbn,
    request.title,
    request.author,
    request.publisher,
    request.published_date,
    request.category,
    request.keywords,
    request.description,
    request.short_description,
    request.thumbnail,
    request.source_url,
    request.requested_at
  from public.book_requests request
  join public.profiles profile on profile.id = request.requester_id
  join auth.users auth_user on auth_user.id = request.requester_id
  where request.status = 'pending'
  order by request.requested_at asc;
end;
$$;

revoke all on function public.admin_list_book_requests() from public, anon;
grant execute on function public.admin_list_book_requests() to authenticated;

create or replace function public.admin_approve_book_request(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.book_requests%rowtype;
  next_book_id text;
  existing_book_id text;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select *
  into request_record
  from public.book_requests
  where id = target_request_id
    and status = 'pending'
  for update;

  if request_record.id is null then
    raise exception '처리할 도서 요청을 찾을 수 없습니다';
  end if;

  select id
  into existing_book_id
  from public.books
  where lower(regexp_replace(trim(title), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim(request_record.title), '\s+', ' ', 'g'))
    and lower(regexp_replace(trim(author), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim(request_record.author), '\s+', ' ', 'g'))
  limit 1;

  if existing_book_id is null then
    next_book_id := case
      when coalesce(regexp_replace(request_record.isbn, '[^0-9X]', '', 'gi'), '') <> ''
        then 'book-kakao-' || regexp_replace(request_record.isbn, '[^0-9X]', '', 'gi')
      else 'book-request-' || left(md5(request_record.external_id), 16)
    end;

    insert into public.books (
      id,
      title,
      author,
      publisher,
      published_date,
      category,
      keywords,
      description,
      short_description,
      thumbnail,
      total_quantity
    )
    values (
      next_book_id,
      request_record.title,
      request_record.author,
      request_record.publisher,
      request_record.published_date,
      request_record.category,
      request_record.keywords,
      request_record.description,
      request_record.short_description,
      request_record.thumbnail,
      1
    )
    on conflict (id) do nothing;

    existing_book_id := next_book_id;
  end if;

  update public.book_requests
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = target_request_id;

  return jsonb_build_object(
    'bookId', existing_book_id,
    'title', request_record.title
  );
end;
$$;

revoke all on function public.admin_approve_book_request(uuid) from public, anon;
grant execute on function public.admin_approve_book_request(uuid) to authenticated;

create or replace function public.admin_reject_book_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  update public.book_requests
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = target_request_id
    and status = 'pending';

  if not found then
    raise exception '처리할 도서 요청을 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.admin_reject_book_request(uuid) from public, anon;
grant execute on function public.admin_reject_book_request(uuid) to authenticated;

commit;
