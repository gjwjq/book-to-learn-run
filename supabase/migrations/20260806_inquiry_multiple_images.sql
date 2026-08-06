-- 문의 게시판 사진을 한 장에서 최대 10장으로 확장합니다.
-- 20260806_room_admin_and_inquiries.sql 실행 후 적용합니다.

begin;

alter table public.inquiries
  add column if not exists image_paths text[] not null default '{}'::text[];

update public.inquiries
set image_paths = array[image_path]
where image_path is not null
  and btrim(image_path) <> ''
  and cardinality(image_paths) = 0;

alter table public.inquiries
  drop constraint if exists inquiries_image_paths_limit_check;

alter table public.inquiries
  add constraint inquiries_image_paths_limit_check
  check (cardinality(image_paths) <= 10);

create or replace function public.create_inquiry(
  inquiry_title text,
  inquiry_content text,
  inquiry_is_secret boolean default false,
  inquiry_image_paths text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_title text := btrim(coalesce(inquiry_title, ''));
  normalized_content text := btrim(coalesce(inquiry_content, ''));
  normalized_image_paths text[] := coalesce(inquiry_image_paths, '{}'::text[]);
  new_inquiry_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인 후 문의를 작성할 수 있습니다';
  end if;
  if char_length(normalized_title) not between 1 and 100 then
    raise exception '제목은 1자 이상 100자 이내로 입력해 주세요';
  end if;
  if char_length(normalized_content) not between 1 and 1000 then
    raise exception '문의 내용은 1자 이상 1000자 이내로 입력해 주세요';
  end if;
  if cardinality(normalized_image_paths) > 10 then
    raise exception '문의 사진은 최대 10장까지 첨부할 수 있습니다';
  end if;
  if exists (
    select 1
    from unnest(normalized_image_paths) as image_path
    where image_path is null
      or image_path !~ ('^' || current_user_id::text || '/[A-Za-z0-9._-]+$')
  ) then
    raise exception '첨부 사진 경로가 올바르지 않습니다';
  end if;

  insert into public.inquiries (
    author_id,
    title,
    content,
    image_path,
    image_paths,
    is_secret
  ) values (
    current_user_id,
    normalized_title,
    normalized_content,
    normalized_image_paths[1],
    normalized_image_paths,
    coalesce(inquiry_is_secret, false)
  )
  returning id into new_inquiry_id;

  return new_inquiry_id;
end;
$$;

revoke all on function public.create_inquiry(text, text, boolean, text[]) from public, anon;
grant execute on function public.create_inquiry(text, text, boolean, text[]) to authenticated;

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
  can_view boolean
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
    (not inquiry.is_secret or inquiry.author_id = viewer_id or viewer_is_admin)
  from public.inquiries inquiry
  left join public.profiles profile on profile.id = inquiry.author_id
  left join auth.users auth_user on auth_user.id = inquiry.author_id
  order by inquiry.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_inquiries() from public;
grant execute on function public.list_inquiries() to anon, authenticated;

drop policy if exists "visitors view public inquiry images" on storage.objects;
create policy "visitors view public inquiry images"
  on storage.objects for select
  to anon
  using (
    bucket_id = 'inquiry-images'
    and exists (
      select 1 from public.inquiries inquiry
      where (name = inquiry.image_path or name = any(inquiry.image_paths))
        and not inquiry.is_secret
    )
  );

drop policy if exists "members view allowed inquiry images" on storage.objects;
create policy "members view allowed inquiry images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'inquiry-images'
    and exists (
      select 1 from public.inquiries inquiry
      where (name = inquiry.image_path or name = any(inquiry.image_paths))
        and (not inquiry.is_secret or inquiry.author_id = auth.uid() or public.is_admin())
    )
  );

notify pgrst, 'reload schema';

commit;
