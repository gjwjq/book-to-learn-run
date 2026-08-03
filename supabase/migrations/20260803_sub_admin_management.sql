-- 최고 관리자는 보호하고, 다른 관리자 권한 계정은 부관리자로 관리합니다.

begin;

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  login_id text,
  name text,
  email text,
  role text,
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
  select p.id, p.login_id, p.name, u.email::text, p.role::text,
         u.created_at, u.last_sign_in_at, u.email_confirmed_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) <> 'umjunsick6015@gmail.com'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_update_user(
  target_user_id uuid,
  next_name text,
  next_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_name text;
  current_role text;
  target_email text;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select p.role::text, u.email::text into current_role, target_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = target_user_id;

  if current_role is null then
    raise exception '회원을 찾을 수 없습니다';
  end if;
  if lower(target_email) = 'umjunsick6015@gmail.com' then
    raise exception '최고 관리자 계정은 수정할 수 없습니다';
  end if;

  normalized_name := regexp_replace(trim(coalesce(next_name, '')), '\s+', ' ', 'g');
  if normalized_name = '' or length(normalized_name) > 30 then
    raise exception '이름은 1~30자로 입력해 주세요';
  end if;
  if next_role not in ('member', 'admin') then
    raise exception '올바른 권한을 선택해 주세요';
  end if;

  update public.profiles
  set name = normalized_name,
      role = next_role,
      updated_at = now()
  where id = target_user_id;
exception
  when unique_violation then
    raise exception '이미 사용 중인 이름입니다';
end;
$$;

revoke all on function public.admin_update_user(uuid, text, text) from public, anon;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role text;
  target_email text;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  select p.role::text, u.email::text into target_role, target_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = target_user_id;

  if target_role is null then
    raise exception '삭제할 회원을 찾을 수 없습니다';
  end if;
  if lower(target_email) = 'umjunsick6015@gmail.com' then
    raise exception '최고 관리자 계정은 삭제할 수 없습니다';
  end if;

  delete from public.favorites where user_id = target_user_id;
  delete from public.loans where user_id = target_user_id;
  delete from public.reservations where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

commit;
