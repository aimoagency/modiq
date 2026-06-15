// ════════════════════════════════════════════════════════════════
// 공개 캘린더 구독 안내 페이지 — 모델이 ?sub=토큰 링크로 열어 한 번 구독
//  · 플랫폼(아이폰/안드/PC) 자동 감지 → 맞춤 안내 + 버튼
//  · 한 번 구독하면 이후 모든 확정 일정이 자동 동기화
// ════════════════════════════════════════════════════════════════
import { calFeedUrl, calSubscribeUrl } from "../lib/calendar";

const ICSX5_PLAY = "https://play.google.com/store/apps/details?id=at.bitfire.icsdroid";

export default function CalSubscribeView({ token }: { token: string }) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const webcal = calSubscribeUrl(token);   // webcal://...
  const https = calFeedUrl(token);         // https://...

  const wrap: React.CSSProperties = {
    minHeight: "100vh", background: "#eceff3", color: "#1a1d27",
    fontFamily: "'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px",
  };
  const btn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", textDecoration: "none", boxSizing: "border-box" };
  const step: React.CSSProperties = { fontSize: 14, lineHeight: 1.7, margin: "0 0 10px" };

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,.1)" }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#9aa2af", letterSpacing: "1px" }}>일정 자동 동기화</p>
        <h1 style={{ margin: "6px 0 6px", fontSize: 20, fontWeight: 900 }}>내 캘린더에 일정 구독</h1>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "#6b7280", lineHeight: 1.6 }}>
          아래에서 한 번만 구독하면, 앞으로의 모든 촬영·미팅 일정이 자동으로 내 캘린더에 들어오고 변경·취소도 자동 반영됩니다.
        </p>

        {isIOS && (
          <>
            <a href={webcal} style={{ ...btn, background: "#1a1d27", color: "#fff" }}>아이폰 캘린더에 구독 추가</a>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              버튼을 누르면 "캘린더 구독" 창이 떠요 → <b>구독 → 추가</b>. 끝입니다.
            </p>
          </>
        )}

        {isAndroid && (
          <>
            <div style={{ background: "#f4f6f9", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
              <p style={step}><b>1단계</b> — 무료 앱 <b>ICSx⁵</b> 설치 (구독을 받아주는 앱)</p>
              <a href={ICSX5_PLAY} target="_blank" rel="noreferrer" style={{ ...btn, background: "#34A853", color: "#fff", padding: "12px 0", fontSize: 14 }}>Play 스토어에서 ICSx⁵ 설치</a>
            </div>
            <p style={step}><b>2단계</b> — 설치 후 아래 버튼</p>
            <a href={webcal} style={{ ...btn, background: "#1a1d27", color: "#fff" }}>ICSx⁵로 구독 추가</a>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              ICSx⁵가 열리면 <b>구독(Subscribe)</b> → 새로고침 주기를 짧게(예: 1시간)로 설정하세요.
            </p>
          </>
        )}

        {!isIOS && !isAndroid && (
          <>
            <p style={step}>구글 캘린더에 추가 (PC):</p>
            <ol style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13.5, color: "#3f4754", lineHeight: 1.8 }}>
              <li>PC에서 calendar.google.com 접속</li>
              <li>왼쪽 "다른 캘린더" 옆 <b>＋ → URL로 추가</b></li>
              <li>아래 주소를 붙여넣고 추가</li>
            </ol>
            <div style={{ background: "#f4f6f9", borderRadius: 10, padding: "10px 12px", fontSize: 12, wordBreak: "break-all", color: "#1a1d27" }}>{https}</div>
          </>
        )}

        <p style={{ margin: "18px 0 0", fontSize: 12, color: "#9aa2af", textAlign: "center", lineHeight: 1.6 }}>
          구독은 한 번만 하면 됩니다. 일정이 바뀌면 캘린더가 주기적으로 자동 갱신돼요.
        </p>
      </div>
    </div>
  );
}
