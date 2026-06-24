// Supabase Edge Function: booking-respond
// 모델이 섭외 초대 메일의 [수락]/[거절] 링크를 눌렀을 때 처리하는 공개 페이지.
//  메일 링크(GET): ?id&token&intent=accept|decline → 일정 카드 + "확정" 링크(스캐너 자동수행 방지: 실제 동작은 do= 한 번 더)
//  GET ?id&token&do=accept   → model_response=accepted → gcal-sync 호출(에이전시 캘린더 생성 + 모델 게스트 초대) → "수락 완료"(.ics/구글추가 제공)
//  GET ?id&token&do=decline  → model_response=declined → 에이전시에 알림 메일(베스트에포트) → "거절"
//  ⚠️ 폼(POST) 대신 GET 링크만 사용 — 일부 모바일 메일 인앱 브라우저가 form 페이지를 text로 받아 다운로드시키는 문제 회피.
//     (스캐너 자동수락 방지는 intent→do 2단계 링크로 유지: 단일 프리패치로는 do 단계에 도달하지 않음)
//  하위호환: 기존에 발송된 메일의 POST 폼(action=accept|decline)도 그대로 처리.
//
// 배포: 함수명 booking-respond, Verify JWT OFF.
//   시크릿: 기본 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (자동), (선택) FN_SHARED_SECRET(에이전시 알림 메일용)
//   같은 프로젝트의 gcal-sync / email-send 함수를 내부에서 호출한다.

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

const TYPE_LABEL: Record<string, string> = { SHOOT: "촬영", MEETING: "실물미팅", FITTING: "피팅", AUDITION: "오디션" };
const TYPE_EN: Record<string, string> = { SHOOT: "Shoot", MEETING: "Meeting", FITTING: "Fitting", AUDITION: "Audition" };

const hesc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const icsEsc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (d: string) => (d || "").replace(/-/g, "");
// "09:30:00" / "09:30" → "HH:MM:SS"
const hms = (s: string) => { const a = String(s || "").split(":"); return `${(a[0] || "00").padStart(2, "0")}:${(a[1] || "00").padStart(2, "0")}:${(a[2] || "00").padStart(2, "0")}`; };
const hmsCompact = (s: string) => hms(s).replace(/:/g, "");
const nextDay = (d: string) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + 1); const p = (n: number) => String(n).padStart(2, "0"); return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}`; };

// ── 완전한 HTML 문서 셸 (모바일 인앱 브라우저에서도 확실히 렌더되도록 <html><head><title> 포함) ──
const shell = (inner: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>modiq · 일정</title></head>
<body style="margin:0;background:#eceff3">
<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#16181f;padding:18px;box-sizing:border-box">
<div style="background:#fff;border-radius:16px;padding:26px 22px;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.1)">${inner}</div>
</div>
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

const card = (b: any, clientName: string) => {
  const ty = TYPE_LABEL[b.booking_type || "SHOOT"] || "일정";
  const tyEn = TYPE_EN[b.booking_type || "SHOOT"] || "Schedule";
  const headline = b.project_name || clientName || `${ty} 일정`;
  const dateStr = b.shoot_date ? String(b.shoot_date).replace(/-/g, ".") : "날짜 미정";
  const timeStr = b.start_time ? `${hms(b.start_time).slice(0, 5)}${b.end_time ? `–${hms(b.end_time).slice(0, 5)}` : ""} (KST)` : "종일";
  const rows = [
    b.project_name ? ["Project · 프로젝트", b.project_name] : null,
    ["Brand · 고객사", clientName],
    ["Type · 유형", `${ty} · ${tyEn}`],
    ["Date · 날짜", dateStr],
    ["Time · 시간", timeStr],
    b.location ? ["Location · 장소", b.location] : null,
  ].filter(Boolean) as [string, string][];
  return `
    <div style="font-size:11px;letter-spacing:1.5px;color:#8a93a0">SCHEDULE · 일정</div>
    <div style="font-size:19px;font-weight:800;margin:6px 0 14px">${hesc(headline)}</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
      ${rows.map(([k, v]) => `<tr style="border-top:1px solid #f1f3f5"><td style="padding:9px 0;color:#8a93a0;width:120px;vertical-align:top;font-size:13px">${hesc(k)}</td><td style="padding:9px 0;font-size:13px;color:#16181f">${hesc(v)}</td></tr>`).join("")}
    </table>`;
};

// 섭외 → .ics 본문
const buildIcs = (b: any, summary: string, description: string): string => {
  const timed = !!b.start_time;
  const dtStart = timed ? `DTSTART:${compact(b.shoot_date)}T${hmsCompact(b.start_time)}` : `DTSTART;VALUE=DATE:${compact(b.shoot_date)}`;
  const dtEnd = timed ? `DTEND:${compact(b.shoot_date)}T${hmsCompact(b.end_time || b.start_time)}` : `DTEND;VALUE=DATE:${nextDay(b.shoot_date)}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//modiq//talent//KO", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${b.id}@modiq`, `DTSTAMP:${stamp}`, dtStart, dtEnd,
    `SUMMARY:${icsEsc(summary)}`,
    ...(b.location ? [`LOCATION:${icsEsc(b.location)}`] : []),
    ...(description ? [`DESCRIPTION:${icsEsc(description)}`] : []),
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:일정 알림", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
};

