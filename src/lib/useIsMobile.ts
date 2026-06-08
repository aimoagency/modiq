import { useState, useEffect } from "react";

// 화면폭 768px 미만 = 모바일
export const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
};
