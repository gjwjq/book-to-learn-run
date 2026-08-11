-- 문의 등록 RPC 스키마 캐시 불일치 복구
-- 기존 문의 데이터는 유지하고 다중 사진 컬럼과 새 create_inquiry 함수를 보장합니다.

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

-- 예전 단일 사진 인자 함수를 제거하고 현재 프런트엔드와 동일한 인자명으로 생성합니다.
drop function if exists public.create_inquiry(text, text, boolean, text);

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

notify pgrst, 'reload schema';

commit;
