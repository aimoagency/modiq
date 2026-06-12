// ── 유틸 ──────────────────────────────────────────────────────
export const fmt     = (n: number) => Number(n || 0).toLocaleString("ko-KR") + "원";
export const fmtNum  = (n: any) => Number(String(n).replace(/,/g,"") || 0).toLocaleString("ko-KR");
export const parseNum= (s: string) => Number(String(s).replace(/,/g,"")) || 0;
export const pad     = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: string) => d ? d.replace(/-/g, ".") : "-";

// HH:MM 24h → 오전/오후 표시
export const fmt12 = (hhmm: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${ampm} ${h12}:${pad(m)}`;
};
export const fmtTime = (s: string, e: string) => s && e ? `${fmt12(s)} ~ ${fmt12(e)}` : s ? fmt12(s) : "-";

// 오전/오후 + h12 + min → HH:MM 24h
export const toHHMM = (ampm: string, h: number, m: number): string => {
  let h24 = h % 12;
  if (ampm === "오후") h24 += 12;
  return `${pad(h24)}:${pad(m)}`;
};

// HH:MM → {ampm, h12, m}
export const parseHHMM = (hhmm: string) => {
  if (!hhmm) return { ampm: "오전", h12: 9, m: 0 };
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return { ampm, h12, m };
};

export const toMin = (t: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// 장소 정규화: 공백·대소문자 무시하고 비교용 키 생성
const normLoc = (s?: string) => (s || "").trim().toLowerCase().replace(/\s+/g, "");

// 일정 충돌 검사 (강화: 장소 이동시간 가산 + severity 구분)
export const scheduleConflict = (aS: string, aE: string, bS: string, bE: string, typeA = "", typeB = "", locA?: string, locB?: string) => {
  if (!aS || !aE || !bS || !bE) return { conflict: false, reason: "", severity: "" };
  const as = toMin(aS), ae = toMin(aE), bs = toMin(bS), be = toMin(bE);
  if (as === null || ae === null || bs === null || be === null) return { conflict: false, reason: "", severity: "" };
  if (as < be && bs < ae) return { conflict: true, reason: "시간대 겹침", severity: "OVERLAP" };
  const gap = as >= be ? as - be : bs - ae;
  let need = (typeA === "MEETING" || typeB === "MEETING") ? 60 : 120;
  const la = normLoc(locA), lb = normLoc(locB);
  const differentPlace = !!la && !!lb && la !== lb;
  if (differentPlace) need += 60;
  if (gap < need) {
    const gapStr = `${Math.floor(gap / 60)}h ${gap % 60}m`;
    const needStr = `${need / 60}h`;
    const moveNote = differentPlace ? " 장소이동" : "";
    return { conflict: true, reason: `간격 ${gapStr} (${needStr} 미만${moveNote})`, severity: "BUFFER" };
  }
  return { conflict: false, reason: "", severity: "" };
};

// 같은 날 한 모델의 섭외 목록에서 충돌 쌍을 찾는 헬퍼 (캘린더 시각화용)
export const findConflicts = (dayBookings: any[]) => {
  const conflictIds = new Set<string>();
  let worst = "";
  const byModel: Record<string, any[]> = {};
  dayBookings.forEach(b => {
    if (b.status === "CANCELLED") return;
    (byModel[b.model_id] = byModel[b.model_id] || []).push(b);
  });
  Object.values(byModel).forEach(list => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const c = scheduleConflict(a.start_time, a.end_time, b.start_time, b.end_time, a.booking_type, b.booking_type, a.location, b.location);
        if (c.conflict) {
          conflictIds.add(a.id); conflictIds.add(b.id);
          if (c.severity === "OVERLAP") worst = "OVERLAP";
          else if (c.severity === "BUFFER" && worst !== "OVERLAP") worst = "BUFFER";
        }
      }
    }
  });
  return { conflictIds, worst };
};

export const visaViolation = (model: any, date: string) => {
  if (!model?.is_foreigner || !date) return null;
  const { visa_entry: en, visa_exit: ex, name } = model;
  if (!en || !ex) return `${name}: 비자 입출국일 미등록`;
  if (date < en) return `촬영일(${date})이 입국일(${en}) 이전`;
  if (date > ex) return `촬영일(${date})이 출국일(${ex}) 이후`;
  return null;
};

export const makeModelId  = (name: string, ssn6: string) => `M_${name}_${ssn6}`;
export const makeClientId = (name: string, phone4: string) => `C_${name}_${phone4}`;

// 사업자등록번호 체크섬 검증 (국세청 알고리즘) — 형식·오타 검증, 실제 등록 여부는 별도 API
export const validateBizNo = (raw: string): boolean => {
  const n = String(raw).replace(/[^0-9]/g, "");
  if (n.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(n[i]) * w[i];
  sum += Math.floor((Number(n[8]) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(n[9]);
};

// 인스타그램 URL/아이디 정규화
export const normalizeInstagram = (val: string): string => {
  if (!val.trim()) return "";
  const v = val.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const handle = v.startsWith("@") ? v.slice(1) : v;
  return `https://www.instagram.com/${handle}`;
};

