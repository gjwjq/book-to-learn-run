const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function getServerConfig() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  return { url, publishableKey, serviceRoleKey };
}

function getClientAddress(request) {
  return String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 120);
}

function consumeLoginAttempt(key) {
  const now = Date.now();
  if (loginAttempts.size > 5000) {
    for (const [storedKey, attempt] of loginAttempts) {
      if (attempt.resetAt <= now) loginAttempts.delete(storedKey);
    }
  }
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

async function resolveEmailFromLoginId(config, loginId) {
  const profileResponse = await fetch(
    `${config.url}/rest/v1/profiles?login_id=eq.${encodeURIComponent(loginId)}&select=id&limit=1`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    },
  );
  if (!profileResponse.ok) return "";
  const profile = (await profileResponse.json())?.[0];
  if (!profile?.id) return "";

  const userResponse = await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(profile.id)}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!userResponse.ok) return "";
  return String((await userResponse.json())?.email || "").trim().toLowerCase();
}

async function passwordGrant(config, email, password) {
  return fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "POST 요청만 사용할 수 있습니다." });
  }

  const rateLimit = consumeLoginAttempt(getClientAddress(request));
  if (!rateLimit.allowed) {
    response.setHeader("Retry-After", String(rateLimit.retryAfter));
    return response.status(429).json({
      message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  const config = getServerConfig();
  if (!config.url || !config.publishableKey || !config.serviceRoleKey) {
    return response.status(503).json({
      message: "로그인 서버 설정이 완료되지 않았습니다.",
    });
  }

  const identifier = String(request.body?.identifier || "").trim().toLowerCase().slice(0, 254);
  const password = String(request.body?.password || "").slice(0, 1024);
  if (!identifier || !password) {
    return response.status(400).json({ message: "아이디 또는 이메일과 비밀번호를 입력해 주세요." });
  }

  try {
    const email = identifier.includes("@")
      ? identifier
      : await resolveEmailFromLoginId(config, identifier);

    // 존재하지 않는 아이디도 실제 로그인 요청과 비슷한 경로를 거쳐 계정 존재 여부를 숨깁니다.
    const grantResponse = await passwordGrant(
      config,
      email || `invalid-${Date.now()}@invalid.local`,
      password,
    );
    const grantResult = await grantResponse.json().catch(() => ({}));

    if (!email || !grantResponse.ok || !grantResult.access_token || !grantResult.refresh_token) {
      return response.status(401).json({
        message: "아이디 또는 이메일과 비밀번호를 확인해 주세요.",
      });
    }

    return response.status(200).json({ session: grantResult });
  } catch {
    return response.status(502).json({
      message: "로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
};
