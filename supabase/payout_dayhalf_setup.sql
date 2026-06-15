-- ═══════════════════════════════════════════════════════════════
-- Modiq 모델 정산 Day/Half 단가 — models 신규 컬럼
-- 실행: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════
-- 정산방식(payout_pay_type: rate|fixed)은 기존 유지.
-- 단가를 Day(9시간 기준)/Half(5시간 기준)로 분리 저장.
alter table models add column if not exists payout_day_value  numeric;  -- Day(9h) 정산값 (비율% 또는 정액원)
alter table models add column if not exists payout_half_value numeric;  -- Half(5h) 정산값 (비율% 또는 정액원)

-- 기존 단일값(payout_pay_value)을 Day 값으로 백필 (Half는 비워둠 → 미설정 시 Day값 사용)
update models set payout_day_value = payout_pay_value
where payout_day_value is null and payout_pay_value is not null;

-- 섭외(bookings)의 건별 모델 지급액 override는 기존 컬럼 재사용:
--   model_pay_type (rate|fixed), model_pay_value (numeric) — 추가 작업 불필요.
-- 세션(Day/Half)은 섭외 시간(start_time/end_time)으로 런타임 계산 → 별도 컬럼 없음.
