// Supabase Edge Function: booking-respond
// 모델 섭외 초대 응답 API. 화면(렌더)은 앱 도메인의 정적 페이지 /respond.html 이 담당하고,
// 이 함수는 JSON API + 동작 수행만 한다. (Supabase 함수가 직접 HTML을 주면 일부 모바일 브라우저가
// text/plain 으로 받아 .txt 다운로드시키는 문제가 있어, 렌더는 앱 도메인 정적 파일로 분리.)
//
//  GET ?id&token&info=1   → JSON { ok, status, model_response, schedule, modelName, clientName }
//  GET ?id&token&do=accept   → model_response=accepted → gcal-sync(에이전시 캘린더 생성 + 모델 게스트) → JSON { ok, result:"accepted", schedule }
//  GET ?id&token&do=decline  → model_response=declined → 에이전시 알림 메일(베스트에포트) → JSON { ok, result:"declined", schedule }
//  CORS 허용(정적 페이지에서 fetch). OPTIONS 프리플라이트 처리.
//  하위호환: 구버전 메일의 직접 링크(GET intent= / bare)는 앱 /respond.html 로 302 리다이렉트,
//            구버전 POST(action=)는 동작 수행 후 303 리다이렉트.
//
// 배포: 함수명 booking-respond, Verify JWT OFF.
//   시크릿: 기본 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (자동), (선택) FN_SHARED_SECRET(에이전시 알림 메일용)

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

// 렌더 정적 페이지 호스트(구버전 메일 리다이렉트용 기본값). 신규 메일은 발송 시점 앱 origin 을 직접 사용.
const APP_BASE = env("RESPOND_PAGE_BASE") || "https://modiq.kr";

