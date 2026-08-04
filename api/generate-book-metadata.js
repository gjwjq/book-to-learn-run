const SUPABASE_URL = process.env.SUPABASE_URL || "https://khbnqkkxhcluqczxvdyv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_QnlhzDiZqQyV1DSf_uKUVA_0XuNS6LN";
const BOOK_CATEGORIES = ["자기계발", "진로/취업", "소설", "인문", "경제", "IT", "에세이"];

async function getAdminUser(authorization) {
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

function finishDescription(value, fallback) {
  const description = String(value || "").replace(/\s+/g, " ").trim().replace(/\.{2,}|…+$/g, "").trim();
  const lastSentenceEnd = Math.max(
    description.lastIndexOf("."),
    description.lastIndexOf("!"),
    description.lastIndexOf("?"),
    description.lastIndexOf("。"),
    description.lastIndexOf("！"),
    description.lastIndexOf("？"),
  );
  if (lastSentenceEnd >= 10) return description.slice(0, lastSentenceEnd + 1).trim();
  return fallback;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "POST 요청만 사용할 수 있습니다." });
  }

  const admin = await getAdminUser(request.headers.authorization);
  if (!admin) return response.status(403).json({ message: "관리자 권한이 필요합니다." });
  if (!process.env.GEMINI_API_KEY) {
    return response.status(503).json({ message: "Vercel에 GEMINI_API_KEY 환경변수를 먼저 등록해 주세요." });
  }

  const input = request.body || {};
  const title = String(input.title || "").trim().slice(0, 200);
  const author = String(input.author || "").trim().slice(0, 120);
  const requestedCategory = String(input.category || "").trim().slice(0, 80);
  const category = BOOK_CATEGORIES.includes(requestedCategory) ? requestedCategory : "";
  if (!title || !author) return response.status(400).json({ message: "제목과 저자가 필요합니다." });

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
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
            "당신은 한국 도서관 프로젝트의 도서 정보 작성 담당자입니다.",
            "제공된 제목과 저자를 기반으로 한국어 메타데이터를 간결하고 사실적으로 작성하세요.",
            `카테고리는 반드시 다음 중 하나만 사용하세요: ${BOOK_CATEGORIES.join(", ")}.`,
            "책 제목을 카테고리로 복사하지 마세요. 추리·미스터리·스릴러 작품의 카테고리는 '소설'이며 세부 장르는 키워드에 넣으세요.",
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
            title,
            author,
            publisher: String(input.publisher || "").trim().slice(0, 120),
            publishedDate: String(input.publishedDate || "").trim(),
            description: String(input.description || "").trim().slice(0, 1200),
            shortDescription: String(input.shortDescription || "").trim().slice(0, 300),
            category,
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
  });

  const result = await apiResponse.json();
  if (!apiResponse.ok) {
    return response.status(502).json({ message: result.error?.message || "Gemini API 요청에 실패했습니다." });
  }

  try {
    const outputText = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");
    if (!outputText) throw new Error("empty response");
    const metadata = JSON.parse(outputText);
    const genericDescription = `${author}의 『${title}』입니다.`;
    metadata.description = finishDescription(metadata.description, genericDescription);
    metadata.shortDescription = finishDescription(metadata.shortDescription, genericDescription);
    return response.status(200).json(metadata);
  } catch {
    return response.status(502).json({ message: "AI 응답을 도서 정보로 변환하지 못했습니다." });
  }
};
