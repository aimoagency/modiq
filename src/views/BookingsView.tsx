import { useState, useEffect } from "react";
import { C, inp, btnS } from "../theme";
import { STATUS, BOOKING_TYPES, statusOptionsForType } from "../constants";
import BookingsList from "../components/BookingsList";
import { ClipboardList, Search } from "../components/icons";

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
      <BookingsList bookings={filteredBookings} models={models} customers={customers} isMobile={isMobile} onSelect={setSelectedBooking} />
    </div>
  );
}
