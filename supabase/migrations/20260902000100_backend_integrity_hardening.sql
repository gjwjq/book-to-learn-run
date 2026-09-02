-- 보안·재고·예약·문의 무결성 통합 보완
-- 기존 사용자 콘텐츠는 삭제하지 않으며, 공개 범위와 상태 전이만 안전하게 조정합니다.

begin;

-- 아이디를 이메일로 바꾸어 주던 공개 RPC는 계정 식별 정보를 노출하므로 더 이상
-- 브라우저에서 호출하지 않습니다. /api/login-by-id.js가 서버에서만 이를 처리합니다.
revoke all on function public.resolve_login_email(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 도서 설명: 원문을 보존하되 명백한 말줄임 뒤의 불완전한 조각만 보수적으로 정리합니다.
-- ---------------------------------------------------------------------------

create or replace function public.complete_book_description(
  input_value text,
  input_title text,
  input_author text
)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized_value text;
  value_without_ellipsis text;
  completed_prefix text;
begin
  normalized_value := regexp_replace(btrim(coalesce(input_value, '')), '\s+', ' ', 'g');

  if normalized_value = '' then
    return null;
  end if;

  if right(normalized_value, 1) ~ '[.!?。！？]' then
    return normalized_value;
  end if;

  -- 관리자가 직접 쓴 한국어 설명이 자연스러운 종결어미로 끝났다면 내용 전체를
  -- 버리지 않고 마침표만 보완합니다.
  if normalized_value ~ '(다|요|임|됨|함|니다|습니다|이다|예요|이에요)$' then
    return normalized_value || '.';
  end if;

  -- 명백한 말줄임표로 끝날 때에만 마지막 완결 문장 뒤의 조각을 제거합니다.
  -- 완결 문장이 하나도 없으면 원문을 보존해 사용자 입력을 잃지 않습니다.
  if normalized_value ~ '(\.{2,}|…+|⋯+)\s*$' then
    value_without_ellipsis := regexp_replace(normalized_value, '(\.{2,}|…+|⋯+)\s*$', '', 'g');
    completed_prefix := substring(value_without_ellipsis from '^(.*[.!?。！？])');
    if char_length(coalesce(completed_prefix, '')) >= 15 then
      return btrim(completed_prefix);
    end if;
  end if;

  return normalized_value;
end;
$$;

create or replace function public.normalize_book_description_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.description := public.complete_book_description(new.description, new.title, new.author);
  new.short_description := public.complete_book_description(
    coalesce(nullif(new.short_description, ''), new.description),
    new.title,
    new.author
  );
  return new;
end;
$$;

drop trigger if exists normalize_book_description_fields on public.books;
create trigger normalize_book_description_fields
  before insert or update of title, author, description, short_description
  on public.books
  for each row execute function public.normalize_book_description_fields();

drop trigger if exists normalize_requested_book_description_fields on public.book_requests;
create trigger normalize_requested_book_description_fields
  before insert or update of title, author, description, short_description
  on public.book_requests
  for each row execute function public.normalize_book_description_fields();

-- 이미 저장된 소개도 원문을 보존하면서 명백한 말줄임 뒤 조각만 정리합니다.
update public.books
set
  description = public.complete_book_description(description, title, author),
  short_description = public.complete_book_description(
    coalesce(nullif(short_description, ''), description), title, author
  );

update public.book_requests
set
  description = public.complete_book_description(description, title, author),
  short_description = public.complete_book_description(
    coalesce(nullif(short_description, ''), description), title, author
  );

-- 관리자 요청 화면은 처리 전·후 이력을 모두 필터링할 수 있어야 합니다.
alter table public.book_requests
  add column if not exists rejection_reason text;

drop function if exists public.admin_list_book_requests();
create function public.admin_list_book_requests()
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
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text
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
    coalesce(profile.name, '회원')::text,
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
    request.status,
    request.requested_at,
    request.reviewed_at,
    request.reviewed_by,
    request.rejection_reason
  from public.book_requests request
  left join public.profiles profile on profile.id = request.requester_id
  left join auth.users auth_user on auth_user.id = request.requester_id
  order by request.requested_at desc;
end;
$$;

revoke all on function public.admin_list_book_requests() from public, anon;
grant execute on function public.admin_list_book_requests() to authenticated;

-- ---------------------------------------------------------------------------
-- 도서 삭제는 기록을 연쇄 삭제하지 않는 아카이브 방식으로 전환합니다.
-- ---------------------------------------------------------------------------

alter table public.books
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists books_active_created_idx
  on public.books (created_at desc)
  where archived_at is null;

-- 이전의 광범위한 SELECT 정책을 제거하고 일반 이용자에게는 활성 도서만 보입니다.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'books'
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.books', policy_row.policyname);
  end loop;
end;
$$;

create policy "visitors view active books"
  on public.books for select to anon
  using (archived_at is null);

create policy "members view active books"
  on public.books for select to authenticated
  using (archived_at is null or public.is_admin());

create or replace function public.admin_archive_book(target_book_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ready_count integer := 0;
begin
  if not public.is_admin() then
    raise exception '관리자만 도서를 삭제할 수 있습니다';
  end if;

  perform 1 from public.books where id = target_book_id and archived_at is null for update;
  if not found then
    raise exception '삭제할 도서를 찾을 수 없습니다';
  end if;
  if exists (
    select 1 from public.book_loans
    where book_id = target_book_id and status = 'active'
  ) then
    raise exception '대출 중인 도서는 반납 처리 후 삭제할 수 있습니다';
  end if;

  select count(*) into ready_count
  from public.book_reservations
  where book_id = target_book_id and status = 'ready';

  update public.book_reservations
  set status = 'cancelled', cancelled_at = now()
  where book_id = target_book_id and status in ('active', 'ready');

  update public.notifications
  set read_at = coalesce(read_at, now())
  where related_type = 'book_reservation'
    and related_id in (
      select id::text from public.book_reservations
      where book_id = target_book_id and status = 'cancelled'
    );

  update public.books
  set
    available_quantity = least(total_quantity, available_quantity + ready_count),
    archived_at = now(),
    archived_by = auth.uid(),
    updated_at = now()
  where id = target_book_id;
end;
$$;

revoke all on function public.admin_archive_book(text) from public, anon;
grant execute on function public.admin_archive_book(text) to authenticated;

create or replace function public.admin_archive_books(target_book_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_book_id text;
  archived_count integer := 0;
begin
  if not public.is_admin() then
    raise exception '관리자만 도서를 삭제할 수 있습니다';
  end if;
  if cardinality(coalesce(target_book_ids, '{}'::text[])) = 0
    or cardinality(target_book_ids) > 100 then
    raise exception '삭제할 도서를 1권 이상 100권 이하로 선택해 주세요';
  end if;

  foreach target_book_id in array target_book_ids loop
    perform public.admin_archive_book(target_book_id);
    archived_count := archived_count + 1;
  end loop;
  return archived_count;
end;
$$;

revoke all on function public.admin_archive_books(text[]) from public, anon;
grant execute on function public.admin_archive_books(text[]) to authenticated;

create or replace function public.admin_restore_book(target_book_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 도서를 복원할 수 있습니다';
  end if;
  update public.books
  set archived_at = null, archived_by = null, updated_at = now()
  where id = target_book_id and archived_at is not null;
  if not found then
    raise exception '복원할 도서를 찾을 수 없습니다';
  end if;
end;
$$;

revoke all on function public.admin_restore_book(text) from public, anon;
grant execute on function public.admin_restore_book(text) to authenticated;

create or replace function public.prevent_hard_book_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '도서는 직접 삭제하지 말고 admin_archive_book 함수를 사용해 주세요';
end;
$$;

drop trigger if exists prevent_hard_book_delete on public.books;
create trigger prevent_hard_book_delete
  before delete on public.books
  for each row execute function public.prevent_hard_book_delete();

-- ---------------------------------------------------------------------------
-- 예약 대기열: ready 24시간 만료, 원자적 제한, 수량 증가 시 자동 승격
-- ---------------------------------------------------------------------------

alter table public.book_reservations
  add column if not exists ready_expires_at timestamptz;

-- 이전 버전에서 이미 준비 완료였던 예약도 만료 시각을 갖게 해 무기한으로
-- 재고를 점유하지 않도록 합니다. 오래된 준비 완료 예약은 다음 정리 때 만료됩니다.
update public.book_reservations
set ready_expires_at = coalesce(ready_at, now()) + interval '24 hours'
where status = 'ready' and ready_expires_at is null;

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
  add constraint book_reservations_status_check
  check (status in ('active', 'ready', 'fulfilled', 'cancelled', 'expired'));

alter table public.book_reservations
  drop constraint if exists book_reservations_ready_expiry_check;
alter table public.book_reservations
  add constraint book_reservations_ready_expiry_check
  check (status <> 'ready' or ready_expires_at is not null);

create index if not exists book_reservations_ready_expiry_idx
  on public.book_reservations (ready_expires_at, book_id)
  where status = 'ready';

create or replace function public.enforce_book_reservation_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('active', 'ready') then
    perform pg_advisory_xact_lock(hashtextextended('book-reservation:' || new.user_id::text, 0));
    if (
      select count(*)
      from public.book_reservations
      where user_id = new.user_id
        and status in ('active', 'ready')
        and id <> new.id
    ) >= 10 then
      raise exception '도서 예약은 최대 10권까지 가능합니다';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_pending_book_request_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform pg_advisory_xact_lock(hashtextextended('book-request:' || new.requester_id::text, 0));
    if (
      select count(*)
      from public.book_requests
      where requester_id = new.requester_id
        and status = 'pending'
        and id <> new.id
    ) >= 10 then
      raise exception '승인 대기 중인 도서 요청은 최대 10권까지 가능합니다';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_active_book_loan_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'active' then
    perform pg_advisory_xact_lock(hashtextextended('book-loan:' || new.user_id::text, 0));
    if (
      select count(*)
      from public.book_loans
      where user_id = new.user_id
        and status = 'active'
        and id <> new.id
    ) >= 5 then
      raise exception '동시에 대출할 수 있는 도서는 최대 5권입니다';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_book_reservation_limit on public.book_reservations;
create trigger enforce_book_reservation_limit
  before insert or update of user_id, status on public.book_reservations
  for each row execute function public.enforce_book_reservation_limit();

drop trigger if exists enforce_pending_book_request_limit on public.book_requests;
create trigger enforce_pending_book_request_limit
  before insert or update of requester_id, status on public.book_requests
  for each row execute function public.enforce_pending_book_request_limit();

drop trigger if exists enforce_active_book_loan_limit on public.book_loans;
create trigger enforce_active_book_loan_limit
  before insert or update of user_id, status on public.book_loans
  for each row execute function public.enforce_active_book_loan_limit();

create or replace function public.promote_book_reservations(target_book_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_available integer;
  expired_count integer := 0;
  next_reservation_id uuid;
  next_reservation_user_id uuid;
  target_book_title text;
  target_archived_at timestamptz;
begin
  select available_quantity, title, archived_at
  into remaining_available, target_book_title, target_archived_at
  from public.books
  where id = target_book_id
  for update;

  if not found or target_archived_at is not null then
    return;
  end if;

  with expired as (
    update public.book_reservations
    set status = 'expired', cancelled_at = now()
    where book_id = target_book_id
      and status = 'ready'
      and ready_expires_at <= now()
    returning id
  )
  select count(*) into expired_count from expired;

  if expired_count > 0 then
    update public.books
    set available_quantity = least(total_quantity, available_quantity + expired_count)
    where id = target_book_id
    returning available_quantity into remaining_available;

    update public.notifications
    set read_at = coalesce(read_at, now())
    where related_type = 'book_reservation'
      and related_id in (
        select id::text from public.book_reservations
        where book_id = target_book_id and status = 'expired'
      );
  end if;

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
    set
      status = 'ready',
      ready_at = now(),
      ready_expires_at = now() + interval '24 hours'
    where id = next_reservation_id;

    update public.books
    set available_quantity = available_quantity - 1
    where id = target_book_id and available_quantity > 0;

    insert into public.notifications (
      user_id, type, title, message, link, related_type, related_id
    ) values (
      next_reservation_user_id,
      'book_ready',
      '예약 도서를 대출할 수 있어요',
      left(coalesce(target_book_title, '예약 도서') || '이(가) 준비되었습니다. 24시간 안에 대출해 주세요.', 500),
      'detail.html?id=' || target_book_id,
      'book_reservation',
      next_reservation_id::text
    );

    remaining_available := remaining_available - 1;
  end loop;
end;
$$;

revoke all on function public.promote_book_reservations(text) from public, anon, authenticated;

create or replace function public.expire_ready_book_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_total integer;
  target_book_id text;
begin
  select count(*) into expired_total
  from public.book_reservations
  where status = 'ready' and ready_expires_at <= now();

  for target_book_id in
    select distinct book_id
    from public.book_reservations
    where status = 'ready' and ready_expires_at <= now()
  loop
    perform public.promote_book_reservations(target_book_id);
  end loop;
  return expired_total;
end;
$$;

revoke all on function public.expire_ready_book_reservations() from public, anon, authenticated;

-- pg_cron이 이미 활성화된 Supabase 프로젝트에서는 5분마다 만료 재고를 회수합니다.
-- 확장이 없는 프로젝트에서도 예약·대출·내 예약 조회 시 동일 함수가 지연 실행됩니다.
do $$
declare
  existing_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      execute $cron$
        select jobid
        from cron.job
        where jobname = 'expire-ready-book-reservations'
        limit 1
      $cron$ into existing_job_id;

      if existing_job_id is null then
        execute $cron$
          select cron.schedule(
            'expire-ready-book-reservations',
            '*/5 * * * *',
            'select public.expire_ready_book_reservations()'
          )
        $cron$;
      end if;
    exception when others then
      raise notice 'pg_cron 예약 만료 작업을 등록하지 못했습니다: %', sqlerrm;
    end;
  end if;
end;
$$;

create or replace function public.promote_waiters_after_quantity_increase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.total_quantity > old.total_quantity and new.archived_at is null then
    perform public.promote_book_reservations(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists promote_waiters_after_quantity_increase on public.books;
create trigger promote_waiters_after_quantity_increase
  after update of total_quantity on public.books
  for each row
  when (new.total_quantity > old.total_quantity)
  execute function public.promote_waiters_after_quantity_increase();

create or replace function public.reserve_book(target_book_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_available_quantity integer;
  target_archived_at timestamptz;
  new_reservation_id uuid;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if public.is_admin() then
    raise exception '관리자 계정은 도서를 예약할 수 없습니다';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('book-reservation:' || current_user_id::text, 0));
  perform public.promote_book_reservations(target_book_id);

  select available_quantity, archived_at
  into current_available_quantity, target_archived_at
  from public.books
  where id = target_book_id
  for update;

  if current_available_quantity is null or target_archived_at is not null then
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
  if (
    select count(*) from public.book_reservations
    where user_id = current_user_id and status in ('active', 'ready')
  ) >= 10 then
    raise exception '도서 예약은 최대 10권까지 가능합니다';
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
  target_archived_at timestamptz;
  new_loan_id uuid;
  new_due_at timestamptz;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;
  if public.is_admin() then
    raise exception '관리자 계정은 도서를 대출할 수 없습니다';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('book-loan:' || current_user_id::text, 0));
  if (
    select count(*) from public.book_loans
    where user_id = current_user_id and status = 'active'
  ) >= 5 then
    raise exception '동시에 대출할 수 있는 도서는 최대 5권입니다';
  end if;
  if exists (
    select 1 from public.book_loans
    where user_id = current_user_id and book_id = target_book_id and status = 'active'
  ) then
    raise exception '이미 대출 중인 도서입니다';
  end if;

  perform public.promote_book_reservations(target_book_id);
  select archived_at into target_archived_at from public.books where id = target_book_id for update;
  if not found or target_archived_at is not null then
    raise exception '도서 정보를 찾을 수 없습니다';
  end if;

  select id into ready_reservation_id
  from public.book_reservations
  where user_id = current_user_id
    and book_id = target_book_id
    and status = 'ready'
    and ready_expires_at > now()
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
      and archived_at is null
      and available_quantity > 0;

    if not found then
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

create or replace function public.cancel_book_reservation(target_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_book_id text;
  target_status text;
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다';
  end if;

  select reservation.book_id, reservation.status
  into target_book_id, target_status
  from public.book_reservations reservation
  where reservation.id = target_reservation_id
    and reservation.user_id = current_user_id
    and reservation.status in ('active', 'ready');

  if target_book_id is null then
    raise exception '예약 정보를 찾을 수 없습니다';
  end if;

  -- 예약 승격·대출·반납과 같은 순서로 도서 행을 먼저 잠가 재고 경쟁을 막습니다.
  perform 1 from public.books where id = target_book_id for update;

  select reservation.status
  into target_status
  from public.book_reservations reservation
  where reservation.id = target_reservation_id
    and reservation.user_id = current_user_id
    and reservation.status in ('active', 'ready')
  for update;

  if target_status is null then
    raise exception '이미 처리된 예약입니다';
  end if;

  update public.book_reservations
  set
    status = 'cancelled',
    cancelled_at = now(),
    ready_expires_at = null
  where id = target_reservation_id;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = current_user_id
    and related_type = 'book_reservation'
    and related_id = target_reservation_id::text;

  if target_status = 'ready' then
    update public.books
    set available_quantity = least(total_quantity, available_quantity + 1)
    where id = target_book_id;
    perform public.promote_book_reservations(target_book_id);
  end if;
end;
$$;

revoke all on function public.cancel_book_reservation(uuid) from public, anon;
grant execute on function public.cancel_book_reservation(uuid) to authenticated;

drop function if exists public.list_my_book_reservations();
create function public.list_my_book_reservations()
returns table (
  id uuid,
  user_id uuid,
  book_id text,
  status text,
  queue_position bigint,
  ready_at timestamptz,
  ready_expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_ready_book_reservations();
  return query
  select
    reservation.id,
    reservation.user_id,
    reservation.book_id,
    reservation.status,
    case
      when reservation.status = 'ready' then 0::bigint
      else (
        select count(*)
        from public.book_reservations earlier
        where earlier.book_id = reservation.book_id
          and earlier.status in ('active', 'ready')
          and (earlier.created_at, earlier.id) <= (reservation.created_at, reservation.id)
      )
    end,
    reservation.ready_at,
    reservation.ready_expires_at,
    reservation.created_at
  from public.book_reservations reservation
  where reservation.user_id = auth.uid()
    and reservation.status in ('active', 'ready')
  order by reservation.created_at desc;
end;
$$;

revoke all on function public.list_my_book_reservations() from public, anon;
grant execute on function public.list_my_book_reservations() to authenticated;

-- ---------------------------------------------------------------------------
-- 회원 관리: 최고 관리자를 목록에 포함하되 보호하고, 삭제 전 재고를 복구합니다.
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  user_id uuid,
  login_id text,
  name text,
  email text,
  role text,
  is_primary_admin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
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
    auth_user.id,
    profile.login_id,
    coalesce(profile.name, auth_user.raw_user_meta_data ->> 'name', '회원')::text,
    auth_user.email::text,
    case
      when lower(auth_user.email) = 'umjunsick6015@gmail.com' then 'admin'
      else coalesce(profile.role, 'member')
    end::text,
    (lower(auth_user.email) = 'umjunsick6015@gmail.com'),
    auth_user.created_at,
    auth_user.last_sign_in_at,
    auth_user.email_confirmed_at
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  order by
    (lower(auth_user.email) = 'umjunsick6015@gmail.com') desc,
    auth_user.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_email text;
  affected_book_ids text[] := '{}'::text[];
  affected_book_id text;
  active_loan_count integer;
  ready_reservation_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;
  if target_user_id = auth.uid() then
    raise exception '현재 로그인한 계정은 삭제할 수 없습니다';
  end if;

  select email::text into target_email from auth.users where id = target_user_id;
  if target_email is null then
    raise exception '삭제할 회원을 찾을 수 없습니다';
  end if;
  if lower(target_email) = 'umjunsick6015@gmail.com' then
    raise exception '최고 관리자 계정은 삭제할 수 없습니다';
  end if;

  select coalesce(array_agg(distinct book_id), '{}'::text[])
  into affected_book_ids
  from (
    select book_id from public.book_loans
    where user_id = target_user_id and status = 'active'
    union
    select book_id from public.book_reservations
    where user_id = target_user_id and status = 'ready'
  ) affected;

  foreach affected_book_id in array affected_book_ids loop
    perform 1 from public.books where id = affected_book_id for update;

    select count(*) into active_loan_count
    from public.book_loans
    where user_id = target_user_id and book_id = affected_book_id and status = 'active';

    select count(*) into ready_reservation_count
    from public.book_reservations
    where user_id = target_user_id and book_id = affected_book_id and status = 'ready';

    update public.books
    set available_quantity = least(
      total_quantity,
      available_quantity + active_loan_count + ready_reservation_count
    )
    where id = affected_book_id;
  end loop;

  update public.book_loans
  set status = 'returned', returned_at = coalesce(returned_at, now())
  where user_id = target_user_id and status = 'active';

  update public.book_reservations
  set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
  where user_id = target_user_id and status in ('active', 'ready');

  delete from public.favorites where user_id = target_user_id;
  delete from public.loans where user_id = target_user_id;
  delete from public.reservations where user_id = target_user_id;
  delete from auth.users where id = target_user_id;

  foreach affected_book_id in array affected_book_ids loop
    perform public.promote_book_reservations(affected_book_id);
  end loop;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 열람실: 종료된 당일 예약은 더 이상 예정 예약으로 취급하지 않습니다.
-- ---------------------------------------------------------------------------

create or replace function public.get_reading_room_availability(
  target_date date,
  target_start_time time,
  target_end_time time
)
returns table (seat_number integer, is_reserved boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_korea_date date := timezone('Asia/Seoul', now())::date;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
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

  return query
  select seat,
         exists (
           select 1 from public.reading_room_reservations reservation
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

create or replace function public.reserve_reading_room_seats(
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
  current_korea_timestamp timestamp := timezone('Asia/Seoul', now());
  new_reservation_group_id uuid := gen_random_uuid();
  requested_seat_count integer := cardinality(target_seat_numbers);
begin
  if current_user_id is null then raise exception '로그인이 필요합니다'; end if;
  if public.is_admin() then raise exception '관리자 계정은 열람실을 예약할 수 없습니다'; end if;
  if requested_seat_count is null or requested_seat_count < 1 or requested_seat_count > 4 then
    raise exception '좌석은 1개부터 최대 4개까지 선택할 수 있습니다';
  end if;
  if exists (
    select 1 from unnest(target_seat_numbers) requested(seat_number)
    where seat_number is null or seat_number not between 1 and 60
  ) or (
    select count(distinct seat_number) from unnest(target_seat_numbers) requested(seat_number)
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

  perform pg_advisory_xact_lock(hashtextextended('reading-room:' || current_user_id::text, 0));

  if exists (
    select 1 from public.reading_room_reservations
    where user_id = current_user_id
      and status = 'active'
      and reservation_date + end_time > current_korea_timestamp
  ) then
    raise exception '예정된 열람실 예약은 한 번만 보유할 수 있습니다. 기존 예약을 먼저 취소해 주세요';
  end if;

  insert into public.reading_room_reservations (
    reservation_group_id, user_id, seat_number, reservation_date,
    start_time, end_time, time_slot
  )
  select
    new_reservation_group_id, current_user_id, seat_number, target_date,
    target_start_time, target_end_time,
    to_char(target_start_time, 'HH24:MI') || '-' || to_char(target_end_time, 'HH24:MI')
  from unnest(target_seat_numbers) requested(seat_number);

  return new_reservation_group_id;
exception
  when exclusion_violation or unique_violation then
    raise exception '방금 다른 회원이 예약한 좌석입니다. 좌석 현황을 새로고침한 뒤 다시 선택해 주세요';
end;
$$;

revoke all on function public.reserve_reading_room_seats(date, time, time, integer[]) from public, anon;
grant execute on function public.reserve_reading_room_seats(date, time, time, integer[]) to authenticated;

drop function if exists public.admin_list_reading_room_reservations();
create function public.admin_list_reading_room_reservations()
returns table (
  reservation_group_id uuid,
  id uuid,
  user_id uuid,
  user_login_id text,
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
    coalesce(profile.login_id, '-')::text,
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
    and reservation.reservation_date + reservation.end_time > timezone('Asia/Seoul', now())
  group by reservation.reservation_group_id, reservation.user_id, profile.login_id, profile.name,
    auth_user.email, reservation.reservation_date, reservation.start_time, reservation.end_time
  order by reservation.reservation_date, reservation.start_time, min(reservation.created_at);
end;
$$;

revoke all on function public.admin_list_reading_room_reservations() from public, anon;
grant execute on function public.admin_list_reading_room_reservations() to authenticated;

-- ---------------------------------------------------------------------------
-- 문의: 답변 전 공개글은 작성자와 관리자 외에는 원본 테이블에서도 볼 수 없습니다.
-- ---------------------------------------------------------------------------

drop policy if exists "visitors view public inquiries" on public.inquiries;
drop policy if exists "visitors view answered public inquiries" on public.inquiries;
create policy "visitors view answered public inquiries"
  on public.inquiries for select to anon
  using (not is_secret and answer is not null);

drop policy if exists "members view allowed inquiries" on public.inquiries;
create policy "members view allowed inquiries"
  on public.inquiries for select to authenticated
  using (
    (not is_secret and answer is not null)
    or author_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "visitors view public inquiry images" on storage.objects;
drop policy if exists "visitors view answered public inquiry images" on storage.objects;
create policy "visitors view answered public inquiry images"
  on storage.objects for select to anon
  using (
    bucket_id = 'inquiry-images'
    and exists (
      select 1 from public.inquiries inquiry
      where (name = inquiry.image_path or name = any(inquiry.image_paths))
        and not inquiry.is_secret
        and inquiry.answer is not null
    )
  );

drop policy if exists "members view allowed inquiry images" on storage.objects;
create policy "members view allowed inquiry images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inquiry-images'
    and exists (
      select 1 from public.inquiries inquiry
      where (name = inquiry.image_path or name = any(inquiry.image_paths))
        and (
          (not inquiry.is_secret and inquiry.answer is not null)
          or inquiry.author_id = auth.uid()
          or public.is_admin()
        )
    )
  );

create or replace function public.update_my_inquiry(
  target_inquiry_id uuid,
  next_title text,
  next_content text,
  next_is_secret boolean,
  next_image_paths text[]
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_title text := btrim(coalesce(next_title, ''));
  normalized_content text := btrim(coalesce(next_content, ''));
  normalized_image_paths text[] := coalesce(next_image_paths, '{}'::text[]);
  previous_image_paths text[];
  removed_image_paths text[];
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
  if cardinality(normalized_image_paths) > 10 then
    raise exception '문의 사진은 최대 10장까지 첨부할 수 있습니다';
  end if;
  if (
    select count(distinct image_path)
    from unnest(normalized_image_paths) image_path
  ) <> cardinality(normalized_image_paths) then
    raise exception '같은 문의 사진을 중복해서 첨부할 수 없습니다';
  end if;
  if exists (
    select 1 from unnest(normalized_image_paths) image_path
    where image_path is null
      or image_path !~ ('^' || current_user_id::text || '/[A-Za-z0-9._-]+$')
  ) then
    raise exception '첨부 사진 경로가 올바르지 않습니다';
  end if;

  select array(
    select distinct path_value
    from unnest(
      coalesce(inquiry.image_paths, '{}'::text[])
      || case when inquiry.image_path is null then '{}'::text[] else array[inquiry.image_path] end
    ) stored(path_value)
    where path_value is not null and btrim(path_value) <> ''
  ) into previous_image_paths
  from public.inquiries inquiry
  where inquiry.id = target_inquiry_id
    and inquiry.author_id = current_user_id
    and inquiry.answer is null
  for update;

  if previous_image_paths is null then
    raise exception '답변 전인 본인 문의만 수정할 수 있습니다';
  end if;

  select coalesce(array_agg(path_value), '{}'::text[])
  into removed_image_paths
  from unnest(previous_image_paths) removed(path_value)
  where not (path_value = any(normalized_image_paths));

  update public.inquiries
  set
    title = normalized_title,
    content = normalized_content,
    is_secret = coalesce(next_is_secret, false),
    image_path = normalized_image_paths[1],
    image_paths = normalized_image_paths,
    updated_at = now()
  where id = target_inquiry_id
    and author_id = current_user_id
    and answer is null;

  return coalesce(removed_image_paths, '{}'::text[]);
end;
$$;

revoke all on function public.update_my_inquiry(uuid, text, text, boolean, text[]) from public, anon;
grant execute on function public.update_my_inquiry(uuid, text, text, boolean, text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
