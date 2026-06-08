import { C, inp, btnS } from "../theme";
import { STATUS, BOOKING_TYPES } from "../constants";
import { fmtDate, fmtTime } from "../lib/utils";
import Badge from "../components/Badge";
import TypeIcon from "../components/TypeIcon";
import { ClipboardList, Calendar, MapPin, User, Coins, Folder } from "../components/icons";

export default function BookingsView({ filteredBookings, bookingQ, setBookingQ, bookingStatusF, setBookingStatusF, bookingManagerF, setBookingManagerF, bookingMonthF, setBookingMonthF, bookingMonths, memberNames, models, customers, openAddPicker, setSelectedBooking, isMobile = false }: {
  filteredBookings: any[]; bookingQ: string; setBookingQ: (v:string)=>void;
  bookingStatusF: string; setBookingStatusF: (v:string)=>void;
  bookingManagerF: string; setBookingManagerF: (v:string)=>void;
  bookingMonthF: string; setBookingMonthF: (v:string)=>void;
  bookingMonths: string[]; memberNames: string[]; models: any[]; customers: any[];
  openAddPicker: ()=>void; setSelectedBooking: (b:any)=>void;
  isMobile?: boolean;
}) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><ClipboardList size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 섭외 ({filteredBookings.length}건)</h1>
        <button onClick={openAddPicker} style={btnS(C.blue)}>+ 섭외 추가</button>
      </div>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:14, display:"flex", gap:10, flexWrap:"wrap" }}>
        <input style={{ ...inp, marginBottom:0, flex:"1 1 160px" }} placeholder="모델/고객사/프로젝트 검색" value={bookingQ} onChange={e=>setBookingQ(e.target.value)} />
        <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={bookingStatusF} onChange={e=>setBookingStatusF(e.target.value)}>
          <option value="ALL">전체 상태</option>
          {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0, flex:"1 1 120px" }} value={bookingManagerF} onChange={e=>setBookingManagerF(e.target.value)}>
          <option value="ALL">전체 담당자</option>
          {memberNames.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <select style={{ ...inp, marginBottom:0, flex:"1 1 110px" }} value={bookingMonthF} onChange={e=>setBookingMonthF(e.target.value)}>
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
                <TypeIcon type={b.booking_type} size={13}/>
                {(()=>{ const m=models.find((mm:any)=>mm.id===b.model_id); return m?.thumb_url
                  ? <img src={m.thumb_url} alt="" style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                  : <span style={{ width:24, height:24, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:10, fontWeight:800, flexShrink:0 }}>{(m?.name||"?")[0]}</span>; })()}
                <strong style={{ flex:1, fontSize:14, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{models.find((m:any)=>m.id===b.model_id)?.name||"?"} → {customers.find((c:any)=>c.id===b.customer_id)?.name||"?"}</strong>
                <Badge code={b.status} type={b.booking_type} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:C.textSub }}>
                <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}</span>
                {b.shoot_fee?<span style={{ marginLeft:"auto", color:C.yellow, fontWeight:700, flexShrink:0 }}>{b.shoot_fee.toLocaleString()}원</span>:null}
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
              <p style={{ flex:1, margin:0, fontSize:13, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                <strong style={{ fontSize:14, fontWeight:700, color:C.text }}>{models.find((m:any)=>m.id===b.model_id)?.name||"?"} → {customers.find((c:any)=>c.id===b.customer_id)?.name||"?"}</strong>
                <span style={{ color:C.textSub, fontWeight:700 }}> · <Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}</span>
                {b.location?<span style={{ color:C.textSub, fontWeight:700 }}> · <MapPin size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{b.location}</span>:null}
                {b.manager?<span style={{ color:C.textSub, fontWeight:700 }}> · <User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{b.manager}</span>:null}
              </p>
              {b.shoot_fee?<span style={{ color:C.yellow, fontWeight:700, fontSize:13, flexShrink:0, marginRight:4 }}><Coins size={12} style={{ verticalAlign:-2, flexShrink:0 }}/>{b.shoot_fee.toLocaleString()}원</span>:null}
              <Badge code={b.status} type={b.booking_type} />
            </div>
            );
        return (
          <div style={{ display:"grid", gap:8 }}>
            {order.map((item,oi)=>{
              if(item.type==="single") return Card(item.b);
              const bs=groups[item.pid!]; const total=bs.reduce((s,b)=>s+(b.shoot_fee||0),0);
              const ms=bs.map(b=>models.find((m:any)=>m.id===b.model_id)).filter(Boolean);
              return (
                <div key={"g"+oi} style={{ border:`1px solid ${C.blue}55`, borderRadius:12, overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", background:C.blue+"14", borderBottom:`1px solid ${C.blue}33`, flexWrap:"wrap" }}>
                    <Folder size={13} color={C.blue} style={{ flexShrink:0 }}/>
                    <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{bs[0].project_name||"프로젝트"} <span style={{ color:C.muted, fontWeight:400 }}>· {customers.find((c:any)=>c.id===bs[0].customer_id)?.name||"?"}</span></span>
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
                  <div style={{ display:"grid", gap:8, padding:10 }}>{bs.map(Card)}</div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
