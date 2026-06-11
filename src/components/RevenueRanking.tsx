import { C } from "../theme";
import { entityRevenue } from "../lib/utils";

export default function RevenueRanking({ items, bookings, idKey, basis, onSelect, showThumb = false, period }: {
  items: any[]; bookings: any[]; idKey: "model_id"|"customer_id";
  basis: "real"|"expected"; onSelect: (it:any)=>void; showThumb?: boolean; period?: { from?: string; to?: string };
}) {
  const rows = items
    .map(it => ({ it, ...entityRevenue(bookings, idKey, it.id, period) }))
    .filter(r => (basis==="real" ? r.real : r.expected) > 0)
    .sort((a,b) => (basis==="real" ? b.real-a.real : b.expected-a.expected));
  const max = Math.max(1, ...rows.map(r => basis==="real"?r.real:r.expected));
  const man = (n:number) => n>=10000 ? Math.round(n/10000).toLocaleString()+"만" : n.toLocaleString();

  if (rows.length===0) return <p style={{ color:C.muted, padding:"20px 0" }}>이 기간에 매출이 있는 항목이 없습니다.</p>;

  return (
    <div style={{ display:"grid", gap:6 }}>
      {rows.map((r,i)=>{
        const amt = basis==="real" ? r.real : r.expected;
        const avg = r.count ? Math.round(amt/r.count) : 0;
        const rankColor = i===0?"#FFD700":i===1?"#C0C0C0":i===2?"#CD7F32":C.muted;
        const pct = Math.max(2, Math.round(amt/max*100));
        return (
          <div key={r.it.id} onClick={()=>onSelect(r.it)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.2s" }}
            onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
            onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
          >
            <span style={{ width:26, height:26, borderRadius:"50%", background:i<3?rankColor+"22":"transparent", border:`1px solid ${i<3?rankColor:C.border}`, color:i<3?rankColor:C.muted, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>{i+1}</span>
            {showThumb&&(r.it.thumb_url
              ? <img src={r.it.thumb_url} alt="" style={{ width:34, height:34, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
              : <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:14, flexShrink:0 }}>{(r.it.name||"?")[0]}</div>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:"0 0 5px", fontSize:15, fontWeight:700, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.it.name||"?"}{r.it.brand?<span style={{ color:C.muted, fontWeight:400, fontSize:13 }}> · {r.it.brand}</span>:null}</p>
              <div style={{ height:6, background:C.card2, borderRadius:4, overflow:"hidden" }}>
                <div style={{ width:`${pct}%`, height:"100%", background:i<3?rankColor:C.blue, borderRadius:4 }} />
              </div>
              <p style={{ margin:"5px 0 0", fontSize:12, color:C.muted }}>섭외 {r.count}건{r.count>0?` · 평균 ${man(avg)}`:""}</p>
            </div>
            <span style={{ fontSize:17, fontWeight:800, color:basis==="real"?C.green:C.yellow, whiteSpace:"nowrap", flexShrink:0 }}>{amt.toLocaleString()}원</span>
          </div>
        );
      })}
    </div>
  );
}
