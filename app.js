"use strict";

const STORAGE_KEYS = {
  recentSearches: "btlr_recent_searches",
  favorites: "btlr_favorites",
  loans: "btlr_loans",
  reservations: "btlr_reservations",
};

/*
 * 도서 목록은 Supabase에서만 불러옵니다. 샘플 도서를 런타임에 자동으로
 * 삽입하거나 연결 오류를 샘플 데이터로 가리지 않습니다.
 */

let toastTimer = null;
let currentUserCache = null;
const HEADER_USER_CACHE_KEY = "btlr_header_user";
let booksCache = [];
let booksLoadState = "idle";
let booksLoadError = "";
let loansCache = [];
let reservationsCache = [];
let readingRoomReservationsCache = [];
let favoritesCache = [];
let loansLoadState = "idle";
let loansLoadError = "";
let reservationsLoadState = "idle";
let reservationsLoadError = "";
let favoritesLoadState = "idle";
let favoritesLoadError = "";
let adminBookImportResults = [];
let userBookSearchResults = [];
let myBookRequestsCache = [];
let inquiriesCache = [];
let adminUsersCache = [];
let adminBookRequestsCache = [];
let adminRoomReservationsCache = [];
let adminInquiriesCache = [];
let notificationsCache = [];
let notificationPollTimer = null;
let notificationRealtimeChannel = null;
let adminUserPage = 1;
let adminBookPage = 1;
let adminBookRequestPage = 1;
let adminRoomPage = 1;
let adminInquiryPage = 1;
let publicInquiryPage = 1;
let adminUserFilterState = { query: "", role: "all", sort: "newest" };
let adminBookRequestFilterState = { query: "", status: "all", sort: "newest" };
let adminRoomFilterState = { query: "", date: "", sort: "soonest" };
let adminInquiryFilterState = { query: "", status: "all", visibility: "all" };
let adminBookSearchQuery = "";
let adminBookSort = "newest";
const adminSelectedBookIds = new Set();
const ADMIN_PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 20;
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
  const cachedHeaderUser = getCachedHeaderUser();
  if (cachedHeaderUser) {
    currentUserCache = cachedHeaderUser;
  }

  await loadCurrentUser();
  renderAuthArea();
  await Promise.all([
    loadBooksFromSupabase(),
    loadUserLoansFromSupabase(),
    loadUserReservationsFromSupabase(),
    loadFavoritesFromSupabase(),
  ]);
  handleHeaderSearch();
  initAdminNavigationMenu();
  handleGlobalActions();
  initNotificationCenter();

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
    inquiry: initInquiryPage,
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

function createBookDetailUrl(bookId) {
  const params = new URLSearchParams({ id: String(bookId || "") });
  if (getCurrentPage() === "search") {
    params.set("from", getCurrentRelativeUrl());
  } else if (getCurrentPage() === "detail") {
    const returnUrl = getBookDetailReturnUrl();
    if (returnUrl !== "search.html") params.set("from", returnUrl);
  }
  return `detail.html?${params.toString()}`;
}

