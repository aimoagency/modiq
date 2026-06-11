import { C, inp } from "../theme";
import { fmtNum, parseNum } from "../lib/utils";

// ── 금액 입력 ─────────────────────────────────────────────────
export default function MoneyInput({ label, value, onChange, placeholder="0" }: { label:string; value:number; onChange:(v:number)=>void; placeholder?:string }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          type="text"
          value={value ? fmtNum(value) : ""}
          onChange={e=>onChange(parseNum(e.target.value))}
          placeholder={placeholder}
          style={{ ...inp, marginBottom:0, paddingRight:28 }}
        />
        <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:12 }}>원</span>
      </div>
    </div>
  );
}
