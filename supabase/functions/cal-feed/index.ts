// Supabase Edge Function: cal-feed
// 모델별 구독형 캘린더 피드(.ics). 모델이 webcal 링크로 한 번 구독하면 자동 동기화.
// 공개 접근(캘린더 앱이 헤더 못 보냄) → URL의 token이 인증. 서비스롤로 RLS 우회하되 token→모델로만 제한.
//
// 배포: Via Editor 로 함수명 cal-feed 생성 후 이 코드 붙여넣기 → Deploy
//   ※ 함수 설정에서 "Verify JWT" OFF (공개 구독이라 토큰 필요 없음)
//   ※ FN_SHARED_SECRET 불필요 (캘린더 앱이 헤더 못 보냄)
// 구독 URL: webcal://<project>.supabase.co/functions/v1/cal-feed?token=<모델 cal_token>

const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";
const TYPE_LABEL: Record<string, string> = { SHOOT: "촬영", MEETING: "실물미팅", FITTING: "피팅", AUDITION: "오디션" };
const esc = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (d: string) => (d || "").replace(/-/g, "");
const hm = (t?: string) => (t || "").replace(":", "") + "00";
const nextDay = (d: string) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + 1); const p = (n: number) => String(n).padStart(2, "0"); return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}`; };

const icsResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "max-age=3600", "Access-Control-Allow-Origin": "*" } });

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") || "";
  const head = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//modiq//feed//KO", "CALSCALE:GREGORIAN", "X-WR-CALNAME:modiq 일정"];
  if (!token) return icsResponse([...head, "END:VCALENDAR"].join("\r\n"));

  const SB = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const get = (path: string) => fetch(`${SB}/rest/v1/${path}`, { headers: h }).then(r => r.json()).catch(() => []);

  const models = await get(`models?cal_token=eq.${encodeURIComponent(token)}&select=id,name,agency_id`);
  if (!Array.isArray(models) || !models.length) return icsResponse([...head, "END:VCALENDAR"].join("\r\n"));
  const m = models[0];

  const bks = await get(`bookings?model_id=eq.${m.id}&status=in.(CONFIRMED,COMPLETED,SETTLED)&booking_type=in.(SHOOT,MEETING)&select=id,shoot_date,start_time,end_time,location,booking_type,project_name,memo,customer_id,manager,status&order=shoot_date.asc`);
  const custs = await get(`customers?agency_id=eq.${m.agency_id}&select=id,name`);
  const cmap: Record<string, string> = {};
  (Array.isArray(custs) ? custs : []).forEach((c: any) => { cmap[c.id] = c.name; });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const events: string[] = [];
  (Array.isArray(bks) ? bks : []).forEach((b: any) => {
    if (!b.shoot_date) return;
    const ty = TYPE_LABEL[b.booking_type || "SHOOT"] || "일정";
    const client = cmap[b.customer_id] || "고객사";
    const timed = !!b.start_time;
    const dtStart = timed ? `DTSTART:${compact(b.shoot_date)}T${hm(b.start_time)}` : `DTSTART;VALUE=DATE:${compact(b.shoot_date)}`;
    const dtEnd = timed ? `DTEND:${compact(b.shoot_date)}T${hm(b.end_time || b.start_time)}` : `DTEND;VALUE=DATE:${nextDay(b.shoot_date)}`;
    const desc = [`유형: ${ty}`, `고객사: ${client}`, b.manager ? `담당: ${b.manager}` : "", b.project_name ? `프로젝트: ${b.project_name}` : "", b.memo ? `메모: ${b.memo}` : ""].filter(Boolean).join("\\n");
    events.push(
      "BEGIN:VEVENT", `UID:${b.id}@modiq`, `DTSTAMP:${stamp}`, dtStart, dtEnd,
      `SUMMARY:${esc(`[${ty}] ${client} · ${m.name}`)}`,
      ...(b.location ? [`LOCATION:${esc(b.location)}`] : []),
      `DESCRIPTION:${desc}`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:일정 알림", "END:VALARM",
      "END:VEVENT",
    );
  });
  return icsResponse([...head, ...events, "END:VCALENDAR"].join("\r\n"));
});
