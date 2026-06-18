// ════════════════════════════════════════════════════════════════
// 패키지 뷰 — 모델 사진 패키지 제작/관리
//  · 목록 + 빌더 모달(드래그앤드롭 사진, 모델 선택, casting/compcard)
//  · 공유 링크 복사 / PDF·인쇄 / 공개여부 토글 / 삭제
// ════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { C, inp, btnS } from "../theme";
import { sb, thumbUrl } from "../lib/supabase";
import {
  type Pkg, type PackageItem, type PackageLayout,
  genPkgId, genShareToken, emptyItem, shareUrl, openPackageWindow, sizeLine,
} from "../lib/packages";
import { ageFromSSN6 } from "../lib/utils";
import { CardCheck, User, Building, ExternalLink, Pencil } from "../components/icons";
import CompCardModal from "../components/CompCardModal";
import PackagePublicView from "./PackagePublicView";
import ModelBrowser from "../components/ModelBrowser";

// 사진 리사이즈 → base64 (기존 reference_images 패턴과 동일)
const resizeImage = (file: File, cb: (data: string) => void) => {
  if (!file.type.startsWith("image/")) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.78));
    };
    img.src = String(r.result);
  };
  r.readAsDataURL(file);
};

export default function PackagesView({ packages, setPackages, models, customers, agency, isMobile = false }: {
  packages: Pkg[];
  setPackages: (fn: (prev: Pkg[]) => Pkg[]) => void;
  models: any[];
  customers: any[];
  agency: { id: string; name: string };
  isMobile?: boolean;
}) {
  const [draft, setDraft] = useState<Pkg | null>(null);   // null = 목록 화면
  const [preview, setPreview] = useState<Pkg | null>(null); // 패키지 미리보기(고객 화면)
  const [zoom, setZoom] = useState<{ photos: string[]; idx: number } | null>(null); // 빌더 사진 확대
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelPick, setModelPick] = useState(false);      // 모델 선택 모달
  const [picked, setPicked] = useState<Set<string>>(new Set()); // 검색에서 담을 모델 체크
  const [pickQ, setPickQ] = useState("");
  const [compModel, setCompModel] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // 상세 지연 로딩 중인 패키지 id

  // 목록은 무거운 items(사진)/brand_logo를 뺀 경량 조회 → 편집·미리보기·PDF 시 해당 1건만 전체 로딩
  const hydrate = async (p: Pkg): Promise<Pkg | null> => {
    if (Array.isArray(p.items)) return p; // 이미 전체 로딩됨(신규 생성·이전 hydrate)
    if (busyId) return null;              // 중복 클릭 방지
    try {
      setBusyId(p.id);
      const rows = await sb("packages", "GET", null, `?id=eq.${p.id}&select=items,brand_logo`);
      const full: Pkg = { ...p, items: rows?.[0]?.items || [], brand_logo: rows?.[0]?.brand_logo || "" };
      setPackages(prev => prev.map(x => x.id === p.id ? full : x)); // 캐시 — 재오픈 즉시
      return full;
    } catch (e) {
      alert("패키지를 불러오지 못했습니다: " + String(e));
      return null;
    } finally {
      setBusyId(null);
    }
  };
  const openPreview = async (p: Pkg) => { const f = await hydrate(p); if (f) setPreview(f); };
  const openPdf     = async (p: Pkg) => { const f = await hydrate(p); if (f) openPackageWindow(f, agency.name); };
  const openEdit    = async (p: Pkg) => { const f = await hydrate(p); if (f) startEdit(f); };

  const newDraft = (): Pkg => ({
    id: genPkgId(), agency_id: agency.id, title: "", client_name: "",
    layout: "casting", items: [], memo: "",
    show_brand: true, brand_name: agency.name || "", brand_logo: "",
    share_token: genShareToken(), is_public: true,
  });

  const setLogo = (files: FileList | null) => {
    const f = files?.[0]; if (!f) return;
    resizeImage(f, data => upd({ brand_logo: data }));
  };

  const startNew = () => { setDraft(newDraft()); setIsNew(true); };
  const startEdit = (p: Pkg) => { setDraft({ show_brand: true, brand_name: agency.name || "", brand_logo: "", ...JSON.parse(JSON.stringify(p)) }); setIsNew(false); };
  const closeBuilder = () => { setDraft(null); setModelPick(false); setPickQ(""); };

  const upd = (patch: Partial<Pkg>) => setDraft(d => d ? { ...d, ...patch } : d);
  const updItem = (idx: number, patch: Partial<PackageItem>) =>
    setDraft(d => d ? { ...d, items: d.items.map((it, i) => i === idx ? { ...it, ...patch } : it) } : d);
  const removeItem = (idx: number) =>
    setDraft(d => d ? { ...d, items: d.items.filter((_, i) => i !== idx) } : d);
  const addBlankItem = () =>
    setDraft(d => d ? { ...d, items: [...d.items, emptyItem()] } : d);
  const addModelItem = (m: any) => {
    const age = ageFromSSN6(m.ssn6);
    // 모델 등록 정보(신체사이즈·국적·나이·팔로워 등)를 그대로 불러옴 → 패키지에서 재입력 불필요
    const it: PackageItem = {
      model_id: m.id, name: m.name || "", category: m.category || "", gender: m.gender || "",
      country: m.country || "", age: age !== null ? String(age) : "",
      height: m.height || "", bust: m.bust || "", waist: m.waist || "", hip: m.hip || "", shoe: m.shoe || "",
      followers: m.instagram_followers || "",
      instagram_url: m.instagram_url || "", caption: "",
      photos: (() => { const lk = Array.isArray(m.liked_photos) ? m.liked_photos : []; const all = Array.isArray(m.photos) && m.photos.length > 0 ? m.photos : (m.thumb_url ? [m.thumb_url] : []); return (lk.length ? [...all.filter((p: string) => lk.includes(p)), ...all.filter((p: string) => !lk.includes(p))] : all).slice(0, 30); })(),
    };
    setDraft(d => d ? { ...d, items: [...d.items, it] } : d);
  };
  const addedIds = useMemo(() => new Set((draft?.items || []).map(i => i.model_id).filter((x): x is string => !!x)), [draft]);
  const togglePicked = (m: any) => setPicked(p => { const n = new Set(p); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; });
  const addPicked = () => { const toAdd = models.filter(m => picked.has(m.id) && !addedIds.has(m.id)); toAdd.forEach(addModelItem); setPicked(new Set()); };
  const addPhotos = (idx: number, files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(f => resizeImage(f, data =>
      setDraft(d => {
        if (!d) return d;
        const items = d.items.map((it, i) => i === idx && it.photos.length < 30 ? { ...it, photos: [...it.photos, data] } : it);
        return { ...d, items };
      })
    ));
  };
  const removePhoto = (idx: number, pi: number) =>
    updItem(idx, { photos: (draft?.items[idx].photos || []).filter((_, x) => x !== pi) });

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { alert("패키지 제목을 입력하세요."); return; }
    if (draft.items.length === 0) { alert("모델을 1명 이상 추가하세요."); return; }
    setSaving(true);
    try {
      const row: Pkg = { ...draft, title: draft.title.trim() };
      if (isNew) {
        await sb("packages", "POST", row);
        setPackages(prev => [row, ...prev]);
      } else {
        const { id, agency_id, created_at, ...patch } = row;
        await sb("packages", "PATCH", patch, `?id=eq.${row.id}`);
        setPackages(prev => prev.map(p => p.id === row.id ? row : p));
      }
      closeBuilder();
    } catch (e) {
      alert("저장 실패: " + String(e));
    }
    setSaving(false);
  };

  const remove = async (p: Pkg) => {
    if (!confirm(`'${p.title}' 패키지를 삭제할까요?`)) return;
    try {
      await sb("packages", "DELETE", null, `?id=eq.${p.id}`);
      setPackages(prev => prev.filter(x => x.id !== p.id));
    } catch (e) { alert("삭제 실패: " + String(e)); }
  };

  const copyLink = async (p: Pkg) => {
    const url = shareUrl(p.share_token);
    try { await navigator.clipboard.writeText(url); alert("공유 링크가 복사되었습니다.\n\n" + url); }
    catch { prompt("아래 링크를 복사해 고객사에 보내세요:", url); }
  };

  const togglePublic = async (p: Pkg) => {
    const next = !p.is_public;
    try {
      await sb("packages", "PATCH", { is_public: next }, `?id=eq.${p.id}`);
      setPackages(prev => prev.map(x => x.id === p.id ? { ...x, is_public: next } : x));
    } catch (e) { alert("변경 실패: " + String(e)); }
  };

  const pickModels = useMemo(() => {
    const q = pickQ.trim().toLowerCase();
    const used = new Set((draft?.items || []).map(i => i.model_id).filter(Boolean));
    return models.filter(m => !used.has(m.id) && (!q || (m.name || "").toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q)));
  }, [models, pickQ, draft]);

  // ──────────────────────────────── 목록 화면 ────────────────────────────────
  if (!draft) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}>
            <CardCheck size={20} style={{ verticalAlign: -2, flexShrink: 0 }} /> 패키지 ({packages.length})
          </h1>
          <button onClick={startNew} style={btnS(C.blue)}>+ 패키지 만들기</button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>
          모델 사진을 묶어 고객사에 제안하세요. 공유 링크 또는 PDF로 발송할 수 있습니다.
        </p>
        {packages.length === 0 ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "48px 20px", textAlign: "center", color: C.muted }}>
            <p style={{ margin: 0, fontSize: 14 }}>아직 패키지가 없습니다.</p>
            <button onClick={startNew} style={{ ...btnS(C.blue), marginTop: 14 }}>+ 첫 패키지 만들기</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {packages.map(p => (
              <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div onClick={() => openPreview(p)} title="클릭하면 고객이 보는 화면으로 미리보기" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: "pointer", opacity: busyId === p.id ? 0.5 : 1 }}>
                  <strong style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{p.title || "무제 패키지"}</strong>
                  <span style={{ fontSize: 11, color: C.textSub, background: C.card2, padding: "2px 8px", borderRadius: 10 }}>
                    {p.layout === "compcard" ? "컴카드" : "제안 패키지"}
                  </span>
                  <span style={{ fontSize: 12, color: C.muted }}><User size={11} style={{ verticalAlign: -2 }} /> {p.item_count ?? p.items?.length ?? 0}명</span>
                  {p.client_name && <span style={{ fontSize: 12, color: C.muted }}><Building size={11} style={{ verticalAlign: -2 }} /> {p.client_name}</span>}
                  <span style={{ fontSize: 11, color: p.is_public ? C.green : C.muted, marginLeft: isMobile ? 0 : "auto" }}>
                    {p.is_public ? "● 공개" : "○ 비공개"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button onClick={() => copyLink(p)} disabled={!p.is_public} style={{ ...btnS(C.blue, !p.is_public) }}><ExternalLink size={11} style={{ verticalAlign: -2 }} /> 링크 복사</button>
                  <button onClick={() => openPdf(p)} disabled={busyId === p.id} style={btnS(C.purple, busyId === p.id)}>{busyId === p.id ? "여는 중…" : "PDF / 인쇄"}</button>
                  <button onClick={() => openEdit(p)} disabled={busyId === p.id} style={{ ...btnS(C.muted, busyId === p.id) }}><Pencil size={11} style={{ verticalAlign: -2 }} /> 편집</button>
                  <button onClick={() => togglePublic(p)} style={{ padding: "6px 12px", background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>{p.is_public ? "비공개로" : "공개로"}</button>
                  <button onClick={() => remove(p)} style={{ padding: "6px 12px", background: "transparent", color: C.red, border: `1px solid ${C.red}44`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {preview && (
          <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "#eceff3", overflowY: "auto" }}>
            <button onClick={() => setPreview(null)} style={{ position: "fixed", top: 14, left: 14, zIndex: 1600, padding: "8px 16px", background: "#1a1d27", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>← 목록으로</button>
            <PackagePublicView pkg={preview} />
          </div>
        )}
      </div>
    );
  }

  // ──────────────────────────────── 빌더 화면 ────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
      <ModelBrowser models={models} isMobile={isMobile} multi pickedIds={picked} addedIds={addedIds} onSelect={togglePicked} onAddPicked={addPicked} onSelectAll={(ids) => setPicked(new Set(ids))} />
      <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text }}>{isNew ? "새 패키지" : "패키지 편집"}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={closeBuilder} style={{ padding: "8px 14px", background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>취소</button>
          <button onClick={save} disabled={saving} style={{ ...btnS(C.blue, saving), padding: "8px 18px", fontSize: 13 }}>{saving ? "저장 중…" : "저장"}</button>
        </div>
      </div>

      {/* 기본 정보 */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>패키지 제목</label>
        <input style={inp} placeholder="예: 봄 화보 캐스팅 제안 — A브랜드" value={draft.title} onChange={e => upd({ title: e.target.value })} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>고객사</label>
            <input style={inp} list="pkg-clients" placeholder="고객사명 (선택)" value={draft.client_name || ""} onChange={e => upd({ client_name: e.target.value })} />
            <datalist id="pkg-clients">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>형태</label>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {([["casting", "제안 패키지"], ["compcard", "컴카드"]] as [PackageLayout, string][]).map(([k, l]) => (
                <button key={k} onClick={() => upd({ layout: k })} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${draft.layout === k ? C.blue : C.border}`, background: draft.layout === k ? C.blue + "22" : "transparent", color: draft.layout === k ? C.blue : C.muted, fontSize: 13, fontWeight: draft.layout === k ? 700 : 500, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* 브랜딩 (이름 표시 토글 + 로고) */}
        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={draft.show_brand} onChange={e => upd({ show_brand: e.target.checked })} style={{ width: 16, height: 16, cursor: "pointer" }} />
            고객 화면·PDF에 에이전시 이름/로고 표시
          </label>
          {draft.show_brand && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>표시 이름</label>
                <input style={{ ...inp, marginBottom: 0 }} placeholder="에이전시명" value={draft.brand_name || ""} onChange={e => upd({ brand_name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 4 }}>로고 (선택)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {draft.brand_logo
                    ? <div style={{ position: "relative" }}>
                        <img src={draft.brand_logo} alt="" style={{ height: 40, maxWidth: 140, objectFit: "contain", border: `1px solid ${C.border}`, borderRadius: 6, padding: 4, background: "#fff" }} />
                        <span onClick={() => upd({ brand_logo: "" })} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, color: "#fff", fontSize: 11, lineHeight: "18px", textAlign: "center", cursor: "pointer" }}>×</span>
                      </div>
                    : <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", border: `1px dashed ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.textSub, fontSize: 12, fontWeight: 600 }}>
                        로고 업로드
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setLogo(e.target.files)} />
                      </label>}
                </div>
              </div>
            </div>
          )}
          {!draft.show_brand && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.muted }}>이름·로고 없이 자료만 표시됩니다.</p>}
        </div>
      </div>

      {/* 모델 항목들 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.muted }}>왼쪽 검색에서 모델을 골라 담거나</span>
        <button onClick={addBlankItem} style={{ padding: "6px 12px", background: "transparent", color: C.textSub, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>＋ 직접 추가</button>
      </div>

      {draft.items.length === 0 && (
        <p style={{ color: C.muted, fontSize: 13, padding: "20px 0" }}>모델을 추가하고 사진을 끌어다 놓으세요.</p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {draft.items.map((it, idx) => (
          <div key={idx} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong style={{ fontSize: 14, color: C.text }}>{it.name || `모델 ${idx + 1}`}</strong>
              <div style={{ display: "flex", gap: 6 }}>
                {it.model_id && (
                  <button onClick={() => { const m = models.find((x:any) => x.id === it.model_id); if (m) setCompModel(m); }}
                    style={{ ...btnS(C.purple), padding: "4px 10px", fontSize: 12 }}>
                    <CardCheck size={11} style={{ verticalAlign: -2 }} /> 컴카드 보기
                  </button>
                )}
                <button onClick={() => removeItem(idx)} style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>제거</button>
              </div>
            </div>

            {/* 드래그앤드롭 사진 영역 */}
            <div
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); addPhotos(idx, e.dataTransfer.files); }}
              style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                {it.photos.map((p, pi) => (
                  <div key={pi} style={{ position: "relative", aspectRatio: "3/4" }}>
                    <img src={thumbUrl(p)} loading="lazy" decoding="async" onError={e => { const t = e.currentTarget; if (t.src !== p) t.src = p; }} alt="" onClick={() => setZoom({ photos: it.photos, idx: pi })} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}`, cursor: "zoom-in", display: "block" }} />
                    <span onClick={() => removePhoto(idx, pi)} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, color: "#fff", fontSize: 11, lineHeight: "18px", textAlign: "center", cursor: "pointer" }}>×</span>
                  </div>
                ))}
                {it.photos.length < 30 && (
                  <label style={{ aspectRatio: "3/4", border: `1px dashed ${C.border}`, borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.muted, fontSize: 11, gap: 3 }}>
                    <span style={{ fontSize: 20 }}>＋</span>사진
                    <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addPhotos(idx, e.target.files)} />
                  </label>
                )}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted }}>이미지를 끌어다 놓거나 ＋ 사진을 눌러 추가 (최대 30장) · 사진을 누르면 크게 보기</p>
            </div>

            {/* 모델 정보 — DB 연결 모델은 등록 정보를 그대로 표시(재입력 불필요), 직접추가 항목만 입력칸 노출 */}
            {it.model_id ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "center", fontSize: 12.5, color: C.textSub, lineHeight: 1.6 }}>
                {[(it.gender === "F" ? "여성" : it.gender === "M" ? "남성" : ""), it.category, it.country, it.age ? `${it.age}세` : "", sizeLine(it), it.followers ? `팔로워 ${it.followers}` : ""].filter(Boolean).join("  ·  ")}
                <span style={{ fontSize: 11, color: C.muted }}>· 모델 정보에서 자동 반영 (수정은 ‘모델’ 메뉴에서)</span>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) minmax(0,1fr)" : "repeat(4,minmax(0,1fr))", gap: 8 }}>
                <input style={{ ...inp, marginBottom: 0 }} placeholder="이름" value={it.name} onChange={e => updItem(idx, { name: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="카테고리" value={it.category || ""} onChange={e => updItem(idx, { category: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="키(cm)" value={it.height || ""} onChange={e => updItem(idx, { height: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="신발(mm)" value={it.shoe || ""} onChange={e => updItem(idx, { shoe: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="가슴" value={it.bust || ""} onChange={e => updItem(idx, { bust: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="허리" value={it.waist || ""} onChange={e => updItem(idx, { waist: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="엉덩이" value={it.hip || ""} onChange={e => updItem(idx, { hip: e.target.value })} />
                <input style={{ ...inp, marginBottom: 0 }} placeholder="인스타 URL" value={it.instagram_url || ""} onChange={e => updItem(idx, { instagram_url: e.target.value })} />
              </div>
            )}
            <input style={{ ...inp, marginTop: 8, marginBottom: 0 }} placeholder="특기·메모 (선택)" value={it.caption || ""} onChange={e => updItem(idx, { caption: e.target.value })} />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>패키지 메모 (고객사에게 보일 안내문, 선택)</label>
        <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} placeholder="예: 아래 모델들 스케줄 가능합니다. 컨펌 주시면 상세 프로필 보내드립니다." value={draft.memo || ""} onChange={e => upd({ memo: e.target.value })} />
      </div>

      </div>

      {compModel && <CompCardModal model={compModel} agency={agency} onClose={() => setCompModel(null)} />}

      {/* 빌더 사진 확대 뷰어 */}
      {zoom && zoom.photos[zoom.idx] && (() => { const total = zoom.photos.length; const go = (d: number) => setZoom(s => s ? { ...s, idx: (s.idx + d + total) % total } : s); return (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <span onClick={() => setZoom(null)} style={{ position: "absolute", top: 14, right: 18, color: "#fff", fontSize: 30, cursor: "pointer", lineHeight: 1 }}>×</span>
          {total > 1 && <span onClick={e => { e.stopPropagation(); go(-1); }} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 42, cursor: "pointer", padding: 10, userSelect: "none" }}>‹</span>}
          {total > 1 && <span onClick={e => { e.stopPropagation(); go(1); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 42, cursor: "pointer", padding: 10, userSelect: "none" }}>›</span>}
          <img onClick={e => e.stopPropagation()} src={zoom.photos[zoom.idx]} alt="" style={{ maxWidth: "92%", maxHeight: "86vh", objectFit: "contain", borderRadius: 8 }} />
          <span style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#9aa2af", fontSize: 12 }}>{zoom.idx + 1} / {total}</span>
        </div>
      ); })()}

      {/* 모델 선택 모달 */}
      {modelPick && (
        <div onClick={() => setModelPick(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, width: "92%", maxWidth: 460, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: C.text }}>모델 선택</h3>
            <input style={inp} placeholder="이름·카테고리 검색" value={pickQ} onChange={e => setPickQ(e.target.value)} autoFocus />
            <div style={{ overflowY: "auto", display: "grid", gap: 6 }}>
              {pickModels.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>모델이 없습니다.</p>}
              {pickModels.map(m => (
                <div key={m.id} onClick={() => { addModelItem(m); setModelPick(false); setPickQ(""); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                  {m.thumb_url
                    ? <img src={m.thumb_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c9a96e,#8b6a3e)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>{(m.name || "?")[0]}</div>}
                  <strong style={{ fontSize: 14, color: C.text }}>{m.name}</strong>
                  {m.category && <span style={{ fontSize: 11, color: C.textSub, background: C.card2, padding: "2px 8px", borderRadius: 10 }}>{m.category}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
