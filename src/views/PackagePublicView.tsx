// ════════════════════════════════════════════════════════════════
// 공개 패키지 뷰 — 고객사가 공유 링크(?pkg=토큰)로 여는 읽기 전용 페이지
//  · 로그인 불필요. anon 키 + RLS(is_public=true) 로 share_token 조회.
// ════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { type Pkg, type PackageItem, sizeLine, openPackageWindow, downloadCompCardPdf, compCardInnerHtml } from "../lib/packages";

export default function PackagePublicView({ token, pkg: pkgProp }: { token?: string; pkg?: Pkg }) {
  const [pkg, setPkg] = useState<Pkg | null>(pkgProp || null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">(pkgProp ? "ok" : "loading");
  const [gallery, setGallery] = useState<PackageItem | null>(null);          // 모델 전체 사진 화면
  const [zoom, setZoom] = useState<{ photos: string[]; idx: number } | null>(null); // 가운데 플로팅 확대
  const [downloading, setDownloading] = useState<string | null>(null);              // 컴카드 PDF 생성 중인 항목
  const [compItem, setCompItem] = useState<PackageItem | null>(null);                // 컴카드 미리보기 대상

  useEffect(() => {
    if (pkgProp) { setPkg(pkgProp); setState("ok"); return; }
    if (!token) { setState("notfound"); return; }
    (async () => {
      try {
        const rows = await sb("packages", "GET", null, `?share_token=eq.${encodeURIComponent(token)}&is_public=eq.true&limit=1`);
        if (rows && rows.length) { setPkg(rows[0]); setState("ok"); }
        else setState("notfound");
      } catch { setState("notfound"); }
    })();
  }, [token, pkgProp]);

  const wrap: React.CSSProperties = {
    minHeight: "100vh", background: "#eceff3", color: "#1a1d27",
    fontFamily: "'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif",
    padding: "24px 16px",
  };

  if (state === "loading")
    return <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>불러오는 중…</div>;

  if (state === "notfound" || !pkg)
    return (
      <div style={{ ...wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <p style={{ fontSize: 18, fontWeight: 800 }}>패키지를 찾을 수 없습니다</p>
        <p style={{ color: "#6b7280", fontSize: 13 }}>링크가 만료되었거나 비공개로 전환되었을 수 있습니다.</p>
      </div>
    );

  const isComp = pkg.layout === "compcard";

  const fmtFollowers = (f?: string) => {
    if (!f) return "";
    const n = Number(String(f).replace(/[^0-9]/g, ""));
    if (!n) return String(f);
    return n >= 10000 ? `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}만` : n.toLocaleString();
  };

  const downloadComp = async (it: PackageItem, key: string) => {
    setDownloading(key);
    try { await downloadCompCardPdf(it, pkg.show_brand ? (pkg.brand_name || "") : ""); }
    catch (e) { alert("컴카드 생성 실패: " + String(e)); }
    setDownloading(null);
  };

  const Card = ({ it, idx }: { it: PackageItem; idx: number }) => {
    const all = it.photos || [];
    const cover = all[0];                                     // 대표 1컷만 표시 (전체는 클릭 시 갤러리에서)
    const size = sizeLine(it);                                // 키 · 3사이즈 · 신발
    const idLine = [it.country, it.age ? `${it.age}세` : ""].filter(Boolean).join(" · ");
    const fol = fmtFollowers(it.followers);
    const dlKey = (it.model_id || it.name || "") + "_" + idx;
    return (
      <div style={{ border: "1px solid #e6e9ef", borderRadius: 10, overflow: "hidden", background: "#fafbfc", ...(isComp ? {} : { flex: "1 1 230px", maxWidth: 320, minWidth: 0 }) }}>
        <div onClick={() => all.length && setGallery(it)} style={{ aspectRatio: "3/4", background: "#e9edf2", overflow: "hidden", cursor: all.length ? "pointer" : "default", position: "relative" }}>
          {cover
            ? <img src={cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aeb4bf", fontSize: 12 }}>사진 없음</div>}
          {all.length > 1 && <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>＋{all.length}장 보기</span>}
        </div>
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>{it.name || "이름 미정"}</span>
              {fol && <span style={{ fontSize: 11, color: "#E1306C", fontWeight: 700, whiteSpace: "nowrap" }}>♥ {fol}</span>}
            </div>
            <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {it.category && <span style={{ fontSize: 11, color: "#5a6270", background: "#eef1f5", padding: "2px 8px", borderRadius: 10 }}>{it.category}</span>}
              {idLine && <span style={{ fontSize: 12, color: "#3f4754" }}>{idLine}</span>}
            </div>
            {size && <div style={{ fontSize: 12.5, color: "#3f4754", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{size}</div>}
            {it.caption && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>{it.caption}</div>}
          </div>
          <button onClick={(e) => { e.stopPropagation(); if (all.length) setCompItem(it); }} disabled={!all.length}
            title={all.length ? "컴카드 미리보기" : "사진이 없어 컴카드를 만들 수 없습니다"}
            style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "8px 11px", background: all.length ? "#1a1d27" : "#c8ccd8", color: "#fff", border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: all.length ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
            컴카드
          </button>
        </div>
      </div>
    );
  };

  const maxW = 1600;
  return (
    <div style={wrap}>
      <div style={{ maxWidth: maxW, margin: "0 auto 14px", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => openPackageWindow(pkg)} style={{ padding: "9px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", background: "#3b82f6" }}>PDF 저장 / 인쇄</button>
      </div>
      <div style={{ maxWidth: maxW, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "clamp(20px, 3vw, 36px)", boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1a1d27", paddingBottom: 14, marginBottom: 22, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 900, letterSpacing: "-.5px" }}>{pkg.title}</h1>
            {pkg.client_name && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>고객사: {pkg.client_name}</div>}
          </div>
          {pkg.show_brand && (
            <div style={{ textAlign: "right" }}>
              {pkg.brand_logo
                ? <img src={pkg.brand_logo} alt="" style={{ maxHeight: 46, maxWidth: 180, objectFit: "contain", display: "inline-block" }} />
                : <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1d27" }}>{pkg.brand_name || "modiq"}</div>}
              <small style={{ display: "block", color: "#9aa2af", fontWeight: 500, fontSize: 10, marginTop: 3 }}>talent package</small>
            </div>
          )}
        </div>
        <div style={isComp
          ? { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }
          : { display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "flex-start" }}>
          {(pkg.items || []).map((it, i) => <Card key={i} it={it} idx={i} />)}
        </div>
        {pkg.memo && <p style={{ fontSize: 13, color: "#6b7280", marginTop: 18, lineHeight: 1.6 }}>{pkg.memo}</p>}
        <div style={{ textAlign: "center", fontSize: 10, color: "#9aa2af", marginTop: 20 }}>본 자료는 제안용으로 제작되었습니다. 무단 배포를 금합니다.</div>
      </div>

      {/* 1단계 — 모델 전체 사진 갤러리 화면 */}
      {gallery && (() => {
        const g = gallery;
        const gph = g.photos || [];
        const gsize = sizeLine(g);
        const gid = [g.country, g.age ? `${g.age}세` : ""].filter(Boolean).join(" · ");
        const gfol = fmtFollowers(g.followers);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.97)", zIndex: 2000, overflowY: "auto", padding: "clamp(16px,4vw,40px)" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, color: "#fff", flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 24, fontWeight: 900 }}>{g.name || "모델"}</span>
                    {gfol && <span style={{ fontSize: 13, color: "#E1306C", fontWeight: 700 }}>♥ {gfol}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#c8ccd8", marginTop: 6 }}>
                    {[g.category, gid, gsize].filter(Boolean).join("   ·   ")}
                  </div>
                  {g.caption && <div style={{ fontSize: 12.5, color: "#9aa2af", marginTop: 4 }}>{g.caption}</div>}
                </div>
                <button onClick={() => setGallery(null)} style={{ background: "transparent", border: "1px solid #ffffff44", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>× 닫기</button>
              </div>
              {gph.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
                  {gph.map((p, i) => (
                    <div key={i} onClick={() => setZoom({ photos: gph, idx: i })} style={{ aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", cursor: "zoom-in", background: "#22263a" }}>
                      <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#9aa2af" }}>등록된 사진이 없습니다.</p>}
              <p style={{ textAlign: "center", color: "#6b7280", fontSize: 12, marginTop: 18 }}>사진을 클릭하면 가운데에서 크게 볼 수 있습니다.</p>
            </div>
          </div>
        );
      })()}

      {/* 2단계 — 가운데 플로팅 확대 (갤러리 위에 표시, 바깥 클릭 시 갤러리로 복귀) */}
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: 20 }}>
          <span onClick={() => setZoom(null)} style={{ position: "absolute", top: 14, right: 18, color: "#fff", fontSize: 30, cursor: "pointer", lineHeight: 1 }}>×</span>
          {zoom.photos.length > 1 && (
            <span onClick={e => { e.stopPropagation(); setZoom(s => s ? { ...s, idx: (s.idx - 1 + s.photos.length) % s.photos.length } : s); }}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 42, cursor: "pointer", padding: 12, userSelect: "none" }}>‹</span>
          )}
          <img onClick={e => e.stopPropagation()} src={zoom.photos[zoom.idx]} alt=""
            style={{ maxWidth: "90vw", maxHeight: "86vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 10px 50px rgba(0,0,0,.6)" }} />
          {zoom.photos.length > 1 && (
            <span onClick={e => { e.stopPropagation(); setZoom(s => s ? { ...s, idx: (s.idx + 1) % s.photos.length } : s); }}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#fff", fontSize: 42, cursor: "pointer", padding: 12, userSelect: "none" }}>›</span>
          )}
          <span style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", color: "#9aa2af", fontSize: 12 }}>{zoom.idx + 1} / {zoom.photos.length} · 바깥을 클릭하면 갤러리로</span>
        </div>
      )}

      {/* 컴카드 미리보기 → 다운로드 */}
      {compItem && (
        <div onClick={() => setCompItem(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,17,23,0.93)", zIndex: 2200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(16px,3vw,32px)", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "min(94vw, 940px)", aspectRatio: "297 / 210", background: "#fff", borderRadius: 6, overflow: "hidden", boxShadow: "0 12px 50px rgba(0,0,0,.5)" }}
            dangerouslySetInnerHTML={{ __html: compCardInnerHtml(compItem, pkg.show_brand ? (pkg.brand_name || "") : "") }} />
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => downloadComp(compItem, "preview")} disabled={downloading === "preview"}
              style={{ padding: "10px 22px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: downloading === "preview" ? 0.6 : 1 }}>
              {downloading === "preview" ? "생성 중…" : "⬇ 다운로드"}
            </button>
            <button onClick={() => setCompItem(null)} style={{ padding: "10px 18px", background: "transparent", color: "#fff", border: "1px solid #ffffff55", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
