// ═══════════════════════════════════════════════════════════════
// 발송(Distribution) 데이터 레이어
//  - 에이전시 간 모델 자료 단방향 발송(화이트리스트 스냅샷).
//  - 모든 권한은 DB의 RLS가 강제한다(여기선 편의 쿼리만 제공).
//  - 크로스 테넌트 에이전시 조회는 RPC(partner_lookup_by_bizno /
//    related_agency_names) 경유 — supabase/talent_distribution_lookup_rpcs.sql.
// ═══════════════════════════════════════════════════════════════
import { sb } from "./supabase";

export type PartnerStatus = "pending" | "accepted" | "rejected" | "blocked";

export interface AgencyPartner {
  id: string;
  requester_agency_id: string;
  addressee_agency_id: string;
  status: PartnerStatus;
  requested_by?: string | null;
  responded_at?: string | null;
  created_at: string;
}

export interface DistributionModel {
  id: string;
  distribution_id: string;
  source_model_id: string | null;
  display_name: string;
  gender?: string | null;
  birth_year?: number | null;
  height?: string | null; bust?: string | null; waist?: string | null; hip?: string | null; shoe?: string | null;
  hair_length?: string | null; hair_color?: string | null; eye_color?: string | null;
  tattoo?: boolean | null; underwear_ok?: boolean | null;
  specialty?: string | null; fields?: any;
  fee_day?: number | null; fee_half?: number | null; fee_hour?: number | null;
  photos?: any; compcard?: any;
  snapshot_at?: string;
}

export interface DistributionRecipient {
  id: string;
  distribution_id: string;
  recipient_agency_id: string;
  viewed_at?: string | null;
  created_at: string;
}

// A(발송측) 법인 정산정보 스냅샷 — 발송 시점 고정. B가 A에게 지급/세금계산서 처리에 사용.
export interface SenderPayoutInfo {
  company_name?: string | null; // 상호
  biz_no?: string | null;       // 사업자등록번호
  rep_name?: string | null;     // 대표자
  contact?: string | null;      // 연락처
  address?: string | null;      // 주소
  bank?: string | null;         // 정산 입금계좌
}

export interface TalentDistribution {
  id: string;
  sender_agency_id: string;
  created_by?: string | null;
  message?: string | null;
  status: "active" | "revoked" | "expired";
  expires_at?: string | null;
  created_at: string;
  revoked_at?: string | null;
  sender_payout_info?: SenderPayoutInfo | null;
  distribution_models?: DistributionModel[];
  distribution_recipients?: DistributionRecipient[];
}

const nowISO = () => new Date().toISOString();
const norm10 = (s: string) => (s || "").replace(/[^0-9]/g, "");

// ── 크로스 테넌트 에이전시 조회 (RPC) ─────────────────────────────
export const lookupAgencyByBizNo = async (bizNo: string): Promise<{ id: string; name: string; biz_no: string }[]> => {
  if (norm10(bizNo).length !== 10) return [];
  return await sb("rpc/partner_lookup_by_bizno", "POST", { p_biz_no: bizNo });
};

// 관계 있는 에이전시 id → 이름 map (없으면 빈 객체)
export const resolveAgencyNames = async (ids: (string | null | undefined)[]): Promise<Record<string, string>> => {
  const uniq = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (!uniq.length) return {};
  try {
    const rows: { id: string; name: string }[] = await sb("rpc/related_agency_names", "POST", { p_ids: uniq });
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.id] = r.name; });
    return map;
  } catch { return {}; }
};

// ── 파트너십 ──────────────────────────────────────────────────
export const loadPartners = async (): Promise<AgencyPartner[]> =>
  await sb("agency_partners", "GET", null, "?order=created_at.desc");

export const requestPartner = async (myAgencyId: string, addresseeAgencyId: string, requestedBy?: string): Promise<AgencyPartner> => {
  const rows = await sb("agency_partners", "POST", {
    requester_agency_id: myAgencyId,
    addressee_agency_id: addresseeAgencyId,
    requested_by: requestedBy || null,
    status: "pending",
  });
  return Array.isArray(rows) ? rows[0] : rows;
};

export const respondPartner = async (id: string, status: PartnerStatus): Promise<void> => {
  await sb("agency_partners", "PATCH", { status, responded_at: nowISO() }, `?id=eq.${id}`);
};

