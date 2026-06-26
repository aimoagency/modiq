import type { CSSProperties } from "react";

// ── Material 3 (Material You) 토큰 ──────────────────────────────
// 표면/중립색은 CSS 변수(라이트·다크, App.tsx 정의), 강조는 M3 색 역할.
// ⚠️ design/material3 브랜치 전용 디자인. 키 이름은 유지(기존 인라인 호출 호환).
export const C = {
  sidebar:"var(--c-sidebar)", sideHover:"var(--c-side-hover)", sideActive:"var(--c-primary)",
  bg:"var(--c-bg)", card:"var(--c-card)", card2:"var(--c-card2)", border:"var(--c-border)",
  text:"var(--c-text)", textSub:"var(--c-text-sub)", muted:"var(--c-muted)",
  blue:"var(--c-primary)",            // M3 primary (키명 'blue' 유지 — 호환)
  purple:"#8b5cf6", green:"#10b981",  // 시맨틱 강조(상태색) — 유지
  red:"#ef4444", yellow:"#f59e0b", orange:"#f97316",
};

// M3 shape(모서리) · elevation(그림자) 토큰
export const shape = { xs:4, sm:8, md:12, lg:16, xl:28, full:9999 };
export const elev = {
  1:"0 1px 2px rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15)",
  2:"0 1px 2px rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15)",
  3:"0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.30)",
};

// M3 text field 느낌(둥근 모서리·여유 패딩)
export const inp: CSSProperties = {
  width:"100%", minWidth:0, padding:"12px 14px", background:"var(--c-card2)",
  border:`1px solid ${C.border}`, borderRadius:shape.sm, color:C.text,
  fontSize:14, boxSizing:"border-box" as const, marginBottom:12,
};

// M3 button — pill(stadium) 형태. primary(C.blue) 버튼은 on-primary 글자, 그 외 white.
export const btnS = (bg: string, disabled=false): CSSProperties => ({
  padding:"10px 22px", background:disabled?"var(--c-card2)":bg,
  color:disabled?C.muted:(bg===C.blue?"var(--c-on-primary)":"white"),
  border:"none", borderRadius:shape.full,
  cursor:disabled?"not-allowed":"pointer", fontWeight:600, fontSize:14, opacity:disabled?0.6:1,
  whiteSpace:"nowrap",
});