function getBookDetailReturnUrl() {
  const candidate = String(getQueryParam("from") || "").trim();
  return /^search\.html(?:[?#].*)?$/.test(candidate) ? candidate : "search.html";
}

function getFriendlyServiceError(error, fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.") {
  const rawMessage = String(error?.message || error || "").trim();
  const normalized = rawMessage.toLocaleLowerCase();
  if (!rawMessage) return fallback;
  if (/maximum|max_active|limit|too many/.test(normalized)) {
    if (/loan|대출/.test(normalized)) return "대출 가능한 최대 권수를 초과했습니다. 대출 중인 도서를 반납한 뒤 다시 시도해 주세요.";
    if (/reservation|예약/.test(normalized)) return `도서 예약은 최대 ${MAX_ACTIVE_BOOK_RESERVATIONS}권까지 가능합니다.`;
    if (/request|요청/.test(normalized)) return `도서 추가 요청은 답변 대기 기준 최대 ${MAX_PENDING_BOOK_REQUESTS}권까지 가능합니다.`;
  }
  if (/not available|no available|재고|stock/.test(normalized)) return "현재 대출 가능한 수량이 없습니다.";
  if (/already.*loan|already borrowed|이미.*대출/.test(normalized)) return "이미 대출 중인 도서입니다.";
  if (/already.*reserv|duplicate.*reserv|이미.*예약/.test(normalized)) return "이미 예약한 도서입니다.";
  if (/permission|row-level security|not authorized|forbidden/.test(normalized)) return "이 작업을 처리할 권한이 없습니다.";
  if (/admin_archive_book|admin_archive_books/.test(normalized) && /function|schema cache|not find/.test(normalized)) {
    return "도서 보관 삭제 기능이 데이터베이스에 아직 적용되지 않았습니다. 최신 Supabase SQL을 적용한 뒤 다시 시도해 주세요.";
  }
  if (/network|failed to fetch|load failed/.test(normalized)) return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  return rawMessage || fallback;
}

function getStatusClass(status) {
  const map = {
    "대출 가능": "status-available",
    "대출 중": "status-loaned",
    "예약 가능": "status-reservable",
    "예약 완료": "status-reserved",
    "대출 중": "status-my-loan",
  };
  return map[status] || "status-reservable";
}

function getBooks() {
  return booksCache.map((book) => ({
    ...book,
    keywords: [...book.keywords],
  }));
}

function normalizeBookKeywords(keywords, category = "") {
  const normalizedCategory = String(category || "").trim().toLocaleLowerCase("ko-KR");
  const values = Array.isArray(keywords)
    ? keywords
    : String(keywords || "").split(",");
  return [...new Set(values
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean)
    .filter((keyword) => keyword.toLocaleLowerCase("ko-KR") !== normalizedCategory))]
    .slice(0, 8);
}

function getDescriptionFallback(book = {}) {
  const title = String(book.title || "이 도서").trim();
  const author = String(book.author || "저자 미상").trim();
  return `${author}의 『${title}』을 소개하는 도서입니다.`;
}

function normalizeCompleteBookText(value, book = {}, options = {}) {
  const fallback = String(options.fallback || getDescriptionFallback(book)).trim();
  const raw = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return fallback;

  if (/[.!?。！？]["'”’」』)]?\s*$/.test(raw)) return raw;
  const hasTrailingEllipsis = /(?:\.{2,}|…+)\s*$/.test(raw);
  const withoutTrailingEllipsis = hasTrailingEllipsis
    ? raw.replace(/(?:\.{2,}|…+)\s*$/, "").trim()
    : raw;

  const sentenceEndPattern = /[.!?。！？]["'”’」』)]?/g;
  let lastCompleteEnd = -1;
  for (const match of withoutTrailingEllipsis.matchAll(sentenceEndPattern)) {
    lastCompleteEnd = match.index + match[0].length;
  }
  if (hasTrailingEllipsis && lastCompleteEnd > 0) {
    return withoutTrailingEllipsis.slice(0, lastCompleteEnd).trim();
  }

  if (/(?:다|요|함|됨|임|한다|된다|있다|없다|준다|낸다|보인다|전한다|담았다|소개한다|살펴본다)$/u.test(withoutTrailingEllipsis)) {
    return `${withoutTrailingEllipsis}.`;
  }
  // API가 잘림표식을 주지 않은 원문은 손실을 막기 위해 임의로 자르거나
  // 일반 문구로 덮지 않습니다. 명백한 …/.. 표식인데 완결 문장이 없어도 원문을 보존합니다.
  return raw;
}

function getFirstCompleteSentence(value, book = {}) {
  const normalized = normalizeCompleteBookText(value, book);
  const match = normalized.match(/^.*?[.!?。！？]["'”’」』)]?(?:\s|$)/u);
  return (match?.[0] || normalized).trim();
}

function normalizeBookDescriptions(book = {}) {
  const description = normalizeCompleteBookText(book.description, book);
  let shortDescription = normalizeCompleteBookText(book.shortDescription || book.short_description, book, {
    fallback: getFirstCompleteSentence(description, book),
  });
  if (shortDescription === description || shortDescription.length > 240) {
    shortDescription = getFirstCompleteSentence(description, book);
  }
  return { description, shortDescription };
}

function getBookById(bookId) {
  return booksCache.find((book) => book.id === bookId) || null;
}

function mapDatabaseBook(book) {
  const totalQuantity = Math.max(Number(book.total_quantity) || 1, 1);
  const availableQuantity = Math.max(Math.min(Number(book.available_quantity) || 0, totalQuantity), 0);
  const rawDescription = String(book.description || "").trim();
  const rawShortDescription = String(book.short_description || "").trim();
  const normalizedDescriptions = normalizeBookDescriptions({
    title: book.title,
    author: book.author,
    description: rawDescription,
    shortDescription: rawShortDescription,
  });
  return {
    id: book.id,
    title: book.title || "제목 없음",
    author: book.author || "저자 미상",
    publisher: book.publisher || "",
    publishedDate: book.published_date || null,
    category: book.category || "기타",
    keywords: normalizeBookKeywords(book.keywords, book.category),
    originalKeywords: Array.isArray(book.keywords) ? book.keywords : [],
    description: normalizedDescriptions.description,
    shortDescription: normalizedDescriptions.shortDescription,
    originalDescription: rawDescription,
    originalShortDescription: rawShortDescription,
    descriptionNeedsRepair: isBookDescriptionIncomplete({ description: rawDescription }),
    thumbnail: book.thumbnail || "",
    totalQuantity,
    availableQuantity,
    loanStatus: availableQuantity > 0 ? "대출 가능" : "대출 중",
    returnDate: book.return_date || null,
    createdAt: book.created_at || new Date().toISOString(),
  };
}

function serializeBookForDatabase(book) {
  const normalizedDescriptions = normalizeBookDescriptions(book);
  const category = String(book.category || "기타").trim() || "기타";
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher || null,
    published_date: book.publishedDate || null,
    category,
    keywords: normalizeBookKeywords(book.keywords, category),
    description: normalizedDescriptions.description,
    short_description: normalizedDescriptions.shortDescription,
    thumbnail: book.thumbnail || null,
    total_quantity: Math.max(Number(book.totalQuantity) || 1, 1),
    return_date: book.returnDate || null,
  };
}

async function loadBooksFromSupabase() {
  booksLoadState = "loading";
  booksLoadError = "";
  if (!window.btlrSupabase) {
    booksCache = [];
    booksLoadState = "error";
    booksLoadError = "도서 데이터베이스에 연결할 수 없습니다.";
    return { success: false, message: booksLoadError };
  }
  const fields = "id, title, author, publisher, published_date, category, keywords, description, short_description, thumbnail, loan_status, return_date, total_quantity, available_quantity, created_at";
  let result = await window.btlrSupabase
    .from("books")
    .select(`${fields}, archived_at`)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const archivedColumnUnavailable = result.error
    && /archived_at|column.*not found|schema cache/i.test(`${result.error.code || ""} ${result.error.message || ""} ${result.error.details || ""}`);
  if (archivedColumnUnavailable) {
    result = await window.btlrSupabase
      .from("books")
      .select(fields)
      .order("created_at", { ascending: false });
  }
  const { data, error } = result;
  if (error) {
    booksCache = [];
    booksLoadState = "error";
    booksLoadError = getFriendlyServiceError(error, "도서 목록을 불러오지 못했습니다.");
    return { success: false, message: booksLoadError };
  }
  booksCache = (data || []).map(mapDatabaseBook);
  booksLoadState = booksCache.length ? "success" : "empty";
  return { success: true, empty: booksCache.length === 0 };
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
    const statusMatches = !filters.loanStatus || filters.loanStatus === "전체"
      ? true
      : filters.loanStatus === "예약 가능"
        ? Number(book.availableQuantity || 0) === 0
        : filters.loanStatus === "대출 가능"
          ? Number(book.availableQuantity || 0) > 0
          : filters.loanStatus === "대출 중"
            ? Number(book.availableQuantity || 0) === 0
            : book.loanStatus === filters.loanStatus;
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
  const readyForUser = isBookReadyForCurrentUser(book.id);
  const isAvailable = (book.availableQuantity ?? (book.loanStatus === "대출 가능" ? 1 : 0)) > 0;
  const mainAction = isAdminUser(user)
    ? '<button class="card-main-action is-disabled" type="button" disabled>관리자 계정</button>'
    : loanedByUser
      ? '<button class="card-main-action is-disabled" type="button" disabled>대출 중</button>'
    : readyForUser || isAvailable
      ? `<button class="card-main-action" type="button" data-action="borrow" data-book-id="${book.id}">${readyForUser ? "예약 도서 대출하기" : "대출하기"}</button>`
      : `<a class="card-main-action reserve-action" href="reserve.html?id=${encodeURIComponent(book.id)}">예약 신청</a>`;

  const detailUrl = createBookDetailUrl(book.id);
  return `
    <article class="book-card" data-book-card="${book.id}">
      <a class="book-cover-link" href="${escapeHTML(detailUrl)}" aria-label="${escapeHTML(book.title)} 상세 보기">
        <img class="book-cover" src="${escapeHTML(book.thumbnail)}" alt="${escapeHTML(book.title)} 표지" loading="lazy" onerror="this.outerHTML='<span class=&quot;cover-fallback&quot; aria-label=&quot;표지 이미지 없음&quot;>B</span>'" />
        <span class="book-status status-badge ${getStatusClass(book.loanStatus)}">${escapeHTML(book.loanStatus)}</span>
      </a>
      <div class="book-card-content">
        <span class="book-category">${escapeHTML(book.category.toUpperCase())}</span>
        <h3><a href="${escapeHTML(detailUrl)}">${escapeHTML(book.title)}</a></h3>
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
  const passwordConfirm = String(formData.passwordConfirm || "");

  if (!loginId || !name || !email || !password || !passwordConfirm) {
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
  if (password !== passwordConfirm) {
    return { success: false, message: "비밀번호와 비밀번호 확인이 일치하지 않습니다." };
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

  let response;
  try {
    response = await fetch("/api/login-by-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: normalizedIdentifier, password: String(password) }),
    });
  } catch {
    return { success: false, message: "로그인 서버에 연결할 수 없습니다. 네트워크 연결을 확인해 주세요." };
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 401
      ? "아이디·이메일 또는 비밀번호가 올바르지 않습니다."
      : response.status === 429
        ? "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."
        : response.status === 404 || response.status === 405
          ? "로그인 API가 아직 배포되지 않았거나 연결 설정이 올바르지 않습니다. 관리자에게 문의해 주세요."
        : response.status >= 500
          ? "로그인 서버 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요."
          : (result.message || "로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    return { success: false, message };
  }

  const accessToken = result.session?.access_token;
  const refreshToken = result.session?.refresh_token;
  if (!accessToken || !refreshToken) {
    return { success: false, message: "로그인 응답에 필요한 세션 정보가 없습니다. 서버 설정을 확인해 주세요." };
  }
  const { data, error } = await window.btlrSupabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data?.user) {
    return { success: false, message: "로그인 세션을 저장하지 못했습니다. 다시 시도해 주세요." };
  }

  await loadCurrentUser(data.user);
  return { success: true, message: "로그인되었습니다.", user: currentUserCache };
}

async function logoutUser() {
  if (window.btlrSupabase) {
    const { error } = await window.btlrSupabase.auth.signOut();
    if (error) return { success: false, message: getFriendlyServiceError(error, "로그아웃하지 못했습니다.") };
  }
  currentUserCache = null;
  sessionStorage.removeItem(HEADER_USER_CACHE_KEY);
  return { success: true, message: "로그아웃했습니다." };
}

function getCurrentUser() {
  return currentUserCache;
}

function isAdminUser(user = getCurrentUser()) {
  return user?.role === "admin" || user?.role === "owner";
}

function getCachedHeaderUser() {
  try {
    const cachedUser = JSON.parse(sessionStorage.getItem(HEADER_USER_CACHE_KEY) || "null");
    if (!cachedUser?.id || !cachedUser?.role) return null;
    return cachedUser;
  } catch {
    sessionStorage.removeItem(HEADER_USER_CACHE_KEY);
    return null;
  }
}

function cacheHeaderUser(user) {
  if (!user) {
    sessionStorage.removeItem(HEADER_USER_CACHE_KEY);
    return;
  }
  sessionStorage.setItem(HEADER_USER_CACHE_KEY, JSON.stringify(user));
}

async function loadCurrentUser(knownUser = null) {
  if (!window.btlrSupabase) {
    currentUserCache = null;
    cacheHeaderUser(null);
    return null;
  }

  let authUser = knownUser;
  if (!authUser) {
    const { data, error } = await window.btlrSupabase.auth.getSession();
    if (error || !data.session?.user) {
      currentUserCache = null;
      cacheHeaderUser(null);
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
  cacheHeaderUser(currentUserCache);
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
  return [...favoritesCache];
}

async function loadFavoritesFromSupabase() {
  const user = getCurrentUser();
  favoritesCache = [];
  favoritesLoadError = "";
  if (!user) {
    favoritesLoadState = "empty";
    return { success: true };
  }
  if (!window.btlrSupabase) {
    favoritesLoadState = "error";
    favoritesLoadError = "찜 서비스에 연결할 수 없습니다.";
    return { success: false, message: favoritesLoadError };
  }
  favoritesLoadState = "loading";

  const { data, error } = await window.btlrSupabase
    .from("favorites")
    .select("user_id, book_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    favoritesLoadState = "error";
    favoritesLoadError = getFriendlyServiceError(error, "찜 목록을 불러오지 못했습니다.");
    return { success: false, message: favoritesLoadError };
  }

  favoritesCache = (data || []).map((favorite) => ({
    id: `${favorite.user_id}:${favorite.book_id}`,
    userId: favorite.user_id,
    bookId: favorite.book_id,
    createdAt: favorite.created_at,
  }));

  const legacyFavorites = getStoredArray(STORAGE_KEYS.favorites)
    .filter((favorite) => favorite?.userId === user.id && favorite?.bookId)
    .filter((favorite) => !favoritesCache.some((saved) => saved.bookId === favorite.bookId));
  if (legacyFavorites.length) {
    const { error: migrationError } = await window.btlrSupabase
      .from("favorites")
      .upsert(legacyFavorites.map((favorite) => ({
        user_id: user.id,
        book_id: favorite.bookId,
        created_at: favorite.createdAt || new Date().toISOString(),
      })), { onConflict: "user_id,book_id", ignoreDuplicates: true });
    if (!migrationError) {
      legacyFavorites.forEach((favorite) => favoritesCache.push({
        id: `${user.id}:${favorite.bookId}`,
        userId: user.id,
        bookId: favorite.bookId,
        createdAt: favorite.createdAt || new Date().toISOString(),
      }));
      localStorage.removeItem(STORAGE_KEYS.favorites);
    }
  } else if (localStorage.getItem(STORAGE_KEYS.favorites)) {
    localStorage.removeItem(STORAGE_KEYS.favorites);
  }
  favoritesLoadState = favoritesCache.length ? "success" : "empty";
  return { success: true };
}

async function addFavorite(bookId) {
  const user = requireLogin();
  if (!user) return { success: false, redirected: true };
  if (!window.btlrSupabase) return { success: false, message: "찜 서비스에 연결할 수 없습니다." };
  if (isFavorite(bookId)) {
    return { success: false, message: "이미 찜한 도서입니다." };
  }
  const createdAt = new Date().toISOString();
  const { error } = await window.btlrSupabase.from("favorites").insert({
    user_id: user.id,
    book_id: bookId,
    created_at: createdAt,
  });
  if (error) return { success: false, message: getFriendlyServiceError(error, "찜한 도서에 추가하지 못했습니다.") };
  favoritesCache.unshift({ id: `${user.id}:${bookId}`, userId: user.id, bookId, createdAt });
  return { success: true, message: "찜한 도서에 추가했습니다." };
}

async function removeFavorite(bookId) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: "로그인이 필요합니다." };
  if (!window.btlrSupabase) return { success: false, message: "찜 서비스에 연결할 수 없습니다." };
  const { error } = await window.btlrSupabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", bookId);
  if (error) return { success: false, message: getFriendlyServiceError(error, "찜을 취소하지 못했습니다.") };
  favoritesCache = favoritesCache.filter(
    (favorite) => !(favorite.userId === user.id && favorite.bookId === bookId),
  );
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
  loansLoadError = "";
  if (!user) {
    loansCache = [];
    loansLoadState = "empty";
    return;
  }
  if (!window.btlrSupabase) {
    loansCache = [];
    loansLoadState = "error";
    loansLoadError = "대출 서비스에 연결할 수 없습니다.";
    return;
  }
  loansLoadState = "loading";
  const { data, error } = await window.btlrSupabase
    .from("book_loans")
    .select("id, user_id, book_id, status, borrowed_at, due_at")
    .eq("status", "active")
    .order("borrowed_at", { ascending: false });
  if (error) {
    loansCache = [];
    loansLoadState = "error";
    loansLoadError = getFriendlyServiceError(error, "대출 목록을 불러오지 못했습니다.");
    return;
  }
  loansCache = (data || []).map((loan) => ({
    id: loan.id,
    userId: loan.user_id,
    bookId: loan.book_id,
    loanStatus: "대출 중",
    borrowedAt: loan.borrowed_at,
    dueDate: loan.due_at,
  }));
  loansLoadState = loansCache.length ? "success" : "empty";
}

async function borrowBook(bookId) {
  const user = requireLogin();
  if (!user) return { success: false, redirected: true };
  if (isAdminUser(user)) {
    return { success: false, message: "관리자 계정은 도서를 대출할 수 없습니다." };
  }
  const book = getBookById(bookId);
  if (!book) return { success: false, message: "도서 정보를 찾을 수 없습니다." };
  const readyForUser = isBookReadyForCurrentUser(bookId);
  if (!readyForUser && (book.availableQuantity ?? (book.loanStatus === "대출 가능" ? 1 : 0)) < 1) {
    return { success: false, message: "현재 바로 대출할 수 없는 도서입니다." };
  }
  if (isLoaned(bookId)) {
    return { success: false, message: "이미 대출 목록에 있는 도서입니다." };
  }

  const { data, error } = await window.btlrSupabase.rpc("borrow_book", {
    target_book_id: bookId,
  });
  if (error) return { success: false, message: getFriendlyServiceError(error, "도서를 대출하지 못했습니다.") };
  await Promise.all([
    loadUserLoansFromSupabase(),
    loadUserReservationsFromSupabase(),
    loadBooksFromSupabase(),
  ]);
  await loadNotifications();
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
  if (!exists) return { success: false, message: "대출 정보를 찾을 수 없습니다." };
  const { error } = await window.btlrSupabase.rpc("return_book", {
    target_loan_id: loanId,
  });
  if (error) return { success: false, message: getFriendlyServiceError(error, "도서를 반납하지 못했습니다.") };
  await Promise.all([loadUserLoansFromSupabase(), loadBooksFromSupabase()]);
  await loadNotifications();
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
  reservationsLoadError = "";
  if (!user) {
    reservationsCache = [];
    reservationsLoadState = "empty";
    return;
  }
  if (!window.btlrSupabase) {
    reservationsCache = [];
    reservationsLoadState = "error";
    reservationsLoadError = "도서 예약 서비스에 연결할 수 없습니다.";
    return;
  }
  reservationsLoadState = "loading";

  let { data, error } = await window.btlrSupabase.rpc("list_my_book_reservations");
  if (error && /function|schema cache/i.test(error.message || "")) {
    const fallback = await window.btlrSupabase
      .from("book_reservations")
      .select("id, user_id, book_id, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["active", "ready"])
      .order("created_at", { ascending: false });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    reservationsCache = [];
    reservationsLoadState = "error";
    reservationsLoadError = getFriendlyServiceError(error, "도서 예약 목록을 불러오지 못했습니다.");
    return;
  }

  reservationsCache = (data || []).map((reservation) => ({
    id: reservation.id,
    userId: reservation.user_id,
    bookId: reservation.book_id,
    status: reservation.status,
    reservationStatus: reservation.status === "ready" ? "대출 가능" : "예약 대기",
    queuePosition: Number(reservation.queue_position) || 0,
    readyAt: reservation.ready_at || null,
    readyExpiresAt: reservation.ready_expires_at || null,
    createdAt: reservation.created_at,
  }));
  reservationsLoadState = reservationsCache.length ? "success" : "empty";
}

async function reserveBook(bookId) {
  const user = requireLogin();
  if (!user) return { success: false, redirected: true };
  if (isAdminUser(user)) {
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
  if (error) return { success: false, message: getFriendlyServiceError(error, "도서를 예약하지 못했습니다.") };
  await Promise.all([loadUserReservationsFromSupabase(), loadBooksFromSupabase()]);
  await loadNotifications();
  return {
    success: true,
    message:
      "예약 신청이 완료되었습니다. 앞선 예약자가 있으면 순서대로 알림을 보내드립니다.",
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
  if (error) return { success: false, message: getFriendlyServiceError(error, "예약을 취소하지 못했습니다.") };
  await Promise.all([loadUserReservationsFromSupabase(), loadBooksFromSupabase()]);
  await loadNotifications();
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

function getReadyReservation(bookId) {
  const user = getCurrentUser();
  if (!user) return null;
  return getReservations().find(
    (reservation) =>
      reservation.userId === user.id &&
      reservation.bookId === bookId &&
      reservation.status === "ready",
  ) || null;
}

function isBookReadyForCurrentUser(bookId) {
  return Boolean(getReadyReservation(bookId));
}

function renderAuthArea() {
  const user = getCurrentUser();
  document.body?.classList.toggle("has-admin-nav", isAdminUser(user));
  document.querySelectorAll("[data-auth-area]").forEach((container) => {
    if (user) {
      container.innerHTML = `
        <button class="notification-toggle" type="button" data-notification-toggle aria-label="알림 열기" aria-expanded="false"><span aria-hidden="true">♢</span><b data-notification-count hidden>0</b></button>
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

    let inquiryLink = navigation.querySelector(".inquiry-nav-link");
    if (!inquiryLink) {
      inquiryLink = document.createElement("a");
      inquiryLink.className = "inquiry-nav-link";
      inquiryLink.href = "inquiry.html";
      inquiryLink.textContent = "문의 게시판";
      const myPageLink = navigation.querySelector('a[href="mypage.html"]');
      navigation.insertBefore(inquiryLink, myPageLink || navigation.querySelector(".nav-message"));
    }
    inquiryLink.classList.toggle("active", getCurrentPage() === "inquiry");

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
      { href: "admin-users.html", label: "회원 관리", section: "users", icon: "♙" },
      { href: "admin-books.html", label: "도서 관리", section: "books", icon: "▤" },
      { href: "admin-reading-room.html", label: "열람실 관리", section: "room-reservations", icon: "⌑" },
      { href: "admin-inquiries.html", label: "문의 관리", section: "inquiries", icon: "✉" },
    ];

    if (isAdminUser(user)) {
      navigation.querySelectorAll(":scope > .admin-nav-link").forEach((link) => link.remove());
      let adminMenu = navigation.querySelector(".admin-nav-menu");
      if (!adminMenu) {
        adminMenu = document.createElement("div");
        adminMenu.className = "admin-nav-menu";
        adminMenu.innerHTML = `
          <button class="admin-nav-toggle" type="button" data-admin-nav-toggle aria-expanded="false">
            <span aria-hidden="true">▦</span><strong>관리페이지</strong><i aria-hidden="true">⌄</i>
          </button>
          <div class="admin-nav-dropdown" data-admin-nav-dropdown hidden>
            ${adminNavigationItems.map((item) => `<a href="${item.href}" data-admin-nav="${item.section}"><span aria-hidden="true">${item.icon}</span><span><strong>${item.label}</strong><small>${item.section === "users" ? "회원 정보와 권한" : item.section === "books" ? "도서·요청·재고" : item.section === "room-reservations" ? "좌석 예약 현황" : "문의와 답변"}</small></span></a>`).join("")}
          </div>
        `;
      }
      navigation.insertBefore(adminMenu, navigation.querySelector(".nav-message"));
    } else {
      navigation.querySelectorAll(".admin-nav-link, .admin-nav-menu").forEach((item) => item.remove());
    }

    // 페이지마다 원래 작성된 링크 순서가 달라도 헤더 메뉴는 항상 같은 자리에 둡니다.
    [
      navigation.querySelector('a[href="index.html"]'),
      navigation.querySelector('a[href="search.html"]'),
      navigation.querySelector(".reading-room-nav-link"),
      navigation.querySelector(".inquiry-nav-link"),
      navigation.querySelector(".request-nav-link"),
      navigation.querySelector('a[href="mypage.html"]'),
      navigation.querySelector(".admin-nav-menu"),
      navigation.querySelector(".nav-message"),
    ].filter(Boolean).forEach((item) => navigation.append(item));
  });

  updateAdminNavigationState();
  document.querySelectorAll(".site-header").forEach((header) => {
    header.classList.add("is-header-ready");
  });
}

function getSafeNotificationLink(value) {
  const link = String(value || "").trim();
  return /^(index|search|detail|reserve|mypage|admin|admin-users|admin-books|admin-reading-room|admin-inquiries|request|reading-room|inquiry)\.html(?:[?#].*)?$/.test(link)
    ? link
    : "mypage.html";
}

function getNotificationIcon(type) {
  return {
    book_ready: "B",
    reading_room: "⌑",
    loan_overdue: "!",
    loan_due: "↗",
    favorite_available: "♡",
    admin_inquiry: "✉",
    admin_book_request: "+",
    inquiry_answer: "↩",
    book_request_result: "✓",
  }[type] || "•";
}

function getNotificationPriority(type) {
  return {
    reading_room: 100,
    book_ready: 90,
    loan_overdue: 85,
    loan_due: 70,
    admin_inquiry: 65,
    admin_book_request: 60,
    inquiry_answer: 55,
    book_request_result: 50,
    favorite_available: 30,
  }[type] || 10;
}

function getReadingRoomDateTime(date, time) {
  const normalizedDate = String(date || "").slice(0, 10);
  const normalizedTime = formatRoomTime(time);
  if (!normalizedDate || normalizedTime === "-") return null;
  const value = new Date(`${normalizedDate}T${normalizedTime}:00+09:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isReadingRoomReservationUpcoming(reservation, now = Date.now()) {
  const endAt = getReadingRoomDateTime(reservation.reservation_date || reservation.reservationDate, reservation.end_time || reservation.endTime);
  return Boolean(endAt && endAt.getTime() > now);
}

function formatNotificationTime(value) {
  if (!value) return "방금 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const differenceMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (differenceMinutes < 1) return "방금 전";
  if (differenceMinutes < 60) return `${differenceMinutes}분 전`;
  if (differenceMinutes < 1440) return `${Math.floor(differenceMinutes / 60)}시간 전`;
  return formatDate(value);
}

function ensureNotificationCenter() {
  if (!document.getElementById("notification-panel")) {
    const panel = document.createElement("aside");
    panel.id = "notification-panel";
    panel.className = "notification-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "통합 알림");
    panel.innerHTML = `
      <div class="notification-panel-heading"><div><span>NOTIFICATIONS</span><h2>알림</h2></div><button type="button" data-notification-close aria-label="알림 닫기">×</button></div>
      <div class="notification-list" id="notification-list"></div>
      <button class="notification-read-all" type="button" data-notification-read-all>모두 읽음 처리</button>
    `;
    document.body.appendChild(panel);
  }

  if (!document.getElementById("notification-banner")) {
    const banner = document.createElement("aside");
    banner.id = "notification-banner";
    banner.className = "notification-banner";
    banner.hidden = true;
    const header = document.querySelector(".site-header");
    if (header) header.insertAdjacentElement("afterend", banner);
  }
}

async function getVirtualNotifications() {
  const user = getCurrentUser();
  if (!user || isAdminUser(user)) return [];
  const virtualNotifications = [];
  const now = Date.now();

  getLoans()
    .filter((loan) => loan.userId === user.id)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .forEach((loan) => {
      const dueAt = new Date(loan.dueDate).getTime();
      if (!Number.isFinite(dueAt) || dueAt - now > 3 * 24 * 60 * 60 * 1000) return;
      const book = getBookById(loan.bookId);
      const overdue = dueAt < now;
      virtualNotifications.push({
        id: `${overdue ? "loan-overdue" : "loan-due"}-${loan.id}`,
        type: overdue ? "loan_overdue" : "loan_due",
        title: overdue ? "도서 반납일이 지났어요" : "도서 반납일이 가까워요",
        message: `${book?.title || "대출 도서"}의 반납 예정일은 ${formatDate(loan.dueDate)}입니다.${overdue ? " 가능한 빨리 반납해 주세요." : ""}`,
        link: "mypage.html#loans-section",
        created_at: loan.dueDate,
        isVirtual: true,
      });
    });

  getReservations()
    .filter((reservation) => reservation.userId === user.id && reservation.status === "ready")
    .forEach((reservation) => {
      const book = getBookById(reservation.bookId);
      virtualNotifications.push({
        id: `book-ready-${reservation.id}`,
        type: "book_ready",
        title: "예약 도서를 대출할 수 있어요",
        message: `${book?.title || "예약 도서"}이(가) 준비되었습니다.${reservation.readyExpiresAt ? ` ${formatDate(reservation.readyExpiresAt)}까지` : " 보관 기한 안에"} 대출해 주세요.`,
        link: `detail.html?id=${encodeURIComponent(reservation.bookId)}`,
        created_at: reservation.readyAt || reservation.createdAt,
        isVirtual: true,
      });
    });

  getFavorites()
    .filter((favorite) => favorite.userId === user.id)
    .map((favorite) => getBookById(favorite.bookId))
    .filter((book) => book && book.availableQuantity > 0 && !isLoaned(book.id))
    .slice(0, 10)
    .forEach((book) => virtualNotifications.push({
      id: `favorite-available-${book.id}`,
      type: "favorite_available",
      title: "찜한 도서를 빌릴 수 있어요",
      message: `${book.title}이(가) 현재 대출 가능합니다.`,
      link: `detail.html?id=${encodeURIComponent(book.id)}`,
      created_at: new Date().toISOString(),
      isVirtual: true,
    }));

  if (window.btlrSupabase) {
    const today = getLocalDateInputValue();
    const { data } = await window.btlrSupabase
      .from("reading_room_reservations")
      .select("id, reservation_group_id, reservation_date, start_time, end_time, seat_number")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("reservation_date", today)
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true });
    const groups = groupReadingRoomReservations((data || []).filter((reservation) => isReadingRoomReservationUpcoming(reservation, now)));
    groups.forEach((reservation) => {
      const startAt = getReadingRoomDateTime(reservation.reservationDate, reservation.startTime);
      const minutesUntilStart = startAt ? Math.ceil((startAt.getTime() - now) / 60000) : -1;
      if (minutesUntilStart <= 0 || minutesUntilStart > 30) return;
      virtualNotifications.push({
        id: `room-soon-${reservation.groupId}`,
        type: "reading_room",
        title: "열람실 이용 시간이 곧 시작돼요",
        message: `${minutesUntilStart}분 후 ${reservation.seatNumbers.map((seat) => `${seat}번`).join(", ")} 좌석 예약이 시작됩니다.`,
        link: "mypage.html#reading-room-section",
        created_at: startAt.toISOString(),
        isVirtual: true,
      });
    });
  }

  const readVirtualIds = new Set(getStoredArray(`btlr_read_virtual_notifications_${user.id}`));
  return virtualNotifications.map((notification) => ({
    ...notification,
    read_at: readVirtualIds.has(notification.id) ? notification.created_at : null,
  }));
}

function renderNotificationCenter() {
  ensureNotificationCenter();
  const user = getCurrentUser();
  const list = document.getElementById("notification-list");
  const banner = document.getElementById("notification-banner");
  if (!user || !list || !banner) return;

  const sortedNotifications = [...notificationsCache].sort((a, b) => {
    const priorityDifference = getNotificationPriority(b.type) - getNotificationPriority(a.type);
    return priorityDifference || new Date(b.created_at) - new Date(a.created_at);
  });
  const unreadNotifications = sortedNotifications.filter((notification) => !notification.read_at);
  document.querySelectorAll("[data-notification-count]").forEach((count) => {
    count.textContent = unreadNotifications.length > 99 ? "99+" : String(unreadNotifications.length);
    count.hidden = unreadNotifications.length === 0;
  });

  list.innerHTML = sortedNotifications.length
    ? sortedNotifications.map((notification) => `
      <a class="notification-item${notification.read_at ? " is-read" : ""}" href="${escapeHTML(getSafeNotificationLink(notification.link))}" data-notification-id="${escapeHTML(notification.id)}" data-notification-virtual="${notification.isVirtual ? "true" : "false"}">
        <span class="notification-icon" aria-hidden="true">${escapeHTML(getNotificationIcon(notification.type))}</span>
        <span><strong>${escapeHTML(notification.title)}</strong><small>${escapeHTML(notification.message)}</small><time>${escapeHTML(formatNotificationTime(notification.created_at))}</time></span>
      </a>
    `).join("")
    : '<div class="notification-empty"><span>✓</span><strong>새로운 알림이 없습니다.</strong></div>';

  const dismissedIds = new Set(JSON.parse(sessionStorage.getItem("btlr_dismissed_notifications") || "[]"));
  const bannerNotification = unreadNotifications.find((notification) => !dismissedIds.has(notification.id));
  if (bannerNotification) {
    banner.hidden = false;
    banner.innerHTML = `
      <div class="shell notification-banner-inner"><span class="notification-icon" aria-hidden="true">${escapeHTML(getNotificationIcon(bannerNotification.type))}</span><div><strong>${escapeHTML(bannerNotification.title)}</strong><p>${escapeHTML(bannerNotification.message)}</p></div><a href="${escapeHTML(getSafeNotificationLink(bannerNotification.link))}" data-notification-id="${escapeHTML(bannerNotification.id)}" data-notification-virtual="${bannerNotification.isVirtual ? "true" : "false"}">확인하기</a><button type="button" data-notification-dismiss="${escapeHTML(bannerNotification.id)}" aria-label="알림 배너 닫기">×</button></div>
    `;
  } else {
    banner.hidden = true;
    banner.replaceChildren();
  }
}

async function loadNotifications() {
  const user = getCurrentUser();
  if (!user || !window.btlrSupabase) return;
  const [{ data, error }, virtualNotifications] = await Promise.all([
    window.btlrSupabase
      .from("notifications")
      .select("id, user_id, type, title, message, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    getVirtualNotifications(),
  ]);
  notificationsCache = [...(error ? [] : (data || [])), ...virtualNotifications];
  renderNotificationCenter();
}

async function markNotificationRead(notificationId, isVirtual = false) {
  if (!notificationId || !window.btlrSupabase) return;
  if (isVirtual) {
    const user = getCurrentUser();
    const storageKey = `btlr_read_virtual_notifications_${user.id}`;
    const readIds = new Set(getStoredArray(storageKey));
    readIds.add(notificationId);
    setStoredArray(storageKey, [...readIds].slice(-50));
  } else {
    await window.btlrSupabase.rpc("mark_notification_read", { target_notification_id: notificationId });
  }
  const notification = notificationsCache.find((item) => item.id === notificationId);
  if (notification) notification.read_at = new Date().toISOString();
  renderNotificationCenter();
}

async function initNotificationCenter() {
  const user = getCurrentUser();
  if (!user || !window.btlrSupabase) return;
  ensureNotificationCenter();

  if (!document.body.dataset.notificationEventsBound) {
    document.body.dataset.notificationEventsBound = "true";
    document.addEventListener("click", async (event) => {
      const toggle = event.target.closest("[data-notification-toggle]");
      const panel = document.getElementById("notification-panel");
      if (toggle && panel) {
        panel.hidden = !panel.hidden;
        toggle.setAttribute("aria-expanded", String(!panel.hidden));
        return;
      }
      if (event.target.closest("[data-notification-close]") && panel) {
        panel.hidden = true;
        document.querySelectorAll("[data-notification-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
        return;
      }
      const dismiss = event.target.closest("[data-notification-dismiss]");
      if (dismiss) {
        const dismissed = new Set(JSON.parse(sessionStorage.getItem("btlr_dismissed_notifications") || "[]"));
        dismissed.add(dismiss.dataset.notificationDismiss);
        sessionStorage.setItem("btlr_dismissed_notifications", JSON.stringify([...dismissed]));
        renderNotificationCenter();
        return;
      }
      const notificationLink = event.target.closest("[data-notification-id]");
      if (notificationLink) {
        event.preventDefault();
        await markNotificationRead(notificationLink.dataset.notificationId, notificationLink.dataset.notificationVirtual === "true");
        window.location.href = getSafeNotificationLink(notificationLink.getAttribute("href"));
        return;
      }
      if (event.target.closest("[data-notification-read-all]")) {
        await window.btlrSupabase.rpc("mark_all_notifications_read");
        const storageKey = `btlr_read_virtual_notifications_${user.id}`;
        setStoredArray(storageKey, notificationsCache.filter((notification) => notification.isVirtual).map((notification) => notification.id));
        notificationsCache.forEach((notification) => {
          notification.read_at = new Date().toISOString();
        });
        renderNotificationCenter();
      }
    });
  }

  await loadNotifications();
  window.clearInterval(notificationPollTimer);
  notificationPollTimer = window.setInterval(loadNotifications, 60000);

  if (notificationRealtimeChannel) await window.btlrSupabase.removeChannel(notificationRealtimeChannel);
  notificationRealtimeChannel = window.btlrSupabase
    .channel(`notifications-${user.id}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${user.id}`,
    }, loadNotifications)
    .subscribe();
}

function updateAdminNavigationState() {
  const supportedSections = new Set(["users", "books", "room-reservations", "inquiries"]);
  const hashSection = window.location.hash.replace(/^#/, "");
  const activeSection = getCurrentPage() === "admin"
    ? supportedSections.has(document.body?.dataset.adminSection)
      ? document.body.dataset.adminSection
      : supportedSections.has(hashSection) ? hashSection : "users"
    : "";
  document.querySelectorAll("[data-admin-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.adminNav === activeSection);
  });
  document.querySelectorAll("[data-admin-nav-toggle]").forEach((button) => {
    button.classList.toggle("active", Boolean(activeSection));
  });
}

function closeAdminNavigationMenus() {
  document.querySelectorAll("[data-admin-nav-dropdown]").forEach((dropdown) => {
    dropdown.hidden = true;
    dropdown.removeAttribute("style");
  });
  document.querySelectorAll("[data-admin-nav-toggle]").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function initAdminNavigationMenu() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-admin-nav-toggle]");
    if (toggle) {
      const dropdown = toggle.closest(".admin-nav-menu")?.querySelector("[data-admin-nav-dropdown]");
      if (!dropdown) return;
      const shouldOpen = dropdown.hidden;
      closeAdminNavigationMenus();
      if (shouldOpen) {
        const rect = toggle.getBoundingClientRect();
        const dropdownWidth = Math.min(230, window.innerWidth - 24);
        dropdown.style.width = `${dropdownWidth}px`;
        dropdown.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - dropdownWidth - 12)}px`;
        dropdown.style.top = `${rect.bottom + 8}px`;
        dropdown.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
      }
      return;
    }
    if (event.target.closest("[data-admin-nav]")) {
      closeAdminNavigationMenus();
      return;
    }
    if (!event.target.closest(".admin-nav-menu")) closeAdminNavigationMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAdminNavigationMenus();
  });
  window.addEventListener("resize", closeAdminNavigationMenus);
}

window.addEventListener("hashchange", () => {
  closeAdminNavigationMenus();
  updateAdminNavigationState();
});

function handleGlobalActions() {
  document.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;

    const action = trigger.dataset.action;
    const bookId = trigger.dataset.bookId;
    let result = null;

    if (action === "logout") {
      const logoutResult = await logoutUser();
      if (!logoutResult.success) {
        showToast(logoutResult.message);
        return;
      }
      window.location.href = "index.html";
      return;
    }

    if (action === "favorite") {
      trigger.disabled = true;
      try {
        result = await (isFavorite(bookId)
          ? removeFavorite(bookId)
          : addFavorite(bookId));
      } finally {
        trigger.disabled = false;
      }
    }

    if (action === "borrow") {
      result = await borrowBook(bookId);
    }

    if (action === "remove-favorite") {
      trigger.disabled = true;
      try {
        result = await removeFavorite(bookId);
      } finally {
        trigger.disabled = false;
      }
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
  const preferredFeaturedBooks = [
    getBookById("book-001"),
    getBookById("book-008"),
    getBookById("book-010"),
    getBookById("book-016"),
  ].filter(Boolean);
  const featuredBooks = [...preferredFeaturedBooks];
  getBooks().forEach((book) => {
    if (featuredBooks.length < 4 && !featuredBooks.some((featured) => featured.id === book.id)) {
      featuredBooks.push(book);
    }
  });
  renderBookCards(featuredBooks, document.getElementById("featured-books"));
  const featuredTarget = document.getElementById("featured-books");
  if (featuredTarget && booksLoadState === "error") {
    featuredTarget.innerHTML = `<div class="request-empty compact"><strong>추천 도서를 불러오지 못했습니다.</strong><p>${escapeHTML(booksLoadError)}</p></div>`;
  } else if (featuredTarget && booksLoadState === "empty") {
    featuredTarget.innerHTML = '<div class="request-empty compact"><strong>아직 등록된 도서가 없습니다.</strong><p>도서가 등록되면 이곳에 추천 도서가 표시됩니다.</p></div>';
  }

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

  if (isAdminUser(user)) {
    actionPanel.innerHTML = `
      <div class="home-request-gate">
        <strong>회원의 도서 추가 요청을 확인하세요.</strong>
        <p>관리자는 요청을 승인해 도서 목록에 바로 추가할 수 있습니다.</p>
        <a class="button button-primary" href="admin-books.html">요청 관리로 이동</a>
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
  let currentPage = Math.max(Number.parseInt(getQueryParam("page") || "1", 10) || 1, 1);
  const categoryParam = getQueryParam("category") || "전체";
  const statusParam = getQueryParam("status") || "전체";
  const sortParam = getQueryParam("sort") || "default";
  const categoryFilter = document.getElementById("category-filter");
  const sortFilter = document.getElementById("sort-filter");
  const resetButton = document.getElementById("reset-filters");
  const emptyResetButton = document.getElementById("empty-reset");
  const headerInput = document.querySelector(".header-search input");

  if (headerInput) headerInput.value = query;
  populateCategoryFilter(categoryFilter, categoryParam);
  if (sortFilter && [...sortFilter.options].some((option) => option.value === sortParam)) {
    sortFilter.value = sortParam;
  }

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

    const stateUrl = new URL(window.location.href);
    if (query) stateUrl.searchParams.set("q", query);
    else stateUrl.searchParams.delete("q");
    if (category === "전체") stateUrl.searchParams.delete("category");
    else stateUrl.searchParams.set("category", category);
    if (loanStatus === "전체") stateUrl.searchParams.delete("status");
    else stateUrl.searchParams.set("status", loanStatus);
    if (sortOption === "default") stateUrl.searchParams.delete("sort");
    else stateUrl.searchParams.set("sort", sortOption);
    if (currentPage === 1) stateUrl.searchParams.delete("page");
    else stateUrl.searchParams.set("page", String(currentPage));
    window.history.replaceState({}, "", `${stateUrl.pathname}${stateUrl.search}${stateUrl.hash}`);

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
    let pagination = document.getElementById("search-pagination");
    if (!pagination && results) {
      pagination = document.createElement("nav");
      pagination.id = "search-pagination";
      pagination.className = "admin-pagination search-pagination";
      pagination.setAttribute("aria-label", "도서 검색 결과 페이지");
      results.insertAdjacentElement("afterend", pagination);
    }

    if (booksLoadState === "error") {
      if (results) {
        results.hidden = false;
        results.innerHTML = `<div class="request-empty"><strong>도서 목록을 불러오지 못했습니다.</strong><p>${escapeHTML(booksLoadError)}</p><button class="button button-secondary" type="button" data-retry-books>다시 시도</button></div>`;
      }
      if (empty) empty.hidden = true;
      if (pagination) pagination.hidden = true;
      return;
    }

    const totalPages = Math.max(Math.ceil(books.length / SEARCH_PAGE_SIZE), 1);
    const requestedPage = currentPage;
    currentPage = Math.min(currentPage, totalPages);
    if (currentPage !== requestedPage) {
      if (currentPage === 1) stateUrl.searchParams.delete("page");
      else stateUrl.searchParams.set("page", String(currentPage));
      window.history.replaceState({}, "", `${stateUrl.pathname}${stateUrl.search}${stateUrl.hash}`);
    }
    const pageBooks = books.slice((currentPage - 1) * SEARCH_PAGE_SIZE, currentPage * SEARCH_PAGE_SIZE);
    if (results) results.hidden = books.length === 0;
    if (empty) empty.hidden = books.length !== 0;
    renderBookCards(pageBooks, results);

    if (pagination) {
      pagination.hidden = totalPages <= 1;
      pagination.innerHTML = totalPages <= 1 ? "" : `
        <button type="button" data-search-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>이전</button>
        ${getAdminPaginationItems(currentPage, totalPages).map((item) => item === "ellipsis"
          ? '<span class="admin-pagination-ellipsis" aria-hidden="true">…</span>'
          : `<button type="button" data-search-page="${item}" class="${item === currentPage ? "active" : ""}" ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`).join("")}
        <button type="button" data-search-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>다음</button>`;
    }
  };

  categoryFilter?.addEventListener("change", () => {
    // 카테고리를 직접 바꾸면 이전 텍스트 검색은 끝난 것으로 처리합니다.
    // 검색어와 새 카테고리가 의도치 않게 동시에 적용되어 결과가 사라지는 일을 막습니다.
    if (query) {
      query = "";
      if (headerInput) headerInput.value = "";
    }
    currentPage = 1;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("q");
    if (categoryFilter.value === "전체") nextUrl.searchParams.delete("category");
    else nextUrl.searchParams.set("category", categoryFilter.value);
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    updateResults();
  });
  sortFilter?.addEventListener("change", () => {
    currentPage = 1;
    updateResults();
  });
  document
    .querySelectorAll('input[name="loan-status"]')
    .forEach((radio) => radio.addEventListener("change", () => {
      currentPage = 1;
      updateResults();
    }));

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-page]");
    if (!button || button.disabled) return;
    currentPage = Math.max(Number(button.dataset.searchPage) || 1, 1);
    const nextUrl = new URL(window.location.href);
    if (currentPage === 1) nextUrl.searchParams.delete("page");
    else nextUrl.searchParams.set("page", String(currentPage));
    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    updateResults();
    document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("search-results")?.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-retry-books]")) return;
    await loadBooksFromSupabase();
    populateCategoryFilter(categoryFilter, categoryFilter?.value || "전체");
    updateResults();
  });

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
    currentPage = 1;
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
  if (booksLoadState === "error") {
    container.innerHTML = `<div class="not-found"><span>!</span><h1>도서 정보를 불러오지 못했어요</h1><p>${escapeHTML(booksLoadError)}</p><a class="button button-primary" href="${escapeHTML(getCurrentRelativeUrl())}">다시 시도</a></div>`;
    return;
  }
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
  const readyForUser = isBookReadyForCurrentUser(book.id);
  const actionButton = isAdminUser()
    ? '<button class="button button-primary is-disabled" type="button" disabled>관리자 계정은 대출할 수 없습니다</button>'
    : loaned
      ? '<button class="button button-primary is-disabled" type="button" disabled>현재 대출 중</button>'
    : readyForUser || (book.availableQuantity ?? (book.loanStatus === "대출 가능" ? 1 : 0)) > 0
      ? `<button class="button button-primary" type="button" data-action="borrow" data-book-id="${book.id}">${readyForUser ? "예약 도서 대출하기" : "대출하기"}</button>`
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
        <div class="detail-actions">
          <button class="button button-secondary favorite-detail ${favorite ? "active" : ""}" type="button" data-action="favorite" data-book-id="${book.id}" aria-pressed="${favorite}">${favorite ? "♥ 찜 취소" : "♡ 찜하기"}</button>
          ${actionButton}
        </div>
        <a class="back-link" href="${escapeHTML(getBookDetailReturnUrl())}">← 검색 결과로 돌아가기</a>
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
  if (booksLoadState === "error") {
    container.innerHTML = `<div class="not-found"><span>!</span><h1>도서 정보를 불러오지 못했어요</h1><p>${escapeHTML(booksLoadError)}</p><a class="button button-primary" href="${escapeHTML(getCurrentRelativeUrl())}">다시 시도</a></div>`;
    return;
  }
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
  const readyReservation = getReadyReservation(book.id);
  const loanedByUser = isLoaned(book.id);
  const isAdmin = isAdminUser();
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
          <div><dt>현재 상태</dt><dd>${escapeHTML(book.loanStatus)}</dd></div>
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
            : readyReservation
            ? '<div class="available-guide">예약 순번이 도착했습니다. 확보된 도서를 지금 대출할 수 있습니다.</div>' +
              `<button class="button button-primary button-full" type="button" data-action="borrow" data-book-id="${book.id}" style="margin-top:14px">예약 도서 대출하기</button>`
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
  const recoveryMode = getQueryParam("mode") === "reset" || /(?:^|[&#])type=recovery(?:&|$)/.test(window.location.hash);
  if (getCurrentUser() && !recoveryMode) {
    window.location.href = "index.html";
    return;
  }

  const form = document.getElementById("login-form");
  const message = document.getElementById("login-message");
  const notice = sessionStorage.getItem("btlr_login_notice");
  const signupNotice = sessionStorage.getItem("btlr_signup_notice");

  initPasswordRecovery(recoveryMode);

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
        window.location.href = "index.html";
      }, 450);
    }
  });
}

function initPasswordRecovery(recoveryMode = false) {
  const requestForm = document.getElementById("password-reset-form");
  const requestMessage = document.getElementById("password-reset-message");

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.btlrSupabase) {
      if (requestMessage) requestMessage.textContent = "회원 서비스에 연결할 수 없습니다.";
      return;
    }
    const email = String(requestForm.elements.email?.value || document.getElementById("password-reset-email")?.value || "")
      .trim()
      .toLocaleLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (requestMessage) requestMessage.textContent = "가입할 때 사용한 이메일을 정확히 입력해 주세요.";
      return;
    }
    const button = requestForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}?mode=reset`;
      const { error } = await window.btlrSupabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (requestMessage) {
        requestMessage.textContent = error
          ? getFriendlyServiceError(error, "비밀번호 재설정 메일을 보내지 못했습니다.")
          : "입력한 이메일로 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해 주세요.";
        requestMessage.classList.toggle("success", !error);
      }
    } catch (error) {
      if (requestMessage) {
        requestMessage.textContent = getFriendlyServiceError(error, "비밀번호 재설정 메일을 보내지 못했습니다.");
        requestMessage.classList.remove("success");
      }
    } finally {
      if (button) button.disabled = false;
    }
  });

  const showUpdateForm = () => {
    if (document.getElementById("password-recovery-update-form")) return;
    const container = requestForm?.parentElement || document.querySelector(".auth-card") || document.querySelector("main");
    if (!container) return;
    const updateForm = document.createElement("form");
    updateForm.id = "password-recovery-update-form";
    updateForm.className = "auth-form password-recovery-update-form";
    updateForm.innerHTML = `
      <div><label for="recovery-new-password">새 비밀번호</label><input id="recovery-new-password" name="password" type="password" minlength="8" autocomplete="new-password" required /></div>
      <div><label for="recovery-new-password-confirm">새 비밀번호 확인</label><input id="recovery-new-password-confirm" name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required /></div>
      <button class="button button-primary button-full" type="submit">새 비밀번호 저장</button>
      <p class="form-message" role="alert"></p>
    `;
    if (requestForm) requestForm.hidden = true;
    container.appendChild(updateForm);
    updateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = String(updateForm.elements.password.value || "");
      const passwordConfirm = String(updateForm.elements.passwordConfirm.value || "");
      const status = updateForm.querySelector(".form-message");
      if (password.length < 8) {
        status.textContent = "새 비밀번호는 8자 이상 입력해 주세요.";
        return;
      }
      if (password !== passwordConfirm) {
        status.textContent = "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.";
        return;
      }
      const button = updateForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await window.btlrSupabase.auth.updateUser({ password });
        if (error) {
          status.textContent = getFriendlyServiceError(error, "비밀번호를 변경하지 못했습니다.");
          return;
        }
        status.textContent = "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.";
        status.classList.add("success");
        await window.btlrSupabase.auth.signOut();
        window.setTimeout(() => window.location.replace("login.html"), 900);
      } catch (error) {
        status.textContent = getFriendlyServiceError(error, "비밀번호를 변경하지 못했습니다.");
      } finally {
        button.disabled = false;
      }
    });
  };

  if (recoveryMode) showUpdateForm();
  window.btlrSupabase?.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") showUpdateForm();
  });
}

