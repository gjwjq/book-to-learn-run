-- 답변 전 문의 공개 차단 및 관리자 문의 삭제
-- 20260806_member_content_management.sql 실행 후 적용합니다.

begin;

create or replace function public.admin_delete_inquiry(target_inquiry_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_image_paths text[];
begin
  if not public.is_admin() then
    raise exception '관리자만 문의를 삭제할 수 있습니다';
  end if;

  select array(
    select distinct stored_path.path_value
    from unnest(
      coalesce(inquiry.image_paths, '{}'::text[])
      || case when inquiry.image_path is null then '{}'::text[] else array[inquiry.image_path] end
    ) as stored_path(path_value)
    where stored_path.path_value is not null
      and btrim(stored_path.path_value) <> ''
  )
  into stored_image_paths
  from public.inquiries inquiry
  where inquiry.id = target_inquiry_id;

  if not found then
    raise exception '삭제할 문의를 찾을 수 없습니다';
  end if;

  delete from public.inquiries
  where id = target_inquiry_id;

  if not found then
    raise exception '문의 삭제에 실패했습니다';
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications where related_type = $1 and related_id = $2'
      using 'inquiry', target_inquiry_id::text;
  end if;

  return coalesce(stored_image_paths, '{}'::text[]);
end;
$$;

revoke all on function public.admin_delete_inquiry(uuid) from public, anon;
grant execute on function public.admin_delete_inquiry(uuid) to authenticated;

-- 작성자는 본인 사진을, 관리자는 삭제한 모든 문의 사진을 정리할 수 있습니다.
drop policy if exists "members delete own unlinked inquiry images" on storage.objects;
create policy "members delete own unlinked inquiry images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'inquiry-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- 답변 전 문의는 작성자와 관리자에게만 반환합니다.
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
  where inquiry.answer is not null
    or inquiry.author_id = viewer_id
    or viewer_is_admin
  order by inquiry.created_at desc
  limit 200;
end;
$$;

revoke all on function public.list_inquiries() from public;
grant execute on function public.list_inquiries() to anon, authenticated;

notify pgrst, 'reload schema';

commit;
