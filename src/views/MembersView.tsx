import { useState } from "react";
import { C, btnS, inp } from "../theme";
import { Users, Crown, Pencil, Save } from "../components/icons";

// 담당자 행 — Vercel식 정렬 컬럼 리스트(보기) → 수정(연필) 시 폼으로 펼침
function MemberRow({ m, isOwner, bt, onUpdate, onDelete, isMobile = false }: {
  m: any; isOwner: boolean; bt: string;
  onUpdate: (id: string, updates: any) => void;
  onDelete?: (id: string) => void;
  isMobile?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(m.name || "");
  const [phone, setPhone] = useState(m.phone || "");
  const [position, setPosition] = useState(m.position || "");

  const cancel = () => { setName(m.name || ""); setPhone(m.phone || ""); setPosition(m.position || ""); setEdit(false); };
  const save = () => {
    if (!name.trim()) return alert("이름을 입력하세요");
    onUpdate(m.id, { name: name.trim(), phone: phone.trim(), position: position.trim() });
    setEdit(false);
  };

  const lbl = (t: string) => <p style={{ margin: 0, fontSize: 11, color: C.muted }}>{t}</p>;
  const cell = (color: string, weight = 400): React.CSSProperties => ({ fontSize: 12.5, color, fontWeight: weight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

  // 수정 모드: 기존 폼을 그대로 펼침
  if (edit) {
    return (
      <div style={{ padding: "14px 16px", borderTop: bt }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
          <div>{lbl("이름")}<input style={{ ...inp, marginTop: 5 }} value={name} onChange={e => setName(e.target.value)} placeholder="이름" /></div>
          <div>{lbl("직위")}<input style={{ ...inp, marginTop: 5 }} value={position} onChange={e => setPosition(e.target.value)} placeholder="예: 매니저" /></div>
          <div>{lbl("전화번호 (알림톡 발송에 사용)")}<input style={{ ...inp, marginTop: 5 }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" /></div>
          <div>{lbl("이메일 (로그인 계정 · 변경 불가)")}<p style={{ margin: "8px 0 0", fontSize: 13, color: C.muted }}>{m.email}</p></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button onClick={save} style={{ ...btnS(C.green), flex: 1 }}><Save size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 저장</button>
          <button onClick={cancel} style={{ ...btnS("#555"), flex: 1 }}>취소</button>
        </div>
      </div>
    );
  }

  const actions = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap", whiteSpace: "nowrap" }}>
      {!isOwner && (
        <button onClick={() => onUpdate(m.id, { can_view_finance: !m.can_view_finance })}
          aria-label="매출·정산 열람 권한 토글"
          title={m.can_view_finance ? "이 담당자는 매출·미수금·정산을 볼 수 있어요" : "기본: 매출·미수금·정산 메뉴 숨김"}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 11, color: m.can_view_finance ? C.green : C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>매출·정산</span>
          <span style={{ width: 38, height: 22, borderRadius: 11, background: m.can_view_finance ? C.green : C.border, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 3, left: m.can_view_finance ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </span>
        </button>
      )}
      <button onClick={() => setEdit(true)} style={{ ...btnS(C.purple), padding: "5px 10px", fontSize: 12 }}>
        <Pencil size={12} style={{ verticalAlign: -2, flexShrink: 0 }} /> 수정
      </button>
      {!isOwner && onDelete && (
        <button onClick={() => onDelete(m.id)} style={{ ...btnS(C.red), padding: "5px 10px", fontSize: 12 }}>삭제</button>
      )}
    </div>
  );

  // 이름 셀: 대표는 왕관 배지 노출 · 직위(role) 배지 동반
  const nameCell = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {isOwner && <Crown size={12} color={C.green} style={{ flexShrink: 0 }} />}
      <span style={{ ...cell(C.text, 700), maxWidth: "100%" }}>{m.name}{isOwner ? " (대표)" : ""}</span>
      {m.position && <span style={{ fontSize: 11, color: C.textSub, fontWeight: 600, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap", flexShrink: 0 }}>{m.position}</span>}
    </span>
  );

  // 모바일: 그리드 없이 세로 스택 · 액션은 필요 시 아래로 줄바꿈
  if (isMobile) {
    return (
      <div style={{ padding: "11px 14px", borderTop: bt }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {nameCell}
        </div>
        <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={cell(C.muted)}>{m.phone || "—"}</span>
          <span style={cell(C.muted)}>{m.email}</span>
        </div>
        <div style={{ marginTop: 8 }}>{actions}</div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={e => (e.currentTarget.style.background = C.card2)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      style={{ display: "grid", gridTemplateColumns: "minmax(0,220px) auto minmax(0,240px) 1fr max-content", alignItems: "center", gap: 14, padding: "11px 16px", borderTop: bt, transition: "background 0.12s" }}>
      {nameCell}
      <span style={cell(C.muted)}>{m.phone || "—"}</span>
      <span style={cell(C.muted)}>{m.email}</span>
      <span aria-hidden style={{ minWidth: 0 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", paddingRight: 0, whiteSpace: "nowrap" }}>{actions}</div>
    </div>
  );
}

export default function MembersView({ members, maxMembers, memberPct, setShowMemberForm, handleDeleteMember, handleUpdateMember, isMobile = false }: {
  members: any[]; maxMembers: number; memberPct: number;
  setShowMemberForm: (v: boolean) => void;
  handleDeleteMember: (id: string) => void;
  handleUpdateMember: (id: string, updates: any) => void;
  isMobile?: boolean;
}) {
  const owners = members.filter(m => m.role === "owner");
  const staff = members.filter(m => m.role !== "owner");

  const listContainer = (rows: any[], render: (m: any, bt: string) => React.ReactNode) => {
    let first = true;
    const top = () => { const t = first ? "none" : `1px solid ${C.border}`; first = false; return t; };
    return (
      <div style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.card }}>
        {rows.map(m => render(m, top()))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}><Users size={20} style={{ verticalAlign: -2, flexShrink: 0 }} /> 담당자 관리</h1>
        <button onClick={() => setShowMemberForm(true)} style={btnS(C.purple)}>+ 담당자 추가</button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: C.text }}>담당자 한도</span>
          <span style={{ fontWeight: 700, color: memberPct >= 100 ? C.red : C.green }}>{members.length}/{maxMembers}명</span>
        </div>
        <div style={{ background: C.border, borderRadius: 4, height: 6 }}>
          <div style={{ width: `${Math.min(memberPct, 100)}%`, height: "100%", background: memberPct >= 100 ? C.red : C.green, borderRadius: 4 }} />
        </div>
      </div>

      {owners.length > 0 && listContainer(owners, (m, bt) => (
        <MemberRow key={m.id} m={m} isOwner bt={bt} onUpdate={handleUpdateMember} isMobile={isMobile} />
      ))}

      <p style={{ fontWeight: 700, color: C.text, margin: "16px 0 10px" }}>추가 담당자 ({staff.length}명)</p>
      {staff.length === 0
        ? <p style={{ color: C.muted, fontSize: 13 }}>추가된 담당자가 없습니다.</p>
        : listContainer(staff, (m, bt) => (
          <MemberRow key={m.id} m={m} isOwner={false} bt={bt} onUpdate={handleUpdateMember} onDelete={handleDeleteMember} isMobile={isMobile} />
        ))}
    </div>
  );
}
