-- ═══════════════════════════════════════════════════════════════
-- Modiq ID 체계 (modiq-id-spec v1.0) — DB 준비
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- ═══════════════════════════════════════════════════════════════

-- 1) 에이전시 순번(agency_no) — AG001~ 의 숫자. 전역 시퀀스로 자동 부여.
alter table agencies add column if not exists agency_no int;

create sequence if not exists agency_no_seq;

-- 기존 에이전시 백필(가입 순서대로 1,2,3...)
with ordered as (
  select id, row_number() over (order by created_at nulls last, id) as rn from agencies
)
update agencies a set agency_no = o.rn
from ordered o where a.id = o.id and a.agency_no is null;

-- 시퀀스를 현재 최댓값 다음으로 맞춤
select setval('agency_no_seq', greatest(coalesce((select max(agency_no) from agencies), 0), 1));

-- 신규 에이전시 가입 시 자동 부여 트리거
create or replace function set_agency_no() returns trigger as $$
begin
  if NEW.agency_no is null then
    NEW.agency_no := nextval('agency_no_seq');
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_agency_no on agencies;
create trigger trg_agency_no before insert on agencies
for each row execute function set_agency_no();

-- 2) 모델 성별(M/F) · 국적타입(K/X) 컬럼
alter table models add column if not exists gender text;            -- 'M' | 'F'
alter table models add column if not exists nationality_type text;  -- 'K'(내국인) | 'X'(외국인)