async function initAdminPage() {
  const user = getCurrentUser();
  const pageMessage = document.getElementById("admin-page-message");
  const content = document.getElementById("admin-content");
  const legacyAdminRoutes = {
    users: "admin-users.html",
    books: "admin-books.html",
    "room-reservations": "admin-reading-room.html",
    inquiries: "admin-inquiries.html",
  };
  const legacySection = window.location.hash.replace(/^#/, "");
  const isLegacyAdminPage = /(?:^|\/)admin\.html$/.test(window.location.pathname);

  if (isLegacyAdminPage) {
    window.location.replace(legacyAdminRoutes[legacySection] || legacyAdminRoutes.users);
    return;
  }

  if (!user) {
    sessionStorage.setItem("btlr_login_notice", "관리자 로그인 후 이용할 수 있습니다.");
    window.location.href = `login.html?next=${encodeURIComponent("admin.html")}`;
    return;
  }
  if (!isAdminUser(user)) {
    if (pageMessage) pageMessage.textContent = "관리자만 접근할 수 있는 페이지입니다.";
    return;
  }

  if (content) content.hidden = false;
  const adminSection = document.body.dataset.adminSection || "users";
  if (adminSection === "users") await renderAdminUsers();
  if (adminSection === "books") {
    await Promise.all([renderAdminBooks(), renderAdminBookRequests()]);
  }
  if (adminSection === "room-reservations") await renderAdminRoomReservations();
  if (adminSection === "inquiries") await renderAdminInquiries();

  document.getElementById("refresh-users")?.addEventListener("click", renderAdminUsers);
  document.getElementById("refresh-book-requests")?.addEventListener("click", renderAdminBookRequests);
  document.getElementById("refresh-admin-room-reservations")?.addEventListener("click", renderAdminRoomReservations);
  document.getElementById("refresh-admin-inquiries")?.addEventListener("click", renderAdminInquiries);
  document.getElementById("admin-room-reservation-list")?.addEventListener("click", handleAdminRoomReservationAction);
  document.getElementById("admin-inquiry-list")?.addEventListener("click", handleAdminInquiryImageAction);
  document.getElementById("admin-inquiry-list")?.addEventListener("submit", handleAdminInquiryAnswerSubmit);
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
  document.getElementById("admin-book-filter")?.addEventListener("submit", handleAdminBookFilter);
  document.getElementById("admin-book-query")?.addEventListener("input", handleAdminBookFilterInput);
  document.getElementById("admin-book-sort")?.addEventListener("change", handleAdminBookSortChange);
  document.getElementById("admin-book-filter-reset")?.addEventListener("click", resetAdminBookFilter);
  document.getElementById("admin-user-pagination")?.addEventListener("click", handleAdminPagination);
  document.getElementById("admin-book-pagination")?.addEventListener("click", handleAdminPagination);
  document.getElementById("admin-book-request-list")?.addEventListener("click", handleAdminBookRequestAction);
  document.getElementById("book-import-search-form")?.addEventListener("submit", searchBooksForImport);
  document.getElementById("book-import-select-all")?.addEventListener("change", toggleAllImportBooks);
  document.getElementById("book-import-submit")?.addEventListener("click", importSelectedBooks);
  document.getElementById("curated-book-import")?.addEventListener("click", importCuratedCategoryBooks);
  document.getElementById("repair-book-categories")?.addEventListener("click", repairExistingBookCategories);
  document.getElementById("admin-user-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyAdminUserFilters();
  });
  document.getElementById("admin-user-role-filter")?.addEventListener("change", applyAdminUserFilters);
  document.getElementById("admin-user-sort")?.addEventListener("change", applyAdminUserFilters);
  document.getElementById("admin-user-filter-reset")?.addEventListener("click", () => {
    document.getElementById("admin-user-filter")?.reset();
    applyAdminUserFilters();
  });
  const applyBookRequestFilters = () => {
    adminBookRequestFilterState = {
      query: String(document.getElementById("admin-book-request-query")?.value || "").trim(),
      status: document.getElementById("admin-book-request-status")?.value || "all",
      sort: document.getElementById("admin-book-request-sort")?.value || "newest",
    };
    adminBookRequestPage = 1;
    renderAdminBookRequestPage();
  };
  document.getElementById("admin-book-request-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyBookRequestFilters();
  });
  document.getElementById("admin-book-request-status")?.addEventListener("change", applyBookRequestFilters);
  document.getElementById("admin-book-request-sort")?.addEventListener("change", applyBookRequestFilters);
  document.getElementById("admin-book-request-filter-reset")?.addEventListener("click", () => {
    document.getElementById("admin-book-request-filter")?.reset();
    applyBookRequestFilters();
  });
  const applyRoomFilters = () => {
    adminRoomFilterState = {
      query: String(document.getElementById("admin-room-query")?.value || "").trim(),
      date: document.getElementById("admin-room-date-filter")?.value || "",
      sort: document.getElementById("admin-room-sort")?.value || "soonest",
    };
    adminRoomPage = 1;
    renderAdminRoomReservationPage();
  };
  document.getElementById("admin-room-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyRoomFilters();
  });
  document.getElementById("admin-room-date-filter")?.addEventListener("change", applyRoomFilters);
  document.getElementById("admin-room-sort")?.addEventListener("change", applyRoomFilters);
  document.getElementById("admin-room-filter-reset")?.addEventListener("click", () => {
    document.getElementById("admin-room-filter")?.reset();
    applyRoomFilters();
  });
  const applyInquiryFilters = () => {
    adminInquiryFilterState = {
      query: String(document.getElementById("admin-inquiry-query")?.value || "").trim(),
      status: document.getElementById("admin-inquiry-status-filter")?.value || "all",
      visibility: document.getElementById("admin-inquiry-visibility-filter")?.value || "all",
    };
    adminInquiryPage = 1;
    renderAdminInquiryPage();
  };
  document.getElementById("admin-inquiry-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyInquiryFilters();
  });
  document.getElementById("admin-inquiry-status-filter")?.addEventListener("change", applyInquiryFilters);
  document.getElementById("admin-inquiry-visibility-filter")?.addEventListener("change", applyInquiryFilters);
  document.getElementById("admin-inquiry-filter-reset")?.addEventListener("click", () => {
    document.getElementById("admin-inquiry-filter")?.reset();
    applyInquiryFilters();
  });
  document.addEventListener("click", handleManagedPagination);
  document.querySelectorAll("#admin-book-form, #admin-book-edit-form").forEach(bindBookFormEnhancements);
  if (adminSection === "books") await restoreAdminBookDraft();
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
  adminUsersCache = data || [];
  renderAdminUserPage();
}

