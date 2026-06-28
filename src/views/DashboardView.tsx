import type { ReactNode } from "react";
import { C } from "../theme";
import { fmtDate, fmt, fmtTime, bookingTotal, clientBalance, bookingAgencyFee } from "../lib/utils";
import Badge from "../components/Badge";
import TypeIcon from "../components/TypeIcon";
import { BOOKING_TYPES } from "../constants";
import { ClipboardList, Calendar, AlertTriangle, FolderOpen, MessageSquare } from "../components/icons";

// ── 로딩 스켈레톤 ──
function SkBox({ h=20, w="100%", r=8, mt=0 }: { h?:number; w?:number|string; r?:number; mt?:number }) {
  return <div style={{ height:h, width:w, marginTop:mt, borderRadius:r, background:`linear-gradient(90deg, ${C.card2} 25%, ${C.border} 37%, ${C.card2} 63%)`, backgroundSize:"400% 100%", animation:"modiqShimmer 1.2s ease-in-out infinite" }} />;
}
// 콜드 스타트(캐시 없음)에서만 표시. 라벨·제목 같은 정적 텍스트는 그대로 보이고
// 숫자/목록 값 자리만 shimmer → "글자가 모두 안 보이는" 현상 방지.
function DashboardSkeleton({ isMobile, canViewFinance }: { isMobile:boolean; canViewFinance:boolean }) {
  const card = { background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px", marginBottom:16 };
  const lbl = { margin:0, fontSize:11, color:C.muted } as const;
  const statLabels = ["진행중 섭외","HOLD",...(canViewFinance?["계약금 미입금"]:[]),"등록 모델"];
  return (
    <div>
      <style>{`@keyframes modiqShimmer{0%{background-position:100% 0}100%{background-position:0 0}}`}</style>
      <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:800, color:C.text }}>대시보드</h1>
      {canViewFinance && (
        <div style={card}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>이번 달 매출</p>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"repeat(4,minmax(0,1fr))", gap:12, marginTop:14 }}>
            {["실매출 (입금)","예상매출 (확정 포함)","미수금","매출총이익"].map((l,i)=>(
              <div key={i}><p style={lbl}>{l}</p><SkBox h={22} w="72%" mt={8} /></div>
            ))}
          </div>
        </div>
      )}
      {/* 통계 카드 — 라벨은 그대로, 값만 shimmer */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${statLabels.length},minmax(0,1fr))`, gap:isMobile?6:12, marginBottom:16 }}>
        {statLabels.map((l,i)=>(
          <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:isMobile?"10px 8px":"16px 18px" }}>
            <p style={{ fontSize:isMobile?10:11, color:C.muted, margin:0, lineHeight:1.25, wordBreak:"keep-all" }}>{l}</p>
            <SkBox h={isMobile?17:24} w="58%" mt={8} />
          </div>
        ))}
      </div>
      {/* 진행중 섭외 현황 — 제목은 그대로, 목록만 shimmer */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.text }}><ClipboardList size={14} style={{ verticalAlign:-2, flexShrink:0 }}/> 진행중 섭외 현황</p>
      </div>
      <div style={{ display:"grid", gap:8 }}>
        {Array.from({length:3}).map((_,i)=><SkBox key={i} h={54} />)}
      </div>
    </div>
  );
}

export default function DashboardView({ bookings, models, customers, projects, setPage, setSelectedBooking, onSelectProject, onOpenCalendarDate, isMobile = false, canViewFinance = false, loading = false }: {
  bookings: any[]; models: any[]; customers: any[]; projects: any[];
  setPage: (p:any)=>void; setSelectedBooking: (b:any)=>void; onSelectProject: (pid:string)=>void;
  onOpenCalendarDate?: (date:string)=>void;
  isMobile?: boolean; canViewFinance?: boolean; loading?: boolean;
}) {
  // 🔒 보호 영역(CLAUDE.md "대시보드 로딩/첫 화면" 참조) — 임의 수정 금지.
  // 진짜 콜드 스타트(캐시·데이터가 전혀 없음)일 때만 스켈레톤 — 0 깜빡임 방지.
  // 캐시/부분 데이터가 하나라도 있으면 그대로 내용 표시 → "내용→빈화면→내용" 깜빡임 없음.
  // (필수 4종을 한 번에 set + setSyncing(false) 동시 반영하므로 부분 0 깜빡임도 없음.)
  // ⚠️ 이 조건을 `||`로 바꾸면 깜빡임 재발.
  if (loading && bookings.length===0 && models.length===0 && customers.length===0) {
    return <DashboardSkeleton isMobile={isMobile} canViewFinance={canViewFinance} />;
  }
  // 날짜 클릭 → 캘린더의 해당 날짜를 선택 상태로 열기(우측 패널 오픈). 미전달 시 일반 이동.
  const openCal = (date?:string) => (date && onOpenCalendarDate) ? onOpenCalendarDate(date) : setPage("calendar");
  const activeBookings   = bookings.filter(b=>["CONFIRMED","CHECKING","HOLD","SELECTING","PROPOSED"].includes(b.status)).sort((a,b)=>(a.shoot_date||"9999-99-99").localeCompare(b.shoot_date||"9999-99-99"));
  const holdBookings     = bookings.filter(b=>b.status==="HOLD");
  const unpaidDeposit    = bookings.filter(b=>b.status==="CONFIRMED"&&!b.deposit_amt);
  // 프로젝트는 1건, 단건은 각 1건으로 세기
  const unitCount = (list:any[]) => { const pj=new Set<string>(); let n=0; list.forEach(b=>{ if(b.project_id){ if(!pj.has(b.project_id)){ pj.add(b.project_id); n++; } } else n++; }); return n; };
  return (
  <div>
    <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:800, color:C.text }}>대시보드</h1>

    {/* 매출 카드 (재무 권한자만) */}
    {canViewFinance && (()=>{
      const now=new Date(); const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const mb=bookings.filter(b=>(b.shoot_date||"").startsWith(ym)&&["CONFIRMED","COMPLETED","SETTLED"].includes(b.status)&&BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract&&bookingTotal(b)>0);
      const real=mb.filter(b=>b.status==="SETTLED"||b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
      const expected=mb.reduce((s,b)=>s+bookingTotal(b),0);
      const unpaid=mb.filter(b=>(b.status==="CONFIRMED"||b.status==="COMPLETED")&&!b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
      const margin=mb.reduce((s,b)=>s+bookingAgencyFee(b,models),0);
      return (
        <div onClick={()=>setPage("revenue")} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px", marginBottom:16, cursor:"pointer", transition:"border-color 0.2s" }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>이번 달 매출</p>
            <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>매출 현황 전체 보기 →</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"repeat(4,minmax(0,1fr))", gap:12 }}>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>실매출 (입금)</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:400, color:C.green }}>{fmt(real)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>예상매출 (확정 포함)</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:400, color:C.yellow }}>{fmt(expected)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>미수금</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:400, color:C.red }}>{fmt(unpaid)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>매출총이익</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:400, color:C.blue }}>{fmt(margin)}</p></div>
          </div>
        </div>
      );
    })()}

    {/* 입금 확인 필요 (받을 돈) — 계약금·잔금 예정일 임박/경과 */}
    {canViewFinance && (()=>{
      const iso = (d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const today = new Date(); today.setHours(0,0,0,0);
      const todayStr = iso(today);
      const horizon = new Date(today); horizon.setDate(horizon.getDate()+7); const horizonStr = iso(horizon);
      const dday = (date:string)=>Math.round((new Date(date+"T00:00:00").getTime()-today.getTime())/86400000);
      const items:{b:any; label:string; date:string; amount:number}[] = [];
      bookings.filter(b=>!b.is_paid && ["CONFIRMED","COMPLETED","SETTLED"].includes(b.status)).forEach(b=>{
        if (b.deposit_due && (b.deposit_amt||0)>0 && b.deposit_due<=horizonStr) items.push({ b, label:"계약금", date:b.deposit_due, amount:b.deposit_amt||0 });
        if (b.balance_due && clientBalance(b)>0 && b.balance_due<=horizonStr) items.push({ b, label:"잔금", date:b.balance_due, amount:clientBalance(b) });
      });
      items.sort((a,b)=>a.date.localeCompare(b.date));
      if (items.length===0) return null;
      const overdue = items.filter(i=>i.date<todayStr).length;
      return (
        <div style={{ background:C.card, border:`1px solid ${overdue>0?C.red:C.yellow}55`, borderRadius:10, padding:"16px 18px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}><AlertTriangle size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 입금 확인 필요 <span style={{ color:C.muted, fontWeight:600 }}>({items.length}건{overdue>0?` · 경과 ${overdue}`:""})</span></p>
            <span style={{ fontSize:11, color:C.muted }}>고객사 입금 예정일 기준</span>
          </div>
          <div>
            {(()=>{ let first=true; const top=()=>{ const t=first?"none":`1px solid ${C.border}`; first=false; return t; };
            return items.map((it,idx)=>{
              const d = dday(it.date);
              const color = d<0?C.red:d===0?C.orange:C.blue;
              const ddayLabel = d<0?`${-d}일 지남`:d===0?"오늘":`D-${d}`;
              const model = models.find((m:any)=>m.id===it.b.model_id);
              const client = customers.find((c:any)=>c.id===it.b.customer_id);
              return (
                <div key={it.b.id+it.label+idx} onClick={()=>setSelectedBooking(it.b)}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.card2)}
                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                  style={{ display:"flex", alignItems:"center", gap:10, minWidth:0, borderTop:top(), padding:"11px 4px", cursor:"pointer", transition:"background 0.12s" }}>
                  {/* 왼쪽 끝 = D-day */}
                  <span style={{ flexShrink:0, fontSize:11, fontWeight:800, color, background:color+"1a", borderRadius:6, padding:"3px 8px", minWidth:54, textAlign:"center" }}>{ddayLabel}</span>
                  {/* 가운데 = 고객사·모델·날짜(붙여서, 왼쪽 정렬) */}
                  <p style={{ flex:1, minWidth:0, margin:0, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    <strong style={{ fontWeight:700, color:C.text }}>{client?.name||"?"}</strong>
                    <span style={{ color:C.muted, fontWeight:600 }}> · {model?.name||"?"}</span>
                    <span style={{ color:C.muted }}> · <Calendar size={10} style={{ verticalAlign:-1.5, flexShrink:0 }}/>{fmtDate(it.date)} · {it.label}</span>
                  </p>
                  {/* 오른쪽 끝 = 금액 */}
                  <span style={{ flexShrink:0, fontSize:13, fontWeight:800, color:it.label==="잔금"?C.text:C.textSub, whiteSpace:"nowrap" }}>{it.amount.toLocaleString()}원</span>
                </div>
              );
            }); })()}
          </div>
        </div>
      );
    })()}

    {/* 통계 카드 (계약금 미입금은 재무 권한자만) */}
    {(()=>{
      const statCards = [
        { label:"진행중 섭외",  value:`${unitCount(activeBookings)}건`,  color:C.blue   },
        { label:"HOLD",         value:`${holdBookings.length}건`,    color:C.yellow },
        ...(canViewFinance ? [{ label:"계약금 미입금", value:`${unitCount(unpaidDeposit)}건`, color:C.red }] : []),
        { label:"등록 모델",     value:`${models.length}명`,          color:"#c9a96e"},
      ];
      return (
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${statCards.length},minmax(0,1fr))`, gap:isMobile?6:12, marginBottom:16 }}>
          {statCards.map(item=>(
            <div key={item.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:isMobile?"10px 8px":"16px 18px" }}>
              <p style={{ fontSize:isMobile?10:11, color:C.muted, margin:0, lineHeight:1.25, wordBreak:"keep-all" }}>{item.label}</p>
              <p style={{ fontSize:isMobile?17:24, fontWeight:400, margin:isMobile?"4px 0 0":"6px 0 0", color:item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      );
    })()}

    {/* ════ 신규 문의 카드 (처리 대기 INQUIRY) ════ */}
    {(()=>{
      const inquiries = bookings.filter(b=>b.status==="INQUIRY");
      if (inquiries.length===0) return null;
      const _now = new Date();
      const todayS = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
      const daysAgo = (iso?:string) => { if(!iso) return null; const d=new Date(iso); if(isNaN(d.getTime())) return null; return Math.floor((_now.getTime()-d.getTime())/86400000); };
      const sorted = [...inquiries].sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
      const todayCnt = inquiries.filter(b=>(b.created_at||"").slice(0,10)===todayS).length;
      const PINK = "#ec4899";
      return (
        <div style={{ position:"relative", background:`linear-gradient(135deg, ${PINK}26 0%, ${PINK}0d 55%, transparent 100%)`, border:`1.5px solid ${PINK}88`, borderRadius:14, padding:"18px 18px 16px", marginBottom:16, boxShadow:`0 0 0 1px ${PINK}22, 0 10px 30px -12px ${PINK}88`, overflow:"hidden" }}>
          <style>{`
            @keyframes modiqPulse { 0%,100%{ opacity:1; transform:scale(1);} 50%{ opacity:.5; transform:scale(.88);} }
            @keyframes modiqGlow { 0%,100%{ box-shadow:0 0 0 0 ${PINK}66, 0 4px 14px -2px ${PINK}aa;} 50%{ box-shadow:0 0 0 7px ${PINK}00, 0 4px 14px -2px ${PINK}aa;} }
            @keyframes modiqBlink { 0%,100%{ opacity:1;} 50%{ opacity:.25;} }
          `}</style>
          {/* 좌측 액센트 바 */}
          <div style={{ position:"absolute", top:0, left:0, bottom:0, width:5, background:PINK }} />

          {/* 헤더 */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, paddingLeft:6 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:PINK, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, animation:"modiqGlow 2s ease-in-out infinite" }}>
              <MessageSquare size={22} color="#fff" />
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:3, flexShrink:0 }}>
              <span style={{ fontSize:36, fontWeight:900, color:PINK, letterSpacing:-1, lineHeight:1 }}>{inquiries.length}</span>
              <span style={{ fontSize:14, fontWeight:800, color:PINK }}>건</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:PINK, animation:"modiqBlink 1.2s ease-in-out infinite", flexShrink:0 }} />
                <p style={{ margin:0, fontSize:15, fontWeight:800, color:C.text, letterSpacing:-0.3 }}>신규 문의</p>
              </div>
              <p style={{ margin:"3px 0 0", fontSize:12, color:C.textSub }}>{todayCnt>0?`오늘 ${todayCnt}건 신규 도착`:"오늘 신규 없음"}{isMobile ? <br/> : " · "}미처리 리드를 놓치지 마세요</p>
            </div>
          </div>

          {/* 리스트 */}
          <div style={{ display:"grid", gap:8, gridTemplateColumns:"minmax(0,1fr)" }}>
            {sorted.map(b=>{
              const model  = models.find(m=>m.id===b.model_id);
              const client = customers.find(c=>c.id===b.customer_id);
              const ty = BOOKING_TYPES[b.booking_type||"SHOOT"]?.label || "일정";
              const dgo = daysAgo(b.created_at);
              const isToday = (b.created_at||"").slice(0,10)===todayS;
              return (
                <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${isToday?PINK+"99":C.border}`, borderRadius:10, padding:"11px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, minWidth:0, transition:"transform .15s, border-color .15s, box-shadow .15s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=PINK; e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=`0 6px 16px -8px ${PINK}aa`; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=isToday?PINK+"99":C.border; e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; }}
                >
                  {isToday&&<span style={{ background:PINK, color:"#fff", borderRadius:5, padding:"2px 7px", fontSize:10, fontWeight:900, flexShrink:0, animation:"modiqPulse 1.4s ease-in-out infinite", boxShadow:`0 0 10px ${PINK}` }}>NEW</span>}
                  <span style={{ background:PINK+"22", color:PINK, border:`1px solid ${PINK}44`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, flexShrink:0 }}>{ty}</span>
                  <p style={{ flex:1, minWidth:0, margin:0, fontSize:13, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    <strong style={{ fontSize:14.5, fontWeight:800, color:C.text }}>{model?.name||"모델 미정"}</strong>
                    <span style={{ color:C.textSub, fontWeight:600 }}> · {client?.name||"고객사 미정"}</span>
                    <span> · {b.shoot_date?fmtDate(b.shoot_date):"일정 미정"}</span>
                  </p>
                  {dgo!==null&&dgo>0&&<span style={{ fontSize:11, fontWeight:800, color:dgo>=3?C.red:C.muted, flexShrink:0, whiteSpace:"nowrap", ...(dgo>=3?{ background:C.red+"1a", border:`1px solid ${C.red}44`, borderRadius:5, padding:"2px 7px" }:{}) }}>{dgo}일 경과</span>}
                  <span style={{ color:PINK, fontWeight:800, fontSize:16, flexShrink:0 }}>{"›"}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    })()}

    {/* 이번 주 섭외 미리보기 */}
    {(()=>{
      const now = new Date();
      const day = now.getDay(); // 0=일
      const monday = new Date(now); monday.setDate(now.getDate() - (day===0?6:day-1));
      const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
      const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const todayStr = toStr(now);
      const tomorrowStr = toStr(new Date(now.getFullYear(), now.getMonth(), now.getDate()+1));
      const weekDays: { label:string; date:string; short:string }[] = [];
      for(let i=0;i<7;i++){
        const d = new Date(monday); d.setDate(monday.getDate()+i);
        const ds = toStr(d);
        weekDays.push({ label:["월","화","수","목","금","토","일"][i], date:ds, short:ds });
      }
      const live = bookings.filter(b=>b.status!=="CANCELLED"&&b.shoot_date); // 취소·날짜미정 제외
      const weekBookings = live.filter(b=>b.shoot_date>=toStr(monday)&&b.shoot_date<=toStr(sunday));
      const todayCnt    = live.filter(b=>b.shoot_date===todayStr).length;
      const tomorrowCnt = live.filter(b=>b.shoot_date===tomorrowStr).length;
      const weekTotal   = weekBookings.length;

      return (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:16 }}>
          {/* 헤더 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:C.text }}><Calendar size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 이번 주 섭외</p>
            <button onClick={()=>setPage("calendar")} style={{ background:"none", border:"none", color:C.blue, cursor:"pointer", fontSize:12, fontWeight:600 }}>캘린더 전체 보기 →</button>
          </div>

          {/* 오늘/내일 요약 */}
          <div style={{ display:"flex", gap:10, marginBottom:14 }}>
            {[
              { label:"오늘",  cnt:todayCnt,    date:todayStr,    color:C.blue   },
              { label:"내일",  cnt:tomorrowCnt, date:tomorrowStr, color:C.purple },
              { label:"이번 주",cnt:weekTotal,  date:null,        color:C.green  },
            ].map(item=>(
              <div key={item.label} onClick={()=>{ if(item.date) openCal(item.date); else setPage("calendar"); }} style={{ flex:1, background:C.card2, borderRadius:8, padding:"10px 14px", cursor:item.date?"pointer":"default", border:`1px solid ${item.cnt>0?item.color+"50":C.border}`, transition:"border-color 0.15s" }}
                onMouseEnter={e=>{ if(item.date) e.currentTarget.style.borderColor=item.color; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=item.cnt>0?item.color+"50":C.border; }}
              >
                <p style={{ margin:0, fontSize:11, color:C.muted }}>{item.label}</p>
                <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:item.cnt>0?item.color:C.muted }}>{item.cnt}<span style={{ fontSize:12, fontWeight:400, marginLeft:3 }}>건</span></p>
              </div>
            ))}
          </div>

          {/* 요일별 바 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", gap:4 }}>
            {weekDays.map(wd=>{
              const cnt = live.filter(b=>b.shoot_date===wd.date).length;
              const isToday = wd.date===todayStr;
              const maxCnt = Math.max(...weekDays.map(w=>live.filter(b=>b.shoot_date===w.date).length), 1);
              return (
                <div key={wd.date} onClick={()=>openCal(wd.date)} style={{ cursor:"pointer", textAlign:"center" }}>
                  <div style={{ fontSize:10, color:isToday?C.blue:C.muted, fontWeight:isToday?700:400, marginBottom:4 }}>{wd.label}</div>
                  {/* 바 */}
                  <div style={{ height:32, background:C.border, borderRadius:4, overflow:"hidden", position:"relative" }}>
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${cnt===0?0:Math.max(20,(cnt/maxCnt)*100)}%`, background:isToday?C.blue:cnt>0?C.green+"99":C.border, borderRadius:4, transition:"height 0.3s" }} />
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, marginTop:3, color:cnt>0?C.text:C.muted }}>{cnt>0?cnt:"·"}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    })()}

    {/* HOLD 경고 카드 */}
    {holdBookings.length>0&&(
      <div style={{ background:"rgba(251,191,36,0.07)", border:`1px solid ${C.yellow}50`, borderRadius:10, padding:16, marginBottom:16 }}>
        <p style={{ margin:"0 0 12px", fontWeight:800, fontSize:13, color:C.yellow }}><AlertTriangle size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> HOLD — 동시 섭외 충돌 확인 필요</p>
        {holdBookings.map(b=>{
          const model  = models.find(m=>m.id===b.model_id);
          const client = customers.find(c=>c.id===b.customer_id);
          return (
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid rgba(251,191,36,0.15)`, cursor:"pointer" }}>
              <Badge code="HOLD" />
              <p style={{ flex:1, minWidth:0, margin:0, fontSize:13, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <strong style={{ fontSize:14, fontWeight:700, color:C.text }}>{model?.name||"?"}</strong>
                <span style={{ color:C.textSub, fontWeight:600 }}> · {fmtDate(b.shoot_date)}</span>
                {client?.name?<span> · {client.name}</span>:null}
                {(b.project_name||b.location)?<span> · {b.project_name||b.location}</span>:null}
              </p>
            </div>
          );
        })}
      </div>
    )}

    {/* 진행중 섭외 현황 */}
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.text }}><ClipboardList size={14} style={{ verticalAlign:-2, flexShrink:0 }}/> 진행중 섭외 현황</p>
        <button onClick={()=>setPage("bookings")} style={{ background:"none", border:"none", color:C.blue, cursor:"pointer", fontSize:13, fontWeight:600 }}>전체 보기 →</button>
      </div>
      {activeBookings.length===0 ? <p style={{ color:C.muted, fontSize:13 }}>진행중인 섭외가 없습니다.</p> : (()=>{
        // 프로젝트 단위 그루핑
        const projGroup: Record<string, any[]> = {};
        const singles: any[] = [];
        const _now = new Date();
        const todayS = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
        const isOverdue = (d:string) => !!d && d < todayS;
        activeBookings.forEach(b=>{
          if (b.project_id) {
            if (!projGroup[b.project_id]) projGroup[b.project_id]=[];
            projGroup[b.project_id].push(b);
          } else { singles.push(b); }
        });
        // 아바타(섭외 리스트와 동일)
        const avatar=(m:any,size:number)=> m?.thumb_url
          ? <img src={m.thumb_url} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
          : <span style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:size*0.42, fontWeight:800, flexShrink:0 }}>{(m?.name||"?")[0]}</span>;
        let first=true; const top=()=>{ const t=first?"none":`1px solid ${C.border}`; first=false; return t; };
        // 프로젝트·단건 공통 6컬럼(세로 일렬): [배지] [식별자] [날짜] [부가] [금액] [상태]
        const ROW_COLS = "max-content minmax(0,2fr) minmax(0,1.3fr) minmax(0,1.5fr) max-content max-content";
        const rows: ReactNode[] = [];
        // 프로젝트 그룹 (섭외 리스트 그룹헤더 기준 — 폴더배지·아바타·프로젝트·고객사·날짜 / 우측 금액)
        Object.entries(projGroup).forEach(([pid, bs])=>{
          const proj = projects.find(p=>p.id===pid);
          const client = customers.find(c=>c.id===bs[0]?.customer_id);
          const hasHold = bs.some(b=>b.status==="HOLD");
          const overdue = bs.some(x=>isOverdue(x.shoot_date));
          const total = bs.reduce((s,b)=>s+bookingTotal(b),0);
          const ms = bs.map(b=>models.find(m=>m.id===b.model_id)).filter(Boolean);
          if (isMobile) { rows.push(
            <div key={pid} onClick={()=>onSelectProject(pid)} style={{ padding:"10px 14px", borderTop:top(), cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ flexShrink:0, background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:4, padding:"2px 7px", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}><FolderOpen size={10} style={{ verticalAlign:-2 }}/> 프로젝트</span>
                <strong style={{ flex:1, minWidth:0, fontSize:13.5, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{proj?.name||bs[0]?.project_name||"프로젝트"} <span style={{ color:C.textSub, fontWeight:600 }}>· {client?.name||"?"}</span></strong>
                {hasHold ? <span style={{ flexShrink:0, background:C.yellow+"22", color:C.yellow, border:`1px solid ${C.yellow}44`, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>HOLD</span> : null}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.muted }}>
                <span style={{ flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmtDate(bs[0]?.shoot_date)} · 모델 {bs.length}명{overdue?<span style={{ color:C.red, fontWeight:700 }}> · 일정지남</span>:null}</span>
                {canViewFinance&&total>0 ? <span style={{ marginLeft:"auto", color:"#c9a96e", fontWeight:700, flexShrink:0 }}>{total.toLocaleString()}원</span> : null}
              </div>
            </div>
          ); return; }
          rows.push(
            <div key={pid} onClick={()=>onSelectProject(pid)}
              onMouseEnter={e=>(e.currentTarget.style.background=C.card2)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              style={{ display:"grid", gridTemplateColumns:ROW_COLS, alignItems:"center", gap:14, padding:"11px 16px", borderTop:top(), cursor:"pointer", transition:"background 0.12s" }}>
              <span style={{ background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:4, padding:"2px 7px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:3 }}><FolderOpen size={11} style={{ verticalAlign:-2 }}/> 프로젝트</span>
              <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                <span style={{ display:"flex", flexShrink:0 }}>{ms.slice(0,3).map((m:any,i:number)=>(<span key={i} style={{ marginLeft:i?-7:0, border:`2px solid ${C.card}`, borderRadius:"50%", display:"inline-flex" }}>{avatar(m,20)}</span>))}</span>
                <strong style={{ fontSize:13.5, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{proj?.name||bs[0]?.project_name||"프로젝트"} <span style={{ color:C.textSub, fontWeight:600 }}>· {client?.name||"?"}</span></strong>
              </span>
              <span style={{ fontSize:12.5, color:C.textSub, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(bs[0]?.shoot_date)}</span>
              <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>모델 {bs.length}명{overdue ? <span style={{ color:C.red, fontWeight:700 }}> · <AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>일정지남</span> : null}</span>
              <span style={{ textAlign:"right", fontSize:13, fontWeight:700, color:"#c9a96e", whiteSpace:"nowrap" }}>{canViewFinance&&total>0 ? total.toLocaleString()+"원" : ""}</span>
              <span style={{ display:"flex", justifyContent:"flex-end" }}>{hasHold ? <span style={{ background:C.yellow+"22", color:C.yellow, border:`1px solid ${C.yellow}44`, borderRadius:4, padding:"2px 7px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>HOLD</span> : null}</span>
            </div>
          );
        });
        // 단건 섭외 (섭외 리스트 단건 행 기준)
        singles.forEach(b=>{
          const model  = models.find(m=>m.id===b.model_id);
          const client = customers.find(c=>c.id===b.customer_id);
          const amt = bookingTotal(b);
          const bk = BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT;
          if (isMobile) { rows.push(
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ padding:"10px 14px", borderTop:top(), cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <span style={{ color:bk.color, display:"inline-flex", flexShrink:0 }}><TypeIcon type={b.booking_type} size={13}/></span>
                {avatar(model,24)}
                <strong style={{ flex:1, minWidth:0, fontSize:14, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{model?.name||"?"} → {client?.name||"?"}</strong>
                <Badge code={b.status} type={b.booking_type} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.textSub }}>
                <span style={{ flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmtDate(b.shoot_date)}{b.project_name?` · ${b.project_name}`:""}{isOverdue(b.shoot_date)?<span style={{ color:C.red, fontWeight:700 }}> · 일정지남</span>:null}</span>
                {canViewFinance&&amt>0?<span style={{ marginLeft:"auto", color:"#c9a96e", fontWeight:700, flexShrink:0 }}>{amt.toLocaleString()}원</span>:null}
              </div>
            </div>
          ); return; }
          rows.push(
            <div key={b.id} onClick={()=>setSelectedBooking(b)}
              onMouseEnter={e=>(e.currentTarget.style.background=C.card2)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              style={{ display:"grid", gridTemplateColumns:ROW_COLS, alignItems:"center", gap:14, padding:"11px 16px", borderTop:top(), cursor:"pointer", transition:"background 0.12s" }}>
              <span style={{ background:bk.color+"22", color:bk.color, border:`1px solid ${bk.color}44`, borderRadius:4, padding:"2px 7px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:3 }}><TypeIcon type={b.booking_type} size={11}/> {bk.label}</span>
              <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>{avatar(model,24)}<strong style={{ fontSize:13.5, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{model?.name||"?"} → {client?.name||"?"}</strong></span>
              <span style={{ fontSize:12.5, color:C.textSub, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)}</span>
              <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {b.project_name ? b.project_name : ""}
                {isOverdue(b.shoot_date) ? <span style={{ color:C.red, fontWeight:700 }}>{b.project_name?" · ":""}<AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>일정지남</span> : null}
                {!b.deposit_amt&&b.status==="CONFIRMED" ? <span style={{ color:C.red, fontWeight:700 }}>{(b.project_name||isOverdue(b.shoot_date))?" · ":""}계약금 미입금</span> : null}
              </span>
              <span style={{ textAlign:"right", fontSize:13, fontWeight:700, color:"#c9a96e", whiteSpace:"nowrap" }}>{canViewFinance&&amt>0 ? amt.toLocaleString()+"원" : ""}</span>
              <span style={{ display:"flex", justifyContent:"flex-end" }}><Badge code={b.status} type={b.booking_type} /></span>
            </div>
          );
        });
        return <div style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", background:C.card }}>
          {!isMobile && (
            <div style={{ display:"grid", gridTemplateColumns:ROW_COLS, alignItems:"center", gap:14, padding:"9px 16px", background:C.card2, borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.muted, whiteSpace:"nowrap" }}>
              <span>유형</span><span>모델 → 고객사</span><span>날짜</span><span>비고</span>
              <span style={{ textAlign:"right" }}>금액</span><span style={{ textAlign:"right" }}>상태</span>
            </div>
          )}
          {rows}
        </div>;
      })()}
    </div>
  </div>
  );
}
