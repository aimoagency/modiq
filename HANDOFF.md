# Modiq 작업 인수인계 노트

> 최종 업데이트: 2026-06-15 · 브랜치: `feature/package`
> 이 파일 하나만 열면 현재 상태 → 다음 할 일까지 파악됩니다.

---

## 0. 다른 PC에서 이어가기 (회사 등)

1. **GitHub Desktop으로 `feature/package` Push** (집 PC에서 먼저!)
2. 회사 PC에서 repo **Pull/Clone** → Cowork에서 그 폴더를 작업 폴더로 선택
3. 아래 "미실행 가능 SQL" 중 Supabase에 안 돌린 게 있으면 SQL Editor에서 실행
4. 새 대화에서 "feature/package 브랜치 modiq 이어가자"라고 하면 됨 (코드가 진실의 원천)

- DB(Supabase)·이메일/구글연동 시크릿은 클라우드라 PC 무관하게 동일
- 작업 폴더는 로컬이라 PC마다 git으로 동기화 필요

---

## 1. 핵심 구조 요약

- **스택**: React + TypeScript + Vite + Supabase(REST + Edge Functions) / 멀티테넌트(에이전시별)
- **메인 파일**: `src/App.tsx` (대부분 상태·모달), 뷰는 `src/views/`, 계산 로직은 `src/lib/utils.ts`
- **빌드 검증**: `npx tsc --noEmit` (배포 전 항상 통과 확인)
- **커밋 주의**: FUSE 마운트라 `.git/*.lock` unlink 경고 발생 → 무시 가능. Push는 GitHub Desktop으로 수동.

### 정산 로직 (현재 확정 버전)
- **모델료**: 모델별 `fee_day`(9h) / `fee_half`(5h) / `fee_hour`(1h)
- **세션 자동판정**: 섭외 시간 ≤5h → Half, 6h~ → Day (Hour는 입력만, 자동적용 안 함 — 기준 미정)
- **정산방식(payout_pay_type)**: `rate`(비율) / `fixed`(정액), 값은 세션별(`payout_day/half/hour_value`)
  - 비율: 모델료(세션) × 비율% = 모델 정산 기준액
  - 정액: 입력 정액 그대로 (모델료·수식 무관)
- **세무유형**: 외국인(비자율 E-6 3.3% / C-4·기타 20%, `tax_rate`) / 프리랜서 3.3% / 소속사 +10% 계산서
- **매출총이익 = 매출(공급가) − 모델 정산 기준액** (모델지급액 제외). 영업이익은 미구현(월 고정비 미반영)

---

## 2. 최근 완료 작업 (최신순)

- 이익 명칭 **매출총이익** 통일 + 섭외상세에 모델료·매출총이익 표기 + 매출 엑셀 상세화(섭외ID·계약금·잔금·모델지급·총이익 필수)
- 매출 현황/대시보드에 **매출총이익·모델지급** 카드 추가
- 사용기간 6/12/24/기타 · 단일섭외 계약금액 위 **모델료 표기** · **명세서 A4 1장 맞춤**
- 정산방식 값 **Day/Half/Hour 분리** · 모델수정 헤더 **캘린더/스튜디오 버튼** · **패키지 클릭 시 생성화면 열기**
- 모델 리스트·상세·컴카드·패키지에서 **성별(gender) 표기 버그 수정**(모델타입 오표기 → 성별)
- 모델료(Day/Half/Hour) 신설 · 외국인 세무유형 비자율 라벨 · 비자 버튼 가로배열
- 외국인 모델 등록(비자·정산 팝업) · 설정 **소유권 이전 → 권한 부여(공동 대표)**
- modiq ID 체계 · 노션 사용 매뉴얼/Q&A/채널톡 자료 작성

---

## 3. 미실행 가능 SQL (Supabase SQL Editor에서 확인 후 실행)

해당 기능을 쓰는데 컬럼이 없다는 에러가 나면 아직 안 돌린 것:

- `supabase/model_fee_setup.sql` — 모델료 fee_day/half/hour
- `supabase/payout_session_value_setup.sql` — 정산방식 세션값 payout_day/half/hour_value
- `supabase/foreign_model_setup.sql` — 외국인 visa_type/has_alien_card/payment_method/payment_detail/tax_rate
- `supabase/id_system_setup.sql` — agency_no, models.gender/nationality_type
- (이미 적용했을 가능성 높음) model_offs / model_profile / packages / payout_dayhalf

---

## 4. 다음 할 일 후보 (우선순위)

1. **구글 캘린더 자동 동기화 3단계** — 확정/변경/취소 시 자동 반영 (현재는 "일정 보내기" 수동 1회)
2. **긴급 버그**: 알림톡 `alimtalk.ts` x-fn-secret 헤더 누락 / 섭외 편집폼에서 `result_drive_url` 수정 불가
3. **App.tsx 컴포넌트 분리 리팩터링** (voucher.ts, 모달/폼 추출 — 파일이 매우 큼)
4. **Hour 세션 자동적용 기준** 정의 (몇 시간 이하를 Hour로 볼지)
5. **영업이익 단계** — 설정에 월 고정비(판관비) 입력 → 매출총이익 → 영업이익 표시
6. 체류 만료 알림(D-30/D-7/D-0) · 외국인 서류 업로드 · Solapi 정산 알림

---

## 5. 운영 메모

- 이메일: Resend `email-send` Edge Function (시크릿 RESEND_API_KEY/EMAIL_FROM/FN_SHARED_SECRET, Verify JWT OFF)
- 구글: 에이전시별 OAuth(`gcal-oauth`/`gcal-sync`), 회사정보의 구글 계정 연동 1회
- 권한: 대표(owner)만 설정·담당자·재무 노출 / 재무 열람 권한은 별도 부여 가능
