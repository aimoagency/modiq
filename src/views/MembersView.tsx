import { useState } from "react";
import { C, btnS, inp } from "../theme";
import { Users, Crown, Pencil, Save } from "../components/icons";

// 담당자 카드 — 보기 → 수정(연필) → 저장/취소 (앱 공통 패턴)
function MemberCard({ m, isOwner, onUpdate, onDelete }: {
  m: any; isOwner: boolean;
  onUpdate: (id: string, updates: any) => void;
  onDelete?: (id: string) => void;
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

  const lbl = (t: string) => <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{t}</p>;
  const cardStyle = isOwner
    ? { background: "#1a2f1a", border: `1px solid ${C.green}40` }
    : { background: C.card, border: `1px solid ${C.border}` };

  return (
    <div style={{ ...cardStyle, borderRadius: 10, padding: 18, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        {isOwner
          ? <p style={{ margin: 0, fontWeight: 700, color: C.green }}><Crown size={12} style={{ verticalAlign: -2, flexShrink: 0 }} /> 최초 관리자 (대표)</p>
          : <span />}
        {!edit && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEdit(true)} style={{ ...btnS(C.purple), padding: "6px 12px", fontSize: 13 }}>
              <Pencil size={12} style={{ verticalAlign: -2, flexShrink: 0 }} /> 수정
            </button>
            {!isOwner && onDelete && (
              <button onClick={() => onDelete(m.id)} style={{ ...btnS(C.red), padding: "6px 12px", fontSize: 13 }}>삭제</button>
            )}
          </div>
        )}
      </div>

      {!edit ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>{lbl("이름")}<p style={{ margin: "3px 0 0", fontSize: 14, color: C.text }}>{m.name}</p></div>
          <div>{lbl("직위")}<p style={{ margin: "3px 0 0", fontSize: 14, color: C.text }}>{m.position || "-"}</p></div>
          <div>{lbl("전화번호")}<p style={{ margin: "3px 0 0", fontSize: 14, color: C.text }}>{m.phone || "-"}</p></div>
          <div>{lbl("이메일")}<p style={{ margin: "3px 0 0", fontSize: 14, color: C.text }}>{m.email}</p></div>
        </div>
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>{lbl("이름")}<input style={{ ...inp, marginTop: 5 }} value={name} onChange={e => setName(e.target.value)} placeholder="이름" /></div>
            <div>{lbl("직위")}<input style={{ ...inp, marginTop: 5 }} value={position} onChange={e => setPosition(e.target.value)} placeholder="예: 매니저" /></div>
            <div>{lbl("전화번호 (알림톡 발송에 사용)")}<input style={{ ...inp, marginTop: 5 }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" /></div>
            <div>{lbl("이메일 (로그인 계정 · 변경 불가)")}<p style={{ margin: "8px 0 0", fontSize: 14, color: C.muted }}>{m.email}</p></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={save} style={{ ...btnS(C.green), flex: 1 }}><Save size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 저장</button>
            <button onClick={cancel} style={{ ...btnS("#555"), flex: 1 }}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembersView({ members, maxMembers, memberPct, setShowMemberForm, handleDeleteMember, handleUpdateMember }: {
  members: any[]; maxMembers: number; memberPct: number;
  setShowMemberForm: (v: boolean) => void;
  handleDeleteMember: (id: string) => void;
  handleUpdateMember: (id: string, updates: any) => void;
}) {
  const owners = members.filter(m => m.role === "owner");
  const staff = members.filter(m => m.role !== "owner");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.text }}><Users size={20} style={{ verticalAlign: -2, flexShrink: 0 }} /> 담당자 관리</h1>
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

      {owners.map(m => <MemberCard key={m.id} m={m} isOwner onUpdate={handleUpdateMember} />)}

      <p style={{ fontWeight: 700, color: C.text, margin: "16px 0 10px" }}>추가 담당자 ({staff.length}명)</p>
      {staff.length === 0
        ? <p style={{ color: C.muted, fontSize: 14 }}>추가된 담당자가 없습니다.</p>
        : staff.map(m => <MemberCard key={m.id} m={m} isOwner={false} onUpdate={handleUpdateMember} onDelete={handleDeleteMember} />)}
    </div>
  );
}
