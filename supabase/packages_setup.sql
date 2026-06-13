-- ═══════════════════════════════════════════════════════════════
-- Modiq 패키지 기능 — DB 설정 (packages 테이블 + RLS + 공개 공유)
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 전제: supabase_setup.sql(RLS 기본/my_agency_ids 헬퍼)이 먼저 적용돼 있어야 함
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 테이블 ──
create table if not exists packages (
  id          text primary key,
  agency_id   text not null,
  title       text not null default '무제 패키지',
  client_name text default '',
  layout      text default 'casting',          -- 'casting'(다중 모델 그리드) | 'compcard'(단일 모델 카드)
  items       jsonb default '[]'::jsonb,        -- [{model_id,name,category,height,bust,waist,hip,shoe,instagram_url,caption,photos:[base64...]}]
  memo        text default '',
  show_brand  boolean default true,             -- 고객 화면/PDF에 에이전시 이름·로고 표시 여부
  brand_name  text default '',                  -- 표시 이름 (기본 = 에이전시명)
  brand_logo  text default '',                  -- 로고 이미지 (base64 data URL, 선택)
  share_token text not null,                    -- 공개 링크용 추측 불가 토큰
  is_public   boolean default true,             -- false면 링크 비활성(공개 조회 차단)
  created_at  timestamptz default now()
);

create unique index if not exists packages_share_token_idx on packages (share_token);
create index if not exists packages_agency_idx on packages (agency_id);

-- ── 2. RLS 활성화 ──
alter table packages enable row level security;

-- ── 3. 정책 ──
-- (a) 소속 에이전시 멤버: 자기 에이전시 패키지 전체 권한 (다른 데이터 테이블과 동일 패턴)
drop policy if exists "packages_agency_all" on packages;
create policy "packages_agency_all" on packages for all to authenticated
  using (agency_id in (select my_agency_ids()))
  with check (agency_id in (select my_agency_ids()));

-- (b) 공개 조회: 로그인 안 한 고객사도 is_public=true 패키지는 읽기 가능
--     앱은 항상 share_token으로만 조회하므로, 추측 불가 토큰이 사실상 비밀번호 역할.
drop policy if exists "packages_public_select" on packages;
create policy "packages_public_select" on packages for select to anon
  using (is_public = true);

-- ═══════════════════════════════════════════════════════════════
-- 롤백 (문제 시 아래만 실행)
-- drop policy if exists "packages_agency_all"   on packages;
-- drop policy if exists "packages_public_select" on packages;
-- alter table packages disable row level security;
-- drop table if exists packages;
-- ═══════════════════════════════════════════════════════════════
