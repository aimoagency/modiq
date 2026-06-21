// ════════════════════════════════════════════════════════════════
// 모델 브라우저 — 공통 좌측 검색 사이드바(필터 + 결과 리스트)
//  · 스튜디오/패키지 공용. multi=true면 체크 후 일괄 추가(패키지용)
//  · 데스크탑: 상시 세로 사이드바 / 모바일: 상단 '필터' 펼침
//  · 범위 기본값 프리필 + "값 미입력 모델은 통과"(숨김 방지)
// ════════════════════════════════════════════════════════════════
import { useMemo, useState, type CSSProperties } from "react";
import { C, inp } from "../theme";
import { GENDERS, MODEL_CATEGORIES, MODEL_FIELDS, HAIR_LENGTHS } from "../constants";
import { ageFromSSN6 } from "../lib/utils";
import SearchInput from "./SearchInput";
import { thumbUrl } from "../lib/supabase";
import { useVisibleCount } from "../lib/useVisibleCount";

// 범위 기본값(프리필) — 변경 안 하면 이 값 기준, 단 값 미입력 모델은 통과
const DEF = { ageMin: "1", ageMax: "99", hMin: "100", hMax: "200", shMin: "180", shMax: "310", feeMin: "0", feeMax: "500", carMin: "0", carMax: "30" };

