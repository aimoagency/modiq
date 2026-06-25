// ═══════════════════════════════════════════════════════════════
// 발송(Distribution) 화면 — 파트너 / 보내기 / 보낸함 / 받은함
//  - 에이전시 간 모델 자료 단방향 발송(화이트리스트 스냅샷).
//  - 정산가·세무·연락처는 발송되지 않는다(스냅샷 테이블에 컬럼 자체가 없음).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { C, btnS, inp } from "../theme";
import { thumbUrl } from "../lib/supabase";
import Modal from "../components/Modal";
import { Handshake, User, Plane, CheckCircle2, Clock, Building, Search } from "../components/icons";
import {
  loadPartners, requestPartner, respondPartner, lookupAgencyByBizNo, resolveAgencyNames,
  sendDistribution, loadSentDistributions, revokeDistribution,
  loadReceivedDistributions, markReceivedViewed, loadSharedTravel,
  type AgencyPartner, type TalentDistribution, type ReceivedItem, type DistributionModel, type TravelRow,
} from "../lib/distribution";

type Tab = "partners" | "send" | "sent" | "inbox";

const won = (n: any) => (n != null && n !== "" && Number(n) > 0) ? Number(n).toLocaleString() + "원" : "-";
const fmtDate = (s?: string | null) => s ? s.slice(0, 10).replace(/-/g, ".") : "-";
const firstPhoto = (m: any): string => {
  const a = Array.isArray(m?.photos) ? m.photos : [];
  return a[0] || m?.thumb_url || "";
};

// ⚠️ 컴포넌트 바깥(모듈 레벨)에 둔다. 컴포넌트 안에 정의하면 매 렌더마다 새 함수가 되어
//    내부 <input>이 리마운트→포커스 상실(한 글자씩만 입력되는 버그)을 일으킨다.
const Card = ({ children }: any) => <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>{children}</div>;
const SectionTitle = ({ children }: any) => <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: C.text }}>{children}</p>;

