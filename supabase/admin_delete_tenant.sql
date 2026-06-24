-- 어드민: 테넌트(에이전시) 전체 삭제 (admin-api 'delete_tenant' 액션에서 service_role로 호출).
-- agency_id를 가진 모든 테이블을 FK 의존 순서로 삭제 → 사진 → 멤버(반환) → 에이전시.
-- 반환된 멤버 user_id는 admin-api가 admin.auth.admin.deleteUser로 auth 계정까지 삭제.
-- SECURITY DEFINER + search_path='' , anon/authenticated revoke (어드민 보안 규칙).
create or replace function public.admin_delete_tenant(p_agency_id text)
returns table(deleted_user_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.secure_id_access_log where agency_id = p_agency_id;
  delete from public.model_secure_id      where agency_id = p_agency_id;
  delete from public.settlements          where agency_id = p_agency_id;
  delete from public.messages             where agency_id = p_agency_id;
  delete from public.holidays             where agency_id = p_agency_id;
  delete from public.model_offs           where agency_id = p_agency_id;
  delete from public.google_tokens        where agency_id = p_agency_id;
  delete from public.packages             where agency_id = p_agency_id;
  delete from public.bookings             where agency_id = p_agency_id;
  delete from public.projects             where agency_id = p_agency_id;
  delete from public.customers            where agency_id = p_agency_id;
  delete from public.clients              where agency_id = p_agency_id;
  delete from public.models               where agency_id = p_agency_id;
  delete from storage.objects where bucket_id = 'model-photos' and split_part(name, '/', 1) = p_agency_id;
  return query
    with del_m as (delete from public.agency_members where agency_id = p_agency_id returning user_id)
    select user_id::text from del_m where user_id is not null;
  delete from public.agencies where id = p_agency_id;
end;
$$;
revoke all on function public.admin_delete_tenant(text) from public, anon, authenticated;
grant execute on function public.admin_delete_tenant(text) to service_role;
