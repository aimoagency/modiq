-- ═══════════════════════════════════════════════════════════════
-- Modiq 모델 프로필 확장 — models 테이블 컬럼 추가
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- (기존 데이터 영향 없음. 모두 nullable / 기본값 처리)
-- ═══════════════════════════════════════════════════════════════

alter table models add column if not exists height              text default '';   -- 키(cm)
alter table models add column if not exists shoe                text default '';   -- 신발(mm)
alter table models add column if not exists bust                text default '';   -- 가슴(cm)
alter table models add column if not exists waist               text default '';   -- 허리(cm)
alter table models add column if not exists hip                 text default '';   -- 엉덩이(cm)
alter table models add column if not exists hair_length         text default '';   -- 머리 길이(숏/단발/미디엄/롱)
alter table models add column if not exists hair_color          text default '';   -- 머리색(예: 다크블론드)
alter table models add column if not exists eye_color           text default '';   -- 눈동자색
alter table models add column if not exists tattoo              boolean default false; -- 타투 유무
alter table models add column if not exists underwear_ok        boolean default false; -- 언더웨어 촬영 가능 여부
alter table models add column if not exists fields              jsonb default '[]'::jsonb; -- 분야(복수): 패션/뷰티/연기자/인플루언서/크리에이터/가수/댄서/운동
alter table models add column if not exists specialty           text default '';   -- 특기(쉼표 구분)
alter table models add column if not exists instagram_followers text default '';   -- 인스타 팔로워 수
alter table models add column if not exists photos              jsonb default '[]'::jsonb; -- 포트폴리오 사진(최대 15장, base64) — 2단계에서 사용
alter table models add column if not exists compcard            jsonb default '[]'::jsonb; -- 컴카드 슬롯 지정(5칸: [메인,우상,우중,우하좌,우하우] 사진 URL, 빈 칸=null)

-- ※ RLS 정책은 기존 models 정책(소속 에이전시 전체 권한)이 그대로 적용됨. 별도 추가 불필요.
