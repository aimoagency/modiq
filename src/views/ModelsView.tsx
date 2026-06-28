import { useState, useMemo } from "react";
import { C, btnS } from "../theme";
import { visaDday, ageFromSSN6 } from "../lib/utils";
import { User, Phone, Coins, Plane } from "../components/icons";
import SearchInput from "../components/SearchInput";
import { useVisibleCount } from "../lib/useVisibleCount";

export default function ModelsView({ filteredModels, modelQ, setModelQ, setShowModelForm, setSelectedModel, setMEditMode, bookings, isMobile = false, onBulkAdd, legacyIdCount = 0, onMigrateIds }: {
  filteredModels: any[]; modelQ: string; setModelQ: (v:string)=>void;
  setShowModelForm: (v:boolean)=>void; setSelectedModel: (m:any)=>void; setMEditMode: (v:boolean)=>void;
  bookings: any[];
  isMobile?: boolean;
  onBulkAdd?: ()=>void;
  legacyIdCount?: number;
  onMigrateIds?: ()=>void;
}) {
  // 발송업체 필터 + 이름 정렬(가나다/ABC)
  const [srcFilter, setSrcFilter] = useState<string>(""); // "" 전체 · "__own__" 직접등록 · 그 외 발송처명
  const [sort, setSort] = useState<"reg"|"ganada"|"abc">("reg");
  const sources = useMemo(() => Array.from(new Set(filteredModels.map(m=>m.source_agency_name).filter(Boolean))) as string[], [filteredModels]);
  const displayModels = useMemo(() => {
    let base = filteredModels;
    if (srcFilter==="__own__") base = filteredModels.filter(m=>!m.source_agency_id);
    else if (srcFilter) base = filteredModels.filter(m=>m.source_agency_name===srcFilter);
    if (sort==="reg") return base;
    const isKo = (s:string)=>/[가-힣]/.test(s||"");
    const arr = [...base];
    if (sort==="ganada") arr.sort((a,b)=>{ const ka=isKo(a.name),kb=isKo(b.name); if(ka!==kb) return ka?-1:1; return String(a.name||"").localeCompare(String(b.name||""),"ko"); });
    else arr.sort((a,b)=>{ const ka=isKo(a.name),kb=isKo(b.name); if(ka!==kb) return ka?1:-1; return String(a.name||"").localeCompare(String(b.name||""),"en"); });
    return arr;
  }, [filteredModels, srcFilter, sort]);
  // 점진 렌더 — 1000명+ 목록을 한 번에 다 그리지 않음(스크롤 시 추가)
  const { visible, hasMore, sentinelRef } = useVisibleCount(displayModels, 60);
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
      <SearchInput placeholder="이름·국적·전화·이메일·고객사/브랜드명 검색" value={modelQ} onChange={setModelQ} />
      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"10px 0 12px", flexWrap:"wrap" }}>
        {([["reg","등록순"],["ganada","가나다"],["abc","ABC"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setSort(k)} style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${sort===k?C.blue:C.border}`, background:sort===k?C.blue+"22":"transparent", color:sort===k?C.blue:C.muted, fontSize:12, fontWeight:sort===k?700:500, cursor:"pointer" }}>{l}</button>
        ))}
        {/* 발송업체 드롭다운 — 수신(편입)한 모델이 있을 때만 활성화 */}
        <select value={srcFilter} onChange={e=>setSrcFilter(e.target.value)} disabled={sources.length===0}
          style={{ marginLeft:"auto", background:C.card2, color:sources.length?C.text:C.muted, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 10px", fontSize:12, cursor:sources.length?"pointer":"not-allowed", opacity:sources.length?1:0.5, maxWidth:220 }}>
          <option value="">발송업체 전체</option>
          <option value="__own__">직접 등록</option>
          {sources.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {displayModels.length===0 ? <p style={{ color:C.muted }}>모델이 없습니다.</p> : (()=>{
        // 모델 행(Vercel식 정렬 리스트 · 하나의 컨테이너 안 얇은 divider 행 · 고정 컬럼 정렬)
        const Row=(m:any, bt:string)=>{
          const dday = m.is_foreigner ? visaDday(m.visa_exit) : "";
          const age = m.birth_year ? (new Date().getFullYear() - Number(m.birth_year)) : ageFromSSN6(m.ssn6);
          const ddayColor = dday==="만료" ? C.red : dday.startsWith("D-") && parseInt(dday.slice(2)) <= 7 ? C.orange : C.yellow;
          const avatar=(size:number)=> m.thumb_url
            ? <img src={m.thumb_url} alt={m.name} loading="lazy" decoding="async" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`1px solid ${C.border}` }} />
            : <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:size*0.4, flexShrink:0 }}>{m.name?m.name[0]:"?"}</div>;
          const chip=(()=>{ const g=m.gender==="F"?"여성":m.gender==="M"?"남성":""; const txt=[g, age!==null?`${age}세`:"", (m.career_years!=null&&m.career_years!=="")?`경력 ${m.career_years}년`:""].filter(Boolean).join(" · "); return txt; })();
          if (isMobile) return (
            <div key={m.id} onClick={()=>{ setSelectedModel(m); setMEditMode(false); }} style={{ padding:"10px 14px", borderTop:bt, cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:5 }}>
                {avatar(32)}
                <strong style={{ fontSize:14, fontWeight:800, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0, flexShrink:1 }}>{m.name}</strong>
                {m.source_agency_id && <span title={`${m.source_agency_name||"발송처"} 발송 편입`} style={{ background:C.blue+"1e", color:C.blue, border:`1px solid ${C.blue}50`, fontSize:9, fontWeight:800, padding:"1px 6px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0 }}>{m.source_agency_name||"소속사"}</span>}
                {m.is_foreigner&&dday&&<span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0 }}><Plane size={9} style={{ verticalAlign:-1, flexShrink:0 }}/> {dday}</span>}
                {chip&&<span style={{ background:C.card2, color:C.textSub, fontSize:10, padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0, marginLeft:"auto" }}>{chip}</span>}
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
            <div key={m.id} onClick={()=>{ setSelectedModel(m); setMEditMode(false); }}
              onMouseEnter={e=>(e.currentTarget.style.background=C.card2)}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
              style={{ display:"grid", gridTemplateColumns:"44px minmax(0,1.4fr) 150px 96px minmax(0,1fr) minmax(0,1.1fr) 110px 84px", alignItems:"center", gap:12, padding:"11px 16px", borderTop:bt, cursor:"pointer", transition:"background 0.12s" }}>
              {/* 원형 썸네일 */}
              {avatar(36)}
              {/* 이름 + 출처(발송업체) 배지 */}
              <span style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                <strong style={{ fontSize:13.5, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.name}</strong>
                {m.source_agency_id && <span title={`${m.source_agency_name||"발송처"} 발송 편입`} style={{ background:C.blue+"1e", color:C.blue, border:`1px solid ${C.blue}50`, fontSize:10, fontWeight:800, padding:"2px 7px", borderRadius:10, whiteSpace:"nowrap", flexShrink:0 }}>{m.source_agency_name||"소속사"}</span>}
              </span>
              {/* 성별 · 나이 · 경력 */}
              <span style={{ fontSize:12.5, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{chip||""}</span>
              {/* 외국인 D-day */}
              <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.is_foreigner&&dday ? <span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}><Plane size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {dday}</span> : null}</span>
              {/* 전화 */}
              <span style={{ fontSize:12.5, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.phone ? <a href={`tel:${m.phone}`} onClick={e=>e.stopPropagation()} style={{ color:C.muted, textDecoration:"none" }}><Phone size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {m.phone}</a> : ""}</span>
              {/* 단가/수수료 */}
              <span style={{ fontSize:12.5, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {m.rate>0&&<span><Coins size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {m.rate.toLocaleString()}원</span>}
                {m.rate>0&&m.payout_pay_value>0&&" · "}
                {m.payout_pay_value>0&&<span>정산방식 {m.payout_pay_type==="fixed"?`${Number(m.payout_pay_value).toLocaleString()}원`:`${m.payout_pay_value}%`}</span>}
              </span>
              {/* 브랜드 아이콘 링크 */}
              <span style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end", whiteSpace:"nowrap" }}>
                {m.instagram_url&&<a href={m.instagram_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:3, fontSize:12, color:"#E1306C", textDecoration:"none", whiteSpace:"nowrap" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/></svg> 인스타</a>}
                {m.aimo_url&&<a href={m.aimo_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:12, textDecoration:"none", whiteSpace:"nowrap", background:"linear-gradient(135deg,#4f46e5,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:700 }}>AIMO</a>}
              </span>
              {/* 섭외 건수 */}
              <span style={{ textAlign:"right", fontSize:11, color:C.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>섭외 {bookings.filter((b:any)=>b.model_id===m.id).length}건 →</span>
            </div>
          );
        };
        const out:any[]=[]; let first=true;
        const top=()=>{ const t=first?"none":`1px solid ${C.border}`; first=false; return t; };
        visible.forEach(m=>out.push(Row(m, top())));
        return (
          <div style={{ width:"100%", boxSizing:"border-box", border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", background:C.card }}>
            {out}
            {hasMore && <div ref={sentinelRef} style={{ height:1 }} />}
          </div>
        );
      })()}
    </div>
  );
}
