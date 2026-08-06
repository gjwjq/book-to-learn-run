"use strict";

const STORAGE_KEYS = {
  recentSearches: "btlr_recent_searches",
  favorites: "btlr_favorites",
  loans: "btlr_loans",
  reservations: "btlr_reservations",
};

const mockBooks = [
  {
    id: "book-001",
    title: "생각을 모으는 사람",
    author: "모니카 페트",
    publisher: "풀빛",
    publishedDate: "2023-03-15",
    category: "인문",
    keywords: ["생각", "철학", "마음", "성찰"],
    description: "바쁘게 흘러가는 일상에서 잠시 멈춰 생각을 모으는 일의 의미를 이야기합니다. 나의 생각을 귀하게 바라보고 타인의 관점과 조용히 만나는 시간을 선물하는 책입니다.",
    shortDescription: "흩어진 생각을 모아 나만의 관점을 발견하는 따뜻한 이야기.",
    thumbnail: "image/images/images (4).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-04-12",
  },
  {
    id: "book-002",
    title: "잘 읽히는 보고서 문장의 비밀",
    author: "이윤경",
    publisher: "한빛미디어",
    publishedDate: "2024-02-20",
    category: "진로/취업",
    keywords: ["보고서", "글쓰기", "취업", "직장"],
    description: "보고서와 자기소개서, 이메일처럼 실무에서 자주 쓰는 문장을 더 명확하고 설득력 있게 다듬는 방법을 알려줍니다. 사례를 통해 바로 적용할 수 있는 글쓰기 원칙을 배울 수 있습니다.",
    shortDescription: "실무 문장을 짧고 정확하게 만드는 보고서 글쓰기 안내서.",
    thumbnail: "image/images/images (9).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-02",
  },
  {
    id: "book-003",
    title: "개발하는 남자의 핸즈온 플러터",
    author: "김성덕",
    publisher: "한빛미디어",
    publishedDate: "2023-08-01",
    category: "IT",
    keywords: ["플러터", "앱개발", "모바일", "프로그래밍"],
    description: "플러터의 기본 위젯부터 상태 관리와 실제 앱 배포 흐름까지 하나의 프로젝트로 익히는 실습서입니다. 모바일 앱 개발을 처음 시작하는 독자도 차근차근 따라갈 수 있습니다.",
    shortDescription: "실전 프로젝트로 배우는 플러터 모바일 앱 개발.",
    thumbnail: "image/images/images (10).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-05-28",
  },
  {
    id: "book-004",
    title: "실무로 통하는 클린 코드",
    author: "제이슨 앨럼",
    publisher: "한빛미디어",
    publishedDate: "2024-01-10",
    category: "IT",
    keywords: ["클린코드", "개발자", "코딩", "설계"],
    description: "읽기 쉽고 유지보수하기 좋은 코드를 만들기 위한 실용적인 원칙을 담았습니다. 이름 짓기, 함수 설계, 오류 처리, 테스트 등 개발 현장에서 반복해서 마주치는 문제를 구체적으로 설명합니다.",
    shortDescription: "현장에서 오래 살아남는 코드를 위한 실전 원칙.",
    thumbnail: "image/images/images (11).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-11",
  },
  {
    id: "book-005",
    title: "네트워크 인프라 자동화",
    author: "맷 오스왈트 외",
    publisher: "한빛미디어",
    publishedDate: "2023-11-24",
    category: "IT",
    keywords: ["네트워크", "자동화", "인프라", "파이썬"],
    description: "반복적인 네트워크 운영을 코드로 자동화하는 방법과 실무 도구를 소개합니다. 네트워크 엔지니어와 개발자가 함께 이해할 수 있도록 개념부터 운영 사례까지 폭넓게 다룹니다.",
    shortDescription: "코드로 더 빠르고 안전하게 운영하는 네트워크 인프라.",
    thumbnail: "image/images/images (12).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-04-08",
  },
  {
    id: "book-006",
    title: "실무로 통하는 ML 문제 해결 with 파이썬",
    author: "카일 갤러틴",
    publisher: "한빛미디어",
    publishedDate: "2024-05-17",
    category: "IT",
    keywords: ["머신러닝", "파이썬", "데이터", "AI"],
    description: "머신러닝 프로젝트에서 데이터 품질, 모델 선택, 평가와 배포까지 문제를 정의하고 해결하는 과정을 안내합니다. 단순한 알고리즘 암기를 넘어 실무 판단력을 기를 수 있습니다.",
    shortDescription: "현실의 데이터 문제를 해결하는 머신러닝 실전 가이드.",
    thumbnail: "image/images/images (13).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-14",
  },
  {
    id: "book-007",
    title: "자바스크립트 + 리액트 디자인 패턴",
    author: "애디 오스마니",
    publisher: "한빛미디어",
    publishedDate: "2024-04-08",
    category: "IT",
    keywords: ["자바스크립트", "리액트", "프론트엔드", "디자인패턴"],
    description: "현대 자바스크립트와 리액트 애플리케이션에서 재사용 가능한 구조를 만드는 디자인 패턴을 설명합니다. 성능과 유지보수성을 함께 고려하는 프론트엔드 설계를 배울 수 있습니다.",
    shortDescription: "확장 가능한 프론트엔드를 위한 현대적 디자인 패턴.",
    thumbnail: "image/images/images (14).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-05-21",
  },
  {
    id: "book-008",
    title: "더 나은 프로그래머가 되는 법",
    author: "피트 구들리프",
    publisher: "한빛미디어",
    publishedDate: "2023-09-12",
    category: "자기계발",
    keywords: ["개발자", "성장", "커리어", "습관"],
    description: "좋은 코드를 넘어 좋은 개발자로 성장하기 위한 태도와 습관을 다룹니다. 협업, 학습, 시간 관리, 커뮤니케이션 등 기술 바깥의 역량까지 현실적인 조언으로 풀어냅니다.",
    shortDescription: "기술과 태도를 함께 키우는 개발자 성장 안내서.",
    thumbnail: "image/images/images (15).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-03-19",
  },
  {
    id: "book-009",
    title: "당근 마케팅",
    author: "김용태",
    publisher: "한빛비즈",
    publishedDate: "2023-06-30",
    category: "경제",
    keywords: ["마케팅", "브랜딩", "비즈니스", "플랫폼"],
    description: "사람과 동네, 신뢰를 연결하는 로컬 플랫폼의 성장 방식을 바탕으로 오늘날의 마케팅 전략을 살펴봅니다. 고객과 오래 관계 맺는 브랜드의 원칙을 쉽게 설명합니다.",
    shortDescription: "사람과 지역을 연결해 성장하는 마케팅의 원리.",
    thumbnail: "image/images/images (16).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-02-15",
  },
  {
    id: "book-010",
    title: "이것이 취업을 위한 컴퓨터 과학이다",
    author: "최지민",
    publisher: "한빛미디어",
    publishedDate: "2024-07-01",
    category: "진로/취업",
    keywords: ["취업", "CS", "면접", "개발자"],
    description: "개발자 취업에 필요한 컴퓨터 과학 핵심 개념을 면접 질문과 함께 정리합니다. 운영체제, 네트워크, 자료구조와 데이터베이스를 연결해 이해하도록 돕습니다.",
    shortDescription: "개발자 면접과 실무를 연결하는 컴퓨터 과학 핵심.",
    thumbnail: "image/images/images (17).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-18",
  },
  {
    id: "book-011",
    title: "실무로 통하는 타입스크립트",
    author: "조시 골드버그",
    publisher: "한빛미디어",
    publishedDate: "2023-12-05",
    category: "IT",
    keywords: ["타입스크립트", "웹개발", "프로그래밍", "실무"],
    description: "타입 시스템의 기본부터 제네릭, 선언 파일, 설정과 마이그레이션까지 실무에 필요한 타입스크립트 지식을 다룹니다. 자바스크립트 프로젝트를 더 안전하게 만드는 방법을 익힐 수 있습니다.",
    shortDescription: "자바스크립트 프로젝트를 단단하게 만드는 타입 설계.",
    thumbnail: "image/images/images (18).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-05-04",
  },
  {
    id: "book-012",
    title: "매일의 작은 실행",
    author: "윤서진",
    publisher: "마음서재",
    publishedDate: "2024-08-22",
    category: "자기계발",
    keywords: ["습관", "실행", "성장", "루틴"],
    description: "거창한 목표보다 오늘의 작은 행동을 선택하는 방법을 이야기합니다. 꾸준함을 방해하는 마음을 이해하고 자신에게 맞는 실행 리듬을 설계하도록 돕습니다.",
    shortDescription: "작은 행동을 꾸준한 변화로 바꾸는 현실적인 습관법.",
    thumbnail: "image/images/images (19).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-08",
  },
  {
    id: "book-013",
    title: "AI 변호사 with 챗GPT",
    author: "박상흠",
    publisher: "한빛미디어",
    publishedDate: "2024-03-04",
    category: "인문",
    keywords: ["AI", "법", "챗GPT", "사회"],
    description: "생성형 AI가 법률 업무와 사회의 규칙을 어떻게 바꾸는지 다양한 사례로 살펴봅니다. 기술을 무조건 낙관하거나 두려워하기보다 책임 있게 활용할 관점을 제안합니다.",
    shortDescription: "생성형 AI와 법률의 만남에서 발견하는 새로운 질문.",
    thumbnail: "image/images/images (20).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-05-30",
  },
  {
    id: "book-014",
    title: "퇴근 후 시작하는 나의 첫 프로젝트",
    author: "정하린",
    publisher: "러닝앤런",
    publishedDate: "2024-09-10",
    category: "진로/취업",
    keywords: ["사이드프로젝트", "포트폴리오", "진로", "커리어"],
    description: "하고 싶은 일을 작은 프로젝트로 시작하고 결과물을 포트폴리오로 연결하는 과정을 안내합니다. 아이디어 선정부터 일정 관리, 기록과 회고까지 초보자의 눈높이에서 설명합니다.",
    shortDescription: "작은 사이드 프로젝트를 커리어 자산으로 만드는 법.",
    thumbnail: "image/images/images (21).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-19",
  },
  {
    id: "book-015",
    title: "오늘도 무사히, 마음 산책",
    author: "한유진",
    publisher: "포레스트북스",
    publishedDate: "2024-01-29",
    category: "에세이",
    keywords: ["에세이", "마음", "위로", "일상"],
    description: "완벽하지 않은 하루를 다정하게 통과하는 마음의 문장들을 담았습니다. 지친 날에는 잠시 쉬어도 괜찮다는 위로와 다시 걸을 용기를 건넵니다.",
    shortDescription: "평범한 하루를 다정하게 보듬는 마음의 문장들.",
    thumbnail: "image/images/images (22).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-03-02",
  },
  {
    id: "book-016",
    title: "우리가 건너온 여름",
    author: "서이안",
    publisher: "문학의숲",
    publishedDate: "2024-06-14",
    category: "소설",
    keywords: ["소설", "청춘", "우정", "성장"],
    description: "각자의 이유로 고향을 떠났던 세 친구가 오래된 도서관에서 다시 만나며 시작되는 이야기입니다. 지나온 계절과 아직 오지 않은 삶 사이에서 서로의 선택을 이해해 갑니다.",
    shortDescription: "다시 만난 세 친구가 함께 건너는 한여름의 성장 소설.",
    thumbnail: "image/images/images (23).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-06-13",
  },
  {
    id: "book-017",
    title: "돈의 흐름을 읽는 첫 수업",
    author: "김도현",
    publisher: "인사이트",
    publishedDate: "2024-04-25",
    category: "경제",
    keywords: ["경제", "금융", "투자", "청년"],
    description: "금리, 환율, 물가처럼 뉴스에서 자주 만나는 경제 개념을 일상의 언어로 설명합니다. 숫자에 겁먹지 않고 세상의 흐름을 읽는 기본 감각을 기를 수 있습니다.",
    shortDescription: "일상과 뉴스가 연결되는 가장 쉬운 경제 입문.",
    thumbnail: "image/images/images (24).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-05-18",
  },
  {
    id: "book-018",
    title: "문장 사이의 밤",
    author: "이해원",
    publisher: "달과문장",
    publishedDate: "2023-10-18",
    category: "에세이",
    keywords: ["독서", "문장", "에세이", "기록"],
    description: "책을 읽으며 밑줄 그은 문장과 그 곁에서 피어난 생각을 기록한 독서 에세이입니다. 한 문장이 한 사람의 하루를 어떻게 바꾸는지 잔잔하게 보여줍니다.",
    shortDescription: "읽은 문장과 살아낸 하루가 만나는 독서 에세이.",
    thumbnail: "image/images/images (25).jpg",
    loanStatus: "대출 가능",
    returnDate: null,
    createdAt: "2025-04-25",
  },
];

let toastTimer = null;
let currentUserCache = null;
let booksCache = mockBooks;
let loansCache = [];
let reservationsCache = [];
let readingRoomReservationsCache = [];
let adminBookImportResults = [];
let userBookSearchResults = [];
let myBookRequestsCache = [];
let adminUsersCache = [];
let adminUserPage = 1;
let adminBookPage = 1;
const adminSelectedBookIds = new Set();
const ADMIN_PAGE_SIZE = 20;
const MAX_ACTIVE_BOOK_RESERVATIONS = 10;
const MAX_PENDING_BOOK_REQUESTS = 10;
const READING_ROOM_SEATS = 60;
const READING_ROOM_MAX_SELECTED_SEATS = 4;
const PRIMARY_ADMIN_EMAIL = "umjunsick6015@gmail.com";
const BOOK_CATEGORIES = ["자기계발", "진로/취업", "소설", "인문", "경제", "IT", "에세이", "만화"];
const CURATED_CATEGORY_BOOKS = {
  "자기계발": [
    "행동하지 않으면 인생은 바뀌지 않는다",
    "아주 작은 습관의 힘",
    "원씽",
    "역행자",
    "데일 카네기 인간관계론",
  ],
  "진로/취업": [
    "자소서 바이블 2.0",
    "면접 바이블",
    "일의 감각",
    "내 일로 건너가는 법",
    "커리어 스킬",
  ],
  "소설": [
    "불편한 편의점",
    "아몬드",
    "달러구트 꿈 백화점",
    "모순",
    "채식주의자",
  ],
  "인문": [
    "마흔에 읽는 쇼펜하우어",
    "도둑맞은 집중력",
    "사피엔스",
    "정의란 무엇인가",
    "총 균 쇠",
  ],
  "경제": [
    "트렌드 코리아 2026",
    "돈의 심리학",
    "부자 아빠 가난한 아빠",
    "EBS 다큐프라임 자본주의",
    "현명한 투자자",
  ],
  "IT": [
    "혼자 공부하는 파이썬",
    "모던 자바스크립트 Deep Dive",
    "클린 코드",
    "리팩터링 2판",
    "그림으로 이해하는 AWS 구조와 기술",
  ],
  "에세이": [
    "나는 메트로폴리탄 미술관의 경비원입니다",
    "여행의 이유",
    "나는 나로 살기로 했다",
    "하마터면 열심히 살 뻔했다",
    "죽고 싶지만 떡볶이는 먹고 싶어",
  ],
  "만화": [
    "원피스 1",
    "죠죠의 기묘한 모험 1",
    "슬램덩크 신장재편판 1",
    "귀멸의 칼날 1",
    "명탐정 코난 1",
  ],
};
const ADMIN_BOOK_DRAFT_PREFIX = "btlr_admin_book_draft";
const ADMIN_BOOK_DRAFT_DB = "btlr-admin-drafts";

async function initApp() {
  await loadCurrentUser();
  await Promise.all([
    loadBooksFromSupabase(),
    loadUserLoansFromSupabase(),
    loadUserReservationsFromSupabase(),
  ]);
  handleHeaderSearch();
  renderAuthArea();
  handleGlobalActions();

  const page = getCurrentPage();
  const pageInitializers = {
    home: initHomePage,
    search: initSearchPage,
    detail: initDetailPage,
    reserve: initReservePage,
    signup: initSignupPage,
    login: initLoginPage,
    mypage: initMyPage,
    admin: initAdminPage,
    request: initBookRequestPage,
    "reading-room": initReadingRoomPage,
  };

  if (pageInitializers[page]) {
    pageInitializers[page]();
  }
}

