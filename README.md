# BOOK TO LEARN & RUN

Supabase Auth·Database·Storage와 Gemini API를 사용하는 도서관 웹서비스입니다.

## 주요 페이지

- `index.html`, `search.html`, `detail.html`: 도서 검색과 상세 정보
- `login.html`, `signup.html`: Supabase 회원 인증
- `mypage.html`: 회원정보, 찜, 대출, 예약 관리
- `admin.html`: 관리자 회원·도서 관리

## Supabase 설정

`supabase/migrations`의 SQL을 Supabase SQL Editor에서 실행합니다. 도서 표지 파일 업로드에는 `20260722_book_cover_storage.sql`, 도서 수량과 실제 대출 관리에는 `20260722_book_inventory_and_loans.sql`이 필요합니다.

브라우저 연결 정보는 `config.js`의 Supabase URL과 publishable key를 사용합니다. Secret 또는 service-role key는 프런트 코드에 넣지 않습니다.

## Gemini 자동 도서 정보

관리자가 제목과 저자를 입력하면 다음 값을 자동 작성합니다.

- 카테고리
- 키워드
- 짧은 소개와 상세 설명
- 출판사·출판일이 비어 있는 경우 보완

Vercel 프로젝트의 `Settings → Environment Variables`에 다음 값을 등록합니다.

```text
GEMINI_API_KEY=발급받은_Gemini_API_키
GEMINI_MODEL=gemini-3.5-flash-lite
```

등록 후 Vercel에서 다시 배포해야 `/api/generate-book-metadata` 함수가 환경변수를 읽습니다.

## 표지 이미지

관리자 폼에서 JPG, JPEG, PNG, WEBP 파일을 선택할 수 있습니다. 이미지는 Supabase Storage의 공개 `book-covers` 버킷에 업로드되고, 공개 URL만 `books.thumbnail`에 저장됩니다. 최대 파일 크기는 5MB입니다.

## 카카오 도서 API 가져오기

관리자 페이지에서 카카오 책 검색 결과를 최대 50권까지 불러오고, 원하는 도서를 선택해 Supabase에 일괄 등록할 수 있습니다. 제목과 저자가 같은 기존 도서는 자동으로 제외되며 가져온 도서의 기본 수량은 1권입니다.

Vercel 프로젝트의 `Settings → Environment Variables`에 다음 값을 등록하고 다시 배포합니다.

```text
KAKAO_REST_API_KEY=카카오_디벨로퍼스_REST_API_키
```

키는 브라우저에 포함되지 않고 `/api/search-books` 서버 함수에서만 사용합니다. 가져온 표지는 카카오가 제공한 썸네일 URL을 도서 정보에 저장합니다.

## 회원 도서 추가 요청

로그인한 일반 회원은 `request.html`에서 카카오 도서 API로 원하는 책을 검색하고 추가 요청을 보낼 수 있습니다. 관리자는 관리자 페이지의 `회원 도서 추가 요청` 목록에서 요청을 확인하고 `추가 승인` 버튼 한 번으로 도서를 기본 수량 1권으로 등록할 수 있습니다.

Supabase SQL Editor에서 다음 마이그레이션을 한 번 실행합니다.

```text
supabase/migrations/20260724_book_addition_requests.sql
```

같은 외부 도서의 승인 대기 요청은 중복 생성되지 않습니다. 회원은 자신의 요청 상태를 `승인 대기`, `추가 완료`, `요청 거절`로 확인할 수 있습니다.
