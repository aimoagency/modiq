-- ═══════════════════════════════════════════════════════════════
-- Modiq Supabase 통합 설정 (RLS 보안 + 보류분)
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- ⚠️ 반드시 새 버전 앱(토큰 인증) 배포 + 재로그인 후 실행할 것
-- ═══════════════════════════════════════════════════════════════

-- ── 0. 보류분: 휴무일 테이블 + 레퍼런스 컬럼 ──
create table if not exists holidays (
  id text primary key,
  agency_id text,
  date text not null,
  label text default '휴무일'
);
alter table bookings add column if not exists reference_images jsonb;
alter table bookings add column if not exists reference_videos jsonb;
alter table bookings add column if not exists overcharges jsonb;  -- 촬영 당일 오버차지(추가금) [{reason,amount}]
alter table bookings add column if not exists model_paid boolean default false;  -- 모델 지급완료(에이전시→모델). is_paid=고객사 입금완료(고객사→에이전시)
alter table agency_members add column if not exists can_view_finance boolean default false;  -- 대표가 담당자에게 매출·정산 열람 권한 부여
alter table customers add column if not exists biz_no text;     -- 고객사 사업자등록번호
alter table customers add column if not exists tax_email text;  -- 고객사 계산서(세금계산서) 발송 이메일
alter table agencies  add column if not exists logo_url text;   -- 에이전시 로고(명세서 등 문서에 표시, base64/URL)

-- ── 1. 내 소속 에이전시 헬퍼 (RLS 재귀 방지용 security definer) ──
create or replace function public.my_agency_ids()
returns setof text
language sql security definer stable
set search_path = public
as $$
  select a.id from agencies a where a.owner_id::text = auth.uid()::text
  union
  select m.agency_id from agency_members m where m.user_id::text = auth.uid()::text
$$;

-- ── 2. RLS 활성화 ──
alter table agencies        enable row level security;
alter table agency_members  enable row level security;
alter table models          enable row level security;
alter table customers       enable row level security;
alter table bookings        enable row level security;
alter table projects        enable row level security;
alter table holidays        enable row level security;

-- ── 3. 정책 (기존 정책 있으면 제거 후 생성) ──
-- agencies: 소속자 조회 / 본인 소유만 생성·수정
drop policy if exists "agencies_select" on agencies;
drop policy if exists "agencies_insert" on agencies;
drop policy if exists "agencies_update" on agencies;
create policy "agencies_select" on agencies for select to authenticated
  using (id in (select my_agency_ids()));
create policy "agencies_insert" on agencies for insert to authenticated
  with check (owner_id::text = auth.uid()::text);
create policy "agencies_update" on agencies for update to authenticated
  using (owner_id::text = auth.uid()::text) with check (owner_id::text = auth.uid()::text);

-- agency_members: 소속자 조회 / 대표만 추가·수정·삭제
drop policy if exists "members_select" on agency_members;
drop policy if exists "members_insert" on agency_members;
drop policy if exists "members_update" on agency_members;
drop policy if exists "members_delete" on agency_members;
create policy "members_select" on agency_members for select to authenticated
  using (agency_id in (select my_agency_ids()));
create policy "members_insert" on agency_members for insert to authenticated
  with check (agency_id in (select a.id from agencies a where a.owner_id::text = auth.uid()::text));
create policy "members_update" on agency_members for update to authenticated
  using (agency_id in (select a.id from agencies a where a.owner_id::text = auth.uid()::text))
  with check (agency_id in (select a.id from agencies a where a.owner_id::text = auth.uid()::text));
create policy "members_delete" on agency_members for delete to authenticated
  using (agency_id in (select a.id from agencies a where a.owner_id::text = auth.uid()::text));

-- 데이터 테이블 5종: 소속 에이전시만 전체 권한
do $$
declare t text;
begin
  foreach t in array array['models','customers','bookings','projects','holidays'] loop
    execute format('drop policy if exists "%s_agency_all" on %I', t, t);
    execute format(
      'create policy "%s_agency_all" on %I for all to authenticated
         using (agency_id in (select my_agency_ids()))
         with check (agency_id in (select my_agency_ids()))', t, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- 롤백 (문제 발생 시 아래만 실행하면 이전 상태로)
-- alter table agencies        disable row level security;
-- alter table agency_members  disable row level security;
-- alter table models          disable row level security;
-- alter table customers       disable row level security;
-- alter table bookings        disable row level security;
-- alter table projects        disable row level security;
-- alter table holidays        disable row level security;
-- ═══════════════════════════════════════════════════════════════
