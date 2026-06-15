// ── 이메일 발송 (Resend, Edge Function 경유) ─────────────────────
// 발송 경로: 프론트 → Supabase Edge Function(email-send) → Resend. 프론트에 API 키 없음.
// VITE_EMAIL_FN_URL 미설정 시 콘솔 로그만 남기고 no-op (절대 throw 안 함).
import { type CalEvent, icsText, googleCalUrl } from "./calendar";

// 기본값은 코드에 내장(supabase.ts와 동일 방식). 필요 시 .env로 덮어쓰기 가능.
const FN_URL: string = (import.meta as any).env?.VITE_EMAIL_FN_URL || "https://fijtpyrmqzjefucsqfos.supabase.co/functions/v1/email-send";
const FN_SECRET: string = (import.meta as any).env?.VITE_EMAIL_FN_SECRET || "modiq-mail-2026-x9k2";

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
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};

// utf-8 문자열 → base64 (한글 안전)
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

// 캘린더 일정을 모델에게 메일로 (구글 추가 링크 + .ics 첨부)
export const sendCalEmail = (to: string, ev: CalEvent, modelName = "", subscribeUrl = "", agencyName = "", replyTo = "") => {
  const when = ev.start ? `${ev.date.replace(/-/g, ".")} ${ev.start}${ev.end ? `~${ev.end}` : ""}` : `${ev.date.replace(/-/g, ".")} (종일)`;
  const html = `
    <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;color:#1a1d27">
      <p style="font-size:12px;color:#9aa2af;letter-spacing:1px;margin:0">일정 안내</p>
      <h2 style="margin:6px 0 14px;font-size:19px">${esc(ev.title)}</h2>
      <div style="background:#f4f6f9;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.9">
        <div><b>일시</b>  ${esc(when)}</div>
        ${ev.location ? `<div><b>장소</b>  ${esc(ev.location)}</div>` : ""}
      </div>
      <p style="margin:18px 0 8px;font-size:14px">${modelName ? esc(modelName) + "님, " : ""}아래에서 캘린더에 추가하세요.</p>
      <a href="${googleCalUrl(ev)}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:700;font-size:14px">구글 캘린더에 추가</a>
      <p style="margin:14px 0 0;font-size:13px;color:#6b7280">애플·네이버·아웃룩 캘린더는 첨부된 .ics 파일을 열어 추가하세요.</p>
      ${subscribeUrl ? `<p style="margin:16px 0 0;font-size:13px">앞으로의 모든 일정을 자동으로 받으려면 <a href="${esc(subscribeUrl)}">여기서 구독</a>하세요.</p>` : ""}
    </div>`;
  return sendEmail({
    to,
    subject: `${agencyName ? `[${agencyName}] ` : ""}일정 안내 · ${ev.title}`,
    html,
    text: `${ev.title}\n일시: ${when}${ev.location ? `\n장소: ${ev.location}` : ""}\n\n구글 캘린더에 추가: ${googleCalUrl(ev)}`,
    icsBase64: b64(icsText(ev)),
    icsFilename: `${ev.title}.ics`,
    fromName: agencyName || undefined,
    replyTo: replyTo || undefined,
  });
};

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
