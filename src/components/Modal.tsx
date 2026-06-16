import { useState, useEffect, type ReactNode } from "react";
import { C } from "../theme";

export default function Modal({ onClose, children, wide=false, maxW }: { onClose:()=>void; children:ReactNode; wide?:boolean; maxW?:number }) {
  const [isMobile, setIsMobile] = useState(typeof window!=="undefined" && window.innerWidth<=767);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth<=767);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", justifyContent:"center", alignItems:isMobile?"stretch":"center", zIndex:1000 }}>
      <div onClick={e=>e.stopPropagation()} style={isMobile
        ? { position:"relative", background:C.card, width:"100%", maxWidth:"100vw", minHeight:"100%", padding:"16px 16px calc(16px + env(safe-area-inset-bottom))", overflowY:"auto", overflowX:"hidden", boxSizing:"border-box" }
        : { position:"relative", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"clamp(14px, 4vw, 24px)", width:"92%", maxWidth:maxW??(wide?680:480), maxHeight:"90vh", overflowY:"auto" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{ position:"absolute", top:10, right:10, width:isMobile?40:32, height:isMobile?40:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%", border:`1px solid ${C.border}`, background:C.card2, color:C.text, fontSize:isMobile?22:18, lineHeight:1, cursor:"pointer", zIndex:10, padding:0 }}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
