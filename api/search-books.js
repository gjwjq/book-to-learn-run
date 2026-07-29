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
  const category = cleanText(request.query?.category).slice(0, 40) || "기타";
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

    response.setHeader(
      "Cache-Control",
      "private, max-age=0, s-maxage=300, stale-while-revalidate=600",
    );
    return response.status(200).json({
      books,
      page,
      isEnd: Boolean(result.meta?.is_end),
      totalCount: Number(result.meta?.total_count) || books.length,
      pageableCount: Number(result.meta?.pageable_count) || books.length,
    });
  } catch {
    return response
      .status(502)
      .json({ message: "도서 검색 서버에 연결할 수 없습니다." });
  }
};
