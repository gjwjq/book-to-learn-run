# BOOK TO LEARN & RUN

Supabase Auth·Database·Storage와 Gemini API를 사용하는 도서관 웹서비스입니다.

## 주요 페이지

- `index.html`, `search.html`, `detail.html`: 도서 검색과 상세 정보
- `login.html`, `signup.html`: Supabase 회원 인증과 이메일 비밀번호 재설정
- `mypage.html`: 회원정보, 찜, 도서 대출·예약, 열람실 예약 관리
- `request.html`: 회원 도서 추가 요청과 요청 취소
- `reading-room.html`: 날짜·시간·좌석을 선택하는 열람실 예약
- `inquiry.html`: 공개·비밀 문의 작성과 답변 확인
- `admin-users.html`, `admin-books.html`, `admin-reading-room.html`, `admin-inquiries.html`: 기능별 관리자 페이지

모든 현재 페이지는 고정 버전의 Supabase 브라우저 SDK를 사용합니다. 모바일에서는 헤더와 주요 메뉴가 고정되며, 넓은 표와 열람실 좌석 배치도는 페이지 전체를 밀어내지 않고 영역 안에서 스크롤됩니다.

## Supabase 설정

새 Supabase 프로젝트는 `supabase/migrations`의 SQL을 파일명 순으로 적용합니다. `20260721000000_baseline_schema.sql`은 빈 프로젝트에서도 나머지 마이그레이션이 재현되도록 최소 스키마를 준비합니다.

기존 운영 DB에 이전 SQL이 이미 적용되어 있다면 데이터를 초기화하지 말고 가장 최근의 `20260902000100_backend_integrity_hardening.sql`만 추가로 실행합니다. 이 SQL은 도서 보관 삭제, 대출·예약·요청 한도, 예약 우선권 만료, 미답변 문의 비공개, 회원·재고 무결성과 설명 정규화를 보완합니다.

브라우저 연결 정보는 `config.js`의 Supabase URL과 publishable key를 사용합니다. Secret 또는 service-role key는 프런트 코드에 넣지 않습니다. 아이디 로그인을 위한 서버 API에는 Vercel 환경변수가 필요합니다.

```text
SUPABASE_URL=https://프로젝트.supabase.co
SUPABASE_PUBLISHABLE_KEY=Supabase_publishable_키
SUPABASE_SERVICE_ROLE_KEY=Supabase_service_role_키
```

`SUPABASE_SERVICE_ROLE_KEY`는 `/api/login-by-id`에서만 사용하며 `config.js`나 HTML에 절대 넣지 않습니다. 환경변수 추가 후에는 Vercel Production을 재배포합니다.

## Gemini 자동 도서 정보

관리자가 제목과 저자를 입력하면 다음 값을 자동 작성합니다.

- 카테고리
- 키워드
- 짧은 소개와 상세 설명
- 출판사·출판일이 비어 있는 경우 보완

가져온 소개가 말줄임표나 문장 중간에서 끝나면 그대로 저장하지 않고 완결된 문장으로 보정합니다. 이미 완결된 원문은 임의의 길이로 잘라내지 않습니다.

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
