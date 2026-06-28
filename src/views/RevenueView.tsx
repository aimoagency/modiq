import { useState } from "react";
import { C, inp } from "../theme";
import { Coins, Download, CheckCircle2 } from "../components/icons";
import { fmtDate, periodRange, REVENUE_STATUSES, bookingTotal, bookingAgencyFee, bookingModelPay, clientBalance } from "../lib/utils";
import { STATUS, BOOKING_TYPES } from "../constants";
import RevenueRanking from "../components/RevenueRanking";
import Badge from "../components/Badge";
import ClientStatementModal from "../components/ClientStatementModal";
import { exportAoaXlsx } from "../lib/xlsx";

export default function RevenueView({ bookings, models, customers, agency, isMobile = false, onSelectBooking }: {
  bookings: any[]; models: any[]; customers: any[]; agency?: any; isMobile?: boolean; onSelectBooking: (b:any)=>void;
}) {
  // 데스크탑 목록 = 엑셀형 균일 컬럼(헤더+데이터 행 동일 grid): 모델→고객사 · 촬영일 · 상태 · 매출(금액+총이익) · 입금
  const GRID = "minmax(0,2fr) minmax(0,1.1fr) minmax(0,1.1fr) max-content minmax(0,1.4fr) max-content";
  const [preset, setPreset] = useState("3m");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [tab, setTab] = useState<"customer"|"model">("customer");
  const [showStmt, setShowStmt] = useState(false); // 거래명세서/청구 모달
  const [sel, setSel] = useState<{ type:"model"|"customer"; id:string; name:string } | null>(null); // 선택된 모델/고객사
  const todayStr = new Date().toISOString().slice(0,10);
  const period = preset==="custom"   ? { from: cFrom||undefined, to: cTo||undefined }
               : preset==="upcoming" ? { from: todayStr, to: undefined as string|undefined } // 예정 매출: 오늘 이후 촬영일(미래 확정건)
               : periodRange(preset);

  // 기간 + 매출인정 상태 필터
  const inPeriod = (b:any) => {
    if (!REVENUE_STATUSES.includes(b.status)) return false;
    if (!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract) return false; // 실물미팅·피팅·오디션 제외
    if (bookingTotal(b) <= 0) return false; // 촬영+계약총액 입력 이후부터 매출 인정
    const d = b.shoot_date || "";
    if (period.from && d < period.from) return false;
    if (period.to && d > period.to) return false;
    return true;
  };
  const rev = bookings.filter(inPeriod).sort((a,b)=>(b.shoot_date||"").localeCompare(a.shoot_date||""));
  // 선택된 모델/고객사가 있으면 해당 대상만, 없으면 전체
  const listed = sel ? rev.filter(b => sel.type==="model" ? b.model_id===sel.id : b.customer_id===sel.id) : rev;
  const realAmt     = listed.filter(b=>b.status==="SETTLED"||b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
  const expectedAmt = listed.reduce((s,b)=>s+bookingTotal(b),0);
  const unpaidAmt   = listed.filter(b=>(b.status==="CONFIRMED"||b.status==="COMPLETED")&&!b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
  const modelPayAmt = listed.reduce((s,b)=>s+bookingModelPay(b,models),0);   // 모델 지급 합계
  const marginAmt   = listed.reduce((s,b)=>s+bookingAgencyFee(b,models),0);  // 에이전시 이익(마진) = 공급가 − 모델 정산기준액

  const exportXlsx = async () => {
    const head = ["섭외ID","촬영일","모델","고객사","프로젝트","유형","상태","입금여부","매출(공급가)","계약금","잔금","모델지급액","매출총이익"];
    const rows = listed.map(b=>[
      b.id||"-",
      b.shoot_date||"-",
      models.find((m:any)=>m.id===b.model_id)?.name||"-",
      customers.find((c:any)=>c.id===b.customer_id)?.name||"-",
      b.project_name||"-",
      b.booking_type||"-",
      STATUS[b.status]?.label||b.status||"-",
      (b.status==="SETTLED"||b.is_paid)?"입금":"미입금",
      bookingTotal(b), b.deposit_amt||0, clientBalance(b), bookingModelPay(b,models), bookingAgencyFee(b,models),
    ]);
    const totalRow = ["합계","","","","","","","", listed.reduce((s,b)=>s+bookingTotal(b),0), listed.reduce((s,b)=>s+(b.deposit_amt||0),0), listed.reduce((s,b)=>s+clientBalance(b),0), modelPayAmt, marginAmt];
    const who = sel ? `_${sel.name}` : "";
    try { await exportAoaXlsx([head, ...rows, totalRow], `매출${who}_${preset}_${new Date().toISOString().slice(0,10)}.xlsx`, "매출현황", [20,12,14,16,16,9,11,10,14,12,12,13,13]); }
    catch (e) { alert("엑셀 생성 실패: " + String(e)); }
  };

  const cards = [
    { label:"예상매출 (확정 포함)", value:expectedAmt, color:C.yellow },
    { label:"실매출 (입금 완료)", value:realAmt,     color:C.green },
    { label:"미수금 (확정·미입금)", value:unpaidAmt,   color:C.red },
    { label:"모델 지급 (예상)",    value:modelPayAmt, color:"#c9a96e" },
    { label:"매출총이익",          value:marginAmt,   color:C.blue },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><Coins size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 매출 현황</h1>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={()=>setShowStmt(true)} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:`1px solid ${C.blue}`, background:C.blue+"18", color:C.blue, fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
            📑 거래명세서 / 청구
          </button>
          <button onClick={exportXlsx} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
            <Download size={14}/> 엑셀 다운로드
          </button>
        </div>
      </div>

      {showStmt && <ClientStatementModal bookings={bookings} customers={customers} models={models} agency={agency} isMobile={isMobile} onClose={()=>setShowStmt(false)} />}

      {/* 기간 필터 (칩) */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        {([["month","이번 달"],["lastmonth","지난 달"],["3m","3개월"],["6m","6개월"],["1y","12개월"],["upcoming","예정"],["custom","기간 설정"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setPreset(k)} style={{ padding:"6px 16px", borderRadius:20, border:`1px solid ${preset===k?C.blue:C.border}`, background:preset===k?C.blue+"22":"transparent", color:preset===k?C.blue:C.muted, fontSize:13, fontWeight:preset===k?700:500, cursor:"pointer" }}>{l}</button>
        ))}
        {preset==="custom"&&(
          <span style={{ display:"flex", alignItems:"center", gap:6, ...(isMobile?{width:"100%", marginTop:6}:{}) }}>
            <input type="date" value={cFrom} onChange={e=>setCFrom(e.target.value)} style={{ ...inp, marginBottom:0, width:isMobile?undefined:"auto", flex:isMobile?1:undefined, minWidth:0, padding:"5px 8px", fontSize:12 }} />
            <span style={{ color:C.muted }}>~</span>
            <input type="date" value={cTo} onChange={e=>setCTo(e.target.value)} style={{ ...inp, marginBottom:0, width:isMobile?undefined:"auto", flex:isMobile?1:undefined, minWidth:0, padding:"5px 8px", fontSize:12 }} />
          </span>
        )}
      </div>
      {preset==="upcoming" && <p style={{ margin:"-4px 0 14px", fontSize:12, color:C.muted }}>📅 오늘 이후 촬영 예정인 확정 섭외의 <b style={{ color:C.textSub }}>예정 매출</b>입니다. 실제 매출은 촬영·입금 후 해당 월에 반영됩니다.</p>}

      {/* 매출 요약 카드 */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(5,minmax(0,1fr))", gap:12, marginBottom:18 }}>
        {cards.map(c=>(
          <div key={c.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px", ...(isMobile&&c.label==="매출총이익"?{ gridColumn:"1 / -1" }:{}) }}>
            <p style={{ margin:0, fontSize:12, color:C.muted }}>{c.label}</p>
            <p style={{ margin:"8px 0 0", fontSize:isMobile?(c.label==="매출총이익"?20:16):22, fontWeight:400, color:c.color, whiteSpace:"nowrap", textAlign:"right" }}>{Number(c.value||0).toLocaleString("ko-KR")}<span style={{ fontSize:isMobile?12:14, fontWeight:400, marginLeft:1, opacity:0.8 }}>원</span></p>
          </div>
        ))}
      </div>

      {/* 랭킹 탭 */}
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {([["customer","고객사별"],["model","모델별"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>{ setTab(k); setSel(null); }} style={{ padding:"7px 18px", borderRadius:8, border:`2px solid ${tab===k?C.blue:C.border}`, background:tab===k?C.blue+"22":C.card, color:tab===k?C.blue:C.textSub, fontSize:13, fontWeight:700, cursor:"pointer" }}>{l} 매출 순위</button>
        ))}
      </div>
      <p style={{ margin:"0 0 8px", fontSize:12, color:C.muted }}>아래 순위에서 {tab==="customer"?"고객사":"모델"}를 클릭하면 해당 매출 내역만 모아 보고 엑셀로 받을 수 있어요.</p>
      {tab==="customer"
        ? <RevenueRanking items={customers} bookings={bookings} idKey="customer_id" basis="expected" period={period} onSelect={(c:any)=>setSel({ type:"customer", id:c.id, name:c.name })} isMobile={isMobile} />
        : <RevenueRanking items={models} bookings={bookings} idKey="model_id" basis="expected" period={period} onSelect={(m:any)=>setSel({ type:"model", id:m.id, name:m.name })} showThumb isMobile={isMobile} />}

      {/* 건별 매출 내역 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, margin:"22px 0 10px", flexWrap:"wrap" }}>
        <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.text }}>
          {sel ? `${sel.name} 매출 내역` : "건별 매출 내역"} ({listed.length}건)
        </p>
        {sel && <button onClick={()=>setSel(null)} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${C.border}`, background:"transparent", color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>✕ 전체 보기</button>}
      </div>
      {listed.length===0 ? <p style={{ color:C.muted }}>{preset==="upcoming"?"예정된(미래 촬영일) 확정 섭외가 없습니다.":"이 기간에 매출이 없습니다."}</p> : (
        <div style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", background:C.card }}>
          {!isMobile && (
            <div style={{ display:"grid", gridTemplateColumns:GRID, alignItems:"center", gap:14, fontSize:11, fontWeight:700, color:C.muted, padding:"9px 16px", background:C.card2, borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>
              <span>모델 → 고객사</span>
              <span>프로젝트</span>
              <span>촬영일</span>
              <span>상태</span>
              <span style={{ textAlign:"right" }}>매출 · 총이익</span>
              <span>입금</span>
            </div>
          )}
          {(()=>{
            let first=true; const top=()=>{ const t=first?"none":`1px solid ${C.border}`; first=false; return t; };
            return listed.map(b=>{
              const bt=top();
              const mName=models.find((m:any)=>m.id===b.model_id)?.name||"?";
              const cName=customers.find((c:any)=>c.id===b.customer_id)?.name||"?";
              const payBadge=<span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, whiteSpace:"nowrap", color:b.is_paid?C.green:C.red, background:(b.is_paid?C.green:C.red)+"1a", justifySelf:"start" }}>{b.is_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 입금</>:"고객사 미입금"}</span>;
              if (isMobile) return (
                <div key={b.id} onClick={()=>onSelectBooking(b)} style={{ padding:"10px 14px", borderTop:bt, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:12, color:C.textSub, fontWeight:700, whiteSpace:"nowrap", flexShrink:0 }}>{fmtDate(b.shoot_date)}</span>
                    <span style={{ fontSize:13, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0, flex:1 }}>
                      {mName} <span style={{ color:C.muted }}>→ {cName}</span>
                    </span>
                    <span style={{ fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap", flexShrink:0 }}>{bookingTotal(b).toLocaleString()}원</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    {payBadge}
                    <Badge code={b.status} />
                    <span style={{ marginLeft:"auto", fontSize:11, color:C.blue, whiteSpace:"nowrap" }}>총이익 {bookingAgencyFee(b,models).toLocaleString()}원</span>
                  </div>
                </div>
              );
              return (
                <div key={b.id} onClick={()=>onSelectBooking(b)}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.card2)}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  style={{ display:"grid", gridTemplateColumns:GRID, alignItems:"center", gap:14, padding:"11px 16px", borderTop:bt, cursor:"pointer", transition:"background 0.12s" }}>
                  <span style={{ fontSize:13.5, color:C.text, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0 }}>{mName} <span style={{ color:C.muted, fontWeight:400 }}>→ {cName}</span></span>
                  <span style={{ fontSize:12.5, color:C.blue, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0 }}>{b.project_name || ""}</span>
                  <span style={{ fontSize:12.5, color:C.textSub, fontWeight:700, whiteSpace:"nowrap" }}>{fmtDate(b.shoot_date)}</span>
                  <span style={{ display:"flex" }}><Badge code={b.status} /></span>
                  <span style={{ whiteSpace:"nowrap", textAlign:"right" }}>
                    <span style={{ fontSize:13.5, fontWeight:800, color:C.text }}>{bookingTotal(b).toLocaleString()}원</span>
                    <span style={{ fontSize:11, color:C.blue, marginLeft:8 }}>총이익 {bookingAgencyFee(b,models).toLocaleString()}원</span>
                  </span>
                  {payBadge}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