function getCurrentPage() {
  return document.body?.dataset.page || "";
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function generateId(prefix) {
  const randomPart =
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${randomPart}`;
}

function formatDate(date) {
  if (!date) return "-";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value.toISOString();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`${key} 데이터를 읽지 못했습니다.`, error);
    return [];
  }
}

function setStoredArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCurrentRelativeUrl() {
  const fileName = window.location.pathname.split("/").pop() || "index.html";
  return `${fileName}${window.location.search}${window.location.hash}`;
}

function getSafeNextUrl() {
  const next = getQueryParam("next");
  if (!next) return "mypage.html";
  return /^(index|search|detail|reserve|mypage|admin|request|reading-room)\.html(?:[?#].*)?$/.test(next)
    ? next
    : "mypage.html";
}

function getStatusClass(status) {
  const map = {
    "대출 가능": "status-available",
    "대출 중": "status-loaned",
    "예약 가능": "status-reservable",
    "예약 완료": "status-reserved",
    "대여 중": "status-my-loan",
  };
  return map[status] || "status-reservable";
}

function getBooks() {
  return booksCache.map((book) => ({
    ...book,
    keywords: [...book.keywords],
  }));
}

function getBookById(bookId) {
  return booksCache.find((book) => book.id === bookId) || null;
}

function mapDatabaseBook(book) {
  const totalQuantity = Math.max(Number(book.total_quantity) || 1, 1);
  const availableQuantity = Math.max(Math.min(Number(book.available_quantity) || 0, totalQuantity), 0);
  return {
    id: book.id,
    title: book.title || "제목 없음",
    author: book.author || "저자 미상",
    publisher: book.publisher || "",
    publishedDate: book.published_date || null,
    category: book.category || "기타",
    keywords: Array.isArray(book.keywords) ? book.keywords : [],
    description: book.description || "",
    shortDescription: book.short_description || book.description || "",
    thumbnail: book.thumbnail || "",
    totalQuantity,
    availableQuantity,
    loanStatus: availableQuantity > 0 ? "대출 가능" : "대출 중",
    returnDate: book.return_date || null,
    createdAt: book.created_at || new Date().toISOString(),
  };
}

function serializeBookForDatabase(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher || null,
    published_date: book.publishedDate || null,
    category: book.category || "기타",
    keywords: book.keywords || [],
    description: book.description || null,
    short_description: book.shortDescription || null,
    thumbnail: book.thumbnail || null,
    total_quantity: Math.max(Number(book.totalQuantity) || 1, 1),
    return_date: book.returnDate || null,
  };
}

async function loadBooksFromSupabase() {
  if (!window.btlrSupabase) return;
  const { data, error } = await window.btlrSupabase
    .from("books")
    .select("id, title, author, publisher, published_date, category, keywords, description, short_description, thumbnail, loan_status, return_date, total_quantity, available_quantity, created_at")
    .order("created_at", { ascending: false });
  if (!error && data?.length) booksCache = data.map(mapDatabaseBook);
}

function searchBooks(query, books) {
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("ko-KR");
  if (!normalizedQuery) return [...books];

  return books.filter((book) => {
    const searchableText = [
      book.title,
      book.author,
      book.publisher,
      book.category,
      book.description,
      book.shortDescription,
      ...book.keywords,
    ]
      .join(" ")
      .toLocaleLowerCase("ko-KR");
    return searchableText.includes(normalizedQuery);
  });
}

function filterBooks(books, filters = {}) {
  return books.filter((book) => {
    const categoryMatches =
      !filters.category ||
      filters.category === "전체" ||
      book.category === filters.category;
    const statusMatches =
      !filters.loanStatus ||
      filters.loanStatus === "전체" ||
      book.loanStatus === filters.loanStatus;
    return categoryMatches && statusMatches;
  });
}

function sortBooks(books, sortOption = "default") {
  const sortedBooks = [...books];
  if (sortOption === "title") {
    return sortedBooks.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  }
  if (sortOption === "latest") {
    return sortedBooks.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }
  return sortedBooks;
}

function renderBookCards(books, target = null) {
  const container =
    target ||
    document.getElementById("search-results") ||
    document.getElementById("featured-books");
  if (!container) return;
  container.innerHTML = books.map(createBookCardMarkup).join("");
}

function createBookCardMarkup(book) {
  const user = getCurrentUser();
  const favorite = isFavorite(book.id);
  const loanedByUser = isLoaned(book.id);
  const isAvailable = (book.availableQuantity ?? (book.loanStatus === "대출 가능" ? 1 : 0)) > 0;
  const mainAction = user?.role === "admin"
    ? '<button class="card-main-action is-disabled" type="button" disabled>관리자 계정</button>'
    : loanedByUser
      ? '<button class="card-main-action is-disabled" type="button" disabled>대여 중</button>'
    : isAvailable
      ? `<button class="card-main-action" type="button" data-action="borrow" data-book-id="${book.id}">대출하기</button>`
      : `<a class="card-main-action reserve-action" href="reserve.html?id=${encodeURIComponent(book.id)}">예약 신청</a>`;

  return `
    <article class="book-card" data-book-card="${book.id}">
      <a class="book-cover-link" href="detail.html?id=${encodeURIComponent(book.id)}" aria-label="${escapeHTML(book.title)} 상세 보기">
        <img class="book-cover" src="${escapeHTML(book.thumbnail)}" alt="${escapeHTML(book.title)} 표지" loading="lazy" onerror="this.outerHTML='<span class=&quot;cover-fallback&quot; aria-label=&quot;표지 이미지 없음&quot;>B</span>'" />
        <span class="book-status status-badge ${getStatusClass(book.loanStatus)}">${escapeHTML(book.loanStatus)}</span>
      </a>
      <div class="book-card-content">
        <span class="book-category">${escapeHTML(book.category.toUpperCase())}</span>
        <h3><a href="detail.html?id=${encodeURIComponent(book.id)}">${escapeHTML(book.title)}</a></h3>
        <p class="book-author">${escapeHTML(book.author)} · ${escapeHTML(book.publisher)}</p>
        <p class="book-description">${escapeHTML(book.shortDescription)}</p>
        <div class="book-actions">
          <button class="favorite-button ${favorite ? "active" : ""}" type="button" data-action="favorite" data-book-id="${book.id}" aria-label="${favorite ? "찜 취소" : "찜하기"}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button>
          ${mainAction}
        </div>
      </div>
    </article>
  `;
}

function handleHeaderSearch() {
  document.querySelectorAll(".header-search").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector('input[name="q"]');
      const query = input?.value.trim() || "";
      if (query) saveRecentSearch(query);
      window.location.href = query
        ? `search.html?q=${encodeURIComponent(query)}`
        : "search.html";
    });
  });
}

function saveRecentSearch(query) {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  const searches = getRecentSearches().filter(
    (item) => item.toLocaleLowerCase("ko-KR") !== normalized.toLocaleLowerCase("ko-KR"),
  );
  searches.unshift(normalized);
  setStoredArray(STORAGE_KEYS.recentSearches, searches.slice(0, 5));
}

function getRecentSearches() {
  return getStoredArray(STORAGE_KEYS.recentSearches);
}

function renderRecentSearches(container) {
  if (!container) return;

  const recentSearches = getRecentSearches();
  if (!recentSearches.length) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <span class="recent-searches-label">최근 검색</span>
    <span class="recent-searches-list">
      ${recentSearches.map((query, index) => `
        <span class="recent-search-item">
          <a href="search.html?q=${encodeURIComponent(query)}">${escapeHTML(query)}</a>
          <button
            type="button"
            class="recent-search-remove"
            data-recent-index="${index}"
            aria-label="${escapeHTML(query)} 최근 검색어 삭제"
            title="삭제"
          >×</button>
        </span>
      `).join("")}
    </span>
  `;

  container.querySelectorAll("[data-recent-index]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const index = Number(button.dataset.recentIndex);
      const updatedSearches = getRecentSearches();
      if (!Number.isInteger(index) || index < 0 || index >= updatedSearches.length) return;

      updatedSearches.splice(index, 1);
      setStoredArray(STORAGE_KEYS.recentSearches, updatedSearches);
      renderRecentSearches(container);
    });
  });
}

async function signupUser(formData) {
  const loginId = String(formData.loginId || "").trim().toLocaleLowerCase();
  const name = String(formData.name || "").trim().replace(/\s+/g, " ");
  const email = String(formData.email || "").trim().toLocaleLowerCase();
  const password = String(formData.password || "");

  if (!loginId || !name || !email || !password) {
    return { success: false, message: "모든 입력 항목을 작성해 주세요." };
  }
  if (!/^[a-z][a-z0-9_]{3,19}$/.test(loginId)) {
    return {
      success: false,
      message: "아이디는 영문 소문자로 시작하고 영문·숫자·밑줄로 4~20자 입력해 주세요.",
    };
  }
  if (name.length > 30) {
    return { success: false, message: "이름은 30자 이하로 입력해 주세요." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "올바른 이메일 형식을 입력해 주세요." };
  }
  if (password.length < 8) {
    return { success: false, message: "비밀번호는 8자 이상 입력해 주세요." };
  }
  if (!window.btlrSupabase) {
    return { success: false, message: "회원 서비스에 연결할 수 없습니다." };
  }

  const { data, error } = await window.btlrSupabase.auth.signUp({
    email,
    password,
    options: { data: { login_id: loginId, name } },
  });

  if (error) {
    const normalizedError = error.message.toLocaleLowerCase();
    const message = normalizedError.includes("duplicate") || normalizedError.includes("already")
      ? "이미 사용 중인 아이디 또는 이메일입니다."
      : error.message;
    return { success: false, message };
  }

  return {
    success: true,
    message: data.session
      ? "회원가입이 완료되었습니다."
      : "회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.",
    user: data.user,
  };
}

async function loginUser(identifier, password) {
  const normalizedIdentifier = String(identifier || "").trim().toLocaleLowerCase();
  if (!normalizedIdentifier || !password) {
    return {
      success: false,
      message: "아이디 또는 이메일과 비밀번호를 입력해 주세요.",
    };
  }

  if (!window.btlrSupabase) {
    return { success: false, message: "회원 서비스에 연결할 수 없습니다." };
  }

  let loginEmail = normalizedIdentifier;
  if (!normalizedIdentifier.includes("@")) {
    const { data: resolvedEmail, error: resolveError } = await window.btlrSupabase
      .rpc("resolve_login_email", { input_login_id: normalizedIdentifier });
    if (resolveError || !resolvedEmail) {
      return { success: false, message: "아이디 또는 비밀번호가 올바르지 않습니다." };
    }
    loginEmail = resolvedEmail;
  }

  const { data, error } = await window.btlrSupabase.auth.signInWithPassword({
    email: loginEmail,
    password: String(password),
  });

  if (error) {
    const normalizedError = error.message.toLocaleLowerCase();
    const message = normalizedError.includes("email not confirmed")
      ? "이메일 인증을 완료한 후 로그인해 주세요."
      : normalizedError.includes("invalid login credentials")
        ? "아이디·이메일 또는 비밀번호가 올바르지 않습니다."
        : "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    return {
      success: false,
      message,
    };
  }

  await loadCurrentUser(data.user);
  return { success: true, message: "로그인되었습니다.", user: currentUserCache };
}

async function logoutUser() {
  if (window.btlrSupabase) {
    await window.btlrSupabase.auth.signOut();
  }
  currentUserCache = null;
}

function getCurrentUser() {
  return currentUserCache;
}

async function loadCurrentUser(knownUser = null) {
  if (!window.btlrSupabase) {
    currentUserCache = null;
    return null;
  }

  let authUser = knownUser;
  if (!authUser) {
    const { data, error } = await window.btlrSupabase.auth.getSession();
    if (error || !data.session?.user) {
      currentUserCache = null;
      return null;
    }
    authUser = data.session.user;
  }

  const { data: profile } = await window.btlrSupabase
    .from("profiles")
    .select("id, name, login_id, role, created_at")
    .eq("id", authUser.id)
    .maybeSingle();

  currentUserCache = {
    id: authUser.id,
    email: authUser.email || "",
    name:
      profile?.name ||
      authUser.user_metadata?.name ||
      authUser.email?.split("@")[0] ||
      "회원",
    loginId: profile?.login_id || authUser.user_metadata?.login_id || null,
    role: profile?.role || "member",
    createdAt: profile?.created_at || authUser.created_at,
  };
  return currentUserCache;
}

function requireLogin() {
  const user = getCurrentUser();
  if (user) return user;

  sessionStorage.setItem(
    "btlr_login_notice",
    "로그인 후 이용할 수 있는 기능입니다.",
  );
  const next = encodeURIComponent(getCurrentRelativeUrl());
  window.location.href = `login.html?next=${next}`;
  return null;
}

function getFavorites() {
  return getStoredArray(STORAGE_KEYS.favorites);
}

function saveFavorites(favorites) {
  setStoredArray(STORAGE_KEYS.favorites, favorites);
}

function addFavorite(bookId) {
  const user = requireLogin();
  if (!user) return { success: false, redirected: true };
  const favorites = getFavorites();
  if (
    favorites.some(
      (favorite) => favorite.userId === user.id && favorite.bookId === bookId,
    )
  ) {
    return { success: false, message: "이미 찜한 도서입니다." };
  }
  favorites.push({
    id: generateId("fav"),
    userId: user.id,
    bookId,
    createdAt: new Date().toISOString(),
  });
  saveFavorites(favorites);
  return { success: true, message: "찜한 도서에 추가했습니다." };
}

function removeFavorite(bookId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "로그인이 필요합니다." };
  const nextFavorites = getFavorites().filter(
    (favorite) =>
      !(favorite.userId === user.id && favorite.bookId === bookId),
  );
  saveFavorites(nextFavorites);
  return { success: true, message: "찜을 취소했습니다." };
}

function isFavorite(bookId) {
  const user = getCurrentUser();
  if (!user) return false;
  return getFavorites().some(
    (favorite) => favorite.userId === user.id && favorite.bookId === bookId,
  );
}

function getLoans() {
  return [...loansCache];
}

async function loadUserLoansFromSupabase() {
  const user = getCurrentUser();
  if (!user || !window.btlrSupabase) {
    loansCache = [];
    return;
  }
  const { data, error } = await window.btlrSupabase
    .from("book_loans")
    .select("id, user_id, book_id, status, borrowed_at, due_at")
    .eq("status", "active")
    .order("borrowed_at", { ascending: false });
  if (error) {
    loansCache = [];
    return;
  }
  loansCache = (data || []).map((loan) => ({
    id: loan.id,
    userId: loan.user_id,
    bookId: loan.book_id,
    loanStatus: "대여 중",
    borrowedAt: loan.borrowed_at,
    dueDate: loan.due_at,
  }));
}

async function borrowBook(bookId) {
  const user = requireLogin();
  if (!user) return { success: false, redirected: true };
  if (user.role === "admin") {
    return { success: false, message: "관리자 계정은 도서를 대출할 수 없습니다." };
  }
  const book = getBookById(bookId);
  if (!book) return { success: false, message: "도서 정보를 찾을 수 없습니다." };
  if ((book.availableQuantity ?? (book.loanStatus === "대출 가능" ? 1 : 0)) < 1) {
    return { success: false, message: "현재 바로 대출할 수 없는 도서입니다." };
  }
  if (isLoaned(bookId)) {
    return { success: false, message: "이미 대여 목록에 있는 도서입니다." };
  }

  const { data, error } = await window.btlrSupabase.rpc("borrow_book", {
    target_book_id: bookId,
  });
  if (error) return { success: false, message: error.message };
  await Promise.all([loadUserLoansFromSupabase(), loadBooksFromSupabase()]);
  return {
    success: true,
    message: `대출이 완료되었습니다. 반납 예정일은 ${formatDate(data?.dueAt)}입니다.`,
  };
}

async function removeLoan(loanId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "로그인이 필요합니다." };
  const exists = getLoans().some(
    (loan) => loan.id === loanId && loan.userId === user.id,
  );
  if (!exists) return { success: false, message: "대여 정보를 찾을 수 없습니다." };
  const { error } = await window.btlrSupabase.rpc("return_book", {
    target_loan_id: loanId,
  });
  if (error) return { success: false, message: error.message };
  await Promise.all([loadUserLoansFromSupabase(), loadBooksFromSupabase()]);
  return { success: true, message: "도서를 반납했습니다." };
}

function isLoaned(bookId) {
  const user = getCurrentUser();
  if (!user) return false;
  return getLoans().some(
    (loan) => loan.userId === user.id && loan.bookId === bookId,
  );
}

function getReservations() {
  return [...reservationsCache];
}

async function loadUserReservationsFromSupabase() {
  const user = getCurrentUser();
  if (!user || !window.btlrSupabase) {
    reservationsCache = [];
    return;
  }

  const { data, error } = await window.btlrSupabase
    .from("book_reservations")
    .select("id, user_id, book_id, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    reservationsCache = [];
    return;
  }

  reservationsCache = (data || []).map((reservation) => ({
    id: reservation.id,
    userId: reservation.user_id,
    bookId: reservation.book_id,
    reservationStatus: "예약 완료",
    createdAt: reservation.created_at,
  }));
}

