-- ═══════════════════════════════════════════════════════════════
-- 테넌트 격리(멀티테넌시) RLS 구멍 수정
-- 실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
--
-- 배경
--  - advisor(rls_policy_always_true)가 `USING (true)` 정책 4건을 경고.
--  - 이 정책들은 permissive라 올바른 정책과 OR로 합쳐져, 결과적으로
--    "누구나(비인증 포함) 전체 행 접근"을 허용 → 다른 에이전시 데이터 노출.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. projects: 중복 USING(true) 정책 제거 ──
-- projects에는 올바른 `projects_agency_all`(authenticated, 소속 에이전시 한정)이
-- 이미 있으나, 구 정책 `agency_projects`(public, USING true)가 함께 남아 격리를 무력화.
-- → 구 정책만 제거하면 올바른 정책만 남아 정상 격리된다. (앱 동작 영향 없음)
drop policy if exists "agency_projects" on public.projects;

-- ── 2. 레거시 미사용 테이블의 전체-접근 정책 제거 ──
-- clients/messages/settlements는 구 스키마(agency_id가 uuid) 잔재로, 현재 앱은
-- 각각 customers / bookings.messages(jsonb) / bookings 기반 계산으로 대체해 사용하지 않는다.
-- `*_all`(public, USING true) 정책만 존재 → 비인증/타 에이전시 전체 접근 가능한 구멍.
-- 정책을 제거하면 RLS가 켜진 채 정책이 없어져 anon/authenticated 직접 접근은 차단되고,
-- 백엔드(service_role)는 RLS를 우회하므로 영향 없음.
drop policy if exists "clients_all"     on public.clients;
drop policy if exists "messages_all"    on public.messages;
drop policy if exists "settlements_all" on public.settlements;

-- ═══════════════════════════════════════════════════════════════
-- 검증
--   select tablename, policyname, cmd, qual
--   from pg_policies
--   where schemaname='public'
--     and tablename in ('projects','clients','messages','settlements')
--   order by tablename, policyname;
--   -- 기대: projects는 projects_agency_all(소속 한정)만, 나머지 3개는 정책 없음.
--
-- 롤백 (원복이 필요할 때만)
--   create policy "agency_projects" on public.projects   for all using (true);
--   create policy "clients_all"     on public.clients     for all using (true) with check (true);
--   create policy "messages_all"    on public.messages    for all using (true) with check (true);
--   create policy "settlements_all" on public.settlements for all using (true) with check (true);
-- ═══════════════════════════════════════════════════════════════
