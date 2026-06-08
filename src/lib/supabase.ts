const SUPABASE_URL = "https://fijtpyrmqzjefucsqfos.supabase.co";
const SUPABASE_KEY = "sb_publishable_jx5epW3SB77-naKWZeUYnA_v5xoAgbU";

// ── 사용자 토큰 (로그인 후 모든 호출에 사용 — RLS의 전제) ──
let accessToken: string | null = null;
let refreshToken: string | null = null;
let onAuthFail: (() => void) | null = null;

export const setAuthTokens = (a: string | null, r: string | null) => { accessToken = a; refreshToken = r; };
export const getAuthTokens = () => ({ access_token: accessToken, refresh_token: refreshToken });
export const setOnAuthFail = (cb: () => void) => { onAuthFail = cb; };

// refresh_token으로 세션 갱신 (성공 시 새 토큰 반환, 실패 시 null)
export const refreshSession = async (): Promise<any | null> => {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) return null;
    accessToken = data.access_token; refreshToken = data.refresh_token;
    return data;
  } catch { return null; }
};

export const sb = async (table: string, method = "GET", body: any = null, query = "", _retry = false): Promise<any> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" || method === "PATCH" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  // 토큰 만료 → 1회 갱신 후 재시도
  if (res.status === 401 && accessToken && !_retry) {
    const r = await refreshSession();
    if (r) return sb(table, method, body, query, true);
    if (onAuthFail) onAuthFail();
    throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
  }
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
};

export const sbAuth = async (endpoint: string, body: any): Promise<any> => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "인증 오류");
  return data;
};
