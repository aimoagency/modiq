import { C } from "../theme";
import { BOOKING_TYPES } from "../constants";
import { fmtDate, fmtTime, bookingTotal } from "../lib/utils";
import Badge from "./Badge";
import TypeIcon from "./TypeIcon";
import { Calendar, MapPin, User, Folder } from "./icons";

// 섭외 리스트(엑셀형) 공용 렌더러 — 섭외 화면·대시보드(진행중 섭외/신규문의)에서 동일하게 재사용.
// 헤더·데이터 행이 같은 GRID를 공유하므로 구분 제목이 각 셀과 항상 세로 정렬된다.
// onSelect(b): 행 클릭 핸들러. showHeader: 상단 구분 제목 행 노출 여부.
export default function BookingsList({ bookings, models, customers, isMobile = false, onSelect, showHeader = true, emptyText = "결과 없음" }: {
  bookings: any[]; models: any[]; customers: any[];
  isMobile?: boolean; onSelect: (b: any) => void; showHeader?: boolean; emptyText?: string;
}) {
  if (!bookings || bookings.length === 0) return <p style={{ color: C.muted, fontSize: 13 }}>{emptyText}</p>;

  const order: { type: string; pid?: string; b?: any }[] = []; const groups: Record<string, any[]> = {};
  bookings.forEach(b => {
    if (b.project_id) { if (!groups[b.project_id]) { groups[b.project_id] = []; order.push({ type: "group", pid: b.project_id }); } groups[b.project_id].push(b); }
    else order.push({ type: "single", b });
  });
  // 모델 아바타(공통)
  const avatar = (m: any, size: number) => m?.thumb_url
    ? <img src={m.thumb_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#c9a96e,#8b6a3e)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: size * 0.42, fontWeight: 800, flexShrink: 0 }}>{(m?.name || "?")[0]}</span>;
  // 엑셀형 균일 컬럼: 헤더·데이터 행이 공유하는 단일 그리드 정의
  const GRID = "56px 32px minmax(0,2fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.1fr) max-content";
  const Row = (b: any, bt: string, inGroup = false) => {
    const m = models.find((mm: any) => mm.id === b.model_id);
    const cli = customers.find((c: any) => c.id === b.customer_id)?.name || "?";
    const bk = BOOKING_TYPES[b.booking_type || "SHOOT"] || BOOKING_TYPES.SHOOT;
    const amt = bookingTotal(b);
    const accent = inGroup ? { boxShadow: `inset 3px 0 0 ${C.blue}55` } : {};
    const typeBadge = <span style={{ background: bk.color + "22", color: bk.color, border: `1px solid ${bk.color}44`, borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3, justifySelf: "start" }}><TypeIcon type={b.booking_type} size={11} /> {bk.label}</span>;
    if (isMobile) return (
      <div key={b.id} onClick={() => onSelect(b)} style={{ padding: "10px 14px", borderTop: bt, cursor: "pointer", ...accent }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{ color: bk.color, display: "inline-flex", flexShrink: 0 }}><TypeIcon type={b.booking_type} size={13} /></span>
          {avatar(m, 24)}
          <strong style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m?.name || "?"} → {cli}</strong>
          <Badge code={b.status} type={b.booking_type} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.textSub }}>
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Calendar size={11} style={{ verticalAlign: -2, flexShrink: 0 }} /> {fmtDate(b.shoot_date)} {fmtTime(b.start_time, b.end_time)}</span>
          {amt > 0 ? <span style={{ marginLeft: "auto", color: C.yellow, fontWeight: 700, flexShrink: 0 }}>{amt.toLocaleString()}원</span> : null}
        </div>
      </div>
    );
    return (
      <div key={b.id} onClick={() => onSelect(b)}
        onMouseEnter={e => (e.currentTarget.style.background = C.card2)}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 14, padding: "11px 16px", borderTop: bt, cursor: "pointer", transition: "background 0.12s", ...accent }}>
        <span style={{ display: "inline-flex" }}>{typeBadge}</span>
        {/* 아바타 (자체 컬럼 — 세로 일렬) */}
        <span style={{ display: "inline-flex" }}>{avatar(m, 24)}</span>
        {/* 모델→고객사 */}
        <span style={{ display: "flex", alignItems: "center", minWidth: 0 }}><strong style={{ fontSize: 13.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m?.name || "?"} → {cli}</strong></span>
        {/* 프로젝트 (빈칸 유지) */}
        <span style={{ fontSize: 12.5, color: C.blue, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{b.project_name ? <><Folder size={11} style={{ verticalAlign: -2, flexShrink: 0 }} /> {b.project_name}</> : ""}</span>
        {/* 날짜 */}
        <span style={{ fontSize: 12.5, color: C.textSub, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}><Calendar size={11} style={{ verticalAlign: -2, flexShrink: 0 }} /> {fmtDate(b.shoot_date)} {fmtTime(b.start_time, b.end_time)}</span>
        {/* 장소 (빈칸 그대로 유지) */}
        <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{b.location ? <><MapPin size={11} style={{ verticalAlign: -2, flexShrink: 0 }} /> {b.location}</> : ""}</span>
        {/* 담당자 (빈칸 그대로 유지) */}
        <span style={{ fontSize: 12.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{b.manager ? <><User size={11} style={{ verticalAlign: -2, flexShrink: 0 }} /> {b.manager}</> : ""}</span>
        {/* 금액 (우측 정렬·무잘림) */}
        <span style={{ textAlign: "right", color: C.yellow, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>{amt > 0 ? amt.toLocaleString() + "원" : ""}</span>
        {/* 상태 (오른쪽 끝) */}
        <span style={{ display: "flex", justifyContent: "flex-end" }}><Badge code={b.status} type={b.booking_type} /></span>
      </div>
    );
  };
  const GroupHeader = (bs: any[], oi: number, bt: string) => {
    const total = bs.reduce((s, b) => s + bookingTotal(b), 0);
    const ms = bs.map(b => models.find((m: any) => m.id === b.model_id)).filter(Boolean);
    const avs = <div style={{ display: "flex", flexShrink: 0 }}>{ms.slice(0, 3).map((m: any, i: number) => (
      <span key={i} style={{ marginLeft: i ? -7 : 0, border: `2px solid ${C.card}`, borderRadius: "50%", display: "inline-flex" }}>{avatar(m, 20)}</span>
    ))}</div>;
    return (
      <div key={"g" + oi} style={{ display: "flex", alignItems: "center", gap: 8, padding: isMobile ? "9px 12px" : "9px 16px", borderTop: bt, background: C.blue + "10", flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <Folder size={13} color={C.blue} style={{ flexShrink: 0 }} />
        <span style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 700, color: C.text }}>{bs[0].project_name || "프로젝트"} <span style={{ color: C.muted, fontWeight: 400 }}>· {customers.find((c: any) => c.id === bs[0].customer_id)?.name || "?"}</span></span>
        {avs}
        <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>모델 {bs.length}명 · {fmtDate(bs[0].shoot_date)}</span>
        {total > 0 && <span style={{ marginLeft: "auto", fontSize: 13.5, color: C.yellow, fontWeight: 800, whiteSpace: "nowrap" }}>{total.toLocaleString()}원</span>}
      </div>
    );
  };
  return (
    <div style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.card }}>
      {showHeader && !isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 14, padding: "9px 16px", background: C.card2, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>
          {["유형", "", "모델 → 고객사", "프로젝트", "날짜", "장소", "담당자", "금액", "상태"].map((t, i) => (
            <span key={i} style={{ textAlign: i === 7 ? "right" : undefined, display: i === 8 ? "flex" : undefined, justifyContent: i === 8 ? "flex-end" : undefined }}>{t}</span>
          ))}
        </div>
      )}
      {(() => {
        const out: any[] = []; let first = true;
        const top = () => { const t = first ? "none" : `1px solid ${C.border}`; first = false; return t; };
        order.forEach((item, oi) => {
          if (item.type === "single") out.push(Row(item.b, top()));
          else { const bs = groups[item.pid!]; out.push(GroupHeader(bs, oi, top())); bs.forEach((b: any) => out.push(Row(b, top(), true))); }
        });
        return out;
      })()}
    </div>
  );
}