function getFilteredAdminUsers() {
  const query = adminUserFilterState.query.toLocaleLowerCase("ko-KR");
  const users = adminUsersCache.filter((member) => {
    const matchesQuery = !query || [member.login_id, member.name, member.email]
      .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(query));
    const normalizedRole = member.is_primary_admin || member.role === "owner"
      || String(member.email || "").toLocaleLowerCase() === PRIMARY_ADMIN_EMAIL
      ? "owner"
      : member.role;
    return matchesQuery && (adminUserFilterState.role === "all" || normalizedRole === adminUserFilterState.role);
  });
  return users.sort((first, second) => {
    if (adminUserFilterState.sort === "oldest") return new Date(first.created_at || 0) - new Date(second.created_at || 0);
    if (adminUserFilterState.sort === "name") return String(first.name || "").localeCompare(String(second.name || ""), "ko");
    if (adminUserFilterState.sort === "recent-login") return new Date(second.last_sign_in_at || 0) - new Date(first.last_sign_in_at || 0);
    return new Date(second.created_at || 0) - new Date(first.created_at || 0);
  });
}

function applyAdminUserFilters() {
  adminUserFilterState = {
    query: String(document.getElementById("admin-user-query")?.value || "").trim(),
    role: document.getElementById("admin-user-role-filter")?.value || "all",
    sort: document.getElementById("admin-user-sort")?.value || "newest",
  };
  adminUserPage = 1;
  renderAdminUserPage();
}

