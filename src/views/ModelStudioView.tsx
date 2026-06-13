// ════════════════════════════════════════════════════════════════
// 모델 스튜디오 — 전체화면 사진 등록 + (3단계에서) 검색·필터·패키징
//  · 좌: 모델 검색/선택 + 프로필(썸네일·이름·정보 나열)
//  · 우: 선택 모델의 포트폴리오 사진 업로드(최대 15장, 드래그앤드롭)
// ════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { C, inp, btnS } from "../theme";
import { sb } from "../lib/supabase";
import { ageFromSSN6 } from "../lib/utils";
import { MODEL_FIELDS } from "../constants";
import { User, Camera, CardCheck } from "../components/icons";
import { type Pkg, type PackageItem, genPkgId, genShareToken, shareUrl } from "../lib/packages";
import CompCardModal from "../components/CompCardModal";

const MAX_PHOTOS = 15;

// 포트폴리오용 리사이즈(최대 1200px) → base64
const resizeImage = (file: File, cb: (data: string) => void) => {
  if (!file.type.startsWith("image/")) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1200;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.82));
    };
    img.src = String(r.result);
  };
  r.readAsDataURL(file);
};

const infoRows = (m: any): [string, string][] => {
  const age = ageFromSSN6(m.ssn6);
  const three = [m.bust, m.waist, m.hip].filter(Boolean).join("-");
  const rows: [string, string][] = [];
  if (m.country) rows.push(["국적", m.country]);
  if (age !== null) rows.push(["나이", `${age}세`]);
  if (m.height) rows.push(["키", `${m.height}cm`]);
  if (m.shoe) rows.push(["신발", `${m.shoe}mm`]);
  if (three) rows.push(["3사이즈", three]);
  if (m.hair_length) rows.push(["머리", m.hair_length]);
  if (m.eye_color) rows.push(["눈동자", m.eye_color]);
  rows.push(["타투", m.tattoo ? "있음" : "없음"]);
  rows.push(["언더웨어", m.underwear_ok ? "가능" : "불가"]);
  if (Array.isArray(m.fields) && m.fields.length) rows.push(["분야", m.fields.join(", ")]);
  if (m.specialty) rows.push(["특기", m.specialty]);
  if (m.instagram_followers) rows.push(["팔로워", Number(m.instagram_followers).toLocaleString() + (isNaN(Number(m.instagram_followers)) ? "" : "")]);
  if (m.phone) rows.push(["연락처", m.phone]);
  return rows;
};

