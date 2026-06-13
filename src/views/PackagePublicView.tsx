// ════════════════════════════════════════════════════════════════
// 공개 패키지 뷰 — 고객사가 공유 링크(?pkg=토큰)로 여는 읽기 전용 페이지
//  · 로그인 불필요. anon 키 + RLS(is_public=true) 로 share_token 조회.
// ════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { sb } from "../lib/supabase";
import { type Pkg, type PackageItem, sizeLine, openPackageWindow } from "../lib/packages";

export default function PackagePublicView({ token }: { token: string }) {
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");

  useEffect(() => {
    (async () => {
      try {
        const rows = await sb("packages", "GET", null, `?share_token=eq.${encodeURIComponent(token)}&is_public=eq.true&limit=1`);
        if (rows && rows.length) { setPkg(rows[0]); setState("ok"); }
        else setState("notfound");
      } catch { setState("notfound"); }
    })();
  }, [token]);

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

  const Card = ({ it }: { it: PackageItem }) => {
    const photos = (it.photos || []).slice(0, isComp ? 6 : 3);
    const size = sizeLine(it);
    return (
      <div style={{ border: "1px solid #e6e9ef", borderRadius: 10, overflow: "hidden", background: "#fafbfc" }}>
        <div style={{ display: "grid", gap: 2, gridTemplateColumns: isComp ? "repeat(3,1fr)" : "1fr" }}>
          {photos.length ? photos.map((p, i) => (
            <div key={i} style={{ aspectRatio: "3/4", background: "#e9edf2", overflow: "hidden" }}>
              <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )) : (
            <div style={{ aspectRatio: "3/4", background: "#e9edf2", display: "flex", alignItems: "center", justifyContent: "center", color: "#aeb4bf", fontSize: 12 }}>사진 없음</div>
          )}
        </div>
        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{it.name || "이름 미정"}</div>
          {it.category && <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, color: "#5a6270", background: "#eef1f5", padding: "2px 8px", borderRadius: 10 }}>{it.category}</span>}
          {size && <div style={{ fontSize: 12.5, color: "#3f4754", marginTop: 7, fontVariantNumeric: "tabular-nums" }}>{size}</div>}
          {it.caption && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 }}>{it.caption}</div>}
          {it.instagram_url && <a href={it.instagram_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#E1306C", marginTop: 6, display: "block", wordBreak: "break-all" }}>{it.instagram_url}</a>}
        </div>
      </div>
    );
  };

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 780, margin: "0 auto 14px", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => openPackageWindow(pkg)} style={{ padding: "9px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#fff", background: "#3b82f6" }}>PDF 저장 / 인쇄</button>
      </div>
      <div style={{ maxWidth: 780, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "34px 32px", boxShadow: "0 4px 24px rgba(0,0,0,.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1a1d27", paddingBottom: 14, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-.5px" }}>{pkg.title}</h1>
            {pkg.client_name && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>고객사: {pkg.client_name}</div>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#3b82f6", textAlign: "right" }}>modiq<small style={{ display: "block", color: "#9aa2af", fontWeight: 500, fontSize: 10, marginTop: 2 }}>talent package</small></div>
        </div>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: isComp ? "1fr" : "repeat(2,1fr)" }}>
          {(pkg.items || []).map((it, i) => <Card key={i} it={it} />)}
        </div>
        {pkg.memo && <p style={{ fontSize: 12, color: "#6b7280", marginTop: 18, lineHeight: 1.6 }}>{pkg.memo}</p>}
        <div style={{ textAlign: "center", fontSize: 10, color: "#9aa2af", marginTop: 20 }}>본 자료는 제안용으로 제작되었습니다. 무단 배포를 금합니다.</div>
      </div>
    </div>
  );
}