function renderAdminUserPage() {
  const target = document.getElementById("admin-user-list");
  if (!target) return;
  const filteredMembers = getFilteredAdminUsers();
  const summary = document.getElementById("admin-user-filter-summary");
  if (summary) summary.textContent = `전체 ${adminUsersCache.length}명 중 ${filteredMembers.length}명`;
  if (!filteredMembers.length) {
    target.innerHTML = `<tr><td colspan="7">${adminUsersCache.length ? "검색 조건과 일치하는 회원이 없습니다." : "가입한 회원이 없습니다."}</td></tr>`;
    renderAdminPagination("users", 0);
    return;
  }
  const totalPages = Math.ceil(filteredMembers.length / ADMIN_PAGE_SIZE);
  adminUserPage = Math.min(Math.max(adminUserPage, 1), totalPages);
  const startIndex = (adminUserPage - 1) * ADMIN_PAGE_SIZE;
  const visibleMembers = filteredMembers.slice(startIndex, startIndex + ADMIN_PAGE_SIZE);
  target.innerHTML = visibleMembers.map((member) => {
    const isPrimaryAdmin = Boolean(member.is_primary_admin) || member.role === "owner"
      || String(member.email || "").trim().toLocaleLowerCase() === PRIMARY_ADMIN_EMAIL;
    return `
    <tr>
      <td>${escapeHTML(member.login_id || "-")}</td>
      <td><input class="admin-name-input" type="text" value="${escapeHTML(member.name || "")}" maxlength="30" data-name-input="${member.user_id}" ${isPrimaryAdmin ? "readonly" : ""} /></td>
      <td>${escapeHTML(member.email || "-")}</td>
      <td>${isPrimaryAdmin
        ? '<span class="admin-primary-role">주 관리자</span>'
        : `<select data-role-select="${member.user_id}"><option value="member" ${member.role === "member" ? "selected" : ""}>회원</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>부관리자</option></select>`}</td>
      <td>${formatDate(member.created_at)}</td>
      <td>${formatDate(member.last_sign_in_at)}</td>
      <td><div class="admin-row-actions">${isPrimaryAdmin
        ? '<span class="admin-primary-role">보호 계정</span>'
        : `<button class="table-action" type="button" data-admin-action="save-user" data-user-id="${member.user_id}">저장</button><button class="table-action danger" type="button" data-admin-action="delete-user" data-user-id="${member.user_id}" data-user-name="${escapeHTML(member.name || member.email || "회원")}">삭제</button>`}</div></td>
    </tr>
  `;
  }).join("");
  renderAdminPagination("users", filteredMembers.length);
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

function renderManagedPagination(targetId, type, currentPage, totalItems) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const totalPages = Math.ceil(totalItems / ADMIN_PAGE_SIZE);
  if (totalPages <= 1) {
    target.hidden = true;
    target.replaceChildren();
    return;
  }
  target.hidden = false;
  target.innerHTML = `
    <button type="button" data-managed-page-type="${type}" data-managed-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>이전</button>
    ${getAdminPaginationItems(currentPage, totalPages).map((item) => item === "ellipsis"
      ? '<span class="admin-pagination-ellipsis" aria-hidden="true">…</span>'
      : `<button type="button" data-managed-page-type="${type}" data-managed-page="${item}" class="${item === currentPage ? "active" : ""}" ${item === currentPage ? 'aria-current="page"' : ""}>${item}</button>`).join("")}
    <button type="button" data-managed-page-type="${type}" data-managed-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>다음</button>`;
}

function handleManagedPagination(event) {
  const button = event.target.closest("[data-managed-page]");
  if (!button || button.disabled) return;
  const page = Math.max(Number(button.dataset.managedPage) || 1, 1);
  if (button.dataset.managedPageType === "book-requests") {
    adminBookRequestPage = page;
    renderAdminBookRequestPage();
  } else if (button.dataset.managedPageType === "rooms") {
    adminRoomPage = page;
    renderAdminRoomReservationPage();
  } else if (button.dataset.managedPageType === "admin-inquiries") {
    adminInquiryPage = page;
    renderAdminInquiryPage();
  } else if (button.dataset.managedPageType === "public-inquiries") {
    publicInquiryPage = page;
    renderPublicInquiryPages();
  }
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
    const currentMember = adminUsersCache.find((member) => String(member.user_id) === String(userId));
    const nextName = String(input?.value || "").trim().replace(/\s+/g, " ");
    if (!nextName) {
      showToast("이름을 입력해 주세요.");
      return;
    }
    button.disabled = true;
    const { error } = await window.btlrSupabase.rpc("admin_update_user", {
      target_user_id: userId,
      next_name: nextName,
      next_role: roleSelect?.value || currentMember?.role || "member",
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
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "도서 검색에 실패했습니다.");
  const books = (Array.isArray(result.books) ? result.books : []).map((book) => {
    const normalizedDescriptions = normalizeBookDescriptions(book);
    return {
      ...book,
      category: String(book.category || category || "기타").trim() || "기타",
      keywords: normalizeBookKeywords(book.keywords, book.category || category),
      description: normalizedDescriptions.description,
      shortDescription: normalizedDescriptions.shortDescription,
    };
  });
  return { ...result, books };
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
  if (book?.descriptionNeedsRepair === true) return true;
  const description = String(book?.originalDescription ?? book?.description ?? "").trim();
  return !description || /(?:\.{2,}|…+)\s*$/.test(description);
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
        description: book.originalDescription ?? book.description ?? "",
        shortDescription: book.originalShortDescription ?? book.shortDescription ?? "",
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
    || (book.originalKeywords || []).some((keyword) => String(keyword).trim().toLocaleLowerCase("ko-KR") === String(book.category || "").trim().toLocaleLowerCase("ko-KR"))
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
        const locallyNormalizedDescriptions = normalizeBookDescriptions({
          ...book,
          description: book.originalDescription ?? book.description,
          shortDescription: book.originalShortDescription ?? book.shortDescription,
        });
        const needsAiCategory = !BOOK_CATEGORIES.includes(String(book.category || "").trim())
          || (book.category !== "만화" && isLikelyComicBook(book));
        const needsAiDescription = isBookDescriptionIncomplete(book)
          && locallyNormalizedDescriptions.description === String(book.originalDescription ?? book.description ?? "").trim();
        if (!needsAiCategory && !needsAiDescription) {
          const { data, error } = await window.btlrSupabase
            .from("books")
            .update({
              keywords: normalizeBookKeywords(book.originalKeywords || book.keywords, book.category),
              description: locallyNormalizedDescriptions.description,
              short_description: locallyNormalizedDescriptions.shortDescription,
            })
            .eq("id", book.id)
            .select("id")
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error("도서 수정 권한이 없거나 해당 도서를 찾지 못했습니다.");
          repairedCount += 1;
          consecutiveFailures = 0;
          continue;
        }

        const metadata = await requestBookRepairMetadata(book, accessToken);
        if (!BOOK_CATEGORIES.includes(metadata.category)) throw new Error("올바른 카테고리를 받지 못했습니다.");

        const normalizedDescriptions = normalizeBookDescriptions({
          ...book,
          description: metadata.description,
          shortDescription: metadata.shortDescription,
        });
        const keywords = normalizeBookKeywords(metadata.keywords, metadata.category);
        const { data, error } = await window.btlrSupabase
          .from("books")
          .update({
            category: metadata.category,
            keywords,
            description: normalizedDescriptions.description,
            short_description: normalizedDescriptions.shortDescription,
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
        ? `${adminBookImportResults.length}권을 불러왔습니다. 추가할 도서를 선택해 주세요.${result.enrichmentStatus === "partial" || result.enrichmentStatus === "failed" ? " 일부 AI 보완 정보는 기본 도서 정보로 대신했습니다." : ""}`
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
    adminBookRequestsCache = [];
    target.innerHTML = `<p class="admin-empty">${escapeHTML(error.message)}</p>`;
    renderManagedPagination("admin-book-request-pagination", "book-requests", 1, 0);
    return;
  }
  adminBookRequestsCache = (data || []).map((request) => ({
    ...request,
    status: request.status || "pending",
  }));
  renderAdminBookRequestPage();
}

function getFilteredAdminBookRequests() {
  const query = adminBookRequestFilterState.query.toLocaleLowerCase("ko-KR");
  return adminBookRequestsCache.filter((request) => {
    const matchesQuery = !query || [request.title, request.requester_name, request.requester_login_id, request.requester_email]
      .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(query));
    return matchesQuery && (adminBookRequestFilterState.status === "all" || request.status === adminBookRequestFilterState.status);
  }).sort((first, second) => {
    if (adminBookRequestFilterState.sort === "oldest") return new Date(first.requested_at || 0) - new Date(second.requested_at || 0);
    if (adminBookRequestFilterState.sort === "title") return String(first.title || "").localeCompare(String(second.title || ""), "ko");
    return new Date(second.requested_at || 0) - new Date(first.requested_at || 0);
  });
}

function renderAdminBookRequestPage() {
  const target = document.getElementById("admin-book-request-list");
  if (!target) return;
  const requests = getFilteredAdminBookRequests();
  const summary = document.getElementById("admin-book-request-filter-summary");
  if (summary) summary.textContent = `전체 ${adminBookRequestsCache.length}건 중 ${requests.length}건`;
  if (!requests.length) {
    target.innerHTML = `<div class="request-empty"><span>✓</span><strong>${adminBookRequestsCache.length ? "검색 조건과 일치하는 요청이 없습니다." : "처리할 도서 요청이 없습니다."}</strong></div>`;
    renderManagedPagination("admin-book-request-pagination", "book-requests", 1, 0);
    return;
  }
  const totalPages = Math.ceil(requests.length / ADMIN_PAGE_SIZE);
  adminBookRequestPage = Math.min(Math.max(adminBookRequestPage, 1), totalPages);
  const visibleRequests = requests.slice((adminBookRequestPage - 1) * ADMIN_PAGE_SIZE, adminBookRequestPage * ADMIN_PAGE_SIZE);
  target.innerHTML = visibleRequests.map((request) => `
    <article class="admin-request-card">
      <div class="admin-request-cover">
        ${request.thumbnail
          ? `<img src="${escapeHTML(request.thumbnail)}" alt="${escapeHTML(request.title)} 표지" />`
          : '<span class="cover-fallback" aria-hidden="true">B</span>'}
      </div>
      <div class="admin-request-copy">
        <span class="request-status status-${escapeHTML(request.status || "pending")}">${({ pending: "승인 대기", approved: "추가 완료", rejected: "요청 거절", cancelled: "요청 취소" })[request.status] || "승인 대기"}</span>
        <h4>${escapeHTML(request.title)}</h4>
        <p>${escapeHTML(request.author)}${request.publisher ? ` · ${escapeHTML(request.publisher)}` : ""}</p>
        <small>${escapeHTML(request.category || "기타")} · 요청자 ${escapeHTML(request.requester_name || request.requester_login_id || request.requester_email || "회원")} · ${formatDate(request.requested_at)}</small>
      </div>
      <div class="admin-row-actions">
        ${request.status && request.status !== "pending" ? "" : `<button class="table-action" type="button" data-book-request-action="approve" data-request-id="${request.request_id}">추가 승인</button><button class="table-action danger" type="button" data-book-request-action="reject" data-request-id="${request.request_id}" data-request-title="${escapeHTML(request.title)}">거절</button>`}
      </div>
    </article>
  `).join("");
  renderManagedPagination("admin-book-request-pagination", "book-requests", adminBookRequestPage, requests.length);
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

function getFilteredAdminBooks() {
  const normalizedQuery = adminBookSearchQuery.trim().toLocaleLowerCase("ko-KR");
  const filteredBooks = getBooks().filter((book) => {
    if (!normalizedQuery) return true;
    return [book.title, book.author]
      .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  });

  const collator = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });
  return filteredBooks.sort((firstBook, secondBook) => {
    if (adminBookSort === "title") return collator.compare(firstBook.title || "", secondBook.title || "");
    if (adminBookSort === "author") return collator.compare(firstBook.author || "", secondBook.author || "");
    if (adminBookSort === "category") {
      return collator.compare(firstBook.category || "", secondBook.category || "")
        || collator.compare(firstBook.title || "", secondBook.title || "");
    }
    if (adminBookSort === "stock-low") {
      return Number(firstBook.availableQuantity || 0) - Number(secondBook.availableQuantity || 0)
        || collator.compare(firstBook.title || "", secondBook.title || "");
    }
    if (adminBookSort === "stock-high") {
      return Number(secondBook.availableQuantity || 0) - Number(firstBook.availableQuantity || 0)
        || collator.compare(firstBook.title || "", secondBook.title || "");
    }
    return new Date(secondBook.createdAt || 0) - new Date(firstBook.createdAt || 0);
  });
}

function updateAdminBookFilterSummary(filteredCount) {
  const summary = document.getElementById("admin-book-filter-summary");
  if (!summary) return;
  const totalCount = getBooks().length;
  summary.textContent = adminBookSearchQuery
    ? `전체 ${totalCount}권 중 ${filteredCount}권을 찾았습니다.`
    : `전체 ${totalCount}권`;
}

