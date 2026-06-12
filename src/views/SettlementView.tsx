import { useState } from "react";
import { C, inp } from "../theme";
import { fmt, fmtDate, bookingTotal, bookingAgencyFee, bookingModelPay } from "../lib/utils";
import Badge from "../components/Badge";
import { Coins, Calendar, User, Folder, CheckCircle2 } from "../components/icons";

export default function SettlementView({ settlementTab, setSettlementTab, settlementMonth, setSettlementMonth, settlementMonths, settlementModel, setSettlementModel, settlementMgr, setSettlementMgr, settlementProject, setSettlementProject, settlementProjects, settlementSummary, filteredSettlement, models, customers, memberNames, openSettlement, isMobile = false }: {
  settlementTab: "PENDING"|"SETTLED"|"UNPAID"; setSettlementTab: (v:"PENDING"|"SETTLED"|"UNPAID")=>void;
  settlementMonth: string; setSettlementMonth: (v:string)=>void; settlementMonths: string[];
  settlementModel: string; setSettlementModel: (v:string)=>void;
  settlementMgr: string; setSettlementMgr: (v:string)=>void;
  settlementProject: string; setSettlementProject: (v:string)=>void; settlementProjects: string[];
  settlementSummary: { total:number; commission:number; modelPay:number; clientPaid:number; clientUnpaid:number; modelPaidAmt:number; modelUnpaidAmt:number };
  filteredSettlement: any[]; models: any[]; customers: any[]; memberNames: string[];
  openSettlement: (b:any)=>void;
  isMobile?: boolean;
}) {
  const [view, setView] = useState<"item"|"model"|"client">("item");
  // 모델별/고객사별 집계
  const agg = (keyFn:(b:any)=>string, nameFn:(b:any)=>string) => {
    const map = new Map<string, { name:string; cnt:number; total:number; fee:number; pay:number; paidTotal:number; paidPay:number }>();
    filteredSettlement.forEach(b=>{
      const k = keyFn(b) || "?";
      if(!map.has(k)) map.set(k, { name:nameFn(b)||"?", cnt:0, total:0, fee:0, pay:0, paidTotal:0, paidPay:0 });
      const g = map.get(k)!;
      g.cnt++; g.total += bookingTotal(b); g.fee += bookingAgencyFee(b,models); g.pay += bookingModelPay(b,models);
      if(b.is_paid) g.paidTotal += bookingTotal(b);
      if(b.model_paid) g.paidPay += bookingModelPay(b,models);
    });
    return Array.from(map.values()).sort((a,b)=>b.total-a.total);
  };
  const modelRows  = view==="model"  ? agg(b=>b.model_id, b=>models.find((m:any)=>m.id===b.model_id)?.name) : [];
  const clientRows = view==="client" ? agg(b=>b.customer_id, b=>customers.find((c:any)=>c.id===b.customer_id)?.name) : [];
  const cell = { padding:"10px 12px", fontSize:13, whiteSpace:"nowrap" as const };
  const numCell = { ...cell, textAlign:"right" as const, fontVariantNumeric:"tabular-nums" as const };
  return (
    <div>
      <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:800, color:C.text }}><Coins size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 정산 관리</h1>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {([
          { key:"PENDING", label:"정산대기",   color:C.yellow },
          { key:"SETTLED", label:"정산완료",   color:C.green  },
          { key:"UNPAID",  label:"미입금잔금", color:C.red    },
        ] as const).map(tab=>(
          <button key={tab.key} onClick={()=>setSettlementTab(tab.key)} style={{ padding:"9px 20px", border:`2px solid ${settlementTab===tab.key?tab.color:C.border}`, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13, background:settlementTab===tab.key?tab.color+"22":C.card, color:settlementTab===tab.key?tab.color:C.textSub, transition:"all 0.2s" }}>{tab.label}</button>
        ))}
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:12, marginBottom:14, display:"flex", gap:10, flexWrap:"wrap" }}>
        <select style={{ ...inp, marginBottom:0, flex:"1 1 120px" }} value={settlementMonth} onChange={e=>setSettlementMonth(e.target.value)}>
          <option value="ALL">전체 월</option>
          {settlementMonths.map(m=><option key={m} value={m}>{m.replace("-","년 ")}월</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={settlementModel} onChange={e=>setSettlementModel(e.target.value)}>
          <option value="ALL">전체 모델</option>
          {models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0, flex:"1 1 120px" }} value={settlementMgr} onChange={e=>setSettlementMgr(e.target.value)}>
          <option value="ALL">전체 담당자</option>
          {memberNames.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={settlementProject} onChange={e=>setSettlementProject(e.target.value)}>
          <option value="ALL">전체 프로젝트</option>
          {settlementProjects.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {/* ── 두 흐름 분리: 받을 돈(고객사) / 줄 돈(모델) ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:isMobile?8:12, marginBottom:10 }}>
        {/* 받을 돈 — 고객사 입금 */}
        <div style={{ background:C.card, border:`1px solid ${C.blue}55`, borderRadius:10, padding:16 }}>
          <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:800, color:C.blue }}><Coins size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 입금액</p>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}><span style={{ fontSize:12, color:C.muted }}>총 청구액</span><span style={{ fontSize:15, fontWeight:800, color:C.text }}>{fmt(settlementSummary.total)}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}><span style={{ fontSize:12, color:C.muted }}>입금완료</span><span style={{ fontSize:13, fontWeight:700, color:C.green }}>{fmt(settlementSummary.clientPaid)}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:12, color:C.muted }}>미입금</span><span style={{ fontSize:13, fontWeight:700, color:settlementSummary.clientUnpaid>0?C.red:C.muted }}>{fmt(settlementSummary.clientUnpaid)}</span></div>
        </div>
        {/* 줄 돈 — 모델 지급 */}
        <div style={{ background:C.card, border:`1px solid #c9a96e66`, borderRadius:10, padding:16 }}>
          <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:800, color:"#c9a96e" }}><User size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델 지급액</p>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}><span style={{ fontSize:12, color:C.muted }}>총 지급액</span><span style={{ fontSize:15, fontWeight:800, color:"#c9a96e" }}>{fmt(settlementSummary.modelPay)}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}><span style={{ fontSize:12, color:C.muted }}>지급완료</span><span style={{ fontSize:13, fontWeight:700, color:C.green }}>{fmt(settlementSummary.modelPaidAmt)}</span></div>
          <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:12, color:C.muted }}>미지급</span><span style={{ fontSize:13, fontWeight:700, color:settlementSummary.modelUnpaidAmt>0?C.orange:C.muted }}>{fmt(settlementSummary.modelUnpaidAmt)}</span></div>
        </div>
      </div>
      {/* 에이전시 수수료(수익) */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, fontWeight:700, color:C.textSub }}>에이전시 수수료 (수익)</span>
        <span style={{ fontSize:16, fontWeight:800, color:C.green }}>{fmt(settlementSummary.commission)}</span>
      </div>
      {/* 보기 전환: 건별 / 모델별 / 고객사별 */}
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {([["item","건별"],["model","모델별"],["client","고객사별"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{ padding:"7px 16px", borderRadius:8, border:`1px solid ${view===k?C.blue:C.border}`, background:view===k?C.blue+"22":C.card, color:view===k?C.blue:C.textSub, fontWeight:700, fontSize:13, cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {/* 모델별 집계 */}
      {view==="model"&&(modelRows.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr .6fr 1fr 1fr 1fr", background:C.card2, borderBottom:`1px solid ${C.border}`, fontWeight:700, color:C.textSub, fontSize:12, minWidth:520 }}>
            <span style={cell}>모델</span><span style={numCell}>건수</span><span style={numCell}>총촬영비</span><span style={numCell}>수수료</span><span style={numCell}>모델지급</span>
          </div>
          {modelRows.map((r,i)=>(
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1.6fr .6fr 1fr 1fr 1fr", borderBottom:`1px solid ${C.border}`, alignItems:"center", minWidth:520 }}>
              <span style={{ ...cell, color:C.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis" }}>{r.name}</span>
              <span style={numCell}>{r.cnt}건</span>
              <span style={{ ...numCell, color:C.text, fontWeight:700 }}>{fmt(r.total)}</span>
              <span style={{ ...numCell, color:C.blue }}>{fmt(r.fee)}</span>
              <span style={{ ...numCell, color:"#c9a96e", fontWeight:700 }}>{fmt(r.pay)}</span>
            </div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr .6fr 1fr 1fr 1fr", background:C.card2, fontWeight:800, minWidth:520 }}>
            <span style={{ ...cell, color:C.text }}>합계</span><span style={numCell}>{modelRows.reduce((s,r)=>s+r.cnt,0)}건</span>
            <span style={{ ...numCell, color:C.text }}>{fmt(modelRows.reduce((s,r)=>s+r.total,0))}</span>
            <span style={{ ...numCell, color:C.blue }}>{fmt(modelRows.reduce((s,r)=>s+r.fee,0))}</span>
            <span style={{ ...numCell, color:"#c9a96e" }}>{fmt(modelRows.reduce((s,r)=>s+r.pay,0))}</span>
          </div>
        </div>
      ))}

      {/* 고객사별 집계 */}
      {view==="client"&&(clientRows.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr .6fr 1fr 1fr 1fr", background:C.card2, borderBottom:`1px solid ${C.border}`, fontWeight:700, color:C.textSub, fontSize:12, minWidth:520 }}>
            <span style={cell}>고객사</span><span style={numCell}>건수</span><span style={numCell}>총 청구액</span><span style={numCell}>입금완료</span><span style={numCell}>미입금</span>
          </div>
          {clientRows.map((r,i)=>(
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1.6fr .6fr 1fr 1fr 1fr", borderBottom:`1px solid ${C.border}`, alignItems:"center", minWidth:520 }}>
              <span style={{ ...cell, color:C.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis" }}>{r.name}</span>
              <span style={numCell}>{r.cnt}건</span>
              <span style={{ ...numCell, color:C.text, fontWeight:700 }}>{fmt(r.total)}</span>
              <span style={{ ...numCell, color:C.green }}>{fmt(r.paidTotal)}</span>
              <span style={{ ...numCell, color:(r.total-r.paidTotal)>0?C.red:C.muted }}>{fmt(r.total-r.paidTotal)}</span>
            </div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr .6fr 1fr 1fr 1fr", background:C.card2, fontWeight:800, minWidth:520 }}>
            <span style={{ ...cell, color:C.text }}>합계</span><span style={numCell}>{clientRows.reduce((s,r)=>s+r.cnt,0)}건</span>
            <span style={{ ...numCell, color:C.text }}>{fmt(clientRows.reduce((s,r)=>s+r.total,0))}</span>
            <span style={{ ...numCell, color:C.green }}>{fmt(clientRows.reduce((s,r)=>s+r.paidTotal,0))}</span>
            <span style={{ ...numCell, color:C.red }}>{fmt(clientRows.reduce((s,r)=>s+(r.total-r.paidTotal),0))}</span>
          </div>
        </div>
      ))}

      {view==="item"&&(filteredSettlement.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (
        <div style={{ display:"grid", gap:8 }}>
          {filteredSettlement.map(b=>{
            const model = models.find((m:any)=>m.id===b.model_id);
            const client = customers.find((c:any)=>c.id===b.customer_id);
            const fee=bookingTotal(b), comm=bookingAgencyFee(b,models);
            return (
              <div key={b.id} onClick={()=>openSettlement(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, cursor:"pointer", display:"flex", alignItems:"center", gap:14, transition:"border-color 0.2s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor=C.yellow)}
                onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
              >
                {/* 아바타 */}
                {model?.thumb_url
                  ? <img src={model.thumb_url} alt="" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  : <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:15, flexShrink:0 }}>{(model?.name||"?")[0]}</div>
                }
                {/* 정보 */}
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ color:C.text, fontWeight:700, fontSize:14 }}>{model?.name||"?"}</span>
                    <span style={{ color:C.muted, fontSize:12 }}>· {client?.name||"?"}</span>
                    {b.project_name&&<span style={{ color:C.blue, fontSize:12 }}><Folder size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.project_name}</span>}
                  </div>
                  <span style={{ color:C.muted, fontSize:12 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)}  <User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.manager||"-"}</span>
                </div>
                {/* 금액 */}
                {fee>0&&(
                  <div style={{ textAlign:"right" }}>
                    <p style={{ margin:0, color:"#e8d5b7", fontWeight:800, fontSize:16 }}>{fee.toLocaleString()}원</p>
                    <p style={{ margin:"2px 0 0", color:C.green, fontSize:12 }}>수령액 {(fee-comm).toLocaleString()}원</p>
                  </div>
                )}
                <Badge code={b.status} type={b.booking_type} />
                {/* 두 흐름 상태 칩 */}
                <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0, alignItems:"flex-end" }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, whiteSpace:"nowrap", color:b.is_paid?C.green:C.red, background:(b.is_paid?C.green:C.red)+"1a" }}>{b.is_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 입금</>:"고객사 미입금"}</span>
                  <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, whiteSpace:"nowrap", color:b.model_paid?"#c9a96e":C.muted, background:(b.model_paid?"#c9a96e":C.muted)+"1a" }}>{b.model_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델 지급</>:"모델 미지급"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
