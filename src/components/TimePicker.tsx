import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { C } from "../theme";
import { HOURS, MINS } from "../constants";
import { parseHHMM, toHHMM, pad } from "../lib/utils";

// ── 시간 선택기 (가로 소형) ────────────────────────────────────
export default function TimePicker({ label, value, onChange }: { label:string; value:string; onChange:(v:string)=>void }) {
  const parsed = parseHHMM(value);
  const [ampm, setAmpm] = useState(parsed.ampm);
  const [h12,  setH12]  = useState(parsed.h12);
  const [m,    setM]    = useState(parsed.m);

  useEffect(() => { onChange(toHHMM(ampm, h12, m)); }, [ampm, h12, m]);

  const sel: CSSProperties = { background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:5, color:C.text, fontSize:13, padding:"4px 3px", cursor:"pointer" };
  const ap = (val: string): CSSProperties => ({ padding:"4px 7px", border:`1px solid ${val===ampm?C.blue:C.border}`, borderRadius:5, cursor:"pointer", fontSize:12, fontWeight:700, background:val===ampm?C.blue+"22":"var(--c-card2)", color:val===ampm?C.blue:C.muted });

  return (
    <div>
      <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:3 }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <button type="button" onClick={()=>setAmpm("오전")} style={ap("오전")}>오전</button>
        <button type="button" onClick={()=>setAmpm("오후")} style={ap("오후")}>오후</button>
        <select value={h12} onChange={e=>setH12(Number(e.target.value))} style={{ ...sel, width:44 }}>
          {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ color:C.muted, fontSize:12 }}>:</span>
        <select value={m} onChange={e=>setM(Number(e.target.value))} style={{ ...sel, width:48 }}>
          {MINS.map(mn=><option key={mn} value={mn}>{pad(mn)}</option>)}
        </select>
      </div>
    </div>
  );
}
