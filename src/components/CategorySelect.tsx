import { useState } from "react";
import { C, inp, btnS } from "../theme";
import { CLIENT_CATEGORIES } from "../constants";

// 분야 선택 드롭다운 + 직접 입력.
// 직접 입력 후 '추가'를 누르면 onAdd로 영구 목록(에이전시)에 등록되어 다음부터 드롭다운에 노출됨.
export default function CategorySelect({ value, onChange, extra = [], onAdd }: {
  value: string; onChange: (v: string) => void; extra?: string[]; onAdd?: (name: string) => void;
}) {
  const base = Array.from(new Set([...CLIENT_CATEGORIES, ...extra].filter(Boolean)));
  const [custom, setCustom] = useState(() => !!value && !base.includes(value));
  const [draft, setDraft] = useState("");

  if (custom) {
    const v = draft.trim();
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...inp, flex: 1, marginBottom: 0 }} value={draft} autoFocus
          placeholder="새 분야 입력 후 추가"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && v) { onAdd?.(v); onChange(v); setCustom(false); } }} />
        <button type="button" disabled={!v}
          onClick={() => { if (!v) return; onAdd?.(v); onChange(v); setCustom(false); }}
          style={{ ...btnS(C.blue, !v), flexShrink: 0 }}>추가</button>
        <button type="button" onClick={() => { setCustom(false); setDraft(""); }}
          style={{ ...btnS("#555"), flexShrink: 0 }}>목록</button>
      </div>
    );
  }
  return (
    <select style={{ ...inp, marginBottom: 0 }} value={value}
      onChange={e => { if (e.target.value === "__custom__") { setDraft(""); setCustom(true); } else onChange(e.target.value); }}>
      <option value="">선택</option>
      {base.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__custom__">+ 직접 입력</option>
    </select>
  );
}