async function reserveBook(bookId) {
  const user = requireLogin();
  if (!user) return { success: false, redirected: true };
  if (user.role === "admin") {
    return { success: false, message: "관리자 계정은 도서를 예약할 수 없습니다." };
  }
  const book = getBookById(bookId);
  if (!book) return { success: false, message: "도서 정보를 찾을 수 없습니다." };
  if (isLoaned(bookId)) {
    return { success: false, message: "현재 본인이 대출 중인 도서는 예약할 수 없습니다." };
  }
  if (book.loanStatus === "대출 가능") {
    return { success: false, message: "현재 대출 가능한 도서입니다." };
  }
  if (isReserved(bookId)) {
    return { success: false, message: "이미 예약 신청한 도서입니다." };
  }
  if (getReservations().filter((reservation) => reservation.userId === user.id).length >= MAX_ACTIVE_BOOK_RESERVATIONS) {
    return { success: false, message: `도서 예약은 최대 ${MAX_ACTIVE_BOOK_RESERVATIONS}권까지 가능합니다.` };
  }

  const { error } = await window.btlrSupabase.rpc("reserve_book", {
    target_book_id: bookId,
  });
  if (error) return { success: false, message: error.message };
  await loadUserReservationsFromSupabase();
  return {
    success: true,
    message:
      "예약 신청이 완료되었습니다. 마이페이지에서 예약 현황을 확인할 수 있습니다.",
  };
}

async function cancelReservation(reservationId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "로그인이 필요합니다." };
  const exists = getReservations().some(
    (reservation) =>
      reservation.id === reservationId && reservation.userId === user.id,
  );
  if (!exists) {
    return { success: false, message: "예약 정보를 찾을 수 없습니다." };
  }
  const { error } = await window.btlrSupabase.rpc("cancel_book_reservation", {
    target_reservation_id: reservationId,
  });
  if (error) return { success: false, message: error.message };
  await loadUserReservationsFromSupabase();
  return { success: true, message: "예약을 취소했습니다." };
}

function isReserved(bookId) {
  const user = getCurrentUser();
  if (!user) return false;
  return getReservations().some(
    (reservation) =>
      reservation.userId === user.id && reservation.bookId === bookId,
  );
}

function renderAuthArea() {
  const user = getCurrentUser();
  document.body?.classList.toggle("has-admin-nav", user?.role === "admin");
  document.querySelectorAll("[data-auth-area]").forEach((container) => {
    if (user) {
      const adminLinks = user.role === "admin"
        ? '<a class="admin-link" href="admin.html#users">유저 관리</a><a class="admin-link" href="admin.html#books">도서 관리</a>'
        : "";
      container.innerHTML = `
        ${adminLinks}
        <a class="user-link" href="mypage.html" title="${escapeHTML(user.email)}">${escapeHTML(user.name)}님</a>
        <button class="logout-button" type="button" data-action="logout">로그아웃</button>
      `;
    } else {
      container.innerHTML = `
        <a href="login.html">로그인</a>
        <a class="signup-link" href="signup.html">회원가입</a>
      `;
    }
  });

  document.querySelectorAll(".main-nav .nav-inner").forEach((navigation) => {
    let readingRoomLink = navigation.querySelector(".reading-room-nav-link");
    if (!readingRoomLink) {
      readingRoomLink = document.createElement("a");
      readingRoomLink.className = "reading-room-nav-link";
      readingRoomLink.href = "reading-room.html";
      readingRoomLink.textContent = "열람실 예약";
      const myPageLink = navigation.querySelector('a[href="mypage.html"]');
      navigation.insertBefore(readingRoomLink, myPageLink || navigation.querySelector(".nav-message"));
    }
    readingRoomLink.classList.toggle("active", getCurrentPage() === "reading-room");

    const existingLink = navigation.querySelector(".request-nav-link");
    if (user?.role === "member" && !existingLink) {
      const link = document.createElement("a");
      link.className = "request-nav-link";
      link.href = "request.html";
      link.textContent = "도서 추가 요청";
      const myPageLink = navigation.querySelector('a[href="mypage.html"]');
      navigation.insertBefore(link, myPageLink || navigation.querySelector(".nav-message"));
    } else if (user?.role !== "member" && existingLink && getCurrentPage() !== "request") {
      existingLink.remove();
    }

    const adminNavigationItems = [
      { href: "admin.html#users", label: "회원 관리", section: "users" },
      { href: "admin.html#books", label: "도서 관리", section: "books" },
    ];

    if (user?.role === "admin") {
      adminNavigationItems.forEach((item, index) => {
        let link = navigation.querySelector(`[data-admin-nav="${item.section}"]`);
        if (!link) {
          link = document.createElement("a");
          link.dataset.adminNav = item.section;
          link.className = `admin-nav-link${index === 0 ? " admin-nav-first" : ""}`;
          link.href = item.href;
          link.innerHTML = `<span aria-hidden="true">${index === 0 ? "♙" : "▤"}</span>${item.label}`;
          navigation.insertBefore(link, navigation.querySelector(".nav-message"));
        }
      });
    } else {
      navigation.querySelectorAll(".admin-nav-link").forEach((link) => link.remove());
    }
  });

  updateAdminNavigationState();
}

function updateAdminNavigationState() {
  const activeSection = getCurrentPage() === "admin"
    ? window.location.hash === "#books" ? "books" : "users"
    : "";
  document.querySelectorAll("[data-admin-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.adminNav === activeSection);
  });
}

window.addEventListener("hashchange", updateAdminNavigationState);

function handleGlobalActions() {
  document.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;

    const action = trigger.dataset.action;
    const bookId = trigger.dataset.bookId;
    let result = null;

    if (action === "logout") {
      await logoutUser();
      window.location.href = "index.html";
      return;
    }

    if (action === "favorite") {
      result = isFavorite(bookId)
        ? removeFavorite(bookId)
        : addFavorite(bookId);
    }

    if (action === "borrow") {
      result = await borrowBook(bookId);
    }

    if (action === "remove-favorite") {
      result = removeFavorite(bookId);
    }

    if (action === "remove-loan") {
      result = await removeLoan(trigger.dataset.recordId);
    }

    if (action === "cancel-reservation") {
      result = await cancelReservation(trigger.dataset.recordId);
    }

    if (!result || result.redirected) return;
    showToast(result.message);

    const page = getCurrentPage();
    if (page === "mypage") {
      await initMyPage();
    } else if (page === "detail") {
      initDetailPage();
    } else {
      refreshRenderedCards();
    }
  });
}

function refreshRenderedCards() {
  document.querySelectorAll("[data-book-card]").forEach((card) => {
    const book = getBookById(card.dataset.bookCard);
    if (book) card.outerHTML = createBookCardMarkup(book);
  });
}

function initHomePage() {
  const featuredBooks = [
    getBookById("book-001"),
    getBookById("book-008"),
    getBookById("book-010"),
    getBookById("book-016"),
  ].filter(Boolean);
  renderBookCards(featuredBooks, document.getElementById("featured-books"));

  const availableCount = document.getElementById("available-count");
  if (availableCount) {
    availableCount.textContent = String(
      getBooks().filter((book) => book.loanStatus === "대출 가능").length,
    );
  }

  const heroSearch = document.querySelector(".hero-search");
  heroSearch?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = heroSearch.querySelector('input[name="q"]')?.value.trim() || "";
    if (!query) {
      showToast("검색어를 입력해 주세요.");
      return;
    }
    saveRecentSearch(query);
    window.location.href = `search.html?q=${encodeURIComponent(query)}`;
  });

  document.querySelectorAll("[data-keyword]").forEach((button) => {
    button.addEventListener("click", () => {
      const keyword = button.dataset.keyword;
      saveRecentSearch(keyword);
      window.location.href = `search.html?q=${encodeURIComponent(keyword)}`;
    });
  });

  const recentContainer = document.getElementById("recent-searches");
  renderRecentSearches(recentContainer);

  initHomeBookRequest();
}

async function initHomeBookRequest() {
  const actionPanel = document.getElementById("home-request-action");
  if (!actionPanel) return;

  const user = getCurrentUser();
  if (!user) {
    actionPanel.innerHTML = `
      <div class="home-request-gate">
        <strong>로그인 후 도서 추가를 요청할 수 있어요.</strong>
        <p>회원 계정으로 로그인하면 검색 결과에서 바로 요청할 수 있습니다.</p>
        <a class="button button-primary" href="login.html?next=index.html%23home-book-request">로그인하고 요청하기</a>
      </div>
    `;
    return;
  }

  if (user.role === "admin") {
    actionPanel.innerHTML = `
      <div class="home-request-gate">
        <strong>회원의 도서 추가 요청을 확인하세요.</strong>
        <p>관리자는 요청을 승인해 도서 목록에 바로 추가할 수 있습니다.</p>
        <a class="button button-primary" href="admin.html#books">요청 관리로 이동</a>
      </div>
    `;
    return;
  }

  document.getElementById("user-book-search-form")?.addEventListener("submit", searchBooksForUserRequest);
  document.getElementById("user-book-search-results")?.addEventListener("click", submitUserBookRequest);
  await loadMyBookRequests();
}

function initSearchPage() {
  let query = (getQueryParam("q") || "").trim();
  const categoryParam = getQueryParam("category") || "전체";
  const statusParam = getQueryParam("status") || "전체";
  const categoryFilter = document.getElementById("category-filter");
  const sortFilter = document.getElementById("sort-filter");
  const resetButton = document.getElementById("reset-filters");
  const emptyResetButton = document.getElementById("empty-reset");
  const headerInput = document.querySelector(".header-search input");

  if (headerInput) headerInput.value = query;
  populateCategoryFilter(categoryFilter, categoryParam);

  const statusRadio = document.querySelector(
    `input[name="loan-status"][value="${CSS.escape(statusParam)}"]`,
  );
  if (statusRadio) statusRadio.checked = true;

  if (query) saveRecentSearch(query);

  const updateResults = () => {
    const category = categoryFilter?.value || "전체";
    const loanStatus =
      document.querySelector('input[name="loan-status"]:checked')?.value ||
      "전체";
    const sortOption = sortFilter?.value || "default";

    let books = searchBooks(query, getBooks());
    books = filterBooks(books, { category, loanStatus });
    books = sortBooks(books, sortOption);

    const title = document.getElementById("search-title");
    const count = document.getElementById("result-count");
    const activeQuery = document.getElementById("active-query");
    const results = document.getElementById("search-results");
    const empty = document.getElementById("search-empty");

    if (title) {
      title.textContent = query ? `“${query}” 검색 결과` : "전체 도서";
    }
    if (count) count.textContent = String(books.length);
    if (activeQuery) {
      activeQuery.hidden = !query;
      activeQuery.innerHTML = query
        ? `<span>검색어 “${escapeHTML(query)}”와 선택한 조건을 함께 적용 중입니다.</span><a href="search.html">검색어 지우고 전체 도서 보기</a>`
        : "";
    }
    if (results) results.hidden = books.length === 0;
    if (empty) empty.hidden = books.length !== 0;
    renderBookCards(books, results);
  };

  categoryFilter?.addEventListener("change", () => {
    // 카테고리를 직접 바꾸면 이전 텍스트 검색은 끝난 것으로 처리합니다.
    // 검색어와 새 카테고리가 의도치 않게 동시에 적용되어 결과가 사라지는 일을 막습니다.
    if (query) {
      query = "";
      if (headerInput) headerInput.value = "";
    }
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("q");
    if (categoryFilter.value === "전체") nextUrl.searchParams.delete("category");
    else nextUrl.searchParams.set("category", categoryFilter.value);
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    updateResults();
  });
  sortFilter?.addEventListener("change", updateResults);
  document
    .querySelectorAll('input[name="loan-status"]')
    .forEach((radio) => radio.addEventListener("change", updateResults));

  const resetFilters = () => {
    if (query) {
      window.location.href = "search.html";
      return;
    }
    if (categoryFilter) categoryFilter.value = "전체";
    const allStatus = document.querySelector(
      'input[name="loan-status"][value="전체"]',
    );
    if (allStatus) allStatus.checked = true;
    if (sortFilter) sortFilter.value = "default";
    updateResults();
  };

  resetButton?.addEventListener("click", resetFilters);
  emptyResetButton?.addEventListener("click", resetFilters);
  updateResults();
}

function populateCategoryFilter(select, selectedCategory = "전체") {
  if (!select) return;

  const categories = [...new Set(
    getBooks()
      .map((book) => String(book.category || "").trim())
      .filter(Boolean),
  )].sort((first, second) => first.localeCompare(second, "ko"));

  select.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "전체";
  allOption.textContent = `전체 카테고리 (${getBooks().length}권)`;
  select.append(allOption);

  categories.forEach((category) => {
    const count = getBooks().filter((book) => book.category === category).length;
    const option = document.createElement("option");
    option.value = category;
    option.textContent = `${category} (${count}권)`;
    select.append(option);
  });

  if (selectedCategory !== "전체" && !categories.includes(selectedCategory)) {
    const option = document.createElement("option");
    option.value = selectedCategory;
    option.textContent = `${selectedCategory} (0권)`;
    select.append(option);
  }
  select.value = selectedCategory || "전체";
}

