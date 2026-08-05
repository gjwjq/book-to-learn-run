const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://khbnqkkxhcluqczxvdyv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_QnlhzDiZqQyV1DSf_uKUVA_0XuNS6LN";

async function getAuthenticatedUser(authorization) {
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
  return [...new Set([category, ...genres])].slice(0, 6);
}

function getCompleteFallbackDescription(book) {
  const description = cleanText(book.description).replace(/\.{2,}|…+$/g, "").trim();
  const lastSentenceEnd = Math.max(
    description.lastIndexOf("."),
    description.lastIndexOf("!"),
    description.lastIndexOf("?"),
    description.lastIndexOf("。"),
    description.lastIndexOf("！"),
    description.lastIndexOf("？"),
  );
  if (lastSentenceEnd >= 20) return description.slice(0, lastSentenceEnd + 1).trim();
  return `${book.author}의 『${book.title}』입니다.`;
}

async function enrichBooksWithAI(books, requestedCategory = "") {
  if (!books.length || !process.env.GEMINI_API_KEY) {
    return books.map((book) => ({
      ...book,
      category: requestedCategory || getFallbackCategory(book),
      keywords: createFallbackKeywords(book, requestedCategory || getFallbackCategory(book)),
      description: getCompleteFallbackDescription(book),
      shortDescription: getCompleteFallbackDescription(book),
    }));
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
                "description은 2~3개의 완결된 한국어 문장으로 350자 이내에서 작성하세요.",
                "shortDescription은 핵심을 담은 하나의 완결된 한국어 문장으로 100자 이내에서 작성하세요.",
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
            maxOutputTokens: 8192,
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

    return books.map((book, index) => {
      const metadata = metadataByIndex.get(index);
      const category = requestedCategory || metadata?.category || getFallbackCategory(book);
      const generatedDescription = cleanText(metadata?.description);
      const description = generatedDescription
        ? getCompleteFallbackDescription({ ...book, description: generatedDescription })
        : getCompleteFallbackDescription(book);
      const generatedShortDescription = cleanText(metadata?.shortDescription);
      const shortDescription = generatedShortDescription
        ? getCompleteFallbackDescription({ ...book, description: generatedShortDescription })
        : description;
      const keywords = Array.isArray(metadata?.keywords)
        ? metadata.keywords.map(cleanText).filter(Boolean)
        : createFallbackKeywords(book, category);
      return {
        ...book,
        category,
        description,
        shortDescription,
        keywords: [...new Set([category, ...keywords])].slice(0, 6),
      };
    });
  } catch {
    return books.map((book) => ({
      ...book,
      category: requestedCategory || getFallbackCategory(book),
      keywords: createFallbackKeywords(book, requestedCategory || getFallbackCategory(book)),
      description: getCompleteFallbackDescription(book),
      shortDescription: getCompleteFallbackDescription(book),
    }));
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response
      .status(405)
      .json({ message: "GET 요청만 사용할 수 있습니다." });
  }

  const user = await getAuthenticatedUser(request.headers.authorization);
  if (!user) {
    return response.status(401).json({ message: "로그인이 필요합니다." });
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
  const shouldEnrich = request.query?.enrich !== "0";
  const page = Math.min(Math.max(Number(request.query?.page) || 1, 1), 50);
  const size = Math.min(Math.max(Number(request.query?.size) || 20, 1), 50);

  if (!query) {
    return response.status(400).json({ message: "검색어를 입력해 주세요." });
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
        message:
          result.message ||
          result.errorType ||
          "카카오 도서 검색에 실패했습니다.",
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
          shortDescription:
            description.length > 110
              ? `${description.slice(0, 107).trim()}...`
              : description,
          thumbnail: String(book.thumbnail || "").trim(),
          sourceUrl: String(book.url || "").trim(),
        };
      })
      .filter((book) => book.title && book.author);
    const categorizedBooks = shouldEnrich
      ? await enrichBooksWithAI(books, category)
      : books.map((book) => {
        const fallbackCategory = category || getFallbackCategory(book);
        return {
          ...book,
          category: fallbackCategory,
          keywords: createFallbackKeywords(book, fallbackCategory),
          description: getCompleteFallbackDescription(book),
          shortDescription: getCompleteFallbackDescription(book),
        };
      });

    response.setHeader(
      "Cache-Control",
      "private, max-age=0, s-maxage=300, stale-while-revalidate=600",
    );
    return response.status(200).json({
      books: categorizedBooks,
      page,
      isEnd: Boolean(result.meta?.is_end),
      totalCount: Number(result.meta?.total_count) || categorizedBooks.length,
      pageableCount: Number(result.meta?.pageable_count) || categorizedBooks.length,
    });
  } catch {
    return response
      .status(502)
      .json({ message: "도서 검색 서버에 연결할 수 없습니다." });
  }
};