export default function ModelStudioView({ models, setModels, setPackages, agency, isMobile = false }: {
  models: any[];
  setModels: (fn: (prev: any[]) => any[]) => void;
  setPackages: (fn: (prev: Pkg[]) => Pkg[]) => void;
  agency: { id: string; name: string };
  isMobile?: boolean;
}) {
  const [mode, setMode] = useState<"photos" | "package">("photos");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  // 패키징 모드
  const [fieldF, setFieldF] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [packaging, setPackaging] = useState(false);
  const [compModel, setCompModel] = useState<any | null>(null); // 컴카드 모달 대상

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return models.filter(m => !s || (m.name || "").toLowerCase().includes(s) || (m.category || "").toLowerCase().includes(s) || (Array.isArray(m.fields) && m.fields.join(",").toLowerCase().includes(s)));
  }, [models, q]);

  const sel = models.find(m => m.id === selId) || null;
  const photos: string[] = Array.isArray(sel?.photos) ? sel!.photos : [];

  const savePhotos = async (next: string[]) => {
    if (!sel) return;
    setSaving(true);
    try {
      await sb("models", "PATCH", { photos: next }, `?id=eq.${sel.id}`);
      setModels(prev => prev.map(m => m.id === sel.id ? { ...m, photos: next } : m));
    } catch (e) { alert("사진 저장 실패: " + String(e)); }
    setSaving(false);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files || !sel) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { alert(`사진은 최대 ${MAX_PHOTOS}장까지입니다.`); return; }
    const list = Array.from(files).slice(0, room);
    let collected: string[] = [];
    let done = 0;
    list.forEach(f => resizeImage(f, data => {
      collected.push(data);
      done++;
      if (done === list.length) savePhotos([...photos, ...collected]);
    }));
  };

  const removePhoto = (i: number) => savePhotos(photos.filter((_, x) => x !== i));
  const makePrimary = (i: number) => { if (i === 0) return; const next = [...photos]; const [p] = next.splice(i, 1); next.unshift(p); savePhotos(next); };

  // ── 패키징 모드 ──
  // 정보 완비 = 이름 + 사진 1장 이상 + 키 입력
  const isComplete = (m: any) => !!m.name && (Array.isArray(m.photos) ? m.photos.length > 0 : false) && !!m.height;
  const pkgCandidates = useMemo(() => {
    const s = q.trim().toLowerCase();
    return models.filter(m => isComplete(m)
      && (s === "" || (m.name || "").toLowerCase().includes(s))
      && (fieldF.length === 0 || (Array.isArray(m.fields) && fieldF.every(f => m.fields.includes(f)))));
  }, [models, q, fieldF]);

  const togglePick = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const modelToItem = (m: any): PackageItem => {
    const age = ageFromSSN6(m.ssn6);
    // 전체 사진을 저장(최대 15) → 고객 갤러리에서 전부 노출. 카드/컴카드는 앞쪽 일부만 표시.
    const photos: string[] = Array.isArray(m.photos) && m.photos.length ? m.photos.slice(0, MAX_PHOTOS) : (m.thumb_url ? [m.thumb_url] : []);
    return {
      model_id: m.id, name: m.name || "", category: m.category || "",
      country: m.country || "", age: age !== null ? String(age) : "",
      height: m.height || "", bust: m.bust || "", waist: m.waist || "", hip: m.hip || "", shoe: m.shoe || "",
      followers: m.instagram_followers || "",
      caption: [Array.isArray(m.fields) ? m.fields.join("/") : "", m.specialty].filter(Boolean).join(" · "),
      photos,
    };
  };

  const createPackage = async () => {
    const chosen = models.filter(m => picked.has(m.id) && isComplete(m));
    if (chosen.length === 0) { alert("패키징할 모델을 선택하세요."); return; }
    setPackaging(true);
    const token = genShareToken();
    const pkg: Pkg = {
      id: genPkgId(), agency_id: agency.id,
      title: `모델 제안 ${new Date().toLocaleDateString("ko-KR")}`,
      client_name: "", layout: "casting",
      items: chosen.map(modelToItem), memo: "",
      show_brand: true, brand_name: agency.name || "", brand_logo: "",
      share_token: token, is_public: true,
    };
    try {
      await sb("packages", "POST", pkg);
      setPackages(prev => [pkg, ...prev]);
      const url = shareUrl(token);
      try { await navigator.clipboard.writeText(url); } catch {}
      setPicked(new Set());
      alert(`패키지 생성 완료 (${chosen.length}명)\n공유 링크가 복사되었습니다:\n\n${url}\n\n'패키지' 메뉴에서 제목·고객사 편집과 PDF 발송이 가능합니다.`);
    } catch (e) {
      alert("패키지 생성 실패: " + String(e));
    }
    setPackaging(false);
  };

  // ── 좌측: 모델 리스트 ──
  const listPanel = (
    <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, ...(isMobile ? {} : { borderRight: `1px solid ${C.border}`, paddingRight: 16 }) }}>
      <input style={inp} placeholder="이름·카테고리·분야 검색" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ display: "grid", gap: 6, maxHeight: isMobile ? 200 : "calc(100vh - 200px)", overflowY: "auto" }}>
        {filtered.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>모델이 없습니다.</p>}
        {filtered.map(m => {
          const n = Array.isArray(m.photos) ? m.photos.length : 0;
          const active = m.id === selId;
          return (
            <div key={m.id} onClick={() => setSelId(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${active ? C.blue : C.border}`, background: active ? C.blue + "18" : C.card, cursor: "pointer" }}>
              {m.thumb_url
                ? <img src={m.thumb_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#c9a96e,#8b6a3e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{(m.name || "?")[0]}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>사진 {n}장{m.category ? ` · ${m.category}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 패키징 모드 화면 ──
  const packagePanel = (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input style={{ ...inp, marginBottom: 0, maxWidth: 260 }} placeholder="이름 검색" value={q} onChange={e => setQ(e.target.value)} />
        <span style={{ fontSize: 12, color: C.muted }}>분야:</span>
        {MODEL_FIELDS.map(f => {
          const on = fieldF.includes(f);
          return <button key={f} onClick={() => setFieldF(p => on ? p.filter(x => x !== f) : [...p, f])} style={{ padding: "5px 11px", borderRadius: 20, border: `1px solid ${on ? C.blue : C.border}`, background: on ? C.blue + "22" : "transparent", color: on ? C.blue : C.muted, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer" }}>{f}</button>;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: C.textSub }}>정보 완비 모델 {pkgCandidates.length}명 · 선택 {picked.size}명</span>
        <button onClick={createPackage} disabled={packaging || picked.size === 0} style={{ ...btnS(C.blue, packaging || picked.size === 0), padding: "9px 18px", fontSize: 13 }}>
          {packaging ? "생성 중…" : `패키징 (${picked.size}명) → 링크 생성`}
        </button>
      </div>
      {pkgCandidates.length === 0 ? (
        <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "48px 20px", textAlign: "center", color: C.muted }}>
          조건에 맞는 정보 완비 모델이 없습니다.<br /><span style={{ fontSize: 12 }}>이름·키·사진이 모두 입력된 모델만 표시됩니다.</span>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {pkgCandidates.map(m => {
            const on = picked.has(m.id);
            const cover = (Array.isArray(m.photos) && m.photos[0]) || m.thumb_url;
            const age = ageFromSSN6(m.ssn6);
            return (
              <div key={m.id} onClick={() => togglePick(m.id)} style={{ border: `2px solid ${on ? C.blue : C.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", background: C.card, position: "relative" }}>
                <div style={{ aspectRatio: "3/4", background: "#e9edf2" }}>
                  {cover && <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: on ? C.blue : "rgba(0,0,0,.5)", color: "#fff", fontSize: 13, lineHeight: "22px", textAlign: "center" }}>{on ? "✓" : ""}</div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{[m.country, age !== null ? `${age}세` : "", m.height ? `${m.height}cm` : ""].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 16px", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}><Camera size={20} style={{ verticalAlign: -2 }} /> 모델 스튜디오</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {([["photos", "사진 관리", Camera], ["package", "패키징", CardCheck]] as [string, string, any][]).map(([k, l, Ic]) => (
            <button key={k} onClick={() => setMode(k as any)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: `1px solid ${mode === k ? C.blue : C.border}`, background: mode === k ? C.blue + "22" : "transparent", color: mode === k ? C.blue : C.muted, fontSize: 13, fontWeight: mode === k ? 700 : 500, cursor: "pointer" }}><Ic size={14} /> {l}</button>
          ))}
        </div>
      </div>

      {mode === "package" ? packagePanel : (
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16 }}>
        {listPanel}

        {/* 우측: 선택 모델 프로필 + 사진 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!sel ? (
            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "60px 20px", textAlign: "center", color: C.muted }}>왼쪽에서 모델을 선택하세요.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 18 }}>
              {/* 프로필 카드 */}
              <div style={{ width: isMobile ? "100%" : 240, flexShrink: 0 }}>
                <div style={{ position: "relative", width: isMobile ? 96 : "100%" }}>
                  {sel.thumb_url
                    ? <img src={sel.thumb_url} alt="" style={{ width: "100%", aspectRatio: isMobile ? "1" : "3/4", borderRadius: 12, objectFit: "cover", border: `1px solid ${C.border}`, display: "block" }} />
                    : <div style={{ width: "100%", aspectRatio: isMobile ? "1" : "3/4", borderRadius: 12, background: "linear-gradient(135deg,#c9a96e,#8b6a3e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 40 }}>{(sel.name || "?")[0]}</div>}
                </div>
                <button onClick={() => setCompModel(sel)} disabled={photos.length === 0} title={photos.length === 0 ? "사진을 먼저 등록하세요" : "컴카드 만들기"}
                  style={{ width: isMobile ? "100%" : "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", background: photos.length === 0 ? C.card2 : C.blue, color: photos.length === 0 ? C.muted : "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: photos.length === 0 ? "not-allowed" : "pointer", boxShadow: photos.length === 0 ? "none" : "0 2px 10px rgba(59,130,246,.35)" }}>
                  <CardCheck size={16} /> 컴카드 만들기
                </button>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 10 }}>{sel.name}</div>
                {sel.category && <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, color: C.textSub, background: C.card2, padding: "2px 8px", borderRadius: 10 }}>{sel.category}</span>}
                <div style={{ marginTop: 12, display: "grid", gap: 5 }}>
                  {infoRows(sel).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", fontSize: 12.5, lineHeight: 1.5 }}>
                      <span style={{ width: 64, flexShrink: 0, color: C.muted }}>{k}</span>
                      <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 사진 업로드 영역 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong style={{ fontSize: 14, color: C.text }}>포트폴리오 사진 <span style={{ color: C.muted, fontWeight: 500 }}>{photos.length}/{MAX_PHOTOS}</span></strong>
                  {saving && <span style={{ fontSize: 12, color: C.muted }}>저장 중…</span>}
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={e => { e.preventDefault(); setDrag(false); addPhotos(e.dataTransfer.files); }}
                  style={{ border: `2px dashed ${drag ? C.blue : C.border}`, borderRadius: 12, padding: 14, background: drag ? C.blue + "11" : "transparent" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                    {photos.map((p, i) => (
                      <div key={i} style={{ position: "relative", aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
                        <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        {i === 0 && <span style={{ position: "absolute", top: 4, left: 4, background: C.blue, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>대표</span>}
                        <span onClick={() => removePhoto(i)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12, lineHeight: "20px", textAlign: "center", cursor: "pointer" }}>×</span>
                        {i !== 0 && <button onClick={() => makePrimary(i)} style={{ position: "absolute", bottom: 4, left: 4, right: 4, background: "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 10, padding: "3px 0", cursor: "pointer" }}>대표로</button>}
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <label style={{ aspectRatio: "3/4", border: `1px dashed ${C.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.muted, fontSize: 12, gap: 4 }}>
                        <span style={{ fontSize: 26 }}>＋</span>사진 추가
                        <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addPhotos(e.target.files)} />
                      </label>
                    )}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: C.muted }}>이미지를 끌어다 놓거나 ＋ 를 눌러 추가 · 첫 장이 대표(썸네일) 사진</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {compModel && <CompCardModal model={compModel} agency={agency} onClose={() => setCompModel(null)}
        onSave={async (compcard) => {
          await sb("models", "PATCH", { compcard }, `?id=eq.${compModel.id}`);
          setModels(prev => prev.map(m => m.id === compModel.id ? { ...m, compcard } : m));
          setCompModel((c: any) => c ? { ...c, compcard } : c);
        }} />}
    </div>
  );
}
