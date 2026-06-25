-- models.birth_year — 모델 출생연도(yyyy)
-- 기본정보에 입력하는 출생연도(나이 계산용). 정확한 주민번호(yymmdd-뒷자리)는
-- national_id_* 컬럼에 별도 암호화(set_model_national_id RPC)로 저장된다.
-- 주민번호를 입력하면 앞 6자리+성별숫자로 birth_year 가 자동 채워지고,
-- 출생연도만 입력해도 저장 가능하다.
alter table public.models add column if not exists birth_year integer;
comment on column public.models.birth_year is '출생연도(yyyy) — 기본정보 입력, 나이 계산용. 정확한 주민번호는 national_id_* 에 별도 암호화 저장.';
