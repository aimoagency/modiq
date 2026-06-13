// ════════════════════════════════════════════════════════════════
// 패키지 기능 — 타입 / 헬퍼 / PDF·인쇄용 팝업 빌더
//  · 패키지 = 모델 사진 묶음. layout 으로 두 형태를 표현:
//    - casting : 여러 모델을 그리드로 (고객사 제안용)
//    - compcard: 단일 모델을 컴카드 카드로
//  · 사진은 기존 reference_images 와 동일하게 base64 data URL 로 저장
// ════════════════════════════════════════════════════════════════

export type PackageLayout = "casting" | "compcard";

export type PackageItem = {
  model_id?: string;        // 연결된 모델 (선택)
  name: string;
  category?: string;
  country?: string;         // 국적
  age?: string;             // 나이 (예: "24")
  height?: string;
  bust?: string;
  waist?: string;
  hip?: string;
  shoe?: string;
  followers?: string;       // 인스타 팔로워 수 (썸네일 아래 표시, URL 대신)
  instagram_url?: string;
  caption?: string;         // 자유 메모 (특기 등)
  photos: string[];         // base64 data URL 들
};

export type Pkg = {
  id: string;
  agency_id: string;
  title: string;
  client_name?: string;
  layout: PackageLayout;
  items: PackageItem[];
  memo?: string;
  show_brand: boolean;      // 헤더에 에이전시 이름/로고 표시 여부
  brand_name?: string;      // 표시 이름 (기본 = 에이전시명)
  brand_logo?: string;      // 로고 이미지 (base64 data URL, 선택)
  share_token: string;
  is_public: boolean;
  created_at?: string;
};

import { ageFromSSN6 } from "./utils";

