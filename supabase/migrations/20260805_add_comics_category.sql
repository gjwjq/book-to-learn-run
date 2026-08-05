-- 기존에 소설 등으로 분류된 명백한 만화 단행본을 만화 카테고리로 교정합니다.
-- category는 대표 분류 하나, keywords는 여러 세부 분류를 저장합니다.

begin;

update public.books
set category = '만화',
    keywords = array_prepend(
      '만화',
      array_remove(array_remove(coalesce(keywords, '{}'::text[]), '만화'), '소설')
    )
where category is distinct from '만화'
  and concat_ws(' ', title, author, publisher) ~* (
    '만화|코믹(스)?|manga|webtoon|웹툰|원피스|one[[:space:]]*piece|죠죠|jojo|' ||
    '귀멸의[[:space:]]*칼날|주술회전|슬램덩크|나루토|블리치|드래곤볼|' ||
    '진격의[[:space:]]*거인|명탐정[[:space:]]*코난|체인소[[:space:]]*맨|' ||
    '스파이[[:space:]]*패밀리|최애의[[:space:]]*아이|오다[[:space:]]*에이치로|' ||
    '아라키[[:space:]]*히로히코|대원씨아이|학산문화사|서울미디어코믹스'
  );

update public.book_requests
set category = '만화',
    keywords = array_prepend(
      '만화',
      array_remove(array_remove(coalesce(keywords, '{}'::text[]), '만화'), '소설')
    )
where status = 'pending'
  and category is distinct from '만화'
  and concat_ws(' ', title, author, publisher) ~* (
    '만화|코믹(스)?|manga|webtoon|웹툰|원피스|one[[:space:]]*piece|죠죠|jojo|' ||
    '귀멸의[[:space:]]*칼날|주술회전|슬램덩크|나루토|블리치|드래곤볼|' ||
    '진격의[[:space:]]*거인|명탐정[[:space:]]*코난|체인소[[:space:]]*맨|' ||
    '스파이[[:space:]]*패밀리|최애의[[:space:]]*아이|오다[[:space:]]*에이치로|' ||
    '아라키[[:space:]]*히로히코|대원씨아이|학산문화사|서울미디어코믹스'
  );

commit;
