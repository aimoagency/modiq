// ── 사업자등록증 OCR (Edge Function: extract-business-info 경유) ──
// 발송 경로: 프론트 → Supabase Edge Function → Anthropic. 프론트에 API 키 없음.
// 기본값은 코드에 내장(email.ts와 동일 방식). 필요 시 .env로 덮어쓰기 가능.

const FN_URL: string =
  (import.meta as any).env?.VITE_OCR_FN_URL ||
  "https://fijtpyrmqzjefucsqfos.supabase.co/functions/v1/extract-business-info";
const FN_SECRET: string =
  (import.meta as any).env?.VITE_OCR_FN_SECRET || "modiq-mail-2026-x9k2";

// 사업자등록증에서 추출되는 원본 필드
export interface BizLicenseInfo {
  businessNumber: string;     // 사업자등록번호 (000-00-00000)
  companyName: string;        // 상호 / 법인명
  representativeName: string; // 대표자명
  openingDate: string;        // 개업연월일 (YYYY-MM-DD)
  address: string;            // 사업장 소재지
  businessType: string;       // 업태
  businessItem: string;       // 종목
  corporateNumber: string;    // 법인등록번호
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export type OcrResult =
  | { ok: true; data: BizLicenseInfo }
  | { ok: false; error: string };

// 파일(이미지/PDF)을 보내 사업자등록증 정보를 추출
export const extractBusinessInfo = async (file: File): Promise<OcrResult> => {
  if (!file) return { ok: false, error: "파일이 없습니다." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "파일 크기는 5MB 이하여야 합니다." };

  try {
    const imageBase64 = await fileToBase64(file);
    const mediaType = file.type || "image/jpeg";
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(FN_SECRET ? { "x-fn-secret": FN_SECRET } : {}) },
      body: JSON.stringify({ imageBase64, mediaType }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      return { ok: false, error: body?.error || `인식 실패 (HTTP ${res.status})` };
    }
    const d = body.data || {};
    const data: BizLicenseInfo = {
      businessNumber: String(d.businessNumber || ""),
      companyName: String(d.companyName || ""),
      representativeName: String(d.representativeName || ""),
      openingDate: String(d.openingDate || ""),
      address: String(d.address || ""),
      businessType: String(d.businessType || ""),
      businessItem: String(d.businessItem || ""),
      corporateNumber: String(d.corporateNumber || ""),
    };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};
