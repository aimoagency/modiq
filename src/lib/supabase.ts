const SUPABASE_URL = "https://fijtpyrmqzjefucsqfos.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpanRweXJtcXpqZWZ1Y3NxZm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzMyNjgsImV4cCI6MjA5NTYwOTI2OH0.tdnqIDJBY809IBO6OIEykxCezo9QY1Z_ziiqMFtYW2o";

// ── 사용자 토큰 (로그인 후 모든 호출에 사용 — RLS의 전제) ──
let accessToken: string | null = null;
let refreshToken: string | null = null;
let onAuthFail: (() => void) | null = null;

export const setAuthTokens = (a: string | null, r: string | null) => { accessToken = a; refreshToken = r; };
export const getAuthTokens = () => ({ access_token: accessToken, refresh_token: refreshToken });
export const setOnAuthFail = (cb: () => void) => { onAuthFail = cb; };

// ── fetch + 타임아웃 ──
// 네트워크가 응답 없이 멈추면 fetch는 무한 대기 → 로딩 스켈레톤이 영영 안 풀린다.
// AbortController로 상한을 둬 초과 시 reject시키고, 호출부 finally(loadData 등)에서 로딩을 해제하게 한다.
const FETCH_TIMEOUT_MS = 15000;
const fetchT = async (url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("네트워크 응답이 지연되어 요청을 취소했습니다. 잠시 후 다시 시도해주세요.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

// refresh_token으로 세션 갱신 (성공 시 새 토큰 반환, 실패 시 null)
// 동시 호출 코얼레싱: 여러 요청이 같은 시점에 401을 맞아도 refresh 네트워크 호출은 1회만 나가
// 결과를 공유한다(같은 refresh_token 동시 회전으로 인한 토큰 무효화·튕김 방지).
let refreshInFlight: Promise<any | null> | null = null;
export const refreshSession = async (): Promise<any | null> => {
  if (!refreshToken) return null;
  if (refreshInFlight) return refreshInFlight;   // 진행 중인 갱신이 있으면 그 결과를 재사용
  refreshInFlight = (async () => {
    try {
      const res = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json();
      if (!res.ok) return null;
      accessToken = data.access_token; refreshToken = data.refresh_token;
      return data;
    } catch { return null; }
    finally { refreshInFlight = null; }
  })();
  return refreshInFlight;
};

// 토큰 갱신을 1회 더 재시도 — 토큰 회전 레이스/네트워크 일시 오류로 한 번 실패해도
// 곧장 로그아웃(로그인 화면 튕김)되지 않도록 함. (메뉴 이동 중 간헐적 로그인 깜빡임 완화)
const refreshTwice = async (): Promise<any | null> => {
  let r = await refreshSession();
  if (!r) { await new Promise(s => setTimeout(s, 500)); r = await refreshSession(); }
  return r;
};
// onAuthFail은 한 번만 실행 — 동시 다발 401이 reload를 여러 번 부르지 않도록. (reload 시 모듈 리셋)
let authFailed = false;
const failAuthOnce = () => { if (onAuthFail && !authFailed) { authFailed = true; onAuthFail(); } };

export const sb = async (table: string, method = "GET", body: any = null, query = "", _retry = false): Promise<any> => {
  const res = await fetchT(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
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
    const r = await refreshTwice();
    if (r) return sb(table, method, body, query, true);
    failAuthOnce();
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
      // 업로드 경로가 타임스탬프+랜덤으로 고유(immutable) → 1년 캐시 안전. 재방문 시 썸네일 즉시 로딩
      "cache-control": "max-age=31536000, immutable",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (res.status === 401 && accessToken && !_retry) {
    const r = await refreshTwice();
    if (r) return sbUpload(path, blob, true);
    failAuthOnce();
    throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
  }
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${encodeURI(path)}`;
};

// 모델 썸네일을 Storage에 저장하고 공개 URL을 반환(행에 base64를 박지 않음 → 대량 모델에서도 조회 경량).
// - 이미 http URL이면 재업로드 없이 그대로, 빈값이면 "" 반환.
// - data:URL(base64)이면 Storage 업로드 후 URL 반환. 업로드 실패 시 입력값(base64) 그대로 반환(폴백 → 기존 동작 보존).
export const persistThumb = async (data: string, agencyId: string, modelId: string): Promise<string> => {
  if (!data) return "";
  if (/^https?:\/\//i.test(data)) return data;
  if (!/^data:image\//i.test(data)) return data;
  try {
    const seg = (s: string) => String(s).replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `${seg(agencyId)}/${seg(modelId)}/thumb_${Date.now()}.jpg`;
    return await sbUpload(path, dataURLtoBlob(data));
  } catch {
    return data; // 폴백: base64 그대로(동작은 함, 용량만 큼)
  }
};

export const sbAuth = async (endpoint: string, body: any): Promise<any> => {
  const res = await fetchT(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "인증 오류");
  return data;
};