export default function DistributionView({ agency, models, createdBy, isMobile, onImportModel }: {
  agency: any; models: any[]; createdBy?: string; isMobile: boolean;
  onImportModel?: (sm: any, senderName?: string) => Promise<{ ok: boolean; id?: string; error?: string }>;
}) {
  const myId: string = agency?.id;
  const [tab, setTab] = useState<Tab>("partners");
  const [names, setNames] = useState<Record<string, string>>({});
  const nameOf = (id?: string | null) => (id && names[id]) || (id ? `(미확인 ${String(id).slice(-4)})` : "-");
  const mergeNames = async (ids: (string | null | undefined)[]) => {
    const m = await resolveAgencyNames(ids);
    if (Object.keys(m).length) setNames(prev => ({ ...prev, ...m }));
  };

  // ── 파트너 ──
  const [partners, setPartners] = useState<AgencyPartner[]>([]);
  const counterparty = (p: AgencyPartner) => p.requester_agency_id === myId ? p.addressee_agency_id : p.requester_agency_id;
  const acceptedPartners = useMemo(() => partners.filter(p => p.status === "accepted"), [partners]);
  const refreshPartners = async () => {
    try {
      const ps = await loadPartners();
      setPartners(ps);
      mergeNames(ps.map(counterparty));
    } catch (e) { console.error("파트너 로드 실패", e); }
  };
  useEffect(() => { if (myId) refreshPartners(); }, [myId]);

  // ── 데이터: 보낸함 / 받은함 (탭 진입 시 로딩) ──
  const [sent, setSent] = useState<TalentDistribution[]>([]);
  const [sentLoaded, setSentLoaded] = useState(false);
  const refreshSent = async () => {
    try {
      const s = await loadSentDistributions(myId);
      setSent(s); setSentLoaded(true);
      mergeNames(s.flatMap(d => (d.distribution_recipients || []).map(r => r.recipient_agency_id)));
    } catch (e) { console.error("보낸함 로드 실패", e); setSentLoaded(true); }
  };
  const [received, setReceived] = useState<ReceivedItem[]>([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const refreshInbox = async () => {
    try {
      const r = await loadReceivedDistributions(myId);
      setReceived(r); setInboxLoaded(true);
      mergeNames(r.map(x => x.distribution.sender_agency_id));
    } catch (e) { console.error("받은함 로드 실패", e); setInboxLoaded(true); }
  };
  useEffect(() => {
    if (!myId) return;
    if (tab === "sent" && !sentLoaded) refreshSent();
    if (tab === "inbox" && !inboxLoaded) refreshInbox();
  }, [tab, myId]);

  // ───────────────────────────── 탭 바 ─────────────────────────────
  const tabs: [Tab, string, number][] = [
    ["partners", "파트너", partners.filter(p => p.status === "pending" && p.addressee_agency_id === myId).length],
    ["send", "보내기", 0],
    ["sent", "보낸함", 0],
    ["inbox", "받은함", 0],
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>
          <Handshake size={20} style={{ verticalAlign: -3, flexShrink: 0 }} /> 발송
        </h1>
        <span style={{ fontSize: 12, color: C.muted }}>승인된 파트너에게 모델 자료를 단방향 발송합니다</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {tabs.map(([t, label, badge]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            position: "relative", padding: "9px 16px", background: "none", border: "none", cursor: "pointer",
            color: tab === t ? C.text : C.muted, fontSize: 14, fontWeight: tab === t ? 800 : 500,
            borderBottom: tab === t ? `2px solid ${C.blue}` : "2px solid transparent", marginBottom: -1,
          }}>
            {label}
            {badge > 0 && <span style={{ marginLeft: 6, background: C.red, color: "white", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 6px" }}>{badge}</span>}
          </button>
        ))}
      </div>

      {tab === "partners" && <PartnersTab {...{ myId, partners, counterparty, nameOf, createdBy, refreshPartners }} />}
      {tab === "send" && <SendTab {...{ myId, models, acceptedPartners, counterparty, nameOf, createdBy, isMobile, onSent: () => { setSentLoaded(false); setTab("sent"); } }} />}
      {tab === "sent" && <SentTab {...{ sent, sentLoaded, nameOf, refreshSent }} />}
      {tab === "inbox" && <InboxTab {...{ received, inboxLoaded, nameOf, refreshInbox, agency, isMobile, models, onImportModel }} />}
    </div>
  );
}

// ═══════════════════════════ 파트너 탭 ═══════════════════════════
function PartnersTab({ myId, partners, counterparty, nameOf, createdBy, refreshPartners }: any) {
  const [bizNo, setBizNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; name: string; biz_no: string }[] | null>(null);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  const incoming = partners.filter((p: AgencyPartner) => p.status === "pending" && p.addressee_agency_id === myId);
  const outgoing = partners.filter((p: AgencyPartner) => p.status === "pending" && p.requester_agency_id === myId);
  const accepted = partners.filter((p: AgencyPartner) => p.status === "accepted");

  const existsWith = (agId: string) => partners.some((p: AgencyPartner) =>
    counterparty(p) === agId && (p.status === "pending" || p.status === "accepted"));

  const doSearch = async () => {
    setMsg(""); setMsgOk(false); setResult(null);
    const digits = bizNo.replace(/[^0-9]/g, "");
    if (digits.length !== 10) { setMsg("사업자등록번호 10자리를 정확히 입력하세요."); return; }
    setBusy(true);
    try {
      const rows = await lookupAgencyByBizNo(bizNo);
      setResult(rows);
      if (!rows.length) setMsg("등록되지 않은 사업자등록번호입니다. 상대 에이전시가 modiq에 가입되어 있어야 검색됩니다.");
    } catch (e: any) {
      const em = String(e?.message || e);
      if (/PGRST202|Could not find the function|partner_lookup_by_bizno|does not exist/i.test(em))
        setMsg("파트너 검색 기능이 아직 서버에 설정되지 않았습니다. (관리자에게 조회 RPC 적용을 요청하세요)");
      else setMsg("검색 실패: " + em);
    } finally { setBusy(false); }
  };
  const doRequest = async (agId: string) => {
    setBusy(true); setMsg(""); setMsgOk(false);
    try { await requestPartner(myId, agId, createdBy); setResult(null); setBizNo(""); setMsg("파트너 신청을 보냈습니다. 상대가 수락하면 발송할 수 있습니다."); setMsgOk(true); await refreshPartners(); }
    catch (e: any) { setMsg("신청 실패: " + (e?.message || e)); }
    finally { setBusy(false); }
  };
  const respond = async (id: string, status: "accepted" | "rejected") => {
    setBusy(true);
    try { await respondPartner(id, status); await refreshPartners(); }
    catch (e: any) { alert("처리 실패: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* 파트너 추가 */}
      <Card>
        <SectionTitle>파트너 추가</SectionTitle>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: C.muted }}>상대 에이전시의 <b>사업자등록번호(10자리)</b>를 입력해 검색 후 신청하세요.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input value={bizNo} onChange={e => setBizNo(e.target.value)} placeholder="000-00-00000"
            onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
            style={{ ...inp, marginBottom: 0, maxWidth: 220 }} />
          <button onClick={doSearch} disabled={busy} style={btnS(C.blue, busy)}><Search size={13} style={{ verticalAlign: -2 }} /> 검색</button>
        </div>
        {result && result.map(r => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, padding: "10px 12px", background: C.card2, borderRadius: 8 }}>
            <div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text }}><Building size={13} style={{ verticalAlign: -2 }} /> {r.name}</p><p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{r.biz_no}</p></div>
            {existsWith(r.id)
              ? <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>이미 연결/신청됨</span>
              : <button onClick={() => doRequest(r.id)} disabled={busy} style={btnS(C.green, busy)}>파트너 신청</button>}
          </div>
        ))}
        {msg && <p style={{ margin: "10px 0 0", fontSize: 12, color: msgOk ? C.green : C.red }}>{msg}</p>}
      </Card>

      {/* 받은 신청 */}
      {incoming.length > 0 && (
        <Card>
          <SectionTitle>받은 신청 ({incoming.length})</SectionTitle>
          {incoming.map((p: AgencyPartner) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}><Building size={13} style={{ verticalAlign: -2 }} /> {nameOf(p.requester_agency_id)}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button onClick={() => respond(p.id, "accepted")} disabled={busy} style={btnS(C.green, busy)}>수락</button>
                <button onClick={() => respond(p.id, "rejected")} disabled={busy} style={{ ...btnS(C.card2, busy), color: C.muted, border: `1px solid ${C.border}` }}>거절</button>
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* 연결된 파트너 */}
      <Card>
        <SectionTitle>연결된 파트너 ({accepted.length})</SectionTitle>
        {accepted.length === 0
          ? <p style={{ margin: 0, fontSize: 13, color: C.muted }}>아직 연결된 파트너가 없습니다.</p>
          : accepted.map((p: AgencyPartner) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `1px solid ${C.border}` }}>
              <CheckCircle2 size={15} color={C.green} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{nameOf(counterparty(p))}</span>
            </div>
          ))}
      </Card>

      {/* 보낸 신청 (대기) */}
      {outgoing.length > 0 && (
        <Card>
          <SectionTitle>보낸 신청 — 수락 대기 ({outgoing.length})</SectionTitle>
          {outgoing.map((p: AgencyPartner) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderTop: `1px solid ${C.border}` }}>
              <Clock size={15} color={C.yellow} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: C.textSub }}>{nameOf(p.addressee_agency_id)}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>대기중</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════ 보내기 탭 ═══════════════════════════