// 비자 D-day 계산
export const visaDday = (exitDate: string): string => {
  if (!exitDate) return "";
  const diff = Math.ceil((new Date(exitDate).getTime() - new Date().getTime()) / (1000*60*60*24));
  if (diff < 0) return "만료";
  return `D-${diff}`;
};

export const getTrialDaysLeft = (trialEndsAt: string | null) => {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000*60*60*24));
};

// 주민번호 앞 6자리(YYMMDD) → 만 나이 (외국인/형식오류는 null)
export const ageFromSSN6 = (ssn6: string): number | null => {
  if (!ssn6 || !/^\d{6}$/.test(ssn6)) return null;
  const yy = Number(ssn6.slice(0,2)), mm = Number(ssn6.slice(2,4)), dd = Number(ssn6.slice(4,6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const now = new Date();
  const curYY = now.getFullYear() % 100;
  const year = yy > curYY ? 1900 + yy : 2000 + yy;
  let age = now.getFullYear() - year;
  const passed = (now.getMonth()+1 > mm) || ((now.getMonth()+1 === mm) && now.getDate() >= dd);
  if (!passed) age--;
  return age >= 0 && age < 120 ? age : null;
};

// 매출 인정 상태: 촬영확정/촬영완료/정산완료만 (문의·제안·대기·HOLD·취소 제외)
export const REVENUE_STATUSES = ["CONFIRMED", "COMPLETED", "SETTLED"];

// 모델/고객사 매출 집계
//  - 예상매출 = 촬영확정+촬영완료+정산완료 합계
//  - 실매출   = 정산완료(입금)만
//  - period: {from,to} (YYYY-MM-DD, 촬영일 기준) — 없으면 전체
// 당일 오버차지(추가금) 합계
export const overchargeTotal = (b: any): number =>
  Array.isArray(b?.overcharges) ? b.overcharges.reduce((s: number, o: any) => s + (o?.amount || 0), 0) : 0;

// 촬영비 총액 = 기본 촬영비 + 당일 오버차지(추가금) 합계
export const bookingTotal = (b: any): number => (b?.shoot_fee || 0) + overchargeTotal(b);

// 고객사 잔금 = (계약 총액 + 추가금) − 계약금
export const clientBalance = (b: any): number => Math.max(0, bookingTotal(b) - (b?.deposit_amt || 0));

// (구 commission 제거) 정산 로직 기반 재정의 — 아래 modelPayout/agencyMargin 사용(런타임 호출)
// 에이전시 마진 = 공급가 − 모델 정산 기준액
export const bookingAgencyFee = (b: any, models: any[]): number =>
  agencyMargin(b, models.find((m) => m.id === b?.model_id));
// 모델 실지급액 (세무유형별 가감 반영)
export const bookingModelPay = (b: any, models: any[]): number =>
  modelPayout(b, models.find((m) => m.id === b?.model_id));

// ── 정산/세무 계산 (모두 공급가=VAT제외 기준, 입금/청구만 VAT포함) ──────────────
export const VAT_RATE = 0.10;
const floor10 = (n: number) => Math.floor(n / 10) * 10; // 원천세 원단위 절사

// 공급가 합계(촬영비+추가비용) = 기존 bookingTotal 재사용
export const supplyTotal = (b: any): number => bookingTotal(b);
// 고객 청구액/입금액 (VAT 10% 포함)
export const clientCharge = (b: any): number => Math.round(supplyTotal(b) * (1 + VAT_RATE));
export const vatAmount = (b: any): number => clientCharge(b) - supplyTotal(b);

// 라인 단위 모델 몫: type 'fixed'=정액(원), 'rate'=비율(%)
const lineShare = (base: number, type: string, value: number): number =>
  type === "fixed" ? Math.round(value || 0) : Math.round((base || 0) * (value || 0) / 100);

// 섭외/모델 폴백: 섭외에 지정 없으면 모델 기본값, 그것도 없으면 비율 15%
const payCfg = (b: any, model: any): { type: string; value: number } => ({
  type:  b?.model_pay_type  ?? model?.payout_pay_type  ?? "rate",
  value: b?.model_pay_value ?? model?.payout_pay_value ?? 15,
});

// 모델 기본료 정산 몫(공급가 기준, 세전)
export const modelBaseShare = (b: any, model: any): number => {
  const { type, value } = payCfg(b, model);
  return lineShare(b?.shoot_fee || 0, type, value);
};
// 추가비용 모델 몫 합(공급가 기준, 세전) — 항목별 model_pay_type/value, 없으면 모델 기본값
export const modelOverShare = (b: any, model: any): number => {
  if (!Array.isArray(b?.overcharges)) return 0;
  const { type: dT, value: dV } = payCfg(b, model);
  return b.overcharges.reduce((s: number, o: any) =>
    s + lineShare(o?.amount || 0, o?.model_pay_type ?? dT, o?.model_pay_value ?? dV), 0);
};
// 모델 정산 기준액(세전, 공급가 기준)
export const modelGross = (b: any, model: any): number => modelBaseShare(b, model) + modelOverShare(b, model);

// 모델 세무 유형: 'foreigner'=외국인(전액 지급) / 'freelancer'=프리랜서(3.3% 원천징수) / 'company'=소속사(세금계산서 10% 가산)
export const modelTaxType = (model: any): "foreigner" | "freelancer" | "company" => {
  const t = model?.payout_tax_type;
  return t === "foreigner" || t === "company" ? t : "freelancer";
};
export const isForeignerModel = (model: any): boolean => modelTaxType(model) === "foreigner";
export const isCompanyModel   = (model: any): boolean => modelTaxType(model) === "company";

// 프리랜서만 원천징수: 소득세 3%(원단위 절사) + 지방소득세 0.3%(소득세의 10%, 원단위 절사)
export const modelIncomeTax = (b: any, model: any): number => modelTaxType(model) !== "freelancer" ? 0 : floor10(modelGross(b, model) * 0.03);
export const modelLocalTax  = (b: any, model: any): number => modelTaxType(model) !== "freelancer" ? 0 : floor10(modelIncomeTax(b, model) * 0.1);
export const modelWithholding = (b: any, model: any): number => modelIncomeTax(b, model) + modelLocalTax(b, model);

// 모델 실지급액: 외국인=기준액 전액 / 프리랜서=기준액−3.3% / 소속사=기준액+10% VAT(세금계산서)
export const modelPayout = (b: any, model: any): number => {
  const g = modelGross(b, model);
  const t = modelTaxType(model);
  if (t === "company")   return Math.round(g * (1 + VAT_RATE));
  if (t === "foreigner") return g;
  return g - modelWithholding(b, model); // freelancer
};
// 에이전시 마진(공급가 기준): 모델 유형과 무관하게 동일
export const agencyMargin = (b: any, model: any): number => supplyTotal(b) - modelGross(b, model);

// 고객 잔금(VAT 포함 입금 기준) = 청구액 − 계약금
export const clientBalanceVat = (b: any): number => Math.max(0, clientCharge(b) - (b?.deposit_amt || 0));

export const entityRevenue = (bookings: any[], key: string, id: string, period?: { from?: string; to?: string }) => {
  const bs = bookings.filter(b => {
    if (b[key] !== id) return false;
    if (!REVENUE_STATUSES.includes(b.status)) return false;
    const d = b.shoot_date || "";
    if (period?.from && d < period.from) return false;
    if (period?.to && d > period.to) return false;
    return true;
  });
  const real = bs.filter(b => b.status === "SETTLED" || b.is_paid).reduce((s, b) => s + bookingTotal(b), 0);
  const expected = bs.reduce((s, b) => s + bookingTotal(b), 0);
  return { real, expected, count: bs.length };
};

// 기간 프리셋 → {from,to}
export const periodRange = (preset: string): { from?: string; to?: string } => {
  const now = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if (preset === "month") { return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01` }; }
  if (preset === "lastmonth") { const f = new Date(now.getFullYear(), now.getMonth()-1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 0); return { from: iso(f), to: iso(t) }; }
  if (preset === "3m") { const d = new Date(now); d.setMonth(d.getMonth()-3); return { from: iso(d) }; }
  if (preset === "6m") { const d = new Date(now); d.setMonth(d.getMonth()-6); return { from: iso(d) }; }
  if (preset === "1y") { const d = new Date(now); d.setMonth(d.getMonth()-12); return { from: iso(d) }; }
  return {}; // all
};
