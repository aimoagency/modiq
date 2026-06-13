// ════════════════════════════════════════════════════════════════
// 캘린더 공유 — 섭외 일정을 모델 캘린더에 추가
//  · 구글 캘린더 추가 URL (OAuth 불필요, 미리채운 링크)
//  · .ics (iCalendar) 표준 — 애플/구글/네이버/아웃룩 모두 호환
//  · ?cal= 공개 링크로 인코딩 (DB 조회 불필요, 이벤트 데이터를 URL에 담음)
//  시간대: 한국(KST) 기준 floating local time 사용
// ════════════════════════════════════════════════════════════════

export type CalEvent = {
  title: string;
  date: string;            // YYYY-MM-DD
  start?: string;          // HH:MM (없으면 종일)
  end?: string;            // HH:MM
  location?: string;
  description?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const compact = (d: string) => d.replace(/-/g, "");           // 2026-07-01 → 20260701
const hm = (t?: string) => (t || "").replace(":", "") + "00"; // 09:30 → 093000
const nextDay = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`;
};
// 종료 없으면 시작 +2시간
const defaultEnd = (start: string) => {
  const [h, m] = start.split(":").map(Number);
  return `${pad((h + 2) % 24)}:${pad(m || 0)}`;
};

// ── 구글 캘린더 추가 URL ──
export const googleCalUrl = (ev: CalEvent): string => {
  const timed = !!ev.start;
  let dates: string;
  if (timed) {
    const end = ev.end || defaultEnd(ev.start!);
    dates = `${compact(ev.date)}T${hm(ev.start)}/${compact(ev.date)}T${hm(end)}`;
  } else {
    dates = `${compact(ev.date)}/${nextDay(ev.date)}`;
  }
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates,
    ctz: "Asia/Seoul",
    ...(ev.location ? { location: ev.location } : {}),
    ...(ev.description ? { details: ev.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
};

// ── .ics 본문 ──
const icsEscape = (s: string) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
export const icsText = (ev: CalEvent, uid = `${Date.now()}@modiq`): string => {
  const timed = !!ev.start;
  const dtStart = timed ? `DTSTART:${compact(ev.date)}T${hm(ev.start)}` : `DTSTART;VALUE=DATE:${compact(ev.date)}`;
  const dtEnd = timed
    ? `DTEND:${compact(ev.date)}T${hm(ev.end || defaultEnd(ev.start!))}`
    : `DTEND;VALUE=DATE:${nextDay(ev.date)}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//modiq//talent//KO", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`, dtStart, dtEnd,
    `SUMMARY:${icsEscape(ev.title)}`,
    ...(ev.location ? [`LOCATION:${icsEscape(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${icsEscape(ev.description)}`] : []),
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:일정 알림", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
};

// ── ?cal= 공유 링크 인코딩/디코딩 (URL-safe base64, 한글 안전) ──
export const encodeCalEvent = (ev: CalEvent): string =>
  btoa(unescape(encodeURIComponent(JSON.stringify(ev)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const decodeCalEvent = (s: string): CalEvent | null => {
  try {
    const b = s.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch { return null; }
};
export const calShareUrl = (ev: CalEvent): string =>
  `${location.origin}${location.pathname}?cal=${encodeCalEvent(ev)}`;

// ── 섭외 → 캘린더 이벤트 ──
const TYPE_LABEL: Record<string, string> = { SHOOT: "촬영", MEETING: "실물미팅", FITTING: "피팅", AUDITION: "오디션" };
export const bookingToCalEvent = (b: any, modelName: string, clientName: string): CalEvent => {
  const ty = TYPE_LABEL[b.booking_type || "SHOOT"] || "일정";
  const desc = [
    `유형: ${ty}`, `모델: ${modelName}`, `고객사: ${clientName}`,
    b.manager ? `담당: ${b.manager}` : "",
    b.project_name ? `프로젝트: ${b.project_name}` : "",
    b.memo ? `메모: ${b.memo}` : "",
  ].filter(Boolean).join("\n");
  return {
    title: `[${ty}] ${clientName} · ${modelName}`,
    date: b.shoot_date,
    start: b.start_time || undefined,
    end: b.end_time || undefined,
    location: b.location || undefined,
    description: desc,
  };
};

// ── .ics 다운로드 트리거 ──
export const downloadIcs = (ev: CalEvent, filename = "schedule.ics") => {
  const blob = new Blob([icsText(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.replace(/[\\/:*?"<>|]/g, "_"); a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
