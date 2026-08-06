-- 열람실 예약 개편
-- 60석 · 직접 1~4석 선택 · 06:00~22:00 · 최소 2시간/최대 6시간

begin;

create extension if not exists btree_gist;

create table if not exists public.reading_room_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_group_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_number integer not null,
  reservation_date date not null,
  start_time time not null,
  end_time time not null,
  time_slot text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- 예전 고정 시간대 데이터를 보존한 채 시작·종료 시간으로 옮깁니다.
alter table public.reading_room_reservations
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists time_slot text;

update public.reading_room_reservations
set
  start_time = coalesce(start_time, nullif(split_part(time_slot, '-', 1), '')::time),
  end_time = coalesce(end_time, nullif(split_part(time_slot, '-', 2), '')::time)
where start_time is null or end_time is null;

alter table public.reading_room_reservations
  alter column start_time set not null,
  alter column end_time set not null,
  alter column time_slot drop not null;

alter table public.reading_room_reservations
  drop constraint if exists reading_room_reservations_seat_number_check,
  drop constraint if exists reading_room_reservations_time_slot_check,
  drop constraint if exists reading_room_reservations_operating_time_check,
  drop constraint if exists reading_room_reservations_duration_check;

-- 이전 SQL에서 제약조건 이름이 다르게 만들어졌더라도 옛 24석·고정 시간대 검사를 제거합니다.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.reading_room_reservations'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%seat_number%'
        or pg_get_constraintdef(oid) ilike '%time_slot%'
        or pg_get_constraintdef(oid) ilike '%start_time%'
        or pg_get_constraintdef(oid) ilike '%end_time%'
      )
  loop
    execute format(
      'alter table public.reading_room_reservations drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.reading_room_reservations
  add constraint reading_room_reservations_seat_number_check
    check (seat_number between 1 and 60),
  add constraint reading_room_reservations_operating_time_check
    check (start_time >= time '06:00' and end_time <= time '22:00' and start_time < end_time),
  add constraint reading_room_reservations_duration_check
    check (end_time - start_time between interval '2 hours' and interval '6 hours');

drop index if exists public.reading_room_one_active_seat_per_slot;
drop index if exists public.reading_room_user_schedule_idx;

alter table public.reading_room_reservations
  add column if not exists reservation_period tsrange
  generated always as (
    tsrange(reservation_date + start_time, reservation_date + end_time, '[)')
  ) stored;

alter table public.reading_room_reservations
  drop constraint if exists reading_room_no_overlapping_active_seat;

alter table public.reading_room_reservations
  add constraint reading_room_no_overlapping_active_seat
  exclude using gist (
    seat_number with =,
    reservation_period with &&
  ) where (status = 'active');

create index reading_room_user_schedule_idx
  on public.reading_room_reservations (user_id, reservation_date, start_time)
  where status = 'active';

alter table public.reading_room_reservations enable row level security;

drop policy if exists "members view own reading room reservations" on public.reading_room_reservations;
create policy "members view own reading room reservations"
  on public.reading_room_reservations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.reading_room_reservations to authenticated;
revoke insert, update, delete on public.reading_room_reservations from anon, authenticated;

drop function if exists public.get_reading_room_availability(date, text);
drop function if exists public.get_reading_room_availability(date, time, time);

create function public.get_reading_room_availability(
  target_date date,
  target_start_time time,
  target_end_time time
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
  if target_date is null
    or target_start_time is null
    or target_end_time is null
    or target_start_time < time '06:00'
    or target_end_time > time '22:00'
    or target_end_time - target_start_time < interval '2 hours'
    or target_end_time - target_start_time > interval '6 hours' then
    raise exception '06:00부터 22:00 사이에서 2시간 이상 6시간 이하로 선택해 주세요';
  end if;

  return query
  select seat,
         exists (
           select 1
           from public.reading_room_reservations reservation
           where reservation.reservation_date = target_date
             and reservation.seat_number = seat
             and reservation.status = 'active'
             and reservation.start_time < target_end_time
             and reservation.end_time > target_start_time
         )
  from generate_series(1, 60) as seat
  order by seat;
end;
$$;

revoke all on function public.get_reading_room_availability(date, time, time) from public, anon;
grant execute on function public.get_reading_room_availability(date, time, time) to authenticated;

drop function if exists public.reserve_reading_room_seat(date, text, integer);
drop function if exists public.reserve_reading_room_seats(date, text, integer[]);
drop function if exists public.reserve_reading_room_seats(date, time, time, integer[]);

create function public.reserve_reading_room_seats(
  target_date date,
  target_start_time time,
  target_end_time time,
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
    raise exception '좌석은 1개부터 최대 4개까지 선택할 수 있습니다';
  end if;
  if exists (
    select 1
    from unnest(target_seat_numbers) as requested_seat(seat_number)
    where seat_number is null or seat_number not between 1 and 60
  ) or (
    select count(distinct seat_number)
    from unnest(target_seat_numbers) as requested_seat(seat_number)
  ) <> requested_seat_count then
    raise exception '1번부터 60번 사이의 좌석을 중복 없이 선택해 주세요';
  end if;
  if target_date is null or target_date <= current_korea_date or target_date > current_korea_date + 14 then
    raise exception '열람실은 내일부터 14일 이내 날짜만 예약할 수 있습니다';
  end if;
  if target_start_time is null
    or target_end_time is null
    or target_start_time < time '06:00'
    or target_end_time > time '22:00'
    or target_end_time - target_start_time < interval '2 hours'
    or target_end_time - target_start_time > interval '6 hours' then
    raise exception '06:00부터 22:00 사이에서 2시간 이상 6시간 이하로 선택해 주세요';
  end if;

  -- 같은 회원의 예약 요청이 동시에 들어와도 하나만 처리합니다.
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  if exists (
    select 1
    from public.reading_room_reservations
    where user_id = current_user_id
      and reservation_date >= current_korea_date
      and status = 'active'
  ) then
    raise exception '예정된 열람실 예약은 한 번만 보유할 수 있습니다. 기존 예약을 먼저 취소해 주세요';
  end if;

  insert into public.reading_room_reservations (
    reservation_group_id,
    user_id,
    seat_number,
    reservation_date,
    start_time,
    end_time,
    time_slot
  )
  select
    new_reservation_group_id,
    current_user_id,
    seat_number,
    target_date,
    target_start_time,
    target_end_time,
    to_char(target_start_time, 'HH24:MI') || '-' || to_char(target_end_time, 'HH24:MI')
  from unnest(target_seat_numbers) as requested_seat(seat_number);

  return new_reservation_group_id;
exception
  when exclusion_violation or unique_violation then
    raise exception '방금 다른 회원이 예약한 좌석입니다. 좌석 현황을 새로고침한 뒤 다시 선택해 주세요';
end;
$$;

revoke all on function public.reserve_reading_room_seats(date, time, time, integer[]) from public, anon;
grant execute on function public.reserve_reading_room_seats(date, time, time, integer[]) to authenticated;

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

notify pgrst, 'reload schema';

commit;
