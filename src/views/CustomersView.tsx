import { useState } from "react";
import { C, inp, btnS } from "../theme";
import RevenueRanking from "../components/RevenueRanking";
import { periodRange } from "../lib/utils";
import { Building2, User, Phone, Mail } from "../components/icons";

export default function CustomersView({ filteredCustomers, customerQ, setCustomerQ, setShowCustomerForm, setSelectedCustomer, setCEditMode, bookings, isMobile = false, onBulkAdd }: {
  filteredCustomers: any[]; customerQ: string; setCustomerQ: (v:string)=>void;
  setShowCustomerForm: (v:boolean)=>void; setSelectedCustomer: (c:any)=>void; setCEditMode: (v:boolean)=>void;
  bookings: any[];
  isMobile?: boolean;
  onBulkAdd?: ()=>void;
}) {
  const [sortMode, setSortMode] = useState<"reg"|"rev">("reg");
  const [revBasis, setRevBasis] = useState<"real"|"expected">("real");
  const [periodPreset, setPeriodPreset] = useState("3m");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const period = periodPreset==="custom" ? { from: cFrom||undefined, to: cTo||undefined } : periodRange(periodPreset);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}><Building2 size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 ({filteredCustomers.length}개)</h1>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          {onBulkAdd&&<button onClick={onBulkAdd} style={{ padding:"6px 12px", background:"transparent", color:C.textSub, border:`1px solid ${C.border}`, borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:12 }}>📋 대량 등록</button>}
          <button onClick={()=>setShowCustomerForm(true)} style={btnS(C.purple)}>+ 고객사 추가</button>
        </div>
      </div>
      <input style={inp} placeholder="고객사명·브랜드·전화·담당자·이메일 검색" value={customerQ} onChange={e=>setCustomerQ(e.target.value)} />
      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"10px 0 12px", flexWrap:"wrap" }}>
        {(["reg","rev"] as const).map(m=>(
          <button key={m} onClick={()=>setSortMode(m)} style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${sortMode===m?C.blue:C.border}`, background:sortMode===m?C.blue+"22":"transparent", color:sortMode===m?C.blue:C.muted, fontSize:12, fontWeight:sortMode===m?700:500, cursor:"pointer" }}>{m==="reg"?"등록순":"매출순"}</button>
        ))}
        {sortMode==="rev"&&(["real","expected"] as const).map(bb=>(
          <button key={bb} onClick={()=>setRevBasis(bb)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${revBasis===bb?(bb==="real"?C.green:C.yellow):C.border}`, background:revBasis===bb?(bb==="real"?C.green:C.yellow)+"22":"transparent", color:revBasis===bb?(bb==="real"?C.green:C.yellow):C.muted, fontSize:12, fontWeight:revBasis===bb?700:500, cursor:"pointer" }}>{bb==="real"?"실매출":"예상매출"}</button>
        ))}
        {sortMode==="rev"&&([["month","이번 달"],["3m","3개월"],["6m","6개월"],["1y","12개월"],["custom","기간 설정"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setPeriodPreset(k)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${periodPreset===k?C.blue:C.border}`, background:periodPreset===k?C.blue+"22":"transparent", color:periodPreset===k?C.blue:C.muted, fontSize:12, fontWeight:periodPreset===k?700:500, cursor:"pointer" }}>{l}</button>
        ))}
        {sortMode==="rev"&&periodPreset==="custom"&&(
          <span style={{ display:"flex", alignItems:"center", gap:5, ...(isMobile?{width:"100%", marginTop:6}:{}) }}>
            <input type="date" value={cFrom} onChange={e=>setCFrom(e.target.value)} style={{ ...inp, marginBottom:0, width:isMobile?undefined:"auto", flex:isMobile?1:undefined, minWidth:0, padding:"4px 7px", fontSize:12 }} />
            <span style={{ color:C.muted, fontSize:12 }}>~</span>
            <input type="date" value={cTo} onChange={e=>setCTo(e.target.value)} style={{ ...inp, marginBottom:0, width:isMobile?undefined:"auto", flex:isMobile?1:undefined, minWidth:0, padding:"4px 7px", fontSize:12 }} />
          </span>
        )}
      </div>
      {sortMode==="rev" ? <RevenueRanking items={filteredCustomers} bookings={bookings} idKey="customer_id" basis={revBasis} period={period} onSelect={(c)=>{ setSelectedCustomer(c); setCEditMode(false); }} /> :
       filteredCustomers.length===0 ? <p style={{ color:C.muted }}>고객사가 없습니다.</p> : (
        <div style={{ display:"grid", gap:6 }}>
          {filteredCustomers.map(c=>(
            isMobile ? (
            <div key={c.id} onClick={()=>{ setSelectedCustomer(c); setCEditMode(false); }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                <strong style={{ flex:1, fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}{c.brand?<span style={{ color:C.blue, fontWeight:600 }}> · {c.brand}</span>:null}</strong>
                {c.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:10, padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0 }}>{c.category}</span>}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:C.textSub }}>
                {c.manager_name&&<span><User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {c.manager_name}</span>}
                <span style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>섭외 {bookings.filter((b:any)=>b.customer_id===c.id).length}건 →</span>
              </div>
            </div>
            ) : (
            <div key={c.id} onClick={()=>{ setSelectedCustomer(c); setCEditMode(false); }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.2s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.purple)}
              onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
            >
              <span style={{ fontWeight:800, fontSize:15, color:C.text, minWidth:80 }}>{c.name}</span>
              {c.brand&&<span style={{ fontSize:13, color:C.blue }}>· {c.brand}</span>}
              {c.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:11, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{c.category}</span>}
              {c.manager_name&&<span style={{ fontSize:12, color:C.muted }}><User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {c.manager_name}</span>}
              {c.phone&&<a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} style={{ fontSize:12, color:C.muted, textDecoration:"none" }}><Phone size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {c.phone}</a>}
              {c.email&&<span style={{ fontSize:12, color:C.muted }}><Mail size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {c.email}</span>}
              <span style={{ marginLeft:"auto", fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>섭외 {bookings.filter((b:any)=>b.customer_id===c.id).length}건 →</span>
            </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
