// ════════════════════════════════════════════════════════════════
// 모델 검색 — 스튜디오 내 조건 검색(성별·국적·나이·분야·신체·모델료)
//  · 우리 데이터 필드 기반 칩/범위 필터 → 결과 카드 그리드
// ════════════════════════════════════════════════════════════════
import { useMemo, useState, type CSSProperties } from "react";
import { C, inp } from "../theme";
import { GENDERS, MODEL_FIELDS } from "../constants";
import { ageFromSSN6 } from "../lib/utils";
import SearchInput from "../components/SearchInput";
import { thumbUrl } from "../lib/supabase";

export default function ModelSearchView({ models, isMobile = false, onPick }: {
  models: any[];
  isMobile?: boolean;
  onPick: (m: any) => void;
}) {
  const [q, setQ] = useState("");
  const [genderF, setGenderF] = useState<string[]>([]);
  const [natF, setNatF] = useState<string[]>([]);        // "국내" | "외국인"
  const [fieldF, setFieldF] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState(""); const [ageMax, setAgeMax] = useState("");
  const [hMin, setHMin] = useState("");     const [hMax, setHMax] = useState("");
  const [shMin, setShMin] = useState("");   const [shMax, setShMax] = useState("");
  const [feeMin, setFeeMin] = useState(""); const [feeMax, setFeeMax] = useState(""); // 만원/일
  const [carMin, setCarMin] = useState(""); const [carMax, setCarMax] = useState(""); // 경력(년)

  const isForeign = (m: any) => m.nationality_type === "외국인";
  const feeOf = (m: any) => Number(m.fee_day || m.rate || 0);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const num = (v: string) => v ? Number(v) : null;
    const aMin = num(ageMin), aMax = num(ageMax);
    const hmin = num(hMin), hmax = num(hMax);
    const smin = num(shMin), smax = num(shMax);
    const fmin = feeMin ? Number(feeMin) * 10000 : null;
    const fmax = feeMax ? Number(feeMax) * 10000 : null;
    const cmin = num(carMin), cmax = num(carMax);
    return models.filter(m => {
      if (s && !((m.name || "").toLowerCase().includes(s) || (m.specialty || "").toLowerCase().includes(s) || (m.country || "").toLowerCase().includes(s) || (Array.isArray(m.fields) && m.fields.join(",").toLowerCase().includes(s)))) return false;
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
      const car = Number(m.career_years || 0);
      if (cmin != null && (car === 0 || car < cmin)) return false;
      if (cmax != null && (car === 0 || car > cmax)) return false;
      return true;
    });
  }, [models, q, genderF, natF, fieldF, ageMin, ageMax, hMin, hMax, shMin, shMax, feeMin, feeMax, carMin, carMax]);

  const reset = () => { setQ(""); setGenderF([]); setNatF([]); setFieldF([]); setAgeMin(""); setAgeMax(""); setHMin(""); setHMax(""); setShMin(""); setShMax(""); setFeeMin(""); setFeeMax(""); setCarMin(""); setCarMax(""); };
  const active = genderF.length + natF.length + fieldF.length + [q, ageMin, ageMax, hMin, hMax, shMin, shMax, feeMin, feeMax, carMin, carMax].filter(Boolean).length;

  const chip = (on: boolean): CSSProperties => ({ padding: "5px 12px", borderRadius: 16, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue + "22" : "transparent", color: on ? C.blue : C.muted, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer" });
  const rng: CSSProperties = { ...inp, marginBottom: 0, width: 60, padding: "5px 8px", fontSize: 12, textAlign: "center" };
  const sec: CSSProperties = { fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 6 };

  const Range = ({ a, sa, b, sb, unit }: { a: string; sa: (v: string) => void; b: string; sb: (v: string) => void; unit: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input style={rng} type="number" value={a} onChange={e => sa(e.target.value)} placeholder="0" />
      <span style={{ color: C.muted, fontSize: 11 }}>~</span>
      <input style={rng} type="number" value={b} onChange={e => sb(e.target.value)} placeholder="max" />
      <span style={{ color: C.muted, fontSize: 11 }}>{unit}</span>
    </div>
  );

  const thumbOf = (m: any) => (Array.isArray(m.photos) && m.photos[0]) || m.thumb_url || "";

  return (
    <div>
      {/* 필터 패널 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
          <SearchInput placeholder="이름·특기·분야 검색" value={q} onChange={setQ} style={{ marginBottom: 0, flex: 1, minWidth: 180 }} />
          {active > 0 && <button onClick={reset} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>초기화 ({active})</button>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))", gap: 14 }}>
          <div>
            <p style={sec}>성별</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GENDERS.map(([code, label]) => <span key={code} onClick={() => toggle(genderF, setGenderF, code)} style={chip(genderF.includes(code))}>{label}</span>)}
            </div>
          </div>
          <div>
            <p style={sec}>국적</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["국내", "외국인"].map(v => <span key={v} onClick={() => toggle(natF, setNatF, v)} style={chip(natF.includes(v))}>{v}</span>)}
            </div>
          </div>
        </div>

        <p style={{ ...sec, marginTop: 14 }}>활동분야</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {MODEL_FIELDS.map(f => <span key={f} onClick={() => toggle(fieldF, setFieldF, f)} style={chip(fieldF.includes(f))}>{f}</span>)}
        </div>

        <div style={{ marginTop: 14 }}>
          <p style={sec}>경력년차</p>
          <Range a={carMin} sa={setCarMin} b={carMax} sb={setCarMax} unit="년" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0,1fr))", gap: 14, marginTop: 14 }}>
          <div><p style={sec}>나이</p><Range a={ageMin} sa={setAgeMin} b={ageMax} sb={setAgeMax} unit="세" /></div>
          <div><p style={sec}>신장</p><Range a={hMin} sa={setHMin} b={hMax} sb={setHMax} unit="cm" /></div>
          <div><p style={sec}>신발</p><Range a={shMin} sa={setShMin} b={shMax} sb={setShMax} unit="mm" /></div>
          <div><p style={sec}>모델료/일</p><Range a={feeMin} sa={setFeeMin} b={feeMax} sb={setFeeMax} unit="만" /></div>
        </div>
      </div>

      {/* 결과 */}
      <p style={{ fontSize: 13, color: C.textSub, margin: "0 0 10px" }}>조건에 맞는 모델 <strong style={{ color: C.text }}>{results.length}명</strong></p>
      {results.length === 0 ? (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "48px 20px", textAlign: "center", color: C.muted }}>조건에 맞는 모델이 없습니다.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {results.map(m => {
            const age = ageFromSSN6(m.ssn6);
            const gLabel = (GENDERS.find(([c]) => c === m.gender) || [, ""])[1];
            const sub = [gLabel, age != null ? `${age}세` : "", m.height ? `${m.height}cm` : "", m.country || (isForeign(m) ? "외국인" : ""), (m.career_years != null && m.career_years !== "") ? `경력 ${m.career_years}년` : ""].filter(Boolean).join(" · ");
            const fee = feeOf(m);
            const cover = thumbOf(m);
            return (
              <div key={m.id} onClick={() => onPick(m)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ aspectRatio: "3/4", background: C.card2 }}>
                  {cover
                    ? <img src={thumbUrl(cover)} alt="" loading="lazy" decoding="async" onError={e => { const t = e.currentTarget; if (t.src !== cover) t.src = cover; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 800, background: "linear-gradient(135deg,#c9a96e,#8b6a3e)" }}>{(m.name || "?")[0]}</div>}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name || "?"}</div>
                  <div style={{ fontSize: 10.5, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{sub || "정보 없음"}</div>
                  {Array.isArray(m.fields) && m.fields.length > 0 && <div style={{ fontSize: 10.5, color: C.textSub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{m.fields.join("·")}</div>}
                  {fee > 0 && <div style={{ fontSize: 11.5, fontWeight: 700, color: C.blue, marginTop: 4 }}>{Math.round(fee / 10000).toLocaleString()}만 / 일</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
