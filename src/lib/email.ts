// ── 이메일 발송 (Resend, Edge Function 경유) ─────────────────────
// 발송 경로: 프론트 → Supabase Edge Function(email-send) → Resend. 프론트에 API 키 없음.
// VITE_EMAIL_FN_URL 미설정 시 콘솔 로그만 남기고 no-op (절대 throw 안 함).
import { type CalEvent, icsText, googleCalUrl } from "./calendar";

// 기본값은 코드에 내장(supabase.ts와 동일 방식). 필요 시 .env로 덮어쓰기 가능.
const FN_URL: string = (import.meta as any).env?.VITE_EMAIL_FN_URL || "https://fijtpyrmqzjefucsqfos.supabase.co/functions/v1/email-send";
const FN_SECRET: string = (import.meta as any).env?.VITE_EMAIL_FN_SECRET || "modiq-mail-2026-x9k2";
// 모델 수락/거절 페이지: 앱 도메인의 정적 파일 /respond.html 이 렌더(Supabase 함수가 직접 HTML을
// 주면 일부 모바일 브라우저가 text/plain 으로 받아 .txt 다운로드되는 문제 → 앱 정적 페이지로 분리).
// 발송 시점의 앱 origin 을 사용(현재 빌드의 정적 파일이 확실히 존재).
const RESPOND_PAGE: string = (import.meta as any).env?.VITE_RESPOND_PAGE_URL
  || ((typeof window !== "undefined" && window.location?.origin) ? `${window.location.origin}/respond.html` : "https://modiq.kr/respond.html");

export interface EmailOpts {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  icsBase64?: string;
  icsFilename?: string;
  fromName?: string;   // 발신 표시 이름(에이전시명)
  replyTo?: string;    // 답장 받을 주소(에이전시 이메일)
}

export const sendEmail = async (opts: EmailOpts): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  const to = (opts.to || "").trim();
  if (!to) return { ok: false, error: "수신 이메일 없음" };
  if (!FN_URL) {
    console.info("[메일 미발송: VITE_EMAIL_FN_URL 미설정]", { ...opts, icsBase64: opts.icsBase64 ? "(생략)" : undefined });
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(FN_SECRET ? { "x-fn-secret": FN_SECRET } : {}) },
      body: JSON.stringify(opts),
    });
    // 실패 시 함수가 돌려준 실제 사유(Resend 오류 등)를 노출 — "HTTP 502"만 보이던 문제 개선
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error || j?.data?.message || j?.data?.error || (j?.data ? JSON.stringify(j.data) : "");
    } catch { /* 본문 파싱 실패 시 상태코드만 */ }
    if (!res.ok) return { ok: false, error: detail || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};

// utf-8 문자열 → base64 (한글 안전)
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

