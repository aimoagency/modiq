# Modiq 개발 문서 (v1.0.0)

> 탤런트(모델) 관리 OS — 에이전시 운영 SaaS
> 스택: React + TypeScript + Vite / Supabase(REST + Storage + Edge Functions) / 멀티테넌트(에이전시별)

---

## 1. 개요

Modiq는 모델 에이전시가 **모델·고객사·섭외·정산·캘린더**를 한 곳에서 운영하는 멀티테넌트 SaaS다.
모든 데이터는 `agency_id`로 격리되며, 사용자는 에이전시에 소속되어 권한(owner / member)에 따라 기능을 사용한다.

- 클라이언트: SPA (React 18 + TS). 라우팅은 자체 `page` 상태 + 일부 쿼리 라우트(`?share`, `?sub`, `?cal`).
- 서버: Supabase. DB는 PostgREST(`/rest/v1`)로 직접 호출, 파일은 Storage, 서버 로직은 Edge Functions(Deno).
- 인증: Supabase Auth(이메일/비밀번호). access/refresh 토큰을 프론트에서 보관하고 만료 시 1회 자동 갱신.

---

## 2. 빠른 시작

```bash
npm install      # 최초 1회
npm run dev      # http://localhost:5173
npm run build    # tsc -b + vite build → dist/
npm run typecheck # 타입 검사만 (배포 전 항상 통과 확인)
npm run preview  # 빌드 결과 미리보기
```

**배포**: GitHub Desktop에서 작업 브랜치 Push → 호스팅(stack) 자동 재빌드.

---

## 3. 디렉터리 구조

```
src/
├── main.tsx              # React 마운트 진입점
├── App.tsx               # 앱 전체 셸: 상태·인증·데이터 로드·모달·라우팅 (대형 파일)
├── constants.ts          # APP_VERSION, 요금제, 상태/타입, 분야·국가 등 모든 상수
├── theme.ts              # 색상(C), 공통 인풋/버튼 스타일
├── components/           # 재사용 UI
│   ├── ModelBrowser.tsx        # 좌측 검색 사이드바(필터+리스트). 스튜디오/패키지 공용
│   ├── CompCardModal.tsx       # 컴카드(A4 가로) 생성·미리보기
│   ├── SettlementStatementModal.tsx  # 정산 명세서(A4)
│   ├── BulkUploadModal.tsx     # 모델/고객사 일괄 등록(엑셀)
│   ├── CategorySelect, MultiCheck, MoneyInput, TimePicker, ...  # 입력 컨트롤
│   └── icons.tsx, Badge, Modal, CloseButton, TypeIcon
├── views/                # 페이지 단위 화면
│   ├── DashboardView         # 대시보드(통계·신규 문의·이번 주 섭외)
│   ├── ModelsView            # 모델 리스트/등록
│   ├── ModelStudioView       # 포트폴리오(사진 등록·갤러리·컴카드 진입)
│   ├── ModelSearchView       # 조건 검색(성별·신체·분야·모델료)
│   ├── PackagesView / PackagePublicView  # 모델 제안 패키지(편집 / 공개 공유)
│   ├── BookingsView          # 섭외 리스트
│   ├── CalendarView / CalendarAddView    # 캘린더, 일정/휴무 등록
│   ├── CalSubscribeView      # 모델 캘린더 구독 안내 페이지(?sub)
│   ├── SettlementView / RevenueView      # 정산 / 매출 현황
│   ├── CustomersView, MembersView, CompanyView, PlanView
│   └── RevenueRanking (component)
└── lib/                  # 도메인 로직·외부 연동
    ├── supabase.ts       # REST 클라이언트(sb), Storage(sbUpload), thumbUrl, 토큰/세션
    ├── utils.ts          # 정산·세션 판정·나이 계산 등 핵심 계산 로직
    ├── packages.ts       # 패키지 타입·ID·공유 토큰·공유 URL
    ├── calendar.ts       # .ics 생성, 구독 링크
    ├── gcal.ts           # 구글 캘린더 OAuth/동기화 호출
    ├── email.ts          # 이메일(Resend Edge Function) 호출
    ├── alimtalk.ts       # 카카오 알림톡(Solapi Edge Function) 호출 + 본문 빌더
    ├── ocr.ts            # 사업자등록증 OCR(extract-business-info)
    ├── xlsx.ts           # 엑셀 다운로드/파싱
    ├── ids.ts            # modiq ID 체계
    └── useIsMobile.ts    # 반응형 훅
```

