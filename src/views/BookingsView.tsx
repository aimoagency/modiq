import { useState, useEffect } from "react";
import { C, inp, btnS } from "../theme";
import { STATUS, BOOKING_TYPES, statusOptionsForType } from "../constants";
import { fmtDate, fmtTime, bookingTotal } from "../lib/utils";
import Badge from "../components/Badge";
import TypeIcon from "../components/TypeIcon";
import { ClipboardList, Calendar, MapPin, User, Folder, Search } from "../components/icons";

export default function BookingsView({ filteredBookings, bookingQ, setBookingQ, bookingStatusF, setBookingStatusF, bookingTypeF, setBookingTypeF, bookingManagerF, setBookingManagerF, bookingMonthF, setBookingMonthF, bookingMonths, memberNames, models, customers, openAddPicker, setSelectedBooking, isMobile = false }: {
  filteredBookings: any[]; bookingQ: string; setBookingQ: (v:string)=>void;
  bookingStatusF: string; setBookingStatusF: (v:string)=>void;
  bookingTypeF: string; setBookingTypeF: (v:string)=>void;
  bookingManagerF: string; setBookingManagerF: (v:string)=>void;
  bookingMonthF: string; setBookingMonthF: (v:string)=>void;
  bookingMonths: string[]; memberNames: string[]; models: any[]; customers: any[];
  openAddPicker: ()=>void; setSelectedBooking: (b:any)=>void;
  isMobile?: boolean;
}) {
  // 검색칸 placeholder 타이핑 애니메이션 (모델 → 고객사 → 프로젝트 순환)
  const [ph, setPh] = useState("");
  useEffect(() => {
    const words = ["모델 검색", "고객사 검색", "프로젝트 검색"];
    let wi = 0, ci = 0, del = false, alive = true, timer: ReturnType<typeof setTimeout>;
    const run = () => {
      if (!alive) return;
      const w = words[wi];
      ci = del ? ci - 1 : ci + 1;
      setPh(w.slice(0, ci));
      let delay = del ? 55 : 110;
      if (!del && ci === w.length) { del = true; delay = 1100; }
      else if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; delay = 350; }
      timer = setTimeout(run, delay);
    };
    timer = setTimeout(run, 400);
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><ClipboardList size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 섭외 ({filteredBookings.length}건)</h1>
        <button onClick={openAddPicker} style={btnS(C.blue)}>+ 섭외 추가</button>
      </div>
      {/* 섭외 유형 필터 (칩) — 비촬영 선택 시 상태 필터는 요청/확정/완료/취소만 */}
      <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
        {(([["ALL","전체",C.blue]] as [string,string,string][]).concat(Object.entries(BOOKING_TYPES).map(([k,bt])=>[k,bt.label,bt.color] as [string,string,string]))).map(([k,l,col])=>{
          const on = bookingTypeF===k;
          return <button key={k} type="button" onClick={()=>{ setBookingTypeF(k); setBookingStatusF("ALL"); }}
            style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${on?col:C.border}`, background:on?col+"22":"transparent", color:on?col:C.muted, fontSize:13, fontWeight:on?700:500, cursor:"pointer" }}>{l}</button>;
        })}
      </div>
      <div style={{ width:"100%", boxSizing:"border-box", background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:14, display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"2fr 1fr 1fr 1fr", gap:10 }}>
        <div style={{ position:"relative", minWidth:0 }}>
          <Search size={15} style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:C.muted, pointerEvents:"none" }} />
          <input style={{ ...inp, marginBottom:0, paddingLeft:34 }} placeholder={`${ph}▌`} value={bookingQ} onChange={e=>setBookingQ(e.target.value)} />
        </div>
        <select style={{ ...inp, marginBottom:0 }} value={bookingStatusF} onChange={e=>setBookingStatusF(e.target.value)}>
          <option value="ALL">전체 상태</option>
          {(bookingTypeF!=="ALL" && BOOKING_TYPES[bookingTypeF] && !BOOKING_TYPES[bookingTypeF].hasContract
            ? statusOptionsForType(bookingTypeF)
            : Object.entries(STATUS).map(([k,v])=>[k,v.label] as [string,string])
          ).map(([k,l])=><option key={k} value={k}>{l}</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0 }} value={bookingManagerF} onChange={e=>setBookingManagerF(e.target.value)}>
          <option value="ALL">전체 담당자</option>
          {memberNames.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0 }} value={bookingMonthF} onChange={e=>setBookingMonthF(e.target.value)}>
          <option value="ALL">전체 월</option>
          {bookingMonths.map(m=><option key={m} value={m}>{m.replace("-",".")}</option>)}
        </select>
      </div>
      {filteredBookings.length===0 ? <p style={{ color:C.muted }}>결과 없음</p> : (()=>{
        const order:{type:string;pid?:string;b?:any}[]=[]; const groups:Record<string,any[]>={};
        filteredBookings.forEach(b=>{
          if(b.project_id){ if(!groups[b.project_id]){ groups[b.project_id]=[]; order.push({type:"group",pid:b.project_id}); } groups[b.project_id].push(b); }
          else order.push({type:"single",b});
        });
        // 모델 아바타(공통)
        const avatar=(m:any, size:number)=> m?.thumb_url
          ? <img src={m.thumb_url} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
          : <span style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:size*0.42, fontWeight:800, flexShrink:0 }}>{(m?.name||"?")[0]}</span>;
        // ── Vercel식 행: 하나의 컨테이너 안 얇은 divider 행 · 고정 컬럼 정렬 · hover 하이라이트 ──
        const Row=(b:any, bt:string, inGroup=false)=>{
          const m=models.find((mm:any)=>mm.id===b.model_id);
          const cli=customers.find((c:any)=>c.id===b.customer_id)?.name||"?";
          const bk=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT;
          const amt=bookingTotal(b);
          const accent=inGroup?{ boxShadow:`inset 3px 0 0 ${C.blue}55` }:{};
          const typeBadge=<span style={{ background:bk.color+"22", color:bk.color, border:`1px solid ${bk.color}44`, borderRadius:4, padding:"2px 6px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:3, justifySelf:"start" }}><TypeIcon type={b.booking_type} size={11}/> {bk.label}</span>;
          if (isMobile) return (
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ padding:"10px 14px", borderTop:bt, cursor:"pointer", ...accent }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <span style={{ color:bk.color, display:"inline-flex", flexShrink:0 }}><TypeIcon type={b.booking_type} size={13}/></span>
                {avatar(m,24)}
                <strong style={{ flex:1, minWidth:0, fontSize:14, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m?.name||"?"} → {cli}</strong>
                <Badge code={b.status} type={b.booking_type} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.textSub }}>
                <span style={{ flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}</span>
                {amt>0?<span style={{ marginLeft:"auto", color:C.yellow, fontWeight:700, flexShrink:0 }}>{amt.toLocaleString()}원</span>:null}
              </div>
            </div>
          );
          return (
            <div key={b.id} onClick={()=>setSelectedBooking(b)}
              onMouseEnter={e=>(e.currentTarget.style.background=C.card2)}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              style={{ display:"grid", gridTemplateColumns:"66px minmax(0,1.5fr) 152px minmax(0,1fr) 116px 104px 84px", alignItems:"center", gap:12, padding:"11px 16px", borderTop:bt, cursor:"pointer", transition:"background 0.12s", ...accent }}>
              {typeBadge}
              <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>{avatar(m,24)}<strong style={{ fontSize:13.5, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m?.name||"?"} → {cli}</strong></span>
              <span style={{ fontSize:12.5, color:C.textSub, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}</span>
              <span style={{ fontSize:12.5, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.location ? <><MapPin size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.location}</> : ""}</span>
              <span style={{ fontSize:12.5, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.manager ? <><User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.manager}</> : ""}</span>
              <span style={{ textAlign:"right", color:amt>0?C.yellow:C.muted, fontWeight:700, fontSize:13, whiteSpace:"nowrap" }}>{amt>0 ? amt.toLocaleString()+"원" : "—"}</span>
              <span style={{ display:"flex", justifyContent:"flex-end" }}><Badge code={b.status} type={b.booking_type} /></span>
            </div>
          );
        };
        const GroupHeader=(bs:any[], oi:number, bt:string)=>{
          const total=bs.reduce((s,b)=>s+bookingTotal(b),0);
          const ms=bs.map(b=>models.find((m:any)=>m.id===b.model_id)).filter(Boolean);
          const avs=<div style={{ display:"flex", flexShrink:0 }}>{ms.slice(0,3).map((m:any,i:number)=>(
            <span key={i} style={{ marginLeft:i?-7:0, border:`2px solid ${C.card}`, borderRadius:"50%", display:"inline-flex" }}>{avatar(m,20)}</span>
          ))}</div>;
          return (
            <div key={"g"+oi} style={{ display:"flex", alignItems:"center", gap:8, padding:isMobile?"9px 12px":"9px 16px", borderTop:bt, background:C.blue+"10", flexWrap:isMobile?"wrap":"nowrap" }}>
              <Folder size={13} color={C.blue} style={{ flexShrink:0 }}/>
              <span style={{ flex:"1 1 auto", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:13.5, fontWeight:700, color:C.text }}>{bs[0].project_name||"프로젝트"} <span style={{ color:C.muted, fontWeight:400 }}>· {customers.find((c:any)=>c.id===bs[0].customer_id)?.name||"?"}</span></span>
              {avs}
              <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}>모델 {bs.length}명 · {fmtDate(bs[0].shoot_date)}</span>
              {total>0&&<span style={{ marginLeft:"auto", fontSize:13.5, color:C.yellow, fontWeight:800, whiteSpace:"nowrap" }}>{total.toLocaleString()}원</span>}
            </div>
          );
        };
        return (
          <div style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", background:C.card }}>
            {(()=>{
              const out:any[]=[]; let first=true;
              const top=()=>{ const t=first?"none":`1px solid ${C.border}`; first=false; return t; };
              order.forEach((item,oi)=>{
                if(item.type==="single") out.push(Row(item.b, top()));
                else { const bs=groups[item.pid!]; out.push(GroupHeader(bs, oi, top())); bs.forEach((b:any)=>out.push(Row(b, top(), true))); }
              });
              return out;
            })()}
          </div>
        );
      })()}
    </div>
  );
}
