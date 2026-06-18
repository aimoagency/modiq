import { useState } from "react";
import { C, inp, btnS } from "../theme";
import RevenueRanking from "../components/RevenueRanking";
import { periodRange } from "../lib/utils";
import { visaDday, ageFromSSN6 } from "../lib/utils";
import { User, Phone, Coins, Plane } from "../components/icons";

export default function ModelsView({ filteredModels, modelQ, setModelQ, setShowModelForm, setSelectedModel, setMEditMode, bookings, isMobile = false, onBulkAdd, legacyIdCount = 0, onMigrateIds }: {
  filteredModels: any[]; modelQ: string; setModelQ: (v:string)=>void;
  setShowModelForm: (v:boolean)=>void; setSelectedModel: (m:any)=>void; setMEditMode: (v:boolean)=>void;
  bookings: any[];
  isMobile?: boolean;
  onBulkAdd?: ()=>void;
  legacyIdCount?: number;
  onMigrateIds?: ()=>void;
}) {
  const [sortMode, setSortMode] = useState<"reg"|"rev">("reg");
  const [revBasis, setRevBasis] = useState<"real"|"expected">("real");
  const [periodPreset, setPeriodPreset] = useState("3m");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const period = periodPreset==="custom" ? { from: cFrom||undefined, to: cTo||undefined } : periodRange(periodPreset);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text, whiteSpace:"nowrap" }}><User size={20} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델 ({filteredModels.length}명)</h1>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          {legacyIdCount>0&&onMigrateIds&&<button onClick={onMigrateIds} title="기존 모델 ID를 규칙 ID(MK/FK/MX/FX)로 변경합니다" style={{ padding:"6px 12px", background:"transparent", color:C.yellow, border:`1px solid ${C.yellow}`, borderRadius:6, cursor:"pointer", fontWeight:700, fontSize:12 }}>🆔 ID규칙 적용 ({legacyIdCount})</button>}
          {onBulkAdd&&<button onClick={onBulkAdd} style={{ padding:"6px 12px", background:"transparent", color:C.textSub, border:`1px solid ${C.border}`, borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:12 }}>📋 대량 등록</button>}
          <button onClick={()=>setShowModelForm(true)} style={btnS(C.blue)}>+ 모델 추가</button>
        </div>
      </div>
      <input style={inp} placeholder="이름·전화·이메일·고객사/브랜드명 검색" value={modelQ} onChange={e=>setModelQ(e.target.value)} />
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
      {sortMode==="rev" ? <RevenueRanking items={filteredModels} bookings={bookings} idKey="model_id" basis={revBasis} period={period} onSelect={(m)=>{ setSelectedModel(m); setMEditMode(false); }} showThumb /> :
       filteredModels.length===0 ? <p style={{ color:C.muted }}>모델이 없습니다.</p> : (
        <div style={{ display:"grid", gap:6 }}>
          {filteredModels.map(m=>{
            const dday = m.is_foreigner ? visaDday(m.visa_exit) : "";
            const age = ageFromSSN6(m.ssn6);
            const ddayColor = dday==="만료" ? C.red : dday.startsWith("D-") && parseInt(dday.slice(2)) <= 7 ? C.orange : C.yellow;
            if (isMobile) return (
              <div key={m.id} onClick={()=>{ setSelectedModel(m); setMEditMode(false); }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                  {m.thumb_url
                    ? <img src={m.thumb_url} alt={m.name} style={{ width:32, height:32, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                    : <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:13, flexShrink:0 }}>{m.name?m.name[0]:"?"}</div>
                  }
                  <strong style={{ fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0, flexShrink:1 }}>{m.name}</strong>
                  {m.is_foreigner&&dday&&<span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0 }}><Plane size={9} style={{ verticalAlign:-1, flexShrink:0 }}/> {dday}</span>}
                  {(()=>{ const g=m.gender==="F"?"여성":m.gender==="M"?"남성":""; const txt=[g, age!==null?`${age}세`:""].filter(Boolean).join(" · "); return txt?<span style={{ background:C.card2, color:C.textSub, fontSize:10, padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0, marginLeft:"auto" }}>{txt}</span>:null; })()}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:C.textSub, paddingLeft:42 }}>
                  {m.rate>0&&<span>{m.rate.toLocaleString()}원</span>}
                  {m.payout_pay_value>0&&<span>정산방식 {m.payout_pay_type==="fixed"?`${Number(m.payout_pay_value).toLocaleString()}원`:`${m.payout_pay_value}%`}</span>}
                  <span style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>섭외 {bookings.filter((b:any)=>b.model_id===m.id).length}건 →</span>
                </div>
                {(m.phone||m.instagram_url)&&(
                  <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:12, color:C.textSub, paddingLeft:42, marginTop:3 }}>
                    {m.phone&&<a href={`tel:${m.phone}`} onClick={e=>e.stopPropagation()} style={{ color:C.muted, textDecoration:"none", whiteSpace:"nowrap" }}><Phone size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {m.phone}</a>}
                    {m.instagram_url&&<a href={m.instagram_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ display:"inline-flex", alignItems:"center", gap:3, color:"#E1306C", textDecoration:"none", whiteSpace:"nowrap" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/></svg> 인스타</a>}
                  </div>
                )}
              </div>
            );
            return (
              <div key={m.id} onClick={()=>{ setSelectedModel(m); setMEditMode(false); }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.2s" }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
                onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
              >
                {/* 원형 썸네일 */}
                {m.thumb_url
                  ? <img src={m.thumb_url} alt={m.name} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`1px solid ${C.border}` }} />
                  : <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:14, flexShrink:0 }}>{m.name?m.name[0]:"?"}</div>
                }
                {/* 이름 */}
                <span style={{ fontWeight:800, fontSize:15, color:C.text, minWidth:60 }}>{m.name}</span>
                {/* 성별 · 나이 */}
                {(()=>{ const g=m.gender==="F"?"여성":m.gender==="M"?"남성":""; const txt=[g, age!==null?`${age}세`:""].filter(Boolean).join(" · "); return txt?<span style={{ background:C.card2, color:C.textSub, fontSize:11, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{txt}</span>:null; })()}
                {/* 외국인 D-day */}
                {m.is_foreigner&&dday&&<span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}><Plane size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {dday}</span>}
                {/* 전화 */}
                {m.phone&&<a href={`tel:${m.phone}`} onClick={e=>e.stopPropagation()} style={{ fontSize:12, color:C.muted, textDecoration:"none" }}><Phone size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {m.phone}</a>}
                {/* 단가/수수료 */}
                {m.rate>0&&<span style={{ fontSize:12, color:C.textSub }}><Coins size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {m.rate.toLocaleString()}원</span>}
                {m.payout_pay_value>0&&<span style={{ fontSize:12, color:C.textSub }}>정산방식 {m.payout_pay_type==="fixed"?`${Number(m.payout_pay_value).toLocaleString()}원`:`${m.payout_pay_value}%`}</span>}
                {/* 브랜드 아이콘 링크 */}
                {m.instagram_url&&<a href={m.instagram_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:3, fontSize:12, color:"#E1306C", textDecoration:"none", whiteSpace:"nowrap" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/></svg> 인스타</a>}
                {m.aimo_url&&<a href={m.aimo_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:12, textDecoration:"none", whiteSpace:"nowrap", background:"linear-gradient(135deg,#4f46e5,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:700 }}>AIMO</a>}
                <span style={{ marginLeft:"auto", fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>섭외 {bookings.filter((b:any)=>b.model_id===m.id).length}건 →</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