// ── 일정 메일 포맷 헬퍼(영문/국문 병기) ──
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_KR = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDateBi = (d: string): { en: string; kr: string } => {
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return { en: d, kr: d };
  return {
    en: `${MONTHS_EN[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()} (${WD_EN[dt.getDay()]})`,
    kr: `${d.replace(/-/g, ".")} (${WD_KR[dt.getDay()]})`,
  };
};
const to12h = (t: string): string => {
  const [h, m] = t.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${ap}`;
};
const fmtTimeBi = (start?: string, end?: string): string =>
  !start ? "All day · 종일" : `${to12h(start)}${end ? ` – ${to12h(end)}` : ""} (KST)`;
const mapsUrl = (loc: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;
// 예약 유형 영문/국문 병기 + 배지 색
const TYPE_BI: Record<string, { kr: string; en: string; color: string }> = {
  SHOOT:    { kr: "촬영",      en: "Shoot",    color: "#3b82f6" },
  MEETING:  { kr: "실물 미팅", en: "Meeting",  color: "#8b5cf6" },
  FITTING:  { kr: "피팅",      en: "Fitting",  color: "#ec4899" },
  AUDITION: { kr: "오디션",    en: "Audition", color: "#f59e0b" },
};

// 캘린더 일정을 모델에게 메일로 (영문/국문 병기 · 유형 배지 · 구글 추가 링크 · 지도 · .ics 첨부)
// 항목 순서: 프로젝트 → 브랜드 → 날짜 → 시간 → 장소
export const sendCalEmail = (
  to: string, ev: CalEvent, modelName = "", subscribeUrl = "", agencyName = "", replyTo = "",
  meta: { project?: string; brand?: string; type?: string } = {},
) => {
  const project = (meta.project || "").trim();
  const brand = (meta.brand || "").trim();
  const ty = TYPE_BI[meta.type || "SHOOT"];
  const headline = project || brand || ev.title;
  const d = fmtDateBi(ev.date);
  const timeStr = fmtTimeBi(ev.start, ev.end);
  const row = (label: string, value: string) => `
        <tr style="border-top:1px solid #f1f3f5">
          <td style="padding:9px 0;color:#8a93a0;width:110px;vertical-align:top;font-size:13px;line-height:1.5">${label}</td>
          <td style="padding:9px 0;color:#16181f;vertical-align:top;font-size:13px;line-height:1.5">${value}</td>
        </tr>`;
  const rows = [
    project ? row("Project", esc(project)) : "",
    brand ? row("Brand", esc(brand)) : "",
    row("Date", esc(d.en)),
    row("Time", esc(timeStr)),
    ev.location ? row("Location", `${esc(ev.location)}<div style="margin-top:5px"><a href="${mapsUrl(ev.location)}" style="color:#1a73e8;text-decoration:none;font-size:12px">📍 Open in Google Maps →</a></div>`) : "",
  ].filter(Boolean).join("");
  const html = `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #e8eaed;border-radius:12px;overflow:hidden;color:#16181f">
      <div style="padding:18px 22px 14px;border-bottom:1px solid #eef0f3">
        <div style="font-size:11px;letter-spacing:1.5px;color:#8a93a0">SCHEDULE NOTICE · 일정 안내</div>
        ${ty ? `<div style="margin-top:8px"><span style="display:inline-block;background:${ty.color};color:#ffffff;font-size:11px;font-weight:700;padding:3px 11px;border-radius:20px">${ty.en}</span></div>` : ""}
        <div style="font-size:18px;font-weight:700;margin-top:8px">${esc(headline)}</div>
        ${agencyName ? `<div style="font-size:12px;color:#8a93a0;margin-top:2px">from ${esc(agencyName)}</div>` : ""}
      </div>
      <div style="padding:14px 22px">
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>
      <div style="padding:2px 22px 20px">
        <a href="${googleCalUrl(ev)}" style="display:block;text-align:center;background:#1a73e8;color:#fff;text-decoration:none;padding:12px;border-radius:8px;font-weight:700;font-size:14px">Add to Google Calendar · 구글 캘린더에 추가</a>
        <p style="font-size:12px;color:#8a93a0;margin:12px 0 0;line-height:1.7">${modelName ? esc(modelName) + "님 · " : ""}Apple · Naver · Outlook: open the attached <b>.ics</b> · 첨부된 .ics 파일을 여세요.${subscribeUrl ? `<br>Subscribe to all schedules · 모든 일정 자동 받기 → <a href="${esc(subscribeUrl)}" style="color:#1a73e8;text-decoration:none">Subscribe</a>` : ""}</p>
      </div>
    </div>`;
  const text = [
    `[SCHEDULE NOTICE · 일정 안내] ${headline}`,
    ty ? `Type: ${ty.en}` : "",
    project ? `Project: ${project}` : "",
    brand ? `Brand: ${brand}` : "",
    `Date: ${d.en}`,
    `Time: ${timeStr}`,
    ev.location ? `Location: ${ev.location}` : "",
    ev.location ? `Google Maps: ${mapsUrl(ev.location)}` : "",
    ``,
    `Add to Google Calendar · 구글 캘린더에 추가: ${googleCalUrl(ev)}`,
  ].filter(Boolean).join("\n");
  return sendEmail({
    to,
    subject: `${agencyName ? `[${agencyName}] ` : ""}일정 안내 · Schedule — ${headline}`,
    html,
    text,
    icsBase64: b64(icsText(ev)),
    icsFilename: `${ev.title}.ics`,
    fromName: agencyName || undefined,
    replyTo: replyTo || undefined,
  });
};

// 섭외 초대(수락 요청) 메일 — 모델에게 일정을 보내고 [수락]/[거절] 받기.
// 수락형 흐름: 이 메일을 먼저 보내고, 모델이 수락해야 캘린더 동기화가 시작된다(booking-respond).
// 일정 카드(프로젝트→브랜드→날짜→시간→장소)는 sendCalEmail 과 동일 톤. .ics/구글추가는 수락 후 응답 페이지에서 제공.
export const sendInviteEmail = (
  to: string, ev: CalEvent, ids: { bookingId: string; token: string },
  modelName = "", agencyName = "", replyTo = "",
  meta: { project?: string; brand?: string; type?: string; forAgency?: boolean } = {},
  subscribeUrl = "",
) => {
  const project = (meta.project || "").trim();
  const brand = (meta.brand || "").trim();
  const ty = TYPE_BI[meta.type || "SHOOT"];
  const headline = project || brand || ev.title;
  const d = fmtDateBi(ev.date);
  const timeStr = fmtTimeBi(ev.start, ev.end);
  const base = `${RESPOND_PAGE}?id=${encodeURIComponent(ids.bookingId)}&token=${encodeURIComponent(ids.token)}`;
  const acceptUrl = `${base}&intent=accept`;
  const declineUrl = `${base}&intent=decline`;
  const row = (label: string, value: string) => `
        <tr style="border-top:1px solid #f1f3f5">
          <td style="padding:9px 0;color:#8a93a0;width:110px;vertical-align:top;font-size:13px;line-height:1.5">${label}</td>
          <td style="padding:9px 0;color:#16181f;vertical-align:top;font-size:13px;line-height:1.5">${value}</td>
        </tr>`;
  const rows = [
    project ? row("Project", esc(project)) : "",
    brand ? row("Brand", esc(brand)) : "",
    row("Date", esc(d.en)),
    row("Time", esc(timeStr)),
    ev.location ? row("Location", `${esc(ev.location)}<div style="margin-top:5px"><a href="${mapsUrl(ev.location)}" style="color:#1a73e8;text-decoration:none;font-size:12px">📍 Open in Google Maps →</a></div>`) : "",
  ].filter(Boolean).join("");
  const html = `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #e8eaed;border-radius:12px;overflow:hidden;color:#16181f">
      <div style="padding:18px 22px 14px;border-bottom:1px solid #eef0f3">
        <div style="font-size:11px;letter-spacing:1.5px;color:#8a93a0">SCHEDULE INVITE · 일정 수락 요청</div>
        ${ty ? `<div style="margin-top:8px"><span style="display:inline-block;background:${ty.color};color:#ffffff;font-size:11px;font-weight:700;padding:3px 11px;border-radius:20px">${ty.en}</span></div>` : ""}
        <div style="font-size:18px;font-weight:700;margin-top:8px">${esc(headline)}</div>
        ${agencyName ? `<div style="font-size:12px;color:#8a93a0;margin-top:2px">from ${esc(agencyName)}</div>` : ""}
      </div>
      <div style="padding:14px 22px">
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>
      <div style="padding:2px 22px 20px">
        <p style="font-size:13px;color:#16181f;margin:0 0 12px;line-height:1.7">${meta.forAgency
          ? `귀사 소속 모델 <b>${esc(modelName)}</b>님의 섭외 요청입니다. 위 일정을 확인하고 <b>수락</b> 또는 <b>거절</b>해 주세요.<br><span style="color:#8a93a0;font-size:12px">A booking request for your model. Please accept or decline.</span>`
          : `${modelName ? esc(modelName) + "님, " : ""}위 일정을 확인하고 <b>수락</b> 또는 <b>거절</b>해 주세요.<br><span style="color:#8a93a0;font-size:12px">Please review and accept or decline. Accepting adds it to the calendar.</span>`}</p>
        <table style="width:100%;border-collapse:separate;border-spacing:6px 0"><tr>
          <td style="width:60%"><a href="${acceptUrl}" style="display:block;text-align:center;background:#10b981;color:#fff;text-decoration:none;padding:13px;border-radius:8px;font-weight:800;font-size:15px">✓ 수락 / Accept</a></td>
          <td style="width:40%"><a href="${declineUrl}" style="display:block;text-align:center;background:#ffffff;color:#ef4444;text-decoration:none;padding:12px;border-radius:8px;font-weight:800;font-size:15px;border:1px solid #fecaca">✕ 거절</a></td>
        </tr></table>${subscribeUrl ? `
        <div style="margin-top:14px;padding:11px 13px;background:#f0f7ff;border:1px solid #d6e6ff;border-radius:8px">
          <div style="font-size:12px;font-weight:700;color:#1a73e8;margin-bottom:3px">📅 네이버 · 카카오 · 아웃룩 캘린더 사용자</div>
          <p style="font-size:12px;color:#5a6472;margin:0;line-height:1.65">구글 외 캘린더는 일정이 바뀌어도 자동으로 반영되지 않아요. 아래를 한 번 <b>구독</b>해 두면 이후 장소·시간 변경이 자동으로 따라옵니다.<br><a href="${esc(subscribeUrl)}" style="color:#1a73e8;font-weight:700;text-decoration:none">→ 내 캘린더에 구독하기 / Subscribe</a></p>
        </div>` : ""}
      </div>
    </div>`;
  const text = [
    `[일정 수락 요청 · Schedule Invite] ${headline}`,
    ty ? `Type: ${ty.en}` : "",
    project ? `Project: ${project}` : "",
    brand ? `Brand: ${brand}` : "",
    `Date: ${d.en}`,
    `Time: ${timeStr}`,
    ev.location ? `Location: ${ev.location}` : "",
    ``,
    `수락 / Accept: ${acceptUrl}`,
    `거절 / Decline: ${declineUrl}`,
    subscribeUrl ? `\n네이버·카카오 등 구글 외 캘린더는 아래를 한 번 구독하면 일정 변경이 자동 반영됩니다.\n구독 / Subscribe: ${subscribeUrl}` : "",
  ].filter(Boolean).join("\n");
  return sendEmail({
    to,
    subject: `${agencyName ? `[${agencyName}] ` : ""}일정 수락 요청 · Please confirm — ${headline}`,
    html,
    text,
    fromName: agencyName || undefined,
    replyTo: replyTo || undefined,
  });
};

// 취소 안내 메일 — 일정이 취소되었음을 모델에게 알림(.ics·캘린더 추가 버튼 없음).
// 확정 메일(sendCalEmail)과 같은 톤/항목 순서(프로젝트→브랜드→날짜→시간→장소)를 유지하되 CANCELLED 배지·취소 문구.
export const sendCancelEmail = (
  to: string, ev: CalEvent, modelName = "", agencyName = "", replyTo = "",
  meta: { project?: string; brand?: string; type?: string } = {},
) => {
  const project = (meta.project || "").trim();
  const brand = (meta.brand || "").trim();
  const ty = TYPE_BI[meta.type || "SHOOT"];
  const headline = project || brand || ev.title;
  const d = fmtDateBi(ev.date);
  const timeStr = fmtTimeBi(ev.start, ev.end);
  const RED = "#ef4444";
  const row = (label: string, value: string) => `
        <tr style="border-top:1px solid #f1f3f5">
          <td style="padding:9px 0;color:#8a93a0;width:110px;vertical-align:top;font-size:13px;line-height:1.5">${label}</td>
          <td style="padding:9px 0;color:#16181f;vertical-align:top;font-size:13px;line-height:1.5">${value}</td>
        </tr>`;
  const rows = [
    project ? row("Project", esc(project)) : "",
    brand ? row("Brand", esc(brand)) : "",
    row("Date", esc(d.en)),
    row("Time", esc(timeStr)),
    ev.location ? row("Location", esc(ev.location)) : "",
  ].filter(Boolean).join("");
  const html = `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #e8eaed;border-radius:12px;overflow:hidden;color:#16181f">
      <div style="padding:18px 22px 14px;border-bottom:1px solid #eef0f3">
        <div style="font-size:11px;letter-spacing:1.5px;color:${RED};font-weight:700">SCHEDULE CANCELLED · 일정 취소 안내</div>
        <div style="margin-top:8px">${ty ? `<span style="display:inline-block;background:${ty.color};color:#ffffff;font-size:11px;font-weight:700;padding:3px 11px;border-radius:20px;margin-right:4px">${ty.en}</span>` : ""}<span style="display:inline-block;background:${RED};color:#fff;font-size:11px;font-weight:700;padding:3px 11px;border-radius:20px">CANCELLED</span></div>
        <div style="font-size:18px;font-weight:700;margin-top:8px;text-decoration:line-through;text-decoration-color:#cfd4da">${esc(headline)}</div>
        ${agencyName ? `<div style="font-size:12px;color:#8a93a0;margin-top:2px">from ${esc(agencyName)}</div>` : ""}
      </div>
      <div style="padding:14px 22px">
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>
      <div style="padding:2px 22px 20px">
        <p style="font-size:13px;color:#16181f;margin:0;line-height:1.7">${modelName ? esc(modelName) + "님, " : ""}위 일정이 <b style="color:${RED}">취소</b>되었습니다.<br><span style="color:#8a93a0;font-size:12px">The schedule above has been <b>cancelled</b>. Please disregard the previous notice.</span></p>
      </div>
    </div>`;
  const text = [
    `[SCHEDULE CANCELLED · 일정 취소 안내] ${headline}`,
    ty ? `Type: ${ty.en}` : "",
    project ? `Project: ${project}` : "",
    brand ? `Brand: ${brand}` : "",
    `Date: ${d.en}`,
    `Time: ${timeStr}`,
    ev.location ? `Location: ${ev.location}` : "",
    ``,
    `${modelName ? modelName + "님, " : ""}위 일정이 취소되었습니다. / The schedule above has been cancelled.`,
  ].filter(Boolean).join("\n");
  return sendEmail({
    to,
    subject: `${agencyName ? `[${agencyName}] ` : ""}일정 취소 안내 · Cancelled — ${headline}`,
    html,
    text,
    fromName: agencyName || undefined,
    replyTo: replyTo || undefined,
  });
};

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
