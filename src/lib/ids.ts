// ════════════════════════════════════════════════════════════════
// Modiq ID 체계 (modiq-id-spec v1.0)
//  · 에이전시:  AG[순번3]                      예: AG042
//  · 모델:      [성별+국적2][에이전시3]-[YYMMDD]-[순번4]  예: FK042-240614-0001
//  · 섭외건:    C[에이전시3]-[YYMMDD]-[순번4]   예: C042-240614-0015
//  성별+국적: MK(한국남) FK(한국여) MX(외국남) FX(외국여)
// ════════════════════════════════════════════════════════════════
const pad = (n: number, len: number) => String(Math.max(0, n)).padStart(len, "0");

export const yymmdd = (d = new Date()) =>
  `${String(d.getFullYear()).slice(-2)}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;

export const agencyCode = (no: number) => `AG${pad(no, 3)}`;

// gender: "M"|"F", natType: "K"(내국인)|"X"(외국인)
export const genderNatCode = (gender: string, natType: string): string =>
  `${gender === "M" ? "M" : "F"}${natType === "X" ? "X" : "K"}`;

export const generateModelId = (genderNat: string, agencyNo: number, seq: number, date = new Date()) =>
  `${genderNat}${pad(agencyNo, 3)}-${yymmdd(date)}-${pad(seq, 4)}`;

export const generateCastId = (agencyNo: number, seq: number, date = new Date()) =>
  `C${pad(agencyNo, 3)}-${yymmdd(date)}-${pad(seq, 4)}`;

// 해당 에이전시의 다음 모델 순번 (새 형식 ID들 중 최대 + 1). models는 그 에이전시 소속만 전달됨.
export const nextModelSeq = (models: any[]): number => {
  let mx = 0;
  for (const m of models || []) {
    const t = String(m?.id || "").match(/^(?:MK|FK|MX|FX)\d{3}-\d{6}-(\d{4})$/);
    if (t) mx = Math.max(mx, parseInt(t[1], 10));
  }
  return mx + 1;
};

// 해당 에이전시·해당 날짜의 다음 섭외 순번
export const nextCastSeq = (bookings: any[], agencyNo: number, date = new Date()): number => {
  const pre = `C${pad(agencyNo, 3)}-${yymmdd(date)}-`;
  let mx = 0;
  for (const b of bookings || []) {
    const id = String(b?.id || "");
    if (id.startsWith(pre)) { const s = parseInt(id.slice(pre.length), 10); if (!isNaN(s)) mx = Math.max(mx, s); }
  }
  return mx + 1;
};

// 국적 코드 (대한민국=K 내국인 / 그 외=X 외국인)
export const natTypeOf = (country?: string) => (country && country !== "대한민국" ? "X" : "K");

// 충돌 없는 임의 ID (고객사 등 명세 외 엔티티 + 폴백용)
export const randomId = (prefix = ""): string => {
  let r: string;
  try { r = (crypto as any).randomUUID().replace(/-/g, "").slice(0, 12); }
  catch { r = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  return prefix ? `${prefix}_${r}` : r;
};
