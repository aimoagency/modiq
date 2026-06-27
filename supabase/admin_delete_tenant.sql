-- 어드민: 테넌트(에이전시) 전체 삭제 (admin-api 'delete_tenant' 액션에서 service_role로 호출).
-- agency_id를 가진 모든 테이블을 FK 의존 순서로 삭제 → 멤버(반환) → 에이전시.
-- 반환된 멤버 user_id는 admin-api가 admin.auth.admin.deleteUser로 auth 계정까지 삭제.
-- 모델 사진(model-photos 버킷)은 admin-api가 Storage API로 정리(아래 ⚠️ 참고).
-- SECURITY DEFINER + search_path='' , anon/authenticated revoke (어드민 보안 규칙).
--
-- ⚠️ 수정 이력
--  1) agency_id::text 캐스팅 — 레거시 테이블(clients/messages/settlements)은 agency_id가 uuid라
--     `uuid = text`(text 파라미터) 비교에서 "operator does not exist: uuid = text"로 함수가 터졌었음.
--     캐스팅하면 text 컬럼엔 무해(no-op), uuid 컬럼은 text로 캐스팅돼 비교 성립.
--  2) storage.objects 직접 DELETE 제거 — 최신 Supabase가 SQL 직접삭제를 차단
--     ("Direct deletion from storage tables is not allowed"). 사진은 admin-api(Storage API)에서 재귀 삭제.
create or replace function public.admin_delete_tenant(p_agency_id text)
returns table(deleted_user_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.secure_id_access_log where agency_id::text = p_agency_id;
  delete from public.model_secure_id      where agency_id::text = p_agency_id;
  delete from public.settlements          where agency_id::text = p_agency_id;
  delete from public.messages             where agency_id::text = p_agency_id;
  delete from public.holidays             where agency_id::text = p_agency_id;
  delete from public.model_offs           where agency_id::text = p_agency_id;
  delete from public.google_tokens        where agency_id::text = p_agency_id;
  delete from public.packages             where agency_id::text = p_agency_id;
  delete from public.bookings             where agency_id::text = p_agency_id;
  delete from public.projects             where agency_id::text = p_agency_id;
  delete from public.customers            where agency_id::text = p_agency_id;
  delete from public.clients              where agency_id::text = p_agency_id;
  delete from public.models               where agency_id::text = p_agency_id;
  -- 사진(storage.objects)은 SQL 직접삭제 금지 → admin-api에서 Storage API로 처리.
  return query
    with del_m as (delete from public.agency_members where agency_id::text = p_agency_id returning user_id)
    select user_id::text from del_m where user_id is not null;
  delete from public.agencies where id::text = p_agency_id;
end;
$$;
revoke all on function public.admin_delete_tenant(text) from public, anon, authenticated;
grant execute on function public.admin_delete_tenant(text) to service_role;
