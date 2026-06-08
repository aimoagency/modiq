import type { ReactNode } from "react";
import { C } from "../theme";

export default function Modal({ onClose, children, wide=false, maxW }: { onClose:()=>void; children:ReactNode; wide?:boolean; maxW?:number }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:1000 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"clamp(14px, 4vw, 24px)", width:"92%", maxWidth:maxW??(wide?680:480), maxHeight:"90vh", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  );
}
