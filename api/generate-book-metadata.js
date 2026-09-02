const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
const BOOK_CATEGORIES = ["자기계발", "진로/취업", "소설", "인문", "경제", "IT", "에세이", "만화"];
const METADATA_RATE_WINDOW_MS = 60 * 1000;
const METADATA_RATE_MAX_REQUESTS = 15;
const METADATA_CACHE_TTL_MS = 10 * 60 * 1000;
const metadataAttempts = new Map();
const metadataCache = new Map();

function consumeMetadataAttempt(userId) {
  const now = Date.now();
  if (metadataAttempts.size > 5000) {
    for (const [storedUserId, attempt] of metadataAttempts) {
      if (attempt.resetAt <= now) metadataAttempts.delete(storedUserId);
    }
  }
  const current = metadataAttempts.get(userId);
  if (!current || current.resetAt <= now) {
    metadataAttempts.set(userId, { count: 1, resetAt: now + METADATA_RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > METADATA_RATE_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

function readMetadataCache(cacheKey) {
  const cached = metadataCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) metadataCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function writeMetadataCache(cacheKey, value) {
  if (metadataCache.size >= 100) {
    for (const [key, cached] of metadataCache) {
      if (cached.expiresAt <= Date.now()) metadataCache.delete(key);
    }
    if (metadataCache.size >= 100) metadataCache.delete(metadataCache.keys().next().value);
  }
  metadataCache.set(cacheKey, { value, expiresAt: Date.now() + METADATA_CACHE_TTL_MS });
}

async function getAdminUser(authorization) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
  if (!authorization?.startsWith("Bearer ")) return null;
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`,
    { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization } },
  );
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json();
  return profiles[0]?.role === "admin" ? user : null;
}

function finishDescription(value, fallback, maxLength = Number.POSITIVE_INFINITY) {
  const description = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\.{2,}|…+|⋯+)\s*$/g, "")
    .trim();
  if (description && /(다|요|임|됨|함|니다|습니다|이다|예요|이에요)$/.test(description)) {
    const completed = `${description}.`;
    if (completed.length <= maxLength) return completed;
  }
  const endCharacters = [".", "!", "?", "。", "！", "？"];
  const searchLimit = Math.min(description.length, maxLength) - 1;
  const lastSentenceEnd = endCharacters.reduce(
    (latest, character) => Math.max(latest, description.lastIndexOf(character, searchLimit)),
    -1,
  );
  if (lastSentenceEnd >= 10) return description.slice(0, lastSentenceEnd + 1).trim();
  return fallback;
}

function preserveOriginalDescription(value, fallback) {
  const description = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!description) return fallback;
  if (/[.!?。！？]$/.test(description)) return description;
  if (/(다|요|임|됨|함|니다|습니다|이다|예요|이에요)$/.test(description)) {
    return `${description}.`;
  }
  if (/(?:\.{2,}|…+|⋯+)\s*$/.test(description)) {
    const withoutEllipsis = description.replace(/(?:\.{2,}|…+|⋯+)\s*$/g, "").trim();
    const lastSentenceEnd = [".", "!", "?", "。", "！", "？"].reduce(
      (latest, character) => Math.max(latest, withoutEllipsis.lastIndexOf(character)),
      -1,
    );
    if (lastSentenceEnd >= 10) return withoutEllipsis.slice(0, lastSentenceEnd + 1).trim();
  }
  return description;
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "POST 요청만 사용할 수 있습니다." });
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return response.status(503).json({ message: "도서 정보 생성 서버 설정이 완료되지 않았습니다." });
  }

  let admin;
  try {
    admin = await getAdminUser(request.headers.authorization);
  } catch {
    return response.status(502).json({ message: "관리자 인증 서버에 연결할 수 없습니다." });
  }
  if (!admin) return response.status(403).json({ message: "관리자 권한이 필요합니다." });
  if (!process.env.GEMINI_API_KEY) {
    return response.status(503).json({ message: "Vercel에 GEMINI_API_KEY 환경변수를 먼저 등록해 주세요." });
  }

  const rateLimit = consumeMetadataAttempt(admin.id || "unknown");
  if (!rateLimit.allowed) {
    response.setHeader("Retry-After", String(rateLimit.retryAfter));
    return response.status(429).json({
      message: "AI 도서 정보 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
    });
  }

  const input = request.body || {};
  const title = String(input.title || "").trim().slice(0, 200);
  const author = String(input.author || "").trim().slice(0, 120);
  const requestedCategory = String(input.category || "").trim().slice(0, 80);
  const category = BOOK_CATEGORIES.includes(requestedCategory) ? requestedCategory : "";
  if (!title || !author) return response.status(400).json({ message: "제목과 저자가 필요합니다." });

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const normalizedInput = {
    title,
    author,
    publisher: String(input.publisher || "").trim().slice(0, 120),
    publishedDate: String(input.publishedDate || "").trim().slice(0, 10),
    description: String(input.description || "").trim().slice(0, 1200),
    shortDescription: String(input.shortDescription || "").trim().slice(0, 300),
    category,
  };
  const cacheKey = JSON.stringify({ model, ...normalizedInput });
  const cachedPayload = readMetadataCache(cacheKey);
  if (cachedPayload) {
    response.setHeader("X-Book-Metadata-Cache", "HIT");
    return response.status(200).json(cachedPayload);
  }

  let apiResponse;
  try {
    apiResponse = await fetch(
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
            "당신은 한국 도서관 프로젝트의 도서 정보 작성 담당자입니다.",
            "제공된 제목과 저자를 기반으로 한국어 메타데이터를 간결하고 사실적으로 작성하세요.",
            `카테고리는 반드시 다음 중 하나만 사용하세요: ${BOOK_CATEGORIES.join(", ")}.`,
            "책 제목을 카테고리로 복사하지 마세요. 추리·미스터리·스릴러 소설의 카테고리는 '소설'이며 세부 장르는 키워드에 넣으세요.",
            "일본 만화, 한국 만화, 그래픽노블, 코믹스, 웹툰 단행본은 줄거리가 소설처럼 보여도 반드시 '만화'로 분류하세요. 원피스와 죠죠의 기묘한 모험도 '만화'입니다.",
            "입력 category가 비어 있지 않으면 해당 카테고리를 유지하세요.",
            "키워드는 제목 자체가 아니라 장르와 핵심 주제를 3~6개 작성하세요.",
            "shortDescription은 100자 이내의 완결된 한 문장으로 작성하세요.",
            "description은 350자 이내의 완결된 2~3문장으로 작성하세요.",
            "입력 설명이 문장 중간에서 끊겼거나 말줄임표로 끝나면 그대로 복사하지 말고, 주어진 정보 안에서 완결된 문장으로 다시 작성하세요.",
            "shortDescription과 description은 반드시 문장부호로 끝내세요.",
            "책의 내용을 확실히 알 수 없으면 과장하거나 구체적 사실을 지어내지 말고 일반적인 수준으로 작성하세요.",
          ].join(" "),
        }],
      },
      contents: [{
        role: "user",
        parts: [{
          text: JSON.stringify({
            ...normalizedInput,
          }),
        }],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
              author: { type: "string" },
              publisher: { type: "string" },
              publishedDate: { type: "string" },
              category: { type: "string", enum: BOOK_CATEGORIES },
              keywords: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
              shortDescription: { type: "string" },
              description: { type: "string" },
            },
            required: ["author", "publisher", "publishedDate", "category", "keywords", "shortDescription", "description"],
        },
        maxOutputTokens: 2000,
      },
    }),
      },
    );
  } catch {
    return response.status(503).json({
      message: "AI 도서 정보 생성 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      retryable: true,
      enrichment: { status: "failed", reason: "ai_network_error" },
    });
  }

  const result = await apiResponse.json();
  if (!apiResponse.ok) {
    const retryable = apiResponse.status === 429 || apiResponse.status >= 500;
    const status = apiResponse.status === 429 ? 429 : (retryable ? 503 : 502);
    return response.status(status).json({
      message: result.error?.message || "Gemini API 요청에 실패했습니다.",
      retryable,
      upstreamStatus: apiResponse.status,
      enrichment: { status: "failed", reason: "ai_upstream_error" },
    });
  }

  try {
    const outputText = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");
    if (!outputText) throw new Error("empty response");
    const metadata = JSON.parse(outputText);
    const genericDescription = `${author}의 『${title}』입니다.`;
    const sourceDescription = preserveOriginalDescription(normalizedInput.description, genericDescription);
    const rawDescription = String(metadata.description || "").trim();
    const rawShortDescription = String(metadata.shortDescription || "").trim();
    metadata.description = finishDescription(rawDescription, sourceDescription, Number.POSITIVE_INFINITY);
    metadata.shortDescription = finishDescription(
      rawShortDescription,
      finishDescription(sourceDescription, genericDescription, 110),
      110,
    );
    const usedFallback = metadata.description === sourceDescription
      || metadata.shortDescription === genericDescription;
    const payload = {
      ...metadata,
      enrichment: {
        status: usedFallback ? "partial" : "complete",
        reason: usedFallback ? "incomplete_ai_description_repaired" : null,
      },
    };
    writeMetadataCache(cacheKey, payload);
    response.setHeader("X-Book-Metadata-Cache", "MISS");
    return response.status(200).json(payload);
  } catch {
    return response.status(502).json({
      message: "AI 응답을 도서 정보로 변환하지 못했습니다.",
      enrichment: { status: "failed", reason: "ai_response_invalid" },
    });
  }
};
