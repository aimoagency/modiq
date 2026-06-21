// ════════════════════════════════════════════════════════════════
// 컴카드 모달 (A4 가로) — 왼쪽 메인 1컷 + 오른쪽 2×2 + 하단 정보바
//  · 갤러리 사진 클릭 → 빈 슬롯 순서대로 자동 채움
//  · 슬롯끼리 드래그 → 위치 교체 / 갤러리에서 슬롯으로 드래그 → 배치
//  · 슬롯 클릭 → 비우기 · PDF 다운로드(A4 가로)
// ════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { C } from "../theme";
import CloseButton from "./CloseButton";
import { downloadNodePdf, shareNodePng } from "../lib/packages";
import { ageFromSSN6 } from "../lib/utils";
import { Download, Link2, Save } from "../components/icons";

// 레퍼런스형 알약(pill) 버튼 — 다크 배경 위 아웃라인
const pill = (opts: { disabled?: boolean; accent?: boolean } = {}): CSSProperties => ({
  display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 999,
  border: `1px solid ${opts.accent ? "#ffffff" : "#ffffff66"}`,
  background: opts.accent ? "#fff" : "rgba(255,255,255,0.06)",
  color: opts.accent ? "#1a1d27" : "#fff",
  fontSize: 14, fontWeight: 700, cursor: opts.disabled ? "not-allowed" : "pointer",
  opacity: opts.disabled ? 0.55 : 1, whiteSpace: "nowrap",
});

type Drag = { type: "g" | "s"; val: string | number } | null;

