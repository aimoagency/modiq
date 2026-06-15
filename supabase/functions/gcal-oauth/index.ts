// Supabase Edge Function: gcal-oauth
// 구글 OAuth 콜백 — 동의 후 code를 토큰으로 교환하고 refresh_token을 agency별로 저장.
//
// 배포: Via Editor 로 함수명 gcal-oauth 생성 → 이 코드 붙여넣기 → Deploy (Verify JWT OFF)
// 시크릿: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 기본 제공)
// 구글 콘솔 승인된 리디렉션 URI = 이 함수 URL 과 동일해야 함.

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

const page = (msg: string, ok = true) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#eceff3;color:#1a1d27">
       <div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:380px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)">
         <div style="font-size:40px">${ok ? "✅" : "⚠️"}</div>
         <h2 style="margin:10px 0 6px;font-size:18px">${ok ? "구글 캘린더 연동 완료" : "연동 실패"}</h2>
         <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.6">${msg}</p>
       </div>
     </div>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const agencyId = url.searchParams.get("state") || "";
  if (!code || !agencyId) return page("잘못된 요청입니다. 설정 화면에서 다시 시도하세요.", false);

  const clientId = env("GOOGLE_CLIENT_ID"), clientSecret = env("GOOGLE_CLIENT_SECRET"), redirect = env("GOOGLE_REDIRECT_URI");
  if (!clientId || !clientSecret || !redirect) return page("서버 설정(구글 시크릿)이 누락되었습니다.", false);

  // 1) code → 토큰 교환
  let tok: any;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
    });
    tok = await r.json();
    if (!r.ok || !tok.refresh_token) {
      return page(`토큰 발급 실패: ${tok.error_description || tok.error || "refresh_token 없음(이미 연동된 계정이면 구글 계정 권한에서 modiq 액세스 제거 후 재시도)"}`, false);
    }
  } catch (e) { return page("토큰 교환 중 오류: " + String(e), false); }

  // 2) 연동 이메일(선택)
  let email = "";
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const ui = await u.json(); email = ui?.email || "";
  } catch { /* 무시 */ }

  // 3) refresh_token 저장(upsert)
  const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const r = await fetch(`${SB}/rest/v1/google_tokens?on_conflict=agency_id`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ agency_id: agencyId, refresh_token: tok.refresh_token, email }),
    });
    if (!r.ok) { const t = await r.text(); return page("토큰 저장 실패(google_tokens 테이블 필요): " + t, false); }
  } catch (e) { return page("토큰 저장 오류: " + String(e), false); }

  return page(`연동된 계정: ${email || "구글 캘린더"}<br>이제 이 창을 닫고 modiq로 돌아가세요. 섭외를 확정하면 일정이 자동으로 만들어집니다.`);
});
