-- 열람실 예약 관리자 기능과 공개/비밀 문의 게시판
-- 먼저 20260806_flexible_reading_room.sql을 실행한 뒤 적용합니다.

begin;

create or replace function public.admin_list_reading_room_reservations()
returns table (
  reservation_group_id uuid,
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  reservation_date date,
  start_time time,
  end_time time,
  seat_numbers integer[],
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 열람실 예약을 조회할 수 있습니다';
  end if;

  return query
  select
    reservation.reservation_group_id,
    min(reservation.id::text)::uuid,
    reservation.user_id,
    coalesce(profile.name, '이름 없음')::text,
    coalesce(auth_user.email, '-')::text,
    reservation.reservation_date,
    reservation.start_time,
    reservation.end_time,
    array_agg(reservation.seat_number order by reservation.seat_number)::integer[],
    min(reservation.created_at)
  from public.reading_room_reservations reservation
  left join public.profiles profile on profile.id = reservation.user_id
  left join auth.users auth_user on auth_user.id = reservation.user_id
  where reservation.status = 'active'
    and reservation.reservation_date >= timezone('Asia/Seoul', now())::date
  group by
    reservation.reservation_group_id,
    reservation.user_id,
    profile.name,
    auth_user.email,
    reservation.reservation_date,
    reservation.start_time,
    reservation.end_time
  order by reservation.reservation_date, reservation.start_time, min(reservation.created_at);
end;
$$;

revoke all on function public.admin_list_reading_room_reservations() from public, anon;
grant execute on function public.admin_list_reading_room_reservations() to authenticated;

create or replace function public.admin_cancel_reading_room_reservation(
  target_reservation_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 열람실 예약을 취소할 수 있습니다';
  end if;

  update public.reading_room_reservations
  set status = 'cancelled', cancelled_at = now()
  where reservation_group_id = target_reservation_group_id
    and status = 'active';

  if not found then
    raise exception '취소할 열람실 예약을 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.admin_cancel_reading_room_reservation(uuid) from public, anon;
grant execute on function public.admin_cancel_reading_room_reservation(uuid) to authenticated;

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  image_path text,
  is_secret boolean not null default false,
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  answered_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz
);

create index if not exists inquiries_created_at_idx
  on public.inquiries (created_at desc);
create index if not exists inquiries_author_id_idx
  on public.inquiries (author_id, created_at desc);

alter table public.inquiries enable row level security;

drop policy if exists "visitors view public inquiries" on public.inquiries;
create policy "visitors view public inquiries"
  on public.inquiries for select
  to anon
  using (not is_secret);

drop policy if exists "members view allowed inquiries" on public.inquiries;
create policy "members view allowed inquiries"
  on public.inquiries for select
  to authenticated
  using (not is_secret or author_id = auth.uid() or public.is_admin());

grant select on public.inquiries to anon, authenticated;
revoke insert, update, delete on public.inquiries from anon, authenticated;

create or replace function public.create_inquiry(
  inquiry_title text,
  inquiry_content text,
  inquiry_is_secret boolean default false,
  inquiry_image_path text default null
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
  if inquiry_image_path is not null
    and inquiry_image_path !~ ('^' || current_user_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception '첨부 사진 경로가 올바르지 않습니다';
  end if;

  insert into public.inquiries (author_id, title, content, image_path, is_secret)
  values (
    current_user_id,
    normalized_title,
    normalized_content,
    nullif(btrim(coalesce(inquiry_image_path, '')), ''),
    coalesce(inquiry_is_secret, false)
  )
  returning id into new_inquiry_id;

  return new_inquiry_id;
end;
$$;

revoke all on function public.create_inquiry(text, text, boolean, text) from public, anon;
grant execute on function public.create_inquiry(text, text, boolean, text) to authenticated;

drop function if exists public.list_inquiries();
create function public.list_inquiries()
returns table (
  id uuid,
  title text,
  content text,
  image_path text,
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

create or replace function public.admin_answer_inquiry(
  target_inquiry_id uuid,
  answer_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_answer text := btrim(coalesce(answer_content, ''));
begin
  if not public.is_admin() then
    raise exception '관리자만 문의에 답변할 수 있습니다';
  end if;
  if char_length(normalized_answer) not between 1 and 1000 then
    raise exception '답변은 1자 이상 1000자 이내로 입력해 주세요';
  end if;

  update public.inquiries
  set
    answer = normalized_answer,
    answered_by = auth.uid(),
    answered_at = now(),
    updated_at = now()
  where id = target_inquiry_id;

  if not found then
    raise exception '답변할 문의를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.admin_answer_inquiry(uuid, text) from public, anon;
grant execute on function public.admin_answer_inquiry(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inquiry-images',
  'inquiry-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload own inquiry images" on storage.objects;
create policy "members upload own inquiry images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'inquiry-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "visitors view public inquiry images" on storage.objects;
create policy "visitors view public inquiry images"
  on storage.objects for select
  to anon
  using (
    bucket_id = 'inquiry-images'
    and exists (
      select 1 from public.inquiries inquiry
      where inquiry.image_path = name and not inquiry.is_secret
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
      where inquiry.image_path = name
        and (not inquiry.is_secret or inquiry.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "members delete own unlinked inquiry images" on storage.objects;
create policy "members delete own unlinked inquiry images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'inquiry-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';

commit;
