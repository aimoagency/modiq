import { Fragment } from "react";
import { C } from "../theme";
import { PLANS, PLAN_MATRIX, PLAN_TRIAL } from "../constants";
import { PartyPopper, Check, Star } from "../components/icons";

// 머티리얼 스타일 요금제 — 카드형(쉽게 선택) + Team(BEST) 강조 + 하단 기능 비교표.
// 디자인 토큰은 theme C(라이트/다크 CSS 변수)를 사용해 앱 테마와 일관 유지.
export default function PlanView({ agency, myRole, handleChangePlan }: {
  agency: any; myRole: string; planBilling?: "monthly"|"yearly";
  setPlanBilling?: (v:"monthly"|"yearly")=>void; handleChangePlan: (id:string)=>void;
}) {
  const fmtWon = (n:number) => "₩" + n.toLocaleString("ko-KR");
  // 비교표 컬럼(=PLANS 순서) 중 Team(best) 인덱스 — 표에서 강조할 열
  const bestCol = PLANS.findIndex(p=>p.best); // 0-based among value columns

  return (
    <div style={{ maxWidth:1140, margin:"0 auto", padding:"0 4px 8px" }}>
      {/* ── 헤더 ── */}
      <div style={{ textAlign:"center", marginBottom:22 }}>
        <h1 style={{ margin:"0 0 8px", fontSize:30, fontWeight:900, letterSpacing:"-0.5px", color:C.text }}>요금제 선택</h1>
        <p style={{ margin:"0 0 16px", fontSize:14.5, color:C.muted }}>에이전시 규모에 맞는 요금제를 선택하세요</p>
        {/* 무료 체험 배너(머티리얼 칩) */}
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"9px 18px", borderRadius:999,
          background:`linear-gradient(135deg, ${C.green}1f, ${C.blue}1f)`, border:`1px solid ${C.green}55`,
          color:C.text, fontSize:13.5, fontWeight:700 }}>
          <PartyPopper size={15} style={{ verticalAlign:-2, flexShrink:0 }}/>
          {PLAN_TRIAL.days}일 무료 체험 · 전 기능 · 카드 불필요 · 담당자 {PLAN_TRIAL.members}명
        </div>
      </div>

      {/* ── 카드 ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(232px,1fr))", gap:16, alignItems:"stretch", marginBottom:14 }}>
        {PLANS.map(plan=>{
          const isCurrent = agency?.plan===plan.id;
          const best = plan.best;
          return (
            <div key={plan.id} style={{
              position:"relative", display:"flex", flexDirection:"column",
              background:best?`linear-gradient(180deg, ${plan.color}12, var(--c-card))`:"var(--c-card)",
              border:`${best?2:1}px solid ${isCurrent?plan.color:best?plan.color:C.border}`,
              borderRadius:18, padding:best?"30px 22px 24px":"26px 22px 24px",
              marginTop:best?0:6,
              boxShadow:best?`0 16px 40px -8px ${plan.color}55, 0 2px 8px rgba(0,0,0,0.18)`:"0 1px 3px rgba(0,0,0,0.16)",
              transform:best?"translateY(-6px)":"none",
              transition:"transform 0.18s ease, box-shadow 0.18s ease",
            }}
              onMouseEnter={e=>{ e.currentTarget.style.transform = best?"translateY(-10px)":"translateY(-4px)"; e.currentTarget.style.boxShadow = best?`0 22px 50px -8px ${plan.color}66, 0 4px 12px rgba(0,0,0,0.22)`:`0 10px 26px -6px ${plan.color}40`; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform = best?"translateY(-6px)":"none"; e.currentTarget.style.boxShadow = best?`0 16px 40px -8px ${plan.color}55, 0 2px 8px rgba(0,0,0,0.18)`:"0 1px 3px rgba(0,0,0,0.16)"; }}
            >
              {/* BEST 리본 */}
              {best && (
                <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", whiteSpace:"nowrap",
                  display:"inline-flex", alignItems:"center", gap:5, padding:"6px 16px", borderRadius:999,
                  background:plan.color, color:"#fff", fontSize:12, fontWeight:900, letterSpacing:"0.3px",
                  boxShadow:`0 6px 16px -2px ${plan.color}88` }}>
                  <Star size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> BEST · 가장 인기
                </div>
              )}
              {isCurrent && (
                <span style={{ position:"absolute", top:14, right:14, background:plan.color+"22", color:plan.color,
                  border:`1px solid ${plan.color}`, fontSize:10.5, fontWeight:800, padding:"3px 9px", borderRadius:999 }}>현재 플랜</span>
              )}

              {/* 이름 + 태그라인 */}
              <h3 style={{ margin:"6px 0 3px", fontSize:21, fontWeight:900, color:best?plan.color:C.text }}>{plan.name}</h3>
              <p style={{ margin:"0 0 16px", fontSize:12, color:C.muted, minHeight:32, lineHeight:1.4 }}>{plan.tagline}</p>

              {/* 가격 */}
              <div style={{ display:"flex", alignItems:"baseline", gap:3, marginBottom:6 }}>
                <span style={{ fontSize:34, fontWeight:900, color:C.text, lineHeight:1, letterSpacing:"-1px" }}>{fmtWon(plan.price)}</span>
                <span style={{ fontSize:14, color:C.muted, fontWeight:600 }}>/월</span>
              </div>
              {/* 담당자 칩 */}
              <div style={{ display:"inline-flex", alignSelf:"flex-start", alignItems:"center", gap:5, padding:"4px 11px",
                borderRadius:999, background:plan.color+"18", color:plan.color, fontSize:12, fontWeight:800, marginBottom:18 }}>
                담당자 {plan.members}명
              </div>

              {/* CTA */}
              {myRole==="owner" && (
                <button onClick={()=>!isCurrent && handleChangePlan(plan.id)} disabled={isCurrent}
                  style={{ width:"100%", padding:"13px 0", border:best?"none":`1.5px solid ${plan.color}`, borderRadius:10,
                    cursor:isCurrent?"default":"pointer", fontWeight:800, fontSize:14.5, marginBottom:20,
                    background:isCurrent?"var(--c-card2)":best?plan.color:"transparent",
                    color:isCurrent?C.muted:best?"#fff":plan.color,
                    boxShadow:best&&!isCurrent?`0 6px 16px -4px ${plan.color}88`:"none",
                    transition:"filter 0.15s, box-shadow 0.15s" }}
                  onMouseEnter={e=>{ if(!isCurrent) e.currentTarget.style.filter="brightness(1.06)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.filter="none"; }}>
                  {isCurrent?"현재 요금제":best?"Team 시작하기 →":"시작하기"}
                </button>
              )}

              {/* 핵심 기능 */}
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16, display:"flex", flexDirection:"column", gap:9 }}>
                {plan.features.map((f,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9 }}>
                    <span style={{ flexShrink:0, width:17, height:17, borderRadius:"50%", background:plan.color+"22",
                      display:"inline-flex", alignItems:"center", justifyContent:"center", marginTop:1 }}>
                      <Check size={11} color={plan.color} />
                    </span>
                    <span style={{ fontSize:12.5, color:C.textSub, lineHeight:1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 기능 비교표(머티리얼 데이터 테이블) ── */}
      <p style={{ textAlign:"center", margin:"26px 0 12px", fontSize:13, fontWeight:700, color:C.textSub }}>전체 기능 비교</p>
      <div style={{ overflowX:"auto", border:`1px solid ${C.border}`, borderRadius:14, background:"var(--c-card)" }}>
        <table style={{ width:"100%", minWidth:560, borderCollapse:"collapse", fontSize:12.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", padding:"14px 16px", color:C.muted, fontWeight:700, fontSize:12, position:"sticky", left:0, background:"var(--c-card)", zIndex:1 }}>기능</th>
              {PLANS.map((p,ci)=>(
                <th key={p.id} style={{ padding:"12px 10px", textAlign:"center", minWidth:88,
                  background:ci===bestCol?p.color+"14":"transparent",
                  borderBottom:ci===bestCol?`2px solid ${p.color}`:`1px solid ${C.border}`,
                  borderTopLeftRadius:ci===bestCol?10:0, borderTopRightRadius:ci===bestCol?10:0 }}>
                  <div style={{ fontWeight:900, fontSize:13, color:ci===bestCol?p.color:C.text }}>{p.name}</div>
                  {ci===bestCol && <div style={{ fontSize:9.5, fontWeight:800, color:p.color, marginTop:2, letterSpacing:"0.5px" }}>★ BEST</div>}
                  <div style={{ fontSize:11, color:C.muted, fontWeight:700, marginTop:2 }}>{fmtWon(p.price)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_MATRIX.map(sec=>(
              <Fragment key={sec.group}>
                <tr>
                  <td colSpan={1+PLANS.length} style={{ padding:"10px 16px 6px", fontSize:11, fontWeight:800, color:C.muted, background:"var(--c-card2)", letterSpacing:"0.3px" }}>{sec.group}</td>
                </tr>
                {sec.rows.map((row,ri)=>{
                  const [label,...vals]=row;
                  return (
                    <tr key={sec.group+ri} style={{ borderTop:`1px solid ${C.border}` }}>
                      <td style={{ padding:"11px 16px", color:C.textSub, position:"sticky", left:0, background:"var(--c-card)", zIndex:1 }}>{label}</td>
                      {vals.map((v,ci)=>{
                        const hl=ci===bestCol;
                        const color=PLANS[ci].color;
                        return (
                          <td key={ci} style={{ padding:"11px 10px", textAlign:"center", background:hl?color+"0e":"transparent", fontWeight:hl?800:600 }}>
                            {v==="✓"
                              ? <span style={{ display:"inline-flex", width:18, height:18, borderRadius:"50%", background:color+"22", alignItems:"center", justifyContent:"center" }}><Check size={12} color={color}/></span>
                              : v.startsWith("+")
                                ? <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:999, background:C.orange+"22", color:C.orange, fontSize:10.5, fontWeight:800 }}>{v}</span>
                                : <span style={{ color:hl?color:C.textSub }}>{v}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 안내 ── */}
      <div style={{ marginTop:18, textAlign:"center", fontSize:11.5, color:C.muted, lineHeight:1.8 }}>
        <p style={{ margin:0 }}>외국인 세무 정산은 Starter·Pro에서 <b style={{ color:C.orange }}>+₩40,000</b> · Team·Enterprise는 기본 포함</p>
        <p style={{ margin:0 }}>Enterprise 담당자 15명 초과 시 <b style={{ color:C.text }}>명당 ₩12,000</b> 추가 · 모든 요금제 14일 무료 체험 후 결제 · 언제든 변경/해지</p>
      </div>
    </div>
  );
}
