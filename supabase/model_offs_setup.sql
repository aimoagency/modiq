-- ═══════════════════════════════════════════════════════════════
-- Modiq 모델 휴무(기간) — model_offs 테이블
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- (모델별 휴무 기간. 섭외 충돌 경고/캘린더 표시에 사용)
-- ═══════════════════════════════════════════════════════════════

create table if not exists model_offs (
  id          text primary key,
  agency_id   text not null,
  model_id    text not null,
  start_date  date not null,            -- 휴무 시작일
  end_date    date not null,            -- 휴무 종료일(포함)
  reason      text default '',          -- 사유(예: 개인 휴가, 학업, 해외)
  created_at  timestamptz default now()
);

create index if not exists idx_model_offs_agency on model_offs(agency_id);
create index if not exists idx_model_offs_model  on model_offs(model_id);

-- ── RLS: 소속 에이전시 단위 접근 (packages/holidays와 동일 패턴) ──
-- 전제: supabase_setup.sql 의 my_agency_ids() 헬퍼가 먼저 적용돼 있어야 함.
alter table model_offs enable row level security;

drop policy if exists "model_offs_agency_all" on model_offs;
create policy "model_offs_agency_all" on model_offs for all to authenticated
  using      (agency_id in (select my_agency_ids()))
  with check (agency_id in (select my_agency_ids()));

-- ═══════════════════════════════════════════════════════════════
-- 롤백 (문제 시 아래만 실행)
-- drop policy if exists "model_offs_agency_all" on model_offs;
-- alter table model_offs disable row level security;
-- ═══════════════════════════════════════════════════════════════