function applyAdminBookFilter() {
  adminBookPage = 1;
  adminSelectedBookIds.clear();
  renderAdminBookPage();
}

function handleAdminBookFilter(event) {
  event.preventDefault();
  adminBookSearchQuery = String(document.getElementById("admin-book-query")?.value || "").trim();
  applyAdminBookFilter();
}

function handleAdminBookFilterInput(event) {
  adminBookSearchQuery = String(event.currentTarget.value || "").trim();
  applyAdminBookFilter();
}

function handleAdminBookSortChange(event) {
  adminBookSort = event.currentTarget.value || "newest";
  applyAdminBookFilter();
}

function resetAdminBookFilter() {
  const queryInput = document.getElementById("admin-book-query");
  const sortSelect = document.getElementById("admin-book-sort");
  if (queryInput) queryInput.value = "";
  if (sortSelect) sortSelect.value = "newest";
  adminBookSearchQuery = "";
  adminBookSort = "newest";
  applyAdminBookFilter();
  queryInput?.focus();
}

function renderAdminBookPage() {
  const target = document.getElementById("admin-book-list");
  if (!target) return;
  if (booksLoadState === "loading") {
    target.innerHTML = '<p class="admin-empty">도서 목록을 불러오는 중...</p>';
    return;
  }
  if (booksLoadState === "error") {
    target.innerHTML = `<div class="admin-empty"><p>${escapeHTML(booksLoadError || "도서 목록을 불러오지 못했습니다.")}</p><button class="table-action" type="button" data-retry-admin-books>다시 시도</button></div>`;
    renderAdminPagination("books", 0);
    updateAdminBookBulkToolbar([]);
    return;
  }
  const allBooks = getBooks();
  const books = getFilteredAdminBooks();
  const existingIds = new Set(allBooks.map((book) => book.id));
  [...adminSelectedBookIds].forEach((id) => {
    if (!existingIds.has(id)) adminSelectedBookIds.delete(id);
  });
  updateAdminBookFilterSummary(books.length);
  if (!books.length) {
    target.innerHTML = adminBookSearchQuery
      ? '<p class="admin-empty">제목 또는 저자와 일치하는 도서가 없습니다.</p>'
      : '<p class="admin-empty">등록된 도서가 없습니다.</p>';
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
  const books = getFilteredAdminBooks();
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
  if (!window.confirm(`선택한 도서 ${ids.length}권을 도서 목록에서 삭제할까요? 대출 이력은 보존됩니다.`)) return;

  const button = document.getElementById("admin-book-delete-selected");
  const originalText = button?.textContent || "선택 도서 삭제";
  if (button) {
    button.disabled = true;
    button.textContent = "삭제 중...";
  }

  try {
    for (let index = 0; index < ids.length; index += 50) {
      const { error } = await window.btlrSupabase.rpc("admin_archive_books", {
        target_book_ids: ids.slice(index, index + 50),
      });
      if (error) throw error;
    }
    adminSelectedBookIds.clear();
    showToast(`${ids.length}권을 삭제했습니다.`);
    await renderAdminBooks();
  } catch (error) {
    showToast(getFriendlyServiceError(error, "선택한 도서를 삭제하지 못했습니다."));
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
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "AI 자동 입력에 실패했습니다.");

    const normalizedDescriptions = normalizeBookDescriptions({
      title,
      author: result.author || author,
      description: result.description,
      shortDescription: result.shortDescription,
    });

    const fieldMap = {
      author: result.author,
      publisher: result.publisher,
      publishedDate: result.publishedDate,
      category: result.category,
      keywords: normalizeBookKeywords(result.keywords, result.category).join(", "),
      shortDescription: normalizedDescriptions.shortDescription,
      description: normalizedDescriptions.description,
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
  if (!file) return { url: String(form.elements.thumbnail.value || ""), path: "" };
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
  return { url: data.publicUrl, path: filePath };
}

function getBookCoverStoragePath(publicUrl) {
  const marker = "/storage/v1/object/public/book-covers/";
  const value = String(publicUrl || "");
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return "";
  try {
    return decodeURIComponent(value.slice(markerIndex + marker.length));
  } catch {
    return value.slice(markerIndex + marker.length);
  }
}

async function removeBookCoverStorageFiles(paths) {
  const uniquePaths = [...new Set((paths || []).filter(Boolean))];
  if (!uniquePaths.length || !window.btlrSupabase) return;
  const { error } = await window.btlrSupabase.storage.from("book-covers").remove(uniquePaths);
  if (error) console.warn("사용하지 않는 표지 이미지를 정리하지 못했습니다.", error);
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
  let uploadedCoverPath = "";

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

    // AI 보완은 편의 기능입니다. 실패해도 완결된 기본 설명으로 저장할 수 있습니다.
    if (!isEdit && needsBookMetadata(form)) {
      showBookFormMessage(form, "AI가 빈 도서 정보를 작성하고 있습니다...");
      const aiResult = await fillBookMetadataWithAI(form);
      if (!aiResult.success) {
        showBookFormMessage(form, `${aiResult.message} 기본 정보로 계속 저장합니다.`);
      }
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
    uploadedCoverPath = coverResult.path || "";

    const previousBook = isEdit ? getBookById(originalId) : null;
    const book = {
      id: generatedId,
      title: String(values.title || "").trim(),
      author: String(values.author || "").trim(),
      publisher: String(values.publisher || "").trim(),
      publishedDate: values.publishedDate || null,
      category: String(values.category || "기타").trim(),
      keywords: normalizeBookKeywords(values.keywords, values.category),
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
    const previousCoverPath = getBookCoverStoragePath(previousBook?.thumbnail);
    if (isEdit && coverResult.path && previousCoverPath && previousCoverPath !== coverResult.path) {
      await removeBookCoverStorageFiles([previousCoverPath]);
    }
    await renderAdminBooks();
  } catch (error) {
    if (uploadedCoverPath) await removeBookCoverStorageFiles([uploadedCoverPath]);
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
  if (event.target.closest("[data-retry-admin-books]")) {
    await renderAdminBooks();
    return;
  }
  const button = event.target.closest("[data-admin-book-action]");
  if (!button) return;
  const book = getBookById(button.dataset.bookId);
  if (!book) return;
  if (button.dataset.adminBookAction === "edit") {
    openAdminBookDialog(book);
    return;
  }
  if (!window.confirm(`'${book.title}' 도서를 삭제할까요?`)) return;
  const { error } = await window.btlrSupabase.rpc("admin_archive_book", { target_book_id: book.id });
  showToast(error ? getFriendlyServiceError(error, "도서를 삭제하지 못했습니다.") : "도서를 삭제했습니다.");
  if (!error) {
    booksCache = booksCache.filter((item) => item.id !== book.id);
    await renderAdminBooks();
  }
}

function formatRoomTime(value) {
  return String(value || "").slice(0, 5) || "-";
}

function groupReadingRoomReservations(rows) {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const groupId = row.reservation_group_id || row.id;
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: row.id,
        groupId,
        userId: row.user_id,
        userName: row.user_name || "",
        userEmail: row.user_email || "",
        userLoginId: row.user_login_id || row.login_id || "",
        reservationDate: row.reservation_date,
        startTime: formatRoomTime(row.start_time),
        endTime: formatRoomTime(row.end_time),
        seatNumbers: [],
        createdAt: row.created_at,
      });
    }
    const seatNumbers = Array.isArray(row.seat_numbers) ? row.seat_numbers : [row.seat_number];
    seatNumbers.filter((seat) => Number.isInteger(Number(seat))).forEach((seat) => {
      const normalizedSeat = Number(seat);
      if (!groups.get(groupId).seatNumbers.includes(normalizedSeat)) {
        groups.get(groupId).seatNumbers.push(normalizedSeat);
      }
    });
  });
  return [...groups.values()].map((group) => ({
    ...group,
    seatNumbers: group.seatNumbers.sort((a, b) => a - b),
  }));
}

function createRoomReservationCard(reservation, options = {}) {
  const isAdminView = options.admin === true;
  const identity = isAdminView
    ? `<div class="room-management-user"><strong>${escapeHTML(reservation.userName || "이름 없음")}</strong><span>${escapeHTML(reservation.userEmail || "-")}</span></div>`
    : "";
  return `
    <article class="room-management-card">
      <div class="room-management-date"><span>${escapeHTML(formatDate(reservation.reservationDate))}</span><strong>${escapeHTML(reservation.startTime)}–${escapeHTML(reservation.endTime)}</strong></div>
      ${identity}
      <div class="room-management-seats"><small>예약 좌석</small><strong>${reservation.seatNumbers.map((seat) => `${seat}번`).join(", ")}</strong><span>총 ${reservation.seatNumbers.length}석</span></div>
      <button class="button button-danger" type="button" ${isAdminView ? `data-admin-cancel-room="${escapeHTML(reservation.groupId)}"` : `data-mypage-cancel-room="${escapeHTML(reservation.id)}"`} data-room-seat-count="${reservation.seatNumbers.length}">예약 취소</button>
    </article>
  `;
}

async function loadMyPageRoomReservations() {
  const target = document.getElementById("mypage-reading-room-list");
  const user = getCurrentUser();
  if (!target || !user || !window.btlrSupabase) return;
  target.innerHTML = '<p class="request-loading">열람실 예약을 불러오는 중...</p>';
  const { data, error } = await window.btlrSupabase
    .from("reading_room_reservations")
    .select("id, reservation_group_id, user_id, seat_number, reservation_date, start_time, end_time, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .gte("reservation_date", getLocalDateInputValue())
    .order("reservation_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) {
    setText("reading-room-count", 0);
    target.innerHTML = `<div class="request-empty compact"><strong>예약 현황을 불러오지 못했습니다.</strong><p>${escapeHTML(error.message)}</p></div>`;
    return;
  }
  const reservations = groupReadingRoomReservations((data || []).filter((reservation) => isReadingRoomReservationUpcoming(reservation)));
  setText("reading-room-count", reservations.length);
  if (!reservations.length) {
    target.innerHTML = '<div class="request-empty compact"><span>⌑</span><strong>예정된 열람실 예약이 없습니다.</strong><p>열람실 배치도에서 원하는 시간과 좌석을 선택해 보세요.</p><a class="button button-primary" href="reading-room.html">열람실 예약하기</a></div>';
    return;
  }
  target.innerHTML = reservations.map((reservation) => createRoomReservationCard(reservation)).join("");
}

async function handleMyPageRoomReservationAction(event) {
  const button = event.target.closest("[data-mypage-cancel-room]");
  if (!button) return;
  const seatCount = Number(button.dataset.roomSeatCount) || 1;
  if (!window.confirm(`예약한 ${seatCount}개 좌석을 모두 취소할까요?`)) return;
  button.disabled = true;
  const { error } = await window.btlrSupabase.rpc("cancel_reading_room_reservation", {
    target_reservation_id: button.dataset.mypageCancelRoom,
  });
  showToast(error ? error.message : "열람실 예약을 취소했습니다.");
  if (error) button.disabled = false;
  else await loadMyPageRoomReservations();
}

async function renderAdminRoomReservations() {
  const target = document.getElementById("admin-room-reservation-list");
  if (!target || !window.btlrSupabase) return;
  target.innerHTML = '<p class="request-loading">열람실 예약을 불러오는 중...</p>';
  const { data, error } = await window.btlrSupabase.rpc("admin_list_reading_room_reservations");
  if (error) {
    adminRoomReservationsCache = [];
    target.innerHTML = `<div class="request-empty compact"><strong>예약 목록을 불러오지 못했습니다.</strong><p>${escapeHTML(error.message)}</p></div>`;
    renderManagedPagination("admin-room-pagination", "rooms", 1, 0);
    return;
  }
  adminRoomReservationsCache = groupReadingRoomReservations((data || []).filter((reservation) => isReadingRoomReservationUpcoming(reservation)));
  renderAdminRoomReservationPage();
}

function getFilteredAdminRoomReservations() {
  const query = adminRoomFilterState.query.toLocaleLowerCase("ko-KR");
  return adminRoomReservationsCache.filter((reservation) => {
    const matchesQuery = !query || [reservation.userName, reservation.userEmail, reservation.userLoginId]
      .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(query));
    return matchesQuery && (!adminRoomFilterState.date || reservation.reservationDate === adminRoomFilterState.date);
  }).sort((first, second) => {
    if (adminRoomFilterState.sort === "name") return String(first.userName || "").localeCompare(String(second.userName || ""), "ko");
    const firstTime = getReadingRoomDateTime(first.reservationDate, first.startTime)?.getTime() || 0;
    const secondTime = getReadingRoomDateTime(second.reservationDate, second.startTime)?.getTime() || 0;
    return adminRoomFilterState.sort === "latest" ? secondTime - firstTime : firstTime - secondTime;
  });
}

function renderAdminRoomReservationPage() {
  const target = document.getElementById("admin-room-reservation-list");
  if (!target) return;
  const reservations = getFilteredAdminRoomReservations();
  const summary = document.getElementById("admin-room-filter-summary");
  if (summary) summary.textContent = `예정 예약 ${adminRoomReservationsCache.length}건 중 ${reservations.length}건`;
  if (!reservations.length) {
    target.innerHTML = `<div class="request-empty compact"><span>✓</span><strong>${adminRoomReservationsCache.length ? "검색 조건과 일치하는 예약이 없습니다." : "예정된 열람실 예약이 없습니다."}</strong><p>새 예약이 등록되면 이곳에 표시됩니다.</p></div>`;
    renderManagedPagination("admin-room-pagination", "rooms", 1, 0);
    return;
  }
  const totalPages = Math.ceil(reservations.length / ADMIN_PAGE_SIZE);
  adminRoomPage = Math.min(Math.max(adminRoomPage, 1), totalPages);
  const visibleReservations = reservations.slice((adminRoomPage - 1) * ADMIN_PAGE_SIZE, adminRoomPage * ADMIN_PAGE_SIZE);
  target.innerHTML = visibleReservations.map((reservation) => createRoomReservationCard(reservation, { admin: true })).join("");
  renderManagedPagination("admin-room-pagination", "rooms", adminRoomPage, reservations.length);
}

