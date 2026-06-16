import { useState } from "react";
import { C, inp } from "../theme";
import { fmt, fmtDate, bookingTotal, bookingAgencyFee, bookingModelPay } from "../lib/utils";
import Badge from "../components/Badge";
import { Coins, Calendar, User, Folder, CheckCircle2 } from "../components/icons";

export default function SettlementView({ settlementTab, setSettlementTab, settlementMonth, setSettlementMonth, settlementMonths, settlementModel, setSettlementModel, settlementClient, setSettlementClient, settlementSummary, filteredSettlement, models, customers, openSettlement, onOpenStatement, isMobile = false }: {
  settlementTab: "PENDING"|"SETTLED"|"UNPAID"; setSettlementTab: (v:"PENDING"|"SETTLED"|"UNPAID")=>void;
  settlementMonth: string; setSettlementMonth: (v:string)=>void; settlementMonths: string[];
  settlementModel: string; setSettlementModel: (v:string)=>void;
  settlementClient: string; setSettlementClient: (v:string)=>void;
  settlementSummary: { total:number; commission:number; modelPay:number; clientPaid:number; clientUnpaid:number; modelPaidAmt:number; modelUnpaidAmt:number };
  filteredSettlement: any[]; models: any[]; customers: any[];
  openSettlement: (b:any)=>void;
  onOpenStatement?: ()=>void;
  isMobile?: boolean;
}) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"0 0 20px" }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><Coins size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 정산 관리</h1>
        {onOpenStatement&&<button onClick={onOpenStatement} style={{ padding:"7px 14px", background:C.green, color:"white", border:"none", borderRadius:8, fontWeight:700, fontSize:13, cursor:"pointer" }}>📑 정산 내역서 · 엑셀</button>}
      </div>
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
        <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={settlementClient} onChange={e=>setSettlementClient(e.target.value)}>
          <option value="ALL">전체 고객사</option>
          {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {/* ── 두 흐름 분리: 받을 돈(고객사) / 줄 돈(모델) ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:isMobile?8:12, marginBottom:10 }}>
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
      {/* 에이전시 마진(수익) */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:12, fontWeight:700, color:C.textSub }}>에이전시 마진 (수익)</span>
        <span style={{ fontSize:16, fontWeight:800, color:C.green }}>{fmt(settlementSummary.commission)}</span>
      </div>
      {(filteredSettlement.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (
        <div style={{ display:"grid", gap:8 }}>
          {filteredSettlement.map(b=>{
            const model = models.find((m:any)=>m.id===b.model_id);
            const client = customers.find((c:any)=>c.id===b.customer_id);
            const fee=bookingTotal(b), pay=bookingModelPay(b,models);
            return (
              <div key={b.id} onClick={()=>openSettlement(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.2s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor=C.yellow)}
                onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
              >
                {/* 아바타 */}
                {model?.thumb_url
                  ? <img src={model.thumb_url} alt="" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  : <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:15, flexShrink:0 }}>{(model?.name||"?")[0]}</div>
                }
                {/* 정보 (좌측) — 매출 리스트와 동일 구조 */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:12, color:C.textSub, fontWeight:700, whiteSpace:"nowrap", flexShrink:0 }}>{fmtDate(b.shoot_date)}</span>
                    <span style={{ fontSize:13, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0 }}>
                      {model?.name||"?"} <span style={{ color:C.muted }}>→ {client?.name||"?"}</span>
                      {b.project_name&&<span style={{ color:C.blue }}> · <Folder size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.project_name}</span>}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <Badge code={b.status} type={b.booking_type} />
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, whiteSpace:"nowrap", color:b.is_paid?C.green:C.red, background:(b.is_paid?C.green:C.red)+"1a" }}>{b.is_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 입금</>:"고객사 미입금"}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, whiteSpace:"nowrap", color:b.model_paid?"#c9a96e":C.muted, background:(b.model_paid?"#c9a96e":C.muted)+"1a" }}>{b.model_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델 지급</>:"모델 미지급"}</span>
                  </div>
                </div>
                {/* 금액 (우측 고정) */}
                {fee>0&&(
                  <div style={{ flexShrink:0, textAlign:"right", whiteSpace:"nowrap" }}>
                    <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{fee.toLocaleString()}원</div>
                    <div style={{ fontSize:11, color:C.green, marginTop:3 }}>모델 실지급 {pay.toLocaleString()}원</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
