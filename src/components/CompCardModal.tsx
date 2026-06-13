// ════════════════════════════════════════════════════════════════
// 컴카드 모달 (A4 가로) — 왼쪽 메인 1컷 + 오른쪽 2×2 + 하단 정보바
//  · 갤러리 사진 클릭 → 빈 슬롯 순서대로 자동 채움
//  · 슬롯끼리 드래그 → 위치 교체 / 갤러리에서 슬롯으로 드래그 → 배치
//  · 슬롯 클릭 → 비우기 · PDF 다운로드(A4 가로)
// ════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { C } from "../theme";
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
  agency: { id: string; name: string };
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

  const info = useMemo(() => {
    const age = ageFromSSN6(model.ssn6);
    return [
      ["이름(아이디)", model.name || "-"],
      ["나이", age !== null ? String(age) : "-"],
      ["성별", model.category || "-"],
      ["키 cm", model.height || "-"],
      ["가슴 cm", model.bust || "-"],
      ["허리 cm", model.waist || "-"],
      ["엉덩이 cm", model.hip || "-"],
      ["신발 mm", model.shoe || "-"],
      ["머리색", model.hair_color || "-"],
      ["국적", model.country || "-"],
    ] as [string, string][];
  }, [model]);

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try { await downloadNodePdf(ref.current, `${model.name || "모델"}_컴카드.pdf`, "l"); }
    catch (e) { alert("PDF 생성 실패: " + String(e)); }
    setBusy(false);
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
      {/* A4 가로 컴카드 (PDF 캡처 대상) */}
      <div ref={ref} onClick={e => e.stopPropagation()}
        style={{ width: "min(92vw, 920px)", aspectRatio: "297 / 210", background: "#fff", display: "flex", flexDirection: "column", padding: 14, boxShadow: "0 8px 40px rgba(0,0,0,.4)", borderRadius: 4 }}>
        {/* 사진 영역: 왼쪽 메인 + 오른쪽 2×2 */}
        <div style={{ display: "flex", gap: 6, flex: 1, minHeight: 0 }}>
          <Slot i={0} style={{ flex: 1.12, borderRadius: 3 }} />
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 6 }}>
            <Slot i={1} style={{ borderRadius: 3 }} />
            <Slot i={2} style={{ borderRadius: 3 }} />
            <Slot i={3} style={{ borderRadius: 3 }} />
            <Slot i={4} style={{ borderRadius: 3 }} />
          </div>
        </div>
        {/* 하단 정보 바 */}
        <div style={{ display: "flex", borderTop: "1px solid #e6e9ef", marginTop: 8, paddingTop: 4 }}>
          {info.map(([label, val], k) => (
            <div key={k} style={{ flex: 1, textAlign: "center", padding: "6px 2px", borderLeft: k === 0 ? "none" : "1px solid #f0f2f5" }}>
              <div style={{ fontSize: "clamp(8px, 1vw, 11px)", color: "#9aa2af", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</div>
              <div style={{ fontSize: "clamp(11px, 1.4vw, 15px)", fontWeight: 800, color: "#1a1d27", marginTop: 2 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 갤러리 스트립 (클릭=자동채움, 드래그=슬롯에 배치) */}
      <div onClick={e => e.stopPropagation()} style={{ width: "min(92vw, 920px)", marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#c8ccd8" }}>사진 클릭 = 빈 칸 자동 채움 · 드래그 = 원하는 칸에 배치 / 칸끼리 교체 · 칸 클릭 = 비우기</span>
          <span style={{ fontSize: 12, color: "#9aa2af" }}>{slots.filter(Boolean).length}/5</span>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
          {gallery.length === 0 && <span style={{ color: "#9aa2af", fontSize: 13 }}>이 모델은 등록된 사진이 없습니다. 스튜디오에서 먼저 사진을 올려주세요.</span>}
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
          try { await shareNodePng(ref.current, `${model.name||"모델"}_컴카드`, `${model.name||"모델"} 컴카드`); }
          catch (e) { alert("공유 실패: " + String(e)); }
          setBusy(false);
        }} disabled={busy} style={pill({ disabled: busy })}>
          <Link2 size={15} /> 공유하기
        </button>
        {onSave && <button onClick={saveSlots} disabled={savingSlots} style={pill({ disabled: savingSlots })}>
          <Save size={15} /> {savingSlots ? "저장 중…" : "컴카드 지정 저장"}
        </button>}
        <button onClick={onClose} style={pill()}>닫기</button>
      </div>
    </div>
  );
}
