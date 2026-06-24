-- 모델 삭제 시 섭외(bookings) 보존 + model_id만 NULL → 앱에서 '?'로 표시 (handleDeleteModel 설계 의도와 일치).
--
-- 배경: bookings_model_id_fkey 가 NO ACTION 이라 섭외 이력이 있는 모델은 삭제가 막혔다
--       (FK 위반: "Key is still referenced from table bookings").
--       bookings.model_id 는 이미 nullable 이므로 ON DELETE SET NULL 로 바꾸면
--       섭외/매출 이력은 보존되고 모델 연결만 끊겨 '?'로 표시된다.
--       (정산/매출/목록 화면은 모두 모델 미존재 시 안전 폴백 — 옵셔널 체이닝/'?'/0 기본값)
--
-- 적용: Supabase SQL editor 또는 마이그레이션으로 1회 실행. (운영 DB에 이미 적용됨)

ALTER TABLE public.bookings DROP CONSTRAINT bookings_model_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_model_id_fkey
  FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE SET NULL;
