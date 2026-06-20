-- ═══════════════════════════════════════════════════════════════
-- 모델 식별번호(주민번호/외국인등록번호/여권번호) 보안 저장 기반
-- 운영 DB에 apply_migration 으로 적용됨 (기록용)
--
-- 설계
--  - 평문은 어디에도 저장 안 함. pgcrypto(pgp_sym_encrypt)로 암호화한 bytea만 보관.
--  - 암호키는 Supabase Vault(model_id_enc_key) — DB 컬럼/코드/클라이언트에 평문 키 없음.
--  - 암호문 테이블 model_secure_id: RLS ON + 정책 0 + anon/authenticated 권한 회수
--    → 직접 SELECT 전면 차단. SECURITY DEFINER RPC로만 입출.
--  - 화면 표시는 models.national_id_masked(마스킹값)만. 전체값은 대표(owner)만 RPC로,
--    호출마다 secure_id_access_log에 감사 기록.
--  - 식별번호 종류 national_id_type: rrn(내국인) | arc(외국인등록번호) | passport(단기체류 여권)
-- ═══════════════════════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'model_id_enc_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'model_id_enc_key', 'Model national ID (RRN/ARC/passport) encryption passphrase');
  end if;
end $$;

alter table public.models add column if not exists national_id_masked text;
alter table public.models add column if not exists national_id_type   text;  -- rrn|arc|passport
alter table public.models add column if not exists address            text;

create table if not exists public.model_secure_id (
  model_id   text primary key references public.models(id) on delete cascade,
  agency_id  text,
  id_type    text not null check (id_type in ('rrn','arc','passport')),
  id_enc     bytea not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.model_secure_id enable row level security;
revoke all on public.model_secure_id from anon, authenticated;

create table if not exists public.secure_id_access_log (
  id bigint generated always as identity primary key,
  model_id text, agency_id text, accessed_by uuid, action text, at timestamptz not null default now()
);
alter table public.secure_id_access_log enable row level security;
revoke all on public.secure_id_access_log from anon, authenticated;

create or replace function public._mask_national_id(p_type text, p_plain text)
returns text language plpgsql immutable as $$
declare d text;
begin
  if p_type in ('rrn','arc') then
    d := regexp_replace(p_plain, '\D', '', 'g');
    if length(d) < 7 then return repeat('*', greatest(length(d),1)); end if;
    return substr(d,1,6) || '-' || substr(d,7,1) || '******';
  else
    if length(p_plain) <= 2 then return repeat('*', length(p_plain)); end if;
    return substr(p_plain,1,2) || repeat('*', length(p_plain)-2);
  end if;
end $$;

create or replace function public.set_model_national_id(p_model_id text, p_id_type text, p_id_plain text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_agency text; v_key text; v_masked text;
begin
  if p_id_type not in ('rrn','arc','passport') then raise exception 'invalid id_type'; end if;
  if coalesce(trim(p_id_plain),'') = '' then raise exception 'empty id'; end if;
  select m.agency_id into v_agency from models m join agencies a on a.id=m.agency_id
   where m.id=p_model_id and a.owner_id::text = auth.uid()::text;
  if v_agency is null then raise exception 'not authorized'; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name='model_id_enc_key';
  v_masked := public._mask_national_id(p_id_type, p_id_plain);
  insert into model_secure_id(model_id,agency_id,id_type,id_enc,updated_by,updated_at)
  values (p_model_id,v_agency,p_id_type,extensions.pgp_sym_encrypt(p_id_plain,v_key),auth.uid(),now())
  on conflict (model_id) do update set id_type=excluded.id_type,id_enc=excluded.id_enc,
    agency_id=excluded.agency_id,updated_by=excluded.updated_by,updated_at=now();
  update models set national_id_masked=v_masked, national_id_type=p_id_type where id=p_model_id;
  insert into secure_id_access_log(model_id,agency_id,accessed_by,action) values (p_model_id,v_agency,auth.uid(),'write');
  return v_masked;
end $$;

create or replace function public.get_model_national_id(p_model_id text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_agency text; v_key text; v_plain text;
begin
  select m.agency_id into v_agency from models m join agencies a on a.id=m.agency_id
   where m.id=p_model_id and a.owner_id::text = auth.uid()::text;
  if v_agency is null then raise exception 'not authorized'; end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name='model_id_enc_key';
  select extensions.pgp_sym_decrypt(id_enc,v_key) into v_plain from model_secure_id where model_id=p_model_id;
  insert into secure_id_access_log(model_id,agency_id,accessed_by,action) values (p_model_id,v_agency,auth.uid(),'reveal');
  return v_plain;
end $$;

revoke all on function public.set_model_national_id(text,text,text) from public, anon;
revoke all on function public.get_model_national_id(text) from public, anon;
grant execute on function public.set_model_national_id(text,text,text) to authenticated;
grant execute on function public.get_model_national_id(text) to authenticated;
