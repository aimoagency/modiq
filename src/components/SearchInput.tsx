import type { CSSProperties } from "react";
import { C, inp } from "../theme";
import { Search } from "./icons";

// 돋보기 아이콘이 붙은 공통 검색 입력. style은 바깥 래퍼(레이아웃: flex/maxWidth/marginBottom 등)에 적용된다.
export default function SearchInput({ value, onChange, placeholder = "검색", style, autoFocus, type = "text" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  type?: string;
}) {
  return (
    <div style={{ position: "relative", width: "100%", marginBottom: 10, minWidth: 0, ...style }}>
      <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.muted, pointerEvents: "none" }} />
      <input
        type={type}
        style={{ ...inp, marginBottom: 0, paddingLeft: 34 }}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
    </div>
  );
}