`.versions/` 에 원본 스냅샷 백업이 있어 `src/App.tsx`가 손상돼도 복원 가능. 프로젝트는 WebContainer에 의존하지 않는 독립 폴더다.

---

## 4. 데이터 모델 (Supabase / Postgres)

모든 업무 테이블에 **`agency_id`** 가 있고 데이터는 에이전시별로 격리된다.

| 테이블 | 용도 | 핵심 컬럼 |
|---|---|---|
| `agencies` | 에이전시(테넌트) | `id`, `name`, `plan`, `rep_phone`(알림톡 fallback) |
| `agency_members` | 소속 멤버·권한 | `agency_id`, `user_id`, `role`(owner/member), `name`, `phone`, 재무열람 권한 |
| `models` | 모델 프로필·포트폴리오 | 아래 표 참고 |
| `customers` | 고객사 | `name`, `industry`, `category`, 담당자, 입금 정보 |
| `bookings` | 섭외(촬영/미팅/피팅/오디션) | `status`, `booking_type`, `model_id`, `customer_id`, `shoot_date`, 정산 필드 |
| `projects` | 섭외 묶음(프로젝트) | 모델↔고객사 양방향 추적 |
| `packages` | 모델 제안 패키지 | `items`(모델 스냅샷 배열), `share_token`, `is_public` |
| `model_offs` | 모델 기간 휴무 | `model_id`, `start_date`, `end_date`, `reason` |

### models 주요 컬럼

- 기본: `name`, `gender`(F/M), `category`(키즈/주니어/성인/시니어/플러스사이즈), `ssn6`(생년월일6자리→나이), `phone`, `email`
- 신체: `height`, `shoe`, `bust`/`waist`/`hip`, `hair_length`, `eye_color`, `tattoo`, `underwear_ok`
- 활동: `fields`(복수: 모델/배우/가수…), `specialty`, `instagram_followers`
- 외국인: `is_foreigner`, `country`, `visa_type`, `visa_entry`/`visa_exit`, `has_alien_card`, `tax_rate`
- 사진: `photos`(Storage URL 배열, 최대 30), `liked_photos`, `thumb_url`(대표 썸네일), `compcard`(슬롯 jsonb)
- 모델료: `fee_day`(9h) / `fee_half`(5h) / `fee_hour`(1h)
- 정산방식: `payout_pay_type`(rate/fixed), `payout_day_value`/`payout_half_value`/`payout_hour_value`
- 연동: `cal_token`(캘린더 구독 토큰)

### 마이그레이션 SQL

`supabase/*.sql` 에 기능별 증분 마이그레이션이 분리돼 있다. 해당 기능에서 "컬럼 없음" 에러가 나면 미실행 상태:

`model_fee_setup` · `payout_session_value_setup` · `payout_dayhalf_setup` · `foreign_model_setup` · `id_system_setup` · `model_offs_setup` · `packages_setup` · `model_profile_setup` · `customers_biz_fields_setup`

> ⚠️ RLS 사용 시 새 테이블에는 기존 테이블과 동일한 에이전시 격리 정책을 반드시 추가한다.

---

## 5. 섭외 상태 & 타입 (constants.ts)

**상태(`STATUS`)**: `INQUIRY`(문의접수) → `PROPOSED`(모델제안) → `SELECTING`(선택대기) → `CHECKING`(스케줄확인) → `HOLD` → `CONFIRMED`(섭외확정) → `COMPLETED`(촬영완료) → `SETTLED`(정산완료) / `CANCELLED`(취소)

**타입(`BOOKING_TYPES`)**: `SHOOT`(촬영, 계약 있음) · `MEETING`(실물미팅) · `FITTING`(피팅) · `AUDITION`(오디션)

> 비촬영 타입(미팅·피팅·오디션)은 `statusLabelForType`/`statusOptionsForType`로 **요청→확정→완료 3단계**로 단순화해 표시한다.

---

## 6. 정산 로직 (lib/utils.ts — 확정 버전)

- **모델료**: 모델별 `fee_day`(9h) / `fee_half`(5h) / `fee_hour`(1h)
- **세션 자동판정**: 섭외 시간 ≤5h → Half, 6h↑ → Day. (Hour는 입력만 받고 자동 적용 안 함)
- **정산방식(`payout_pay_type`)**
  - `rate`(비율): 모델료(세션) × 비율% = 모델 정산 기준액
  - `fixed`(정액): 입력 정액 그대로(모델료·수식 무관)
