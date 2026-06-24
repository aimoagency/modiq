-- 어드민: 특정 에이전시의 대표/담당자 목록 조회 (admin-api 'members' 액션에서 service_role로 호출)
-- SECURITY DEFINER + search_path='' , anon/authenticated 실행 권한 revoke (어드민 보안 규칙).
create or replace function public.admin_agency_members(p_agency_id text)
returns table(id text, name text, email text, "position" text, phone text, role text, can_view_finance boolean, created_at text)
language sql
security definer
set search_path = ''
as $$
  select m.id, m.name, m.email, m."position", m.phone, m.role,
         coalesce(m.can_view_finance, false), m.created_at::text
  from public.agency_members m
  where m.agency_id = p_agency_id
  order by (m.role = 'owner') desc, m.created_at asc;
$$;
revoke all on function public.admin_agency_members(text) from public, anon, authenticated;
grant execute on function public.admin_agency_members(text) to service_role;
