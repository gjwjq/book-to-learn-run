-- 회원 본인 문의 수정·삭제 및 대기 중 도서 추가 요청 취소
-- 20260724_book_addition_requests.sql,
-- 20260806_room_admin_and_inquiries.sql,
-- 20260806_inquiry_multiple_images.sql 실행 후 적용합니다.

begin;

-- 답변 전인 본인 문의만 수정할 수 있습니다.
create or replace function public.update_my_inquiry(
  target_inquiry_id uuid,
  next_title text,
  next_content text,
  next_is_secret boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_title text := btrim(coalesce(next_title, ''));
  normalized_content text := btrim(coalesce(next_content, ''));
begin
  if current_user_id is null then
    raise exception '로그인 후 문의를 수정할 수 있습니다';
  end if;
  if char_length(normalized_title) not between 1 and 100 then
    raise exception '제목은 1자 이상 100자 이내로 입력해 주세요';
  end if;
  if char_length(normalized_content) not between 1 and 1000 then
    raise exception '문의 내용은 1자 이상 1000자 이내로 입력해 주세요';
  end if;
  if not exists (
    select 1 from public.inquiries
    where id = target_inquiry_id and author_id = current_user_id
  ) then
    raise exception '수정할 수 있는 본인 문의를 찾지 못했습니다';
  end if;
  if exists (
    select 1 from public.inquiries
    where id = target_inquiry_id and author_id = current_user_id and answer is not null
  ) then
    raise exception '관리자 답변이 등록된 문의는 수정할 수 없습니다';
  end if;

  update public.inquiries
  set
    title = normalized_title,
    content = normalized_content,
    is_secret = coalesce(next_is_secret, false),
    updated_at = now()
  where id = target_inquiry_id
    and author_id = current_user_id
    and answer is null;

  if not found then
    raise exception '관리자 답변이 등록되어 문의를 수정할 수 없습니다';
  end if;
end;
$$;

revoke all on function public.update_my_inquiry(uuid, text, text, boolean) from public, anon;
grant execute on function public.update_my_inquiry(uuid, text, text, boolean) to authenticated;

-- 삭제된 문의의 사진 경로를 반환해 브라우저가 Storage 파일도 정리하게 합니다.
create or replace function public.delete_my_inquiry(target_inquiry_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  stored_image_paths text[];
begin
  if current_user_id is null then
    raise exception '로그인 후 문의를 삭제할 수 있습니다';
  end if;
  if not exists (
    select 1 from public.inquiries
    where id = target_inquiry_id and author_id = current_user_id
  ) then
    raise exception '삭제할 수 있는 본인 문의를 찾지 못했습니다';
  end if;
  if exists (
    select 1 from public.inquiries
    where id = target_inquiry_id and author_id = current_user_id and answer is not null
  ) then
    raise exception '관리자 답변이 등록된 문의는 삭제할 수 없습니다';
  end if;

  select array(
    select distinct image_path
    from unnest(
      coalesce(inquiry.image_paths, '{}'::text[])
      || case when inquiry.image_path is null then '{}'::text[] else array[inquiry.image_path] end
    ) as image_path
    where image_path is not null and btrim(image_path) <> ''
  )
  into stored_image_paths
  from public.inquiries inquiry
  where inquiry.id = target_inquiry_id
    and inquiry.author_id = current_user_id
    and inquiry.answer is null;

  delete from public.inquiries
  where id = target_inquiry_id
    and author_id = current_user_id
    and answer is null;

  if not found then
    raise exception '관리자 답변이 등록되어 문의를 삭제할 수 없습니다';
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications where related_type = $1 and related_id = $2'
      using 'inquiry', target_inquiry_id::text;
  end if;

  return coalesce(stored_image_paths, '{}'::text[]);
end;
$$;

revoke all on function public.delete_my_inquiry(uuid) from public, anon;
grant execute on function public.delete_my_inquiry(uuid) to authenticated;

-- 목록 응답에 현재 로그인 사용자의 글인지 여부를 안전하게 포함합니다.
drop function if exists public.list_inquiries();
create function public.list_inquiries()
returns table (
  id uuid,
  title text,
  content text,
  image_path text,
  image_paths text[],
  is_secret boolean,
  answer text,
  is_answered boolean,
  created_at timestamptz,
  answered_at timestamptz,
  author_name text,
  author_email text,
  can_view boolean,
  is_owner boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  viewer_id uuid := auth.uid();
  viewer_is_admin boolean := exists (
    select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  );
begin
  return query
  select
    inquiry.id,
    case when not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin then inquiry.title else null end,
    case when not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin then inquiry.content else null end,
    case when not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin then inquiry.image_path else null end,
    case when not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin then inquiry.image_paths else '{}'::text[] end,
    inquiry.is_secret,
    case when not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin then inquiry.answer else null end,
    inquiry.answer is not null,
    inquiry.created_at,
    inquiry.answered_at,
    case
      when inquiry.is_secret and not viewer_is_admin then '익명'
      else coalesce(profile.name, '회원')
    end::text,
    case when viewer_is_admin then coalesce(auth_user.email, '-') else null end::text,
    (not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin),
    (viewer_id is not null and inquiry.author_id = viewer_id)
  from public.inquiries inquiry
  left join public.profiles profile on profile.id = inquiry.author_id
  left join auth.users auth_user on auth_user.id = inquiry.author_id
  order by inquiry.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_inquiries() from public;
grant execute on function public.list_inquiries() to anon, authenticated;

-- 요청을 삭제하지 않고 취소 상태로 보존합니다.
do $$
declare
  status_constraint record;
begin
  for status_constraint in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and constraint_name in (
        select constraint_name
        from information_schema.constraint_column_usage
        where table_schema = 'public'
          and table_name = 'book_requests'
          and column_name = 'status'
      )
  loop
    execute format('alter table public.book_requests drop constraint %I', status_constraint.constraint_name);
  end loop;
end;
$$;

alter table public.book_requests
  add constraint book_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

create or replace function public.cancel_my_book_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인 후 요청을 취소할 수 있습니다';
  end if;
  if not exists (
    select 1 from public.book_requests
    where id = target_request_id and requester_id = current_user_id
  ) then
    raise exception '취소할 수 있는 본인 요청을 찾지 못했습니다';
  end if;
  if not exists (
    select 1 from public.book_requests
    where id = target_request_id
      and requester_id = current_user_id
      and status = 'pending'
  ) then
    raise exception '대기 중인 요청만 취소할 수 있습니다';
  end if;

  update public.book_requests
  set
    status = 'cancelled',
    reviewed_at = now(),
    reviewed_by = null
  where id = target_request_id
    and requester_id = current_user_id
    and status = 'pending';

  if not found then
    raise exception '이미 처리된 요청은 취소할 수 없습니다';
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications where related_type = $1 and related_id = $2 and type = $3'
      using 'book_request', target_request_id::text, 'admin_book_request';
  end if;
end;
$$;

revoke all on function public.cancel_my_book_request(uuid) from public, anon;
grant execute on function public.cancel_my_book_request(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
