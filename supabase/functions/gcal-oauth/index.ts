// Supabase Edge Function: gcal-oauth
// 구글 OAuth 콜백 — 동의 후 code를 토큰으로 교환하고 refresh_token을 agency별로 저장.
//
// ⚠️ 이 함수는 HTML을 직접 렌더하지 않는다. (모바일 Safari 등에서 Supabase 함수가 준 HTML이
//    text/plain·잘못된 인코딩으로 처리돼 글자가 깨지거나 .txt 다운로드되는 문제 — respond.html과 동일 이슈)
//    대신 처리 결과를 쿼리(?gcal=ok|fail)로 붙여 "시작한 앱 도메인(modiq 홈)"으로 302 리다이렉트한다.
//    앱(App.tsx)이 ?gcal 파라미터를 보고 안내 토스트를 띄운다.
//
// 배포: Via Editor 로 함수명 gcal-oauth 생성 → 이 코드 붙여넣기 → Deploy (Verify JWT OFF)
// 시크릿: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (선택: APP_BASE)
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 기본 제공)
// 구글 콘솔 승인된 리디렉션 URI = 이 함수 URL 과 동일해야 함.

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

// 콜백 후 돌아갈 앱 도메인. state 의 origin(허용 도메인만) 우선, 없으면 APP_BASE/모딕 홈.
function safeBase(origin: string): string | null {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return null;
    const h = u.hostname;
    if (h === "modiq.kr" || h.endsWith(".modiq.kr") || h.endsWith(".vercel.app") || h.endsWith(".netlify.app")) return u.origin;
  } catch { /* ignore */ }
  return null;
}

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const stateRaw = url.searchParams.get("state") || "";
  const sep = stateRaw.indexOf("|");
  const agencyId = sep >= 0 ? stateRaw.slice(0, sep) : stateRaw;   // state = agencyId | origin
  const originEnc = sep >= 0 ? stateRaw.slice(sep + 1) : "";
  let appBase = env("APP_BASE") || "https://modiq.kr";
  if (originEnc) { try { appBase = safeBase(decodeURIComponent(originEnc)) || appBase; } catch { /* ignore */ } }
  appBase = appBase.replace(/\/+$/, "");

  // 결과를 ?gcal=... 로 붙여 앱 홈으로 302 (HTML 직접 렌더 금지)
  const back = (params: Record<string, string>) =>
    new Response(null, { status: 302, headers: { Location: appBase + "/?" + new URLSearchParams(params).toString() } });

  if (!code || !agencyId) return back({ gcal: "fail", reason: "badreq" });

  const clientId = env("GOOGLE_CLIENT_ID"), clientSecret = env("GOOGLE_CLIENT_SECRET"), redirect = env("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirect) return back({ gcal: "fail", reason: "config" });

  const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  // 이미 저장된 토큰(=과거 연동 성공)이 있으면 그 이메일을 반환.
  // 일회용 code 재사용/새로고침(invalid_grant) 시 "이미 연동됨"으로 성공 처리하는 데 사용.
  const existingEmail = async (): Promise<string> => {
    try {
      const r = await fetch(`${SB}/rest/v1/google_tokens?agency_id=eq.${encodeURIComponent(agencyId)}&select=email,refresh_token`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]?.refresh_token) return rows[0].email || "구글 캘린더";
    } catch { /* ignore */ }
    return "";
  };

  // 1) code → 토큰 교환
  let tok: any;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
    });
    tok = await r.json();
    if (!r.ok) {
      const em = await existingEmail();   // invalid_grant 등 — 이미 연동돼 있으면 성공 처리
      return em ? back({ gcal: "ok", email: em, already: "1" }) : back({ gcal: "fail", reason: "exchange" });
    }
  } catch {
    const em = await existingEmail();
    return em ? back({ gcal: "ok", email: em, already: "1" }) : back({ gcal: "fail", reason: "exchange" });
  }

  if (!tok.refresh_token) {
    const em = await existingEmail();     // refresh_token 미발급(이미 동의된 계정 등) — 기존 토큰 있으면 유지·성공
    return em ? back({ gcal: "ok", email: em, already: "1" }) : back({ gcal: "fail", reason: "norefresh" });
  }

  // 2) 연동 이메일(선택)
  let email = "";
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const ui = await u.json(); email = ui?.email || "";
  } catch { /* 무시 */ }

  // 3) refresh_token 저장(upsert)
  try {
    const r = await fetch(`${SB}/rest/v1/google_tokens?on_conflict=agency_id`, {
      method: "POST",
      headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ agency_id: agencyId, refresh_token: tok.refresh_token, email }),
    });
    if (!r.ok) return back({ gcal: "fail", reason: "save" });
  } catch { return back({ gcal: "fail", reason: "save" }); }

  // 회사정보에 연동 이메일 표시용 저장
  try { await fetch(`${SB}/rest/v1/agencies?id=eq.${encodeURIComponent(agencyId)}`, { method: "PATCH", headers: h, body: JSON.stringify({ gcal_email: email }) }); } catch { /* 무시 */ }

  return back({ gcal: "ok", email: email || "구글 캘린더" });
});
