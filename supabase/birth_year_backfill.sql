-- ═══════════════════════════════════════════════════════════════
-- (선택·1회성) 기존 모델 birth_year 백필
--   ssn6(YYMMDD) 앞 2자리로 출생연도 추정.
--   세기 보정: 00~05 → 2000년대, 그 외 → 1900년대 (핸드오프 규칙).
--   ⚠️ ssn6이 6자리 숫자인 행만 대상. 이미 birth_year가 있으면 건너뜀.
--   실행 전 SELECT로 결과를 먼저 확인할 것(주석 해제).
-- ═══════════════════════════════════════════════════════════════

-- 1) 미리보기 — 어떻게 채워질지 확인
-- select id, name, ssn6,
--   case when substr(ssn6,1,2) ~ '^[0-9]{2}$' then
--     case when substr(ssn6,1,2)::int <= 5 then 2000 else 1900 end + substr(ssn6,1,2)::int
--   end as inferred_birth_year
-- from public.models
-- where birth_year is null and ssn6 ~ '^[0-9]{6}$';

-- 2) 실제 백필
update public.models
set birth_year =
  case when substr(ssn6,1,2)::int <= 5 then 2000 else 1900 end + substr(ssn6,1,2)::int
where birth_year is null
  and ssn6 ~ '^[0-9]{6}$';