function initDetailPage() {
  const container = document.getElementById("book-detail");
  if (!container) return;
  const book = getBookById(getQueryParam("id"));

  if (!book) {
    container.innerHTML = `
      <div class="not-found">
        <span>?</span>
        <h1>도서 정보를 찾을 수 없어요</h1>
        <p>주소가 올바른지 확인하거나 전체 도서에서 다시 찾아보세요.</p>
        <a class="button button-primary" href="search.html">전체 도서 보기</a>
      </div>
    `;
    return;
  }

  document.title = `${book.title} | BOOK TO LEARN & RUN`;
  const favorite = isFavorite(book.id);
  const loaned = isLoaned(book.id);
  const actionButton = getCurrentUser()?.role === "admin"
    ? '<button class="button button-primary is-disabled" type="button" disabled>관리자 계정은 대출할 수 없습니다</button>'
    : loaned
      ? '<button class="button button-primary is-disabled" type="button" disabled>현재 대여 중</button>'
    : (book.availableQuantity ?? (book.loanStatus === "대출 가능" ? 1 : 0)) > 0
      ? `<button class="button button-primary" type="button" data-action="borrow" data-book-id="${book.id}">대출하기</button>`
      : `<a class="button button-primary" href="reserve.html?id=${encodeURIComponent(book.id)}">예약 신청</a>`;

  container.innerHTML = `
    <article class="detail-panel">
      <div class="detail-cover-area">
        <button class="detail-cover-button" type="button" data-cover-open aria-label="${escapeHTML(book.title)} 표지 크게 보기">
          <img src="${escapeHTML(book.thumbnail)}" alt="${escapeHTML(book.title)} 표지" onerror="this.outerHTML='<span class=&quot;cover-fallback&quot; aria-label=&quot;표지 이미지 없음&quot;>B</span>'" />
        </button>
      </div>
      <div class="detail-content">
        <div class="detail-topline">
          <span class="detail-category">${escapeHTML(book.category.toUpperCase())}</span>
          <span class="status-badge ${getStatusClass(book.loanStatus)}">${escapeHTML(book.loanStatus)}</span>
        </div>
        <h1>${escapeHTML(book.title)}</h1>
        <p class="detail-author">${escapeHTML(book.author)} 지음 · ${escapeHTML(book.publisher)}</p>
        <p class="detail-description">${escapeHTML(book.description)}</p>
        <div class="keyword-list">${book.keywords.map((keyword) => `<span>#${escapeHTML(keyword)}</span>`).join("")}</div>
        <dl class="detail-meta">
          <div><dt>출판사</dt><dd>${escapeHTML(book.publisher)}</dd></div>
          <div><dt>출판일</dt><dd>${formatDate(book.publishedDate)}</dd></div>
          <div><dt>카테고리</dt><dd>${escapeHTML(book.category)}</dd></div>
          <div><dt>대출 가능 수량</dt><dd>${book.availableQuantity ?? 1} / ${book.totalQuantity ?? 1}권</dd></div>
        </dl>
        ${book.returnDate ? `<p class="return-notice">예상 반납일 ${formatDate(book.returnDate)} · 반납 후 순차적으로 이용할 수 있습니다.</p>` : ""}
        <div class="detail-actions">
          <button class="button button-secondary favorite-detail ${favorite ? "active" : ""}" type="button" data-action="favorite" data-book-id="${book.id}" aria-pressed="${favorite}">${favorite ? "♥ 찜 취소" : "♡ 찜하기"}</button>
          ${actionButton}
        </div>
        <a class="back-link" href="search.html">← 검색 결과로 돌아가기</a>
      </div>
    </article>
  `;

  const coverButton = container.querySelector("[data-cover-open]");
  const coverLightbox = document.getElementById("cover-lightbox");
  const coverLightboxImage = document.getElementById("cover-lightbox-image");
  const closeCoverLightbox = () => {
    if (coverLightbox?.open) coverLightbox.close();
  };

  coverButton?.addEventListener("click", () => {
    if (!coverLightbox || !coverLightboxImage) return;
    coverLightboxImage.src = book.thumbnail;
    coverLightboxImage.alt = `${book.title} 표지 확대 이미지`;
    coverLightbox.showModal();
  });
  coverLightbox?.querySelector("[data-cover-close]")?.addEventListener("click", closeCoverLightbox);
  coverLightbox?.addEventListener("click", (event) => {
    if (event.target === coverLightbox) closeCoverLightbox();
  });

  const related = getBooks()
    .filter((item) => item.id !== book.id && item.category === book.category)
    .slice(0, 4);
  const relatedSection = document.getElementById("related-section");
  if (related.length && relatedSection) {
    relatedSection.hidden = false;
    renderBookCards(related, document.getElementById("related-books"));
  } else if (relatedSection) {
    relatedSection.hidden = true;
  }
}

function initReservePage() {
  const user = requireLogin();
  if (!user) return;

  const container = document.getElementById("reserve-content");
  if (!container) return;
  const book = getBookById(getQueryParam("id"));

  if (!book) {
    container.innerHTML = `
      <div class="not-found">
        <span>?</span><h1>예약할 도서를 찾을 수 없어요</h1>
        <p>전체 도서 목록에서 다시 선택해 주세요.</p>
        <a class="button button-primary" href="search.html">전체 도서 보기</a>
      </div>
    `;
    return;
  }

  const alreadyReserved = isReserved(book.id);
  const loanedByUser = isLoaned(book.id);
  const isAdmin = getCurrentUser()?.role === "admin";
  const reservationLimitReached = getReservations().filter(
    (reservation) => reservation.userId === user.id,
  ).length >= MAX_ACTIVE_BOOK_RESERVATIONS;
  const canReserve = !isAdmin && !loanedByUser && book.loanStatus !== "대출 가능";

  container.innerHTML = `
    <div class="reserve-grid">
      <article class="reserve-book-card">
        <div class="reserve-book-summary">
          <img src="${escapeHTML(book.thumbnail)}" alt="${escapeHTML(book.title)} 표지" />
          <div>
            <span class="status-badge ${getStatusClass(book.loanStatus)}">${escapeHTML(book.loanStatus)}</span>
            <h2>${escapeHTML(book.title)}</h2>
            <p>${escapeHTML(book.author)} · ${escapeHTML(book.publisher)}</p>
          </div>
        </div>
        <dl class="reserve-info-list">
          <div><dt>예상 반납일</dt><dd>${book.returnDate ? formatDate(book.returnDate) : "현재 대출 가능"}</dd></div>
        </dl>
      </article>
      <aside class="reserve-guide">
        <p class="eyebrow">BEFORE RESERVATION</p>
        <h2>예약 전 확인해 주세요</h2>
        <ul>
          <li>같은 도서는 한 번만 예약할 수 있습니다.</li>
          <li>한 회원은 예약 중인 도서를 최대 ${MAX_ACTIVE_BOOK_RESERVATIONS}권까지 유지할 수 있습니다.</li>
          <li>대출 가능한 도서는 예약할 수 없습니다.</li>
          <li>예약 도서는 반납 순서와 예약 순번에 따라 이용할 수 있습니다.</li>
          <li>예약 현황과 취소는 마이페이지에서 관리할 수 있습니다.</li>
        </ul>
        ${
          isAdmin
            ? '<div class="available-guide">관리자 계정은 도서를 대출하거나 예약할 수 없습니다.</div>'
            : loanedByUser
            ? '<div class="available-guide">현재 본인이 대출 중인 도서입니다. 반납 후 다시 이용할 수 있습니다.</div><a class="button button-secondary button-full" href="mypage.html#loans-section" style="margin-top:8px">마이페이지에서 확인</a>'
            : reservationLimitReached && !alreadyReserved && book.loanStatus !== "대출 가능"
            ? `<div class="available-guide">도서 예약은 최대 ${MAX_ACTIVE_BOOK_RESERVATIONS}권까지 가능합니다. 기존 예약을 취소한 뒤 다시 신청해 주세요.</div><a class="button button-secondary button-full" href="mypage.html#reservations-section" style="margin-top:8px">예약 내역 확인</a>`
            : canReserve
            ? `
              <p class="reserve-message" id="reserve-message">${alreadyReserved ? "이미 예약 신청한 도서입니다." : ""}</p>
              <button class="button button-primary button-full" id="reserve-submit" type="button" ${alreadyReserved ? "disabled" : ""}>${alreadyReserved ? "예약 완료" : "예약 신청하기"}</button>
              ${alreadyReserved ? '<a class="button button-secondary button-full" href="mypage.html#reservations-section" style="margin-top:8px">마이페이지에서 확인</a>' : ""}
            `
            : `
              <div class="available-guide">현재 대출 가능한 도서입니다. 예약 대신 바로 대출할 수 있어요.</div>
              <button class="button button-primary button-full" type="button" data-action="borrow" data-book-id="${book.id}" style="margin-top:14px">대출하기</button>
            `
        }
      </aside>
    </div>
  `;

  document.getElementById("reserve-submit")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "예약 처리 중...";
    const result = await reserveBook(book.id);
    if (!result.success) {
      const message = document.getElementById("reserve-message");
      if (message) message.textContent = result.message;
      button.disabled = false;
      button.textContent = "예약 신청하기";
      return;
    }
    container.innerHTML = `
      <div class="reserve-complete">
        <div class="complete-icon">✓</div>
        <h2>예약 신청이 완료되었습니다.</h2>
        <p>마이페이지에서 예약 현황을 확인할 수 있습니다.</p>
        <a class="button button-primary" href="mypage.html#reservations-section">마이페이지로 이동</a>
        <a class="button button-secondary" href="detail.html?id=${encodeURIComponent(book.id)}">도서 상세 보기</a>
      </div>
    `;
  });
}

function initSignupPage() {
  if (getCurrentUser()) {
    window.location.href = "mypage.html";
    return;
  }

  const form = document.getElementById("signup-form");
  const message = document.getElementById("signup-message");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const formData = Object.fromEntries(new FormData(form).entries());
    const result = await signupUser(formData);
    if (submitButton) submitButton.disabled = false;
    if (message) {
      message.textContent = result.message;
      message.classList.toggle("success", result.success);
    }
    if (result.success) {
      form.reset();
      sessionStorage.setItem("btlr_signup_notice", result.message);
      window.setTimeout(() => {
        window.location.href = "login.html?joined=1";
      }, 900);
    }
  });
}

function initLoginPage() {
  if (getCurrentUser()) {
    window.location.href = getSafeNextUrl();
    return;
  }

  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");
  const notice = sessionStorage.getItem("btlr_login_notice");
  const signupNotice = sessionStorage.getItem("btlr_signup_notice");

  if (getQueryParam("joined") === "1" && message) {
    message.textContent = signupNotice || "회원가입이 완료되었습니다. 로그인해 주세요.";
    message.classList.add("success");
    sessionStorage.removeItem("btlr_signup_notice");
  } else if (notice && message) {
    message.textContent = notice;
    sessionStorage.removeItem("btlr_login_notice");
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const formData = new FormData(form);
    const result = await loginUser(
      formData.get("identifier"),
      formData.get("password"),
    );
    if (submitButton) submitButton.disabled = false;
    if (message) {
      message.textContent = result.message;
      message.classList.toggle("success", result.success);
    }
    if (result.success) {
      window.setTimeout(() => {
        window.location.href = getSafeNextUrl();
      }, 450);
    }
  });
}

async function initAdminPage() {
  const user = getCurrentUser();
  const pageMessage = document.getElementById("admin-page-message");
  const content = document.getElementById("admin-content");

  if (!user) {
    sessionStorage.setItem("btlr_login_notice", "관리자 로그인 후 이용할 수 있습니다.");
    window.location.href = `login.html?next=${encodeURIComponent("admin.html")}`;
    return;
  }
  if (user.role !== "admin") {
    if (pageMessage) pageMessage.textContent = "관리자만 접근할 수 있는 페이지입니다.";
    return;
  }

  if (content) content.hidden = false;
  await seedDefaultBooksIfEmpty();
  await Promise.all([
    renderAdminUsers(),
    renderAdminBooks(),
    renderAdminBookRequests(),
  ]);

  document.getElementById("refresh-users")?.addEventListener("click", renderAdminUsers);
  document.getElementById("refresh-book-requests")?.addEventListener("click", renderAdminBookRequests);
  document.getElementById("reset-book-create")?.addEventListener("click", resetAdminBookForm);
  document.getElementById("admin-book-form")?.addEventListener("submit", saveNewAdminBook);
  document.getElementById("admin-book-edit-form")?.addEventListener("submit", saveEditedAdminBook);
  document.getElementById("close-book-edit")?.addEventListener("click", closeAdminBookDialog);
  document.getElementById("cancel-book-edit")?.addEventListener("click", closeAdminBookDialog);
  document.getElementById("admin-user-list")?.addEventListener("click", handleAdminUserAction);
  document.getElementById("admin-book-list")?.addEventListener("click", handleAdminBookAction);
  document.getElementById("admin-book-list")?.addEventListener("click", handleAdminBookCoverSelection);
  document.getElementById("admin-book-list")?.addEventListener("change", handleAdminBookSelection);
  document.getElementById("admin-book-select-page")?.addEventListener("change", toggleAdminBookPageSelection);
  document.getElementById("admin-book-clear-selection")?.addEventListener("click", clearAdminBookSelection);
  document.getElementById("admin-book-delete-selected")?.addEventListener("click", deleteSelectedAdminBooks);
  document.getElementById("admin-user-pagination")?.addEventListener("click", handleAdminPagination);
  document.getElementById("admin-book-pagination")?.addEventListener("click", handleAdminPagination);
  document.getElementById("admin-book-request-list")?.addEventListener("click", handleAdminBookRequestAction);
  document.getElementById("book-import-search-form")?.addEventListener("submit", searchBooksForImport);
  document.getElementById("book-import-select-all")?.addEventListener("change", toggleAllImportBooks);
  document.getElementById("book-import-submit")?.addEventListener("click", importSelectedBooks);
  document.getElementById("curated-book-import")?.addEventListener("click", importCuratedCategoryBooks);
  document.getElementById("repair-book-categories")?.addEventListener("click", repairExistingBookCategories);
  document.querySelectorAll("#admin-book-form, #admin-book-edit-form").forEach(bindBookFormEnhancements);
  await restoreAdminBookDraft();
}

async function seedDefaultBooksIfEmpty() {
  if (!window.btlrSupabase) return;
  const { count, error } = await window.btlrSupabase
    .from("books")
    .select("id", { count: "exact", head: true });
  if (error || count !== 0) return;
  await window.btlrSupabase.from("books").insert(mockBooks.map(serializeBookForDatabase));
  await loadBooksFromSupabase();
}

async function renderAdminUsers() {
  const target = document.getElementById("admin-user-list");
  if (!target || !window.btlrSupabase) return;
  target.innerHTML = '<tr><td colspan="7">불러오는 중...</td></tr>';
  const { data, error } = await window.btlrSupabase.rpc("admin_list_users");
  if (error) {
    adminUsersCache = [];
    target.innerHTML = `<tr><td colspan="7">${escapeHTML(error.message)}</td></tr>`;
    renderAdminPagination("users", 0);
    return;
  }
  adminUsersCache = (data || []).filter(
    (member) => String(member.email || "").trim().toLocaleLowerCase() !== PRIMARY_ADMIN_EMAIL,
  );
  renderAdminUserPage();
}

function renderAdminUserPage() {
  const target = document.getElementById("admin-user-list");
  if (!target) return;
  if (!adminUsersCache.length) {
    target.innerHTML = '<tr><td colspan="7">가입한 회원이 없습니다.</td></tr>';
    renderAdminPagination("users", 0);
    return;
  }
  const totalPages = Math.ceil(adminUsersCache.length / ADMIN_PAGE_SIZE);
  adminUserPage = Math.min(Math.max(adminUserPage, 1), totalPages);
  const startIndex = (adminUserPage - 1) * ADMIN_PAGE_SIZE;
  const visibleMembers = adminUsersCache.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);
  target.innerHTML = visibleMembers.map((member) => `
    <tr>
      <td>${escapeHTML(member.login_id || "-")}</td>
      <td><input class="admin-name-input" type="text" value="${escapeHTML(member.name || "")}" maxlength="30" data-name-input="${member.user_id}" /></td>
      <td>${escapeHTML(member.email || "-")}</td>
      <td><select data-role-select="${member.user_id}"><option value="member" ${member.role === "member" ? "selected" : ""}>회원</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>부관리자</option></select></td>
      <td>${formatDate(member.created_at)}</td>
      <td>${formatDate(member.last_sign_in_at)}</td>
      <td><div class="admin-row-actions"><button class="table-action" type="button" data-admin-action="save-user" data-user-id="${member.user_id}">저장</button><button class="table-action danger" type="button" data-admin-action="delete-user" data-user-id="${member.user_id}" data-user-name="${escapeHTML(member.name || member.email || "회원")}">삭제</button></div></td>
    </tr>
  `).join("");
  renderAdminPagination("users", adminUsersCache.length);
}

function getAdminPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items = [];
  sortedPages.forEach((page, index) => {
    if (index > 0 && page - sortedPages[index - 1] > 1) items.push("ellipsis");
    items.push(page);
  });
  return items;
}

function renderAdminPagination(type, totalItems) {
  const target = document.getElementById(type === "users" ? "admin-user-pagination" : "admin-book-pagination");
  if (!target) return;
  const totalPages = Math.ceil(totalItems / ADMIN_PAGE_SIZE);
  if (totalPages <= 1) {
    target.replaceChildren();
    target.hidden = true;
    return;
  }

  const currentPage = type === "users" ? adminUserPage : adminBookPage;
  const pageItems = getAdminPaginationItems(currentPage, totalPages);
  target.hidden = false;
  target.innerHTML = `
    <button type="button" data-admin-page-type="${type}" data-admin-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>이전</button>
    ${pageItems.map((item) => item === "ellipsis"
      ? '<span class="admin-pagination-ellipsis" aria-hidden="true">…</span>'
      : `<button type="button" data-admin-page-type="${type}" data-admin-page="${item}" class="${item === currentPage ? "active" : ""}" ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`).join("")}
    <button type="button" data-admin-page-type="${type}" data-admin-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>다음</button>
  `;
}

function handleAdminPagination(event) {
  const button = event.target.closest("[data-admin-page]");
  if (!button || button.disabled) return;
  const nextPage = Number(button.dataset.adminPage);
  if (!Number.isInteger(nextPage) || nextPage < 1) return;
  if (button.dataset.adminPageType === "users") {
    adminUserPage = nextPage;
    renderAdminUserPage();
    document.getElementById("users")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  adminBookPage = nextPage;
  renderAdminBookPage();
  document.getElementById("admin-book-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleAdminUserAction(event) {
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const userId = button.dataset.userId;

  if (button.dataset.adminAction === "save-user") {
    const input = document.querySelector(`[data-name-input="${CSS.escape(userId)}"]`);
    const roleSelect = document.querySelector(`[data-role-select="${CSS.escape(userId)}"]`);
    const nextName = String(input?.value || "").trim().replace(/\s+/g, " ");
    if (!nextName) {
      showToast("이름을 입력해 주세요.");
      return;
    }
    button.disabled = true;
    const { error } = await window.btlrSupabase.rpc("admin_update_user", {
      target_user_id: userId,
      next_name: nextName,
      next_role: roleSelect?.value || "member",
    });
    button.disabled = false;
    showToast(error ? error.message : "회원 정보를 저장했습니다.");
    if (!error) await renderAdminUsers();
    return;
  }

  if (button.dataset.adminAction === "delete-user") {
    const userName = button.dataset.userName || "이 회원";
    if (!window.confirm(`${userName} 계정을 완전히 삭제할까요?`)) return;
    button.disabled = true;
    const { error } = await window.btlrSupabase.rpc("admin_delete_user", {
      target_user_id: userId,
    });
    button.disabled = false;
    showToast(error ? error.message : "회원 계정을 삭제했습니다.");
    if (!error) await renderAdminUsers();
    return;
  }

}

function normalizeBookIdentity(title, author) {
  return `${String(title || "").trim()}|${String(author || "").trim()}`
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ");
}

function normalizeBookIsbn(value) {
  const candidates = String(value || "")
    .split(/\s+/)
    .map((isbn) => isbn.replace(/[^0-9X]/gi, "").toUpperCase())
    .filter(Boolean);
  return candidates.find((isbn) => isbn.length === 13) || candidates[0] || "";
}

function getBookIsbn(book) {
  const directIsbn = normalizeBookIsbn(book?.isbn);
  if (directIsbn) return directIsbn;

  const importedId = String(book?.id || "").match(/^book-kakao-([0-9X]+)$/i)?.[1];
  return normalizeBookIsbn(importedId);
}

function getBookEditionIdentity(book) {
  const isbn = getBookIsbn(book);
  if (isbn) return `isbn:${isbn}`;

  return [
    "edition",
    normalizeBookIdentity(book?.title, book?.author),
    String(book?.publisher || "").trim().toLocaleLowerCase("ko-KR"),
    String(book?.publishedDate || "").slice(0, 10),
  ].join("|");
}

function createStableBookHash(value) {
  let hash = 2166136261;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createImportedBookId(book) {
  const isbn = normalizeBookIsbn(book.isbn);
  return isbn
    ? `book-kakao-${isbn}`
    : `book-kakao-${createStableBookHash(book.externalId || normalizeBookIdentity(book.title, book.author))}`;
}

function setBookImportMessage(message, success = false) {
  const target = document.getElementById("book-import-message");
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("success", success);
}

async function fetchExternalBooks(query, category, size, options = {}) {
  const { data: sessionData } = await window.btlrSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("로그인이 필요합니다.");

  const params = new URLSearchParams({
    query,
    category,
    size: String(size),
    enrich: options.enrich === false ? "0" : "1",
  });
  const response = await fetch(`/api/search-books?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "도서 검색에 실패했습니다.");
  return result;
}

