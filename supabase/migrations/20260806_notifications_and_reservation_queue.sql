-- 통합 알림, 도서 예약 대기열, 반납 후 우선 대출 처리
-- 20260806_room_admin_and_inquiries.sql 적용 후 실행합니다.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null check (char_length(title) between 1 and 120),
  message text not null check (char_length(message) between 1 and 500),
  link text,
  related_type text,
  related_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "members view own notifications" on public.notifications;
create policy "members view own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = target_notification_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- 기존 active/cancelled 검사식을 active/ready/fulfilled/cancelled 대기열 상태로 확장합니다.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.book_reservations'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.book_reservations drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.book_reservations
  add column if not exists ready_at timestamptz,
  add column if not exists fulfilled_at timestamptz;

alter table public.book_reservations
  drop constraint if exists book_reservations_status_check;

alter table public.book_reservations
  add constraint book_reservations_status_check
  check (status in ('active', 'ready', 'fulfilled', 'cancelled'));

drop index if exists public.book_reservations_one_active_per_user_book;
create unique index book_reservations_one_active_per_user_book
  on public.book_reservations (user_id, book_id)
  where status in ('active', 'ready');

drop index if exists public.book_reservations_user_active_idx;
create index book_reservations_user_active_idx
  on public.book_reservations (user_id, created_at desc)
  where status in ('active', 'ready');

create index if not exists book_reservations_queue_idx
  on public.book_reservations (book_id, created_at, id)
  where status in ('active', 'ready');

create or replace function public.enforce_book_reservation_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('active', 'ready') and (
    select count(*)
    from public.book_reservations
    where user_id = new.user_id
      and status in ('active', 'ready')
      and id <> new.id
  ) >= 10 then
    raise exception '도서 예약은 최대 10권까지 가능합니다';
  end if;
  return new;
end;
$$;

