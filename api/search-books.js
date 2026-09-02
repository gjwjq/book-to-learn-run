const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
const SEARCH_RATE_WINDOW_MS = 60 * 1000;
const SEARCH_RATE_MAX_REQUESTS = 30;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const AI_ENRICHMENT_MAX_BOOKS = 12;
const searchAttempts = new Map();
const searchCache = new Map();

async function getAuthenticatedUser(authorization) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  if (!authorization?.startsWith("Bearer ")) return null;

  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
    },
  });
  if (!userResponse.ok) return null;
  return userResponse.json();
}

function consumeSearchAttempt(userId) {
  const now = Date.now();
  if (searchAttempts.size > 5000) {
    for (const [storedUserId, attempt] of searchAttempts) {
      if (attempt.resetAt <= now) searchAttempts.delete(storedUserId);
    }
  }
  const current = searchAttempts.get(userId);
  if (!current || current.resetAt <= now) {
    searchAttempts.set(userId, { count: 1, resetAt: now + SEARCH_RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > SEARCH_RATE_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function readSearchCache(cacheKey) {
  const cached = searchCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) searchCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function writeSearchCache(cacheKey, value) {
  if (searchCache.size > 100) {
    for (const [key, cached] of searchCache) {
      if (cached.expiresAt <= Date.now()) searchCache.delete(key);
    }
  }
  searchCache.set(cacheKey, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getPublishedDate(datetime) {
  const value = String(datetime || "");
  const matchedDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return matchedDate || null;
}

function getPreferredIsbn(value) {
  const candidates = String(value || "")
    .split(/\s+/)
    .map((isbn) => isbn.replace(/[^0-9X]/gi, ""))
    .filter(Boolean);
  return candidates.find((isbn) => isbn.length === 13) || candidates[0] || "";
}

const BOOK_CATEGORIES = [
  "자기계발",
  "진로/취업",
  "소설",
  "인문",
  "경제",
  "IT",
  "에세이",
  "만화",
];

const GENRE_KEYWORDS = [
  "추리", "미스터리", "스릴러", "판타지", "로맨스", "SF", "역사", "청춘",
  "철학", "심리", "사회", "과학", "교육", "건강", "투자", "마케팅", "프로그래밍",
  "소년만화", "순정만화", "액션", "모험", "코미디", "웹툰",
];

function getFallbackCategory(book) {
  const source = [book.title, book.author, book.publisher, book.description].join(" ");
  if (/만화|코믹(?:스)?|manga|webtoon|웹툰|원피스|one\s*piece|죠죠|jojo|귀멸의\s*칼날|주술회전|슬램덩크|나루토|블리치|드래곤볼|진격의\s*거인|명탐정\s*코난|체인소\s*맨|스파이\s*패밀리|최애의\s*아이|오다\s*에이치로|아라키\s*히로히코/i.test(source)) return "만화";
  if (/소설|추리|미스터리|스릴러|판타지|로맨스|SF|문학/.test(source)) return "소설";
  if (/에세이|수필|일상|육아|여행기/.test(source)) return "에세이";
  if (/개발|프로그래밍|코딩|컴퓨터|인공지능|AI|데이터|소프트웨어/.test(source)) return "IT";
  if (/경제|경영|투자|금융|마케팅|비즈니스/.test(source)) return "경제";
  if (/취업|면접|직업|진로|커리어|포트폴리오/.test(source)) return "진로/취업";
  if (/습관|성장|성공|자기계발|생산성|공부법/.test(source)) return "자기계발";
  return "인문";
}

function createFallbackKeywords(book, category) {
  const source = [book.title, book.description].join(" ");
  const genres = GENRE_KEYWORDS.filter((keyword) => source.includes(keyword));
  const categoryDefaults = {
    자기계발: ["성장", "습관"],
    "진로/취업": ["커리어", "직업"],
    소설: ["문학", "이야기"],
    인문: ["교양", "사유"],
    경제: ["비즈니스", "경제"],
    IT: ["기술", "프로그래밍"],
    에세이: ["일상", "에세이"],
    만화: ["만화", "스토리"],
  };
  return [...new Set([...genres, ...(categoryDefaults[category] || ["도서"])])]
    .filter((keyword) => keyword !== category)
    .slice(0, 6);
}

function findLastSentenceEnd(value, maxLength = value.length) {
  const sentenceEnds = [".", "!", "?", "。", "！", "？"];
  let lastSentenceEnd = -1;
  for (const sentenceEnd of sentenceEnds) {
    const index = value.lastIndexOf(sentenceEnd, Math.min(maxLength, value.length) - 1);
    if (index > lastSentenceEnd) lastSentenceEnd = index;
  }
  return lastSentenceEnd;
}

function getGenericDescription(book) {
  const author = cleanText(book.author) || "저자 미상";
  const title = cleanText(book.title) || "이 도서";
  return `${author}의 『${title}』입니다.`;
}

function endsWithNaturalKoreanSentence(value) {
  return /(다|요|임|됨|함|니다|습니다|이다|예요|이에요)$/.test(value);
}

function getPreservedDescription(value, book) {
  const description = cleanText(value);
  if (!description) return getGenericDescription(book);
  if (/[.!?。！？]$/.test(description)) return description;
  if (endsWithNaturalKoreanSentence(description)) return `${description}.`;

  // 카카오 원문이 명백한 말줄임표로 끝날 때만 마지막 완결 문장 뒤의 조각을
  // 제거합니다. 완결 문장이 없으면 정보 손실을 막기 위해 원문을 그대로 둡니다.
  if (/(?:\.{2,}|…+|⋯+)\s*$/.test(description)) {
    const withoutEllipsis = description.replace(/(?:\.{2,}|…+|⋯+)\s*$/g, "").trim();
    const lastSentenceEnd = findLastSentenceEnd(withoutEllipsis);
    if (lastSentenceEnd >= 14) return withoutEllipsis.slice(0, lastSentenceEnd + 1).trim();
  }
  return description;
}

function getValidatedGeneratedDescription(value, sourceDescription, book) {
  const description = cleanText(value);
  if (!description) return sourceDescription;
  if (/[.!?。！？]$/.test(description)) return description;
  if (endsWithNaturalKoreanSentence(description)) return `${description}.`;
  if (/(?:\.{2,}|…+|⋯+)\s*$/.test(description)) {
    const withoutEllipsis = description.replace(/(?:\.{2,}|…+|⋯+)\s*$/g, "").trim();
    const lastSentenceEnd = findLastSentenceEnd(withoutEllipsis);
    if (lastSentenceEnd >= 14) return withoutEllipsis.slice(0, lastSentenceEnd + 1).trim();
  }
  return sourceDescription || getGenericDescription(book);
}

function getGenericShortDescription(book) {
  const generic = getGenericDescription(book);
  if (generic.length <= 110) return generic;
  return "책의 핵심 내용을 소개하는 도서입니다.";
}

function getCompleteShortDescription(value, book) {
  const description = cleanText(value);
  if (!description) return getGenericShortDescription(book);
  const lastSentenceEnd = findLastSentenceEnd(description, 110);
  if (lastSentenceEnd >= 9) return description.slice(0, lastSentenceEnd + 1).trim();
  if (description.length < 110 && endsWithNaturalKoreanSentence(description)) {
    return `${description}.`;
  }
  return getGenericShortDescription(book);
}

async function enrichBooksWithAI(books, requestedCategory = "") {
  if (!books.length || !process.env.GEMINI_API_KEY) {
    return {
      books: books.map((book) => {
        const category = requestedCategory || getFallbackCategory(book);
        const description = getPreservedDescription(book.description, book);
        return {
          ...book,
          category,
          keywords: createFallbackKeywords(book, category),
          description,
          shortDescription: getCompleteShortDescription(description, book),
        };
      }),
      status: process.env.GEMINI_API_KEY ? "skipped" : "fallback",
      reason: process.env.GEMINI_API_KEY ? "no_results" : "ai_key_missing",
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  try {
    const apiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: [
                "당신은 한국 도서관의 도서 정보 담당자입니다.",
                `각 책을 반드시 다음 카테고리 중 하나로만 분류하세요: ${BOOK_CATEGORIES.join(", ")}.`,
                requestedCategory
                  ? `사용자가 지정한 카테고리 '${requestedCategory}'를 모든 책에 그대로 적용하세요.`
                  : "제목만 보지 말고 저자, 출판사, 소개를 함께 판단하세요.",
                "책 제목이나 검색어를 카테고리로 사용하지 마세요.",
                "일본 만화, 한국 만화, 그래픽노블, 코믹스, 웹툰 단행본은 줄거리가 소설처럼 보여도 반드시 카테고리를 '만화'로 분류하세요. 원피스와 죠죠의 기묘한 모험도 '만화'입니다.",
                "추리·미스터리·스릴러 작품은 카테고리를 '소설'로 분류하고, 세부 장르는 키워드에 넣으세요.",
                "키워드는 제목을 그대로 복사하지 말고 장르와 핵심 주제를 3~6개 작성하세요.",
                "description은 2~3개의 완결된 한국어 문장으로 280자 이내에서 작성하세요.",
                "shortDescription은 핵심을 담은 하나의 완결된 한국어 문장으로 90자 이내에서 작성하세요.",
                "모든 설명은 반드시 마침표로 끝내고, 원본 소개가 문장 중간에서 끊겼다면 그대로 복사하지 말고 완결된 문장으로 다시 정리하세요.",
                "확인할 수 없는 줄거리나 사실은 새로 지어내지 마세요. 원본 소개가 완전하면 의미를 유지하세요.",
              ].join(" "),
            }],
          },
          contents: [{
            role: "user",
            parts: [{
              text: JSON.stringify(books.map((book, index) => ({
                index,
                title: book.title,
                author: book.author,
                publisher: book.publisher,
                description: String(book.description || "").slice(0, 700),
              }))),
            }],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer" },
                  category: { type: "string", enum: BOOK_CATEGORIES },
                  keywords: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
                  shortDescription: { type: "string" },
                  description: { type: "string" },
                },
                required: ["index", "category", "keywords", "shortDescription", "description"],
              },
            },
            maxOutputTokens: Math.min(Math.max(books.length * 300, 1800), 6000),
          },
        }),
      },
    );

    const result = await apiResponse.json();
    if (!apiResponse.ok) throw new Error("AI category request failed");
    const outputText = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");
    const classifications = JSON.parse(outputText || "[]");
    const metadataByIndex = new Map(
      classifications
        .filter((item) => Number.isInteger(item.index) && BOOK_CATEGORIES.includes(item.category))
        .map((item) => [item.index, item]),
    );

    let fallbackCount = 0;
    const enrichedBooks = books.map((book, index) => {
      const metadata = metadataByIndex.get(index);
      const category = requestedCategory || metadata?.category || getFallbackCategory(book);
      const sourceDescription = getPreservedDescription(book.description, book);
      const generatedDescription = cleanText(metadata?.description);
      const description = generatedDescription
        ? getValidatedGeneratedDescription(generatedDescription, sourceDescription, book)
        : sourceDescription;
      const generatedShortDescription = cleanText(metadata?.shortDescription);
      const shortDescription = generatedShortDescription
        ? getCompleteShortDescription(generatedShortDescription, book)
        : getCompleteShortDescription(description, book);
      const keywords = Array.isArray(metadata?.keywords)
        ? metadata.keywords.map(cleanText).filter(Boolean)
        : createFallbackKeywords(book, category);
      if (
        !metadata
        || !generatedDescription
        || description === sourceDescription
        || !generatedShortDescription
      ) fallbackCount += 1;
      return {
        ...book,
        category,
        description,
        shortDescription,
        keywords: [...new Set(keywords)]
          .filter((keyword) => keyword && keyword !== category && keyword !== book.title)
          .slice(0, 6),
      };
    });
    return {
      books: enrichedBooks,
      status: fallbackCount ? "partial" : "complete",
      reason: fallbackCount ? "incomplete_ai_response" : null,
    };
  } catch (error) {
    return {
      books: books.map((book) => {
        const category = requestedCategory || getFallbackCategory(book);
        const description = getPreservedDescription(book.description, book);
        return {
          ...book,
          category,
          keywords: createFallbackKeywords(book, category),
          description,
          shortDescription: getCompleteShortDescription(description, book),
        };
      }),
      status: "fallback",
      reason: error?.message === "AI category request failed" ? "ai_request_failed" : "ai_response_invalid",
    };
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response
      .status(405)
      .json({ message: "GET 요청만 사용할 수 있습니다." });
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return response.status(503).json({ message: "도서 검색 서버 설정이 완료되지 않았습니다." });
  }

  const user = await getAuthenticatedUser(request.headers.authorization);
  if (!user) {
    return response.status(401).json({ message: "로그인이 필요합니다." });
  }
  const rateLimit = consumeSearchAttempt(user.id || "unknown");
  if (!rateLimit.allowed) {
    response.setHeader("Retry-After", String(rateLimit.retryAfter));
    return response.status(429).json({
      message: "도서 검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
  if (!process.env.KAKAO_REST_API_KEY) {
    return response.status(503).json({
      message:
        "Vercel 환경변수에 KAKAO_REST_API_KEY를 등록한 뒤 다시 배포해 주세요.",
    });
  }

  const query = cleanText(request.query?.query).slice(0, 100);
  const requestedCategory = cleanText(request.query?.category).slice(0, 40);
  const category = BOOK_CATEGORIES.includes(requestedCategory) ? requestedCategory : "";
  const shouldEnrich = request.query?.enrich === "1";
  const page = Math.min(Math.max(Number(request.query?.page) || 1, 1), 50);
  const size = Math.min(Math.max(Number(request.query?.size) || 20, 1), 50);

  if (!query) {
    return response.status(400).json({ message: "검색어를 입력해 주세요." });
  }

  const cacheKey = JSON.stringify({
    query: query.toLocaleLowerCase("ko-KR"),
    category,
    page,
    size,
    shouldEnrich,
    model: shouldEnrich ? (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite") : "none",
  });
  const cachedPayload = readSearchCache(cacheKey);
  if (cachedPayload) {
    response.setHeader("Cache-Control", "private, max-age=60");
    response.setHeader("X-Book-Search-Cache", "HIT");
    return response.status(200).json(cachedPayload);
  }

  const searchUrl = new URL("https://dapi.kakao.com/v3/search/book");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("sort", "accuracy");
  searchUrl.searchParams.set("page", String(page));
  searchUrl.searchParams.set("size", String(size));

  try {
    const kakaoResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
      },
    });
    const result = await kakaoResponse.json();

    if (!kakaoResponse.ok) {
      return response.status(kakaoResponse.status).json({
        message: "카카오 도서 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      });
    }

    const books = (result.documents || [])
      .map((book) => {
        const title = cleanText(book.title);
        const description = cleanText(book.contents);
        const isbn = getPreferredIsbn(book.isbn);
        return {
          externalId: isbn || cleanText(book.url),
          isbn,
          title,
          author: (book.authors || []).map(cleanText).filter(Boolean).join(", "),
          publisher: cleanText(book.publisher),
          publishedDate: getPublishedDate(book.datetime),
          category,
          keywords: [],
          description,
          shortDescription: "",
          thumbnail: String(book.thumbnail || "").trim(),
          sourceUrl: String(book.url || "").trim(),
        };
      })
      .filter((book) => book.title && book.author);
    const enrichmentResult = shouldEnrich
      ? await enrichBooksWithAI(books.slice(0, AI_ENRICHMENT_MAX_BOOKS), category)
      : {
        books: books.map((book) => {
        const fallbackCategory = category || getFallbackCategory(book);
        const description = getPreservedDescription(book.description, book);
        return {
          ...book,
          category: fallbackCategory,
          keywords: createFallbackKeywords(book, fallbackCategory),
          description,
          shortDescription: getCompleteShortDescription(description, book),
        };
        }),
        status: "skipped",
        reason: "not_requested",
      };

    if (shouldEnrich && books.length > AI_ENRICHMENT_MAX_BOOKS) {
      enrichmentResult.books.push(...books.slice(AI_ENRICHMENT_MAX_BOOKS).map((book) => {
        const fallbackCategory = category || getFallbackCategory(book);
        const description = getPreservedDescription(book.description, book);
        return {
          ...book,
          category: fallbackCategory,
          keywords: createFallbackKeywords(book, fallbackCategory),
          description,
          shortDescription: getCompleteShortDescription(description, book),
        };
      }));
      if (enrichmentResult.status === "complete") enrichmentResult.status = "partial";
      enrichmentResult.reason = enrichmentResult.reason || "ai_batch_limited";
    }

    const payload = {
      books: enrichmentResult.books,
      page,
      isEnd: Boolean(result.meta?.is_end),
      totalCount: Number(result.meta?.total_count) || enrichmentResult.books.length,
      pageableCount: Number(result.meta?.pageable_count) || enrichmentResult.books.length,
      enrichmentStatus: enrichmentResult.status,
      enrichment: {
        requested: shouldEnrich,
        status: enrichmentResult.status,
        reason: enrichmentResult.reason,
      },
    };
    writeSearchCache(cacheKey, payload);

    response.setHeader("Cache-Control", "private, max-age=60");
    response.setHeader("X-Book-Search-Cache", "MISS");
    return response.status(200).json(payload);
  } catch {
    return response
      .status(502)
      .json({ message: "도서 검색 서버에 연결할 수 없습니다." });
  }
};