export default function ModelBrowser({ models, isMobile = false, onSelect, selectedId, multi = false, pickedIds, addedIds, onAddPicked, onSelectAll }: {
  models: any[];
  isMobile?: boolean;
  onSelect: (m: any) => void;
  selectedId?: string;
  multi?: boolean;
  pickedIds?: Set<string>;
  addedIds?: Set<string>;
  onAddPicked?: () => void;
  onSelectAll?: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(!isMobile);
  const [q, setQ] = useState("");
  const [genderF, setGenderF] = useState<string[]>([]);
  const [natF, setNatF] = useState<string[]>([]);
  const [catF, setCatF] = useState<string[]>([]);
  const [fieldF, setFieldF] = useState<string[]>([]);
  const [hairF, setHairF] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState(DEF.ageMin); const [ageMax, setAgeMax] = useState(DEF.ageMax);
  const [hMin, setHMin] = useState(DEF.hMin);       const [hMax, setHMax] = useState(DEF.hMax);
  const [shMin, setShMin] = useState(DEF.shMin);    const [shMax, setShMax] = useState(DEF.shMax);
  const [feeMin, setFeeMin] = useState(DEF.feeMin); const [feeMax, setFeeMax] = useState(DEF.feeMax);
  const [carMin, setCarMin] = useState(DEF.carMin); const [carMax, setCarMax] = useState(DEF.carMax);

  // 외국인 = is_foreigner 플래그 또는 국적이 대한민국이 아닌 모든 국가
  const isForeign = (m: any) => !!m.is_foreigner || (!!m.country && m.country !== "대한민국");
  const feeOf = (m: any) => Number(m.fee_day || m.rate || 0);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const num = (v: string) => v === "" ? null : Number(v);
    const aMin = num(ageMin), aMax = num(ageMax), hmin = num(hMin), hmax = num(hMax), smin = num(shMin), smax = num(shMax);
    const fmin = feeMin === "" ? null : Number(feeMin) * 10000;
    const fmax = feeMax === "" ? null : Number(feeMax) * 10000;
    const cmin = num(carMin), cmax = num(carMax);
    return models.filter(m => {
      if (s && !((m.name || "").toLowerCase().includes(s) || (m.specialty || "").toLowerCase().includes(s) || (Array.isArray(m.fields) && m.fields.join(",").toLowerCase().includes(s)))) return false;
      if (genderF.length && !genderF.includes(m.gender)) return false;
      if (natF.length) { const f = isForeign(m) ? "외국인" : "국내"; if (!natF.includes(f)) return false; }
      if (catF.length && !catF.includes(m.category)) return false;
      if (fieldF.length && !(Array.isArray(m.fields) && fieldF.some(f => m.fields.includes(f)))) return false;
      if (hairF.length && !hairF.includes(m.hair_length)) return false;
      // 숫자 범위: 값이 입력된 모델만 거름(미입력=통과, 숨김 방지)
      const age = ageFromSSN6(m.ssn6);
      if (age != null && aMin != null && age < aMin) return false;
      if (age != null && aMax != null && age > aMax) return false;
      const h = Number(m.height || 0);
      if (h > 0 && hmin != null && h < hmin) return false;
      if (h > 0 && hmax != null && h > hmax) return false;
      const sh = Number(m.shoe || 0);
      if (sh > 0 && smin != null && sh < smin) return false;
      if (sh > 0 && smax != null && sh > smax) return false;
      const fee = feeOf(m);
      if (fee > 0 && fmin != null && fee < fmin) return false;
      if (fee > 0 && fmax != null && fee > fmax) return false;
      const car = m.career_years == null ? null : Number(m.career_years);
      if (car != null && cmin != null && car < cmin) return false;
      if (car != null && cmax != null && car > cmax) return false;
      return true;
    });
  }, [models, q, genderF, natF, catF, fieldF, hairF, ageMin, ageMax, hMin, hMax, shMin, shMax, feeMin, feeMax, carMin, carMax]);

  const reset = () => { setQ(""); setGenderF([]); setNatF([]); setCatF([]); setFieldF([]); setHairF([]); setAgeMin(DEF.ageMin); setAgeMax(DEF.ageMax); setHMin(DEF.hMin); setHMax(DEF.hMax); setShMin(DEF.shMin); setShMax(DEF.shMax); setFeeMin(DEF.feeMin); setFeeMax(DEF.feeMax); setCarMin(DEF.carMin); setCarMax(DEF.carMax); };
  const rangesChanged = (ageMin !== DEF.ageMin || ageMax !== DEF.ageMax ? 1 : 0) + (hMin !== DEF.hMin || hMax !== DEF.hMax ? 1 : 0) + (shMin !== DEF.shMin || shMax !== DEF.shMax ? 1 : 0) + (feeMin !== DEF.feeMin || feeMax !== DEF.feeMax ? 1 : 0) + (carMin !== DEF.carMin || carMax !== DEF.carMax ? 1 : 0);
  const active = genderF.length + natF.length + catF.length + fieldF.length + hairF.length + (q.trim() ? 1 : 0) + rangesChanged;

  const chip = (on: boolean): CSSProperties => ({ minWidth: 46, textAlign: "center", padding: "4px 10px", borderRadius: 14, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue + "22" : "transparent", color: on ? C.blue : C.muted, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: "pointer", boxSizing: "border-box" });
  const sec: CSSProperties = { fontSize: 11, color: C.muted, fontWeight: 700, margin: "12px 0 5px" };
  const onlyDigits = (v: string) => v.replace(/[^0-9]/g, "");
  const Range = ({ a, sa, b, sb, u }: { a: string; sa: (v: string) => void; b: string; sb: (v: string) => void; u: string }) => {
    const f: CSSProperties = { ...inp, marginBottom: 0, flex: 1, minWidth: 0, padding: "7px 8px", fontSize: 13, textAlign: "center" };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>
        <input style={f} type="text" inputMode="numeric" value={a} onChange={e => sa(onlyDigits(e.target.value))} />
        <span style={{ color: C.muted, fontSize: 12 }}>~</span>
        <input style={f} type="text" inputMode="numeric" value={b} onChange={e => sb(onlyDigits(e.target.value))} />
        <span style={{ color: C.muted, fontSize: 12, width: 22, textAlign: "left" }}>{u}</span>
      </div>
    );
  };

  const filterControls = (
    <div>
      <SearchInput placeholder="이름·특기 검색" value={q} onChange={setQ} style={{ marginBottom: 8 }} />
      <p style={{ ...sec, marginTop: 0 }}>성별</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{GENDERS.map(([c, l]) => <span key={c} onClick={() => toggle(genderF, setGenderF, c)} style={chip(genderF.includes(c))}>{l}</span>)}</div>
      <p style={sec}>국적</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{["국내", "외국인"].map(v => <span key={v} onClick={() => toggle(natF, setNatF, v)} style={chip(natF.includes(v))}>{v}</span>)}</div>
      <p style={sec}>모델 타입</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{MODEL_CATEGORIES.map(c => <span key={c} onClick={() => toggle(catF, setCatF, c)} style={chip(catF.includes(c))}>{c}</span>)}</div>
      <p style={sec}>활동분야</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{MODEL_FIELDS.map(f => <span key={f} onClick={() => toggle(fieldF, setFieldF, f)} style={chip(fieldF.includes(f))}>{f}</span>)}</div>
      <p style={sec}>머리 길이</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{HAIR_LENGTHS.map(h => <span key={h} onClick={() => toggle(hairF, setHairF, h)} style={chip(hairF.includes(h))}>{h}</span>)}</div>
      <p style={sec}>경력년차</p><Range a={carMin} sa={setCarMin} b={carMax} sb={setCarMax} u="년" />
      <p style={sec}>나이</p><Range a={ageMin} sa={setAgeMin} b={ageMax} sb={setAgeMax} u="세" />
      <p style={sec}>신장</p><Range a={hMin} sa={setHMin} b={hMax} sb={setHMax} u="cm" />
      <p style={sec}>신발</p><Range a={shMin} sa={setShMin} b={shMax} sb={setShMax} u="mm" />
      <p style={sec}>모델료/일</p><Range a={feeMin} sa={setFeeMin} b={feeMax} sb={setFeeMax} u="만" />
      {active > 0 && <button onClick={reset} style={{ marginTop: 12, width: "100%", padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>초기화 ({active})</button>}
    </div>
  );

  const selectable = multi ? results.filter(m => !addedIds?.has(m.id)) : [];
  const allPicked = selectable.length > 0 && selectable.every(m => pickedIds?.has(m.id));
  // 점진 렌더 — 1000명+에서도 한 번에 다 그리지 않음(스크롤 시 추가 로드)
  const { visible, hasMore, sentinelRef } = useVisibleCount(results, 60);

  return (
    <div style={{ width: isMobile ? "100%" : 312, flexShrink: 0, ...(isMobile ? {} : { borderRight: `1px solid ${C.border}`, paddingRight: 16 }) }}>
      {isMobile
        ? <><button onClick={() => setOpen(o => !o)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>필터 검색{active ? ` · ${active}` : ""}</span><span>{open ? "▲" : "▼"}</span></button>{open && <div style={{ marginTop: 10 }}>{filterControls}</div>}</>
        : filterControls}

      {multi && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", margin: "12px 0 4px" }}>
          {results.length > 0 && <button onClick={() => onSelectAll?.(allPicked ? [] : selectable.map(m => m.id))} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{allPicked ? "전체 해제" : "전체 선택"}</button>}
          {pickedIds && pickedIds.size > 0 && <button onClick={onAddPicked} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{pickedIds.size}명 추가</button>}
        </div>
      )}

      <p style={{ fontSize: 12, color: C.muted, margin: "12px 0 8px" }}>결과 <strong style={{ color: C.text }}>{results.length}</strong>명</p>
      <div style={{ display: "grid", gap: 6, ...(isMobile ? {} : { maxHeight: "calc(100vh - 360px)", overflowY: "auto" }) }}>
        {results.length === 0 && <p style={{ fontSize: 12, color: C.muted }}>조건에 맞는 모델이 없습니다.</p>}
        {visible.map(m => {
          const added = !!addedIds?.has(m.id);
          const pick = !!pickedIds?.has(m.id);
          const on = pick || selectedId === m.id;
          const age = ageFromSSN6(m.ssn6);
          const sub = [age != null ? `${age}세` : "", m.height ? `${m.height}cm` : "", isForeign(m) ? "외국인" : "", (m.career_years != null && m.career_years !== "") ? `경력 ${m.career_years}년` : ""].filter(Boolean).join(" · ");
          const cover = (Array.isArray(m.photos) && m.photos[0]) || m.thumb_url || "";
          return (
            <div key={m.id} onClick={() => { if (multi && added) return; onSelect(m); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue + "18" : C.card, cursor: multi && added ? "default" : "pointer", opacity: multi && added ? 0.5 : 1 }}>
              {cover
                ? <img src={thumbUrl(cover)} alt="" width={32} height={32} loading="lazy" decoding="async" onError={e => { const t = e.currentTarget; if (t.src !== cover) t.src = cover; }} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
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
        {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
      </div>
    </div>
  );
}
