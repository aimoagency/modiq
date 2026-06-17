const SUPABASE_URL = "https://fijtpyrmqzjefucsqfos.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpanRweXJtcXpqZWZ1Y3NxZm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzMyNjgsImV4cCI6MjA5NTYwOTI2OH0.tdnqIDJBY809IBO6OIEykxCezo9QY1Z_ziiqMFtYW2o";

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

// ── Supabase Storage (모델 사진) ──
// base64를 DB에 저장하던 방식 → Storage에 업로드하고 DB엔 URL만 저장(조회 용량 대폭 감소)
export const STORAGE_BUCKET = "model-photos";

// 원본 Storage 사진 URL → 썸네일 URL(_thumb). 업로드 때 함께 저장. 비-Storage(base64 등)는 그대로.
export const thumbUrl = (url: string) => (typeof url === "string" && url.includes("/object/public/") && /\.jpe?g(\?.*)?$/i.test(url))
  ? url.replace(/(\.jpe?g)(\?.*)?$/i, "_thumb$1$2")
  : url;

// data:URL 문자열 → Blob (업로드용)
export const dataURLtoBlob = (dataURL: string): Blob => {
  const [head, b64] = dataURL.split(",");
  const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

// Storage 업로드 → 공개 URL 반환. 실패 시 throw (호출부에서 base64 폴백 가능)
export const sbUpload = async (path: string, blob: Blob, _retry = false): Promise<string> => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${encodeURI(path)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
      "Content-Type": blob.type || "image/jpeg",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (res.status === 401 && accessToken && !_retry) {
    const r = await refreshSession();
    if (r) return sbUpload(path, blob, true);
    if (onAuthFail) onAuthFail();
    throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
  }
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${encodeURI(path)}`;
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
