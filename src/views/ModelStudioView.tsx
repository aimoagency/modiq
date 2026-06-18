// ════════════════════════════════════════════════════════════════
// 모델 스튜디오 — 전체화면 사진 등록 + (3단계에서) 검색·필터·패키징
//  · 좌: 모델 검색/선택 + 프로필(썸네일·이름·정보 나열)
//  · 우: 선택 모델의 포트폴리오 사진 업로드(최대 15장, 드래그앤드롭)
// ════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { C, inp, btnS } from "../theme";
import { sb, sbUpload, dataURLtoBlob, STORAGE_BUCKET, thumbUrl } from "../lib/supabase";
import { ageFromSSN6 } from "../lib/utils";
import { MODEL_FIELDS } from "../constants";
import { User, Camera, CardCheck, Pencil } from "../components/icons";
import SearchInput from "../components/SearchInput";
import { type Pkg, type PackageItem, genPkgId, genShareToken, shareUrl } from "../lib/packages";
import { useBackClose } from "../lib/backstack";
import CompCardModal from "../components/CompCardModal";
import ModelBrowser from "../components/ModelBrowser";

const MAX_PHOTOS = 30;

// 포트폴리오용 리사이즈(최대 1200px) → base64
const resizeImage = (file: File, cb: (data: string) => void) => {
  if (!file.type.startsWith("image/")) return;
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1500; // 긴 변 최대 1500px로 축소 저장. 더 작은 사진은 원본 유지(확대 안 함)
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.6));
    };
    img.src = String(r.result);
  };
  r.readAsDataURL(file);
};

// Storage 키는 ASCII만 허용(한글 모델ID 등 거부됨) → 안전 문자로 치환
const safeSeg = (s: string) => String(s).replace(/[^A-Za-z0-9._-]/g, "_");

