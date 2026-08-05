-- 도서 예약·도서 추가 요청 제한과 열람실 좌석 예약 기능

begin;

-- 도서 예약은 브라우저가 아닌 Supabase에 저장합니다.
create table if not exists public.book_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create unique index if not exists book_reservations_one_active_per_user_book
  on public.book_reservations (user_id, book_id)
  where status = 'active';

create index if not exists book_reservations_user_active_idx
  on public.book_reservations (user_id, created_at desc)
  where status = 'active';

alter table public.book_reservations enable row level security;

drop policy if exists "members view own book reservations" on public.book_reservations;
create policy "members view own book reservations"
  on public.book_reservations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.book_reservations to authenticated;
revoke insert, update, delete on public.book_reservations from anon, authenticated;

create or replace function public.enforce_book_reservation_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' and (
    select count(*)
    from public.book_reservations
    where user_id = new.user_id
      and status = 'active'
      and id <> new.id
  ) >= 10 then
    raise exception '도서 예약은 최대 10권까지 가능합니다';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_book_reservation_limit on public.book_reservations;
create trigger enforce_book_reservation_limit
  before insert or update of user_id, status
  on public.book_reservations
  for each row execute function public.enforce_book_reservation_limit();

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
    where user_id = current_user_id
      and book_id = target_book_id
      and status = 'active'
  ) then
    raise exception '현재 본인이 대출 중인 도서는 예약할 수 없습니다';
  end if;
  if exists (
    select 1 from public.book_reservations
    where user_id = current_user_id
      and book_id = target_book_id
      and status = 'active'
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

create or replace function public.cancel_book_reservation(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  update public.book_reservations
  set status = 'cancelled', cancelled_at = now()
  where id = target_reservation_id
    and user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception '예약 정보를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.cancel_book_reservation(uuid) from public, anon;
grant execute on function public.cancel_book_reservation(uuid) to authenticated;

-- 회원 한 명이 동시에 보낼 수 있는 승인 대기 도서 요청은 최대 10권입니다.
create or replace function public.enforce_pending_book_request_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'pending' and (
    select count(*)
    from public.book_requests
    where requester_id = new.requester_id
      and status = 'pending'
      and id <> new.id
  ) >= 10 then
    raise exception '승인 대기 중인 도서 요청은 최대 10권까지 가능합니다';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_pending_book_request_limit on public.book_requests;
create trigger enforce_pending_book_request_limit
  before insert or update of requester_id, status
  on public.book_requests
  for each row execute function public.enforce_pending_book_request_limit();

-- 열람실은 24석, 하루 5개 시간대로 운영합니다.
create table if not exists public.reading_room_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_group_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_number integer not null check (seat_number between 1 and 24),
  reservation_date date not null,
  time_slot text not null check (
    time_slot in ('09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00')
  ),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

alter table public.reading_room_reservations
  add column if not exists reservation_group_id uuid not null default gen_random_uuid();

create unique index if not exists reading_room_one_active_seat_per_slot
  on public.reading_room_reservations (reservation_date, time_slot, seat_number)
  where status = 'active';

drop index if exists public.reading_room_one_active_user_per_slot;

create index if not exists reading_room_user_schedule_idx
  on public.reading_room_reservations (user_id, reservation_date, time_slot)
  where status = 'active';

alter table public.reading_room_reservations enable row level security;

drop policy if exists "members view own reading room reservations" on public.reading_room_reservations;
create policy "members view own reading room reservations"
  on public.reading_room_reservations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.reading_room_reservations to authenticated;
revoke insert, update, delete on public.reading_room_reservations from anon, authenticated;

create or replace function public.get_reading_room_availability(
  target_date date,
  target_time_slot text
)
returns table (seat_number integer, is_reserved boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  if target_time_slot not in ('09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00') then
    raise exception '올바른 이용 시간을 선택해 주세요';
  end if;

  return query
  select seat,
         exists (
           select 1
           from public.reading_room_reservations reservation
           where reservation.reservation_date = target_date
             and reservation.time_slot = target_time_slot
             and reservation.seat_number = seat
             and reservation.status = 'active'
         )
  from generate_series(1, 24) as seat
  order by seat;
end;
$$;

revoke all on function public.get_reading_room_availability(date, text) from public, anon;
grant execute on function public.get_reading_room_availability(date, text) to authenticated;

drop function if exists public.reserve_reading_room_seat(date, text, integer);

create or replace function public.reserve_reading_room_seats(
  target_date date,
  target_time_slot text,
  target_seat_numbers integer[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_korea_date date := timezone('Asia/Seoul', now())::date;
  slot_start_time time;
  new_reservation_group_id uuid := gen_random_uuid();
  requested_seat_count integer := cardinality(target_seat_numbers);
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if public.is_admin() then
    raise exception '관리자 계정은 열람실을 예약할 수 없습니다';
  end if;
  if requested_seat_count is null or requested_seat_count < 1 or requested_seat_count > 4 then
    raise exception '이용 인원은 1명부터 최대 4명까지 선택할 수 있습니다';
  end if;
  if exists (
    select 1
    from unnest(target_seat_numbers) as requested_seat(seat_number)
    where seat_number is null or seat_number not between 1 and 24
  ) or (
    select count(distinct seat_number)
    from unnest(target_seat_numbers) as requested_seat(seat_number)
  ) <> requested_seat_count then
    raise exception '올바른 좌석을 중복 없이 선택해 주세요';
  end if;
  if target_date <= current_korea_date or target_date > current_korea_date + 14 then
    raise exception '열람실은 내일부터 14일 이내 날짜만 예약할 수 있습니다';
  end if;

  slot_start_time := case target_time_slot
    when '09:00-11:00' then time '09:00'
    when '11:00-13:00' then time '11:00'
    when '13:00-15:00' then time '13:00'
    when '15:00-17:00' then time '15:00'
    when '17:00-19:00' then time '17:00'
    else null
  end;
  if slot_start_time is null then
    raise exception '올바른 이용 시간을 선택해 주세요';
  end if;
  if target_date + slot_start_time <= timezone('Asia/Seoul', now()) then
    raise exception '이미 시작된 시간대는 예약할 수 없습니다';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':' || target_date::text || ':' || target_time_slot,
    0
  ));

  if exists (
    select 1 from public.reading_room_reservations
    where user_id = current_user_id
      and reservation_date = target_date
      and time_slot = target_time_slot
      and status = 'active'
  ) then
    raise exception '같은 시간에는 한 번만 예약할 수 있습니다';
  end if;

  insert into public.reading_room_reservations (
    reservation_group_id, user_id, seat_number, reservation_date, time_slot
  )
  select new_reservation_group_id, current_user_id, seat_number, target_date, target_time_slot
  from unnest(target_seat_numbers) as requested_seat(seat_number);

  return new_reservation_group_id;
exception
  when unique_violation then
    raise exception '방금 다른 회원이 예약한 좌석입니다. 다른 좌석을 선택해 주세요';
end;
$$;

revoke all on function public.reserve_reading_room_seats(date, text, integer[]) from public, anon;
grant execute on function public.reserve_reading_room_seats(date, text, integer[]) to authenticated;

create or replace function public.cancel_reading_room_reservation(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select reservation_group_id
  into target_group_id
  from public.reading_room_reservations
  where id = target_reservation_id
    and user_id = auth.uid()
    and status = 'active';

  if target_group_id is null then
    raise exception '열람실 예약 정보를 찾을 수 없습니다';
  end if;

  update public.reading_room_reservations
  set status = 'cancelled', cancelled_at = now()
  where reservation_group_id = target_group_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

revoke all on function public.cancel_reading_room_reservation(uuid) from public, anon;
grant execute on function public.cancel_reading_room_reservation(uuid) to authenticated;

commit;
