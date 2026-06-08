import type { CSSProperties } from "react";

// ── 색상 팔레트 ────────────────────────────────────────────────
// 중립색은 CSS 변수(라이트/다크 전환), 강조색은 고정
export const C = {
  sidebar:"var(--c-sidebar)", sideHover:"var(--c-side-hover)", sideActive:"#1d4ed8",
  bg:"var(--c-bg)", card:"var(--c-card)", card2:"var(--c-card2)", border:"var(--c-border)",
  text:"var(--c-text)", textSub:"var(--c-text-sub)", muted:"var(--c-muted)",
  blue:"#3b82f6", purple:"#8b5cf6", green:"#10b981",
  red:"#ef4444", yellow:"#f59e0b", orange:"#f97316",
};

export const inp: CSSProperties = {
  width:"100%", padding:"9px 12px", background:"var(--c-card2)",
  border:`1px solid ${C.border}`, borderRadius:6, color:C.text,
  fontSize:13, boxSizing:"border-box" as const, marginBottom:10,
};

export const btnS = (bg: string, disabled=false): CSSProperties => ({
  padding:"6px 12px", background:disabled?"#333":bg,
  color:disabled?C.muted:"white", border:"none", borderRadius:6,
  cursor:disabled?"not-allowed":"pointer", fontWeight:600, fontSize:12, opacity:disabled?0.7:1,
});