// ── 식별자 / 토큰 ──
export const genPkgId = () => `PKG_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const genShareToken = () => {
  // 추측 불가 토큰 (crypto 우선, 폴백 포함)
  try {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 36);
  }
};

export const emptyItem = (): PackageItem => ({ name: "", photos: [] });

// ── 공개 공유 URL (현재 앱 origin 기준) ──
export const shareUrl = (token: string) =>
  `${location.origin}${location.pathname}?pkg=${encodeURIComponent(token)}`;

// ── 사이즈 요약 문자열 ("173 / 34-24-35 / 240") ──
export const sizeLine = (it: PackageItem): string => {
  const three = [it.bust, it.waist, it.hip].filter(Boolean).join("-");
  return [it.height && `${it.height}cm`, three, it.shoe && `${it.shoe}mm`]
    .filter(Boolean).join(" · ");
};

// ── HTML escape ──
const esc = (s: any) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ════════════════════════════════════════════════════════════════
// PDF·인쇄용 팝업 HTML — 정산명세서와 동일 패턴(html2canvas+jsPDF)
// ════════════════════════════════════════════════════════════════
export function buildPackageHtml(pkg: Pkg, agencyName = "modiq"): string {
  const isComp = pkg.layout === "compcard";
  const subj = `${pkg.title}${pkg.client_name ? ` · ${pkg.client_name}` : ""}`;
  const brandName = pkg.brand_name || agencyName;
  const brandHtml = pkg.show_brand
    ? `<div class="brand">
         ${pkg.brand_logo ? `<img class="logo" src="${esc(pkg.brand_logo)}" alt=""/>` : `<div class="bname">${esc(brandName)}</div>`}
         <small>talent package</small>
       </div>`
    : "";
  const footName = pkg.show_brand ? esc(brandName) : "본 에이전시";

  const itemBlock = (it: PackageItem): string => {
    const photos = (it.photos || []).slice(0, isComp ? 5 : 3);
    const photosHtml = photos.map(p => `<div class="ph"><img src="${esc(p)}" alt=""/></div>`).join("");
    const size = sizeLine(it);
    const idLine = [it.country, it.age ? `${it.age}세` : ""].filter(Boolean).join(" · ");
    const fol = it.followers ? `♥ ${esc(it.followers)}` : "";
    return `
      <div class="card ${isComp ? "comp" : "cast"}">
        <div class="photos">${photosHtml || '<div class="ph noimg">사진 없음</div>'}</div>
        <div class="meta">
          <div class="nmrow"><span class="nm">${esc(it.name || "이름 미정")}</span>${fol ? `<span class="fol">${fol}</span>` : ""}</div>
          <div class="tags">${it.category ? `<span class="cat">${esc(it.category)}</span>` : ""}${idLine ? `<span class="idl">${esc(idLine)}</span>` : ""}</div>
          ${size ? `<div class="sz">${esc(size)}</div>` : ""}
          ${it.caption ? `<div class="cap">${esc(it.caption)}</div>` : ""}
        </div>
      </div>`;
  };

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=820">
<title>${esc(subj)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;background:#eceff3;padding:18px;color:#1a1d27}
  .bar{max-width:780px;margin:0 auto 14px;display:flex;gap:8px;justify-content:flex-end}
  .bar button{padding:9px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;color:#fff}
  #pdfBtn{background:#3b82f6}#printBtn{background:#6b7280}
  .sheet{max-width:1400px;margin:0 auto;background:#fff;border-radius:12px;padding:clamp(20px,3vw,36px);box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1d27;padding-bottom:14px;margin-bottom:22px}
  .head h1{font-size:24px;font-weight:900;letter-spacing:-.5px}
  .head .client{font-size:13px;color:#6b7280;margin-top:4px}
  .head .brand{text-align:right}
  .head .brand .bname{font-size:15px;font-weight:800;color:#1a1d27}
  .head .brand .logo{max-height:46px;max-width:180px;object-fit:contain;display:inline-block}
  .head .brand small{display:block;color:#9aa2af;font-weight:500;font-size:10px;margin-top:3px}
  .grid{display:grid;gap:16px}
  .grid.cast{display:flex;flex-wrap:wrap;gap:16px;justify-content:flex-start}
  .grid.cast>.card{flex:1 1 230px;max-width:320px;min-width:0}
  .grid.comp{grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))}
  .bar{max-width:1400px}
  .card{border:1px solid #e6e9ef;border-radius:10px;overflow:hidden;background:#fafbfc}
  .card .photos{display:grid;gap:2px}
  .card.cast .photos{grid-template-columns:1fr}
  .card.cast .photos .ph{aspect-ratio:3/4}
  .card.comp .photos{grid-template-columns:repeat(3,1fr)}
  .card.comp .photos .ph{aspect-ratio:3/4}
  .ph{background:#e9edf2;overflow:hidden}
  .ph img{width:100%;height:100%;object-fit:cover;display:block}
  .ph.noimg{display:flex;align-items:center;justify-content:center;color:#aeb4bf;font-size:12px;aspect-ratio:3/4}
  .meta{padding:12px 14px}
  .meta .nmrow{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  .meta .nm{font-size:17px;font-weight:800}
  .meta .fol{font-size:11px;color:#E1306C;font-weight:700;white-space:nowrap}
  .meta .tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:5px}
  .meta .cat{font-size:11px;color:#5a6270;background:#eef1f5;padding:2px 8px;border-radius:10px}
  .meta .idl{font-size:12px;color:#3f4754}
  .meta .sz{font-size:12.5px;color:#3f4754;margin-top:6px;font-variant-numeric:tabular-nums}
  .meta .cap{font-size:12px;color:#6b7280;margin-top:6px;line-height:1.5}
  .foot{text-align:center;font-size:10px;color:#9aa2af;margin-top:20px}
  @media print{body{background:#fff;padding:0}.bar{display:none}.sheet{box-shadow:none;border-radius:0}}
</style></head><body>
  <div class="bar">
    <button id="pdfBtn" onclick="savePdf()">PDF 저장</button>
    <button id="printBtn" onclick="window.print()">인쇄</button>
  </div>
  <div class="sheet">
    <div class="head">
      <div>
        <h1>${esc(pkg.title)}</h1>
        ${pkg.client_name ? `<div class="client">고객사: ${esc(pkg.client_name)}</div>` : ""}
      </div>
      ${brandHtml}
    </div>
    <div class="grid ${isComp ? "comp" : "cast"}">
      ${(pkg.items || []).map(itemBlock).join("")}
    </div>
    ${pkg.memo ? `<p style="font-size:13px;color:#6b7280;margin-top:18px;line-height:1.6">${esc(pkg.memo)}</p>` : ""}
    <div class="foot">본 자료는 ${footName}가 제안용으로 제작했습니다. 무단 배포를 금합니다.</div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script>
    var SUBJ=${JSON.stringify(subj)};
    function fname(){ return (SUBJ||'package').replace(/[\\\\/:*?"<>|]/g,'_'); }
    async function savePdf(){
      var btn=document.getElementById('pdfBtn'), t0=btn.textContent; btn.textContent='생성 중…'; btn.disabled=true;
      try{
        var el=document.querySelector('.sheet');
        var canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});
        var img=canvas.toDataURL('image/jpeg',0.95);
        var jsPDF=window.jspdf.jsPDF, pdf=new jsPDF('p','mm','a4');
        var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight();
        var ih=canvas.height*pw/canvas.width;
        if(ih<=ph){ pdf.addImage(img,'JPEG',0,0,pw,ih); }
        else { var pos=0, rem=ih; while(rem>0){ pdf.addImage(img,'JPEG',0,pos,pw,ih); rem-=ph; if(rem>0){ pdf.addPage(); pos-=ph; } } }
        pdf.save(fname()+'.pdf');
      }catch(e){ alert('PDF 생성 실패: '+e); }
      btn.textContent=t0; btn.disabled=false;
    }
  </script>
</body></html>`;
}

