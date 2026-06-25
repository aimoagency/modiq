-- ═══════════════════════════════════════════════════════════════
-- 발송(Distribution) — 크로스 테넌트 에이전시 조회 RPC (add-only)
--
-- 배경: agencies 테이블 RLS(agencies_select = id in my_agency_ids())가
--   타 에이전시 행 조회를 막는다. 그래서 ① 파트너 검색(사업자번호) ②
--   파트너/발송 상대 '이름 표시'에 SECURITY DEFINER 헬퍼가 필요하다.
--   둘 다 최소 컬럼만, 관계가 있는 상대만 반환한다(디렉터리 노출 없음).
--
-- 적용: Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run.
-- 롤백: drop function partner_lookup_by_bizno(text);
--       drop function related_agency_names(text[]);
-- ═══════════════════════════════════════════════════════════════

-- 1) 사업자등록번호(10자리 정확일치)로 파트너 검색.
--    최소정보만 반환, 본인 소속 에이전시는 제외. 디렉터리 열람 불가.
create or replace function public.partner_lookup_by_bizno(p_biz_no text)
returns table(id text, name text, biz_no text)
language sql security definer stable
set search_path = public
as $$
  select a.id, a.name, a.biz_no
  from public.agencies a
  where regexp_replace(coalesce(a.biz_no,''),'[^0-9]','','g')
      = regexp_replace(coalesce(p_biz_no,''),'[^0-9]','','g')
    and length(regexp_replace(coalesce(p_biz_no,''),'[^0-9]','','g')) = 10
    and a.id not in (select public.my_agency_ids())
  limit 5
$$;
revoke all on function public.partner_lookup_by_bizno(text) from public, anon;
grant execute on function public.partner_lookup_by_bizno(text) to authenticated;

-- 2) 에이전시 이름 표시 — 호출자와 '실제 관계가 있는' 에이전시만 해석.
--    (파트너 행이 있거나, 발송 송신/수신 상대인 경우)
create or replace function public.related_agency_names(p_ids text[])
returns table(id text, name text)
language sql security definer stable
set search_path = public
as $$
  select a.id, a.name
  from public.agencies a
  where a.id = any(p_ids)
    and (
      a.id in (select public.my_agency_ids())
      or exists (
        select 1 from public.agency_partners p
        where (p.requester_agency_id = a.id and p.addressee_agency_id in (select public.my_agency_ids()))
           or (p.addressee_agency_id = a.id and p.requester_agency_id in (select public.my_agency_ids()))
      )
      or exists (
        select 1 from public.talent_distributions d
        join public.distribution_recipients r on r.distribution_id = d.id
        where d.sender_agency_id = a.id
          and r.recipient_agency_id in (select public.my_agency_ids())
      )
      or exists (
        select 1 from public.talent_distributions d
        join public.distribution_recipients r on r.distribution_id = d.id
        where r.recipient_agency_id = a.id
          and d.sender_agency_id in (select public.my_agency_ids())
      )
    )
$$;
revoke all on function public.related_agency_names(text[]) from public, anon;
grant execute on function public.related_agency_names(text[]) to authenticated;
