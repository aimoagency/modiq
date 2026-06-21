import { useState, useEffect, type ReactNode } from "react";
import { C } from "../theme";
import CloseButton from "./CloseButton";

export default function Modal({ onClose, children, wide=false, maxW }: { onClose:()=>void; children:ReactNode; wide?:boolean; maxW?:number }) {
  const [isMobile, setIsMobile] = useState(typeof window!=="undefined" && window.innerWidth<=767);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth<=767);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, overflowY:"auto", WebkitOverflowScrolling:"touch", display:"flex", justifyContent:"center", alignItems:"flex-start", ...(isMobile ? {} : { padding:"24px 0" }) }}>
      <div onClick={e=>e.stopPropagation()} style={isMobile
        ? { position:"relative", background:C.card, width:"100%", maxWidth:"100vw", minHeight:"100%", margin:0, padding:"16px 16px calc(16px + env(safe-area-inset-bottom))", overflowX:"hidden", boxSizing:"border-box" }
        : { position:"relative", background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"clamp(14px, 4vw, 24px)", width:"92%", maxWidth:maxW??(wide?680:480), margin:"auto", boxSizing:"border-box" }}>
        <CloseButton onClose={onClose} big={isMobile} />
        {children}
      </div>
    </div>
  );
}
