import { C } from "../theme";

// ── 멀티 체크박스 ─────────────────────────────────────────────
export default function MultiCheck({ label, options, value, onChange }: { label:string; options:string[]; value:string[]; onChange:(v:string[])=>void }) {
  const toggle = (opt: string) => {
    const next = value.includes(opt) ? value.filter(v=>v!==opt) : [...value, opt];
    onChange(next);
  };
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>{label}</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {options.map(opt=>(
          <button key={opt} type="button" onClick={()=>toggle(opt)} style={{
            padding:"5px 12px", border:`1px solid ${value.includes(opt)?C.blue:C.border}`,
            borderRadius:20, fontSize:13, cursor:"pointer", transition:"all 0.15s",
            background: value.includes(opt) ? C.blue+"22" : "var(--c-card2)",
            color: value.includes(opt) ? C.blue : C.textSub,
            fontWeight: value.includes(opt) ? 700 : 400,
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}
