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
  height?: string;
  bust?: string;
  waist?: string;
  hip?: string;
  shoe?: string;
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
  share_token: string;
  is_public: boolean;
  created_at?: string;
};

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
export function buildPackageHtml(pkg: Pkg, agencyName = "Modiq"): string {
  const isComp = pkg.layout === "compcard";
  const subj = `${pkg.title}${pkg.client_name ? ` · ${pkg.client_name}` : ""}`;

  const itemBlock = (it: PackageItem): string => {
    const photos = (it.photos || []).slice(0, isComp ? 6 : 3);
    const photosHtml = photos.map(p => `<div class="ph"><img src="${esc(p)}" alt=""/></div>`).join("");
    const size = sizeLine(it);
    return `
      <div class="card ${isComp ? "comp" : "cast"}">
        <div class="photos">${photosHtml || '<div class="ph noimg">사진 없음</div>'}</div>
        <div class="meta">
          <div class="nm">${esc(it.name || "이름 미정")}</div>
          ${it.category ? `<div class="cat">${esc(it.category)}</div>` : ""}
          ${size ? `<div class="sz">${esc(size)}</div>` : ""}
          ${it.caption ? `<div class="cap">${esc(it.caption)}</div>` : ""}
          ${it.instagram_url ? `<div class="ig">${esc(it.instagram_url)}</div>` : ""}
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
  .sheet{max-width:780px;margin:0 auto;background:#fff;border-radius:12px;padding:34px 32px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1d27;padding-bottom:14px;margin-bottom:22px}
  .head h1{font-size:24px;font-weight:900;letter-spacing:-.5px}
  .head .client{font-size:13px;color:#6b7280;margin-top:4px}
  .head .brand{font-size:12px;font-weight:800;color:#3b82f6;text-align:right}
  .head .brand small{display:block;color:#9aa2af;font-weight:500;font-size:10px;margin-top:2px}
  .grid{display:grid;gap:16px}
  .grid.cast{grid-template-columns:repeat(2,1fr)}
  .grid.comp{grid-template-columns:1fr}
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
  .meta .nm{font-size:17px;font-weight:800}
  .meta .cat{display:inline-block;margin-top:4px;font-size:11px;color:#5a6270;background:#eef1f5;padding:2px 8px;border-radius:10px}
  .meta .sz{font-size:12.5px;color:#3f4754;margin-top:7px;font-variant-numeric:tabular-nums}
  .meta .cap{font-size:12px;color:#6b7280;margin-top:6px;line-height:1.5}
  .meta .ig{font-size:11px;color:#E1306C;margin-top:6px;word-break:break-all}
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
      <div class="brand">${esc(agencyName)}<small>powered by modiq</small></div>
    </div>
    <div class="grid ${isComp ? "comp" : "cast"}">
      ${(pkg.items || []).map(itemBlock).join("")}
    </div>
    ${pkg.memo ? `<p style="font-size:12px;color:#6b7280;margin-top:18px;line-height:1.6">${esc(pkg.memo)}</p>` : ""}
    <div class="foot">본 자료는 ${esc(agencyName)}가 제안용으로 제작했습니다. 무단 배포를 금합니다.</div>
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
export function openPackageWindow(pkg: Pkg, agencyName = "Modiq") {
  const w = window.open("", "_blank", "width=860,height=1080");
  if (!w) { alert("팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도하세요."); return; }
  w.document.write(buildPackageHtml(pkg, agencyName));
  w.document.close();
}