// ── 팝업으로 열기 (PDF/인쇄) ──
export function openPackageWindow(pkg: Pkg, agencyName = "modiq") {
  const w = window.open("", "_blank", "width=860,height=1080");
  if (!w) { alert("팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도하세요."); return; }
  w.document.write(buildPackageHtml(pkg, agencyName));
  w.document.close();
}

// ── 모델 1명 → 컴카드(단일 모델) 패키지 객체 ──
export function modelToCompCard(m: any, agency: { id: string; name: string }): Pkg {
  const age = ageFromSSN6(m.ssn6);
  const photos: string[] = Array.isArray(m.photos) && m.photos.length ? m.photos.slice(0, 15) : (m.thumb_url ? [m.thumb_url] : []);
  const item: PackageItem = {
    model_id: m.id, name: m.name || "", category: m.category || "",
    country: m.country || "", age: age !== null ? String(age) : "",
    height: m.height || "", bust: m.bust || "", waist: m.waist || "", hip: m.hip || "", shoe: m.shoe || "",
    followers: m.instagram_followers || "",
    caption: [Array.isArray(m.fields) ? m.fields.join("/") : "", m.specialty].filter(Boolean).join(" · "),
    photos,
  };
  return {
    id: genPkgId(), agency_id: agency.id, title: `${m.name || "모델"} 컴카드`,
    client_name: "", layout: "compcard", items: [item], memo: "",
    show_brand: true, brand_name: agency.name || "", brand_logo: "",
    share_token: genShareToken(), is_public: false,
  };
}

// ── 외부 스크립트 1회 로드 ──
function ensureScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error("script load fail: " + src));
    document.head.appendChild(s);
  });
}

