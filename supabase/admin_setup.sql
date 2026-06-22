-- Modiq 어드민(플랫폼 운영자 콘솔) 백엔드 설정
-- 적용: Supabase SQL Editor 또는 마이그레이션(platform_admin_setup)으로 1회 실행됨.
-- 보안: service_role(admin-api Edge Function)만 접근. anon/authenticated는 함수 실행 권한 없음.

-- 플랫폼 운영자(슈퍼관리자) 화이트리스트. RLS ON + 정책 없음 → service_role만 접근.
-- 비어 있으면 아무도 어드민 권한 없음(안전). 운영자 이메일을 insert 해야 활성화.
create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  note text,
  created_at timestamptz default now()
);
alter table public.platform_admins enable row level security;

-- 테넌트(에이전시)별 통계: 플랜/트라이얼 + 기능별 사용량 + 저장용량(model-photos 버킷, 상위폴더=agency_id)
create or replace function public.admin_tenant_stats()
returns table(
  agency_id text, name text, owner_email text, owner_id text, plan text,
  additional_members int, trial_ends_at text, created_at text,
  members bigint, models bigint, bookings bigint, customers bigint, packages bigint,
  storage_files bigint, storage_bytes bigint
) language sql security definer set search_path = '' as $$
  select a.id, a.name, a.owner_email, a.owner_id, a.plan,
    a.additional_members::int, a.trial_ends_at::text, a.created_at::text,
    (select count(*) from public.agency_members m where m.agency_id = a.id),
    (select count(*) from public.models md where md.agency_id = a.id),
    (select count(*) from public.bookings b where b.agency_id = a.id),
    (select count(*) from public.customers c where c.agency_id = a.id),
    (select count(*) from public.packages p where p.agency_id = a.id),
    coalesce((select count(*) from storage.objects o where o.bucket_id='model-photos' and split_part(o.name,'/',1)=a.id),0),
    coalesce((select sum((o.metadata->>'size')::bigint) from storage.objects o where o.bucket_id='model-photos' and split_part(o.name,'/',1)=a.id),0)
  from public.agencies a
  order by a.created_at desc;
$$;

-- 고아 계정: 에이전시도 멤버십도 없는 auth 사용자(가입 실패 잔재). 운영자(platform_admins)는 제외.
create or replace function public.admin_orphan_accounts()
returns table(user_id uuid, email text, created_at text, confirmed boolean)
language sql security definer set search_path = '' as $$
  select u.id, u.email::text, u.created_at::text, (u.email_confirmed_at is not null)
  from auth.users u
  where not exists (select 1 from public.agencies a where a.owner_id = u.id::text)
    and not exists (select 1 from public.agency_members m where m.user_id = u.id::text)
    and not exists (select 1 from public.platform_admins pa where pa.email = u.email)
  order by u.created_at desc;
$$;

revoke all on function public.admin_tenant_stats() from public, anon, authenticated;
revoke all on function public.admin_orphan_accounts() from public, anon, authenticated;

-- 운영자 등록 예시(이메일을 실제 운영자 계정으로 교체):
-- insert into public.platform_admins (email, note) values ('owner@example.com', 'Jae');