function normalizeCuratedTitle(value) {
  return String(value || "")
    .toLocaleLowerCase("ko-KR")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function findCuratedBook(results, requestedTitle) {
  const target = normalizeCuratedTitle(requestedTitle);
  return results.find((book) => normalizeCuratedTitle(book.title) === target)
    || results.find((book) => normalizeCuratedTitle(book.title).startsWith(target))
    || results.find((book) => target.startsWith(normalizeCuratedTitle(book.title)))
    || null;
}

function setCuratedImportMessage(message, success = false) {
  const target = document.getElementById("curated-book-import-message");
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("success", success);
}

async function importCuratedCategoryBooks() {
  const button = document.getElementById("curated-book-import");
  if (!button || !window.btlrSupabase) return;
  const categoryCount = Object.keys(CURATED_CATEGORY_BOOKS).length;
  if (!window.confirm(`관심사 ${categoryCount}개에 추천 도서를 최대 5권씩 추가할까요? 이미 등록된 책은 건너뜁니다.`)) return;

  button.disabled = true;
  const originalText = button.textContent;
  const existingTitles = new Set(getBooks().map((book) => normalizeCuratedTitle(book.title)));
  const existingIds = new Set(getBooks().map((book) => book.id));
  const collectedTitles = new Set();
  const booksToInsert = [];
  const missingTitles = [];
  const entries = Object.entries(CURATED_CATEGORY_BOOKS);
  const totalTargets = entries.reduce((sum, [, titles]) => sum + titles.length, 0);
  let processed = 0;

  try {
    for (const [category, titles] of entries) {
      for (const title of titles) {
        processed += 1;
        button.textContent = `${processed}/${totalTargets} 검색 중`;
        setCuratedImportMessage(`${category} · '${title}'을(를) 카카오 도서 API에서 찾고 있습니다.`);

        if (existingTitles.has(normalizeCuratedTitle(title))) continue;

        try {
          const result = await fetchExternalBooks(title, category, 10, { enrich: false });
          const book = findCuratedBook(Array.isArray(result.books) ? result.books : [], title);
          if (!book) {
            missingTitles.push(title);
            continue;
          }

          const normalizedTitle = normalizeCuratedTitle(book.title);
          const importedId = createImportedBookId(book);
          if (
            existingTitles.has(normalizedTitle)
            || collectedTitles.has(normalizedTitle)
            || existingIds.has(importedId)
          ) continue;

          collectedTitles.add(normalizedTitle);
          booksToInsert.push(serializeBookForDatabase({
            id: importedId,
            title: book.title,
            author: book.author,
            publisher: book.publisher || "",
            publishedDate: book.publishedDate || null,
            category,
            keywords: [...new Set([category, ...(book.keywords || [])])].slice(0, 6),
            description: book.description || "",
            shortDescription: book.shortDescription || book.description || "",
            thumbnail: book.thumbnail || "",
            totalQuantity: 1,
            returnDate: null,
          }));
        } catch {
          missingTitles.push(title);
        }
      }
    }

    if (!booksToInsert.length) {
      setCuratedImportMessage("추가할 새 추천 도서가 없습니다. 이미 등록됐거나 검색 결과를 찾지 못했습니다.");
      return;
    }

    button.textContent = "Supabase 등록 중";
    const { error } = await window.btlrSupabase
      .from("books")
      .upsert(booksToInsert, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);

    await renderAdminBooks();
    setCuratedImportMessage(
      `${booksToInsert.length}권을 추가했습니다.${missingTitles.length ? ` 찾지 못한 도서 ${missingTitles.length}권은 건너뛰었습니다.` : ""}`,
      true,
    );
    showToast(`추천 도서 ${booksToInsert.length}권을 추가했습니다.`);
  } catch (error) {
    const message = error?.message || "추천 도서를 추가하지 못했습니다.";
    setCuratedImportMessage(message);
    showToast(message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function setBookCategoryRepairMessage(message, success = false) {
  const target = document.getElementById("book-category-repair-message");
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("success", success);
}

function isBookDescriptionIncomplete(book) {
  const description = String(book?.description || "").trim();
  if (!description || /(?:\.{2,}|…+)\s*$/.test(description)) return true;
  return !/[.!?。！？]["'”’」』)]?\s*$/.test(description);
}

function isLikelyComicBook(book) {
  const source = [
    book?.title,
    book?.author,
    book?.publisher,
    ...(Array.isArray(book?.keywords) ? book.keywords : []),
  ].join(" ");
  return /만화|코믹(?:스)?|manga|webtoon|웹툰|원피스|one\s*piece|죠죠|jojo|귀멸의\s*칼날|주술회전|슬램덩크|나루토|블리치|드래곤볼|진격의\s*거인|명탐정\s*코난|체인소\s*맨|스파이\s*패밀리|최애의\s*아이|오다\s*에이치로|아라키\s*히로히코/i.test(source);
}

function waitForBookRepair(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function requestBookRepairMetadata(book, accessToken) {
  const retryDelays = [1800, 4000];
  let lastError = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetch("/api/generate-book-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: book.title,
        author: book.author,
        publisher: book.publisher || "",
        publishedDate: book.publishedDate || "",
        description: book.description || "",
        shortDescription: book.shortDescription || "",
        category: isLikelyComicBook(book) && book.category !== "만화"
          ? ""
          : BOOK_CATEGORIES.includes(String(book.category || "").trim()) ? book.category : "",
      }),
    });
    const metadata = await response.json().catch(() => ({}));
    if (response.ok) return metadata;

    const error = new Error(metadata.message || `AI 요청 실패 (${response.status})`);
    error.status = response.status;
    error.retryable = metadata.retryable === true || [429, 502, 503].includes(response.status);
    lastError = error;
    if (!error.retryable || attempt === retryDelays.length) throw error;
    await waitForBookRepair(retryDelays[attempt]);
  }

  throw lastError || new Error("AI 도서 정리에 실패했습니다.");
}

async function repairExistingBookCategories() {
  const button = document.getElementById("repair-book-categories");
  if (!button || !window.btlrSupabase) return;

  const booksToRepair = getBooks().filter((book) => (
    !BOOK_CATEGORIES.includes(String(book.category || "").trim())
    || (book.category !== "만화" && isLikelyComicBook(book))
    || isBookDescriptionIncomplete(book)
  ));
  if (!booksToRepair.length) {
    setBookCategoryRepairMessage("정리할 도서 정보가 없습니다.", true);
    return;
  }
  if (!window.confirm(`분류가 잘못됐거나 설명이 잘린 도서 ${booksToRepair.length}권을 AI로 정리할까요?`)) return;

  const { data: sessionData } = await window.btlrSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    setBookCategoryRepairMessage("관리자 로그인이 필요합니다.");
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  let repairedCount = 0;
  const failures = [];
  let stoppedReason = "";
  let skippedCount = 0;
  let consecutiveFailures = 0;

  try {
    for (let index = 0; index < booksToRepair.length; index += 1) {
      const book = booksToRepair[index];
      button.textContent = `${index + 1}/${booksToRepair.length} 정리 중`;
      setBookCategoryRepairMessage(`'${book.title}'의 분류와 설명을 확인하고 있습니다.`);

      try {
        const metadata = await requestBookRepairMetadata(book, accessToken);
        if (!BOOK_CATEGORIES.includes(metadata.category)) throw new Error("올바른 카테고리를 받지 못했습니다.");

        const keywords = Array.isArray(metadata.keywords)
          ? [...new Set(metadata.keywords.map((keyword) => String(keyword).trim()).filter(Boolean))].slice(0, 6)
          : [];
        const { data, error } = await window.btlrSupabase
          .from("books")
          .update({
            category: metadata.category,
            keywords,
            description: String(metadata.description || "").trim(),
            short_description: String(metadata.shortDescription || "").trim(),
          })
          .eq("id", book.id)
          .select("id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error("도서 수정 권한이 없거나 해당 도서를 찾지 못했습니다.");
        repairedCount += 1;
        consecutiveFailures = 0;
      } catch (error) {
        const reason = error?.message || "알 수 없는 오류";
        failures.push({ title: book.title, reason });
        consecutiveFailures += 1;
        const permanentFailure = [400, 401, 403, 404].includes(error?.status)
          || /API.?키|환경변수|관리자 권한|model.*(?:not found|available)/i.test(reason);
        if (permanentFailure || consecutiveFailures >= 3) {
          stoppedReason = reason;
          skippedCount = booksToRepair.length - index - 1;
          break;
        }
      }

      // 무료 API의 분당 요청 제한을 피하기 위해 도서 사이에 간격을 둡니다.
      if (index < booksToRepair.length - 1) await waitForBookRepair(1200);
    }

    await renderAdminBooks();
    const firstFailure = failures[0];
    const failureSummary = stoppedReason || firstFailure?.reason || "";
    const message = failures.length
      ? `${repairedCount}권 정리, ${failures.length}권 실패${skippedCount ? `, ${skippedCount}권 미처리` : ""}${failureSummary ? ` — 원인: ${failureSummary}` : ""}`
      : `${repairedCount}권의 분류와 설명을 정리했습니다.`;
    setBookCategoryRepairMessage(message, failures.length === 0);
    showToast(message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function searchBooksForImport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form).entries());
  const query = String(values.query || "").trim();
  const category = String(values.category || "").trim();
  const size = Math.min(Math.max(Number(values.size) || 20, 1), 50);

  if (!query) {
    setBookImportMessage("검색어를 입력해 주세요.");
    return;
  }

  if (button) button.disabled = true;
  setBookImportMessage("카카오 도서 API에서 검색하고 있습니다...");

  try {
    const result = await fetchExternalBooks(query, category, size);

    adminBookImportResults = Array.isArray(result.books) ? result.books : [];
    renderBookImportResults(result.totalCount);
    setBookImportMessage(
      adminBookImportResults.length
        ? `${adminBookImportResults.length}권을 불러왔습니다. 추가할 도서를 선택해 주세요.`
        : "검색 결과가 없습니다. 다른 검색어를 입력해 주세요.",
      adminBookImportResults.length > 0,
    );
  } catch (error) {
    adminBookImportResults = [];
    renderBookImportResults(0);
    setBookImportMessage(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderBookImportResults(totalCount = 0) {
  const wrapper = document.getElementById("book-import-results-wrap");
  const target = document.getElementById("book-import-results");
  const count = document.getElementById("book-import-result-count");
  const selectAll = document.getElementById("book-import-select-all");
  if (!wrapper || !target) return;

  wrapper.hidden = adminBookImportResults.length === 0;
  if (count) {
    count.textContent = `검색 결과 ${adminBookImportResults.length}권 · 전체 검색 결과 ${Number(totalCount) || adminBookImportResults.length}권`;
  }
  if (selectAll) selectAll.checked = false;

  const existingEditions = new Set(
    getBooks().map(getBookEditionIdentity),
  );
  const existingIds = new Set(getBooks().map((book) => book.id));
  const resultEditions = new Set();

  target.innerHTML = adminBookImportResults.map((book, index) => {
    const editionIdentity = getBookEditionIdentity(book);
    const importedId = createImportedBookId(book);
    const alreadyExists =
      existingEditions.has(editionIdentity) ||
      existingIds.has(importedId) ||
      resultEditions.has(editionIdentity);
    resultEditions.add(editionIdentity);
    const existingLabel = getBookIsbn(book)
      ? "동일 ISBN 등록됨"
      : "동일 판본 등록됨";

    return `
      <label class="book-import-card ${alreadyExists ? "is-existing" : ""}">
        <input type="checkbox" value="${index}" data-import-book ${alreadyExists ? "disabled" : ""} />
        <span class="book-import-cover">
          ${book.thumbnail
            ? `<img src="${escapeHTML(book.thumbnail)}" alt="" loading="lazy" />`
            : '<span class="cover-fallback" aria-hidden="true">B</span>'}
        </span>
        <span class="book-import-copy">
          <strong>${escapeHTML(book.title)}</strong>
          <span>${escapeHTML(book.author)}${book.publisher ? ` · ${escapeHTML(book.publisher)}` : ""}</span>
          <small>${escapeHTML(book.publishedDate || "출판일 미상")} · ${escapeHTML(book.category || "기타")}</small>
          ${alreadyExists ? `<b>${existingLabel}</b>` : ""}
        </span>
      </label>
    `;
  }).join("");
}

function toggleAllImportBooks(event) {
  document
    .querySelectorAll("[data-import-book]:not(:disabled)")
    .forEach((checkbox) => {
      checkbox.checked = event.currentTarget.checked;
    });
}

async function importSelectedBooks() {
  const button = document.getElementById("book-import-submit");
  const selectedIndexes = [...document.querySelectorAll("[data-import-book]:checked")]
    .map((checkbox) => Number(checkbox.value))
    .filter(Number.isInteger);

  if (!selectedIndexes.length) {
    setBookImportMessage("추가할 도서를 한 권 이상 선택해 주세요.");
    return;
  }

  const existingEditions = new Set(
    getBooks().map(getBookEditionIdentity),
  );
  const existingIds = new Set(getBooks().map((book) => book.id));
  const pendingEditions = new Set();
  const booksToInsert = selectedIndexes
    .map((index) => adminBookImportResults[index])
    .filter(Boolean)
    .filter((book) => {
      const editionIdentity = getBookEditionIdentity(book);
      const importedId = createImportedBookId(book);
      if (
        existingEditions.has(editionIdentity) ||
        existingIds.has(importedId) ||
        pendingEditions.has(editionIdentity)
      ) {
        return false;
      }
      pendingEditions.add(editionIdentity);
      return true;
    })
    .map((book) => serializeBookForDatabase({
      id: createImportedBookId(book),
      title: book.title,
      author: book.author,
      publisher: book.publisher || "",
      publishedDate: book.publishedDate || null,
      category: book.category || "기타",
      keywords: Array.isArray(book.keywords) ? book.keywords : [],
      description: book.description || "",
      shortDescription: book.shortDescription || book.description || "",
      thumbnail: book.thumbnail || "",
      totalQuantity: 1,
      returnDate: null,
    }));

  if (!booksToInsert.length) {
    setBookImportMessage("선택한 도서는 모두 이미 등록되어 있습니다.");
    renderBookImportResults(adminBookImportResults.length);
    return;
  }

  if (button) button.disabled = true;
  setBookImportMessage(`${booksToInsert.length}권을 Supabase에 추가하고 있습니다...`);
  const { error } = await window.btlrSupabase.from("books").insert(booksToInsert);
  if (button) button.disabled = false;

  if (error) {
    setBookImportMessage(error.message);
    return;
  }

  await renderAdminBooks();
  renderBookImportResults(adminBookImportResults.length);
  setBookImportMessage(`${booksToInsert.length}권을 도서 목록에 추가했습니다.`, true);
}

async function renderAdminBookRequests() {
  const target = document.getElementById("admin-book-request-list");
  if (!target || !window.btlrSupabase) return;
  target.innerHTML = '<p class="admin-empty">요청 목록을 불러오는 중...</p>';

  const { data, error } = await window.btlrSupabase.rpc("admin_list_book_requests");
  if (error) {
    target.innerHTML = `<p class="admin-empty">${escapeHTML(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    target.innerHTML = '<div class="request-empty"><span>✓</span><strong>처리할 도서 요청이 없습니다.</strong></div>';
    return;
  }

  target.innerHTML = data.map((request) => `
    <article class="admin-request-card">
      <div class="admin-request-cover">
        ${request.thumbnail
          ? `<img src="${escapeHTML(request.thumbnail)}" alt="${escapeHTML(request.title)} 표지" />`
          : '<span class="cover-fallback" aria-hidden="true">B</span>'}
      </div>
      <div class="admin-request-copy">
        <span class="request-status status-pending">승인 대기</span>
        <h4>${escapeHTML(request.title)}</h4>
        <p>${escapeHTML(request.author)}${request.publisher ? ` · ${escapeHTML(request.publisher)}` : ""}</p>
        <small>${escapeHTML(request.category || "기타")} · 요청자 ${escapeHTML(request.requester_name || request.requester_login_id || request.requester_email || "회원")} · ${formatDate(request.requested_at)}</small>
      </div>
      <div class="admin-row-actions">
        <button class="table-action" type="button" data-book-request-action="approve" data-request-id="${request.request_id}">추가 승인</button>
        <button class="table-action danger" type="button" data-book-request-action="reject" data-request-id="${request.request_id}" data-request-title="${escapeHTML(request.title)}">거절</button>
      </div>
    </article>
  `).join("");
}

async function handleAdminBookRequestAction(event) {
  const button = event.target.closest("[data-book-request-action]");
  if (!button) return;
  const requestId = button.dataset.requestId;
  const action = button.dataset.bookRequestAction;

  if (action === "reject") {
    const title = button.dataset.requestTitle || "이 도서";
    if (!window.confirm(`'${title}' 추가 요청을 거절할까요?`)) return;
  }

  button.disabled = true;
  const functionName = action === "approve"
    ? "admin_approve_book_request"
    : "admin_reject_book_request";
  const { data, error } = await window.btlrSupabase.rpc(functionName, {
    target_request_id: requestId,
  });
  button.disabled = false;

  if (error) {
    showToast(error.message);
    return;
  }

  showToast(
    action === "approve"
      ? `'${data?.title || "요청 도서"}'를 도서 목록에 추가했습니다.`
      : "도서 추가 요청을 거절했습니다.",
  );
  await Promise.all([renderAdminBookRequests(), renderAdminBooks()]);
}

async function renderAdminBooks() {
  await loadBooksFromSupabase();
  renderAdminBookPage();
}

function renderAdminBookPage() {
  const target = document.getElementById("admin-book-list");
  if (!target) return;
  const books = getBooks();
  const existingIds = new Set(books.map((book) => book.id));
  [...adminSelectedBookIds].forEach((id) => {
    if (!existingIds.has(id)) adminSelectedBookIds.delete(id);
  });
  if (!books.length) {
    target.innerHTML = '<p class="admin-empty">등록된 도서가 없습니다.</p>';
    renderAdminPagination("books", 0);
    updateAdminBookBulkToolbar([]);
    return;
  }
  const totalPages = Math.ceil(books.length / ADMIN_PAGE_SIZE);
  adminBookPage = Math.min(Math.max(adminBookPage, 1), totalPages);
  const startIndex = (adminBookPage - 1) * ADMIN_PAGE_SIZE;
  const visibleBooks = books.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);
  target.innerHTML = visibleBooks.map((book) => `
    <article class="admin-book-row${adminSelectedBookIds.has(book.id) ? " is-selected" : ""}">
      <label class="admin-book-check" aria-label="${escapeHTML(book.title)} 선택"><input type="checkbox" data-admin-book-select value="${escapeHTML(book.id)}" ${adminSelectedBookIds.has(book.id) ? "checked" : ""} /></label>
      <button class="admin-book-cover-select" type="button" data-admin-book-cover-select aria-label="${escapeHTML(book.title)} 선택 또는 해제">
        <img src="${escapeHTML(book.thumbnail)}" alt="" onerror="this.hidden=true" />
      </button>
      <div class="admin-book-copy"><strong>${escapeHTML(book.title)}</strong><span>${escapeHTML(book.author)} · ${escapeHTML(book.publisher)}</span><small>${escapeHTML(book.id)} · ${escapeHTML(book.category)} · 재고 ${book.availableQuantity ?? 1}/${book.totalQuantity ?? 1}권</small></div>
      <div class="admin-row-actions"><button type="button" data-admin-book-action="edit" data-book-id="${escapeHTML(book.id)}">수정</button><button type="button" data-admin-book-action="delete" data-book-id="${escapeHTML(book.id)}">삭제</button></div>
    </article>
  `).join("");
  renderAdminPagination("books", books.length);
  updateAdminBookBulkToolbar(visibleBooks);
}

function getVisibleAdminBooks() {
  const books = getBooks();
  const startIndex = (adminBookPage - 1) * ADMIN_PAGE_SIZE;
  return books.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);
}

function updateAdminBookBulkToolbar(visibleBooks = getVisibleAdminBooks()) {
  const selectPage = document.getElementById("admin-book-select-page");
  const count = document.getElementById("admin-book-selected-count");
  const clearButton = document.getElementById("admin-book-clear-selection");
  const deleteButton = document.getElementById("admin-book-delete-selected");
  const selectedOnPage = visibleBooks.filter((book) => adminSelectedBookIds.has(book.id)).length;
  const hasSelection = adminSelectedBookIds.size > 0;

  if (selectPage) {
    selectPage.checked = visibleBooks.length > 0 && selectedOnPage === visibleBooks.length;
    selectPage.indeterminate = selectedOnPage > 0 && selectedOnPage < visibleBooks.length;
    selectPage.disabled = visibleBooks.length === 0;
  }
  if (count) count.textContent = `${adminSelectedBookIds.size}권 선택`;
  if (clearButton) clearButton.disabled = !hasSelection;
  if (deleteButton) deleteButton.disabled = !hasSelection;
}

function handleAdminBookSelection(event) {
  const checkbox = event.target.closest("[data-admin-book-select]");
  if (!checkbox) return;
  if (checkbox.checked) adminSelectedBookIds.add(checkbox.value);
  else adminSelectedBookIds.delete(checkbox.value);
  checkbox.closest(".admin-book-row")?.classList.toggle("is-selected", checkbox.checked);
  updateAdminBookBulkToolbar();
}

function handleAdminBookCoverSelection(event) {
  const coverButton = event.target.closest("[data-admin-book-cover-select]");
  if (!coverButton) return;
  const checkbox = coverButton.closest(".admin-book-row")?.querySelector("[data-admin-book-select]");
  if (!checkbox) return;
  checkbox.checked = !checkbox.checked;
  checkbox.dispatchEvent(new Event("change", { bubbles: true }));
}

function toggleAdminBookPageSelection(event) {
  getVisibleAdminBooks().forEach((book) => {
    if (event.currentTarget.checked) adminSelectedBookIds.add(book.id);
    else adminSelectedBookIds.delete(book.id);
  });
  renderAdminBookPage();
}

function clearAdminBookSelection() {
  adminSelectedBookIds.clear();
  renderAdminBookPage();
}

async function deleteSelectedAdminBooks() {
  const ids = [...adminSelectedBookIds];
  if (!ids.length || !window.btlrSupabase) return;
  if (!window.confirm(`선택한 도서 ${ids.length}권을 삭제할까요? 삭제한 도서는 복구할 수 없습니다.`)) return;

  const button = document.getElementById("admin-book-delete-selected");
  const originalText = button?.textContent || "선택 도서 삭제";
  if (button) {
    button.disabled = true;
    button.textContent = "삭제 중...";
  }

  try {
    for (let index = 0; index < ids.length; index += 50) {
      const { error } = await window.btlrSupabase
        .from("books")
        .delete()
        .in("id", ids.slice(index, index + 50));
      if (error) throw error;
    }
    adminSelectedBookIds.clear();
    showToast(`${ids.length}권을 삭제했습니다.`);
    await renderAdminBooks();
  } catch (error) {
    showToast(error?.message || "선택한 도서를 삭제하지 못했습니다.");
  } finally {
    if (button) button.textContent = originalText;
    updateAdminBookBulkToolbar();
  }
}

function resetAdminBookForm() {
  const form = document.getElementById("admin-book-form");
  form?.reset();
  if (form) {
    form.elements.thumbnail.value = "";
    form.elements.totalQuantity.value = "1";
    renderBookCoverPreview(form, "");
  }
  clearAdminBookDraft();
}

function getAdminBookDraftKey() {
  return `${ADMIN_BOOK_DRAFT_PREFIX}:${getCurrentUser()?.id || "unknown"}`;
}

function openAdminBookDraftDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ADMIN_BOOK_DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("covers")) {
        request.result.createObjectStore("covers");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setAdminBookDraftCover(file) {
  try {
    const database = await openAdminBookDraftDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("covers", "readwrite");
      const store = transaction.objectStore("covers");
      if (file) store.put(file, getAdminBookDraftKey());
      else store.delete(getAdminBookDraftKey());
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  } catch {
    // 브라우저가 파일 임시 저장을 제한해도 텍스트 초안 저장은 유지합니다.
  }
}

async function getAdminBookDraftCover() {
  try {
    const database = await openAdminBookDraftDatabase();
    const file = await new Promise((resolve, reject) => {
      const request = database.transaction("covers", "readonly")
        .objectStore("covers")
        .get(getAdminBookDraftKey());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return file;
  } catch {
    return null;
  }
}

function saveAdminBookDraft(form) {
  if (!form || form.id !== "admin-book-form") return;
  const fieldNames = [
    "title", "author", "publisher", "publishedDate", "category",
    "totalQuantity", "keywords", "shortDescription", "description",
  ];
  const values = Object.fromEntries(fieldNames.map((name) => [name, form.elements[name]?.value || ""]));
  try {
    localStorage.setItem(getAdminBookDraftKey(), JSON.stringify({
      values,
      autoFieldsOpen: Boolean(form.querySelector(".admin-auto-fields")?.open),
      savedAt: new Date().toISOString(),
    }));
  } catch {
    // 저장 공간이 차도 도서 작성 기능 자체는 계속 사용할 수 있습니다.
  }
}

async function restoreAdminBookDraft() {
  const form = document.getElementById("admin-book-form");
  if (!form) return;
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(getAdminBookDraftKey()) || "null");
  } catch {
    draft = null;
  }

  if (draft?.values) {
    Object.entries(draft.values).forEach(([name, value]) => {
      if (form.elements[name]) form.elements[name].value = value;
    });
    if (draft.autoFieldsOpen) form.querySelector(".admin-auto-fields")?.setAttribute("open", "");
  }

  const savedCover = await getAdminBookDraftCover();
  if (savedCover && form.elements.coverFile) {
    try {
      const file = savedCover instanceof File
        ? savedCover
        : new File([savedCover], savedCover.name || "book-cover.jpg", { type: savedCover.type || "image/jpeg" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      form.elements.coverFile.files = transfer.files;
      renderBookCoverPreview(form, URL.createObjectURL(file));
    } catch {
      // 파일 입력 복원이 제한된 브라우저에서는 텍스트 초안만 복원합니다.
    }
  }

  if (draft?.values || savedCover) {
    showBookFormMessage(form, "작성 중이던 도서 정보를 복원했습니다.", true);
  }
}

function clearAdminBookDraft() {
  try {
    localStorage.removeItem(getAdminBookDraftKey());
  } catch {
    // 삭제 실패는 저장 완료 처리에 영향을 주지 않습니다.
  }
  setAdminBookDraftCover(null);
}

function fillAdminBookForm(book, form) {
  if (!form) return;
  form.elements.originalId.value = book.id;
  if (form.elements.originalTotalQuantity) {
    form.elements.originalTotalQuantity.value = String(book.totalQuantity ?? 1);
  }
  form.elements.title.value = book.title;
  form.elements.author.value = book.author;
  form.elements.publisher.value = book.publisher || "";
  form.elements.publishedDate.value = book.publishedDate || "";
  form.elements.category.value = book.category || "";
  form.elements.totalQuantity.value = String(book.totalQuantity ?? 1);
  form.elements.thumbnail.value = book.thumbnail || "";
  form.elements.keywords.value = (book.keywords || []).join(", ");
  form.elements.shortDescription.value = book.shortDescription || "";
  form.elements.description.value = book.description || "";
  form.elements.coverFile.value = "";
  renderBookCoverPreview(form, book.thumbnail || "");
}

function bindBookFormEnhancements(form) {
  const fileInput = form.elements.coverFile;
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      renderBookCoverPreview(form, form.elements.thumbnail.value);
      if (form.id === "admin-book-form") setAdminBookDraftCover(null);
      return;
    }
    renderBookCoverPreview(form, URL.createObjectURL(file));
    if (form.id === "admin-book-form") setAdminBookDraftCover(file);
  });
  if (form.id === "admin-book-form") {
    form.addEventListener("input", () => saveAdminBookDraft(form));
    form.addEventListener("change", () => saveAdminBookDraft(form));
    form.querySelector(".admin-auto-fields")?.addEventListener("toggle", () => saveAdminBookDraft(form));
  }
  form.querySelector("[data-ai-fill]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const result = await fillBookMetadataWithAI(form);
    button.disabled = false;
    showBookFormMessage(form, result.message, result.success);
    if (result.success) saveAdminBookDraft(form);
  });
}

function renderBookCoverPreview(form, imageUrl) {
  const preview = form.querySelector("[data-cover-preview]");
  if (!preview) return;
  preview.innerHTML = imageUrl
    ? `<img src="${escapeHTML(imageUrl)}" alt="선택한 도서 표지 미리보기" />`
    : "<span>선택한 이미지 미리보기</span>";
}

function showBookFormMessage(form, messageText, success = false) {
  const isEdit = form.id === "admin-book-edit-form";
  const message = document.getElementById(isEdit ? "admin-book-edit-message" : "admin-book-message");
  if (!message) return;
  message.textContent = messageText || "";
  message.classList.toggle("success", success);
}

function needsBookMetadata(form) {
  return ["category", "keywords", "shortDescription", "description"]
    .some((name) => !String(form.elements[name]?.value || "").trim());
}

async function fillBookMetadataWithAI(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const title = String(values.title || "").trim();
  const author = String(values.author || "").trim();
  if (!title || !author) {
    return { success: false, message: "AI 자동 입력 전에 제목과 저자를 입력해 주세요." };
  }

  const { data: sessionData } = await window.btlrSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { success: false, message: "관리자 로그인이 필요합니다." };

  try {
    const response = await fetch("/api/generate-book-metadata", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title,
        author,
        publisher: String(values.publisher || "").trim(),
        publishedDate: values.publishedDate || "",
        category: String(values.category || "").trim(),
        description: String(values.description || "").trim(),
        shortDescription: String(values.shortDescription || "").trim(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "AI 자동 입력에 실패했습니다.");

    const fieldMap = {
      author: result.author,
      publisher: result.publisher,
      publishedDate: result.publishedDate,
      category: result.category,
      keywords: Array.isArray(result.keywords) ? result.keywords.join(", ") : result.keywords,
      shortDescription: result.shortDescription,
      description: result.description,
    };
    const shouldRepairClassification = !BOOK_CATEGORIES.includes(String(form.elements.category?.value || "").trim());
    const shouldRepairDescription = isBookDescriptionIncomplete({ description: form.elements.description?.value });
    Object.entries(fieldMap).forEach(([name, value]) => {
      const field = form.elements[name];
      const replaceInvalidClassification = shouldRepairClassification && (name === "category" || name === "keywords");
      const replaceIncompleteDescription = shouldRepairDescription && (name === "shortDescription" || name === "description");
      if (field && (!String(field.value || "").trim() || replaceInvalidClassification || replaceIncompleteDescription) && value) field.value = value;
    });
    form.querySelector(".admin-auto-fields")?.setAttribute("open", "");
    return { success: true, message: "AI가 빈 도서 정보를 채웠습니다. 저장 전에 확인해 주세요." };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

async function uploadBookCover(form, bookId) {
  const file = form.elements.coverFile?.files?.[0];
  if (!file) return { url: String(form.elements.thumbnail.value || "") };
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "표지 이미지는 JPG, JPEG, PNG, WEBP 파일만 사용할 수 있습니다." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "표지 이미지는 5MB 이하로 선택해 주세요." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${Date.now()}-${window.crypto.randomUUID()}.${extension}`;
  const filePath = `${bookId}/${fileName}`;
  const { error } = await window.btlrSupabase.storage
    .from("book-covers")
    .upload(filePath, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  const { data } = window.btlrSupabase.storage.from("book-covers").getPublicUrl(filePath);
  return { url: data.publicUrl };
}

function openAdminBookDialog(book) {
  const dialog = document.getElementById("book-edit-dialog");
  const form = document.getElementById("admin-book-edit-form");
  if (!dialog || !form) return;
  fillAdminBookForm(book, form);
  const message = document.getElementById("admin-book-edit-message");
  if (message) {
    message.textContent = "";
    message.classList.remove("success");
  }
  dialog.showModal();
}

function closeAdminBookDialog() {
  document.getElementById("book-edit-dialog")?.close();
}

function saveNewAdminBook(event) {
  event.preventDefault();
  return saveAdminBook(event.currentTarget, false);
}

function saveEditedAdminBook(event) {
  event.preventDefault();
  // 수정은 이벤트 대상이나 폼 ID를 추론하지 않고 수정 폼을 명시적으로 사용합니다.
  const form = document.getElementById("admin-book-edit-form");
  if (!form) return undefined;
  return saveAdminBook(form, true);
}

async function saveAdminBook(form, isEdit) {
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton?.textContent || "저장";

  // 빠른 연속 클릭이나 중복 이벤트로 같은 저장 요청이 두 번 실행되는 것을 막습니다.
  if (form.dataset.saving === "true") return;

  if (!form.reportValidity()) return;
  form.dataset.saving = "true";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = isEdit ? "저장 중..." : "추가 중...";
  }

  try {
    let values = Object.fromEntries(new FormData(form).entries());
    if (!String(values.title || "").trim() || !String(values.author || "").trim()) {
      throw new Error("제목과 저자를 입력해 주세요.");
    }

    const totalQuantity = Number(values.totalQuantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity < 1) {
      throw new Error("전체 수량은 1 이상의 정수로 입력해 주세요.");
    }

    // 새 도서만 빈 정보를 AI로 채웁니다. 기존 도서 수정은 AI 상태와 관계없이 저장합니다.
    if (!isEdit && needsBookMetadata(form)) {
      showBookFormMessage(form, "AI가 빈 도서 정보를 작성하고 있습니다...");
      const aiResult = await fillBookMetadataWithAI(form);
      if (!aiResult.success) throw new Error(aiResult.message);
      saveAdminBookDraft(form);
      values = Object.fromEntries(new FormData(form).entries());
    }

    const originalId = isEdit ? String(values.originalId || "").trim() : "";
    if (isEdit && !originalId) throw new Error("수정할 도서 ID를 찾을 수 없습니다.");
    // 새 도서는 폼의 숨겨진 값이나 시간값을 재사용하지 않고 항상 고유 UUID를 사용합니다.
    // 수정 도서는 기존 기본키를 그대로 조회 조건에만 사용합니다.
    const generatedId = isEdit ? originalId : `book-${window.crypto.randomUUID()}`;

    const coverResult = await uploadBookCover(form, generatedId);
    if (coverResult.error) throw new Error(coverResult.error);

    const book = {
      id: generatedId,
      title: String(values.title || "").trim(),
      author: String(values.author || "").trim(),
      publisher: String(values.publisher || "").trim(),
      publishedDate: values.publishedDate || null,
      category: String(values.category || "기타").trim(),
      keywords: String(values.keywords || "").split(",").map((item) => item.trim()).filter(Boolean),
      description: String(values.description || "").trim(),
      shortDescription: String(values.shortDescription || "").trim(),
      thumbnail: coverResult.url,
      totalQuantity,
      loanStatus: "대출 가능",
    };
    const payload = serializeBookForDatabase(book);
    let result;
    if (isEdit) {
      // 기본키는 수정 대상 검색에만 사용하고 UPDATE 값에서는 제외합니다.
      // 기존 도서를 다시 INSERT하는 경로가 없어 books_pkey 중복 오류가 발생하지 않습니다.
      const { id: _ignoredId, total_quantity: nextTotalQuantity, ...updatePayload } = payload;
      const originalTotalQuantity = Number(values.originalTotalQuantity);
      // 수량이 그대로인 일반 정보 수정은 재고 동기화 트리거를 호출하지 않습니다.
      if (nextTotalQuantity !== originalTotalQuantity) {
        updatePayload.total_quantity = nextTotalQuantity;
      }
      result = await window.btlrSupabase
        .from("books")
        .update(updatePayload)
        .eq("id", originalId)
        .select("id")
        .maybeSingle();
    } else {
      result = await window.btlrSupabase.from("books").insert(payload).select("id").single();
    }

    if (result.error) throw result.error;
    if (isEdit && !result.data) throw new Error("수정할 도서를 찾지 못했거나 수정 권한이 없습니다.");

    const successMessage = isEdit ? "도서 정보를 수정했습니다." : "도서를 추가했습니다.";
    showBookFormMessage(form, successMessage, true);
    showToast(successMessage);
    if (isEdit) closeAdminBookDialog();
    else resetAdminBookForm();
    await renderAdminBooks();
  } catch (error) {
    const message = error?.details
      ? `${error.message} (${error.details})`
      : (error?.message || "도서 정보를 저장하지 못했습니다.");
    showBookFormMessage(form, message);
  } finally {
    delete form.dataset.saving;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

async function handleAdminBookAction(event) {
  const button = event.target.closest("[data-admin-book-action]");
  if (!button) return;
  const book = getBookById(button.dataset.bookId);
  if (!book) return;
  if (button.dataset.adminBookAction === "edit") {
    openAdminBookDialog(book);
    return;
  }
  if (!window.confirm(`'${book.title}' 도서를 삭제할까요?`)) return;
  const { error } = await window.btlrSupabase.from("books").delete().eq("id", book.id);
  showToast(error ? error.message : "도서를 삭제했습니다.");
  if (!error) {
    booksCache = booksCache.filter((item) => item.id !== book.id);
    await renderAdminBooks();
  }
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function initReadingRoomPage() {
  const user = requireLogin();
  if (!user) return;

  const content = document.getElementById("reading-room-content");
  if (!content) return;
  if (user.role === "admin") {
    content.innerHTML = `
      <div class="request-empty reading-room-gate">
        <span>!</span>
        <strong>관리자 계정은 열람실을 예약할 수 없습니다.</strong>
        <p>일반 회원 계정으로 로그인해 이용해 주세요.</p>
        <a class="button button-primary" href="index.html">홈으로 돌아가기</a>
      </div>
    `;
    return;
  }

  const dateInput = document.getElementById("reading-room-date");
  const startTimeInput = document.getElementById("reading-room-start-time");
  const endTimeInput = document.getElementById("reading-room-end-time");
  const seatGrid = document.getElementById("reading-room-seat-grid");
  const submitButton = document.getElementById("reading-room-submit");
  const message = document.getElementById("reading-room-message");
  let selectedSeats = new Set();
  let availability = [];
  let reservationStateLoaded = false;
  let hasUpcomingReservation = false;
  let reservationStateError = "";
  let availabilityRequestId = 0;

  const today = new Date();
  const firstDate = new Date(today);
  firstDate.setDate(firstDate.getDate() + 1);
  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + 14);
  dateInput.min = getLocalDateInputValue(firstDate);
  dateInput.max = getLocalDateInputValue(lastDate);
  dateInput.value = getLocalDateInputValue(firstDate);

  const parseTimeMinutes = (value) => {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  const formatTimeMinutes = (minutes) => {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const remainder = String(minutes % 60).padStart(2, "0");
    return `${hours}:${remainder}`;
  };

  const formatDuration = (durationMinutes) => {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  };

  const validateTimeRange = () => {
    const startMinutes = parseTimeMinutes(startTimeInput.value);
    const endMinutes = parseTimeMinutes(endTimeInput.value);
    if (startMinutes === null || endMinutes === null) {
      return { valid: false, message: "시작 시간과 종료 시간을 선택해 주세요." };
    }
    if (startMinutes < 6 * 60 || endMinutes > 22 * 60) {
      return { valid: false, message: "열람실 운영시간은 06:00부터 22:00까지입니다." };
    }
    const durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 2 * 60) {
      return { valid: false, message: "이용 시간은 최소 2시간 이상이어야 합니다." };
    }
    if (durationMinutes > 6 * 60) {
      return { valid: false, message: "이용 시간은 최대 6시간까지 선택할 수 있습니다." };
    }
    return { valid: true, startMinutes, endMinutes, durationMinutes };
  };

  const syncEndTimeRange = () => {
    const startMinutes = parseTimeMinutes(startTimeInput.value);
    if (startMinutes === null) return;
    const minimumEnd = Math.min(startMinutes + 2 * 60, 22 * 60);
    const maximumEnd = Math.min(startMinutes + 6 * 60, 22 * 60);
    endTimeInput.min = formatTimeMinutes(minimumEnd);
    endTimeInput.max = formatTimeMinutes(maximumEnd);
    const currentEnd = parseTimeMinutes(endTimeInput.value);
    if (currentEnd === null || currentEnd < minimumEnd || currentEnd > maximumEnd) {
      endTimeInput.value = formatTimeMinutes(Math.min(startMinutes + 3 * 60, maximumEnd));
    }
  };

  const setMessage = (text, success = false) => {
    message.textContent = text || "";
    message.classList.toggle("success", success);
  };

  const updateSubmitButton = () => {
    const selectedSeatNumbers = [...selectedSeats].sort((a, b) => a - b);
    const timeRange = validateTimeRange();
    if (!reservationStateLoaded) {
      submitButton.disabled = true;
      submitButton.textContent = "예약 상태 확인 중...";
      return;
    }
    if (hasUpcomingReservation) {
      submitButton.disabled = true;
      submitButton.textContent = "기존 예약을 먼저 취소해 주세요";
      return;
    }
    if (!timeRange.valid) {
      submitButton.disabled = true;
      submitButton.textContent = "이용 시간을 확인해 주세요";
      return;
    }
    submitButton.disabled = selectedSeatNumbers.length === 0;
    submitButton.textContent = selectedSeatNumbers.length
      ? `${selectedSeatNumbers.length}석 · ${formatDuration(timeRange.durationMinutes)} 예약하기`
      : `좌석을 최대 ${READING_ROOM_MAX_SELECTED_SEATS}개까지 선택해 주세요`;
  };

  const renderSeatButton = (seat, position) => {
    const seatNumber = Number(seat.seat_number);
    const occupied = Boolean(seat.is_reserved);
    const selected = selectedSeats.has(seatNumber);
    const locked = !reservationStateLoaded || hasUpcomingReservation;
    const disabled = occupied || locked;
    const stateLabel = occupied ? "예약 완료" : selected ? "선택됨" : locked ? "선택 불가" : "선택 가능";
    return `
      <button
        class="reading-room-seat is-${position}${occupied ? " is-occupied" : ""}${selected ? " is-selected" : ""}${locked && !occupied ? " is-locked" : ""}"
        type="button"
        data-room-seat="${seatNumber}"
        ${disabled ? "disabled" : ""}
        aria-pressed="${selected}"
        aria-label="${seatNumber}번 좌석, ${stateLabel}"
      ><span>${seatNumber}</span><small>${stateLabel}</small></button>
    `;
  };

  const renderSeats = () => {
    if (!availability.length) return;
    const seatsByNumber = new Map(availability.map((seat) => [Number(seat.seat_number), seat]));
    const renderZone = (zoneIndex) => {
      const firstTableIndex = zoneIndex * 5;
      const zoneName = zoneIndex === 0 ? "A" : "B";
      const tables = Array.from({ length: 5 }, (_, offset) => {
        const tableIndex = firstTableIndex + offset;
        const firstSeatNumber = tableIndex * 6 + 1;
        const topSeats = [0, 1, 2].map((seatOffset) => {
          const seatNumber = firstSeatNumber + seatOffset;
          return renderSeatButton(seatsByNumber.get(seatNumber) || { seat_number: seatNumber, is_reserved: false }, "top");
        }).join("");
        const bottomSeats = [3, 4, 5].map((seatOffset) => {
          const seatNumber = firstSeatNumber + seatOffset;
          return renderSeatButton(seatsByNumber.get(seatNumber) || { seat_number: seatNumber, is_reserved: false }, "bottom");
        }).join("");
        return `
          <article class="reading-room-table-unit" aria-label="${zoneName}-${offset + 1}번 책상">
            <div class="reading-room-chair-row is-top">${topSeats}</div>
            <div class="reading-room-tabletop" aria-hidden="true"><span>${zoneName}-${String(offset + 1).padStart(2, "0")}</span><i></i><i></i></div>
            <div class="reading-room-chair-row is-bottom">${bottomSeats}</div>
          </article>
        `;
      }).join("");
      const startSeat = firstTableIndex * 6 + 1;
      const endSeat = startSeat + 29;
      return `
        <section class="reading-room-zone" aria-label="${zoneName} 열람 구역 ${startSeat}번부터 ${endSeat}번 좌석">
          <header><strong>${zoneName} 열람 구역</strong><span>${startSeat}–${endSeat}</span></header>
          <div class="reading-room-table-grid">${tables}</div>
        </section>
      `;
    };
    seatGrid.innerHTML = `${renderZone(0)}<div class="reading-room-center-aisle" aria-hidden="true"><span>중앙 통로</span></div>${renderZone(1)}`;
  };

  const loadAvailability = async () => {
    const requestId = ++availabilityRequestId;
    selectedSeats = new Set();
    updateSubmitButton();
    const timeRange = validateTimeRange();
    if (!timeRange.valid) {
      availability = [];
      seatGrid.innerHTML = `<div class="request-empty compact reading-room-seat-error"><strong>이용 시간을 확인해 주세요.</strong><p>${escapeHTML(timeRange.message)}</p></div>`;
      setMessage(timeRange.message);
      return;
    }
    seatGrid.innerHTML = '<div class="request-empty compact reading-room-seat-error"><strong>좌석 배치를 불러오는 중입니다.</strong><p>선택한 시간과 겹치는 예약을 확인하고 있습니다.</p></div>';
    setMessage("좌석 현황을 불러오는 중입니다...");
    const { data, error } = await window.btlrSupabase.rpc("get_reading_room_availability", {
      target_date: dateInput.value,
      target_start_time: startTimeInput.value,
      target_end_time: endTimeInput.value,
    });
    if (requestId !== availabilityRequestId) return;
    if (error) {
      availability = [];
      seatGrid.innerHTML = '<div class="request-empty compact reading-room-seat-error"><strong>좌석 현황을 불러오지 못했습니다.</strong><p>데이터베이스 설정을 확인한 뒤 다시 시도해 주세요.</p></div>';
      setMessage(error.message);
      return;
    }
    availability = data || [];
    renderSeats();
    updateSubmitButton();
    const availableCount = availability.filter((seat) => !seat.is_reserved).length;
    if (reservationStateError) {
      setMessage(reservationStateError);
    } else if (hasUpcomingReservation) {
      setMessage("예정된 열람실 예약이 있습니다. 기존 예약을 취소한 뒤 새 좌석을 선택할 수 있습니다.");
    } else {
      setMessage(`${READING_ROOM_SEATS}석 중 ${availableCount}석이 비어 있습니다. 좌석을 최대 ${READING_ROOM_MAX_SELECTED_SEATS}개까지 선택하세요.`, true);
    }
  };

  const loadMyReadingRoomReservations = async () => {
    const target = document.getElementById("reading-room-reservation-list");
    target.innerHTML = '<p class="request-loading">예약 내역을 불러오는 중...</p>';
    const { data, error } = await window.btlrSupabase
      .from("reading_room_reservations")
      .select("id, reservation_group_id, seat_number, reservation_date, start_time, end_time, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("reservation_date", getLocalDateInputValue())
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      readingRoomReservationsCache = [];
      reservationStateLoaded = true;
      hasUpcomingReservation = true;
      reservationStateError = `예약 상태를 확인하지 못했습니다. ${error.message}`;
      target.innerHTML = `<p class="request-loading">${escapeHTML(error.message)}</p>`;
      selectedSeats = new Set();
      renderSeats();
      updateSubmitButton();
      return;
    }

    reservationStateError = "";
    const groupedReservations = new Map();
    (data || []).forEach((reservation) => {
      const groupId = reservation.reservation_group_id || reservation.id;
      if (!groupedReservations.has(groupId)) {
        groupedReservations.set(groupId, {
          id: reservation.id,
          groupId,
          reservationDate: reservation.reservation_date,
          startTime: String(reservation.start_time || "").slice(0, 5),
          endTime: String(reservation.end_time || "").slice(0, 5),
          seatNumbers: [],
        });
      }
      groupedReservations.get(groupId).seatNumbers.push(Number(reservation.seat_number));
    });
    readingRoomReservationsCache = [...groupedReservations.values()];
    reservationStateLoaded = true;
    hasUpcomingReservation = readingRoomReservationsCache.length > 0;
    if (hasUpcomingReservation) selectedSeats = new Set();
    renderSeats();
    updateSubmitButton();
    if (!readingRoomReservationsCache.length) {
      target.innerHTML = '<div class="request-empty compact"><span>⌑</span><strong>예정된 열람실 예약이 없습니다.</strong><p>원하는 날짜와 좌석을 선택해 보세요.</p></div>';
      return;
    }

    target.innerHTML = readingRoomReservationsCache.map((reservation) => {
      const seatNumbers = reservation.seatNumbers.sort((a, b) => a - b);
      const startMinutes = parseTimeMinutes(reservation.startTime);
      const endMinutes = parseTimeMinutes(reservation.endTime);
      const duration = startMinutes !== null && endMinutes !== null
        ? formatDuration(endMinutes - startMinutes)
        : "이용 시간 확인 필요";
      return `
      <article class="room-reservation-card">
        <div class="room-seat-number"><span>${seatNumbers.length}</span><small>석</small></div>
        <div><strong>${formatDate(reservation.reservationDate)}</strong><p>${escapeHTML(reservation.startTime)} - ${escapeHTML(reservation.endTime)} · ${escapeHTML(duration)}<br />좌석 ${seatNumbers.join(", ")}번</p></div>
        <button class="button button-secondary" type="button" data-cancel-room-reservation="${reservation.id}" data-reserved-seat-count="${seatNumbers.length}">전체 취소</button>
      </article>
    `;
    }).join("");
  };

  seatGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-room-seat]");
    if (!button || button.disabled) return;
    const seatNumber = Number(button.dataset.roomSeat);
    if (selectedSeats.has(seatNumber)) {
      selectedSeats.delete(seatNumber);
    } else if (selectedSeats.size >= READING_ROOM_MAX_SELECTED_SEATS) {
      setMessage(`좌석은 한 번에 최대 ${READING_ROOM_MAX_SELECTED_SEATS}개까지 선택할 수 있습니다.`);
      return;
    } else {
      selectedSeats.add(seatNumber);
    }
    renderSeats();
    updateSubmitButton();
    const selectedSeatNumbers = [...selectedSeats].sort((a, b) => a - b);
    setMessage(selectedSeatNumbers.length
      ? `${selectedSeatNumbers.join(", ")}번 좌석을 선택했습니다. (${selectedSeatNumbers.length}/${READING_ROOM_MAX_SELECTED_SEATS})`
      : `예약할 좌석을 최대 ${READING_ROOM_MAX_SELECTED_SEATS}개까지 선택해 주세요.`, true);
  });

  document.getElementById("reading-room-filter")?.addEventListener("change", (event) => {
    if (event.target === startTimeInput) syncEndTimeRange();
    if (event.target === dateInput || event.target === startTimeInput || event.target === endTimeInput) {
      loadAvailability();
    }
  });
  document.getElementById("refresh-reading-room")?.addEventListener("click", async () => {
    await loadMyReadingRoomReservations();
    await loadAvailability();
  });

  submitButton.addEventListener("click", async () => {
    const selectedSeatNumbers = [...selectedSeats].sort((a, b) => a - b);
    const timeRange = validateTimeRange();
    if (hasUpcomingReservation || !timeRange.valid || selectedSeatNumbers.length < 1 || selectedSeatNumbers.length > READING_ROOM_MAX_SELECTED_SEATS) return;
    submitButton.disabled = true;
    submitButton.textContent = "예약 처리 중...";
    const { error } = await window.btlrSupabase.rpc("reserve_reading_room_seats", {
      target_date: dateInput.value,
      target_start_time: startTimeInput.value,
      target_end_time: endTimeInput.value,
      target_seat_numbers: selectedSeatNumbers,
    });
    if (error) {
      setMessage(error.message);
      await loadMyReadingRoomReservations();
      await loadAvailability();
      return;
    }
    showToast(`${selectedSeatNumbers.length}석을 ${formatDuration(timeRange.durationMinutes)} 동안 예약했습니다.`);
    await loadMyReadingRoomReservations();
    await loadAvailability();
  });

  document.getElementById("reading-room-reservation-list")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-cancel-room-reservation]");
    if (!button) return;
    const seatCount = Number(button.dataset.reservedSeatCount) || 1;
    if (!window.confirm(`예약한 ${seatCount}개 좌석을 모두 취소할까요?`)) return;
    button.disabled = true;
    const { error } = await window.btlrSupabase.rpc("cancel_reading_room_reservation", {
      target_reservation_id: button.dataset.cancelRoomReservation,
    });
    showToast(error ? error.message : "열람실 예약을 취소했습니다.");
    if (!error) {
      await loadMyReadingRoomReservations();
      await loadAvailability();
    } else {
      button.disabled = false;
    }
  });

  syncEndTimeRange();
  updateSubmitButton();
  await loadMyReadingRoomReservations();
  await loadAvailability();
}

async function initBookRequestPage() {
  const user = requireLogin();
  if (!user) return;

  const searchPanel = document.querySelector(".request-search-panel");
  if (user.role === "admin") {
    if (searchPanel) {
      searchPanel.innerHTML = `
        <div class="request-empty">
          <span>!</span>
          <strong>관리자는 회원 요청을 관리하는 계정입니다.</strong>
          <p>관리자 페이지에서 회원의 도서 요청을 확인해 주세요.</p>
          <a class="button button-primary" href="admin.html#books">요청 관리로 이동</a>
        </div>
      `;
    }
    document.querySelector(".my-request-panel")?.setAttribute("hidden", "");
    return;
  }

  const form = document.getElementById("user-book-search-form");
  form?.addEventListener("submit", searchBooksForUserRequest);
  document.getElementById("user-book-search-results")?.addEventListener("click", submitUserBookRequest);
  document.getElementById("refresh-my-requests")?.addEventListener("click", loadMyBookRequests);
  await loadMyBookRequests();
}

function setUserBookSearchMessage(message, success = false) {
  const target = document.getElementById("user-book-search-message");
  if (!target) return;
  target.textContent = message || "";
  target.classList.toggle("success", success);
}

async function searchBooksForUserRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form).entries());
  const query = String(values.query || "").trim();
  const category = String(values.category || "").trim();
  const size = Math.min(Math.max(Number(values.size) || 20, 1), 30);

  if (!query) {
    setUserBookSearchMessage("검색어를 입력해 주세요.");
    return;
  }
  if (button) button.disabled = true;
  setUserBookSearchMessage("요청할 책을 검색하고 있습니다...");
  try {
    const result = await fetchExternalBooks(query, category, size);
    userBookSearchResults = Array.isArray(result.books) ? result.books : [];
    renderUserBookSearchResults();
    setUserBookSearchMessage(
      userBookSearchResults.length
        ? `${userBookSearchResults.length}권을 찾았습니다. 원하는 책을 요청해 주세요.`
        : "검색 결과가 없습니다. 다른 검색어로 찾아보세요.",
      userBookSearchResults.length > 0,
    );
  } catch (error) {
    userBookSearchResults = [];
    renderUserBookSearchResults();
    setUserBookSearchMessage(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function renderUserBookSearchResults() {
  const target = document.getElementById("user-book-search-results");
  if (!target) return;

  const existingEditions = new Set(
    getBooks().map(getBookEditionIdentity),
  );
  const pendingExternalIds = new Set(
    myBookRequestsCache
      .filter((request) => request.status === "pending")
      .map((request) => String(request.external_id || "").toLocaleLowerCase()),
  );
  const requestLimitReached = myBookRequestsCache.filter(
    (request) => request.status === "pending",
  ).length >= MAX_PENDING_BOOK_REQUESTS;

  target.innerHTML = userBookSearchResults.map((book, index) => {
    const alreadyExists = existingEditions.has(getBookEditionIdentity(book));
    const alreadyRequested = pendingExternalIds.has(String(book.externalId || "").toLocaleLowerCase());
    const disabled = alreadyExists || alreadyRequested || requestLimitReached;
    const buttonText = alreadyExists
      ? "이미 보유 중"
      : alreadyRequested
        ? "요청 완료"
        : requestLimitReached
          ? "요청 한도 도달"
          : "추가 요청";

    return `
      <article class="user-request-card ${disabled ? "is-disabled" : ""}">
        <div class="user-request-cover">
          ${book.thumbnail
            ? `<img src="${escapeHTML(book.thumbnail)}" alt="${escapeHTML(book.title)} 표지" loading="lazy" />`
            : '<span class="cover-fallback" aria-hidden="true">B</span>'}
        </div>
        <div class="user-request-copy">
          ${book.category ? `<span>${escapeHTML(book.category)}</span>` : ""}
          <h3>${escapeHTML(book.title)}</h3>
          <p>${escapeHTML(book.author)}${book.publisher ? ` · ${escapeHTML(book.publisher)}` : ""}</p>
        </div>
        <button class="button ${disabled ? "button-secondary is-disabled" : "button-primary"}" type="button" data-request-book-index="${index}" ${disabled ? "disabled" : ""}>${buttonText}</button>
      </article>
    `;
  }).join("");
}

async function submitUserBookRequest(event) {
  const button = event.target.closest("[data-request-book-index]");
  if (!button) return;
  const book = userBookSearchResults[Number(button.dataset.requestBookIndex)];
  if (!book) return;

  const pendingRequestCount = myBookRequestsCache.filter(
    (request) => request.status === "pending",
  ).length;
  if (pendingRequestCount >= MAX_PENDING_BOOK_REQUESTS) {
    setUserBookSearchMessage(`승인 대기 중인 도서 요청은 최대 ${MAX_PENDING_BOOK_REQUESTS}권까지 가능합니다.`);
    return;
  }

  button.disabled = true;
  button.textContent = "요청 중...";
  const { error } = await window.btlrSupabase.rpc("request_book_addition", {
    request_data: book,
  });

  if (error) {
    button.disabled = false;
    button.textContent = "추가 요청";
    setUserBookSearchMessage(error.message);
    return;
  }

  showToast("도서 추가 요청을 보냈습니다.");
  await loadMyBookRequests();
  renderUserBookSearchResults();
  setUserBookSearchMessage("관리자가 확인한 뒤 도서 목록에 추가합니다.", true);
}

async function loadMyBookRequests() {
  const target = document.getElementById("my-book-request-list");
  const user = getCurrentUser();
  if (!user || !window.btlrSupabase) return;
  if (target) target.innerHTML = '<p class="request-loading">요청 내역을 불러오는 중...</p>';

  const { data, error } = await window.btlrSupabase
    .from("book_requests")
    .select("id, external_id, title, author, publisher, thumbnail, status, requested_at, reviewed_at")
    .eq("requester_id", user.id)
    .order("requested_at", { ascending: false });

  if (error) {
    if (target) target.innerHTML = `<p class="request-loading">${escapeHTML(error.message)}</p>`;
    return;
  }

  myBookRequestsCache = data || [];
  if (target) renderMyBookRequests();
}

function renderMyBookRequests() {
  const target = document.getElementById("my-book-request-list");
  if (!target) return;
  if (!myBookRequestsCache.length) {
    target.innerHTML = '<div class="request-empty"><span>＋</span><strong>아직 요청한 도서가 없습니다.</strong><p>위 검색창에서 원하는 책을 찾아보세요.</p></div>';
    return;
  }

  const statusLabels = {
    pending: "승인 대기",
    approved: "추가 완료",
    rejected: "요청 거절",
  };
  target.innerHTML = myBookRequestsCache.map((request) => `
    <article class="my-request-card">
      <div class="my-request-cover">
        ${request.thumbnail
          ? `<img src="${escapeHTML(request.thumbnail)}" alt="" />`
          : '<span class="cover-fallback" aria-hidden="true">B</span>'}
      </div>
      <div>
        <span class="request-status status-${escapeHTML(request.status)}">${statusLabels[request.status] || request.status}</span>
        <strong>${escapeHTML(request.title)}</strong>
        <p>${escapeHTML(request.author)}${request.publisher ? ` · ${escapeHTML(request.publisher)}` : ""}</p>
        <small>요청일 ${formatDate(request.requested_at)}</small>
      </div>
    </article>
  `).join("");
}

function initMyPage() {
  const user = requireLogin();
  if (!user) return;

  renderAuthArea();
  const userSummary = document.getElementById("user-summary");
  if (userSummary) {
    userSummary.innerHTML = `
      <div class="welcome-copy">
        <p>MY READING DASHBOARD</p>
        <h1><em>${escapeHTML(user.name)}</em>님의<br />오늘의 서재</h1>
        <span>읽고 싶은 책과 이용 중인 도서를 한곳에서 관리하세요.</span>
      </div>
      <div class="user-card">
        <div class="user-avatar">${escapeHTML(user.name.slice(0, 1).toUpperCase())}</div>
        <div><strong>${escapeHTML(user.name)}</strong><span>${escapeHTML(user.email)}</span></div>
        <small>가입일 ${formatDate(user.createdAt || new Date())} · ${user.role === "admin" ? String(user.email).toLocaleLowerCase() === PRIMARY_ADMIN_EMAIL ? "최고 관리자" : "부관리자" : "도서관 회원"}</small>
      </div>
    `;
  }

  const nameForm = document.getElementById("profile-name-form");
  if (nameForm) {
    nameForm.elements.name.value = user.name;
    nameForm.onsubmit = updateMyName;
  }
  const passwordForm = document.getElementById("profile-password-form");
  if (passwordForm) passwordForm.onsubmit = updateMyPassword;

  const favorites = getFavorites()
    .filter((record) => record.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const loans = getLoans()
    .filter((record) => record.userId === user.id)
    .sort((a, b) => new Date(b.borrowedAt) - new Date(a.borrowedAt));
  const reservations = getReservations()
    .filter((record) => record.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  setText("favorite-count", favorites.length);
  setText("loan-count", loans.length);
  setText("reservation-count", reservations.length);

  renderMyList(
    "favorite-list",
    favorites,
    "favorite",
    "아직 찜한 도서가 없어요",
    "관심 있는 책을 찜하면 이곳에서 빠르게 찾을 수 있어요.",
  );
  renderMyList(
    "loan-list",
    loans,
    "loan",
    "현재 대여한 도서가 없어요",
    "대출 가능한 책을 찾아 나만의 독서 여정을 시작해 보세요.",
  );
  renderMyList(
    "reservation-list",
    reservations,
    "reservation",
    "예약한 도서가 없어요",
    "대출 중인 책을 예약하면 이곳에서 현황을 확인할 수 있어요.",
  );
}

async function updateMyName(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("profile-name-message");
  const nextName = String(new FormData(form).get("name") || "").trim().replace(/\s+/g, " ");
  if (!nextName || nextName.length > 30) {
    if (message) message.textContent = "이름은 1~30자로 입력해 주세요.";
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  const { error } = await window.btlrSupabase.rpc("update_my_name", { next_name: nextName });
  if (button) button.disabled = false;
  if (message) {
    message.textContent = error ? error.message : "이름을 변경했습니다.";
    message.classList.toggle("success", !error);
  }
  if (!error) {
    currentUserCache.name = nextName;
    renderAuthArea();
    initMyPage();
  }
}

async function updateMyPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("profile-password-message");
  const password = String(new FormData(form).get("password") || "");
  if (password.length < 8) {
    if (message) message.textContent = "새 비밀번호는 8자 이상 입력해 주세요.";
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  const { error } = await window.btlrSupabase.auth.updateUser({ password });
  if (button) button.disabled = false;
  if (message) {
    message.textContent = error ? error.message : "비밀번호를 변경했습니다.";
    message.classList.toggle("success", !error);
  }
  if (!error) form.reset();
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function renderMyList(containerId, records, type, emptyTitle, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!records.length) {
    container.innerHTML = `
      <div class="my-empty">
        <span>${type === "favorite" ? "♡" : type === "loan" ? "↗" : "⌚"}</span>
        <h3>${escapeHTML(emptyTitle)}</h3>
        <p>${escapeHTML(emptyText)}</p>
        <a class="button button-secondary" href="search.html">도서 검색하기</a>
      </div>
    `;
    return;
  }

  container.innerHTML = records
    .map((record) => {
      const book = getBookById(record.bookId);
      if (!book) return "";

      const config = {
        favorite: {
          status: "찜한 도서",
          statusClass: "status-reservable",
          dateLabel: "찜한 날",
          date: record.createdAt,
          action: "remove-favorite",
          actionText: "찜 취소",
        },
        loan: {
          status: record.loanStatus,
          statusClass: "status-my-loan",
          dateLabel: "반납 예정",
          date: record.dueDate,
          action: "remove-loan",
          actionText: "반납하기",
        },
        reservation: {
          status: record.reservationStatus,
          statusClass: "status-reserved",
          dateLabel: "신청일",
          date: record.createdAt,
          action: "cancel-reservation",
          actionText: "예약 취소",
        },
      }[type];

      return `
        <article class="my-book-item">
          <a href="detail.html?id=${encodeURIComponent(book.id)}"><img src="${escapeHTML(book.thumbnail)}" alt="${escapeHTML(book.title)} 표지" loading="lazy" /></a>
          <div class="my-book-info">
            <span class="status-badge ${config.statusClass}">${escapeHTML(config.status)}</span>
            <h3>${escapeHTML(book.title)}</h3>
            <p>${escapeHTML(book.author)} · ${escapeHTML(book.publisher)}</p>
            <div class="my-book-meta"><span>${config.dateLabel} ${formatDate(config.date)}</span></div>
          </div>
          <div class="my-book-actions">
            <a href="detail.html?id=${encodeURIComponent(book.id)}">상세 보기</a>
            <button type="button" data-action="${config.action}" data-book-id="${book.id}" data-record-id="${record.id}">${config.actionText}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", initApp);
