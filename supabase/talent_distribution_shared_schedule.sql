-- ═══════════════════════════════════════════════════════════════
-- 발송(Distribution) — 공유 모델 '가용일(스케줄)' 라이브 조회 RPC (add-only)
--
-- 목적: 대대행으로 받은(또는 받는 중인) 모델의 '점유 날짜'만 노출해
--   에이전시 간 중복 캐스팅을 막는다. ⚠️ 고객명·장소·프로젝트·메모 등
--   민감정보는 절대 반환하지 않는다(날짜·시간·유형·상태만).
--
-- 보안: SECURITY DEFINER. 호출자(my_agency_ids())가 '유효한(active·미만료)'
--   발송으로 그 모델을 실제 수신한 경우에만 해당 모델의 일정을 반환한다.
--   (shared_model_travel 과 동일 취지의 라이브 뷰)
--
-- 적용: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run.
-- 롤백: drop function public.shared_model_schedule(text[]);
-- ═══════════════════════════════════════════════════════════════
create or replace function public.shared_model_schedule(p_model_ids text[])
returns table(model_id text, shoot_date text)
language sql security definer stable
set search_path = public
as $$
  select b.model_id, b.shoot_date::text
  from public.bookings b
  where b.model_id = any(p_model_ids)
    and coalesce(b.status,'') <> 'CANCELLED'
    and exists (
      select 1
      from public.distribution_models dm
      join public.talent_distributions d on d.id = dm.distribution_id
      join public.distribution_recipients r on r.distribution_id = d.id
      where dm.source_model_id = b.model_id
        and r.recipient_agency_id in (select public.my_agency_ids())
        and d.status = 'active'
        and (d.expires_at is null or d.expires_at > now())
    )
  order by b.shoot_date
$$;
revoke all on function public.shared_model_schedule(text[]) from public, anon;
grant execute on function public.shared_model_schedule(text[]) to authenticated;
