import { useState } from "react";
import { C, inp } from "../theme";
import { Coins, Download } from "../components/icons";
import { fmt, fmtDate, periodRange, REVENUE_STATUSES, bookingTotal } from "../lib/utils";
import RevenueRanking from "../components/RevenueRanking";
import Badge from "../components/Badge";
import { exportAoaXlsx } from "../lib/xlsx";

export default function RevenueView({ bookings, models, customers, isMobile = false, onSelectBooking }: {
  bookings: any[]; models: any[]; customers: any[]; isMobile?: boolean; onSelectBooking: (b:any)=>void;
}) {
  const [preset, setPreset] = useState("3m");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [tab, setTab] = useState<"customer"|"model">("customer");
  const [sel, setSel] = useState<{ type:"model"|"customer"; id:string; name:string } | null>(null); // 선택된 모델/고객사
  const period = preset==="custom" ? { from: cFrom||undefined, to: cTo||undefined } : periodRange(preset);

  // 기간 + 매출인정 상태 필터
  const inPeriod = (b:any) => {
    if (!REVENUE_STATUSES.includes(b.status)) return false;
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

  const exportXlsx = async () => {
    const head = ["촬영일","모델","고객사","프로젝트","상태","입금여부","금액"];
    const rows = listed.map(b=>[
      b.shoot_date||"", models.find((m:any)=>m.id===b.model_id)?.name||"",
      customers.find((c:any)=>c.id===b.customer_id)?.name||"", b.project_name||"",
      b.status, (b.status==="SETTLED"||b.is_paid)?"입금":"미입금", bookingTotal(b),
    ]);
    const totalRow = ["합계","","","","","", listed.reduce((s,b)=>s+bookingTotal(b),0)];
    const who = sel ? `_${sel.name}` : "";
    try { await exportAoaXlsx([head, ...rows, totalRow], `매출${who}_${preset}_${new Date().toISOString().slice(0,10)}.xlsx`, "매출현황", [12,14,16,16,12,10,14]); }
    catch (e) { alert("엑셀 생성 실패: " + String(e)); }
  };

  const cards = [
    { label:"실매출 (입금 완료)", value:realAmt,     color:C.green },
    { label:"예상매출 (확정 포함)", value:expectedAmt, color:C.yellow },
    { label:"미수금 (확정·미입금)", value:unpaidAmt,   color:C.red },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><Coins size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 매출 현황</h1>
        <button onClick={exportXlsx} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSub, fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
          <Download size={14}/> 엑셀 다운로드
        </button>
      </div>

      {/* 기간 필터 (칩) */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        {([["month","이번 달"],["lastmonth","지난 달"],["3m","3개월"],["6m","6개월"],["1y","12개월"],["custom","기간 설정"]] as const).map(([k,l])=>(
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

      {/* 매출 요약 카드 */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:12, marginBottom:18 }}>
        {cards.map(c=>(
          <div key={c.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px" }}>
            <p style={{ margin:0, fontSize:12, color:C.muted }}>{c.label}</p>
            <p style={{ margin:"8px 0 0", fontSize:22, fontWeight:800, color:c.color }}>{fmt(c.value)}</p>
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
        ? <RevenueRanking items={customers} bookings={bookings} idKey="customer_id" basis="expected" period={period} onSelect={(c:any)=>setSel({ type:"customer", id:c.id, name:c.name })} />
        : <RevenueRanking items={models} bookings={bookings} idKey="model_id" basis="expected" period={period} onSelect={(m:any)=>setSel({ type:"model", id:m.id, name:m.name })} showThumb />}

      {/* 건별 매출 내역 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, margin:"22px 0 10px", flexWrap:"wrap" }}>
        <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.text }}>
          {sel ? `${sel.name} 매출 내역` : "건별 매출 내역"} ({listed.length}건)
        </p>
        {sel && <button onClick={()=>setSel(null)} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${C.border}`, background:"transparent", color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>✕ 전체 보기</button>}
      </div>
      {listed.length===0 ? <p style={{ color:C.muted }}>이 기간에 매출이 없습니다.</p> : (
        <div style={{ display:"grid", gap:6 }}>
          {listed.map(b=>(
            <div key={b.id} onClick={()=>onSelectBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:12, color:C.textSub, fontWeight:700, whiteSpace:"nowrap" }}>{fmtDate(b.shoot_date)}</span>
              <span style={{ flex:1, minWidth:0, fontSize:13, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {models.find((m:any)=>m.id===b.model_id)?.name||"?"} <span style={{ color:C.muted }}>→ {customers.find((c:any)=>c.id===b.customer_id)?.name||"?"}</span>
              </span>
              <span style={{ fontSize:13, fontWeight:700, color:(b.status==="SETTLED"||b.is_paid)?C.green:C.yellow, whiteSpace:"nowrap" }}>{bookingTotal(b).toLocaleString()}원</span>
              <Badge code={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
