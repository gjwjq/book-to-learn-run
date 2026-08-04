-- 도서 정보 UPDATE 중 books_pkey 중복 오류가 발생하는 DB의 재고 트리거를 복구합니다.
-- Supabase SQL Editor에서 이 파일 전체를 한 번 실행해도 기존 데이터는 삭제되지 않습니다.

begin;

create or replace function public.sync_book_inventory_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  borrowed_count integer;
begin
  if tg_op = 'INSERT' then
    new.total_quantity := greatest(coalesce(new.total_quantity, 1), 1);
    new.available_quantity := new.total_quantity;
  elsif new.total_quantity is distinct from old.total_quantity then
    borrowed_count := old.total_quantity - old.available_quantity;
    if new.total_quantity < borrowed_count then
      raise exception '현재 대출 중인 수량보다 전체 수량을 적게 설정할 수 없습니다';
    end if;
    new.available_quantity := new.total_quantity - borrowed_count;
  end if;

  new.loan_status := case
    when new.available_quantity > 0 then '대출 가능'
    else '대출 중'
  end;
  return new;
end;
$$;

drop trigger if exists sync_book_inventory_status on public.books;
create trigger sync_book_inventory_status
  before insert or update of total_quantity, available_quantity
  on public.books
  for each row execute function public.sync_book_inventory_status();

commit;