function SendTab({ myId, models, acceptedPartners, counterparty, nameOf, createdBy, isMobile, onSent }: any) {
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [recips, setRecips] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const shareable = (_m: any) => true; // 공유 동의 게이트 제거 — 내 소속 모델은 모두 발송 가능
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (models || []).filter((m: any) => !s || (m.name || "").toLowerCase().includes(s));
  }, [models, q]);
  const pickedModels = useMemo(() => (models || []).filter((m: any) => picked.has(m.id)), [models, picked]);
  const partnerIds: string[] = acceptedPartners.map(counterparty);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n);
  };

  const canNext = step === 1 ? picked.size > 0 : step === 2 ? recips.size > 0 : true;

  const reset = () => { setStep(1); setPicked(new Set()); setRecips(new Set()); setQ(""); setMessage(""); setExpiry(""); setErr(""); setDone(false); };

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await sendDistribution({
        senderAgencyId: myId, createdBy, message,
        expiresAt: expiry ? new Date(expiry + "T23:59:59").toISOString() : null,
        models: pickedModels, recipientAgencyIds: Array.from(recips),
      });
      setDone(true);
      setTimeout(() => { reset(); onSent?.(); }, 1200);
    } catch (e: any) { setErr("발송 실패: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  if (acceptedPartners.length === 0) {
    return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, textAlign: "center", color: C.muted }}>
      먼저 <b style={{ color: C.text }}>파트너</b> 탭에서 발송 대상 에이전시를 연결하세요.
    </div>;
  }
  if (done) {
    return <div style={{ background: C.card, border: `1px solid ${C.green}55`, borderRadius: 12, padding: 28, textAlign: "center" }}>
      <CheckCircle2 size={36} color={C.green} /><p style={{ margin: "10px 0 0", fontSize: 15, fontWeight: 700, color: C.text }}>발송 완료</p>
    </div>;
  }

  const StepHead = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {[[1, "모델 선택"], [2, "파트너 지정"], [3, "미리보기·발송"]].map(([n, l]) => (
        <span key={n as number} style={{ fontSize: 12, fontWeight: step === n ? 800 : 500, color: step === (n as number) ? C.blue : step > (n as number) ? C.green : C.muted }}>
          {step > (n as number) ? "✓" : (n as number)}. {l}{(n as number) < 3 && <span style={{ color: C.border }}>　→　</span>}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 820 }}>
      <StepHead />

      {/* STEP 1 — 모델 선택 */}
      {step === 1 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="모델 검색" style={{ ...inp, marginBottom: 0, maxWidth: 240 }} />
            <span style={{ fontSize: 12, color: C.muted }}>선택 <b style={{ color: C.text }}>{picked.size}</b>명</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
            {filtered.map((m: any) => {
              const ok = shareable(m); const on = picked.has(m.id); const ph = firstPhoto(m);
              return (
                <div key={m.id} onClick={() => ok && toggle(picked, m.id, setPicked)}
                  style={{ position: "relative", border: `2px solid ${on ? C.blue : C.border}`, borderRadius: 10, overflow: "hidden", cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.5, background: C.card }}>
                  <div style={{ aspectRatio: "3/4", background: C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {ph ? <img src={thumbUrl(ph)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <User size={28} color={C.muted} />}
                  </div>
                  <div style={{ padding: "7px 9px" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>{m.birth_year ? `${m.birth_year}년생` : ""}{m.height ? ` · ${m.height}` : ""}</p>
                  </div>
                  {on && <span style={{ position: "absolute", top: 6, right: 6, background: C.blue, color: "white", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={14} /></span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* STEP 2 — 파트너 지정 */}
      {step === 2 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: C.textSub }}>발송 대상 <b style={{ color: C.text }}>{recips.size}</b>곳</span>
            <button onClick={() => setRecips(new Set(recips.size === partnerIds.length ? [] : partnerIds))}
              style={{ ...btnS(C.card2), color: C.blue, border: `1px solid ${C.blue}55` }}>
              {recips.size === partnerIds.length ? "전체 해제" : "전체 파트너 선택"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 8 }}>
            {acceptedPartners.map((p: AgencyPartner) => {
              const id = counterparty(p); const on = recips.has(id);
              return (
                <div key={p.id} onClick={() => toggle(recips, id, setRecips)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: `2px solid ${on ? C.blue : C.border}`, borderRadius: 10, cursor: "pointer", background: on ? C.blue + "12" : C.card }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? C.blue : C.border}`, background: on ? C.blue : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {on && <CheckCircle2 size={13} color="white" />}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}><Building size={13} style={{ verticalAlign: -2 }} /> {nameOf(id)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* STEP 3 — 미리보기 · 발송 */}
      {step === 3 && (
        <>
          <div style={{ background: "#1a2f4a", border: `1px solid ${C.blue}50`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 700 }}>아래는 <u>상대가 받게 될 화면</u>입니다.</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textSub }}>⚠️ 정산가·세무정보·연락처·주민번호는 <b style={{ color: C.text }}>발송되지 않습니다</b>. 노출가(Day/Half/Hour)와 신체정보·사진만 전달됩니다.</p>
          </div>

          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: C.text }}>모델 {pickedModels.length}명 · 파트너 {recips.size}곳</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(240px,1fr))", gap: 10, marginBottom: 16 }}>
            {pickedModels.map((m: any) => <PreviewCard key={m.id} m={m} />)}
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>발송 메모 (선택)</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="예) 6월 가용 모델 리스트입니다."
            style={{ ...inp, minHeight: 60, resize: "vertical" }} />
          <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub }}>만료일 (선택 — 이후 자동으로 상대 수신함에서 사라짐)</label>
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
          {err && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.red }}>{err}</p>}
        </>
      )}

      {/* 네비 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, gap: 8 }}>
        <button onClick={() => step > 1 ? setStep(step - 1) : reset()} disabled={busy}
          style={{ ...btnS(C.card2), color: C.textSub, border: `1px solid ${C.border}` }}>
          {step > 1 ? "이전" : "초기화"}
        </button>
        {step < 3
          ? <button onClick={() => canNext && setStep(step + 1)} disabled={!canNext} style={btnS(C.blue, !canNext)}>다음</button>
          : <button onClick={submit} disabled={busy} style={btnS(C.green, busy)}>{busy ? "발송 중…" : `발송 (${pickedModels.length}명 → ${recips.size}곳)`}</button>}
      </div>
    </div>
  );
}

// 발송 미리보기/수신 공통 모델 카드 (스냅샷 데이터 기준)
function PreviewCard({ m, logoUrl, travel, onImport, imported, importBusy }: {
  m: any; logoUrl?: string; travel?: TravelRow | null;
  onImport?: () => void; imported?: boolean; importBusy?: boolean;
}) {
  const photos: string[] = useMemo(() => {
    const a = Array.isArray(m.photos) ? m.photos.filter((p: any) => typeof p === "string" && p) : [];
    if (a.length) return a;
    const t = m.thumb_url || m.thumb || "";
    return t ? [t] : [];
  }, [m]);
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const safeIdx = idx < photos.length ? idx : 0;
  const ph = photos[safeIdx] || "";
  const fields = Array.isArray(m.fields) ? m.fields : [];
  const name = m.display_name || m.name;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div onClick={() => ph && setZoom(true)} style={{ position: "relative", aspectRatio: "3/4", background: C.card2, cursor: ph ? "zoom-in" : "default" }}>
        {ph ? <img src={thumbUrl(ph)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}><User size={30} color={C.muted} /></div>}
        {photos.length > 1 && <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 7px" }}>{safeIdx + 1}/{photos.length}</span>}
        {logoUrl && <img src={logoUrl} alt="" style={{ position: "absolute", bottom: 6, right: 6, height: 24, maxWidth: 80, objectFit: "contain", background: "rgba(255,255,255,0.85)", borderRadius: 4, padding: 2 }} />}
      </div>
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 5, overflowX: "auto", padding: "7px 8px 0" }}>
          {photos.map((p, i) => (
            <div key={i} onClick={() => setIdx(i)} style={{ width: 38, height: 50, borderRadius: 5, overflow: "hidden", flexShrink: 0, cursor: "pointer", border: `2px solid ${i === safeIdx ? C.blue : "transparent"}` }}>
              <img src={thumbUrl(p)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
      )}
      {zoom && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 3000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={ph} alt="" style={{ maxWidth: "100%", maxHeight: "82vh", objectFit: "contain" }} onClick={e => e.stopPropagation()} />
          {photos.length > 1 && (
            <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14, color: "#fff" }}>
              <button onClick={() => setIdx((safeIdx - 1 + photos.length) % photos.length)} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 18, cursor: "pointer" }}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{safeIdx + 1} / {photos.length}</span>
              <button onClick={() => setIdx((safeIdx + 1) % photos.length)} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 18, cursor: "pointer" }}>›</button>
            </div>
          )}
          <button onClick={() => setZoom(false)} style={{ position: "absolute", top: 16, right: 18, background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 14, cursor: "pointer" }}>닫기 ✕</button>
        </div>
      )}
      <div style={{ padding: "10px 12px" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{name}
          {m.gender && <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}> · {m.gender === "F" ? "여성" : m.gender === "M" ? "남성" : m.gender}</span>}
        </p>
        <p style={{ margin: "3px 0 8px", fontSize: 11, color: C.muted }}>{m.birth_year ? `${m.birth_year}년생` : ""}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: 11, color: C.textSub }}>
          {m.height && <span>키 <b style={{ color: C.text }}>{m.height}</b></span>}
          {m.bust && <span>B <b style={{ color: C.text }}>{m.bust}</b></span>}
          {m.waist && <span>W <b style={{ color: C.text }}>{m.waist}</b></span>}
          {m.hip && <span>H <b style={{ color: C.text }}>{m.hip}</b></span>}
          {m.shoe && <span>발 <b style={{ color: C.text }}>{m.shoe}</b></span>}
        </div>
        {(m.hair_length || m.hair_color || m.eye_color || m.tattoo || m.underwear_ok) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
            {[m.hair_length, m.hair_color, m.eye_color && `눈 ${m.eye_color}`, m.tattoo && "타투", m.underwear_ok && "언더웨어 가능"].filter(Boolean).map((t: any, i: number) =>
              <span key={i} style={{ fontSize: 10, color: C.textSub, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 5, padding: "2px 6px" }}>{t}</span>)}
          </div>
        )}
        {fields.length > 0 && <p style={{ margin: "7px 0 0", fontSize: 10, color: C.muted }}>{fields.join(" · ")}</p>}
        {m.specialty && <p style={{ margin: "4px 0 0", fontSize: 10, color: C.muted }}>특기: {m.specialty}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 11, color: C.textSub }}>
          <span>Day <b style={{ color: C.text }}>{won(m.fee_day)}</b></span>
          <span>Half <b style={{ color: C.text }}>{won(m.fee_half)}</b></span>
          <span>Hour <b style={{ color: C.text }}>{won(m.fee_hour)}</b></span>
        </div>
        {travel && (travel.entry_date || travel.exit_date) && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: C.blue, fontWeight: 600 }}>
            <Plane size={11} style={{ verticalAlign: -2 }} /> 입국 {fmtDate(travel.entry_date)} ~ 출국 {fmtDate(travel.exit_date)}
          </p>
        )}
        {onImport && (
          imported
            ? <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: C.green, textAlign: "center", background: C.green + "14", borderRadius: 8, padding: "8px 0" }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> 내 모델로 등록됨</div>
            : <button onClick={onImport} disabled={importBusy} style={{ ...btnS(C.blue, importBusy), width: "100%", marginTop: 10 }}>{importBusy ? "등록 중…" : "내 모델로 등록"}</button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════ 보낸함 탭 ═══════════════════════════
function SentTab({ sent, sentLoaded, nameOf, refreshSent }: any) {
  const [busyId, setBusyId] = useState("");
  const revoke = async (id: string) => {
    if (!confirm("이 발송을 철회하면 상대 수신함에서 사라집니다. 철회할까요?")) return;
    setBusyId(id);
    try { await revokeDistribution(id); await refreshSent(); }
    catch (e: any) { alert("철회 실패: " + (e?.message || e)); }
    finally { setBusyId(""); }
  };

  if (!sentLoaded) return <p style={{ color: C.muted, fontSize: 13 }}>불러오는 중…</p>;
  if (!sent.length) return <p style={{ color: C.muted, fontSize: 13 }}>보낸 발송이 없습니다.</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      {sent.map((d: TalentDistribution) => {
        const recs = d.distribution_recipients || [];
        const viewedCnt = recs.filter(r => r.viewed_at).length;
        const expired = d.status === "active" && d.expires_at && new Date(d.expires_at) < new Date();
        const statusLabel = d.status === "revoked" ? "철회됨" : expired ? "만료됨" : "발송중";
        const statusColor = d.status === "revoked" ? C.muted : expired ? C.yellow : C.green;
        return (
          <div key={d.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12, opacity: d.status === "revoked" ? 0.65 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>모델 {(d.distribution_models || []).length}명 · 파트너 {recs.length}곳</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>{fmtDate(d.created_at)} 발송{d.expires_at ? ` · 만료 ${fmtDate(d.expires_at)}` : ""}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: statusColor, background: statusColor + "1e", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{statusLabel}</span>
            </div>
            {d.message && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textSub, background: C.card2, borderRadius: 6, padding: "7px 10px" }}>{d.message}</p>}
            <div style={{ margin: "10px 0 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {recs.map(r => (
                <span key={r.id} style={{ fontSize: 11, color: r.viewed_at ? C.green : C.textSub, background: C.card2, border: `1px solid ${r.viewed_at ? C.green + "55" : C.border}`, borderRadius: 6, padding: "3px 8px" }}>
                  {nameOf(r.recipient_agency_id)} {r.viewed_at ? "· 열람" : "· 미열람"}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ fontSize: 11, color: C.muted }}>열람 {viewedCnt}/{recs.length}</span>
              {d.status === "active" && !expired && (
                <button onClick={() => revoke(d.id)} disabled={busyId === d.id} style={{ ...btnS(C.card2, busyId === d.id), color: C.red, border: `1px solid ${C.red}55` }}>철회</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════ 받은함 탭 ═══════════════════════════
function InboxTab({ received, inboxLoaded, nameOf, refreshInbox, agency, isMobile, models, onImportModel }: any) {
  const [openItem, setOpenItem] = useState<ReceivedItem | null>(null);
  const [travel, setTravel] = useState<Record<string, TravelRow>>({});
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState("");

  const open = async (item: ReceivedItem) => {
    setOpenItem(item);
    if (!item.viewed_at) { try { await markReceivedViewed(item.recipientRowId); item.viewed_at = new Date().toISOString(); } catch {} }
    const mids = (item.distribution.distribution_models || []).map(m => m.source_model_id);
    try { setTravel(await loadSharedTravel(mids)); } catch { setTravel({}); }
  };

  // 이미 가져온 모델인지(같은 이름+생년 & 공유 출처 메모) — 새로고침 후에도 중복 표시 방지
  const alreadyInRoster = (m: DistributionModel) =>
    importedIds.has(m.id) ||
    (models || []).some((x: any) => (x.name || "") === (m.display_name || "") && (x.birth_year ?? null) === (m.birth_year ?? null) && /공유 모델/.test(String(x.memo || "")));

  const doImport = async (m: DistributionModel, senderName: string) => {
    if (!onImportModel) return;
    const dup = (models || []).some((x: any) => (x.name || "") === (m.display_name || "") && (x.birth_year ?? null) === (m.birth_year ?? null));
    if (dup && !importedIds.has(m.id) && !confirm(`'${m.display_name}'와(과) 이름·생년이 같은 모델이 이미 있습니다.\n그래도 내 모델로 가져올까요?`)) return;
    setBusyId(m.id);
    try {
      const r = await onImportModel(m, senderName);
      if (r?.ok) { setImportedIds(prev => new Set(prev).add(m.id)); alert("내 모델로 등록했습니다.\n'모델' 메뉴에서 연락처·정산정보 등을 채워 사용하세요."); }
      else alert("등록 실패: " + (r?.error || "알 수 없는 오류"));
    } finally { setBusyId(""); }
  };

  if (!inboxLoaded) return <p style={{ color: C.muted, fontSize: 13 }}>불러오는 중…</p>;
  if (!received.length) return <p style={{ color: C.muted, fontSize: 13 }}>받은 발송이 없습니다.</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      {received.map((item: ReceivedItem) => {
        const d = item.distribution; const ms = d.distribution_models || [];
        return (
          <div key={item.recipientRowId} onClick={() => open(item)}
            style={{ background: C.card, border: `1px solid ${item.viewed_at ? C.border : C.blue + "66"}`, borderRadius: 12, padding: 16, marginBottom: 12, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}><Building size={14} style={{ verticalAlign: -2 }} /> {nameOf(d.sender_agency_id)} <span style={{ fontWeight: 500, color: C.textSub }}>· 모델 {ms.length}명</span></p>
              {!item.viewed_at && <span style={{ fontSize: 10, fontWeight: 800, color: "white", background: C.blue, borderRadius: 20, padding: "2px 8px" }}>NEW</span>}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: C.muted }}>{fmtDate(d.created_at)} 수신{d.expires_at ? ` · 만료 ${fmtDate(d.expires_at)}` : ""}</p>
            {d.message && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textSub }}>{d.message}</p>}
            <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }}>
              {ms.slice(0, 8).map(m => { const ph = firstPhoto(m); return (
                <div key={m.id} style={{ width: 46, height: 60, borderRadius: 6, background: C.card2, flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ph ? <img src={thumbUrl(ph)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={16} color={C.muted} />}
                </div>); })}
              {ms.length > 8 && <div style={{ width: 46, height: 60, borderRadius: 6, background: C.card2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.muted, fontWeight: 700 }}>+{ms.length - 8}</div>}
            </div>
          </div>
        );
      })}

      {openItem && (
        <Modal onClose={() => setOpenItem(null)} maxW={920}>
          <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: C.text }}><Building size={16} style={{ verticalAlign: -2 }} /> {nameOf(openItem.distribution.sender_agency_id)}</p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted }}>모델 {(openItem.distribution.distribution_models || []).length}명 · 사진을 누르면 확대 · <b style={{ color: C.textSub }}>내 모델로 등록</b>하면 '모델' 메뉴에 추가됩니다</p>
          {openItem.distribution.message && <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textSub, background: C.card2, borderRadius: 8, padding: "9px 12px" }}>{openItem.distribution.message}</p>}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill,minmax(230px,1fr))", gap: 12 }}>
            {(openItem.distribution.distribution_models || []).map((m: DistributionModel) =>
              <PreviewCard key={m.id} m={m} logoUrl={agency?.logo_url || ""} travel={m.source_model_id ? travel[m.source_model_id] : null}
                onImport={onImportModel ? () => doImport(m, nameOf(openItem.distribution.sender_agency_id)) : undefined}
                imported={alreadyInRoster(m)} importBusy={busyId === m.id} />)}
          </div>
        </Modal>
      )}
    </div>
  );
}