// 구글 캘린더 추가 URL
const googleUrl = (b: any, summary: string, description: string): string => {
  let dates: string;
  if (b.start_time) {
    dates = `${compact(b.shoot_date)}T${hmsCompact(b.start_time)}/${compact(b.shoot_date)}T${hmsCompact(b.end_time || b.start_time)}`;
  } else {
    dates = `${compact(b.shoot_date)}/${nextDay(b.shoot_date)}`;
  }
  const p = new URLSearchParams({
    action: "TEMPLATE", text: summary, dates, ctz: "Asia/Seoul",
    ...(b.location ? { location: b.location } : {}),
    ...(description ? { details: description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const token = url.searchParams.get("token") || "";
  const base = `?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
  if (!id || !token) return shell(`<div style="font-size:40px">⚠️</div><h2 style="margin:10px 0 6px;font-size:18px">잘못된 링크</h2><p style="margin:0;font-size:14px;color:#6b7280">메일의 버튼을 다시 눌러주세요.</p>`, 400);

  const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const get = (path: string) => fetch(`${SB}/rest/v1/${path}`, { headers: h }).then(r => r.json()).catch(() => []);

  // 1) 섭외 조회 + 토큰 검증
  const rows = await get(`bookings?id=eq.${encodeURIComponent(id)}&select=id,model_id,customer_id,agency_id,booking_type,project_name,shoot_date,start_time,end_time,location,manager,memo,status,model_response,model_resp_token,gcal_event_id`);
  const b = Array.isArray(rows) && rows[0];
  if (!b || !b.model_resp_token || b.model_resp_token !== token) {
    return shell(`<div style="font-size:40px">⚠️</div><h2 style="margin:10px 0 6px;font-size:18px">유효하지 않은 링크</h2><p style="margin:0;font-size:14px;color:#6b7280">만료되었거나 잘못된 링크입니다. 담당자에게 문의해주세요.</p>`, 404);
  }

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

  // 취소된 섭외면 응답 불가
  if (b.status === "CANCELLED") {
    return shell(card(b, clientName) + `<div style="margin-top:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;color:#b91c1c;font-size:13px;font-weight:600">이 일정은 취소되었습니다 · This schedule was cancelled.</div>`);
  }

  // ── 실제 수락 처리 ──
  const doAccept = async (): Promise<Response> => {
    let eventId = b.gcal_event_id || "";
    if (!(b.model_response === "accepted" && eventId)) {
      // gcal-sync 호출(에이전시 캘린더 생성 + 모델 게스트 초대). 구글 미연동 등은 skipped — 수락은 그래도 기록.
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
    const ics = buildIcs(b, summary, description);
    const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    const gUrl = googleUrl(b, summary, description);
    return shell(
      card(b, clientName) +
      `<div style="margin:8px 0 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;color:#047857;font-size:14px;font-weight:700;text-align:center">✓ 수락되었습니다 · Accepted</div>
       <p style="font-size:12.5px;color:#6b7280;margin:0 0 10px;line-height:1.6">내 캘린더에도 추가하세요 · Add to your calendar:</p>
       <a href="${hesc(gUrl)}" target="_blank" rel="noreferrer" style="display:block;text-align:center;background:#1a73e8;color:#fff;text-decoration:none;padding:12px;border-radius:8px;font-weight:700;font-size:14px;margin-bottom:8px">Google Calendar에 추가</a>
       <a href="${icsHref}" download="schedule.ics" style="display:block;text-align:center;background:#f3f4f6;color:#16181f;text-decoration:none;padding:12px;border-radius:8px;font-weight:700;font-size:14px">Apple · Outlook · 기타 (.ics 파일)</a>`,
    );
  };

  // ── 실제 거절 처리 ──
  const doDecline = async (): Promise<Response> => {
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
    return shell(card(b, clientName) + `<div style="margin-top:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;color:#b91c1c;font-size:14px;font-weight:700;text-align:center">거절이 접수되었습니다.<div style="font-weight:400;color:#7f1d1d;margin-top:4px;font-size:12px">담당자에게 전달됩니다 · Your decline has been sent to the agency.</div></div>`);
  };

  // 동작 결정: GET ?do= (실제 수행) / POST action= (구버전 폼 하위호환) / GET ?intent= (확정 화면)
  let act = url.searchParams.get("do") || "";
  if (!act && req.method === "POST") {
    try { const form = await req.formData(); act = String(form.get("action") || ""); }
    catch { try { const t = await req.text(); act = new URLSearchParams(t).get("action") || ""; } catch { /* noop */ } }
  }

  if (act === "accept") return await doAccept();
  if (act === "decline") return await doDecline();

  // 이미 수락된 일정이면 안내
  if (b.model_response === "accepted") {
    return shell(card(b, clientName) + `<div style="margin-top:8px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;color:#047857;font-size:14px;font-weight:700;text-align:center">이미 수락한 일정입니다 · Already accepted</div>`);
  }

  // ── GET: 확정 화면 (메일에서 수락/거절을 누르면 도착) — 폼 없이 링크만 사용 ──
  const intent = url.searchParams.get("intent") || "";
  const btn = (href: string, label: string, primary: string, fg = "#fff", border = "none") =>
    `<a href="${hesc(href)}" style="display:block;text-align:center;background:${primary};color:${fg};text-decoration:none;padding:13px;border-radius:9px;font-weight:800;font-size:15px;border:${border}">${label}</a>`;

  if (intent === "decline") {
    return shell(
      card(b, clientName) +
      `<p style="font-size:13px;color:#6b7280;margin:6px 0 14px;line-height:1.6">${hesc(modelName)} 님, 아래 일정을 <b>거절</b>하시겠어요? 확정하려면 버튼을 눌러주세요.</p>
       ${btn(`${base}&do=decline`, "✕ 거절 확정 / Confirm Decline", "#ef4444")}
       <div style="margin-top:8px">${btn(`${base}&do=accept`, "✓ 아니요, 수락할게요", "#10b981")}</div>`,
    );
  }
  // 기본/intent=accept → 수락 확정 화면
  return shell(
    card(b, clientName) +
    `<p style="font-size:13px;color:#6b7280;margin:6px 0 14px;line-height:1.6">${hesc(modelName)} 님, 아래 일정을 <b>수락</b>하시겠어요? 수락하면 캘린더에 일정이 추가됩니다.</p>
     ${btn(`${base}&do=accept`, "✓ 수락 확정 / Confirm Accept", "#10b981")}
     <div style="margin-top:8px">${btn(`${base}&do=decline`, "✕ 거절하기", "#ffffff", "#ef4444", "1px solid #fecaca")}</div>`,
  );
});