// ── 모델 → 스냅샷(화이트리스트) ───────────────────────────────────
// ⚠️ 여기 정의된 컬럼만 발송된다. ssn6/payout_*/tax_*/visa_type/연락처 등은 절대 포함 금지.
export const buildModelSnapshot = (m: any) => ({
  source_model_id: m.id ?? null,
  display_name: m.name || "(이름없음)",
  gender: m.gender ?? null,
  birth_year: m.birth_year ?? null,
  height: m.height ?? null,
  bust: m.bust ?? null,
  waist: m.waist ?? null,
  hip: m.hip ?? null,
  shoe: m.shoe ?? null,
  hair_length: m.hair_length ?? null,
  hair_color: m.hair_color ?? null,
  eye_color: m.eye_color ?? null,
  tattoo: m.tattoo ?? null,
  underwear_ok: m.underwear_ok ?? null,
  specialty: m.specialty ?? null,
  fields: m.fields ?? null,
  fee_day: m.fee_day ?? null,
  fee_half: m.fee_half ?? null,
  fee_hour: m.fee_hour ?? null,
  photos: m.photos ?? null,
  compcard: null, // 수신측이 자기 로고로 재구성 — 발송측 컴카드는 보내지 않음
});

// ── 발송 ─────────────────────────────────────────────────────
// talent_distributions(1) + distribution_models(N) + distribution_recipients(M)
export const sendDistribution = async (opts: {
  senderAgencyId: string;
  createdBy?: string;
  message?: string;
  expiresAt?: string | null;
  models: any[];            // 원본 모델 행(스냅샷으로 변환됨)
  recipientAgencyIds: string[];
  senderPayoutInfo?: SenderPayoutInfo | null; // A 법인 정산정보 스냅샷
}): Promise<string> => {
  const distRows = await sb("talent_distributions", "POST", {
    sender_agency_id: opts.senderAgencyId,
    created_by: opts.createdBy || null,
    message: opts.message || null,
    status: "active",
    expires_at: opts.expiresAt || null,
    sender_payout_info: opts.senderPayoutInfo || null,
  });
  const dist: TalentDistribution = Array.isArray(distRows) ? distRows[0] : distRows;
  const distId = dist.id;

  const modelRows = opts.models.map(m => ({ ...buildModelSnapshot(m), distribution_id: distId }));
  if (modelRows.length) await sb("distribution_models", "POST", modelRows);

  const recRows = opts.recipientAgencyIds.map(rid => ({ distribution_id: distId, recipient_agency_id: rid }));
  if (recRows.length) await sb("distribution_recipients", "POST", recRows);

  return distId;
};

// 보낸 발송 목록 (스냅샷 모델 + 수신자 임베드)
export const loadSentDistributions = async (senderAgencyId: string): Promise<TalentDistribution[]> =>
  await sb("talent_distributions", "GET", null,
    `?sender_agency_id=eq.${senderAgencyId}&order=created_at.desc&select=*,distribution_models(id,display_name,source_model_id,birth_year,gender),distribution_recipients(*)`);

export const revokeDistribution = async (id: string): Promise<void> => {
  await sb("talent_distributions", "PATCH", { status: "revoked", revoked_at: nowISO() }, `?id=eq.${id}`);
};

// ── 수신함 ────────────────────────────────────────────────────
// 내가 수신자인 distribution_recipients → 발송 본문 + 스냅샷 모델 임베드.
// (RLS상 distribution_models는 active+미만료 발송만 노출되므로 자연히 필터됨)
export interface ReceivedItem {
  recipientRowId: string;
  viewed_at?: string | null;
  distribution: TalentDistribution;
}
export const loadReceivedDistributions = async (myAgencyId: string): Promise<ReceivedItem[]> => {
  const rows: any[] = await sb("distribution_recipients", "GET", null,
    `?recipient_agency_id=eq.${myAgencyId}&order=created_at.desc&select=id,viewed_at,distribution:talent_distributions(*,distribution_models(*))`);
  return rows
    .map(r => ({ recipientRowId: r.id, viewed_at: r.viewed_at, distribution: r.distribution as TalentDistribution }))
    .filter(r => r.distribution && r.distribution.status === "active"
      && (!r.distribution.expires_at || new Date(r.distribution.expires_at) > new Date()));
};

export const markReceivedViewed = async (recipientRowId: string): Promise<void> => {
  await sb("distribution_recipients", "PATCH", { viewed_at: nowISO() }, `?id=eq.${recipientRowId}`);
};

// ── 입출국 라이브 뷰 (수신 외국인 모델) ───────────────────────────
export interface TravelRow { model_id: string; entry_date: string | null; exit_date: string | null; }
export const loadSharedTravel = async (sourceModelIds: (string | null | undefined)[]): Promise<Record<string, TravelRow>> => {
  const ids = Array.from(new Set(sourceModelIds.filter(Boolean) as string[]));
  if (!ids.length) return {};
  try {
    const rows: TravelRow[] = await sb("shared_model_travel", "GET", null, `?model_id=in.(${ids.join(",")})`);
    const map: Record<string, TravelRow> = {};
    rows.forEach(r => { map[r.model_id] = r; });
    return map;
  } catch { return {}; }
};
