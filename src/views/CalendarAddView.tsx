// ════════════════════════════════════════════════════════════════
// 공개 캘린더 추가 페이지 — 모델이 ?cal=링크로 열어 자기 캘린더에 추가
//  · 로그인 불필요. 이벤트 데이터는 URL에 담겨 옴(DB 조회 없음).
// ════════════════════════════════════════════════════════════════
import { decodeCalEvent, googleCalUrl, downloadIcs } from "../lib/calendar";

export default function CalendarAddView({ data }: { data: string }) {
  const ev = decodeCalEvent(data);
  const wrap: React.CSSProperties = {
    minHeight: "100vh", background: "#eceff3", color: "#1a1d27",
    fontFamily: "'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px",
  };
  if (!ev) return <div style={{ ...wrap, color: "#6b7280" }}>일정 정보를 불러올 수 없습니다. 링크를 다시 확인해주세요.</div>;

  const when = ev.start ? `${ev.date.replace(/-/g, ".")}  ${ev.start}${ev.end ? `~${ev.end}` : ""}` : `${ev.date.replace(/-/g, ".")} (종일)`;
  const btn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", textDecoration: "none", boxSizing: "border-box" };

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,.1)" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9aa2af", letterSpacing: "1px" }}>일정 추가</p>
        <h1 style={{ margin: "6px 0 16px", fontSize: 20, fontWeight: 900, lineHeight: 1.35 }}>{ev.title}</h1>
        <div style={{ background: "#f4f6f9", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 14, lineHeight: 1.9 }}>
          <div><strong style={{ color: "#5a6270" }}>일시</strong>  {when}</div>
          {ev.location && <div><strong style={{ color: "#5a6270" }}>장소</strong>  {ev.location}</div>}
        </div>
        <a href={googleCalUrl(ev)} target="_blank" rel="noreferrer" style={{ ...btn, background: "#1a73e8", color: "#fff", marginBottom: 10 }}>
          구글 캘린더에 추가
        </a>
        <button onClick={() => downloadIcs(ev, `${ev.title}.ics`)} style={{ ...btn, background: "#1a1d27", color: "#fff" }}>
          애플·기타 캘린더 (.ics 다운로드)
        </button>
        <p style={{ margin: "16px 0 0", fontSize: 12, color: "#9aa2af", textAlign: "center", lineHeight: 1.6 }}>
          아이폰·네이버·아웃룩은 ".ics 다운로드"를 누른 뒤 열기로 추가하세요.
        </p>
      </div>
    </div>
  );
}