create or replace function public.promote_book_reservations(target_book_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_available integer;
  next_reservation_id uuid;
  next_reservation_user_id uuid;
  target_book_title text;
begin
  select available_quantity, title
  into remaining_available, target_book_title
  from public.books
  where id = target_book_id
  for update;

  while coalesce(remaining_available, 0) > 0 loop
    next_reservation_id := null;
    next_reservation_user_id := null;

    select reservation.id, reservation.user_id
    into next_reservation_id, next_reservation_user_id
    from public.book_reservations reservation
    where reservation.book_id = target_book_id
      and reservation.status = 'active'
    order by reservation.created_at, reservation.id
    for update skip locked
    limit 1;

    exit when next_reservation_id is null;

    update public.book_reservations
    set status = 'ready', ready_at = now()
    where id = next_reservation_id;

    update public.books
    set available_quantity = available_quantity - 1
    where id = target_book_id
      and available_quantity > 0;

    insert into public.notifications (
      user_id, type, title, message, link, related_type, related_id
    ) values (
      next_reservation_user_id,
      'book_ready',
      '예약 도서를 대출할 수 있어요',
      left(coalesce(target_book_title, '예약 도서') || '이(가) 반납되었습니다. 지금 대출할 수 있습니다.', 500),
      'detail.html?id=' || target_book_id,
      'book_reservation',
      next_reservation_id::text
    );

    remaining_available := remaining_available - 1;
  end loop;
end;
$$;

revoke all on function public.promote_book_reservations(text) from public, anon, authenticated;

create or replace function public.reserve_book(target_book_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_available_quantity integer;
  new_reservation_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if public.is_admin() then
    raise exception '관리자 계정은 도서를 예약할 수 없습니다';
  end if;

  perform public.promote_book_reservations(target_book_id);

  select available_quantity
  into current_available_quantity
  from public.books
  where id = target_book_id
  for update;

  if current_available_quantity is null then
    raise exception '도서 정보를 찾을 수 없습니다';
  end if;
  if current_available_quantity > 0 then
    raise exception '현재 대출 가능한 도서입니다';
  end if;
  if exists (
    select 1 from public.book_loans
    where user_id = current_user_id and book_id = target_book_id and status = 'active'
  ) then
    raise exception '현재 본인이 대출 중인 도서는 예약할 수 없습니다';
  end if;
  if exists (
    select 1 from public.book_reservations
    where user_id = current_user_id
      and book_id = target_book_id
      and status in ('active', 'ready')
  ) then
    raise exception '이미 예약 신청한 도서입니다';
  end if;

  insert into public.book_reservations (user_id, book_id)
  values (current_user_id, target_book_id)
  returning id into new_reservation_id;

  return new_reservation_id;
end;
$$;

revoke all on function public.reserve_book(text) from public, anon;
grant execute on function public.reserve_book(text) to authenticated;

create or replace function public.borrow_book(target_book_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  ready_reservation_id uuid;
  new_loan_id uuid;
  new_due_at timestamptz;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if public.is_admin() then
    raise exception '관리자 계정은 도서를 대출할 수 없습니다';
  end if;
  if exists (
    select 1 from public.book_loans
    where user_id = current_user_id and book_id = target_book_id and status = 'active'
  ) then
    raise exception '이미 대출 중인 도서입니다';
  end if;

  perform public.promote_book_reservations(target_book_id);

  select id
  into ready_reservation_id
  from public.book_reservations
  where user_id = current_user_id
    and book_id = target_book_id
    and status = 'ready'
  for update
  limit 1;

  if ready_reservation_id is not null then
    update public.book_reservations
    set status = 'fulfilled', fulfilled_at = now()
    where id = ready_reservation_id;

    update public.notifications
    set read_at = coalesce(read_at, now())
    where user_id = current_user_id
      and related_type = 'book_reservation'
      and related_id = ready_reservation_id::text;
  else
    update public.books
    set available_quantity = available_quantity - 1
    where id = target_book_id
      and available_quantity > 0;

    if not found then
      if not exists (select 1 from public.books where id = target_book_id) then
        raise exception '도서 정보를 찾을 수 없습니다';
      end if;
      raise exception '예약 대기자가 있거나 현재 대출 가능한 수량이 없습니다';
    end if;
  end if;

  insert into public.book_loans (user_id, book_id)
  values (current_user_id, target_book_id)
  returning id, due_at into new_loan_id, new_due_at;

  return jsonb_build_object('loanId', new_loan_id, 'dueAt', new_due_at);
end;
$$;

revoke all on function public.borrow_book(text) from public, anon;
grant execute on function public.borrow_book(text) to authenticated;

create or replace function public.return_book(target_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_book_id text;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;

  select book_id into target_book_id
  from public.book_loans
  where id = target_loan_id
    and user_id = current_user_id
    and status = 'active'
  for update;

  if target_book_id is null then
    raise exception '대출 정보를 찾을 수 없습니다';
  end if;

  update public.book_loans
  set status = 'returned', returned_at = now()
  where id = target_loan_id;

  update public.books
  set available_quantity = least(total_quantity, available_quantity + 1)
  where id = target_book_id;

  perform public.promote_book_reservations(target_book_id);
end;
$$;

revoke all on function public.return_book(uuid) from public, anon;
grant execute on function public.return_book(uuid) to authenticated;

create or replace function public.cancel_book_reservation(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_record record;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select id, book_id, status
  into reservation_record
  from public.book_reservations
  where id = target_reservation_id
    and user_id = auth.uid()
    and status in ('active', 'ready')
  for update;

  if reservation_record.id is null then
    raise exception '예약 정보를 찾을 수 없습니다';
  end if;

  update public.book_reservations
  set status = 'cancelled', cancelled_at = now()
  where id = reservation_record.id;

  if reservation_record.status = 'ready' then
    update public.books
    set available_quantity = least(total_quantity, available_quantity + 1)
    where id = reservation_record.book_id;
    perform public.promote_book_reservations(reservation_record.book_id);
  end if;
end;
$$;

revoke all on function public.cancel_book_reservation(uuid) from public, anon;
grant execute on function public.cancel_book_reservation(uuid) to authenticated;

create or replace function public.list_my_book_reservations()
returns table (
  id uuid,
  user_id uuid,
  book_id text,
  status text,
  queue_position bigint,
  ready_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    reservation.id,
    reservation.user_id,
    reservation.book_id,
    reservation.status,
    case
      when reservation.status = 'ready' then 0
      else (
        select count(*)
        from public.book_reservations earlier
        where earlier.book_id = reservation.book_id
          and earlier.status in ('active', 'ready')
          and (earlier.created_at, earlier.id) <= (reservation.created_at, reservation.id)
      )
    end,
    reservation.ready_at,
    reservation.created_at
  from public.book_reservations reservation
  where reservation.user_id = auth.uid()
    and reservation.status in ('active', 'ready')
  order by reservation.created_at desc;
$$;

revoke all on function public.list_my_book_reservations() from public, anon;
grant execute on function public.list_my_book_reservations() to authenticated;

create or replace function public.notify_admins_on_new_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, link, related_type, related_id)
  select
    profile.id,
    'admin_inquiry',
    '새 문의가 등록되었습니다',
    case when new.is_secret then '새 비밀 문의가 등록되었습니다.' else left(new.title, 500) end,
    'admin.html#inquiries',
    'inquiry',
    new.id::text
  from public.profiles profile
  where profile.role = 'admin';
  return new;
end;
$$;

drop trigger if exists notify_admins_on_new_inquiry on public.inquiries;
create trigger notify_admins_on_new_inquiry
  after insert on public.inquiries
  for each row execute function public.notify_admins_on_new_inquiry();

create or replace function public.notify_member_on_inquiry_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.answer is not null and new.answer is distinct from old.answer then
    insert into public.notifications (user_id, type, title, message, link, related_type, related_id)
    values (
      new.author_id,
      'inquiry_answer',
      '문의에 답변이 등록되었습니다',
      case when new.is_secret then '비밀 문의에 관리자 답변이 등록되었습니다.' else left(new.title || ' 문의의 답변을 확인해 주세요.', 500) end,
      'inquiry.html',
      'inquiry',
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_member_on_inquiry_answer on public.inquiries;
create trigger notify_member_on_inquiry_answer
  after update of answer on public.inquiries
  for each row execute function public.notify_member_on_inquiry_answer();

create or replace function public.notify_admins_on_new_book_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, link, related_type, related_id)
  select
    profile.id,
    'admin_book_request',
    '새 도서 추가 요청이 도착했습니다',
    left(new.title || ' 도서의 추가 요청을 확인해 주세요.', 500),
    'admin.html#books',
    'book_request',
    new.id::text
  from public.profiles profile
  where profile.role = 'admin';
  return new;
end;
$$;

drop trigger if exists notify_admins_on_new_book_request on public.book_requests;
create trigger notify_admins_on_new_book_request
  after insert on public.book_requests
  for each row execute function public.notify_admins_on_new_book_request();

create or replace function public.notify_member_on_book_request_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, type, title, message, link, related_type, related_id)
    values (
      new.requester_id,
      'book_request_result',
      case when new.status = 'approved' then '요청한 도서가 추가되었습니다' else '도서 추가 요청 결과가 도착했습니다' end,
      left(new.title || case when new.status = 'approved' then ' 도서가 도서관에 추가되었습니다.' else ' 도서 추가 요청이 거절되었습니다.' end, 500),
      'request.html#my-requests',
      'book_request',
      new.id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_member_on_book_request_result on public.book_requests;
create trigger notify_member_on_book_request_result
  after update of status on public.book_requests
  for each row execute function public.notify_member_on_book_request_result();

-- 마이그레이션 시 이미 대기 중인 예약이 있고 재고가 남아 있다면 즉시 순번을 배정합니다.
do $$
declare
  book_row record;
begin
  for book_row in
    select distinct reservation.book_id
    from public.book_reservations reservation
    where reservation.status = 'active'
  loop
    perform public.promote_book_reservations(book_row.book_id);
  end loop;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object or undefined_object then null;
end;
$$;

notify pgrst, 'reload schema';

commit;
