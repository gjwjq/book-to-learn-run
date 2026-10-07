// Supabase 무료 플랜은 7일간 요청이 없으면 프로젝트를 일시정지하므로
// Vercel Cron이 매일 이 함수를 호출해 가벼운 DB 요청을 보냅니다.
module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ message: "인증되지 않은 요청입니다." });
  }

  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
  if (!url || !publishableKey) {
    return response.status(503).json({ message: "Supabase 서버 설정이 완료되지 않았습니다." });
  }

  try {
    const supabaseResponse = await fetch(`${url}/rest/v1/books?select=id&limit=1`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
    });
    if (!supabaseResponse.ok) {
      return response.status(502).json({
        message: "Supabase 요청에 실패했습니다.",
        status: supabaseResponse.status,
      });
    }
    return response.status(200).json({ ok: true, checkedAt: new Date().toISOString() });
  } catch {
    return response.status(502).json({ message: "Supabase 서버에 연결할 수 없습니다." });
  }
};
