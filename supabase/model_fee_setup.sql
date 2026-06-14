-- ═══════════════════════════════════════════════════════════════
-- Modiq 모델료 (Day / Half day / Hour) — models 신규 컬럼
-- 실행: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════
alter table models add column if not exists fee_day  numeric;  -- Day(9시간 기준) 모델료(원)
alter table models add column if not exists fee_half numeric;  -- Half day(5시간 기준) 모델료(원)
alter table models add column if not exists fee_hour numeric;  -- Hour(1시간) 모델료(원)

-- 정산방식(payout_pay_type: rate|fixed, payout_pay_value)은 기존 컬럼 그대로 사용.
--  · 비율(rate): 모델 정산 기준액 = 모델료(세션) × payout_pay_value%
--    (모델료 미입력 시 공급가(촬영비) 기준으로 폴백 — 구버전 데이터 호환)
--  · 정액(fixed): payout_pay_value 금액을 그대로 사용 (모델료 무관)
-- 외국인 원천징수율은 models.tax_rate(E-6=3.3 / C-4·기타=20) 사용.
