import { useState } from "react";
import { C, inp } from "../theme";
import { fmt, fmtDate, bookingTotal, bookingModelPay } from "../lib/utils";
import Badge from "../components/Badge";
import { Coins, User, Folder, CheckCircle2 } from "../components/icons";

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
      {(filteredSettlement.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (()=>{
        // ── Vercel식 정렬 리스트: 하나의 컨테이너 안 얇은 divider 행 · 고정 컬럼 정렬 · hover 하이라이트 ──
        // 계산식·탭분류·발급버튼·입금/지급 토글 핸들러는 일절 변경하지 않음 — 행 레이아웃만 통일.
        let first=true;
        const top=()=>{ const t=first?"none":`1px solid ${C.border}`; first=false; return t; };
        const avatar=(model:any, size:number)=> model?.thumb_url
          ? <img src={model.thumb_url} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
          : <span style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:size*0.42, flexShrink:0 }}>{(model?.name||"?")[0]}</span>;
        const payBadges=(b:any)=>(
          <>
            <Badge code={b.status} type={b.booking_type} />
            <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, whiteSpace:"nowrap", color:b.is_paid?C.green:C.red, background:(b.is_paid?C.green:C.red)+"1a" }}>{b.is_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 입금</>:"고객사 미입금"}</span>
            <span style={{ fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:6, whiteSpace:"nowrap", color:b.model_paid?"#c9a96e":C.muted, background:(b.model_paid?"#c9a96e":C.muted)+"1a" }}>{b.model_paid?<><CheckCircle2 size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델 지급</>:"모델 미지급"}</span>
          </>
        );
        return (
          <div style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", background:C.card }}>
            {filteredSettlement.map(b=>{
              const model = models.find((m:any)=>m.id===b.model_id);
              const client = customers.find((c:any)=>c.id===b.customer_id);
              const fee=bookingTotal(b), pay=bookingModelPay(b,models);
              const bt=top();
              if (isMobile) return (
                <div key={b.id} onClick={()=>openSettlement(b)} style={{ padding:"10px 14px", borderTop:bt, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                    {avatar(model,24)}
                    <strong style={{ flex:1, minWidth:0, fontSize:14, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{model?.name||"?"} <span style={{ color:C.muted, fontWeight:400 }}>→ {client?.name||"?"}</span></strong>
                    {fee>0&&<span style={{ marginLeft:"auto", fontSize:13.5, fontWeight:800, color:C.text, whiteSpace:"nowrap", flexShrink:0 }}>{fee.toLocaleString()}원</span>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:C.textSub, fontWeight:700, whiteSpace:"nowrap" }}>{fmtDate(b.shoot_date)}</span>
                    {b.project_name&&<span style={{ fontSize:12, color:C.blue, whiteSpace:"nowrap" }}><Folder size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.project_name}</span>}
                    {payBadges(b)}
                  </div>
                  {fee>0&&<div style={{ fontSize:11, color:C.green, marginTop:4 }}>모델 실지급 {pay.toLocaleString()}원</div>}
                </div>
              );
              return (
                <div key={b.id} onClick={()=>openSettlement(b)}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.card2)}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  style={{ display:"grid", gridTemplateColumns:"minmax(0,420px) auto 1fr max-content max-content", alignItems:"center", gap:14, padding:"11px 16px", borderTop:bt, cursor:"pointer", transition:"background 0.12s" }}>
                  {/* 모델 → 고객사 (+프로젝트) */}
                  <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    {avatar(model,28)}
                    <span style={{ minWidth:0, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                      <strong style={{ fontSize:13.5, fontWeight:700, color:C.text }}>{model?.name||"?"}</strong>
                      <span style={{ fontSize:12.5, color:C.muted }}> → {client?.name||"?"}</span>
                      {b.project_name&&<span style={{ fontSize:12.5, color:C.blue }}> · <Folder size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.project_name}</span>}
                    </span>
                  </span>
                  {/* 촬영일 */}
                  <span style={{ fontSize:12.5, color:C.textSub, fontWeight:600, whiteSpace:"nowrap" }}>{fmtDate(b.shoot_date)}</span>
                  {/* 1fr spacer */}
                  <span aria-hidden />
                  {/* 금액 (우측 정렬 · NO CLIP) */}
                  <span style={{ textAlign:"right", whiteSpace:"nowrap" }}>
                    {fee>0?(<>
                      <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{fee.toLocaleString()}원</div>
                      <div style={{ fontSize:11, color:C.green, marginTop:3 }}>모델 실지급 {pay.toLocaleString()}원</div>
                    </>):<span style={{ fontSize:13, color:C.muted }}>—</span>}
                  </span>
                  {/* 상태 · 입금/지급 배지 (맨 오른쪽) */}
                  <span style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"flex-end" }}>{payBadges(b)}</span>
                </div>
              );
            })}
          </div>
        );
      })())}
    </div>
  );
}
