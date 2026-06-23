import { useState, useEffect } from "react";
import { C, inp, btnS } from "../theme";
import { STATUS, BOOKING_TYPES, statusOptionsForType } from "../constants";
import { fmtDate, fmtTime, bookingTotal } from "../lib/utils";
import Badge from "../components/Badge";
import TypeIcon from "../components/TypeIcon";
import { ClipboardList, Calendar, MapPin, User, Coins, Folder, Search } from "../components/icons";

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
        const Card=(b:any)=> isMobile ? (
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                {(()=>{ const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT; return <span style={{ color:bt.color, display:"inline-flex", flexShrink:0 }}><TypeIcon type={b.booking_type} size={13}/></span>; })()}
                {(()=>{ const m=models.find((mm:any)=>mm.id===b.model_id); return m?.thumb_url
                  ? <img src={m.thumb_url} alt="" style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  : <span style={{ width:24, height:24, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:10, fontWeight:800, flexShrink:0 }}>{(m?.name||"?")[0]}</span>; })()}
                <strong style={{ flex:1, minWidth:0, fontSize:14, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{models.find((m:any)=>m.id===b.model_id)?.name||"?"} → {customers.find((c:any)=>c.id===b.customer_id)?.name||"?"}</strong>
                <Badge code={b.status} type={b.booking_type} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.textSub }}>
                <span style={{ flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}</span>
                {bookingTotal(b)>0?<span style={{ marginLeft:"auto", color:C.yellow, fontWeight:700, flexShrink:0 }}>{bookingTotal(b).toLocaleString()}원</span>:null}
              </div>
            </div>
            ) : (
            <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"border-color 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
              onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
            >
              {(()=>{ const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT; return <span style={{ background:bt.color+"22", color:bt.color, border:`1px solid ${bt.color}44`, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:700, flexShrink:0 }}><TypeIcon type={b.booking_type} size={11}/> {bt.label}</span>; })()}
              {(()=>{ const m=models.find((mm:any)=>mm.id===b.model_id); return m?.thumb_url
                ? <img src={m.thumb_url} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                : <span style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:10, fontWeight:800, flexShrink:0 }}>{(m?.name||"?")[0]}</span>; })()}
              <p style={{ flex:1, minWidth:0, margin:0, fontSize:13, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <strong style={{ fontSize:14, fontWeight:700, color:C.text }}>{models.find((m:any)=>m.id===b.model_id)?.name||"?"} → {customers.find((c:any)=>c.id===b.customer_id)?.name||"?"}</strong>
                <span style={{ color:C.textSub, fontWeight:700 }}> · <Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}</span>
                {b.location?<span style={{ color:C.textSub, fontWeight:700 }}> · <MapPin size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{b.location}</span>:null}
                {b.manager?<span style={{ color:C.textSub, fontWeight:700 }}> · <User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{b.manager}</span>:null}
              </p>
              {bookingTotal(b)>0?<span style={{ color:C.yellow, fontWeight:700, fontSize:13, flexShrink:0, marginRight:4 }}><Coins size={12} style={{ verticalAlign:-2, flexShrink:0 }}/>{bookingTotal(b).toLocaleString()}원</span>:null}
              <Badge code={b.status} type={b.booking_type} />
            </div>
            );
        return (
          <div style={{ width:"100%", boxSizing:"border-box", display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:8 }}>
            {order.map((item,oi)=>{
              if(item.type==="single") return Card(item.b);
              const bs=groups[item.pid!]; const total=bs.reduce((s,b)=>s+bookingTotal(b),0);
              const ms=bs.map(b=>models.find((m:any)=>m.id===b.model_id)).filter(Boolean);
              return (
                <div key={"g"+oi} style={{ border:`1px solid ${C.blue}55`, borderRadius:12, overflow:"hidden" }}>
                  {isMobile ? (
                    <div style={{ padding:"10px 12px", background:C.blue+"14", borderBottom:`1px solid ${C.blue}33` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                        <Folder size={13} color={C.blue} style={{ flexShrink:0 }}/>
                        <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:14, fontWeight:700, color:C.text }}>{bs[0].project_name||"프로젝트"} <span style={{ color:C.muted, fontWeight:400 }}>· {customers.find((c:any)=>c.id===bs[0].customer_id)?.name||"?"}</span></span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ display:"flex", flexShrink:0 }}>
                          {ms.slice(0,3).map((m:any,i:number)=>(m.thumb_url
                            ? <img key={i} src={m.thumb_url} alt="" style={{ width:20, height:20, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.card}`, marginLeft:i?-7:0 }} />
                            : <span key={i} style={{ width:20, height:20, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", border:`2px solid ${C.card}`, marginLeft:i?-7:0, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:9, fontWeight:800 }}>{(m.name||"?")[0]}</span>
                          ))}
                        </div>
                        <span style={{ flex:1, minWidth:0, fontSize:12, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>모델 {bs.length}명 · {fmtDate(bs[0].shoot_date)}</span>
                        {total>0&&<span style={{ marginLeft:"auto", fontSize:14, color:C.yellow, fontWeight:800, whiteSpace:"nowrap", flexShrink:0 }}>{total.toLocaleString()}원</span>}
                      </div>
                    </div>
                  ) : (
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", background:C.blue+"14", borderBottom:`1px solid ${C.blue}33`, flexWrap:"wrap" }}>
                    <Folder size={13} color={C.blue} style={{ flexShrink:0 }}/>
                    <span style={{ flex:"1 1 auto", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:14, fontWeight:700, color:C.text }}>{bs[0].project_name||"프로젝트"} <span style={{ color:C.muted, fontWeight:400 }}>· {customers.find((c:any)=>c.id===bs[0].customer_id)?.name||"?"}</span></span>
                    <div style={{ display:"flex", marginLeft:4 }}>
                      {ms.slice(0,3).map((m:any,i:number)=>(m.thumb_url
                        ? <img key={i} src={m.thumb_url} alt="" style={{ width:20, height:20, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.card}`, marginLeft:i?-7:0 }} />
                        : <span key={i} style={{ width:20, height:20, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", border:`2px solid ${C.card}`, marginLeft:i?-7:0, display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:9, fontWeight:800 }}>{(m.name||"?")[0]}</span>
                      ))}
                    </div>
                    <span style={{ fontSize:12, color:C.muted }}>모델 {bs.length}명</span>
                    <span style={{ fontSize:12, color:C.muted }}>· {fmtDate(bs[0].shoot_date)}</span>
                    {total>0&&<span style={{ marginLeft:"auto", fontSize:14, color:C.yellow, fontWeight:800 }}>{total.toLocaleString()}원</span>}
                  </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:8, padding:isMobile?8:10 }}>{bs.map(Card)}</div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