async function handleAdminRoomReservationAction(event) {
  const button = event.target.closest("[data-admin-cancel-room]");
  if (!button) return;
  const seatCount = Number(button.dataset.roomSeatCount) || 1;
  if (!window.confirm(`회원의 열람실 예약 ${seatCount}석을 모두 취소할까요?`)) return;
  button.disabled = true;
  const { error } = await window.btlrSupabase.rpc("admin_cancel_reading_room_reservation", {
    target_reservation_group_id: button.dataset.adminCancelRoom,
  });
  showToast(error ? error.message : "회원의 열람실 예약을 취소했습니다.");
  if (error) button.disabled = false;
  else await renderAdminRoomReservations();
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
  if (isAdminUser(user)) {
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
    (data || []).filter((reservation) => isReadingRoomReservationUpcoming(reservation)).forEach((reservation) => {
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

function inquiryTextMarkup(value) {
  return escapeHTML(value || "").replace(/\n/g, "<br />");
}

async function getInquirySignedImageUrl(imagePath) {
  if (!imagePath || !window.btlrSupabase) return "";
  const { data, error } = await window.btlrSupabase.storage
    .from("inquiry-images")
    .createSignedUrl(imagePath, 3600);
  return error ? "" : (data?.signedUrl || "");
}

async function attachInquiryImageUrls(inquiries) {
  return Promise.all((inquiries || []).map(async (inquiry) => {
    const imagePaths = [...new Set([
      ...(Array.isArray(inquiry.image_paths) ? inquiry.image_paths : []),
      inquiry.image_path,
    ].filter(Boolean))].slice(0, 10);
    const signedImageUrls = inquiry.can_view
      ? (await Promise.all(imagePaths.map(getInquirySignedImageUrl))).filter(Boolean)
      : [];
    return {
      ...inquiry,
      imagePaths,
      signedImageUrls,
      signedImageUrl: signedImageUrls[0] || "",
    };
  }));
}

function createInquiryImagesMarkup(inquiry) {
  const imageUrls = Array.isArray(inquiry.signedImageUrls)
    ? inquiry.signedImageUrls
    : inquiry.signedImageUrl ? [inquiry.signedImageUrl] : [];
  if (!imageUrls.length) return "";
  return `<div class="inquiry-image-gallery">${imageUrls.map((url, index) => `
    <button class="inquiry-image-button" type="button" data-inquiry-image="${escapeHTML(url)}" aria-label="문의 첨부 사진 ${index + 1} 크게 보기">
      <img src="${escapeHTML(url)}" alt="문의 첨부 사진 ${index + 1}" loading="lazy" decoding="async" />
    </button>
  `).join("")}</div>`;
}

function createInquiryAnswerMarkup(inquiry, options = {}) {
  const answer = String(inquiry.answer || "").trim();
  if (!inquiry.is_answered) {
    return '<div class="inquiry-answer is-pending"><strong>답변 대기</strong><p>관리자가 문의 내용을 확인하고 있습니다.</p></div>';
  }
  if (inquiry.is_secret && !inquiry.can_view) {
    return '<div class="inquiry-answer is-secret"><strong>관리자 답변</strong><p>비밀 답변입니다.</p></div>';
  }
  return `<div class="inquiry-answer"><strong>관리자 답변</strong><p>${inquiryTextMarkup(answer)}</p><small>${formatDate(inquiry.answered_at)}</small></div>`;
}

function createPublicInquiryCard(inquiry) {
  const secret = Boolean(inquiry.is_secret);
  const canView = Boolean(inquiry.can_view);
  const publicTitle = secret ? "비밀글입니다" : (inquiry.title || "제목 없음");
  const publicAuthor = secret ? "익명" : (inquiry.author_name || "회원");
  let bodyMarkup;
  if (secret && !canView) {
    bodyMarkup = `
      <div class="inquiry-secret-placeholder"><span aria-hidden="true">🔒</span><p>작성자와 관리자만 내용을 확인할 수 있습니다.</p></div>
      ${createInquiryAnswerMarkup(inquiry)}
    `;
  } else if (secret) {
    bodyMarkup = `
      <details class="inquiry-private-detail">
        <summary>내 비밀 문의 내용 확인</summary>
        <div class="inquiry-private-content"><strong>${escapeHTML(inquiry.title || "비밀 문의")}</strong><p>${inquiryTextMarkup(inquiry.content)}</p>${createInquiryImagesMarkup(inquiry)}${createInquiryAnswerMarkup(inquiry)}</div>
      </details>
    `;
  } else {
    bodyMarkup = `
      <p class="inquiry-content">${inquiryTextMarkup(inquiry.content)}</p>
      ${createInquiryImagesMarkup(inquiry)}
      ${createInquiryAnswerMarkup(inquiry)}
    `;
  }
  const ownerActions = inquiry.is_owner && !inquiry.is_answered
    ? `<div class="inquiry-owner-actions">
        <button class="button button-secondary" type="button" data-edit-inquiry="${escapeHTML(inquiry.id)}">수정</button>
        <button class="button button-danger" type="button" data-delete-inquiry="${escapeHTML(inquiry.id)}">삭제</button>
      </div>`
    : "";
  return `
    <article class="inquiry-card${secret ? " is-secret" : ""}">
      <header><div><span class="inquiry-status ${inquiry.is_answered ? "is-answered" : ""}">${inquiry.is_answered ? "답변 완료" : "답변 대기"}</span><h3>${escapeHTML(publicTitle)}</h3></div>${secret ? '<span class="inquiry-lock" aria-label="비밀글">🔒</span>' : ""}</header>
      <div class="inquiry-meta"><span>${escapeHTML(publicAuthor)}</span><time>${formatDate(inquiry.created_at)}</time></div>
      ${bodyMarkup}
      ${ownerActions}
    </article>
  `;
}

async function loadInquiryBoard() {
  const target = document.getElementById("inquiry-list");
  const pendingPanel = document.getElementById("my-pending-inquiry-panel");
  const pendingTarget = document.getElementById("my-pending-inquiry-list");
  if (!target || !window.btlrSupabase) return;
  target.innerHTML = '<p class="request-loading">문의 게시판을 불러오는 중...</p>';
  const { data, error } = await window.btlrSupabase.rpc("list_inquiries");
  if (error) {
    target.innerHTML = `<div class="request-empty"><strong>문의 게시판을 불러오지 못했습니다.</strong><p>${escapeHTML(error.message)}</p></div>`;
    return;
  }
  const inquiries = await attachInquiryImageUrls(data || []);
  inquiriesCache = inquiries;
  const answeredInquiries = inquiries.filter((inquiry) => inquiry.is_answered);
  const myPendingInquiries = inquiries.filter((inquiry) => inquiry.is_owner && !inquiry.is_answered);
  if (pendingPanel && pendingTarget) {
    pendingPanel.hidden = myPendingInquiries.length === 0;
    pendingTarget.innerHTML = myPendingInquiries.map(createPublicInquiryCard).join("");
  }
  publicInquiryPage = Math.min(publicInquiryPage, Math.max(Math.ceil(answeredInquiries.length / ADMIN_PAGE_SIZE), 1));
  renderPublicInquiryPages();
}

function renderPublicInquiryPages() {
  const target = document.getElementById("inquiry-list");
  if (!target) return;
  const answeredInquiries = inquiriesCache.filter((inquiry) => inquiry.is_answered);
  if (!answeredInquiries.length) {
    target.innerHTML = '<div class="request-empty"><span>✉</span><strong>아직 공개된 문의 답변이 없습니다.</strong><p>관리자 답변이 등록된 문의만 이 게시판에 표시됩니다.</p></div>';
    renderManagedPagination("inquiry-pagination", "public-inquiries", 1, 0);
    return;
  }
  const totalPages = Math.ceil(answeredInquiries.length / ADMIN_PAGE_SIZE);
  publicInquiryPage = Math.min(Math.max(publicInquiryPage, 1), totalPages);
  const visible = answeredInquiries.slice((publicInquiryPage - 1) * ADMIN_PAGE_SIZE, publicInquiryPage * ADMIN_PAGE_SIZE);
  target.innerHTML = visible.map(createPublicInquiryCard).join("");
  renderManagedPagination("inquiry-pagination", "public-inquiries", publicInquiryPage, answeredInquiries.length);
}

function openInquiryEditDialog(inquiryId) {
  const inquiry = inquiriesCache.find((item) => item.id === inquiryId);
  const dialog = document.getElementById("inquiry-edit-dialog");
  const form = document.getElementById("inquiry-edit-form");
  if (!inquiry || !inquiry.is_owner || inquiry.is_answered || !dialog || !form) return;
  form.dataset.inquiryId = inquiry.id;
  form.elements.title.value = inquiry.title || "";
  form.elements.content.value = inquiry.content || "";
  form.elements.isSecret.checked = Boolean(inquiry.is_secret);
  form.dataset.originalImagePaths = JSON.stringify(inquiry.imagePaths || []);
  let attachmentEditor = form.querySelector("[data-inquiry-edit-attachments]");
  if (!attachmentEditor) {
    attachmentEditor = document.createElement("section");
    attachmentEditor.dataset.inquiryEditAttachments = "true";
    attachmentEditor.className = "inquiry-edit-attachments";
    const note = form.querySelector(".inquiry-edit-note");
    note?.replaceWith(attachmentEditor);
  }
  const signedUrls = Array.isArray(inquiry.signedImageUrls) ? inquiry.signedImageUrls : [];
  attachmentEditor.innerHTML = `
    <div><strong>첨부 사진</strong><small>유지할 사진은 그대로 두고, 삭제할 사진만 선택하세요. 전체 최대 10장입니다.</small></div>
    <div class="inquiry-image-preview inquiry-edit-existing-images">
      ${(inquiry.imagePaths || []).length
        ? inquiry.imagePaths.map((path, index) => `
          <label class="inquiry-edit-image-item">
            ${signedUrls[index] ? `<img src="${escapeHTML(signedUrls[index])}" alt="기존 첨부 사진 ${index + 1}" loading="lazy" decoding="async" />` : `<span>사진 ${index + 1}</span>`}
            <input type="checkbox" value="${escapeHTML(path)}" data-remove-inquiry-image />
            <span>이 사진 삭제</span>
          </label>`).join("")
        : "<span>기존 첨부 사진이 없습니다.</span>"}
    </div>
    <label>새 사진 추가 <small>JPG, PNG, WEBP · 장당 5MB 이하</small><input type="file" name="newImages" accept="image/jpeg,image/png,image/webp" multiple /></label>
  `;
  document.getElementById("inquiry-edit-character-count").textContent = String(form.elements.content.value.length);
  document.getElementById("inquiry-edit-message").textContent = "";
  dialog.showModal();
  form.elements.title.focus();
}

async function submitInquiryEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting === "true" || !form.reportValidity()) return;
  const title = String(form.elements.title.value || "").trim();
  const content = String(form.elements.content.value || "").trim();
  const message = document.getElementById("inquiry-edit-message");
  if (!title || title.length > 100 || !content || content.length > 1000) {
    message.textContent = "제목과 1000자 이내의 문의 내용을 확인해 주세요.";
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  form.dataset.submitting = "true";
  submitButton.disabled = true;
  submitButton.textContent = "저장 중...";
  const originalImagePaths = JSON.parse(form.dataset.originalImagePaths || "[]");
  const pathsToRemove = new Set([...form.querySelectorAll("[data-remove-inquiry-image]:checked")].map((input) => input.value));
  const retainedPaths = originalImagePaths.filter((path) => !pathsToRemove.has(path));
  const newFiles = form.elements.newImages?.files || [];
  if (retainedPaths.length + newFiles.length > 10) {
    message.textContent = "문의 사진은 기존 사진과 새 사진을 합쳐 최대 10장까지 첨부할 수 있습니다.";
    delete form.dataset.submitting;
    submitButton.disabled = false;
    submitButton.textContent = "저장";
    return;
  }

  const uploadResult = await uploadInquiryImages(newFiles, getCurrentUser()?.id);
  if (uploadResult.error) {
    if (uploadResult.paths.length) await window.btlrSupabase.storage.from("inquiry-images").remove(uploadResult.paths);
    message.textContent = getFriendlyServiceError(uploadResult.error, "새 문의 사진을 업로드하지 못했습니다.");
    delete form.dataset.submitting;
    submitButton.disabled = false;
    submitButton.textContent = "저장";
    return;
  }
  const nextImagePaths = [...retainedPaths, ...uploadResult.paths];
  const { data: removedPaths, error } = await window.btlrSupabase.rpc("update_my_inquiry", {
    target_inquiry_id: form.dataset.inquiryId,
    next_title: title,
    next_content: content,
    next_is_secret: Boolean(form.elements.isSecret.checked),
    next_image_paths: nextImagePaths,
  });
  delete form.dataset.submitting;
  submitButton.disabled = false;
  submitButton.textContent = "저장";
  if (error) {
    if (uploadResult.paths.length) await window.btlrSupabase.storage.from("inquiry-images").remove(uploadResult.paths);
    message.textContent = getFriendlyServiceError(error, "문의를 수정하지 못했습니다.");
    return;
  }
  if (Array.isArray(removedPaths) && removedPaths.length) {
    await window.btlrSupabase.storage.from("inquiry-images").remove(removedPaths.filter(Boolean));
  }
  document.getElementById("inquiry-edit-dialog")?.close();
  showToast("문의를 수정했습니다.");
  await loadInquiryBoard();
}

async function deleteMyInquiry(inquiryId) {
  const inquiry = inquiriesCache.find((item) => item.id === inquiryId);
  if (!inquiry?.is_owner || inquiry.is_answered) return;
  if (!window.confirm("이 문의를 삭제할까요? 삭제한 문의는 복구할 수 없습니다.")) return;
  const { data, error } = await window.btlrSupabase.rpc("delete_my_inquiry", {
    target_inquiry_id: inquiryId,
  });
  if (error) {
    showToast(error.message);
    return;
  }
  const imagePaths = Array.isArray(data) ? data.filter(Boolean) : [];
  if (imagePaths.length) {
    await window.btlrSupabase.storage.from("inquiry-images").remove(imagePaths);
  }
  showToast("문의를 삭제했습니다.");
  await loadInquiryBoard();
}

function openInquiryImage(url) {
  if (!url) return;
  const dialog = document.createElement("dialog");
  dialog.className = "inquiry-image-dialog";
  dialog.innerHTML = `<button type="button" aria-label="닫기">×</button><img src="${escapeHTML(url)}" alt="문의 첨부 사진 크게 보기" />`;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("button")) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

async function uploadInquiryImages(files, userId) {
  const selectedFiles = [...(files || [])];
  if (!selectedFiles.length) return { paths: [] };
  if (selectedFiles.length > 10) return { error: "사진은 최대 10장까지 첨부할 수 있습니다.", paths: [] };
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const extensionMap = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const uploadedPaths = [];
  for (const file of selectedFiles) {
    if (!allowedTypes.includes(file.type)) {
      return { error: "사진은 JPG, PNG, WEBP 파일만 첨부할 수 있습니다.", paths: uploadedPaths };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: "사진은 한 장당 5MB 이하로 첨부해 주세요.", paths: uploadedPaths };
    }
    const filePath = `${userId}/${Date.now()}-${window.crypto.randomUUID()}.${extensionMap[file.type]}`;
    const { error } = await window.btlrSupabase.storage
      .from("inquiry-images")
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (error) return { error: error.message, paths: uploadedPaths };
    uploadedPaths.push(filePath);
  }
  return { paths: uploadedPaths };
}

async function submitInquiry(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting === "true") return;
  const user = getCurrentUser();
  if (!user) {
    window.location.href = `login.html?next=${encodeURIComponent("inquiry.html")}`;
    return;
  }
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form).entries());
  const title = String(values.title || "").trim();
  const content = String(values.content || "").trim();
  const message = document.getElementById("inquiry-form-message");
  const submitButton = form.querySelector('button[type="submit"]');
  if (!title || title.length > 100 || !content || content.length > 1000) {
    if (message) message.textContent = "제목과 1000자 이내의 문의 내용을 확인해 주세요.";
    return;
  }
  form.dataset.submitting = "true";
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "등록 중...";
  }
  let uploadedPaths = [];
  try {
    const uploadResult = await uploadInquiryImages(form.elements.images?.files, user.id);
    uploadedPaths = uploadResult.paths || [];
    if (uploadResult.error) throw new Error(uploadResult.error);
    const { error } = await window.btlrSupabase.rpc("create_inquiry", {
      inquiry_title: title,
      inquiry_content: content,
      inquiry_is_secret: Boolean(form.elements.isSecret?.checked),
      inquiry_image_paths: uploadedPaths,
    });
    if (error) throw error;
    form.reset();
    document.getElementById("inquiry-character-count").textContent = "0";
    renderInquiryImagePreviews(document.getElementById("inquiry-image-preview"), []);
    if (message) {
      message.textContent = "문의를 등록했습니다.";
      message.classList.add("success");
    }
    showToast("문의를 등록했습니다.");
    await loadInquiryBoard();
  } catch (error) {
    if (uploadedPaths.length) await window.btlrSupabase.storage.from("inquiry-images").remove(uploadedPaths);
    if (message) {
      message.textContent = error?.message || "문의를 등록하지 못했습니다.";
      message.classList.remove("success");
    }
  } finally {
    delete form.dataset.submitting;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "문의 등록";
    }
  }
}

