-- ═══════════════════════════════════════════════════════════════
-- Modiq 외국인 모델 — models 신규 컬럼 (기존 country/visa_entry/visa_exit/is_foreigner 재사용)
-- 실행: Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════
alter table models add column if not exists visa_type      text;             -- 'E6' | 'C4' | 'OTHER'
alter table models add column if not exists has_alien_card boolean default false; -- 외국인등록증 유무
alter table models add column if not exists payment_method text;             -- 'bank' | 'payoneer' | 'wise' | 'cash'
alter table models add column if not exists payment_detail jsonb default '{}'::jsonb; -- {email} 또는 {bank,account,holder}
alter table models add column if not exists tax_rate       numeric;          -- 3.3 (E6) / 20 (C4·기타) — 정보용(정산 계산은 기존 로직)
-- 입국일=visa_entry, 체류 만료일=visa_exit, 국적=country, 외국인 여부=is_foreigner (기존 재사용)
