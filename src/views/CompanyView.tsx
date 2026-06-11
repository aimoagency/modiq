import { useState } from "react";
import { C, btnS, inp } from "../theme";
import { Building2, Crown, Save, Pencil } from "../components/icons";
import { validateBizNo } from "../lib/utils";

// 회사(에이전시) 정보 + 소유권 이전 — owner 전용
// 패턴: 보기 → 수정(연필) → 저장/취소 (모델·섭외 상세와 통일)
export default function CompanyView({ agency, members, session, onSave, onTransferOwner }: {
  agency: any;
  members: any[];
  session: any;
  onSave: (updates: any) => void;
  onTransferOwner: (member: any) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [name, setName]         = useState(agency?.name || "");
  const [repName, setRepName]   = useState(agency?.rep_name || "");
  const [repPhone, setRepPhone] = useState(agency?.rep_phone || "");
  const [contactPhone, setContactPhone] = useState(agency?.contact_phone || "");
  const [bizNo, setBizNo]       = useState(agency?.biz_no || "");
  const [address, setAddress]   = useState(agency?.address || "");
  const [transferTo, setTransferTo] = useState("");
  const [saved, setSaved] = useState(false);

  const others = members.filter(m => m.user_id !== session?.id);
  const lbl = (t: string) => <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5 }}>{t}</label>;
  const fmtBiz = (s: string) => { const n = String(s).replace(/[^0-9]/g, ""); return n.length === 10 ? `${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}` : (s || "-"); };

  const resetFields = () => {
    setName(agency?.name || ""); setRepName(agency?.rep_name || ""); setRepPhone(agency?.rep_phone || "");
    setContactPhone(agency?.contact_phone || ""); setBizNo(agency?.biz_no || ""); setAddress(agency?.address || "");
  };

  // 다음(카카오) 우편번호 검색 — 스크립트 동적 로드 후 팝업
  const openPostcode = () => {
    const w = window as any;
    const open = () => new w.daum.Postcode({
      oncomplete: (data: any) => setAddress(data.roadAddress || data.jibunAddress || data.address || ""),
    }).open();
    if (w.daum && w.daum.Postcode) { open(); return; }
    const s = document.createElement("script");
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.onload = open;
    s.onerror = () => alert("주소 검색 로드 실패 (네트워크 확인)");
    document.body.appendChild(s);
  };

  const handleSave = () => {
    const bn = bizNo.replace(/[^0-9]/g, "");
    if (bn && !validateBizNo(bn)) return alert("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    onSave({ name: name.trim(), rep_name: repName.trim(), rep_phone: repPhone.trim(), contact_phone: contactPhone.trim(), biz_no: bn, address: address.trim() });
    setEditMode(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const row = (k: string, v: string) => (
    <div key={k} style={{ display: "flex", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 120, flexShrink: 0, color: C.muted, fontSize: 14 }}>{k}</span>
      <span style={{ color: C.text, fontSize: 14 }}>{v || "-"}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 800, color: C.text }}>회사 정보</h1>

      {/* 기본 정보 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>
            <Building2 size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 기본 정보
          </p>
          {!editMode && (
            <button onClick={() => setEditMode(true)} style={{ ...btnS(C.purple), fontSize: 13 }}>
              <Pencil size={12} style={{ verticalAlign: -2, flexShrink: 0 }} /> 수정
            </button>
          )}
        </div>

        {!editMode ? (
          <div>
            {row("상호 (에이전시명)", name)}
            {row("대표자명", repName)}
            {row("대표 연락처", repPhone)}
            {row("알림톡 문의 연락처", contactPhone)}
            {row("사업자등록번호", fmtBiz(bizNo))}
            {row("주소", address)}
            {saved && <p style={{ margin: "12px 0 0", color: C.green, fontSize: 14, fontWeight: 700 }}>저장되었습니다</p>}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              {lbl("상호 (에이전시명) — 알림톡 발신명으로 사용")}
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="예: 아이모 에이전시" />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                {lbl("대표자명")}
                <input style={inp} value={repName} onChange={e => setRepName(e.target.value)} placeholder="대표자 이름" />
              </div>
              <div style={{ flex: 1 }}>
                {lbl("대표 연락처")}
                <input style={inp} value={repPhone} onChange={e => setRepPhone(e.target.value)} placeholder="010-0000-0000" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              {lbl("알림톡 문의 연락처 (모델·고객사에 표시)")}
              <input style={inp} value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div style={{ marginBottom: 12 }}>
              {lbl("사업자등록번호")}
              <input style={inp} value={bizNo} onChange={e => setBizNo(e.target.value)} placeholder="000-00-00000" />
            </div>
            <div style={{ marginBottom: 16 }}>
              {lbl("주소")}
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inp, flex: 1, marginBottom: 0 }} value={address} onChange={e => setAddress(e.target.value)} placeholder="주소 검색 후 상세주소 입력" />
                <button onClick={openPostcode} style={{ ...btnS(C.blue), flexShrink: 0, padding: "9px 14px", whiteSpace: "nowrap" }}>주소 검색</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleSave} style={{ ...btnS(C.green), flex: 1 }}>
                <Save size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 저장
              </button>
              <button onClick={() => { resetFields(); setEditMode(false); }} style={{ ...btnS("#555"), flex: 1 }}>취소</button>
            </div>
          </div>
        )}
      </div>

      {/* 소유권 이전 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 15, color: C.text }}>
          <Crown size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 소유권 이전
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textSub }}>
          소유자(대표) 권한을 다른 담당자에게 넘깁니다. 넘기면 본인은 일반 담당자가 되어 일부 권한을 잃습니다.
        </p>
        {others.length === 0 ? (
          <p style={{ fontSize: 14, color: C.muted }}>이전할 담당자가 없습니다. 먼저 담당자를 추가하세요.</p>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <select style={{ ...inp, flex: 1, marginBottom: 0 }} value={transferTo} onChange={e => setTransferTo(e.target.value)}>
              <option value="">담당자 선택</option>
              {others.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
            </select>
            <button
              onClick={() => { const t = others.find(m => m.id === transferTo); if (!t) return alert("담당자를 선택하세요"); onTransferOwner(t); }}
              style={{ ...btnS(C.red), flexShrink: 0 }}>이전</button>
          </div>
        )}
      </div>
    </div>
  );
}
