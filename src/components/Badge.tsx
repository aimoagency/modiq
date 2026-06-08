import { STATUS } from "../constants";

export default function Badge({ code }: { code: string }) {
  const s = STATUS[code] || STATUS.INQUIRY;
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.color}50`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{s.label}</span>;
}
