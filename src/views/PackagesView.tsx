// ════════════════════════════════════════════════════════════════
// 패키지 뷰 — 모델 사진 패키지 제작/관리
//  · 목록 + 빌더 모달(드래그앤드롭 사진, 모델 선택, casting/compcard)
//  · 공유 링크 복사 / PDF·인쇄 / 공개여부 토글 / 삭제
// ════════════════════════════════════════════════════════════════
import { useMemo, useState, type CSSProperties } from "react";
import { C, inp, btnS } from "../theme";
import { sb, thumbUrl } from "../lib/supabase";
import {
  type Pkg, type PackageItem, type PackageLayout,
  genPkgId, genShareToken, emptyItem, shareUrl, sizeLine,
} from "../lib/packages";
import { useBackClose } from "../lib/backstack";
import { ageFromSSN6 } from "../lib/utils";
import { parseVideoUrl, enrichVideo, VIDEO_LABEL, type VideoRef } from "../lib/video";
import { CardCheck, User, Building, ExternalLink, Pencil } from "../components/icons";
import CompCardModal from "../components/CompCardModal";
import SearchInput from "../components/SearchInput";
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
  const [vidInputs, setVidInputs] = useState<Record<number, string>>({}); // 아이템별 영상 링크 입력
  const [vidPlay, setVidPlay] = useState<VideoRef | null>(null); // 빌더 영상 재생 모달
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
  const openEdit    = async (p: Pkg) => { const f = await hydrate(p); if (f) startEdit(f); };

  // 전체화면 오버레이 → 브라우저 뒤로가기로 닫기(LIFO: 라이트박스가 미리보기보다 먼저 닫힘)
  useBackClose(!!preview, () => setPreview(null));
  useBackClose(!!zoom, () => setZoom(null));
  useBackClose(modelPick, () => setModelPick(false));
  useBackClose(!!compModel, () => setCompModel(null));

  const newDraft = (): Pkg => ({
    id: genPkgId(), agency_id: agency.id, title: "", client_name: "",
    layout: "casting", items: [], memo: "",
    show_brand: true, brand_name: agency.name || "", brand_logo: "",
    share_token: genShareToken(), is_public: true,
  });

  // 로고는 회사 로고(CompanyView.onLogoFile)와 동일 방식: 캔버스 리사이즈 후 PNG로 저장 → 투명 배경 유지.
  // (사진용 resizeImage는 JPEG로 변환해 PNG 투명 영역이 검게 나오므로 로고엔 쓰지 않음)
  const setLogo = (files: FileList | null) => {
    const f = files?.[0]; if (!f || !f.type.startsWith("image/")) return;
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => {
      const max = 240; const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      upd({ brand_logo: cv.toDataURL("image/png") });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const startNew = () => { setDraft(newDraft()); setIsNew(true); };
  // 기존 패키지를 편집으로 열 때, model_id가 있는 항목은 '현재 포트폴리오'의 사진·정보로 새로고침
  // → 포트폴리오에서 사진을 바꾸면 패키지에도 반영됨. (패키지에서 직접 올린 사진(data:)은 보존)
  const refreshItemFromModel = (it: PackageItem): PackageItem => {
    if (!it.model_id) return it;
    const m = models.find((x: any) => x.id === it.model_id);
    if (!m) return it; // 삭제된 모델 → 기존 스냅샷 유지
    const age = ageFromSSN6(m.ssn6);
    // 포트폴리오 갤러리 순서(m.photos) 그대로 사용 — 좋아요(liked) 우선정렬 없이 갤러리와 1:1 일치
    const all = Array.isArray(m.photos) && m.photos.length > 0 ? m.photos : (m.thumb_url ? [m.thumb_url] : []);
    const manual = (it.photos || []).filter((p: string) => typeof p === "string" && p.startsWith("data:"));
    // 영상: 모델 포트폴리오 영상 최신 반영 + 패키지에서 직접 추가한(모델에 없는) 영상 보존
    const modelVids: VideoRef[] = Array.isArray(m.videos) ? m.videos : [];
    const itemVids: VideoRef[] = Array.isArray(it.videos) ? it.videos : [];
    const extraVids = itemVids.filter(iv => !modelVids.some(mv => mv.provider === iv.provider && mv.id === iv.id));
    return {
      ...it,
      name: m.name || it.name, category: m.category || "", gender: m.gender || "",
      country: m.country || "", age: age !== null ? String(age) : "",
      height: m.height || "", bust: m.bust || "", waist: m.waist || "", hip: m.hip || "", shoe: m.shoe || "",
      hair_color: m.hair_color || "", tattoo: !!m.tattoo,
      followers: m.instagram_followers || "", instagram_url: m.instagram_url || "",
      photos: [...all, ...manual].slice(0, 30),
      videos: [...modelVids, ...extraVids].slice(0, 8),
    };
  };
  const startEdit = (p: Pkg) => {
    const cloned = JSON.parse(JSON.stringify(p));
    cloned.items = (cloned.items || []).map(refreshItemFromModel);
    setDraft({ show_brand: true, brand_name: agency.name || "", brand_logo: "", ...cloned });
    setIsNew(false);
  };
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
      hair_color: m.hair_color || "", tattoo: !!m.tattoo,
      followers: m.instagram_followers || "",
      instagram_url: m.instagram_url || "", caption: "",
      photos: (Array.isArray(m.photos) && m.photos.length > 0 ? m.photos : (m.thumb_url ? [m.thumb_url] : [])).slice(0, 30), // 포트폴리오 갤러리 순서 그대로
      videos: Array.isArray(m.videos) ? [...m.videos].slice(0, 8) : [], // 포트폴리오 영상 상속
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

  // ── 아이템 영상(외부 임베드) ──
  const addItemVideo = async (idx: number) => {
    const raw = vidInputs[idx] || "";
    const v = parseVideoUrl(raw);
    if (!v) { alert("YouTube·Vimeo·Instagram·TikTok 링크를 인식할 수 없어요. (TikTok은 전체 주소 .../video/숫자)"); return; }
    const cur = draft?.items[idx]?.videos || [];
    if (cur.length >= 8) { alert("영상은 항목당 최대 8개"); return; }
    if (cur.some(x => x.provider === v.provider && x.id === v.id)) { alert("이미 추가된 영상이에요."); return; }
    const ref = await enrichVideo(v);
    updItem(idx, { videos: [...cur, ref] });
    setVidInputs(s => ({ ...s, [idx]: "" }));
  };
  const removeItemVideo = (idx: number, vi: number) =>
    updItem(idx, { videos: (draft?.items[idx].videos || []).filter((_, x) => x !== vi) });
  const toggleItemVideoOrient = (idx: number, vi: number) =>
    updItem(idx, { videos: (draft?.items[idx].videos || []).map((v, x) => x === vi ? { ...v, vertical: !v.vertical } : v) });

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) { alert("패키지 제목을 입력하세요."); return; }
    if (draft.items.length === 0) { alert("모델을 1명 이상 추가하세요."); return; }
    setSaving(true);
    try {
      // item_count는 DB 생성 컬럼(jsonb_array_length(items)) → payload에서 제외(포함 시 428C9 에러)
      const { item_count, ...clean } = { ...draft, title: draft.title.trim() } as any;
      const row: Pkg = clean;
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
    return models.filter(m => !used.has(m.id) && (!q || (m.name || "").toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q) || (m.source_agency_name || "").toLowerCase().includes(q)));
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
        ) : (() => {
          // ── Vercel식 행: 하나의 컨테이너 안 얇은 divider 행 · 좌측 정보 / 우측 버튼 정렬 ──
          let first = true;
          const top = () => { const t = first ? "none" : `1px solid ${C.border}`; first = false; return t; };
          // 액션 버튼 공통 컴팩트 스타일 — 표 행에 맞게 통일(M3 큰 pill 섞임 방지)
          const aBase: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6, whiteSpace: "nowrap", cursor: "pointer", lineHeight: 1.2 };
          const off = { opacity: 0.5, cursor: "not-allowed" as const };
          // 삭제는 분리(카드 우상단) — 4개 주요 액션만 한 줄. fill=true면 모바일에서 균등 분배(flex:1)로 한 줄 채움.
          const mainButtons = (p: Pkg, fill = false) => (<>
            <button onClick={() => openPreview(p)} disabled={busyId === p.id} style={{ ...aBase, ...(fill ? { flex: 1 } : {}), background: C.purple + "1a", color: C.purple, border: `1px solid ${C.purple}33`, ...(busyId === p.id ? off : {}) }}><ExternalLink size={11} /> {busyId === p.id ? "여는 중…" : "보기"}</button>
            <button onClick={() => copyLink(p)} disabled={!p.is_public} style={{ ...aBase, ...(fill ? { flex: 1 } : {}), background: C.blue + "1a", color: C.blue, border: `1px solid ${C.blue}33`, ...(!p.is_public ? off : {}) }}><ExternalLink size={11} /> 링크</button>
            <button onClick={() => openEdit(p)} disabled={busyId === p.id} style={{ ...aBase, ...(fill ? { flex: 1 } : {}), background: C.card2, color: C.textSub, border: `1px solid ${C.border}`, ...(busyId === p.id ? off : {}) }}><Pencil size={11} /> 편집</button>
            <button onClick={() => togglePublic(p)} style={{ ...aBase, ...(fill ? { flex: 1 } : {}), background: "transparent", color: C.textSub, border: `1px solid ${C.border}` }}>{p.is_public ? "비공개" : "공개"}</button>
          </>);
          const delBtn = (p: Pkg) => <button onClick={() => remove(p)} style={{ ...aBase, flexShrink: 0, background: "transparent", color: C.red, border: `1px solid ${C.red}44` }}>삭제</button>;
          // 좌측 묶음: 제목 + 인원수 + 업체명 — 모바일은 한 줄에 붙여서
          const left = (p: Pkg) => {
            const count = p.item_count ?? p.items?.length ?? 0;
            return (
              <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14, fontWeight: 700, color: C.text }}>
                  {p.title || "(제목 없음)"}
                </span>
                <span style={{ flexShrink: 0, fontSize: 11, color: C.textSub, background: C.card2, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
                  <User size={11} style={{ verticalAlign: -2 }} /> 모델 {count}명
                </span>
                {p.client_name && (
                  <span style={{ flexShrink: 0, fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Building size={11} style={{ verticalAlign: -2 }} /> {p.client_name}
                  </span>
                )}
              </span>
            );
          };
          // ⚠️ 헤더·데이터 행은 별개 grid 컨테이너 → 모든 트랙을 고정 px 또는 minmax(0,fr)로(LIST_ALIGNMENT.md).
          //    예전 마지막 컬럼 max-content는 헤더('관리' 글자폭)와 데이터(버튼묶음 폭)가 달라 제목·거래처가 어긋났음.
          const PKG_GRID = "minmax(0,2fr) minmax(0,1.2fr) 96px minmax(0,2.8fr)";
          return (
            <div style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.card }}>
              {!isMobile && (
                <div style={{ display: "grid", gridTemplateColumns: PKG_GRID, alignItems: "center", gap: 14, padding: "9px 16px", background: C.card2, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>
                  <span>제목</span><span>거래처</span><span>모델수</span><span style={{ textAlign: "right" }}>관리</span>
                </div>
              )}
              {packages.map(p => {
                const bt = top();
                if (isMobile) return (
                  <div key={p.id} style={{ borderTop: bt, padding: "12px 16px" }}>
                    {/* 상단: 제목 정보 + 우상단 삭제 / 하단: 주요 액션 한 줄 균등 */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{left(p)}</span>
                      {delBtn(p)}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>{mainButtons(p, true)}</div>
                  </div>
                );
                const count = p.item_count ?? p.items?.length ?? 0;
                return (
                  <div key={p.id}
                    onMouseEnter={e => (e.currentTarget.style.background = C.card2)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    style={{ display: "grid", gridTemplateColumns: PKG_GRID, alignItems: "center", gap: 14, padding: "12px 16px", borderTop: bt, transition: "background 0.12s" }}>
                    {/* 제목 */}
                    <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 14, fontWeight: 700, color: C.text }}>{p.title || "(제목 없음)"}</span>
                    {/* 거래처 (빈칸 그대로 유지) */}
                    <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{p.client_name ? <><Building size={11} style={{ verticalAlign: -2 }} /> {p.client_name}</> : ""}</span>
                    {/* 모델수 */}
                    <span style={{ fontSize: 11, color: C.textSub, background: C.card2, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap", justifySelf: "start" }}><User size={11} style={{ verticalAlign: -2 }} /> 모델 {count}명</span>
                    {/* 액션 버튼 (오른쪽 끝) — 주요 4개 + 삭제 */}
                    <span style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>{mainButtons(p)}{delBtn(p)}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
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

            {/* 영상(외부 임베드 — 모델 포트폴리오 영상 자동 포함 + 직접 추가) */}
            <div style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: (it.videos && it.videos.length) ? 8 : 0 }}>
                <input style={{ ...inp, marginBottom: 0, flex: 1, minWidth: 0, fontSize: 12 }} placeholder="영상 링크 (YouTube·Vimeo·Instagram·TikTok)" value={vidInputs[idx] || ""}
                  onChange={e => setVidInputs(s => ({ ...s, [idx]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") addItemVideo(idx); }} />
                <button type="button" onClick={() => addItemVideo(idx)} disabled={!(vidInputs[idx] || "").trim()} style={{ ...btnS(C.blue, !(vidInputs[idx] || "").trim()), padding: "0 12px", whiteSpace: "nowrap" }}>영상</button>
              </div>
              {it.videos && it.videos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                  {it.videos.map((v, vi) => (
                    <div key={v.provider + v.id} onClick={() => setVidPlay(v)} style={{ position: "relative", height: 110, aspectRatio: v.vertical ? "9/16" : "16/9", flex: "0 0 auto", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}`, background: "#000", cursor: "pointer" }}>
                      {v.thumb ? <img src={v.thumb} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, display: "block" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 10 }}>{VIDEO_LABEL[v.provider]}</div>}
                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15 }}>▶</span>
                      <span onClick={e => { e.stopPropagation(); toggleItemVideoOrient(idx, vi); }} style={{ position: "absolute", bottom: 3, right: 3, fontSize: 8, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.55)", padding: "1px 4px", borderRadius: 3, cursor: "pointer" }}>{v.vertical ? "세로" : "가로"}</span>
                      <span onClick={e => { e.stopPropagation(); removeItemVideo(idx, vi); }} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, color: "#fff", fontSize: 11, lineHeight: "18px", textAlign: "center", cursor: "pointer" }}>×</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted }}>모델 포트폴리오 영상은 자동 포함 · 링크로 직접 추가도 가능 (항목당 최대 8개 · 저장공간 차지 없음)</p>
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
      {vidPlay && (
        <div onClick={() => setVidPlay(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <span onClick={() => setVidPlay(null)} style={{ position: "absolute", top: 14, right: 20, color: "#fff", fontSize: 30, cursor: "pointer", lineHeight: 1 }}>×</span>
          <div onClick={e => e.stopPropagation()} style={{ ...(vidPlay.vertical ? { height: "min(88vh, 100%)", maxWidth: "94%", aspectRatio: "9/16" } : { width: "min(960px, 94%)", aspectRatio: "16/9" }), background: "#000", borderRadius: 10, overflow: "hidden" }}>
            <iframe src={vidPlay.embed + (vidPlay.provider === "youtube" ? "?autoplay=1&rel=0" : vidPlay.provider === "instagram" ? "" : "?autoplay=1")} title="model video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen scrolling="no" style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
          </div>
        </div>
      )}

      {modelPick && (
        <div onClick={() => setModelPick(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, width: "92%", maxWidth: 460, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: C.text }}>모델 선택</h3>
            <SearchInput placeholder="이름·카테고리·업체명 검색" value={pickQ} onChange={setPickQ} autoFocus />
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
