import type { ReactNode } from "react";
import { C } from "../theme";
import { fmtDate, fmt, fmtTime } from "../lib/utils";
import Badge from "../components/Badge";
import TypeIcon from "../components/TypeIcon";
import { BOOKING_TYPES } from "../constants";
import { ClipboardList, Calendar, AlertTriangle, FolderOpen } from "../components/icons";

export default function DashboardView({ bookings, models, customers, projects, setPage, setSelectedBooking, onSelectProject, isMobile = false, canViewFinance = false }: {
  bookings: any[]; models: any[]; customers: any[]; projects: any[];
  setPage: (p:any)=>void; setSelectedBooking: (b:any)=>void; onSelectProject: (pid:string)=>void;
  isMobile?: boolean; canViewFinance?: boolean;
}) {
  const activeBookings   = bookings.filter(b=>["CONFIRMED","CHECKING","HOLD","SELECTING","INQUIRY","PROPOSED"].includes(b.status)).sort((a,b)=>(a.shoot_date||"9999-99-99").localeCompare(b.shoot_date||"9999-99-99"));
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
      const mb=bookings.filter(b=>(b.shoot_date||"").startsWith(ym)&&["CONFIRMED","COMPLETED","SETTLED"].includes(b.status));
      const real=mb.filter(b=>b.status==="SETTLED"||b.is_paid).reduce((s,b)=>s+(b.shoot_fee||0),0);
      const expected=mb.reduce((s,b)=>s+(b.shoot_fee||0),0);
      const unpaid=mb.filter(b=>(b.status==="CONFIRMED"||b.status==="COMPLETED")&&!b.is_paid).reduce((s,b)=>s+(b.shoot_fee||0),0);
      return (
        <div onClick={()=>setPage("revenue")} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px", marginBottom:16, cursor:"pointer", transition:"border-color 0.2s" }}
          onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>이번 달 매출</p>
            <span style={{ fontSize:12, color:C.blue, fontWeight:600 }}>매출 현황 전체 보기 →</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:12 }}>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>실매출 (입금)</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.green }}>{fmt(real)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>예상매출 (확정 포함)</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.yellow }}>{fmt(expected)}</p></div>
            <div><p style={{ margin:0, fontSize:11, color:C.muted }}>미수금</p><p style={{ margin:"5px 0 0", fontSize:20, fontWeight:800, color:C.red }}>{fmt(unpaid)}</p></div>
          </div>
        </div>
      );
    })()}

    {/* 통계 카드 4개 */}
    <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:12, marginBottom:16 }}>
      {[
        { label:"진행중 섭외",  value:`${unitCount(activeBookings)}건`,  color:C.blue   },
        { label:"HOLD",         value:`${holdBookings.length}건`,    color:C.yellow },
        { label:"계약금 미입금", value:`${unitCount(unpaidDeposit)}건`,  color:C.red    },
        { label:"등록 모델",     value:`${models.length}명`,          color:"#c9a96e"},
      ].map(item=>(
        <div key={item.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px" }}>
          <p style={{ fontSize:11, color:C.muted, margin:0 }}>{item.label}</p>
          <p style={{ fontSize:24, fontWeight:800, margin:"6px 0 0", color:item.color }}>{item.value}</p>
        </div>
      ))}
    </div>

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
              <div key={item.label} onClick={()=>{ if(item.date) setPage("calendar"); }} style={{ flex:1, background:C.card2, borderRadius:8, padding:"10px 14px", cursor:item.date?"pointer":"default", border:`1px solid ${item.cnt>0?item.color+"50":C.border}`, transition:"border-color 0.15s" }}
                onMouseEnter={e=>{ if(item.date) e.currentTarget.style.borderColor=item.color; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor=item.cnt>0?item.color+"50":C.border; }}
              >
                <p style={{ margin:0, fontSize:11, color:C.muted }}>{item.label}</p>
                <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:item.cnt>0?item.color:C.muted }}>{item.cnt}<span style={{ fontSize:12, fontWeight:400, marginLeft:3 }}>건</span></p>
              </div>
            ))}
          </div>

          {/* 요일별 바 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
            {weekDays.map(wd=>{
              const cnt = live.filter(b=>b.shoot_date===wd.date).length;
              const isToday = wd.date===todayStr;
              const maxCnt = Math.max(...weekDays.map(w=>live.filter(b=>b.shoot_date===w.date).length), 1);
              return (
                <div key={wd.date} onClick={()=>setPage("calendar")} style={{ cursor:"pointer", textAlign:"center" }}>
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
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:`1px solid rgba(251,191,36,0.15)`, cursor:"pointer" }}>
              <Badge code="HOLD" />
              <span style={{ color:C.text, fontWeight:700 }}>{model?.name||"?"}</span>
              <span style={{ color:C.muted, fontSize:12 }}>{fmtDate(b.shoot_date)} · {client?.name||"?"} · {b.project_name||b.location||""}</span>
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
                  {bs.reduce((s,b)=>s+(b.shoot_fee||0),0)>0&&<p style={{ margin:0, fontSize:13, fontWeight:700, color:"#c9a96e" }}>{bs.reduce((s,b)=>s+(b.shoot_fee||0),0).toLocaleString()}원</p>}
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
                {b.shoot_fee>0&&<span style={{ marginLeft:"auto", color:"#c9a96e", fontWeight:700, flexShrink:0 }}>{b.shoot_fee.toLocaleString()}원</span>}
              </div>
            </div>
          ); return; }
          rows.push(
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"border-color 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
              onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
            >
              {(()=>{ const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT; return <span style={{ background:bt.color+"22", color:bt.color, border:`1px solid ${bt.color}44`, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:700, flexShrink:0 }}><TypeIcon type={b.booking_type} size={11}/> {bt.label}</span>; })()}
              <p style={{ flex:1, margin:0, fontSize:13, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <strong style={{ fontSize:14, fontWeight:700, color:C.text }}>{model?.name||"?"}</strong>
                <span style={{ color:C.textSub, fontWeight:600 }}> · {client?.name||"?"}</span>
                <span> · {fmtDate(b.shoot_date)}</span>
                {b.project_name?<span> · {b.project_name}</span>:null}
                {isOverdue(b.shoot_date)&&<span style={{ color:C.red, fontWeight:700 }}> · <AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>촬영일지남</span>}
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                {!b.deposit_amt&&b.status==="CONFIRMED"&&<span style={{ fontSize:11, color:C.red, fontWeight:700 }}>계약금 미입금</span>}
                {b.shoot_fee>0&&<span style={{ fontSize:13, fontWeight:700, color:"#c9a96e" }}>{b.shoot_fee.toLocaleString()}원</span>}
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