// ── DOM 노드를 PNG로 캡처해 공유 (모바일=Web Share, 데스크탑=새 탭) ──
export async function shareNodePng(el: HTMLElement, filename: string, title = "") {
  await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  const w = window as any;
  const canvas = await w.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const safe = filename.replace(/[\\/:*?"<>|]/g, "_");
  await new Promise<void>(resolve => {
    canvas.toBlob(async (blob: Blob | null) => {
      if (!blob) { resolve(); return; }
      const file = new File([blob], safe + ".png", { type: "image/png" });
      const nav = navigator as any;
      try {
        if (nav.share && nav.canShare?.({ files: [file] })) await nav.share({ files: [file], title: title || safe });
        else window.open(URL.createObjectURL(blob), "_blank");
      } catch { /* 사용자가 공유 취소 등 — 무시 */ }
      resolve();
    }, "image/png");
  });
}

// ── 단일 모델 컴카드(A4 가로) HTML — 좌 메인 1컷 + 우 2×2 + 하단 정보바 ──
//  공개 패키지/PDF에서 PackageItem(스냅샷)으로부터 컴카드를 즉석 생성
function compCardInnerHtml(it: PackageItem, brandName = ""): string {
  const ph = it.photos || [];
  // html2canvas는 <img object-fit:cover>를 무시해 이미지를 눌러버림 → background-size:cover로 그려야 비율 유지됨
  const cell = (i: number) =>
    ph[i]
      ? `<div style="border-radius:3px;background:#e9edf2 url('${ph[i]}') center/cover no-repeat"></div>`
      : `<div style="background:#f2f4f7;border:1.5px dashed #cfd5dd;border-radius:3px"></div>`;
  const info: [string, string][] = [
    ["이름", it.name || "-"], ["나이", it.age ? `${it.age}세` : "-"], ["성별", it.category || "-"],
    ["키 cm", it.height || "-"], ["가슴", it.bust || "-"], ["허리", it.waist || "-"],
    ["엉덩이", it.hip || "-"], ["신발 mm", it.shoe || "-"], ["국적", it.country || "-"],
  ];
  const cells = info.map(([k, v], idx) =>
    `<div style="flex:1;text-align:center;padding:6px 2px;${idx === 0 ? "" : "border-left:1px solid #f0f2f5;"}">
       <div style="font-size:11px;color:#9aa2af;font-weight:600;white-space:nowrap">${esc(k)}</div>
       <div style="font-size:15px;font-weight:800;color:#1a1d27;margin-top:2px">${esc(v)}</div>
     </div>`).join("");
  return `
    <div style="width:100%;height:100%;background:#fff;display:flex;flex-direction:column;padding:14px;box-sizing:border-box;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;color:#1a1d27">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e6e9ef">
        <div style="font-size:13px;font-weight:700;letter-spacing:.5px">${esc(brandName)}</div>
        <div style="font-size:10px;color:#9aa2af">talent comp card</div>
      </div>
      <div style="display:flex;gap:6px;flex:1;min-height:0;padding:10px 0">
        <div style="flex:1.12;border-radius:3px;background:#e9edf2${ph[0] ? ` url('${ph[0]}') center/cover no-repeat` : ""}"></div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px">${cell(1)}${cell(2)}${cell(3)}${cell(4)}</div>
      </div>
      <div style="display:flex;border-top:1px solid #e6e9ef;padding-top:4px">${cells}</div>
    </div>`;
}

// ── 단일 모델 컴카드를 A4 가로 PDF로 즉시 다운로드 (오프스크린 렌더) ──
export async function downloadCompCardPdf(it: PackageItem, brandName = "") {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;left:-99999px;top:0;width:1122px;height:793px;z-index:-1;background:#fff";
  wrap.innerHTML = compCardInnerHtml(it, brandName);
  document.body.appendChild(wrap);
  try { await downloadNodePdf(wrap, `${it.name || "모델"}_컴카드.pdf`, "l"); }
  finally { document.body.removeChild(wrap); }
}

// ── DOM 노드를 PDF로 직접 다운로드 (인앱, 팝업 없이) ──
// orient: "p"(세로) | "l"(가로). 가로는 컴카드(A4 landscape)용.
export async function downloadNodePdf(el: HTMLElement, filename: string, orient: "p" | "l" = "p") {
  await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const w = window as any;
  const canvas = await w.html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const img = canvas.toDataURL("image/jpeg", 0.95);
  const jsPDF = w.jspdf.jsPDF;
  const pdf = new jsPDF(orient, "mm", "a4");
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
  const ih = canvas.height * pw / canvas.width;
  if (ih <= ph) {
    // 세로 여백 가운데 정렬 (가로 컴카드가 페이지 안에 깔끔히 들어가도록)
    pdf.addImage(img, "JPEG", 0, Math.max(0, (ph - ih) / 2), pw, ih);
  } else {
    let pos = 0, rem = ih; while (rem > 0) { pdf.addImage(img, "JPEG", 0, pos, pw, ih); rem -= ph; if (rem > 0) { pdf.addPage(); pos -= ph; } }
  }
  pdf.save(filename.replace(/[\\/:*?"<>|]/g, "_"));
}
