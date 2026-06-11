import { useState, useEffect } from "react";
import { C, btnS, inp } from "../theme";
import { STATUS, BOOKING_TYPES, KR_HOLIDAYS } from "../constants";
import { visaDday, fmtTime, findConflicts } from "../lib/utils";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import TypeIcon from "../components/TypeIcon";
import { User, CalendarDays, CalendarOff, ClipboardList, Clock, MapPin, Folder, Plane, AlertTriangle, Flag, Coins } from "../components/icons";

// ── 캘린더 컴포넌트 ────────────────────────────────────────────
export default function CalendarView({ bookings, models, customers, onSelectBooking, onAddBooking, initModelId = "", holidays = [], onAddHoliday, onDeleteHoliday, isMobile = false }: {
  bookings: any[]; models: any[]; customers: any[];
  onSelectBooking: (b: any) => void;
  onAddBooking: (preModel?: string, preDate?: string) => void;
  initModelId?: string;
  holidays?: any[];
  onAddHoliday?: (date: string, label?: string) => void;
  onDeleteHoliday?: (id: string) => void;
  isMobile?: boolean;
}) {
  const today = new Date();
  const [calYear,    setCalYear]    = useState(today.getFullYear());
  const [calMonth,   setCalMonth]   = useState(today.getMonth());
  const [selDate,    setSelDate]    = useState<string|null>(null);
  const [modelFilter,setModelFilter]= useState(initModelId); // 모델 필터
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [hDate,  setHDate]  = useState("");
  const [hLabel, setHLabel] = useState("휴무일");
  const [dayView, setDayView] = useState<"list"|"timeline">("list"); // 날짜 패널 보기 모드

  // 화면 폭에 따라 월간 셀 최대 표시 개수 (넓으면 5, 좁으면 4)
  const [winW, setWinW] = useState(typeof window!=="undefined"?window.innerWidth:1440);
  useEffect(()=>{ const h=()=>setWinW(window.innerWidth); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);
  const cellMax = winW>=1500 ? 4 : 3;

  // "HH:MM" → 분 단위
  const toMin = (t?:string|null) => { if(!t) return null; const p=t.split(":"); const h=Number(p[0]), m=Number(p[1]||0); return isNaN(h)?null:h*60+(isNaN(m)?0:m); };

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const prevDays    = new Date(calYear, calMonth, 0).getDate();
  const monthStr    = `${calYear}-${String(calMonth+1).padStart(2,"0")}`;
  const todayStr    = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  // 필터 적용된 섭외
  const filteredBookings = modelFilter ? bookings.filter(b=>b.model_id===modelFilter) : bookings;

  const bookingsByDate: Record<string, any[]> = {};
  filteredBookings.forEach(b=>{ if(b.shoot_date){ if(!bookingsByDate[b.shoot_date]) bookingsByDate[b.shoot_date]=[]; bookingsByDate[b.shoot_date].push(b); }});

  // ── [추가] 날짜별 충돌 정보 ──
  // 주의: 충돌 검사는 "모델 필터와 무관하게" 전체 섭외로 해야 정확함
  //  (필터로 한 모델만 보더라도, 충돌은 같은 모델 일정 간에 발생하므로 동일 결과지만,
  //   전체 보기일 때 여러 모델이 섞여도 findConflicts가 모델별로 그룹핑하므로 안전)
  const conflictByDate: Record<string, { conflictIds: Set<string>; worst: string }> = {};
  Object.entries(bookingsByDate).forEach(([date, list]) => {
    const r = findConflicts(list);
    if (r.conflictIds.size > 0) conflictByDate[date] = r;
  });

  const selDateBookings = selDate ? (bookingsByDate[selDate]||[]) : [];

  // 휴무일 맵 (수동 저장분)
  const holidayByDate: Record<string, any> = {};
  holidays.forEach(h=>{ if(h.date) holidayByDate[h.date]=h; });

  const prevMonth = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else{setCalMonth(m=>m-1);}; setSelDate(null); };
  const nextMonth = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else{setCalMonth(m=>m+1);}; setSelDate(null); };

  const cells: { date:string|null; day:number; cur:boolean }[] = [];
  for(let i=0;i<firstDay;i++) cells.push({ date:null, day:prevDays-firstDay+i+1, cur:false });
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cells.push({ date:ds, day:d, cur:true });
  }
  let nd=1; while(cells.length<42) cells.push({ date:null, day:nd++, cur:false });

  const DOW = ["일","월","화","수","목","금","토"];

  // 비자 범위 계산 (모델 필터 시)
  const filteredModel = modelFilter ? models.find(m=>m.id===modelFilter) : null;
  const visaEntry = filteredModel?.visa_entry || null;
  const visaExit  = filteredModel?.visa_exit  || null;

  // 날짜가 비자 유효 범위 밖인지
  const isOutsideVisa = (date: string) => {
    if (!filteredModel?.is_foreigner || !visaEntry || !visaExit) return false;
    return date < visaEntry || date > visaExit;
  };

  const filterModel = models.find(m=>m.id===modelFilter);

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><CalendarDays size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 캘린더</h1>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>{ setHDate(selDate||todayStr); setHLabel("휴무일"); setShowHolidayForm(true); }} style={{ ...btnS(C.card2), border:`1px solid ${C.border}`, color:C.textSub }}><CalendarOff size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 휴무일 지정</button>
          <button onClick={()=>onAddBooking(modelFilter||undefined, selDate||undefined)} style={btnS(C.green)}>+ 섭외 추가</button>
        </div>
      </div>

      {/* 모델 필터 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:C.muted, fontWeight:600 }}>모델 필터:</span>
        <button onClick={()=>setModelFilter("")} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${!modelFilter?C.blue:C.border}`, background:!modelFilter?C.blue+"22":"transparent", color:!modelFilter?C.blue:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>전체</button>
        {models.map(m=>{
          const isSel = modelFilter===m.id;
          return (
            <button key={m.id} onClick={()=>{ setModelFilter(isSel?"":m.id); setSelDate(null); }}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:20, border:`1px solid ${isSel?C.blue:C.border}`, background:isSel?C.blue+"22":"transparent", color:isSel?C.blue:C.textSub, fontSize:12, fontWeight:isSel?700:400, cursor:"pointer" }}
            >
              {m.thumb_url
                ? <img src={m.thumb_url} alt="" style={{ width:16, height:16, borderRadius:"50%", objectFit:"cover" }} />
                : <span style={{ width:16, height:16, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"white", fontWeight:800 }}>{m.name[0]}</span>
              }
              {m.name}
              {m.is_foreigner&&<Plane size={11} color={C.orange} style={{ flexShrink:0 }}/>}
            </button>
          );
        })}
      </div>

      {/* 비자 정보 배너 (외국인 모델 필터 시) */}
      {filteredModel?.is_foreigner&&visaEntry&&visaExit&&(
        <div style={{ display:"flex", gap:12, alignItems:"center", background:"#1a2f4a", border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", marginBottom:14 }}>
          <Plane size={14} color={C.blue} style={{ flexShrink:0 }} />
          <span style={{ fontSize:12, color:C.textSub }}><strong style={{ color:C.text }}>{filteredModel.name}</strong> 비자 유효 기간</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:700 }}>{visaEntry.replace(/-/g,".")} ~ {visaExit.replace(/-/g,".")}</span>
          {(()=>{
            const dday = visaDday(visaExit);
            const color = dday==="만료"?C.red:parseInt(dday.slice(2))<=7?C.orange:C.green;
            return <span style={{ marginLeft:"auto", flexShrink:0, whiteSpace:"nowrap", background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{dday}</span>;
          })()}
        </div>
      )}

      {/* 월 네비 */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <button onClick={prevMonth} style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:16 }}>‹</button>
        <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text, minWidth:140, textAlign:"center" }}>{calYear}년 {calMonth+1}월</h2>
        <button onClick={nextMonth} style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:16 }}>›</button>
        <button onClick={()=>{ setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setSelDate(todayStr); }} style={{ ...btnS(C.blue), padding:"5px 14px", fontSize:12 }}>오늘</button>
        {(()=>{ const cnt=filteredBookings.filter(b=>b.shoot_date?.startsWith(monthStr)).length; return cnt>0?<span style={{ fontSize:12, color:C.muted }}>이달 <strong style={{ color:C.text }}>{cnt}건</strong></span>:null; })()}
        {/* [추가] 이달 충돌 건수 요약 */}
        {(()=>{
          const monthConflicts = Object.entries(conflictByDate).filter(([d])=>d.startsWith(monthStr));
          if (monthConflicts.length===0) return null;
          const hasOverlap = monthConflicts.some(([,v])=>v.worst==="OVERLAP");
          const col = hasOverlap ? C.red : C.orange;
          return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:col+"18", border:`1px solid ${col}44`, borderRadius:20, padding:"3px 11px", fontSize:12, color:col, fontWeight:700 }}>
            <AlertTriangle size={12} style={{ flexShrink:0 }}/> 충돌 {monthConflicts.length}일
          </span>;
        })()}
      </div>

      {(!isMobile && selDate && dayView==="timeline") ? (() => {
        const sorted=[...selDateBookings].sort((a,b)=>(a.start_time||"")<(b.start_time||"")?-1:1);
        // 그날 일정 있는 모델만 컬럼 생성 (등장 순)
        const idsSeen:string[]=[]; sorted.forEach(b=>{ if(b.model_id && !idsSeen.includes(b.model_id)) idsSeen.push(b.model_id); });
        const dayModels = idsSeen.map(id=>models.find(m=>m.id===id)).filter(Boolean);
        const dayConflict = conflictByDate[selDate!];
        const cWorst = dayConflict?.worst==="OVERLAP"?C.red:C.orange;
        // 시간 범위 (기본 09~18, 일정에 맞춰 확장)
        let minM=9*60, maxM=18*60;
        selDateBookings.forEach(b=>{ const s=toMin(b.start_time), e=toMin(b.end_time); if(s!=null) minM=Math.min(minM,s); if(e!=null) maxM=Math.max(maxM,e); });
        minM=Math.floor(minM/60)*60; maxM=Math.ceil(maxM/60)*60;
        const PXH=58, pxPerMin=PXH/60;
        const hours:number[]=[]; for(let h=minM/60; h<=maxM/60; h++) hours.push(h);
        const gridH=(maxM-minM)*pxPerMin;
        const dayTotal=selDateBookings.reduce((s,b)=>s+(b.shoot_fee||0),0);
        const holdCnt=selDateBookings.filter(b=>b.status==="HOLD").length;
        return (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            {/* 헤더 */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", borderBottom:`1px solid ${C.border}`, flexWrap:"wrap" }}>
              <button onClick={()=>setSelDate(null)} style={{ background:C.card2, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"5px 11px", cursor:"pointer", fontSize:13 }}>‹ 달력</button>
              <span style={{ fontSize:16, fontWeight:800, color:C.text }}><ClipboardList size={15} style={{ verticalAlign:-2, flexShrink:0 }}/> {selDate!.replace(/-/g,".")}</span>
              <span style={{ fontSize:12, color:C.muted }}>총 <strong style={{ color:C.text }}>{selDateBookings.length}건</strong> · 모델 {dayModels.length}명</span>
              {dayConflict&&<span style={{ display:"inline-flex", alignItems:"center", gap:4, background:cWorst+"18", border:`1px solid ${cWorst}44`, borderRadius:20, padding:"3px 10px", fontSize:11, color:cWorst, fontWeight:700 }}><AlertTriangle size={11} style={{ flexShrink:0 }}/> 더블부킹 감지</span>}
              <div style={{ marginLeft:"auto", display:"flex", gap:0, background:C.card2, borderRadius:8, padding:3, border:`1px solid ${C.border}` }}>
                {(["list","timeline"] as const).map(v=>(
                  <button key={v} onClick={()=>setDayView(v)} style={{ padding:"6px 14px", borderRadius:6, border:"none", background:dayView===v?C.blue:"transparent", color:dayView===v?"white":C.muted, fontSize:12, fontWeight:700, cursor:"pointer" }}>{v==="list"?"목록 보기":"타임라인"}</button>
                ))}
              </div>
              <button onClick={()=>onAddBooking(modelFilter||undefined, selDate||undefined)} style={{ ...btnS(C.green), padding:"6px 14px", fontSize:12 }}>+ 섭외 추가</button>
            </div>

            {selDateBookings.length===0 ? (
              <div style={{ padding:"48px 0", textAlign:"center", color:C.muted, fontSize:13 }}>이 날 섭외 일정이 없습니다.</div>
            ) : (
            <div style={{ display:"flex", overflowX:"auto" }}>
              {/* 시간축 */}
              <div style={{ width:56, flexShrink:0, borderRight:`1px solid ${C.border}` }}>
                <div style={{ height:40, borderBottom:`1px solid ${C.border}`, background:C.card2 }}/>
                <div style={{ position:"relative", height:gridH }}>
                  {hours.map((h,i)=>(<div key={h} style={{ position:"absolute", top:i*PXH-7, right:8, fontSize:11, color:C.muted, fontWeight:600 }}>{String(h).padStart(2,"0")}:00</div>))}
                </div>
              </div>
              {/* 모델 컬럼 */}
              {dayModels.map((m:any)=>{
                const mbs=selDateBookings.filter(b=>b.model_id===m.id);
                return (
                  <div key={m.id} style={{ flex:"1 0 200px", minWidth:200, borderRight:`1px solid ${C.border}` }}>
                    <div style={{ height:40, display:"flex", alignItems:"center", gap:8, padding:"0 12px", borderBottom:`1px solid ${C.border}`, background:C.card2 }}>
                      {m.thumb_url
                        ? <img src={m.thumb_url} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>
                        : <span style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:11, fontWeight:800, flexShrink:0 }}>{(m.name||"?")[0]}</span>}
                      <span style={{ fontSize:13, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.name}</span>
                      {m.is_foreigner&&m.visa_exit&&(()=>{ const dd=visaDday(m.visa_exit); const col=dd==="만료"?C.red:parseInt(dd.slice(2))<=7?C.orange:C.green; return <span style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:2, color:col, fontSize:10, fontWeight:700, flexShrink:0 }}><Plane size={9} style={{ flexShrink:0 }}/>{dd}</span>; })()}
                    </div>
                    <div style={{ position:"relative", height:gridH }}>
                      {hours.map((h,i)=>(<div key={h} style={{ position:"absolute", top:i*PXH, left:0, right:0, borderTop:`1px solid ${C.border}55` }}/>))}
                      {mbs.map(b=>{
                        const s=toMin(b.start_time); if(s==null) return null;
                        const e=toMin(b.end_time);
                        const top=(s-minM)*pxPerMin; const bh=Math.max(((e??s+60)-s)*pxPerMin,34);
                        const st=STATUS[b.status]||STATUS.INQUIRY; const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT;
                        const isC=dayConflict?.conflictIds.has(b.id); const client=customers.find(c=>c.id===b.customer_id);
                        return (
                          <div key={b.id} onClick={()=>onSelectBooking(b)} title={`${m.name} · ${client?.name||"?"} · ${bt.label} · ${st.label}`}
                            style={{ position:"absolute", top, left:6, right:6, height:bh, background:st.color+"22", border:`1.5px solid ${isC?cWorst:st.color+"88"}`, borderLeft:`3px solid ${isC?cWorst:st.color}`, borderRadius:7, padding:"4px 8px", cursor:"pointer", overflow:"hidden", boxSizing:"border-box" }}>
                            <div style={{ fontSize:11, fontWeight:800, color:st.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{fmtTime(b.start_time,b.end_time)}</div>
                            <div style={{ fontSize:12, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{client?.name||"?"}</div>
                            {bh>54&&<div style={{ fontSize:10, color:bt.color, fontWeight:700, marginTop:1, whiteSpace:"nowrap" }}><TypeIcon type={b.booking_type} size={9}/> {bt.label}</div>}
                            {isC&&<div style={{ marginTop:2, display:"inline-flex", alignItems:"center", gap:3, color:cWorst, fontSize:9, fontWeight:800 }}><AlertTriangle size={9} style={{ flexShrink:0 }}/> 시간 겹침</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* 정산 요약 푸터 */}
            {selDateBookings.length>0&&(
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderTop:`1px solid ${C.border}`, background:C.card2, flexWrap:"wrap" }}>
                <Coins size={14} color={C.yellow} style={{ flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{selDate!.slice(5).replace("-",".")} 정산 요약</span>
                <span style={{ fontSize:12, color:C.muted }}>섭외 {selDateBookings.length}건</span>
                {holdCnt>0&&<span style={{ fontSize:12, color:C.yellow, fontWeight:700 }}><AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> HOLD {holdCnt}건</span>}
                <span style={{ marginLeft:"auto", fontSize:18, fontWeight:800, color:C.yellow }}>{dayTotal.toLocaleString()}원</span>
              </div>
            )}
          </div>
        );
      })() : (
      <div style={{ display:(!isMobile && selDate)?"flex":"block", gap:16, alignItems:"flex-start" }}>
      {/* 달력 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", ...((!isMobile && selDate)?{flex:1, minWidth:0}:{marginBottom:selDate?16:0}) }}>
        {/* 요일 헤더 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${C.border}` }}>
          {DOW.map((d,i)=>(
            <div key={d} style={{ padding:"9px 0", textAlign:"center", fontSize:11, fontWeight:700, color:i===0?C.red:i===6?C.blue:C.muted }}>{d}</div>
          ))}
        </div>
        {/* 날짜 셀 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
          {cells.map((cell,i)=>{
            const col=i%7;
            const isToday    = cell.cur&&cell.date===todayStr;
            const isSel      = cell.cur&&cell.date===selDate;
            const outsideVisa= cell.cur&&cell.date?isOutsideVisa(cell.date):false;
            const dayBookings= cell.date?(bookingsByDate[cell.date]||[]):[];
            const isVisaExit = !!cell.date && !!visaExit && cell.date===visaExit;
            const krHol  = cell.date ? KR_HOLIDAYS[cell.date] : undefined;
            const manHol = cell.date ? holidayByDate[cell.date] : undefined;

            // ── [추가] 충돌 정보 ──
            const dayConflict = cell.date ? conflictByDate[cell.date] : undefined;
            const conflictColor = dayConflict ? (dayConflict.worst === "OVERLAP" ? C.red : C.orange) : null;

            let cellBg = "transparent";
            if (isSel)         cellBg = C.blue+"18";
            else if (isToday)  cellBg = C.card2;

            return (
              <div key={i} onClick={()=>{ if(cell.cur&&cell.date){ const has=(bookingsByDate[cell.date]||[]).length>0; if(has){ setSelDate(cell.date===selDate?null:cell.date); } else { onAddBooking(modelFilter||undefined, cell.date); } }}}
                style={{ height:isMobile?52:"calc((100vh - 360px) / 6)", minHeight:isMobile?52:110, overflow:"hidden", padding:isMobile?"4px 2px":"7px 7px 5px", borderRight:col<6?`1px solid ${C.border}`:"none", borderBottom:i<35?`1px solid ${C.border}`:"none", background:cellBg, cursor:cell.cur?"pointer":"default", transition:"background 0.12s", position:"relative",
                  ...(conflictColor ? { boxShadow:`inset 0 0 0 2px ${conflictColor}` } : {}) }}
                onMouseEnter={e=>{ if(cell.cur&&!isSel) e.currentTarget.style.background=C.card2; }}
                onMouseLeave={e=>{ if(cell.cur&&!isSel) e.currentTarget.style.background=isToday?C.card2:"transparent"; }}
              >
                {/* 비자 만료일 표시선 */}
                {isVisaExit&&<div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.red, borderRadius:"2px 2px 0 0" }} />}

                {/* 날짜 숫자 */}
                <div style={{ marginBottom:3, textAlign:isMobile?"center":"left" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:22, height:22, borderRadius:"50%", fontSize:12, fontWeight:isToday?800:600, background:isToday?C.blue:isVisaExit?C.red+"22":"transparent", color:isToday?"white":isVisaExit?C.red:!cell.cur?C.border:(krHol||manHol)?C.red:col===0?C.red:col===6?C.blue:C.text }}>{cell.day}</span>
                  {/* [추가] 충돌 ⚠️ 배지 */}
                  {dayConflict&&<span title={dayConflict.worst==="OVERLAP"?"시간 겹침 충돌":"완충시간 부족"} style={{ marginLeft:3, display:"inline-flex", alignItems:"center", verticalAlign:"middle" }}><AlertTriangle size={isMobile?9:11} color={conflictColor!} strokeWidth={2.4} style={{ flexShrink:0 }}/></span>}
                  {!isMobile&&isVisaExit&&<span style={{ fontSize:9, color:C.red, fontWeight:700, marginLeft:2 }}>출국</span>}
                  {!isMobile&&krHol&&<span style={{ fontSize:9, color:C.red, fontWeight:700, marginLeft:2 }}>{krHol}</span>}
                  {!isMobile&&!krHol&&manHol&&<span style={{ fontSize:9, color:C.orange, fontWeight:700, marginLeft:2 }}>{manHol.label}</span>}
                </div>

                {/* 섭외 표시: 모바일=점, 데스크톱=뱃지 */}
                {isMobile ? (
                  dayBookings.length>0 ? (
                    <div style={{ display:"flex", gap:3, justifyContent:"center" }}>
                      {dayBookings.slice(0,4).map((b,bi)=>{ const ds=STATUS[b.status]||STATUS.INQUIRY; const isC=dayConflict?.conflictIds.has(b.id); return <span key={bi} style={{ width:7, height:7, borderRadius:"50%", background:isC?conflictColor!:ds.color, display:"inline-block", ...(isC?{boxShadow:`0 0 0 1.5px ${conflictColor}`}:{}) }}/>; })}
                      {dayBookings.length>4&&<span style={{ fontSize:9, color:C.muted, lineHeight:"7px" }}>+</span>}
                    </div>
                  ) : null
                ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  {dayBookings.slice(0,cellMax).map((b,bi)=>{
                    const m=models.find(mm=>mm.id===b.model_id);
                    const bt = BOOKING_TYPES[b.booking_type||"SHOOT"] || BOOKING_TYPES.SHOOT;
                    const s=STATUS[b.status]||STATUS.INQUIRY;
                    const isConflict = dayConflict?.conflictIds.has(b.id);  // [추가]
                    return (
                      <div key={bi} onClick={e=>{ e.stopPropagation(); onSelectBooking(b); }}
                        style={{ background:s.color+"28", color:s.color, border:`1px solid ${isConflict?(conflictColor!):s.color+"44"}`, borderRadius:4, padding:"3px 6px", fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
                        title={`${m?.name||"?"} · ${bt.label} · ${s.label}${isConflict?" · ⚠️ 일정 충돌":""}`}
                      >
                        {isConflict&&<AlertTriangle size={11} color={conflictColor!} strokeWidth={2.6} style={{ flexShrink:0 }}/>}
                        <TypeIcon type={b.booking_type} size={11}/>
                        {m?.thumb_url
                          ? <img src={m.thumb_url} alt="" style={{ width:14, height:14, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                          : <span style={{ fontSize:12 }}>{(m?.name||"?")[0]}</span>
                        }
                        <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{m?.name||"?"}</span>
                      </div>
                    );
                  })}
                  {dayBookings.length>cellMax&&(
                    <div onClick={e=>{ e.stopPropagation(); cell.date&&setSelDate(cell.date); }}
                      style={{ fontSize:12, color:C.blue, fontWeight:700, padding:"2px 5px", background:C.blue+"18", borderRadius:4, cursor:"pointer", textAlign:"center" }}>
                      +{dayBookings.length-cellMax}건
                    </div>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 섭외 목록 */}
      {selDate&&(
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, ...(!isMobile?{width:380, flexShrink:0, maxHeight:"calc(100vh - 170px)", overflowY:"auto"}:{}) }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <p style={{ margin:0, fontWeight:800, fontSize:15, color:C.text }}><ClipboardList size={14} style={{ verticalAlign:-2, flexShrink:0 }}/> {selDate.replace(/-/g,".")}</p>
              <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>
                총 <strong style={{ color:C.text }}>{selDateBookings.length}건</strong>
                {selDateBookings.filter(b=>b.status==="HOLD").length>0&&<span style={{ marginLeft:8, color:C.yellow, fontWeight:700 }}><AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> HOLD {selDateBookings.filter(b=>b.status==="HOLD").length}건</span>}
                {isOutsideVisa(selDate)&&filteredModel&&<span style={{ marginLeft:8, color:C.red, fontWeight:700, fontSize:11 }}><AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 비자 범위 밖</span>}
                {KR_HOLIDAYS[selDate]&&<span style={{ marginLeft:8, color:C.red, fontWeight:700 }}><Flag size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> {KR_HOLIDAYS[selDate]}</span>}
                {holidayByDate[selDate]&&<span style={{ marginLeft:8, color:C.orange, fontWeight:700 }}><CalendarOff size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> {holidayByDate[selDate].label}</span>}
              </p>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {/* 휴무일 지정/해제 */}
              {holidayByDate[selDate]
                ? <button onClick={()=>onDeleteHoliday&&onDeleteHoliday(holidayByDate[selDate].id)} style={{ ...btnS("#3a1a1a"), border:`1px solid ${C.red}55`, color:C.red, padding:"6px 14px", fontSize:12 }}><CalendarOff size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 휴무일 해제</button>
                : <button onClick={()=>{ setHDate(selDate); setHLabel("휴무일"); setShowHolidayForm(true); }} style={{ ...btnS(C.card2), border:`1px solid ${C.border}`, color:C.textSub, padding:"6px 14px", fontSize:12 }}><CalendarOff size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 휴무일 지정</button>
              }
              {/* 날짜 클릭 → 해당 모델 + 날짜 pre-선택 섭외 등록 */}
              <button onClick={()=>onAddBooking(modelFilter||undefined, selDate)}
                style={{ ...btnS(C.green), padding:"6px 14px", fontSize:12 }}>
                {modelFilter&&filterModel ? `+ ${filterModel.name} 섭외 추가` : "+ 섭외 추가"}
              </button>
            </div>
          </div>

          {/* 보기 토글: 목록 / 타임라인 */}
          {!isMobile&&(
            <div style={{ display:"flex", gap:0, marginBottom:12, background:C.card2, borderRadius:8, padding:3, border:`1px solid ${C.border}` }}>
              {(["list","timeline"] as const).map(v=>(
                <button key={v} onClick={()=>setDayView(v)} style={{ flex:1, padding:"6px 0", borderRadius:6, border:"none", background:dayView===v?C.blue:"transparent", color:dayView===v?"white":C.muted, fontSize:12, fontWeight:700, cursor:"pointer" }}>{v==="list"?"목록 보기":"타임라인"}</button>
              ))}
            </div>
          )}

          {/* [추가] 충돌 상세 안내 박스 */}
          {conflictByDate[selDate]&&(()=>{
            const cInfo = conflictByDate[selDate];
            const col = cInfo.worst==="OVERLAP" ? C.red : C.orange;
            return (
              <div style={{ display:"flex", alignItems:"flex-start", gap:8, background:col+"18", border:`1px solid ${col}44`, borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
                <AlertTriangle size={14} color={col} style={{ flexShrink:0, marginTop:1 }} />
                <div>
                  <p style={{ margin:0, fontSize:12, color:col, fontWeight:700 }}>
                    {cInfo.worst==="OVERLAP" ? "일정 충돌 — 시간 겹침" : "일정 충돌 — 완충시간 부족"}
                  </p>
                  <p style={{ margin:"3px 0 0", fontSize:11, color:C.textSub, lineHeight:1.5 }}>
                    {cInfo.worst==="OVERLAP"
                      ? "같은 모델의 일정 시간이 겹칩니다. 한 건을 다른 시간·날짜로 옮기거나 취소하세요."
                      : "같은 모델의 일정 간격이 완충시간(촬영 2h·미팅 1h, 장소 이동 시 +1h)보다 짧습니다. 이동 가능 여부를 확인하세요."}
                  </p>
                </div>
              </div>
            );
          })()}

          {selDateBookings.length===0
            ? (
              <div style={{ textAlign:"center", padding:"24px 0" }}>
                <p style={{ color:C.muted, fontSize:13, margin:"0 0 12px" }}>이 날 섭외 일정이 없습니다.</p>
                {isOutsideVisa(selDate)&&filteredModel&&<p style={{ color:C.red, fontSize:12, margin:0 }}><AlertTriangle size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {filteredModel.name}의 비자 유효 기간({visaEntry?.replace(/-/g,".")} ~ {visaExit?.replace(/-/g,".")}) 밖입니다.</p>}
              </div>
            )
            : (()=>{
                const sorted=[...selDateBookings].sort((a,b)=>(a.start_time||"")<(b.start_time||"")?-1:1);
                const groups:Record<string,any[]>={}; const singles:any[]=[];
                sorted.forEach(b=>{ if(b.project_id){ (groups[b.project_id]=groups[b.project_id]||[]).push(b); } else singles.push(b); });
                const dayConflict = conflictByDate[selDate];
                let n=0;
                const Card=(b:any)=>{ n+=1; const idx=n;
                  const model=models.find(m=>m.id===b.model_id); const client=customers.find(c=>c.id===b.customer_id);
                  const s=STATUS[b.status]||STATUS.INQUIRY; const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT;
                  const isConflict = dayConflict?.conflictIds.has(b.id);  // [추가]
                  const cCol = dayConflict?.worst==="OVERLAP" ? C.red : C.orange;
                  return (
                    <div key={b.id} onClick={()=>onSelectBooking(b)}
                      style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:C.card2, borderRadius:10, border:`1px solid ${isConflict?cCol:C.border}`, cursor:"pointer", transition:"border-color 0.15s" }}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor=isConflict?cCol:s.color+"80")}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor=isConflict?cCol:C.border)}>
                      <span style={{ width:20, height:20, borderRadius:"50%", background:s.color+"33", color:s.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, flexShrink:0, marginTop:2 }}>{idx}</span>
                      {model?.thumb_url
                        ? <img src={model.thumb_url} alt="" style={{ width:34, height:34, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`2px solid ${s.color}50` }} />
                        : <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:13, flexShrink:0 }}>{(model?.name||"?")[0]}</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:C.text, lineHeight:1.3 }}>
                          {model?.name||"?"} <span style={{ color:C.muted, fontWeight:400, fontSize:13 }}>→ {client?.name||"?"}</span>
                          {isConflict&&<span style={{ marginLeft:6, display:"inline-flex", verticalAlign:"middle" }}><AlertTriangle size={12} color={cCol} strokeWidth={2.4} style={{ flexShrink:0 }}/></span>}
                        </p>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 8px", marginTop:4, fontSize:13, color:C.muted }}>
                          <span style={{ color:bt.color, fontWeight:700 }}><TypeIcon type={b.booking_type} size={10}/> {bt.label}</span>
                          {b.start_time&&<span><Clock size={10} style={{ verticalAlign:-1.5, flexShrink:0 }}/> {fmtTime(b.start_time,b.end_time)}</span>}
                          {b.location&&<span><MapPin size={10} style={{ verticalAlign:-1.5, flexShrink:0 }}/> {b.location}</span>}
                          {b.manager&&<span><User size={10} style={{ verticalAlign:-1.5, flexShrink:0 }}/> {b.manager}</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                        {b.shoot_fee>0&&<span style={{ fontSize:13, color:C.yellow, fontWeight:800, whiteSpace:"nowrap" }}>{b.shoot_fee.toLocaleString()}원</span>}
                        <Badge code={b.status} type={b.booking_type} />
                        {b.status==="CONFIRMED"&&!b.deposit_amt&&<span style={{ fontSize:10, color:C.red, fontWeight:700 }}>계약금 미설정</span>}
                      </div>
                    </div>
                  );
                };
                return (
                  <div style={{ display:"grid", gap:10 }}>
                    {Object.entries(groups).map(([pid,bs])=>{
                      const total=bs.reduce((sum,b)=>sum+(b.shoot_fee||0),0);
                      const ms=bs.map(b=>models.find(m=>m.id===b.model_id)).filter(Boolean);
                      return (
                        <div key={pid} style={{ border:`1px solid ${C.blue}55`, borderRadius:12, overflow:"hidden" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:C.blue+"14", borderBottom:`1px solid ${C.blue}33` }}>
                            <Folder size={13} color={C.blue} style={{ flexShrink:0 }}/>
                            <span style={{ fontSize:13, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{bs[0].project_name||"프로젝트"} <span style={{ color:C.muted, fontWeight:400 }}>· {customers.find(c=>c.id===bs[0].customer_id)?.name||"?"}</span></span>
                            <div style={{ display:"flex", marginLeft:6 }}>
                              {ms.slice(0,3).map((m:any,i)=>(m.thumb_url
                                ? <img key={i} src={m.thumb_url} alt="" style={{ width:20, height:20, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.card}`, marginLeft:i?-7:0 }} />
                                : <span key={i} style={{ width:20, height:20, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", border:`2px solid ${C.card}`, marginLeft:i?-7:0, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:9, fontWeight:800 }}>{(m.name||"?")[0]}</span>
                              ))}
                            </div>
                            <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>모델 {bs.length}명</span>
                            {total>0&&<span style={{ marginLeft:"auto", fontSize:13, color:C.yellow, fontWeight:800, whiteSpace:"nowrap" }}>{total.toLocaleString()}원</span>}
                          </div>
                          <div style={{ display:"grid", gap:8, padding:10 }}>{bs.map(Card)}</div>
                        </div>
                      );
                    })}
                    {singles.map(Card)}
                  </div>
                );
              })()
          }
        </div>
      )}
      </div>
      )}

      {/* ════ 모달: 휴무일 지정 ════ */}
      {showHolidayForm&&(
        <Modal onClose={()=>setShowHolidayForm(false)}>
          <h3 style={{ marginTop:0, color:C.text }}><CalendarOff size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 휴무일 지정</h3>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>날짜 *</label>
          <input style={inp} type="date" value={hDate} onChange={e=>setHDate(e.target.value)} />
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>휴무일 내용 *</label>
          <input style={inp} type="text" placeholder="예: 전사 휴무, 워크샵, 개인 휴가" value={hLabel} onChange={e=>setHLabel(e.target.value)} />
          <div style={{ display:"flex", gap:10, marginTop:6 }}>
            <button onClick={()=>{
              if (!hDate) return alert("날짜를 선택하세요");
              if (holidayByDate[hDate]) return alert(`이미 휴무일이 지정된 날짜입니다 (${holidayByDate[hDate].label})`);
              onAddHoliday&&onAddHoliday(hDate, hLabel.trim()||"휴무일");
              setShowHolidayForm(false);
            }} style={{ ...btnS(C.green), flex:1, padding:"10px 0", fontSize:13 }}>저장</button>
            <button onClick={()=>setShowHolidayForm(false)} style={{ ...btnS("#333"), flex:1, padding:"10px 0", fontSize:13 }}>취소</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
