-- ════════════════════════════════════════════════════════════════
-- Modiq · 모델 사진 Storage 설정 (1회 실행)
-- 목적: 모델 사진을 base64로 DB에 저장하던 방식 → Storage 버킷에 저장하고
--       DB에는 URL만 남겨 조회 용량을 대폭 줄임 (models 9MB → 수십 KB).
-- 실행: Supabase 대시보드 → SQL Editor에 붙여넣고 Run.
-- ════════════════════════════════════════════════════════════════

-- 1) 버킷 생성 (공개 읽기 — 컴카드/패키지 공유 링크에서 이미지가 보여야 함)
insert into storage.buckets (id, name, public)
values ('model-photos', 'model-photos', true)
on conflict (id) do update set public = true;

-- 2) 접근 정책
--   · 읽기: 누구나(공개 URL로 이미지 표시 — 컴카드/패키지 공유)
--   · 쓰기/수정/삭제: 로그인한 사용자(authenticated)만
drop policy if exists "modiq model-photos read"   on storage.objects;
drop policy if exists "modiq model-photos insert" on storage.objects;
drop policy if exists "modiq model-photos update" on storage.objects;
drop policy if exists "modiq model-photos delete" on storage.objects;

create policy "modiq model-photos read"
  on storage.objects for select
  using ( bucket_id = 'model-photos' );

create policy "modiq model-photos insert"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'model-photos' );

create policy "modiq model-photos update"
  on storage.objects for update to authenticated
  using ( bucket_id = 'model-photos' );

create policy "modiq model-photos delete"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'model-photos' );
