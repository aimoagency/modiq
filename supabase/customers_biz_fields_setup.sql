-- 고객사(customers) 사업자등록증 상세 + 분야 컬럼 추가
-- Supabase 대시보드 → SQL Editor에 붙여넣고 실행하세요. (이미 있으면 건너뜀)
alter table public.customers add column if not exists rep_name  text;  -- 대표자(성명)
alter table public.customers add column if not exists address   text;  -- 사업장 주소
alter table public.customers add column if not exists biz_type  text;  -- 업태
alter table public.customers add column if not exists biz_item  text;  -- 종목
alter table public.customers add column if not exists category  text;  -- 분야(패션브랜드/뷰티/...)