- **세무유형**: 외국인(E-6 3.3% / C-4·기타 20%, `tax_rate`) · 프리랜서 3.3% · 소속사 +10% 계산서
- **매출총이익 = 매출(공급가) − 모델 정산 기준액** (모델지급액 제외)
- 영업이익(월 고정비 반영)은 **미구현** — 로드맵 참고

> 금액은 원 단위 정수로 다룬다. 정산·세무 계산을 수정할 때는 명세서(`SettlementStatementModal`)와 매출 엑셀 출력을 함께 검증한다.

---

## 7. 백엔드 — Edge Functions (Deno)

| 함수 | 역할 | 시크릿 / 비고 |
|---|---|---|
| `email-send` | Resend로 이메일 발송(.ics 첨부 등) | `RESEND_API_KEY`, `EMAIL_FROM`, `FN_SHARED_SECRET` / Verify JWT **OFF** |
| `cal-feed` | 모델 캘린더 구독 피드(확정 일정 자동 반영) | SERVICE_ROLE 기본 / Verify JWT **OFF** |
| `gcal-oauth` / `gcal-sync` | 에이전시별 구글 캘린더 OAuth·동기화 | 회사정보에서 구글 계정 1회 연동 |
| `solapi-send` | 카카오 알림톡(4종) 발송 | Solapi API 키는 함수 시크릿에 보관 |
| `extract-business-info` | 사업자등록증 OCR | 회사정보 등록 시 |

**프론트는 외부 API 키를 절대 직접 들지 않는다.** 알림톡/이메일은 Edge Function 경유. `VITE_SOLAPI_FN_URL` 미설정 시 `sendAlimtalk`은 콘솔 로그만 남기는 no-op(앱 안전).

### 환경변수(.env, 선택 — 기본값 내장)

```
VITE_EMAIL_FN_URL=https://<project>.supabase.co/functions/v1/email-send
VITE_EMAIL_FN_SECRET=<FN_SHARED_SECRET>
VITE_SOLAPI_FN_URL=https://<project>.supabase.co/functions/v1/solapi-send
```

> ⚠️ 현재 Supabase URL/anon key는 `src/lib/supabase.ts`에 하드코딩(공개 가능한 anon key). 실고객 데이터 투입 전 **RLS 점검 필수**, 키는 `.env`(`VITE_SUPABASE_URL`/`VITE_SUPABASE_KEY`)로 분리 권장.

---

## 8. 이미지 / 성능

- 사진 업로드: 원본을 1200px로 리사이즈 → Storage 업로드, 동시에 360px `_thumb` 생성.
- 목록/카드/아바타는 `thumbUrl()`로 `_thumb`을 받고 실패 시 원본으로 폴백. `loading="lazy"`로 화면 밖은 미로드.
- 레거시(base64 DB 저장 / 썸네일 없는) 사진은 포트폴리오 우상단 **"썸네일 생성"·"저장소로 이전"** 버튼으로 1회 정리(멱등).
- v1.0.0에서 좌측 모델 리스트·검색 카드가 원본을 받던 문제를 수정(썸네일 사용)해 갤러리 클릭 로딩을 개선.

---

## 9. 코드 컨벤션

- 함수형 컴포넌트 + Hooks, `async/await`.
- 데이터 접근은 `lib/supabase.ts`의 `sb(table, method, body, query)` 단일 진입점 사용.
- 모달·폼 상태는 대부분 `App.tsx`에 집중(추후 분리 대상).
- 배포 전 `npx tsc --noEmit` 통과 필수.

---

## 10. 알려진 이슈 · 로드맵

**긴급/버그**
- `alimtalk.ts` `x-fn-secret` 헤더 누락 점검
- 섭외 편집폼에서 `result_drive_url` 수정 불가

**리팩터링**
- `App.tsx` 대형 → 모달/폼/voucher 로직 추출
- Supabase 키 `.env` 분리 + RLS 정책 정비

**기능 로드맵**
1. 구글 캘린더 3단계 자동 동기화(확정/변경/취소 자동)
2. Hour 세션 자동적용 기준 정의
3. 영업이익 단계(월 고정비 입력 → 매출총이익 → 영업이익)
4. 체류 만료 알림(D-30/7/0) · 외국인 서류 업로드
5. 공개 섭외 요청폼(네이티브) · 세금계산서 자동화(팝빌/바로빌)

---

## 11. 다른 PC에서 이어가기

1. 작업 브랜치 Push(현재 PC) → 다른 PC에서 Pull/Clone
2. 미실행 마이그레이션 SQL 확인 후 Supabase SQL Editor에서 실행
3. DB·시크릿은 클라우드라 PC 무관 동일. 작업 폴더만 git으로 동기화.
