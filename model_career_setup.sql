-- ════════════════════════════════════════════════════════════════
-- Modiq · 모델 경력(career) 컬럼 추가 (1회 실행)
-- 목적: 모델 정보수정의 "경력" 입력 + 검색 매칭에 사용.
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run.
--   ⚠️ 이 컬럼이 없으면 모델 저장 시 "column career does not exist" 오류가 납니다.
-- ════════════════════════════════════════════════════════════════

alter table models add column if not exists career text;