const TYPE_LABEL: Record<string, string> = { SHOOT: "촬영", MEETING: "실물미팅", FITTING: "피팅", AUDITION: "오디션" };
const TYPE_EN: Record<string, string> = { SHOOT: "Shoot", MEETING: "Meeting", FITTING: "Fitting", AUDITION: "Audition" };

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// "09:30:00" / "09:30" → "HH:MM:SS"
const hms = (s: string) => { const a = String(s || "").split(":"); return `${(a[0] || "00").padStart(2, "0")}:${(a[1] || "00").padStart(2, "0")}:${(a[2] || "00").padStart(2, "0")}`; };

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const token = url.searchParams.get("token") || "";
  const isInfo = url.searchParams.has("info");
  let act = url.searchParams.get("do") || "";

  // 구버전 POST(action=) 폼 하위호환: 동작값을 읽는다.
  if (!act && req.method === "POST") {
    try { const form = await req.formData(); act = String(form.get("action") || ""); }
    catch { try { const t = await req.text(); act = new URLSearchParams(t).get("action") || ""; } catch { /* noop */ } }
  }

  // 구버전 메일의 직접 GET 링크(info/do 없음: intent= 또는 bare) → 앱 정적 렌더 페이지로 리다이렉트
  if (req.method === "GET" && !isInfo && !act) {
    const dest = `${APP_BASE}/respond.html?${url.searchParams.toString()}`;
    return Response.redirect(dest, 302);
  }

  if (!id || !token) return json({ ok: false, error: "invalid_link" }, 400);

  const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const get = (path: string) => fetch(`${SB}/rest/v1/${path}`, { headers: h }).then(r => r.json()).catch(() => []);

  // 섭외 조회 + 토큰 검증
  const rows = await get(`bookings?id=eq.${encodeURIComponent(id)}&select=id,model_id,customer_id,agency_id,booking_type,project_name,shoot_date,start_time,end_time,location,manager,memo,status,model_response,model_resp_token,gcal_event_id`);
  const b = Array.isArray(rows) && rows[0];
  if (!b || !b.model_resp_token || b.model_resp_token !== token) return json({ ok: false, error: "invalid_token" }, 404);

  // 모델/고객사 이름
  const [models, custs] = await Promise.all([
    get(`models?id=eq.${encodeURIComponent(b.model_id)}&select=name,email`),
    get(`customers?id=eq.${encodeURIComponent(b.customer_id)}&select=name`),
  ]);
  const model = (Array.isArray(models) && models[0]) || {};
  const clientName = (Array.isArray(custs) && custs[0]?.name) || "고객사";
  const modelName = model?.name || "모델";

  const ty = TYPE_LABEL[b.booking_type || "SHOOT"] || "일정";
  const tyEn = TYPE_EN[b.booking_type || "SHOOT"] || "Schedule";
  const summary = `[${ty} · ${tyEn}] ${clientName} · ${modelName}`;
  const description = [
    `Type: ${ty} · ${tyEn}`,
    b.project_name ? `Project: ${b.project_name}` : "",
    `Client: ${clientName}`, `Model: ${modelName}`,
    b.location ? `위치/Location: ${b.location}` : "",
    b.manager ? `Manager: ${b.manager}` : "",
    b.memo ? `메모/Memo: ${b.memo}` : "",
  ].filter(Boolean).join("\n");

  // 정적 페이지가 카드/ics/구글링크를 렌더하기 위한 일정 데이터
  const schedule = {
    id: b.id, bookingType: b.booking_type || "SHOOT",
    projectName: b.project_name || "", clientName, modelName,
    date: b.shoot_date || "", start: b.start_time || "", end: b.end_time || "",
    location: b.location || "", summary, description, status: b.status,
  };

  // 구버전 POST 동작 처리 후 정적 페이지로 리다이렉트(303 → GET)
  const legacyPost = req.method === "POST" && !!act;

  // ── 수락 ──
  if (act === "accept") {
    if (b.status === "CANCELLED") return legacyPost ? Response.redirect(`${APP_BASE}/respond.html?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, 303) : json({ ok: false, error: "cancelled", schedule }, 409);
    let eventId = b.gcal_event_id || "";
    if (!(b.model_response === "accepted" && eventId)) {
      try {
        const payload: any = { action: eventId ? "update" : "create", agency_id: b.agency_id, event_id: eventId || undefined, summary, description, location: b.location || "", attendee_email: model?.email || "" };
        if (b.start_time) { payload.all_day = false; payload.start = `${b.shoot_date}T${hms(b.start_time)}`; payload.end = `${b.shoot_date}T${hms(b.end_time || b.start_time)}`; }
        else { payload.all_day = true; payload.date = b.shoot_date; }
        const gr = await fetch(`${SB}/functions/v1/gcal-sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(r => r.json()).catch(() => ({}));
        if (gr?.event_id) eventId = gr.event_id;
      } catch { /* 구글 실패해도 수락은 기록 */ }
      await fetch(`${SB}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { ...h, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ model_response: "accepted", model_responded_at: new Date().toISOString(), ...(eventId ? { gcal_event_id: eventId } : {}) }),
      }).catch(() => {});
    }
    return legacyPost ? Response.redirect(`${APP_BASE}/respond.html?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, 303) : json({ ok: true, result: "accepted", schedule });
  }

  // ── 거절 ──
  if (act === "decline") {
    await fetch(`${SB}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...h, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ model_response: "declined", model_responded_at: new Date().toISOString() }),
    }).catch(() => {});
    // 에이전시 알림(베스트에포트)
    try {
      const FN = env("FN_SHARED_SECRET");
      const ag = await get(`agencies?id=eq.${encodeURIComponent(b.agency_id)}&select=owner_email,name`);
      const ownerEmail = Array.isArray(ag) && ag[0]?.owner_email;
      if (FN && ownerEmail) {
        await fetch(`${SB}/functions/v1/email-send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-fn-secret": FN },
          body: JSON.stringify({
            to: ownerEmail,
            subject: `[modiq] ${modelName} 님이 일정을 거절했습니다 — ${b.project_name || clientName}`,
            text: `${modelName} 님이 아래 일정을 거절했습니다.\n\n유형: ${ty}\n고객사: ${clientName}\n일자: ${String(b.shoot_date).replace(/-/g, ".")}${b.start_time ? " " + hms(b.start_time).slice(0, 5) : ""}\n\nmodiq 섭외에서 확인하세요.`,
          }),
        });
      }
    } catch { /* noop */ }
    return legacyPost ? Response.redirect(`${APP_BASE}/respond.html?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`, 303) : json({ ok: true, result: "declined", schedule });
  }

  // ── info: 현재 상태 + 일정 데이터 ──
  return json({
    ok: true,
    status: b.status === "CANCELLED" ? "cancelled" : "ok",
    model_response: b.model_response || "",
    schedule, modelName, clientName,
  });
});
