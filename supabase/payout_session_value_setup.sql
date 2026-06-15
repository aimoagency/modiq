-- ═══════════════════════════════════════════════════════════════
-- Modiq 정산방식 값(Day/Half/Hour) — models 신규 컬럼
-- 실행: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════
-- 정산방식(payout_pay_type: rate|fixed)은 세션별 값으로 분리:
--   · 비율(rate): 모델료(세션) × 해당 세션 값% = 모델 정산 기준액
--   · 정액(fixed): 해당 세션 값(원)을 그대로 사용 (모델료·수식 미적용)
alter table models add column if not exists payout_day_value  numeric;  -- Day(9h) 값(% 또는 원)
alter table models add column if not exists payout_half_value numeric;  -- Half day(5h) 값
alter table models add column if not exists payout_hour_value numeric;  -- Hour(1h) 값

-- 기존 단일값(payout_pay_value)을 Day 값으로 백필
update models set payout_day_value = payout_pay_value
where payout_day_value is null and payout_pay_value is not null;

-- 모델료(fee_day/fee_half/fee_hour)는 model_fee_setup.sql 에서 이미 추가됨.
