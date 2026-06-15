// Supabase Edge Function: email-send
// Resend로 이메일 발송(.ics 첨부 지원). API 키는 이 함수의 시크릿에만 보관 — 프론트 노출 금지.
//
// 배포:
//   supabase functions deploy email-send --no-verify-jwt
// 시크릿 설정:
//   supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="modiq <noreply@yourdomain.com>" \
//     FN_SHARED_SECRET=원하는임의문자열
//   (EMAIL_FROM은 Resend에서 인증한 도메인/주소. 테스트는 onboarding@resend.dev 사용 가능)
//
// 프론트(.env): VITE_EMAIL_FN_URL=https://<project>.supabase.co/functions/v1/email-send
//               VITE_EMAIL_FN_SECRET=위 FN_SHARED_SECRET 와 동일

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-fn-secret, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // 공유 시크릿 검증 (설정된 경우)
  const shared = env("FN_SHARED_SECRET");
  if (shared && req.headers.get("x-fn-secret") !== shared) return json({ error: "unauthorized" }, 401);

  let p: any;
  try { p = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const to = String(p?.to || "").trim();
  const subject = String(p?.subject || "").trim();
  const html = String(p?.html || "");
  const text = String(p?.text || "");
  if (!to || !subject || (!html && !text)) return json({ error: "to/subject/본문 필수" }, 400);

  const apiKey = env("RESEND_API_KEY");
  const from = env("EMAIL_FROM");
  if (!apiKey || !from) return json({ error: "RESEND_API_KEY / EMAIL_FROM 미설정" }, 500);

  const body: any = { from, to: [to], subject };
  if (html) body.html = html;
  if (text) body.text = text;
  // .ics 첨부 (base64 content)
  if (p?.icsBase64) {
    body.attachments = [{
      filename: String(p?.icsFilename || "schedule.ics"),
      content: String(p.icsBase64),
      content_type: "text/calendar",
    }];
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return json({ ok: false, status: res.status, data }, 502);
    return json({ ok: true, data });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
});
