import { C, inp, btnS } from "../theme";
import { fmt, fmtDate } from "../lib/utils";
import Badge from "../components/Badge";
import { Coins, Calendar, User, Folder, CheckCircle2 } from "../components/icons";

export default function SettlementView({ settlementTab, setSettlementTab, settlementMonth, setSettlementMonth, settlementMonths, settlementModel, setSettlementModel, settlementMgr, setSettlementMgr, settlementProject, setSettlementProject, settlementProjects, settlementSummary, filteredSettlement, models, customers, memberNames, openSettlement, isMobile = false }: {
  settlementTab: "PENDING"|"SETTLED"|"UNPAID"; setSettlementTab: (v:"PENDING"|"SETTLED"|"UNPAID")=>void;
  settlementMonth: string; setSettlementMonth: (v:string)=>void; settlementMonths: string[];
  settlementModel: string; setSettlementModel: (v:string)=>void;
  settlementMgr: string; setSettlementMgr: (v:string)=>void;
  settlementProject: string; setSettlementProject: (v:string)=>void; settlementProjects: string[];
  settlementSummary: { total:number; commission:number; modelPay:number };
  filteredSettlement: any[]; models: any[]; customers: any[]; memberNames: string[];
  openSettlement: (b:any)=>void;
  isMobile?: boolean;
}) {
  return (
    <div>
      <h1 style={{ margin:"0 0 20px", fontSize:24, fontWeight:800, color:C.text }}><Coins size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 정산 관리</h1>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {([
          { key:"PENDING", label:"정산대기",   color:C.yellow },
          { key:"SETTLED", label:"정산완료",   color:C.green  },
          { key:"UNPAID",  label:"미입금잔금", color:C.red    },
        ] as const).map(tab=>(
          <button key={tab.key} onClick={()=>setSettlementTab(tab.key)} style={{ padding:"9px 20px", border:`2px solid ${settlementTab===tab.key?tab.color:C.border}`, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:14, background:settlementTab===tab.key?tab.color+"22":C.card, color:settlementTab===tab.key?tab.color:C.textSub, transition:"all 0.2s" }}>{tab.label}</button>
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
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:isMobile?8:12, marginBottom:14 }}>
        {[
          { label:"총 촬영비",         value:fmt(settlementSummary.total),      color:C.text  },
          { label:"수수료 (15%)",       value:fmt(settlementSummary.commission), color:C.blue  },
          { label:"모델 수령액 (85%)", value:fmt(settlementSummary.modelPay),   color:C.green },
        ].map(item=>(
          <div key={item.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, textAlign:"center" }}>
            <p style={{ margin:0, fontSize:12, color:C.muted }}>{item.label}</p>
            <p style={{ margin:"8px 0 0", fontSize:19, fontWeight:800, color:item.color }}>{item.value}</p>
          </div>
        ))}
      </div>
      {filteredSettlement.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (
        <div style={{ display:"grid", gap:8 }}>
          {filteredSettlement.map(b=>{
            const model = models.find((m:any)=>m.id===b.model_id);
            const client = customers.find((c:any)=>c.id===b.customer_id);
            const fee=b.shoot_fee||0, comm=Math.round(fee*0.15);
            return (
              <div key={b.id} onClick={()=>openSettlement(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, cursor:"pointer", display:"flex", alignItems:"center", gap:14, transition:"border-color 0.2s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor=C.yellow)}
                onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
              >
                {/* 아바타 */}
                {model?.thumb_url
                  ? <img src={model.thumb_url} alt="" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  : <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:17, flexShrink:0 }}>{(model?.name||"?")[0]}</div>
                }
                {/* 정보 */}
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ color:C.text, fontWeight:700, fontSize:15 }}>{model?.name||"?"}</span>
                    <span style={{ color:C.muted, fontSize:13 }}>· {client?.name||"?"}</span>
                    {b.project_name&&<span style={{ color:C.blue, fontSize:13 }}><Folder size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.project_name}</span>}
                  </div>
                  <span style={{ color:C.muted, fontSize:13 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)}  <User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.manager||"-"}</span>
                </div>
                {/* 금액 */}
                {fee>0&&(
                  <div style={{ textAlign:"right" }}>
                    <p style={{ margin:0, color:"#e8d5b7", fontWeight:800, fontSize:18 }}>{fee.toLocaleString()}원</p>
                    <p style={{ margin:"2px 0 0", color:C.green, fontSize:13 }}>수령액 {(fee-comm).toLocaleString()}원</p>
                  </div>
                )}
                <Badge code={b.status} type={b.booking_type} />
                {/* 정산처리 버튼 */}
                {!b.is_paid&&(
                  <button onClick={e=>{ e.stopPropagation(); openSettlement(b); }} style={{ ...btnS(C.green), padding:"6px 14px", fontSize:13, flexShrink:0 }}>정산처리</button>
                )}
                {b.is_paid&&<span style={{ color:C.green, fontSize:13, fontWeight:700, flexShrink:0 }}><CheckCircle2 size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 완료</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