export default function CompCardModal({ model, agency, onClose, onSave }: {
  model: any;
  agency: { id: string; name: string; logo_url?: string };
  onClose: () => void;
  onSave?: (compcard: (string | null)[]) => void | Promise<void>;   // 컴카드 슬롯 지정 영구 저장
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [savingSlots, setSavingSlots] = useState(false);

  const gallery: string[] = useMemo(
    () => (Array.isArray(model.photos) && model.photos.length ? model.photos : (model.thumb_url ? [model.thumb_url] : [])),
    [model]
  );
  // 슬롯 5칸: [메인, 우상, 우중, 우하-좌, 우하-우]
  //  초기값: 저장된 지정(model.compcard)이 있으면 그대로, 없으면 앞 5장 자동
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const saved = Array.isArray(model.compcard) ? model.compcard : [];
    const hasSaved = saved.some((x: any) => !!x);
    const s: (string | null)[] = [null, null, null, null, null];
    if (hasSaved) saved.slice(0, 5).forEach((p: string | null, i: number) => { s[i] = p || null; });
    else gallery.slice(0, 5).forEach((p, i) => { s[i] = p; });
    return s;
  });
  const [drag, setDrag] = useState<Drag>(null);
  // 오른쪽 에이전시 로고 — 기본은 설정의 회사 로고, 이 컴카드에서 삽입/삭제 가능(회사 로고와 동일 PNG 방식)
  const [logoSrc, setLogoSrc] = useState<string>(agency.logo_url || "");
  const onLogoFile = (files: FileList | null) => {
    const f = files?.[0]; if (!f || !f.type.startsWith("image/")) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      const max = 240; const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      setLogoSrc(cv.toDataURL("image/png"));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // A4 가로 고정 크기(px) — 모든 내부 글자·여백은 이 크기 기준으로 디자인.
  // 화면 폭에 맞춰 카드 전체를 transform:scale로 균일 축소 → 웹/모바일 레이아웃이 동일하게 보임.
  const BASE_W = 1000, BASE_H = Math.round(1000 * 210 / 297); // 707 (A4 가로 297:210)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / BASE_W));
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const saveSlots = async () => {
    if (!onSave) return;
    setSavingSlots(true);
    try { await onSave(slots); alert("컴카드 사진 지정이 저장되었습니다. 다음에 열 때 이 구성으로 시작합니다."); }
    catch (e) { alert("지정 저장 실패: " + String(e) + "\n(Supabase에 compcard 컬럼이 없으면 model_profile_setup.sql을 먼저 실행하세요.)"); }
    setSavingSlots(false);
  };

  const fillNext = (photo: string) => setSlots(prev => {
    if (prev.includes(photo)) return prev;        // 이미 배치된 사진이면 무시
    const i = prev.findIndex(x => x === null);
    if (i === -1) return prev;                     // 빈 슬롯 없음
    const n = [...prev]; n[i] = photo; return n;
  });
  const clearSlot = (i: number) => setSlots(prev => { const n = [...prev]; n[i] = null; return n; });

  const onDropSlot = (i: number) => {
    if (!drag) return;
    setSlots(prev => {
      const n = [...prev];
      if (drag.type === "g") { n[i] = String(drag.val); }
      else { const j = Number(drag.val); const t = n[i]; n[i] = n[j]; n[j] = t; } // 슬롯 교체
      return n;
    });
    setDrag(null);
  };

  // 하단 바: 왼쪽 큰 이름 + 가운데 2줄(국적/나이 · 신체사이즈) + 오른쪽 에이전시 로고
  const age = ageFromSSN6(model.ssn6);
  const genderEn = model.gender === "F" ? "Female" : model.gender === "M" ? "Male" : "";
  const cmToIn = (v: any) => { const n = Number(v); return n > 0 ? String(Math.round(n / 2.54)) : ""; };
  const bwh = [model.bust, model.waist, model.hip].map(cmToIn).filter(Boolean).join("-"); // 3사이즈는 inch로 표기(저장은 cm 그대로)
  // 영문 이름은 퍼스트네임만 (예: "BARBARE GIGUASHVILI" → "BARBARE"). 한글 이름은 그대로.
  const _nm = (model.name || "").trim();
  const isLatinName = /[A-Za-z]/.test(_nm) && !/[가-힣]/.test(_nm);
  const displayName = (isLatinName && _nm.includes(" ") ? _nm.split(/\s+/)[0] : _nm) || "-";
  // 정보 항목: 영문 안내 라벨(작고·밝게) + 결과값(볼드)으로 구분 표기
  const fld = (label: string, value: string) => (
    <span key={label} style={{ marginRight: 16, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 11, fontWeight: 400, color: "#aab2bf" }}>{label} </span>
      <span style={{ fontSize: 15, fontWeight: 800, color: "#1a1d27" }}>{value}</span>
    </span>
  );
  // 국적·성별은 라벨 없이 값만(볼드)
  const val = (value: string, key: string) => (
    <span key={key} style={{ marginRight: 16, whiteSpace: "nowrap", fontSize: 15, fontWeight: 800, color: "#1a1d27" }}>{value}</span>
  );

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    const el = ref.current; const prev = el.style.transform;
    el.style.transform = "none"; // 캡처 시 원본 A4 크기로(축소 해제)
    try { await downloadNodePdf(el, `${model.name || "모델"}_컴카드.pdf`, "l"); }
    catch (e) { alert("PDF 생성 실패: " + String(e)); }
    finally { el.style.transform = prev; setBusy(false); }
  };

  // 슬롯 렌더 (드롭 타깃 + 드래그 소스)
  const Slot = ({ i, style }: { i: number; style?: React.CSSProperties }) => {
    const p = slots[i];
    return (
      <div
        onClick={() => p && clearSlot(i)}
        onDragOver={e => e.preventDefault()}
        onDrop={() => onDropSlot(i)}
        draggable={!!p}
        onDragStart={() => setDrag({ type: "s", val: i })}
        title={p ? "클릭하면 비우기 · 드래그로 위치 교체" : "갤러리에서 사진을 끌어다 놓으세요"}
        style={{ position: "relative", background: "#e9edf2", overflow: "hidden", cursor: p ? "pointer" : "default", ...style }}
      >
        {p
          ? <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${p}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", pointerEvents: "none" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center", color: "#aeb4bf", fontSize: i === 0 ? 13 : 11, border: "1.5px dashed #cfd5dd", background: "#f2f4f7" }}>
              <svg width={i === 0 ? 26 : 18} height={i === 0 ? 26 : 18} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#aeb4bf" strokeWidth="1.6"/><circle cx="8.5" cy="8.5" r="1.8" fill="#aeb4bf"/><path d="M21 15l-5-5L5 21" stroke="#aeb4bf" strokeWidth="1.6"/></svg>
              {i === 0 ? "메인 이미지" : "이미지"}
            </div>}
      </div>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1500, padding: 16, overflowY: "auto" }}>
      <CloseButton onClose={onClose} fixed />
      {/* A4 가로 컴카드 — 고정 크기 카드를 화면 폭에 맞춰 균일 축소(scale). 웹/모바일 레이아웃 동일 */}
      <div ref={wrapRef} onClick={e => e.stopPropagation()} style={{ width: "min(92vw, 1000px)", height: BASE_H * scale }}>
        <div ref={ref}
          style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})`, transformOrigin: "top left", background: "#fff", display: "flex", flexDirection: "column", padding: 20, boxSizing: "border-box", boxShadow: "0 8px 40px rgba(0,0,0,.4)", borderRadius: 6 }}>
          {/* 사진 영역: 왼쪽 메인 + 오른쪽 2×2 */}
          <div style={{ display: "flex", gap: 8, flex: 1, minHeight: 0 }}>
            <Slot i={0} style={{ flex: 1.12, borderRadius: 4 }} />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gridTemplateRows: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
              <Slot i={1} style={{ borderRadius: 4 }} />
              <Slot i={2} style={{ borderRadius: 4 }} />
              <Slot i={3} style={{ borderRadius: 4 }} />
              <Slot i={4} style={{ borderRadius: 4 }} />
            </div>
          </div>
          {/* 하단 정보 바 — 왼쪽 이름 + 가운데 2줄(국적/나이 · 신체) + 오른쪽 에이전시 로고 */}
          <div style={{ display: "flex", alignItems: "center", gap: 22, borderTop: "1px solid #e6e9ef", marginTop: 10, paddingTop: 12 }}>
            {/* 왼쪽: 이름 (영문은 퍼스트네임만) */}
            <div style={{ flexShrink: 0, minWidth: 0 }}>
              <div style={{ fontSize: 40, fontWeight: 600, color: "#1a1d27", lineHeight: 1.05, whiteSpace: "nowrap" }}>{displayName}</div>
            </div>
            {/* 가운데: 이름 제외 상세 두 줄 — ①국적·age·성별·hair·tatu  ②height·size·shoe */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {model.country && val(model.country, "country")}
                {age !== null && fld("age", String(age))}
                {genderEn && val(genderEn, "gender")}
                {model.hair_color && fld("hair", model.hair_color)}
                {fld("tatu", model.tattoo ? "Y" : "N")}
              </div>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {model.height && fld("height", `${model.height}cm`)}
                {bwh && fld("size", bwh)}
                {model.shoe && fld("shoe", `${model.shoe}mm`)}
              </div>
            </div>
            {/* 오른쪽: 에이전시 로고 (기본=설정의 회사 로고, 카드 아래에서 삽입/삭제. 크기 30%↓) */}
            {(logoSrc || agency.name) && (
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", maxWidth: 165 }}>
                {logoSrc
                  ? <img src={logoSrc} alt="" style={{ maxHeight: 42, maxWidth: 147, objectFit: "contain" }} />
                  : <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1d27", whiteSpace: "nowrap" }}>{agency.name}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽 에이전시 로고 — 삽입 / 삭제 */}
      <div onClick={e => e.stopPropagation()} style={{ width: "min(92vw, 1000px)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: "#9aa2af", marginRight: 2 }}>오른쪽 로고</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 999, border: "1px solid #ffffff66", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          ＋ {logoSrc ? "로고 변경" : "로고 삽입"}
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { onLogoFile(e.target.files); e.currentTarget.value = ""; }} />
        </label>
        {logoSrc && <button onClick={() => setLogoSrc("")} style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid #ffffff66", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>로고 삭제</button>}
      </div>

      {/* 갤러리 스트립 (클릭=자동채움, 드래그=슬롯에 배치) */}
      <div onClick={e => e.stopPropagation()} style={{ width: "min(92vw, 920px)", marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#c8ccd8" }}>사진 클릭 = 빈 칸 자동 채움 · 드래그 = 원하는 칸에 배치 / 칸끼리 교체 · 칸 클릭 = 비우기</span>
          <span style={{ fontSize: 12, color: "#9aa2af" }}>{slots.filter(Boolean).length}/5</span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
          {gallery.length === 0 && <span style={{ color: "#9aa2af", fontSize: 13 }}>이 모델은 등록된 사진이 없습니다. 포트폴리오에서 먼저 사진을 올려주세요.</span>}
          {gallery.map((p, i) => {
            const used = slots.includes(p);
            return (
              <div key={i} draggable onDragStart={() => setDrag({ type: "g", val: p })} onClick={() => fillNext(p)}
                style={{ flexShrink: 0, width: 58, height: 78, borderRadius: 6, overflow: "hidden", cursor: "pointer", border: used ? `2px solid ${C.blue}` : "2px solid transparent", opacity: used ? 0.55 : 1, position: "relative" }}>
                <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 버튼 */}
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={download} disabled={busy} style={pill({ disabled: busy, accent: true })}>
          <Download size={15} /> {busy ? "PDF 생성 중…" : "PDF 다운로드"}
        </button>
        <button onClick={async () => {
          if (!ref.current) return;
          setBusy(true);
          const el = ref.current; const prev = el.style.transform;
          el.style.transform = "none";
          try { await shareNodePng(el, `${model.name||"모델"}_컴카드`, `${model.name||"모델"} 컴카드`); }
          catch (e) { alert("공유 실패: " + String(e)); }
          finally { el.style.transform = prev; setBusy(false); }
        }} disabled={busy} style={pill({ disabled: busy })}>
          <Link2 size={15} /> 공유하기
        </button>
        {onSave && <button onClick={saveSlots} disabled={savingSlots} style={pill({ disabled: savingSlots })}>
          <Save size={15} /> {savingSlots ? "저장 중…" : "컴카드 지정 저장"}
        </button>}
      </div>
    </div>
  );
}
