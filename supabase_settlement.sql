-- ═══════════════════════════════════════════════════════════════
-- Modiq 정산·세무 확장 마이그레이션 (v1)
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- 안전: 전부 "add column if not exists" — 재실행해도 무해, 기존 데이터 보존
-- 전제: bookings.overcharges / is_paid(고객입금) / model_paid(모델지급) 는 이미 존재
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 모델: 정산 세무 유형 + 기본 정산 조건 ──
-- payout_tax_type : 'foreigner'(외국인, 전액 지급) | 'freelancer'(3.3% 원천징수) | 'company'(소속사, 세금계산서 10% 가산)
alter table models add column if not exists payout_tax_type text default 'freelancer';
-- 외국인 모델 국가(예: 러시아). 외국인 선택 시에만 사용
alter table models add column if not exists country text;
-- payout_pay_type : 'rate'(비율 %)  |  'fixed'(정액 원)  — 섭외에서 미지정 시 이 기본값 사용
alter table models add column if not exists payout_pay_type text default 'rate';
-- payout_pay_value: 비율(%) 또는 정액(원). 비율이면 15 권장, 정액이면 금액
alter table models add column if not exists payout_pay_value numeric default 15;
-- 소속사(company) 모델일 때 세금계산서 수취용 사업자번호(선택)
alter table models add column if not exists payout_biz_no text;
-- ⚠️ 프리랜서 간이지급명세서 제출용 '주민등록번호 전체'는 민감정보라 별도 결정 후 추가
--    (현재는 ssn6=앞6자리만 보관. 세무 제출 export 시 뒷자리 보완 필요)

-- ── 2. 섭외(계약): 모델 정산 조건 override (null=모델 기본값 사용) ──
alter table bookings add column if not exists model_pay_type text;     -- 'rate'|'fixed'|null
alter table bookings add column if not exists model_pay_value numeric; -- 비율(%) 또는 정액(원)

-- ── 3. 섭외: 정산 내역서용 날짜+상태 (금액은 계산로직에서 산출) ──
-- 계약금: deposit_amt(금액)·deposit_due(예정일) 는 기존. 실제 수금 여부/일자 추가
alter table bookings add column if not exists deposit_paid       boolean default false; -- 계약금 입금완료
alter table bookings add column if not exists deposit_paid_date  text;                  -- 계약금 입금일
-- 잔금: balance_due(예정일) 는 기존. 실제 수금 여부/일자 추가 (is_paid=전체 입금완료와 별개로 잔금 단계 추적)
alter table bookings add column if not exists balance_paid       boolean default false; -- 잔금 입금완료
alter table bookings add column if not exists balance_paid_date  text;                  -- 잔금 입금일
-- 계산서(에이전시→고객사, 세금계산서) 발행
alter table bookings add column if not exists tax_invoice_issued boolean default false; -- 계산서 발행완료
alter table bookings add column if not exists tax_invoice_date   text;                  -- 계산서 발행일
-- 모델 정산: model_paid(지급완료) 는 기존. 지급일 추가
alter table bookings add column if not exists model_paid_date    text;                  -- 모델 정산(지급)일

-- ── 4. overcharges(jsonb) 항목 구조 (스키마 변경 불필요, 참고용) ──
--   기존: { reason, amount }
--   확장: { reason, amount, model_pay_type, model_pay_value }
--         (항목별 모델 몫을 비율/정액으로 따로 지정. 미지정 시 모델/섭외 기본값 폴백)

-- ── 5. (선택) 조회 성능 인덱스 ──
create index if not exists idx_bookings_shoot_date on bookings(shoot_date);
create index if not exists idx_bookings_model_id   on bookings(model_id);
