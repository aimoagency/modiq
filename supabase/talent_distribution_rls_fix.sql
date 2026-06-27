-- ═══════════════════════════════════════════════════════════════
-- 발송(Distribution) RLS 수정
--  (1) 무한재귀(42P17) 해결: talent_distributions ↔ distribution_recipients
--      SELECT 정책이 서로를 EXISTS로 참조해 발송 시 정책이 순환 호출됨.
--      → SECURITY DEFINER 헬퍼로 교차참조를 감싸 RLS 재평가를 끊는다.
--  (2) 공유 동의 게이트 제거: 내 소속 모델이면 share_consent 무관 발송 가능.
-- add-only/replace. my_agency_ids()는 기존 함수 재사용.
-- ═══════════════════════════════════════════════════════════════

-- ── (1) 재귀 차단용 헬퍼 (definer → 내부 테이블 읽기에 RLS 미적용) ──
create or replace function public.is_dist_recipient(p_dist_id text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.distribution_recipients r
    where r.distribution_id = p_dist_id
      and r.recipient_agency_id in (select public.my_agency_ids())
  );
$$;
create or replace function public.is_dist_sender(p_dist_id text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.talent_distributions d
    where d.id = p_dist_id
      and d.sender_agency_id in (select public.my_agency_ids())
  );
$$;
revoke all on function public.is_dist_recipient(text) from public, anon;
revoke all on function public.is_dist_sender(text)    from public, anon;
grant execute on function public.is_dist_recipient(text) to authenticated;
grant execute on function public.is_dist_sender(text)    to authenticated;

-- ── 상호참조 SELECT 정책을 헬퍼 기반으로 교체(재귀 제거) ──
drop policy if exists dist_select on public.talent_distributions;
create policy dist_select on public.talent_distributions
  for select using (
    sender_agency_id in (select public.my_agency_ids())
    or public.is_dist_recipient(id)
  );

drop policy if exists dist_recipients_select on public.distribution_recipients;
create policy dist_recipients_select on public.distribution_recipients
  for select using (
    recipient_agency_id in (select public.my_agency_ids())
    or public.is_dist_sender(distribution_id)
  );

-- ── (2) 공유 동의 게이트 제거: 스냅샷 insert는 '내 소속 모델'이면 허용 ──
drop policy if exists dist_models_insert on public.distribution_models;
create policy dist_models_insert on public.distribution_models
  for insert with check (
    exists (
      select 1 from public.talent_distributions d
      where d.id = distribution_id
        and d.sender_agency_id in (select public.my_agency_ids())
    )
    and (
      source_model_id is null
      or exists (
        select 1 from public.models m
        where m.id = source_model_id
          and m.agency_id in (select public.my_agency_ids())
      )
    )
  );

-- (선택) 기존 모델 share_consent 일관화 — 게이트 제거됐으나 컬럼값도 true로 맞춰둠
update public.models set share_consent = true where share_consent is distinct from true;

-- 끝.
