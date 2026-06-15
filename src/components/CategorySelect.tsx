import { useState } from "react";
import { C, inp, btnS } from "../theme";
import { CLIENT_CATEGORIES } from "../constants";

// 분야 선택 드롭다운 + 직접 입력. 직접 입력값은 customers에 저장돼 다음부터 목록(extra)에 누적됨.
export default function CategorySelect({ value, onChange, extra = [] }: {
  value: string; onChange: (v: string) => void; extra?: string[];
}) {
  const base = Array.from(new Set([...CLIENT_CATEGORIES, ...extra].filter(Boolean)));
  const [custom, setCustom] = useState(() => !!value && !base.includes(value));

  if (custom) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...inp, flex: 1, marginBottom: 0 }} value={value} autoFocus
          placeholder="분야 직접 입력" onChange={e => onChange(e.target.value)} />
        <button type="button" onClick={() => { setCustom(false); onChange(""); }}
          style={{ ...btnS("#555"), flexShrink: 0 }}>목록</button>
      </div>
    );
  }
  return (
    <select style={{ ...inp, marginBottom: 0 }} value={value}
      onChange={e => { if (e.target.value === "__custom__") { setCustom(true); onChange(""); } else onChange(e.target.value); }}>
      <option value="">선택</option>
      {base.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__custom__">+ 직접 입력</option>
    </select>
  );
}
