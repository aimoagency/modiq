import type { ReactNode } from "react";
import { C } from "../theme";
import { fmtDate, fmt, fmtTime, bookingTotal, clientBalance, bookingAgencyFee } from "../lib/utils";
import Badge from "../components/Badge";
import TypeIcon from "../components/TypeIcon";
import { BOOKING_TYPES } from "../constants";
import { ClipboardList, Calendar, AlertTriangle, FolderOpen, MessageSquare } from "../components/icons";

export default function DashboardView({ bookings, models, customers, projects, setPage, setSelectedBooking, onSelectProject, onOpenCalendarDate, isMobile = false, canViewFinance = false }: {
  bookings: any[]; models: any[]; customers: any[]; projects: any[];
  setPage: (p:any)=>void; setSelectedBooking: (b:any)=>void; onSelectProject: (pid:string)=>void;
  onOpenCalendarDate?: (date:string)=>void;
  isMobile?: boolean; canViewFinance?: boolean;
}) {
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
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>실매출 (입금)</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.green }}>{fmt(real)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>예상매출 (확정 포함)</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.yellow }}>{fmt(expected)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>미수금</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.red }}>{fmt(unpaid)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>매출총이익</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.blue }}>{fmt(margin)}</p></div>
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
          <div style={{ display:"grid", gap:8 }}>
            {items.map((it,idx)=>{
              const d = dday(it.date);
              const color = d<0?C.red:d===0?C.orange:C.blue;
              const ddayLabel = d<0?`${-d}일 지남`:d===0?"오늘":`D-${d}`;
              const model = models.find((m:any)=>m.id===it.b.model_id);
              const client = customers.find((c:any)=>c.id===it.b.customer_id);
              return (
                <div key={it.b.id+it.label+idx} onClick={()=>setSelectedBooking(it.b)}
                  style={{ display:"flex", alignItems:"center", gap:10, background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", cursor:"pointer", transition:"border-color 0.15s" }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=color)}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
                  <span style={{ flexShrink:0, fontSize:11, fontWeight:800, color, background:color+"1a", borderRadius:6, padding:"3px 8px", minWidth:54, textAlign:"center" }}>{ddayLabel}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {client?.name||"?"} <span style={{ color:C.muted, fontWeight:600 }}>· {model?.name||"?"}</span>
                    </p>
                    <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}><Calendar size={10} style={{ verticalAlign:-1.5, flexShrink:0 }}/> {fmtDate(it.date)} · {it.label}</p>
                  </div>
                  <span style={{ flexShrink:0, minWidth:92, textAlign:"right", fontSize:13, fontWeight:800, color:it.label==="잔금"?C.text:C.textSub }}>{it.amount.toLocaleString()}원</span>
                </div>
              );
            })}
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
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":`repeat(${statCards.length},minmax(0,1fr))`, gap:12, marginBottom:16 }}>
          {statCards.map(item=>(
            <div key={item.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px" }}>
              <p style={{ fontSize:11, color:C.muted, margin:0 }}>{item.label}</p>
              <p style={{ fontSize:24, fontWeight:800, margin:"6px 0 0", color:item.color }}>{item.value}</p>
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
              <p style={{ margin:"3px 0 0", fontSize:12, color:C.textSub }}>{todayCnt>0?`오늘 ${todayCnt}건 신규 도착`:"오늘 신규 없음"} · 미처리 리드를 놓치지 마세요</p>
            </div>
          </div>

          {/* 리스트 */}
          <div style={{ display:"grid", gap:8 }}>
            {sorted.map(b=>{
              const model  = models.find(m=>m.id===b.model_id);
              const client = customers.find(c=>c.id===b.customer_id);
              const ty = BOOKING_TYPES[b.booking_type||"SHOOT"]?.label || "일정";
              const dgo = daysAgo(b.created_at);
              const isToday = (b.created_at||"").slice(0,10)===todayS;
              return (
                <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${isToday?PINK+"99":C.border}`, borderRadius:10, padding:"11px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"transform .15s, border-color .15s, box-shadow .15s" }}
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
                  {dgo!==null&&dgo>0&&<span style={{ fontSize:11, fontWeight:800, color:dgo>=3?C.red:C.muted, flexShrink:0, ...(dgo>=3?{ background:C.red+"1a", border:`1px solid ${C.red}44`, borderRadius:5, padding:"2px 7px" }:{}) }}>{dgo}일 경과</span>}
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
        const rows: ReactNode[] = [];
        // 프로젝트 그룹 먼저
        Object.entries(projGroup).forEach(([pid, bs])=>{
          const proj = projects.find(p=>p.id===pid);
          const client = customers.find(c=>c.id===bs[0]?.customer_id);
          const statuses = [...new Set(bs.map(b=>b.status))];
          const hasHold = statuses.includes("HOLD");
          rows.push(
            <div key={pid} onClick={()=>onSelectProject(pid)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", cursor:"pointer", transition:"border-color 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
              onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
            >
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700 }}><FolderOpen size={10} style={{ verticalAlign:-2, flexShrink:0 }}/> 프로젝트</span>
                {hasHold&&<span style={{ background:C.yellow+"22", color:C.yellow, border:`1px solid ${C.yellow}44`, borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700 }}><AlertTriangle size={10} style={{ verticalAlign:-2, flexShrink:0 }}/>HOLD</span>}
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.text }}>{proj?.name||bs[0]?.project_name||"프로젝트"} <span style={{ color:C.textSub, fontWeight:600 }}>· {client?.name||"?"}</span></p>
                  <p style={{ margin:"2px 0 0", fontSize:13, color:C.textSub }}>{fmtDate(bs[0]?.shoot_date)} · 모델 {bs.length}명: {bs.map(b=>models.find(m=>m.id===b.model_id)?.name||"?").join(", ")}</p>
                  {bs.some(x=>isOverdue(x.shoot_date))&&<p style={{ margin:"3px 0 0", fontSize:11, color:C.red, fontWeight:700 }}><AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영일 지남 — 상태 업데이트 필요</p>}
                </div>
                <div style={{ textAlign:"right" }}>
                  {canViewFinance&&bs.reduce((s,b)=>s+bookingTotal(b),0)>0&&<p style={{ margin:0, fontSize:13, fontWeight:700, color:"#c9a96e" }}>{bs.reduce((s,b)=>s+bookingTotal(b),0).toLocaleString()}원</p>}
                </div>
              </div>
            </div>
          );
        });
        // 단건 섭외
        singles.forEach(b=>{
          const model  = models.find(m=>m.id===b.model_id);
          const client = customers.find(c=>c.id===b.customer_id);
          if (isMobile) { rows.push(
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <TypeIcon type={b.booking_type} size={13}/>
                <strong style={{ flex:1, fontSize:14, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{model?.name||"?"} <span style={{ color:C.textSub, fontWeight:600 }}>· {client?.name||"?"}</span></strong>
                <Badge code={b.status} type={b.booking_type} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.textSub }}>
                <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmtDate(b.shoot_date)}{b.project_name?` · ${b.project_name}`:""}{isOverdue(b.shoot_date)?" · ":""}{isOverdue(b.shoot_date)&&<span style={{ color:C.red, fontWeight:700 }}><AlertTriangle size={10} style={{ verticalAlign:-1.5, flexShrink:0 }}/>일정지남</span>}</span>
                {canViewFinance&&bookingTotal(b)>0&&<span style={{ marginLeft:"auto", color:"#c9a96e", fontWeight:700, flexShrink:0 }}>{bookingTotal(b).toLocaleString()}원</span>}
              </div>
            </div>
          ); return; }
          rows.push(
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"border-color 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
              onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
            >
              {(()=>{ const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT; return <span style={{ background:bt.color+"22", color:bt.color, border:`1px solid ${bt.color}44`, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:700, flexShrink:0 }}><TypeIcon type={b.booking_type} size={11}/> {bt.label}</span>; })()}
              <p style={{ flex:1, minWidth:0, margin:0, fontSize:13, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <strong style={{ fontSize:14, fontWeight:700, color:C.text }}>{model?.name||"?"}</strong>
                <span style={{ color:C.textSub, fontWeight:600 }}> · {client?.name||"?"}</span>
                <span> · {fmtDate(b.shoot_date)}</span>
                {b.project_name?<span> · {b.project_name}</span>:null}
                {isOverdue(b.shoot_date)&&<span style={{ color:C.red, fontWeight:700 }}> · <AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>촬영일지남</span>}
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                {!b.deposit_amt&&b.status==="CONFIRMED"&&<span style={{ fontSize:11, color:C.red, fontWeight:700 }}>계약금 미입금</span>}
                {canViewFinance&&bookingTotal(b)>0&&<span style={{ fontSize:13, fontWeight:700, color:"#c9a96e" }}>{bookingTotal(b).toLocaleString()}원</span>}
                <Badge code={b.status} type={b.booking_type} />
              </div>
            </div>
          );
        });
        return <div style={{ display:"grid", gap:8 }}>{rows}</div>;
      })()}
    </div>
  </div>
  );
}