const infoRows = (m: any): [string, string][] => {
  const age = ageFromSSN6(m.ssn6);
  const three = [m.bust, m.waist, m.hip].filter(Boolean).join("-");
  const rows: [string, string][] = [];
  if (m.country) rows.push(["국적", m.country]);
  if (m.is_foreigner) {
    if (m.visa_entry) rows.push(["입국일", String(m.visa_entry).replace(/-/g, ".")]);
    if (m.visa_exit) rows.push(["출국일", String(m.visa_exit).replace(/-/g, ".")]);
    if (m.visa_type) rows.push(["비자타입", m.visa_type]);
  }
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

export default function ModelStudioView({ models, setModels, setPackages, agency, isMobile = false, initModelId = "", onEditModel }: {
  models: any[];
  setModels: (fn: (prev: any[]) => any[]) => void;
  setPackages: (fn: (prev: Pkg[]) => Pkg[]) => void;
  agency: { id: string; name: string };
  isMobile?: boolean;
  initModelId?: string;
  onEditModel?: (m: any) => void;
}) {
  const [mode, setMode] = useState<"photos" | "package" | "search">("photos");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  // 모델 수정 화면 → "스튜디오" 버튼으로 들어오면 해당 모델 포트폴리오 자동 선택
  useEffect(() => { if (initModelId) { setSelId(initModelId); setMode("photos"); } }, [initModelId]);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState(false);
  // 패키징 모드
  const [fieldF, setFieldF] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [packaging, setPackaging] = useState(false);
  const [compModel, setCompModel] = useState<any | null>(null); // 컴카드 모달 대상
  const [viewer, setViewer] = useState<number | null>(null); // 사진 확대 뷰어(인덱스)
  const [dragIdx, setDragIdx] = useState<number | null>(null); // 갤러리 드래그 정렬
  const [migrating, setMigrating] = useState(false); // 기존 base64 → Storage 이전 진행중
  const [thumbing, setThumbing] = useState(false); // 기존 사진 썸네일 일괄 생성 진행중
  const [thumbsDone, setThumbsDone] = useState(false); // 썸네일 일괄생성 완료(기기 기억 → 버튼 숨김)
  useEffect(() => { try { setThumbsDone(localStorage.getItem("modiq_thumbs_" + (agency?.id || "")) === "1"); } catch {} }, [agency?.id]);
  // 전체화면 오버레이 → 브라우저 뒤로가기로 닫기
  useBackClose(viewer !== null, () => setViewer(null));
  useBackClose(!!compModel, () => setCompModel(null));

  // ── 기존 base64 사진 → Storage 이전 (1회용, 멱등) ──
  // photos를 먼저 업로드해 base64→URL 매핑을 만들고, liked_photos는 같은 URL로 치환(순서/좋아요 유지)
  const base64Count = useMemo(() => models.reduce((n, m) => n + (Array.isArray(m.photos) ? m.photos.filter((p: string) => typeof p === "string" && p.startsWith("data:")).length : 0), 0), [models]);
  const migrateToStorage = async () => {
    if (base64Count === 0) { alert("이전할 base64 사진이 없습니다. 이미 모두 저장소에 있어요."); return; }
    if (!confirm(`기존 사진 ${base64Count}장을 Storage로 이전합니다.\n시간이 걸릴 수 있고, 중간에 닫지 마세요. 진행할까요?`)) return;
    setMigrating(true);
    let moved = 0;
    try {
      for (const m of models) {
        const map = new Map<string, string>();
        const srcPhotos: string[] = Array.isArray(m.photos) ? m.photos : [];
        const newPhotos: string[] = [];
        for (const p of srcPhotos) {
          if (typeof p === "string" && p.startsWith("data:")) {
            try {
              const base = `${safeSeg(agency.id)}/${safeSeg(m.id)}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              const url = await sbUpload(`${base}.jpg`, dataURLtoBlob(p));
              try { const small = await new Promise<string>(res => makeThumb(p, res)); await sbUpload(`${base}_thumb.jpg`, dataURLtoBlob(small)); } catch { /* 썸네일 실패해도 원본 폴백 */ }
              map.set(p, url); newPhotos.push(url); moved++;
            } catch { newPhotos.push(p); } // 실패분은 그대로 둠(재시도 가능)
          } else newPhotos.push(p);
        }
        const srcLiked: string[] = Array.isArray(m.liked_photos) ? m.liked_photos : [];
        const newLiked = srcLiked.map(p => map.get(p) || p);
        const patch: any = {};
        if (JSON.stringify(newPhotos) !== JSON.stringify(srcPhotos)) patch.photos = newPhotos;
        if (JSON.stringify(newLiked) !== JSON.stringify(srcLiked)) patch.liked_photos = newLiked;
        if (Object.keys(patch).length) {
          await sb("models", "PATCH", patch, `?id=eq.${m.id}`);
          setModels(prev => prev.map(x => x.id === m.id ? { ...x, ...patch } : x));
        }
      }
      alert(`이전 완료 — 사진 ${moved}장을 저장소로 옮겼습니다. 새로고침하면 로딩이 빨라집니다.`);
    } catch (e) { alert("이전 중 오류: " + String(e) + "\n다시 실행하면 남은 사진만 이어서 이전합니다."); }
    setMigrating(false);
  };

  // ── 기존 Storage 사진 썸네일(_thumb) 일괄 생성 — 갤러리 egress·로딩 절감. 멱등(재실행 안전) ──
  const storagePhotoCount = useMemo(() => models.reduce((n, m) => n + (Array.isArray(m.photos) ? m.photos.filter((p: string) => typeof p === "string" && p.includes("/object/public/" + STORAGE_BUCKET + "/") && /\.jpe?g(\?.*)?$/i.test(p)).length : 0), 0), [models]);
  const genAllThumbs = async () => {
    const targets: string[] = [];
    models.forEach(m => (Array.isArray(m.photos) ? m.photos : []).forEach((p: string) => { if (typeof p === "string" && p.includes("/object/public/" + STORAGE_BUCKET + "/") && /\.jpe?g(\?.*)?$/i.test(p)) targets.push(p); }));
    if (!targets.length) { alert("썸네일을 만들 Storage 사진이 없습니다."); return; }
    if (!confirm(`사진 ${targets.length}장의 썸네일을 생성합니다.\n시간이 걸릴 수 있고, 중간에 닫지 마세요. 진행할까요?`)) return;
    setThumbing(true);
    let made = 0;
    for (const url of targets) {
      try {
        const small = await new Promise<string>((res, rej) => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { const max = 360; const sc = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/jpeg", 0.62)); }; img.onerror = () => rej(new Error("load")); img.src = url; });
        const path = decodeURIComponent((url.split("/object/public/" + STORAGE_BUCKET + "/")[1] || "").split("?")[0]);
        if (!path) continue;
        await sbUpload(path.replace(/(\.jpe?g)$/i, "_thumb$1"), dataURLtoBlob(small));
        made++;
      } catch { /* 개별 실패는 건너뜀(재실행 시 이어서) */ }
    }
    setThumbing(false);
    if (made > 0) { setThumbsDone(true); try { localStorage.setItem("modiq_thumbs_" + (agency?.id || ""), "1"); } catch {} }
    alert(`썸네일 ${made}장 생성 완료.${made > 0 ? " 이 버튼은 이제 사라집니다." : ""}`);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return models.filter(m => !s || (m.name || "").toLowerCase().includes(s) || (m.category || "").toLowerCase().includes(s) || (Array.isArray(m.fields) && m.fields.join(",").toLowerCase().includes(s)));
  }, [models, q]);

  const sel = models.find(m => m.id === selId) || null;
  const photos: string[] = Array.isArray(sel?.photos) ? sel!.photos : [];
  const liked: string[] = Array.isArray(sel?.liked_photos) ? sel!.liked_photos : [];

  const savePhotos = async (next: string[]) => {
    if (!sel) return;
    setSaving(true);
    try {
      await sb("models", "PATCH", { photos: next }, `?id=eq.${sel.id}`);
      setModels(prev => prev.map(m => m.id === sel.id ? { ...m, photos: next } : m));
    } catch (e) { alert("사진 저장 실패: " + String(e)); }
    setSaving(false);
  };

  // 좋아요(즐겨찾기) 저장 — liked_photos 컬럼(사진 데이터 배열)
  const saveLikes = async (next: string[]) => {
    if (!sel) return;
    try {
      await sb("models", "PATCH", { liked_photos: next }, `?id=eq.${sel.id}`);
      setModels(prev => prev.map(m => m.id === sel.id ? { ...m, liked_photos: next } : m));
    } catch (e) { alert("좋아요 저장 실패: " + String(e)); }
  };

  // 대표 썸네일 = 작게 압축한 복사본(목록·카드용). 큰 사진도 자동 축소 → 용량 제한 걱정 없음.
  const makeThumb = (src: string, cb: (small: string) => void) => {
    const img = new Image();
    if (/^https?:/.test(src)) img.crossOrigin = "anonymous"; // Storage URL을 캔버스에 그리려면 CORS 필요
    img.onload = () => { const max = 360; const sc = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc); cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height); cb(cv.toDataURL("image/jpeg", 0.62)); };
    img.src = src;
  };
  const saveThumb = async (url: string) => {
    if (!sel) return;
    try { await sb("models", "PATCH", { thumb_url: url }, `?id=eq.${sel.id}`); setModels(prev => prev.map(m => m.id === sel.id ? { ...m, thumb_url: url } : m)); }
    catch (e) { alert("대표 사진 저장 실패: " + String(e)); }
  };
  const uploadThumb = (files: FileList | null) => { const f = files?.[0]; if (!f || !f.type.startsWith("image/")) return; const r = new FileReader(); r.onload = () => makeThumb(String(r.result), saveThumb); r.readAsDataURL(f); };
  // 갤러리 사진을 대표로 지정 → 맨 앞으로 + 작은 복사본을 thumb_url에 저장
  const setAsCover = (i: number) => { const url = photos[i]; if (i !== 0) { const next = [...photos]; const [p] = next.splice(i, 1); next.unshift(p); savePhotos(next); } makeThumb(url, saveThumb); };

  const addPhotos = (files: FileList | null) => {
    if (!files || !sel) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { alert(`사진은 최대 ${MAX_PHOTOS}장까지입니다.`); return; }
    const list = Array.from(files).slice(0, room);
    let collected: string[] = [];
    let done = 0;
    setSaving(true);
    // 리사이즈(base64) → Storage 업로드 → URL 저장. 업로드 실패 시 base64로 폴백(하위호환)
    list.forEach(f => resizeImage(f, async data => {
      try {
        const base = `${safeSeg(agency.id)}/${safeSeg(sel.id)}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const url = await sbUpload(`${base}.jpg`, dataURLtoBlob(data));
        try { const small = await new Promise<string>(res => makeThumb(data, res)); await sbUpload(`${base}_thumb.jpg`, dataURLtoBlob(small)); } catch { /* 썸네일 실패해도 원본 폴백 가능 */ }
        collected.push(url);
      } catch (e) {
        console.error("사진 업로드 실패 — base64로 저장(폴백)", e);
        collected.push(data);
      }
      done++;
      if (done === list.length) savePhotos([...photos, ...collected]);
    }));
  };

  const removePhoto = (i: number) => { const url = photos[i]; savePhotos(photos.filter((_, x) => x !== i)); if (liked.includes(url)) saveLikes(liked.filter(l => l !== url)); setViewer(null); };
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
    // 스튜디오 사진 전부 패키지에 반영(좋아요 컷을 앞순서로). 패키지 편집에서 필요시 삭제.
    const likedSet: string[] = Array.isArray(m.liked_photos) ? m.liked_photos : [];
    const all: string[] = Array.isArray(m.photos) && m.photos.length ? m.photos : (m.thumb_url ? [m.thumb_url] : []);
    const ordered = likedSet.length ? [...all.filter(p => likedSet.includes(p)), ...all.filter(p => !likedSet.includes(p))] : all;
    const photos: string[] = ordered.slice(0, MAX_PHOTOS);
    return {
      model_id: m.id, name: m.name || "", category: m.category || "", gender: m.gender || "",
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
      <SearchInput placeholder="이름·카테고리·분야 검색" value={q} onChange={setQ} />
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
        <SearchInput placeholder="이름 검색" value={q} onChange={setQ} style={{ marginBottom: 0, maxWidth: 260 }} />
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
                  {cover && <img src={thumbUrl(cover)} alt="" loading="lazy" decoding="async" onError={e => { const t = e.currentTarget; if (t.src !== cover) t.src = cover; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.text }}><Camera size={20} style={{ verticalAlign: -2 }} /> 포트폴리오</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {base64Count > 0 && (
            <button onClick={migrateToStorage} disabled={migrating}
              title="기존에 DB에 저장된 사진을 저장소(Storage)로 옮겨 로딩 속도를 높입니다"
              style={{ ...btnS(C.blue, migrating), fontSize: 12, whiteSpace: "nowrap" }}>
              {migrating ? "이전 중…" : `⚡ 사진 ${base64Count}장 저장소로 이전`}
            </button>
          )}
          {storagePhotoCount > 0 && !thumbsDone && (
            <button onClick={genAllThumbs} disabled={thumbing}
              title="기존 사진의 작은 썸네일을 만들어 갤러리 로딩 속도와 데이터 사용량(egress)을 줄입니다"
              style={{ ...btnS(C.purple, thumbing), fontSize: 12, whiteSpace: "nowrap" }}>
              {thumbing ? "썸네일 생성 중…" : `🖼 썸네일 생성 (${storagePhotoCount})`}
            </button>
          )}
          <span style={{ fontSize: 12, color: C.muted }}>모델 갤러리 사진을 등록·관리하세요. 패키지·컴카드는 이 갤러리에서 사진을 골라 구성합니다.</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: isMobile ? "stretch" : "flex-start" }}>
        <ModelBrowser models={models} isMobile={isMobile} onSelect={(m: any) => setSelId(m.id)} selectedId={selId || undefined} />

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
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <label style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{sel.thumb_url ? "대표 변경" : "＋ 대표 사진"}<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadThumb(e.target.files)} /></label>
                  {sel.thumb_url && <button onClick={() => saveThumb("")} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.red}44`, background: "transparent", color: C.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>삭제</button>}
                </div>
                <p style={{ fontSize: 11, color: C.muted, margin: "6px 0 0" }}>아래 갤러리 사진의 "대표 지정"으로도 설정돼요.</p>
                <button onClick={() => setCompModel(sel)} disabled={photos.length === 0} title={photos.length === 0 ? "사진을 먼저 등록하세요" : "컴카드 만들기"}
                  style={{ width: isMobile ? "100%" : "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", background: photos.length === 0 ? C.card2 : C.blue, color: photos.length === 0 ? C.muted : "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: photos.length === 0 ? "not-allowed" : "pointer", boxShadow: photos.length === 0 ? "none" : "0 2px 10px rgba(59,130,246,.35)" }}>
                  <CardCheck size={16} /> 컴카드 만들기
                </button>
                <button onClick={() => onEditModel && onEditModel(sel)} style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", background: "transparent", color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  <Pencil size={15} /> 정보 수정
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
                    {photos.map((p, i) => { return (
                      <div key={i}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={e => { if (dragIdx !== null) e.preventDefault(); }}
                        onDrop={e => { if (dragIdx !== null) { e.preventDefault(); e.stopPropagation(); if (dragIdx !== i) { const next = [...photos]; const [mv] = next.splice(dragIdx, 1); next.splice(i, 0, mv); savePhotos(next); } setDragIdx(null); } }}
                        onDragEnd={() => setDragIdx(null)}
                        style={{ position: "relative", aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, cursor: "grab", opacity: dragIdx === i ? 0.4 : 1 }}>
                        <img src={thumbUrl(p)} alt="" draggable={false} loading="lazy" decoding="async" onError={e => { const t = e.currentTarget; if (t.src !== p) t.src = p; }} onClick={() => setViewer(i)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in", display: "block" }} />
                        <span onClick={() => removePhoto(i)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12, lineHeight: "20px", textAlign: "center", cursor: "pointer" }}>×</span>
                        <button onClick={(e) => { e.stopPropagation(); setAsCover(i); }} title="이 사진을 대표로 지정" style={{ position: "absolute", bottom: 4, left: 4, right: 4, background: i === 0 ? C.blue : "rgba(0,0,0,.6)", color: "#fff", border: "none", borderRadius: 6, fontSize: 10, padding: "3px 0", cursor: "pointer" }}>{i === 0 ? "대표" : "대표 지정"}</button>
                      </div>
                    ); })}
                    {photos.length < MAX_PHOTOS && (
                      <label style={{ aspectRatio: "3/4", border: `1px dashed ${C.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.muted, fontSize: 12, gap: 4 }}>
                        <span style={{ fontSize: 26 }}>＋</span>사진 추가
                        <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addPhotos(e.target.files)} />
                      </label>
                    )}
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: C.muted }}>이미지를 끌어다 놓거나 ＋ 를 눌러 추가 (최대 30장)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewer !== null && photos[viewer] && (() => { const total = photos.length; const cur = photos[viewer]; const go = (d: number) => setViewer(v => v === null ? v : (v + d + total) % total); return (
        <div onClick={() => setViewer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <span onClick={() => setViewer(null)} style={{ position: "absolute", top: 14, right: 20, color: "#fff", fontSize: 30, cursor: "pointer", lineHeight: 1 }}>×</span>
          {total > 1 && <span onClick={e => { e.stopPropagation(); go(-1); }} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 42, cursor: "pointer", padding: 10, userSelect: "none" }}>‹</span>}
          {total > 1 && <span onClick={e => { e.stopPropagation(); go(1); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 42, cursor: "pointer", padding: 10, userSelect: "none" }}>›</span>}
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: "92%" }}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
              <img src={cur} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8, display: "block" }} />
            </div>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>{viewer + 1} / {total}</span>
          </div>
        </div>
      ); })()}

      {compModel && <CompCardModal model={compModel} agency={agency} onClose={() => setCompModel(null)}
        onSave={async (compcard) => {
          await sb("models", "PATCH", { compcard }, `?id=eq.${compModel.id}`);
          setModels(prev => prev.map(m => m.id === compModel.id ? { ...m, compcard } : m));
          setCompModel((c: any) => c ? { ...c, compcard } : c);
        }} />}
    </div>
  );
}
