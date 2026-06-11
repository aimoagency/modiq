import { C } from "../theme";
import { PLANS, PLAN_FEATURES } from "../constants";
import { PartyPopper } from "../components/icons";

export default function PlanView({ agency, myRole, planBilling, setPlanBilling, handleChangePlan }: {
  agency: any; myRole: string; planBilling: "monthly"|"yearly";
  setPlanBilling: (v:"monthly"|"yearly")=>void; handleChangePlan: (id:string)=>void;
}) {
  return (
    <div>
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <h1 style={{ margin:"0 0 8px", fontSize:28, fontWeight:900, color:C.text }}>요금제 선택</h1>
        <p style={{ margin:"0 0 20px", fontSize:14, color:C.muted }}>에이전시 규모에 맞는 요금제를 선택하세요</p>
        <div style={{ display:"inline-flex", background:"var(--c-card2)", borderRadius:8, padding:4, gap:4 }}>
          {["monthly","yearly"].map(t=>(
            <button key={t} onClick={()=>setPlanBilling(t as "monthly"|"yearly")} style={{ padding:"7px 20px", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:13, transition:"all 0.2s", background:planBilling===t?"white":"transparent", color:planBilling===t?"#111":C.muted }}>
              {t==="monthly"?"월간":"연간"}
            </button>
          ))}
        </div>
        {planBilling==="yearly"&&<p style={{ margin:"10px 0 0", fontSize:13, color:C.green, fontWeight:600 }}><PartyPopper size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 연간 결제 시 최대 28% 할인</p>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, maxWidth:900, margin:"0 auto" }}>
        {PLANS.map(plan=>{
          const isCurrent=agency.plan===plan.id;
          const cfg=PLAN_FEATURES[plan.id];
          const price=planBilling==="yearly"?plan.priceYearly:plan.price;
          return (
            <div key={plan.id} style={{ background:"var(--c-card)", border:`1px solid ${isCurrent?plan.color:plan.popular?plan.color+"80":C.border}`, borderRadius:14, padding:28, position:"relative", boxShadow:isCurrent?`0 0 0 2px ${plan.color}40`:plan.popular?`0 8px 32px ${plan.color}20`:"none", transition:"transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 12px 40px ${plan.color}25`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=isCurrent?`0 0 0 2px ${plan.color}40`:plan.popular?`0 8px 32px ${plan.color}20`:"none";}}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <h3 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text }}>{plan.name}</h3>
                <div style={{ display:"flex", gap:6 }}>
                  {plan.popular&&!isCurrent&&<span style={{ background:plan.color, color:"white", fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:20 }}>POPULAR</span>}
                  {isCurrent&&<span style={{ background:plan.color+"22", color:plan.color, border:`1px solid ${plan.color}`, fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20 }}>현재 플랜</span>}
                </div>
              </div>
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                  <span style={{ fontSize:40, fontWeight:900, color:C.text, lineHeight:1 }}>{(price/10000).toFixed(0)}만</span>
                  <span style={{ fontSize:16, color:C.muted }}>원</span>
                </div>
                <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>{planBilling==="yearly"?"월 환산 · 연간 결제":"매월 청구"}</p>
              </div>
              {myRole==="owner"&&(
                <button onClick={()=>handleChangePlan(plan.id)} disabled={isCurrent} style={{ width:"100%", padding:"12px 0", border:"none", borderRadius:8, cursor:isCurrent?"not-allowed":"pointer", fontWeight:700, fontSize:14, marginBottom:22, transition:"opacity 0.2s", background:isCurrent?"#2a2d3e":plan.color, color:isCurrent?C.muted:"white", opacity:isCurrent?0.7:1 }}>
                  {isCurrent?"현재 요금제":"시작하기"}
                </button>
              )}
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:18 }}>
                <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:700, color:C.textSub }}>포함 기능:</p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {plan.features.map((f,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill={plan.color+"22"}/><path d="M5 8l2 2 4-4" stroke={plan.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize:13, color:C.textSub }}>{f}</span>
                    </div>
                  ))}
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill={plan.color+"22"}/><path d="M5 8l2 2 4-4" stroke={plan.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ fontSize:13, color:C.textSub }}>추가 담당자 {cfg.additionalPrice.toLocaleString()}원/명</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ textAlign:"center", marginTop:28, fontSize:12, color:C.muted }}>모든 요금제는 14일 무료 체험 후 결제됩니다 · 언제든지 변경/해지 가능</p>
    </div>
  );
}
