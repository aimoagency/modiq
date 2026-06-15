// ════════════════════════════════════════════════════════════════
// 모델 브라우저 — 공통 좌측 검색 사이드바(필터 + 결과 리스트)
//  · 스튜디오/패키지 공용. multi=true면 체크 후 일괄 추가(패키지용)
//  · 데스크탑: 상시 세로 사이드바 / 모바일: 상단 '필터' 펼침
// ════════════════════════════════════════════════════════════════
import { useMemo, useState, type CSSProperties } from "react";
import { C, inp } from "../theme";
import { GENDERS, MODEL_FIELDS } from "../constants";
import { ageFromSSN6 } from "../lib/utils";

export default function ModelBrowser({ models, isMobile = false, onSelect, selectedId, multi = false, pickedIds, addedIds, onAddPicked }: {
  models: any[];
  isMobile?: boolean;
  onSelect: (m: any) => void;
  selectedId?: string;
  multi?: boolean;
  pickedIds?: Set<string>;
  addedIds?: Set<string>;
  onAddPicked?: () => void;
}) {
  const [open, setOpen] = useState(!isMobile);
  const [q, setQ] = useState("");
  const [genderF, setGenderF] = useState<string[]>([]);
  const [natF, setNatF] = useState<string[]>([]);
  const [fieldF, setFieldF] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState(""); const [ageMax, setAgeMax] = useState("");
  const [hMin, setHMin] = useState("");     const [hMax, setHMax] = useState("");
  const [shMin, setShMin] = useState("");   const [shMax, setShMax] = useState("");
  const [feeMin, setFeeMin] = useState(""); const [feeMax, setFeeMax] = useState("");

  const isForeign = (m: any) => m.nationality_type === "외국인";
  const feeOf = (m: any) => Number(m.fee_day || m.rate || 0);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const num = (v: string) => v ? Number(v) : null;
    const aMin = num(ageMin), aMax = num(ageMax), hmin = num(hMin), hmax = num(hMax), smin = num(shMin), smax = num(shMax);
    const fmin = feeMin ? Number(feeMin) * 10000 : null;
    const fmax = feeMax ? Number(feeMax) * 10000 : null;
    return models.filter(m => {
      if (s && !((m.name || "").toLowerCase().includes(s) || (m.specialty || "").toLowerCase().includes(s) || (Array.isArray(m.fields) && m.fields.join(",").toLowerCase().includes(s)))) return false;
      if (genderF.length && !genderF.includes(m.gender)) return false;
      if (natF.length) { const f = isForeign(m) ? "외국인" : "국내"; if (!natF.includes(f)) return false; }
      if (fieldF.length && !(Array.isArray(m.fields) && fieldF.some(f => m.fields.includes(f)))) return false;
      const age = ageFromSSN6(m.ssn6);
      if (aMin != null && (age == null || age < aMin)) return false;
      if (aMax != null && (age == null || age > aMax)) return false;
      const h = Number(m.height || 0);
      if (hmin != null && (h === 0 || h < hmin)) return false;
      if (hmax != null && (h === 0 || h > hmax)) return false;
      const sh = Number(m.shoe || 0);
      if (smin != null && (sh === 0 || sh < smin)) return false;
      if (smax != null && (sh === 0 || sh > smax)) return false;
      const fee = feeOf(m);
      if (fmin != null && (fee === 0 || fee < fmin)) return false;
      if (fmax != null && (fee === 0 || fee > fmax)) return false;
      return true;
    });
  }, [models, q, genderF, natF, fieldF, ageMin, ageMax, hMin, hMax, shMin, shMax, feeMin, feeMax]);

  const reset = () => { setQ(""); setGenderF([]); setNatF([]); setFieldF([]); setAgeMin(""); setAgeMax(""); setHMin(""); setHMax(""); setShMin(""); setShMax(""); setFeeMin(""); setFeeMax(""); };
  const active = genderF.length + natF.length + fieldF.length + [q, ageMin, ageMax, hMin, hMax, shMin, shMax, feeMin, feeMax].filter(Boolean).length;

  const chip = (on: boolean): CSSProperties => ({ padding: "4px 10px", borderRadius: 14, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue + "22" : "transparent", color: on ? C.blue : C.muted, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: "pointer" });
  const rng: CSSProperties = { ...inp, marginBottom: 0, width: 52, padding: "5px 6px", fontSize: 12, textAlign: "center" };
  const sec: CSSProperties = { fontSize: 11, color: C.muted, fontWeight: 700, margin: "12px 0 5px" };
  const Range = ({ a, sa, b, sb, u }: { a: string; sa: (v: string) => void; b: string; sb: (v: string) => void; u: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <input style={rng} type="number" value={a} onChange={e => sa(e.target.value)} placeholder="0" />
      <span style={{ color: C.muted, fontSize: 11 }}>~</span>
      <input style={rng} type="number" value={b} onChange={e => sb(e.target.value)} placeholder="∞" />
      <span style={{ color: C.muted, fontSize: 11 }}>{u}</span>
    </div>
  );

  const filterControls = (
    <div>
      <input style={{ ...inp, marginBottom: 8 }} placeholder="이름·특기 검색" value={q} onChange={e => setQ(e.target.value)} />
      <p style={{ ...sec, marginTop: 0 }}>성별</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{GENDERS.map(([c, l]) => <span key={c} onClick={() => toggle(genderF, setGenderF, c)} style={chip(genderF.includes(c))}>{l}</span>)}</div>
      <p style={sec}>국적</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{["국내", "외국인"].map(v => <span key={v} onClick={() => toggle(natF, setNatF, v)} style={chip(natF.includes(v))}>{v}</span>)}</div>
      <p style={sec}>활동분야</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{MODEL_FIELDS.map(f => <span key={f} onClick={() => toggle(fieldF, setFieldF, f)} style={chip(fieldF.includes(f))}>{f}</span>)}</div>
      <p style={sec}>나이</p><Range a={ageMin} sa={setAgeMin} b={ageMax} sb={setAgeMax} u="세" />
      <p style={sec}>신장</p><Range a={hMin} sa={setHMin} b={hMax} sb={setHMax} u="cm" />
      <p style={sec}>신발</p><Range a={shMin} sa={setShMin} b={shMax} sb={setShMax} u="mm" />
      <p style={sec}>모델료/일</p><Range a={feeMin} sa={setFeeMin} b={feeMax} sb={setFeeMax} u="만" />
      {active > 0 && <button onClick={reset} style={{ marginTop: 12, width: "100%", padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>초기화 ({active})</button>}
    </div>
  );

  return (
    <div style={{ width: isMobile ? "100%" : 234, flexShrink: 0, ...(isMobile ? {} : { borderRight: `1px solid ${C.border}`, paddingRight: 14 }) }}>
      {isMobile
        ? <><button onClick={() => setOpen(o => !o)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>필터 검색{active ? ` · ${active}` : ""}</span><span>{open ? "▲" : "▼"}</span></button>{open && <div style={{ marginTop: 10 }}>{filterControls}</div>}</>
        : filterControls}

      {multi && pickedIds && pickedIds.size > 0 && (
        <button onClick={onAddPicked} style={{ width: "100%", margin: "12px 0 4px", padding: "10px 0", borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>선택 {pickedIds.size}명 패키지에 추가</button>
      )}

      <p style={{ fontSize: 12, color: C.muted, margin: "12px 0 8px" }}>결과 <strong style={{ color: C.text }}>{results.length}</strong>명</p>
      <div style={{ display: "grid", gap: 6, ...(isMobile ? {} : { maxHeight: "calc(100vh - 360px)", overflowY: "auto" }) }}>
        {results.length === 0 && <p style={{ fontSize: 12, color: C.muted }}>조건에 맞는 모델이 없습니다.</p>}
        {results.map(m => {
          const added = !!addedIds?.has(m.id);
          const pick = !!pickedIds?.has(m.id);
          const on = pick || selectedId === m.id;
          const age = ageFromSSN6(m.ssn6);
          const sub = [age != null ? `${age}세` : "", m.height ? `${m.height}cm` : "", isForeign(m) ? "외국인" : ""].filter(Boolean).join(" · ");
          const cover = (Array.isArray(m.photos) && m.photos[0]) || m.thumb_url || "";
          return (
            <div key={m.id} onClick={() => { if (multi && added) return; onSelect(m); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue + "18" : C.card, cursor: multi && added ? "default" : "pointer", opacity: multi && added ? 0.5 : 1 }}>
              {cover
                ? <img src={cover} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c9a96e,#8b6a3e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{(m.name || "?")[0]}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name || "?"}</div>
                <div style={{ fontSize: 10.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub || "정보 없음"}</div>
              </div>
              {multi && (added
                ? <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: C.green, background: C.green + "1a", borderRadius: 5, padding: "2px 6px" }}>담김</span>
                : <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: `1px solid ${pick ? C.blue : C.border}`, background: pick ? C.blue : "transparent", color: "#fff", fontSize: 12, lineHeight: "20px", textAlign: "center" }}>{pick ? "✓" : ""}</span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
