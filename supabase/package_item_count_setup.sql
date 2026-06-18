-- ═══════════════════════════════════════════════════════════════
-- Modiq 패키지 목록 경량화 — packages.item_count 생성 컬럼
-- 목적: 목록 조회에서 무거운 items(jsonb, 사진 포함)를 제외하고도
--       "N명" 카운트를 표시하기 위함. Postgres가 자동 계산·유지하므로
--       앱의 INSERT/UPDATE 경로는 수정할 필요가 없다.
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- 전제: packages_setup.sql 이 먼저 적용돼 있어야 함
-- ═══════════════════════════════════════════════════════════════

alter table packages
  add column if not exists item_count int
  generated always as (jsonb_array_length(coalesce(items, '[]'::jsonb))) stored;

-- ═══════════════════════════════════════════════════════════════
-- 롤백 (문제 시 아래만 실행)
-- alter table packages drop column if exists item_count;
-- ═══════════════════════════════════════════════════════════════
