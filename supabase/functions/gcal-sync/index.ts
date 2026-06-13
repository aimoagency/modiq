// Supabase Edge Function: gcal-sync
// 섭외 일정을 에이전시 구글 캘린더에 생성/수정/삭제하고 모델을 게스트로 초대.
// refresh_token(google_tokens)으로 access_token을 발급받아 Calendar API 호출.
//
// 배포: Via Editor, 함수명 gcal-sync, Verify JWT OFF
// 시크릿: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (이미 설정), 기본 SUPABASE_*

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let p: any;
  try { p = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { action, agency_id, event_id, summary, description, location, start, end, all_day, date, attendee_email } = p || {};
  if (!agency_id || !action) return json({ error: "agency_id/action 필수" }, 400);

  // 1) refresh_token 조회
  const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const rows = await fetch(`${SB}/rest/v1/google_tokens?agency_id=eq.${encodeURIComponent(agency_id)}&select=refresh_token`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }).then(r => r.json()).catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return json({ skipped: true, reason: "구글 미연동" });
  const refresh = rows[0].refresh_token;

  // 2) access_token 발급
  let at = "";
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), refresh_token: refresh, grant_type: "refresh_token" }),
    });
    const t = await r.json();
    if (!r.ok || !t.access_token) return json({ error: "access_token 발급 실패: " + JSON.stringify(t) }, 502);
    at = t.access_token;
  } catch (e) { return json({ error: "토큰 오류: " + String(e) }, 502); }

  const cal = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const auth = { Authorization: `Bearer ${at}`, "Content-Type": "application/json" };

  // 3) 삭제
  if (action === "delete") {
    if (!event_id) return json({ ok: true, skipped: true });
    const r = await fetch(`${cal}/${event_id}?sendUpdates=all`, { method: "DELETE", headers: auth });
    if (!r.ok && r.status !== 410 && r.status !== 404) return json({ error: "삭제 실패: " + (await r.text()) }, 502);
    return json({ ok: true });
  }

  // 4) 생성/수정 이벤트 본문
  const body: any = { summary: summary || "일정", description: description || "", location: location || "" };
  if (all_day) { body.start = { date }; body.end = { date }; }
  else { body.start = { dateTime: start, timeZone: "Asia/Seoul" }; body.end = { dateTime: end || start, timeZone: "Asia/Seoul" }; }
  if (attendee_email) body.attendees = [{ email: attendee_email }];

  const url = action === "update" && event_id ? `${cal}/${event_id}?sendUpdates=all` : `${cal}?sendUpdates=all`;
  const method = action === "update" && event_id ? "PATCH" : "POST";
  const r = await fetch(url, { method, headers: auth, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) return json({ error: "캘린더 반영 실패: " + JSON.stringify(data) }, 502);
  return json({ ok: true, event_id: data.id });
});
