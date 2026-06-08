import { STATUS, BOOKING_TYPES, statusLabelForType } from "../constants";

export default function Badge({ code, type }: { code: string; type?: string }) {
  const s = STATUS[code] || STATUS.INQUIRY;
  const label = statusLabelForType(type, code);
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.color}50`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", justifyContent:"center", minWidth:64, boxSizing:"border-box", flexShrink:0 }}>{label}</span>;
}
