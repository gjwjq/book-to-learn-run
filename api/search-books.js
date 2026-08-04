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

function createKeywords(query, category, title) {
  const titleWords = cleanText(title)
    .split(/[\s:·,()[\]{}]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length >= 2);

  return [...new Set([cleanText(category), cleanText(query), ...titleWords])]
    .filter(Boolean)
    .slice(0, 6);
}

const BOOK_CATEGORIES = [
  "자기계발",
  "진로/취업",
  "소설",
  "인문",
  "경제",
  "IT",
  "에세이",
  "예술",
  "사회",
  "역사",
  "과학",
  "건강",
  "교육",
  "기타",
];

async function enrichBooksWithAI(books, requestedCategory = "") {
  if (!books.length || !process.env.GEMINI_API_KEY) {
    return books.map((book) => ({
      ...book,
      category: requestedCategory || "기타",
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
                "원본 소개가 비어 있거나 말줄임표로 끊겼다면 주어진 정보 안에서 자연스러운 한국어 소개 1~2문장으로 정리하세요.",
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
                  description: { type: "string" },
                },
                required: ["index", "category", "description"],
              },
            },
            maxOutputTokens: 3000,
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
      const category = requestedCategory || metadata?.category || "기타";
      const description = cleanText(metadata?.description) || book.description;
      return {
        ...book,
        category,
        description,
        shortDescription: description,
        keywords: [...new Set([category, ...(book.keywords || [])])].slice(0, 6),
      };
    });
  } catch {
    return books.map((book) => ({
      ...book,
      category: requestedCategory || "기타",
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
  const category = cleanText(request.query?.category).slice(0, 40);
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
          keywords: createKeywords(query, category, title),
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
      : books.map((book) => ({ ...book, category: category || "기타" }));

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
