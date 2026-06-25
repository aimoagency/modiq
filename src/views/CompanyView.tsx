import { useState } from "react";
import { C, btnS, inp } from "../theme";
import { Building2, Crown, Save, Pencil, Calendar } from "../components/icons";
import { validateBizNo } from "../lib/utils";
import { startGoogleConnect } from "../lib/gcal";

// 회사(에이전시) 정보 + 소유권 이전 — owner 전용
// 패턴: 보기 → 수정(연필) → 저장/취소 (모델·섭외 상세와 통일)
export default function CompanyView({ agency, members, session, onSave, onTransferOwner, onRevokeOwner }: {
  agency: any;
  members: any[];
  session: any;
  onSave: (updates: any) => void;
  onTransferOwner: (member: any) => void;
  onRevokeOwner: (member: any) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [name, setName]         = useState(agency?.name || "");
  const [repName, setRepName]   = useState(agency?.rep_name || "");
  const [repPhone, setRepPhone] = useState(agency?.rep_phone || "");
  const [contactPhone, setContactPhone] = useState(agency?.contact_phone || "");
  const [bizNo, setBizNo]       = useState(agency?.biz_no || "");
  const [address, setAddress]   = useState(agency?.address || "");
  const [payoutBank, setPayoutBank] = useState(agency?.payout_bank_info || "");
  const [logo, setLogo]         = useState(agency?.logo_url || "");
  const [transferTo, setTransferTo] = useState("");
  const [saved, setSaved] = useState(false);

  const owners = members.filter(m => m.role === "owner");
  const grantable = members.filter(m => m.role !== "owner");
  const lbl = (t: string) => <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5 }}>{t}</label>;
  const fmtBiz = (s: string) => { const n = String(s).replace(/[^0-9]/g, ""); return n.length === 10 ? `${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}` : (s || "-"); };

  const resetFields = () => {
    setName(agency?.name || ""); setRepName(agency?.rep_name || ""); setRepPhone(agency?.rep_phone || "");
    setContactPhone(agency?.contact_phone || ""); setBizNo(agency?.biz_no || ""); setAddress(agency?.address || "");
    setPayoutBank(agency?.payout_bank_info || ""); setLogo(agency?.logo_url || "");
  };

  // 로고 업로드 — 투명 배경 유지 위해 PNG로 리사이즈
  const onLogoFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 240; const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      setLogo(cv.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
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
    onSave({ name: name.trim(), rep_name: repName.trim(), rep_phone: repPhone.trim(), contact_phone: contactPhone.trim(), biz_no: bn, address: address.trim(), payout_bank_info: payoutBank.trim(), logo_url: logo });
    setEditMode(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const row = (k: string, v: string) => (
    <div key={k} style={{ display: "flex", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ width: 120, flexShrink: 0, color: C.muted, fontSize: 13 }}>{k}</span>
      <span style={{ color: C.text, fontSize: 13 }}>{v || "-"}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800, color: C.text }}>설정</h1>

      {/* 구글 캘린더 연동 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14, color: C.text }}>
          <Calendar size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 구글 캘린더 연동
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
          연동하면 섭외(촬영·실물미팅)를 확정할 때 <strong style={{ color: C.textSub }}>연동한 구글 계정</strong>의 캘린더에 일정이 만들어지고, 모델이 게스트로 초대됩니다. 모델이 수락하면 변경·취소가 자동 반영됩니다.
        </p>
        {agency?.gcal_email ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.green + "18", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>● 연동됨</span>
              <span style={{ fontSize: 13, color: C.textSub }}>{agency.gcal_email}</span>
            </div>
            <button onClick={() => startGoogleConnect(agency.id)} style={{ padding: "8px 14px", background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              다른 구글 계정으로 변경
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => startGoogleConnect(agency.id)} style={{ ...btnS(C.blue), fontSize: 13 }}>
              <Calendar size={13} style={{ verticalAlign: -2, flexShrink: 0 }} /> 구글 캘린더 연동하기
            </button>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: C.text, fontWeight: 600 }}>※ 회사 대표(운영) 구글 계정으로 로그인하세요.</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted, lineHeight: 1.6 }}>그 계정 캘린더에 일정이 생기고, 그 계정 이름으로 모델에게 초대가 발송됩니다. 로그인 → 권한 허용 후 "연동 완료" 화면이 뜨면 이 탭으로 돌아오세요. (연동은 에이전시 1회)</p>
          </>
        )}
      </div>

      {/* 기본 정보 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.text }}>
            <Building2 size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 기본 정보
          </p>
          {!editMode && (
            <button onClick={() => setEditMode(true)} style={{ ...btnS(C.purple), fontSize: 12 }}>
              <Pencil size={12} style={{ verticalAlign: -2, flexShrink: 0 }} /> 수정
            </button>
          )}
        </div>

        {!editMode ? (
          <div>
            {logo && <div style={{ marginBottom: 14 }}><img src={logo} alt="로고" style={{ height: 52, maxWidth: 200, objectFit: "contain" }} /></div>}
            {row("상호 (에이전시명)", name)}
            {row("대표자명", repName)}
            {row("대표 연락처", repPhone)}
            {row("알림톡 문의 연락처", contactPhone)}
            {row("사업자등록번호", fmtBiz(bizNo))}
            {row("주소", address)}
            {row("정산 입금계좌", payoutBank)}
            {saved && <p style={{ margin: "12px 0 0", color: C.green, fontSize: 13, fontWeight: 700 }}>저장되었습니다</p>}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 14 }}>
              {lbl("회사 로고 (명세서 좌측 상단에 표시)")}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 96, height: 64, borderRadius: 8, border: `1px dashed ${C.border}`, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                  {logo ? <img src={logo} alt="로고" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: C.muted }}>없음</span>}
                </div>
                <label style={{ ...btnS(C.blue), fontSize: 12, cursor: "pointer" }}>{logo ? "로고 변경" : "로고 업로드"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { onLogoFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                </label>
                {logo && <button onClick={() => setLogo("")} style={{ ...btnS(C.red), fontSize: 12 }}>삭제</button>}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>PNG 권장(투명 배경).</p>
            </div>
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
            <div style={{ marginBottom: 12 }}>
              {lbl("주소")}
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inp, flex: 1, marginBottom: 0 }} value={address} onChange={e => setAddress(e.target.value)} placeholder="주소 검색 후 상세주소 입력" />
                <button onClick={openPostcode} style={{ ...btnS(C.blue), flexShrink: 0, padding: "9px 14px", whiteSpace: "nowrap" }}>주소 검색</button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              {lbl("정산 입금계좌 (대대행 발송 시 상대에게 전달 — 은행/계좌/예금주)")}
              <input style={inp} value={payoutBank} onChange={e => setPayoutBank(e.target.value)} placeholder="예: 국민 123456-78-901234 (주)아이모" />
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

      {/* 권한 부여 (공동 대표) */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14, color: C.text }}>
          <Crown size={14} style={{ verticalAlign: -2, flexShrink: 0 }} /> 권한 부여 (공동 대표)
        </p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: C.textSub }}>
          담당자에게 대표 권한을 추가로 부여합니다. 본인 권한은 그대로 유지되며, 부여받은 담당자도 설정·담당자·재무 등 대표 기능을 사용할 수 있습니다.
        </p>
        {grantable.length === 0 ? (
          <p style={{ fontSize: 13, color: C.muted }}>권한을 부여할 담당자가 없습니다. 먼저 담당자를 추가하세요.</p>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <select style={{ ...inp, flex: 1, marginBottom: 0 }} value={transferTo} onChange={e => setTransferTo(e.target.value)}>
              <option value="">담당자 선택</option>
              {grantable.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
            </select>
            <button
              onClick={() => { const t = grantable.find(m => m.id === transferTo); if (!t) return alert("담당자를 선택하세요"); onTransferOwner(t); setTransferTo(""); }}
              style={{ ...btnS(C.blue), flexShrink: 0 }}>권한 부여</button>
          </div>
        )}
        {owners.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, color: C.muted }}>현재 대표 권한 보유자</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {owners.map(m => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: C.card2, border: `1px solid ${C.border}`, fontSize: 12, color: C.text }}>
                  <Crown size={11} style={{ flexShrink: 0, color: "#c9a000" }} /> {m.name}
                  {m.user_id !== session?.id && <button onClick={() => onRevokeOwner(m)} title="권한 회수" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>}
                  {m.user_id === session?.id && <span style={{ fontSize: 10, color: C.muted }}>(나)</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
