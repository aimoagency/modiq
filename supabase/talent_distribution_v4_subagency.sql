-- ═══════════════════════════════════════════════════════════════
-- V4: 발송 모델 → 대대행(소속사) 편입 + A 지급액 정산
--  · A: 법인 정산정보(계좌 포함)를 회사설정에 1회 등록 → 발송 시 스냅샷
--  · B: 받은 모델을 '소속사(company) 10% 고정'으로 편입, A 업체정보 자동 채움
--  · 출처(A) 자동 기록 + 에이전시별 필터
-- 계산식은 변경하지 않음(기존 modelPayout company 경로 재사용).
-- 안전: 모두 ADD COLUMN IF NOT EXISTS (재실행 가능).
-- ═══════════════════════════════════════════════════════════════

-- 1) A의 정산 입금계좌 (회사설정에서 1회 등록) — 상호/사업자번호/대표/주소는 기존 컬럼 사용
alter table public.agencies
  add column if not exists payout_bank_info text;

-- 2) 발송 본문에 A 법인 정산정보 스냅샷(발송 시점 고정)
--    { company_name, biz_no, rep_name, contact, address, bank }
alter table public.talent_distributions
  add column if not exists sender_payout_info jsonb;

-- 3) 편입 모델의 출처(A) — 자동 기록 + 에이전시별 필터/추적
--    ⚠️ agencies.id / talent_distributions.id 는 'AGY_...' 등 TEXT 식별자라 uuid 아님(text 사용).
alter table public.models
  add column if not exists source_agency_id text;
alter table public.models
  add column if not exists source_agency_name text;
alter table public.models
  add column if not exists source_distribution_id text;

-- 이전에 uuid로 만든 경우 text로 정정(재실행 안전 · 빈 컬럼이면 무손실)
alter table public.models alter column source_agency_id type text using source_agency_id::text;
alter table public.models alter column source_distribution_id type text using source_distribution_id::text;

create index if not exists idx_models_source_agency on public.models (source_agency_id);