function renderInquiryImagePreviews(preview, files) {
  if (!preview) return;
  (preview._objectUrls || []).forEach(URL.revokeObjectURL);
  const selectedFiles = [...(files || [])].slice(0, 10);
  preview._objectUrls = selectedFiles.map((file) => URL.createObjectURL(file));
  preview.innerHTML = selectedFiles.length
    ? preview._objectUrls.map((url, index) => `<figure><img src="${escapeHTML(url)}" alt="첨부할 사진 ${index + 1} 미리보기" /><figcaption>${index + 1}</figcaption></figure>`).join("")
    : "<span>선택한 사진 미리보기</span>";
}

function initInquiryPage() {
  const user = getCurrentUser();
  const compose = document.getElementById("inquiry-compose");
  const form = document.getElementById("inquiry-form");
  if (!user && compose) {
    compose.innerHTML = '<div class="inquiry-section-heading"><p class="eyebrow">NEW INQUIRY</p><h2>문의 작성</h2></div><div class="request-empty compact"><span>✉</span><strong>로그인 후 문의를 작성할 수 있습니다.</strong><p>문의 게시판은 로그인하지 않아도 확인할 수 있습니다.</p><a class="button button-primary" href="login.html?next=inquiry.html">로그인하고 문의하기</a></div>';
  } else if (isAdminUser(user) && compose) {
    compose.innerHTML = '<div class="inquiry-section-heading"><p class="eyebrow">ADMIN</p><h2>문의 답변 관리</h2></div><div class="request-empty compact"><span>✉</span><strong>관리자 문의 관리에서 답변할 수 있습니다.</strong><p>공개 게시판에서는 등록된 답변 결과를 확인합니다.</p><a class="button button-primary" href="admin-inquiries.html">문의 관리로 이동</a></div>';
  } else if (form) {
    form.addEventListener("submit", submitInquiry);
    form.elements.content?.addEventListener("input", () => {
      document.getElementById("inquiry-character-count").textContent = String(form.elements.content.value.length);
    });
    form.elements.images?.addEventListener("change", () => {
      const files = [...(form.elements.images.files || [])];
      const preview = document.getElementById("inquiry-image-preview");
      const message = document.getElementById("inquiry-form-message");
      if (files.length > 10) {
        form.elements.images.value = "";
        renderInquiryImagePreviews(preview, []);
        if (message) {
          message.textContent = "사진은 최대 10장까지 선택할 수 있습니다.";
          message.classList.remove("success");
        }
        return;
      }
      renderInquiryImagePreviews(preview, files);
      if (message) message.textContent = files.length ? `${files.length}장의 사진을 선택했습니다.` : "";
    });
  }
  document.getElementById("refresh-inquiries")?.addEventListener("click", loadInquiryBoard);
  document.getElementById("inquiry-pagination")?.addEventListener("click", handleManagedPagination);
  const editDialog = document.getElementById("inquiry-edit-dialog");
  const editForm = document.getElementById("inquiry-edit-form");
  editForm?.addEventListener("submit", submitInquiryEdit);
  editForm?.elements.content?.addEventListener("input", () => {
    document.getElementById("inquiry-edit-character-count").textContent = String(editForm.elements.content.value.length);
  });
  document.getElementById("cancel-inquiry-edit")?.addEventListener("click", () => editDialog?.close());
  document.getElementById("cancel-inquiry-edit-bottom")?.addEventListener("click", () => editDialog?.close());
  editDialog?.addEventListener("click", (event) => {
    if (event.target === editDialog) editDialog.close();
  });
  document.getElementById("inquiry-list")?.addEventListener("click", (event) => {
    const imageButton = event.target.closest("[data-inquiry-image]");
    if (imageButton) {
      openInquiryImage(imageButton.dataset.inquiryImage);
      return;
    }
    const editButton = event.target.closest("[data-edit-inquiry]");
    if (editButton) {
      openInquiryEditDialog(editButton.dataset.editInquiry);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-inquiry]");
    if (deleteButton) deleteMyInquiry(deleteButton.dataset.deleteInquiry);
  });
  document.getElementById("my-pending-inquiry-list")?.addEventListener("click", (event) => {
    const imageButton = event.target.closest("[data-inquiry-image]");
    if (imageButton) {
      openInquiryImage(imageButton.dataset.inquiryImage);
      return;
    }
    const editButton = event.target.closest("[data-edit-inquiry]");
    if (editButton) {
      openInquiryEditDialog(editButton.dataset.editInquiry);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-inquiry]");
    if (deleteButton) deleteMyInquiry(deleteButton.dataset.deleteInquiry);
  });
  loadInquiryBoard();
}

async function renderAdminInquiries() {
  const target = document.getElementById("admin-inquiry-list");
  if (!target || !window.btlrSupabase) return;
  target.innerHTML = '<p class="request-loading">문의 목록을 불러오는 중...</p>';
  const { data, error } = await window.btlrSupabase.rpc("list_inquiries");
  if (error) {
    adminInquiriesCache = [];
    target.innerHTML = `<div class="request-empty compact"><strong>문의 목록을 불러오지 못했습니다.</strong><p>${escapeHTML(error.message)}</p></div>`;
    renderManagedPagination("admin-inquiry-pagination", "admin-inquiries", 1, 0);
    return;
  }
  adminInquiriesCache = await attachInquiryImageUrls(data || []);
  renderAdminInquiryPage();
}

function getFilteredAdminInquiries() {
  const query = adminInquiryFilterState.query.toLocaleLowerCase("ko-KR");
  return adminInquiriesCache.filter((inquiry) => {
    const matchesQuery = !query || [inquiry.title, inquiry.author_name, inquiry.author_email]
      .some((value) => String(value || "").toLocaleLowerCase("ko-KR").includes(query));
    const matchesStatus = adminInquiryFilterState.status === "all"
      || (adminInquiryFilterState.status === "answered" ? inquiry.is_answered : !inquiry.is_answered);
    const matchesVisibility = adminInquiryFilterState.visibility === "all"
      || (adminInquiryFilterState.visibility === "secret" ? inquiry.is_secret : !inquiry.is_secret);
    return matchesQuery && matchesStatus && matchesVisibility;
  });
}

function renderAdminInquiryPage() {
  const target = document.getElementById("admin-inquiry-list");
  if (!target) return;
  const inquiries = getFilteredAdminInquiries();
  const summary = document.getElementById("admin-inquiry-filter-summary");
  if (summary) summary.textContent = `전체 ${adminInquiriesCache.length}건 중 ${inquiries.length}건`;
  if (!inquiries.length) {
    target.innerHTML = `<div class="request-empty compact"><span>✓</span><strong>${adminInquiriesCache.length ? "검색 조건과 일치하는 문의가 없습니다." : "등록된 문의가 없습니다."}</strong><p>새 문의가 등록되면 이곳에 표시됩니다.</p></div>`;
    renderManagedPagination("admin-inquiry-pagination", "admin-inquiries", 1, 0);
    return;
  }
  const totalPages = Math.ceil(inquiries.length / ADMIN_PAGE_SIZE);
  adminInquiryPage = Math.min(Math.max(adminInquiryPage, 1), totalPages);
  const visibleInquiries = inquiries.slice((adminInquiryPage - 1) * ADMIN_PAGE_SIZE, adminInquiryPage * ADMIN_PAGE_SIZE);
  target.innerHTML = visibleInquiries.map((inquiry) => `
    <article class="admin-inquiry-card">
      <header><div><span class="inquiry-status ${inquiry.is_answered ? "is-answered" : ""}">${inquiry.is_answered ? "답변 완료" : "답변 대기"}</span><h3>${escapeHTML(inquiry.title || "제목 없음")}</h3></div><div class="admin-inquiry-header-actions">${inquiry.is_secret ? '<span class="admin-secret-badge">비밀글</span>' : '<span class="admin-public-badge">공개글</span>'}<button class="button button-danger" type="button" data-admin-delete-inquiry="${escapeHTML(inquiry.id)}">문의 삭제</button></div></header>
      <div class="inquiry-meta"><span>${escapeHTML(inquiry.author_name || "회원")} · ${escapeHTML(inquiry.author_email || "-")}</span><time>${formatDate(inquiry.created_at)}</time></div>
      <p class="inquiry-content">${inquiryTextMarkup(inquiry.content)}</p>
      ${createInquiryImagesMarkup(inquiry)}
      <form class="admin-inquiry-answer-form" data-admin-inquiry-answer="${escapeHTML(inquiry.id)}">
        <label for="admin-answer-${escapeHTML(inquiry.id)}">관리자 답변</label>
        <textarea id="admin-answer-${escapeHTML(inquiry.id)}" name="answer" rows="4" maxlength="1000" required placeholder="답변 내용을 입력하세요">${escapeHTML(inquiry.answer || "")}</textarea>
        <div><span>${inquiry.is_answered ? `답변일 ${formatDate(inquiry.answered_at)}` : "1000자 이내"}</span><button class="button button-primary" type="submit">${inquiry.is_answered ? "답변 수정" : "답변 등록"}</button></div>
      </form>
    </article>
  `).join("");
  renderManagedPagination("admin-inquiry-pagination", "admin-inquiries", adminInquiryPage, inquiries.length);
}

async function handleAdminInquiryImageAction(event) {
  const imageButton = event.target.closest("[data-inquiry-image]");
  if (imageButton) {
    openInquiryImage(imageButton.dataset.inquiryImage);
    return;
  }
  const deleteButton = event.target.closest("[data-admin-delete-inquiry]");
  if (!deleteButton || deleteButton.disabled) return;
  if (!window.confirm("이 문의를 삭제할까요? 답변과 첨부 사진도 함께 삭제되며 복구할 수 없습니다.")) return;
  deleteButton.disabled = true;
  deleteButton.textContent = "삭제 중...";
  const { data, error } = await window.btlrSupabase.rpc("admin_delete_inquiry", {
    target_inquiry_id: deleteButton.dataset.adminDeleteInquiry,
  });
  if (error) {
    deleteButton.disabled = false;
    deleteButton.textContent = "문의 삭제";
    showToast(error.message);
    return;
  }
  const imagePaths = Array.isArray(data) ? data.filter(Boolean) : [];
  if (imagePaths.length) {
    const { error: storageError } = await window.btlrSupabase.storage.from("inquiry-images").remove(imagePaths);
    if (storageError) console.warn("삭제된 문의의 첨부 사진을 정리하지 못했습니다.", storageError);
  }
  showToast("문의를 삭제했습니다.");
  await renderAdminInquiries();
}

async function handleAdminInquiryAnswerSubmit(event) {
  const form = event.target.closest("[data-admin-inquiry-answer]");
  if (!form) return;
  event.preventDefault();
  const answer = String(form.elements.answer?.value || "").trim();
  if (!answer || answer.length > 1000) {
    showToast("답변은 1자 이상 1000자 이내로 입력해 주세요.");
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const { error } = await window.btlrSupabase.rpc("admin_answer_inquiry", {
    target_inquiry_id: form.dataset.adminInquiryAnswer,
    answer_content: answer,
  });
  showToast(error ? error.message : "문의 답변을 저장했습니다.");
  if (error) button.disabled = false;
  else await renderAdminInquiries();
}

async function initBookRequestPage() {
  const user = requireLogin();
  if (!user) return;

  const searchPanel = document.querySelector(".request-search-panel");
  if (isAdminUser(user)) {
    if (searchPanel) {
      searchPanel.innerHTML = `
        <div class="request-empty">
          <span>!</span>
          <strong>관리자는 회원 요청을 관리하는 계정입니다.</strong>
          <p>관리자 페이지에서 회원의 도서 요청을 확인해 주세요.</p>
          <a class="button button-primary" href="admin-books.html">요청 관리로 이동</a>
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
  document.getElementById("my-book-request-list")?.addEventListener("click", cancelMyBookRequest);
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
    cancelled: "요청 취소",
  };
  target.innerHTML = myBookRequestsCache.map((request) => `
    <article class="my-request-card${request.status === "pending" ? " has-action" : ""}">
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
      ${request.status === "pending" ? `<button class="button button-danger request-cancel-button" type="button" data-cancel-book-request="${escapeHTML(request.id)}">요청 취소</button>` : ""}
    </article>
  `).join("");
}

async function cancelMyBookRequest(event) {
  const button = event.target.closest("[data-cancel-book-request]");
  if (!button || button.disabled) return;
  if (!window.confirm("이 도서 추가 요청을 취소할까요?")) return;
  button.disabled = true;
  button.textContent = "취소 중...";
  const { error } = await window.btlrSupabase.rpc("cancel_my_book_request", {
    target_request_id: button.dataset.cancelBookRequest,
  });
  if (error) {
    button.disabled = false;
    button.textContent = "요청 취소";
    showToast(error.message);
    return;
  }
  showToast("도서 추가 요청을 취소했습니다.");
  await loadMyBookRequests();
  renderUserBookSearchResults();
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
        <span>읽고 싶은 책과 이용 중인 도서를 한 곳에서 관리하세요.</span>
      </div>
      <div class="user-card">
        <div class="user-avatar">${escapeHTML(user.name.slice(0, 1).toUpperCase())}</div>
        <div><strong>${escapeHTML(user.name)}</strong><span>${escapeHTML(user.email)}</span></div>
        <small>가입일 ${formatDate(user.createdAt || new Date())} · ${isAdminUser(user) ? String(user.email).toLocaleLowerCase() === PRIMARY_ADMIN_EMAIL || user.role === "owner" ? "최고 관리자" : "부관리자" : "도서관 회원"}</small>
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
    "현재 대출한 도서가 없어요",
    "대출 가능한 책을 찾아 나만의 독서 여정을 시작해 보세요.",
  );
  renderMyList(
    "reservation-list",
    reservations,
    "reservation",
    "예약한 도서가 없어요",
    "대출 중인 책을 예약하면 이곳에서 현황을 확인할 수 있어요.",
  );

  const roomReservationList = document.getElementById("mypage-reading-room-list");
  if (roomReservationList) roomReservationList.onclick = handleMyPageRoomReservationAction;
  loadMyPageRoomReservations();
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
  const formData = new FormData(form);
  const currentPassword = String(formData.get("currentPassword") || "");
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("passwordConfirm") || "");
  if (!currentPassword) {
    if (message) message.textContent = "현재 비밀번호를 입력해 주세요.";
    return;
  }
  if (password.length < 8) {
    if (message) message.textContent = "새 비밀번호는 8자 이상 입력해 주세요.";
    return;
  }
  if (password !== passwordConfirm) {
    if (message) message.textContent = "새 비밀번호와 비밀번호 확인이 일치하지 않습니다.";
    return;
  }
  if (currentPassword === password) {
    if (message) message.textContent = "새 비밀번호는 현재 비밀번호와 다르게 입력해 주세요.";
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  if (message) {
    message.textContent = "현재 비밀번호를 확인하고 있습니다...";
    message.classList.remove("success");
  }
  const user = getCurrentUser();
  const { error: verifyError } = await window.btlrSupabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    if (button) button.disabled = false;
    if (message) message.textContent = "현재 비밀번호가 올바르지 않습니다.";
    return;
  }
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
          statusClass: record.status === "ready" ? "status-available" : "status-reserved",
          dateLabel: record.status === "ready" ? "대출 가능 전환" : record.queuePosition ? `대기 순번 ${record.queuePosition}번 · 신청일` : "신청일",
          date: record.status === "ready" ? record.readyAt : record.createdAt,
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
