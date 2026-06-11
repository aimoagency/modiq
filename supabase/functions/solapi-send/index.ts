// Supabase Edge Function: solapi-send
// 카카오 알림톡 발송 (Solapi v4). API 키는 이 함수의 시크릿에만 보관 — 프론트 노출 금지.
//
// 배포:
//   supabase functions deploy solapi-send --no-verify-jwt
// 시크릿 설정 (승인 후 템플릿 ID 채우기):
//   supabase secrets set SOLAPI_API_KEY=... SOLAPI_API_SECRET=... SOLAPI_PFID=... \
//     SOLAPI_SENDER=01087967966 FN_SHARED_SECRET=원하는임의문자열 \
//     SOLAPI_TPL_CONFIRM=... SOLAPI_TPL_CANCEL=... SOLAPI_TPL_REMIND=... SOLAPI_TPL_CHANGE=...
//
// 프론트(.env): VITE_SOLAPI_FN_URL=https://<project>.supabase.co/functions/v1/solapi-send
//               VITE_SOLAPI_FN_SECRET=위 FN_SHARED_SECRET 와 동일 (선택)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-fn-secret, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

// Solapi HMAC-SHA256 인증 헤더 생성
async function authHeader(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(date + salt));
  const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // 간단한 공유 시크릿 검증 (선택)
  const shared = env("FN_SHARED_SECRET");
  if (shared && req.headers.get("x-fn-secret") !== shared) return json({ error: "unauthorized" }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const to = String(payload?.to || "").replace(/[^0-9]/g, "");
  const type = String(payload?.type || "");
  const audience = String(payload?.audience || "MODEL");
  const variables = payload?.variables || {};
  const fallbackText = String(payload?.fallbackText || "");
  if (!to || !type) return json({ error: "to/type 필수" }, 400);

  const apiKey = env("SOLAPI_API_KEY"), apiSecret = env("SOLAPI_API_SECRET");
  const pfId = env("SOLAPI_PFID"), from = env("SOLAPI_SENDER");
  const tplEnv = `SOLAPI_TPL_${type}_${audience}`; // 예: SOLAPI_TPL_CONFIRM_MODEL
  const templateId = env(tplEnv);
  if (!apiKey || !apiSecret || !pfId || !from) return json({ error: "Solapi 시크릿 미설정" }, 500);
  if (!templateId) return json({ error: `템플릿 ID 미설정: ${tplEnv}` }, 500);

  const message: any = {
    to, from,
    kakaoOptions: { pfId, templateId, variables, disableSms: false },
  };
  if (fallbackText) message.text = fallbackText; // 알림톡 실패 시 SMS/LMS 대체

  try {
    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Authorization": await authHeader(apiKey, apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) return json({ ok: false, status: res.status, data }, 502);
    return json({ ok: true, data });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});
