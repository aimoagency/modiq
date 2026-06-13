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

-- ※ RLS 정책은 기존 테이블(holidays 등)과 동일하게 소속 에이전시 단위로 적용하세요.
--   (holidays 정책을 복사해 model_offs로 동일하게 생성하면 됩니다.)
