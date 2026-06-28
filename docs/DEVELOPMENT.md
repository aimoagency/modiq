# Modiq 개발 문서 (v1.3.0)

> 탤런트(모델) 관리 OS — 에이전시 운영 SaaS
> 스택: React + TypeScript + Vite / Supabase(REST + Storage + Edge Functions) / 멀티테넌트(에이전시별)
> 버전: **v1.3.0** · 갱신일: 2026-06-28 · 대상: 개발자/유지보수자

### v1.3.0 변경 요약(헤드라인)
1. **Material 3(Material You) 디자인** — 색 팔레트(딥블루 primary·라임 액센트)·pill 버튼·M3 토큰(`theme.ts shape/elev`)·CSS 변수 토큰(`--c-primary` 등, `App.tsx`).
2. **영상 첨부** — 포트폴리오·패키지에 유튜브/비메오/인스타/틱톡 임베드(`lib/video.ts`, `models.videos` jsonb).
3. **발송(Distribution) V4 — 대대행 편입** — A가 보낸 모델을 B가 "내 모델로 등록" 시 소속사(company) 고정 편입(`talent_distribution_v4_subagency.sql`).
4. **요금제 v3.0** — Starter/Pro/Team(BEST)/Enterprise 4티어 + 14일 Trial(`constants.ts` PLANS).
5. **리스트(엑셀형 표) 정렬 통일** — 섭외 목록 공용 컴포넌트(`components/BookingsList.tsx`) + `docs/LIST_ALIGNMENT.md` 고정 규칙.

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
├── constants.ts          # APP_VERSION, 요금제(PLANS·PLAN_FEATURES·PLAN_MATRIX·PLAN_TRIAL), 상태/타입, FEATURE_DISTRIBUTION 등 모든 상수
├── theme.ts              # M3 토큰: 색상(C, CSS변수 매핑) + shape/elev + inp/btnS 공통 스타일
├── components/           # 재사용 UI
│   ├── BookingsList.tsx        # 섭외 목록 공용 컴포넌트(섭외·대시보드 진행중섭외·신규문의 동일 렌더) — LIST_ALIGNMENT 규칙
│   ├── ModelBrowser.tsx        # 좌측 검색 사이드바(필터+리스트). 스튜디오/패키지 공용
│   ├── CompCardModal.tsx       # 컴카드(A4 가로) 생성·미리보기
│   ├── SettlementStatementModal.tsx  # 정산 내역서 + 모델 발급 서류(원천징수/거래명세서)
│   ├── ClientStatementModal.tsx      # 매출 거래명세서/청구(고객사, 프로젝트별/월합산, 미수)
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
    ├── withholdingStatement.ts  # 원천징수 내역서 + 소속사 거래명세서(매입) HTML, 인쇄
    ├── clientStatement.ts       # 매출 거래명세서(고객사) HTML 생성
    ├── packages.ts       # 패키지 타입·ID·공유 토큰·공유 URL
    ├── video.ts          # 영상 임베드(YouTube/Vimeo/Instagram/TikTok) 파싱·oEmbed 보강(VideoRef)
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
| `bookings` | 섭외(촬영/미팅/피팅/오디션) | `status`, `booking_type`, `model_id`, `customer_id`, `shoot_date`, 정산 필드, `gcal_event_id`, `model_response`/`model_responded_at`/`model_resp_token`(수락형) |
| `projects` | 섭외 묶음(프로젝트) | 모델↔고객사 양방향 추적 |
| `packages` | 모델 제안 패키지 | `items`(모델 스냅샷 배열), `share_token`, `is_public` |
| `model_offs` | 모델 기간 휴무 | `model_id`, `start_date`, `end_date`, `reason` |

### models 주요 컬럼

- 기본: `name`, `gender`(F/M), `category`(키즈/주니어/성인/시니어/플러스사이즈), `ssn6`(생년월일6자리 YYMMDD→나이), `phone`, `email`
- 신체: `height`, `shoe`, `bust`/`waist`/`hip`(저장은 cm, 화면 표기는 inch 변환), `hair_length`, `eye_color`, `tattoo`, `underwear_ok`
- 활동: `fields`(복수: 모델/배우/가수…), `specialty`, `instagram_followers`
- 외국인: `is_foreigner`, `country`, `visa_type`, `visa_entry`/`visa_exit`, `has_alien_card`, `tax_rate`, `pay_method`/`pay_detail`(지급 방식) — [비자·정산 정보] 모달에서 일괄 입력
- 세무 식별(대표·정산권한자 전용): `address`, `national_id_masked`(마스킹 표시값), `national_id_type`(rrn/arc/passport). 평문은 DB에 직접 저장하지 않고 `set_model_national_id`/`get_model_national_id` RPC로 **암호화 저장·복호화**, 복호화 접근은 `secure_id_access_log`에 감사 기록.
- 세무유형: `payout_tax_type`(freelancer/foreigner/company) · 소속사: `agency_name`/`agency_biz_no`/`agency_contact`/`agency_phone`/`agency_email`
- 사진: `photos`(Storage URL 배열, 최대 30), `liked_photos`, `thumb_url`(대표 썸네일), `compcard`(슬롯 jsonb)
- 영상(v1.3): `videos`(jsonb 배열, `VideoRef[]` — provider/id/url/embed/thumb/title/vertical). 포트폴리오·패키지에서 외부 링크 임베드(`lib/video.ts`)
- 모델료: `fee_day`(9h) / `fee_half`(5h) / `fee_hour`(1h)
- 정산방식: `payout_pay_type`(rate/fixed), `payout_day_value`/`payout_half_value`/`payout_hour_value`
- 출처(발송 V4 편입, v1.3): `source_agency_id`/`source_agency_name`/`source_distribution_id`/`source_model_id`(모두 TEXT — A 업체에서 편입 시 자동 기록, 모델목록 '출처' 필터·'대대행' 배지)
- 연동: `cal_token`(캘린더 구독 토큰)

### 마이그레이션 SQL

`supabase/*.sql` 에 기능별 증분 마이그레이션이 분리돼 있다. 해당 기능에서 "컬럼 없음" 에러가 나면 미실행 상태:

| 영역 | SQL 파일 |
|---|---|
| 모델료/정산 | `model_fee_setup` · `payout_session_value_setup` · `payout_dayhalf_setup` |
| 외국인/세무 | `foreign_model_setup` · `id_system_setup` · `model_national_id_secure`(암호화 RPC·감사로그) |
| 모델/휴무/패키지 | `model_offs_setup` · `packages_setup` · `model_profile_setup` · `model_birth_year_setup` · `birth_year_backfill` · `package_item_count_setup` |
| 고객사 | `customers_biz_fields_setup` |
| 발송(Distribution) | `talent_distribution_shared_schedule` · `talent_distribution_lookup_rpcs` · `talent_distribution_rls_fix` · **`talent_distribution_v4_subagency`(V4 대대행 — 미적용 시 발송·편입·회사설정 저장 실패)** |
| RLS/FK/어드민 | `rls_tenant_isolation_fix` · `bookings_model_fk_set_null` · `admin_setup` · `admin_agency_members` · `admin_delete_tenant` |

> 📌 **영상(v1.3)**: `alter table public.models add column if not exists videos jsonb;` (별도 파일 없을 수 있음 — 위 1줄 직접 실행). 패키지 영상은 `packages.items[].videos`(jsonb 내부).
> ⚠️ RLS 사용 시 새 테이블에는 기존 테이블과 동일한 에이전시 격리 정책을 반드시 추가한다.
> ⚠️ 모든 `*_setup`/`v4`류는 `add column if not exists`라 **재실행 안전**. 기능에서 "컬럼 없음" 에러가 나면 미실행 상태이니 Supabase SQL Editor에서 실행.

---

## 4-1. Material 3 디자인 토큰 (v1.3)

Material You 팔레트를 **CSS 변수**로 정의하고 `theme.ts`가 이를 감싸 인라인 스타일에 노출한다.

**CSS 변수 토큰** (`App.tsx` 글로벌 `<style>`, `:root`=다크 / `html.light`=라이트):

| 토큰 | 다크 | 라이트 | 용도 |
|---|---|---|---|
| `--c-primary` | `#2E5FE0` | `#1D4ED8` | M3 primary(딥블루). 버튼·포커스 테두리·사이드 활성 |
| `--c-on-primary` | `#FFFFFF` | `#FFFFFF` | primary 위 글자색 |
| `--c-primary-container` | `#15336E` | `#DCE6FF` | 모바일 탭바 활성 알약 배경 |
| `--c-on-primary-container` | `#BBD0FF` | `#1D4ED8` | 그 위 아이콘색 |
| `--c-accent` | `#e4fc3f`(라임) | `#7d9400` | 사이드바 좌측 활성 바·워드마크 "m"(다크) |
| `--c-bg/-card/-card2/-border/-text/-text-sub/-muted` | 딥 차콜 계열 | 화이트 계열 | 표면·텍스트 중립색 |
| `--c-sidebar/-side-hover/-nav-active` | — | — | 사이드바 배경/호버/활성 |

**`theme.ts` 토큰/스타일**:
- `C` — 위 CSS 변수를 키로 매핑(예: `C.blue="var(--c-primary)"`). **키 이름은 기존 인라인 호출 호환을 위해 유지**(`blue`가 primary). `purple/green/red/yellow/orange`는 시맨틱 상태색(유지).
- `shape` = `{ xs:4, sm:8, md:12, lg:16, xl:28, full:9999 }` — M3 모서리. 버튼은 `full`(stadium/pill), 입력창은 `sm`.
- `elev` = `{1,2,3}` — M3 elevation 그림자 3단계.
- `inp` — M3 text field(둥근 모서리·`12px 14px` 패딩, 포커스 시 `--c-primary` 테두리는 글로벌 `input:focus` 규칙).
- `btnS(bg, disabled)` — pill 버튼. primary(`C.blue`)면 `--c-on-primary` 글자, 그 외 white.

워드마크 "m" 액센트: 라이트=블랙(`#111`), 다크=라임 액센트(사용자 지정: 라이트=최소 컬러·블랙 로고).

> 🔒 디자인 토큰·부팅 스플래시·대시보드 로딩 보호 영역은 `CLAUDE.md` 기준 유지. 임의 변경 금지.

## 4-2. 영상(비디오) 임베드 (v1.3 · `lib/video.ts`)

포트폴리오(모델)·패키지에 외부 영상 링크를 첨부해 임베드한다. **자사 저장·대역폭 0**(외부 임베드, Phase 1).

- 지원: **YouTube**(watch/youtu.be/shorts/embed/live), **Vimeo**, **Instagram**(reel/reels/p/tv), **TikTok**(전체 URL — `vm.tiktok.com` 단축링크 불가).
- `parseVideoUrl(raw) → VideoRef|null` — URL을 `{provider,id,url,embed,thumb,title?,vertical?}`로 정규화. 인식 못 하면 `null`.
  - 세로(9:16) 자동: 유튜브 shorts·인스타 reel·틱톡은 `vertical:true`.
  - 썸네일: 유튜브는 `img.youtube.com/.../hqdefault.jpg`, Vimeo/TikTok은 빈 값 → `enrichVideo`로 보강.
- `enrichVideo(v) → Promise<VideoRef>` — Vimeo·TikTok 공개 oEmbed 1회 조회로 `thumb/title/vertical` 보강(CORS/실패 시 원본 유지·임베드는 정상). 인스타는 토큰 필요 → 임베드 카드가 자체 표시.
- 저장: `models.videos`(jsonb `VideoRef[]`), 패키지는 `packages.items[].videos`. 라이트박스 재생.

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
- **세무유형(`modelTaxType`)**: 외국인(E-6 3.3% / C-4·기타 20%, `tax_rate`) · 프리랜서 3.3% · 소속사 +10% 계산서
  - `modelWithholding`: 프리랜서=3.3% / 외국인=비자율 / **소속사=0**(원천징수 무관)
  - `modelPayout`: 프리랜서·외국인=기준액−원천징수 / **소속사=기준액×1.1**(세금계산서 +VAT)
- **발급 서류 분기**(세무유형 기준, 계산식 변경 없이 문서만 분기):
  - 정산(매입): 프리랜서·외국인 → **원천징수 내역서**(`buildWithholdingStatementHtml`, 식별번호 라벨 `modelIdLabel`) / 소속사 → **거래명세서**(`buildTransactionStatementHtml`, 공급자=소속 에이전시)
  - 매출(고객): **거래명세서**(`buildClientStatementHtml`, 공급자=당사). 청구액 `clientCharge`=공급가×1.1, 입금판정=완납이면 전체 / 아니면 계약금·잔금 입금분 합산. 프로젝트별 또는 고객사 월합산으로 묶음.
- **매출총이익 = 매출(공급가) − 모델 정산 기준액** (모델지급액 제외)
- 영업이익(월 고정비 반영)은 **미구현** — 로드맵 참고

> 금액은 원 단위 정수로 다룬다. 정산·세무 계산을 수정할 때는 명세서(`SettlementStatementModal`·`ClientStatementModal`)와 매출 엑셀 출력을 함께 검증한다. 기존 필터/수식(매출 인정 `REVENUE_STATUSES`, `clientCharge` 등)은 임의 수정 금지.

---

## 6-1. 발송(Distribution) V4 — 대대행 편입 (v1.3)

에이전시 간 모델 자료 단방향 발송 + **B가 받은 모델을 "내 모델로 등록"하면 소속사(대대행) 고정 편입**.

**흐름**
1. **A 업체(발신)**: 회사설정에 법인 정산정보를 **1회** 등록(`agencies.payout_bank_info`+`payout_tax_email`+기존 상호/사업자번호/대표/주소). 발송 시 `SendTab`이 이를 발송 본문 스냅샷 `talent_distributions.sender_payout_info`(jsonb: `company_name·biz_no·rep_name·contact·address·bank`)에 실어 보냄.
2. **B 업체(수신)**: 받은 모델을 "내 모델로 등록" → **`payout_tax_type="company"`(소속사) 고정** 편입(프리랜서/외국인 변경 불가·외국인 토글 숨김). A 업체정보(`agency_name/agency_biz_no/agency_contact/agency_phone/bank_info`)는 위 스냅샷에서 **자동 입력**. B는 모델별 **마진(공급가 `fee_*` · 기준액 `payout_*_value`)만** 입력.
3. **출처 자동 기록**: `models.source_agency_id/source_agency_name/source_distribution_id/source_model_id`(TEXT). 모델목록 '출처' 필터 + '대대행' 배지.
4. **정산**: 기존 소속사 계산(`modelPayout=기준액×1.1`)을 **"A 지급액 (○○ 대대행)"** 으로 표기(집행은 수동). **계산식 신규 생성 금지 — 기존 company 경로 재사용.** 발급 서류=거래명세서(공급가+VAT10%, 세금계산서는 소속 에이전시 발행).

**스키마** — `supabase/talent_distribution_v4_subagency.sql`(전부 `add column if not exists`, 재실행 안전):

| 테이블 | 추가 컬럼 |
|---|---|
| `agencies` | `payout_bank_info`(text), `payout_tax_email`(text) |
| `talent_distributions` | `sender_payout_info`(jsonb 스냅샷) |
| `distribution_models` | `is_foreigner`(bool)·`visa_entry`·`visa_exit`(외국인 가용기간), `category`·`career_years`(numeric)·`country`·`instagram_url`(모델 스냅샷 보강) |
| `models` | `source_agency_id`·`source_agency_name`·`source_distribution_id`·`source_model_id`(모두 TEXT) + `idx_models_source_agency` 인덱스 |

> ⚠️ `agencies.id`/`talent_distributions.id`는 `AGY_...` 형식 TEXT 식별자(uuid 아님)라 source 컬럼도 **text**. 이전에 uuid로 만들었으면 SQL의 `alter ... type text` 정정문이 무손실 변환.
> ⚠️ 이 SQL 미적용 시 **발송·편입·회사설정 저장이 실패**. 코드 배포 전 반드시 적용(모델 목록 로드는 `loadData`의 `MODEL_COLS_V4`→`MODEL_COLS` 자동 폴백으로 보호됨). 발송 기능은 `FEATURE_DISTRIBUTION` 플래그(`constants.ts`)로 즉시 on/off 가능.

---

## 6-2. 요금제 v3.0 (v1.3 · `constants.ts`)

Material 카드 디자인의 4티어 + 14일 무료 Trial. **월·부가세 포함·천원 단위.**

| 플랜 | 월요금 | 기본 담당자 | 비고 |
|---|---|---|---|
| **Starter** | 78,000 | 1 | 1인 에이전시·대표 단독 |
| **Pro** | 118,000 | 3 | 대표 + 직원 1~2명 |
| **Team** (BEST) | 158,000 | 7 | 외국인 세무 정산 포함 |
| **Enterprise** | 228,000 | 15 | 온보딩 설치·교육, 초과 ₩12,000/명 |
| (Free Trial) | 0 | 3 | 14일 전 기능 체험(배너) |

- 코드: `PLANS`(카드용 4티어·`best:true`=Team), `PLAN_FEATURES`(한도·알림톡 enforcement에 직접 사용 — `baseMembers/additionalPrice/alimtalk`), `PLAN_MATRIX`(비교표 [Starter,Pro,Team,Enterprise]), `PLAN_TRIAL`(14일·3명), `getTotalMemberLimit(plan, extra)`. 화면=`views/PlanView.tsx`.
- ⚠️ **레거시 키 `standard`(baseMembers 5)는 기존 `plan="standard"` 고객 한도 보존을 위해 절대 삭제 금지.** Enterprise는 API 연동 제거·온보딩 설치/교육 포함.
- 기존 고객 전체 trial 리셋(필요 시 SQL): `update public.agencies set plan='trial', trial_ends_at=now()+interval '14 days';`

---

## 6-3. 리스트(엑셀형 표) 정렬 아키텍처 (v1.3 · `docs/LIST_ALIGNMENT.md`)

모든 목록(섭외·매출·정산·고객사·담당자·패키지·대시보드)은 **엑셀형 표**로 렌더하며, 정렬 규칙은 `docs/LIST_ALIGNMENT.md`가 단일 진실원천이다(🔒 임의 변경 금지).

**핵심 아키텍처**
1. **섭외 목록 공용화** — `src/components/BookingsList.tsx` **하나**로 **섭외 화면 / 대시보드 진행중섭외 / 신규문의**가 동일 렌더(컬럼·정렬·헤더 100% 동일, 한 곳만 고치면 셋 다 반영). props: `bookings, models, customers, isMobile, onSelect, showHeader?, emptyText?`. 신규문의는 핑크 알림 헤더만 두고 `showHeader={false}`로 사용.
2. **별개 grid 컨테이너 함정** — 헤더 행과 각 데이터 행은 **서로 다른 CSS grid 컨테이너**라 트랙 폭이 컨테이너마다 독립 계산된다. 따라서 헤더+데이터가 공유하는 GRID의 **모든 트랙은 결정적이어야 한다**: 허용=`고정 px`·`minmax(0,N fr)`, **금지=벌거벗은 `max-content`/`auto`**(헤더 글자폭 vs 데이터 배지폭이 달라져 금액·상태 제목이 셀과 어긋남).
3. **상태(배지) 컬럼=고정 88px.** `BookingsList` GRID(9컬럼): `56px 32px minmax(0,2fr) minmax(0,1.1fr) minmax(0,1.2fr) minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.1fr) 88px` = 유형·아바타·모델→고객사·프로젝트·날짜·장소·담당자·금액·상태.
4. **헤더 라벨 정렬 = 컬럼 데이터 정렬**(좌측 텍스트=좌, 금액=우, 배지=flex-end). **예외: 정산 화면 헤더는 센터.**
5. **빈칸은 빈 슬롯 유지**(`""` span), **금액은 잘림 금지**(우측 정렬·`nowrap`·필요 시 `minmax(max-content,fr)`).

> 화면별 GRID 현재값은 `docs/LIST_ALIGNMENT.md` 6절 표 참조(매출·정산·고객사·담당자·패키지·대시보드 입금확인).

---

## 7. 백엔드 — Edge Functions (Deno)

| 함수 | 역할 | 시크릿 / 비고 |
|---|---|---|
| `email-send` | Resend로 이메일 발송(.ics 첨부). 발신=`EMAIL_FROM`(modiq), 회신=`replyTo`(에이전시) | `RESEND_API_KEY`, `EMAIL_FROM`, `FN_SHARED_SECRET` / Verify JWT **OFF** |
| `cal-feed` | 모델 캘린더 구독 피드(확정 일정 자동 반영) | SERVICE_ROLE 기본 / Verify JWT **OFF** |
| `gcal-oauth` / `gcal-sync` | 에이전시별 구글 캘린더 OAuth·동기화 | 회사정보에서 구글 계정 1회 연동 |
| `booking-respond` | 섭외 초대 **수락/거절 공개 페이지** → 수락 시 `gcal-sync` 호출(캘린더 생성·모델 초대)·`.ics`/구글추가 제공, 거절 시 에이전시 알림 | SERVICE_ROLE 기본 / Verify JWT **OFF**. `?id&token`(`model_resp_token`) 검증 |
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

- 사진 업로드: 원본을 **긴 변 1500px(품질 0.8)** 로 리사이즈 → Storage 업로드, 동시에 **480px `_thumb`**(갤러리·공유 화면용) 생성. 목록/아바타용 대표 썸네일은 **150px**(`thumb_url`).
- 목록/카드/아바타는 `thumb_url`/`thumbUrl()`로 작은 썸네일을 받고 실패 시 원본으로 폴백. `loading="lazy"`로 화면 밖은 미로드. 대형 목록은 IntersectionObserver 기반 증분 렌더(`useVisibleCount`)로 1000명 규모 대응.
- 레거시(base64 DB 저장 / 썸네일 없는) 사진은 포트폴리오 우상단 **"썸네일 생성"·"저장소로 이전"** 버튼으로 1회 정리(멱등).
- v1.0.0에서 좌측 리스트·검색 카드가 원본을 받던 문제를 썸네일 사용으로 수정, v1.1.0에서 썸네일을 Storage URL(150/480px)로 전환·품질 0.8로 상향(공유 화면 선명도).

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
0. ~~구글 캘린더 자동 동기화~~ → **v1.2.0 반영**: 수락형 흐름(확정→초대 메일→모델 수락 시 캘린더 생성, 수락 후 변경 갱신·취소 삭제). 메일 발신=modiq·회신=에이전시.
0-1. ~~Material 3 디자인 / 영상 첨부 / 발송 V4 대대행 / 요금제 v3.0 / 리스트 정렬 통일~~ → **v1.3.0 반영**(위 변경 요약·4-1/4-2/6-1/6-2/6-3 참조).
1. 모델 수락률/응답 현황 집계(대시보드)
2. Hour 세션 자동적용 기준 정의
3. 영업이익 단계(월 고정비 입력 → 매출총이익 → 영업이익)
4. 체류 만료 알림(D-30/7/0) · 외국인 서류 업로드
5. 공개 섭외 요청폼(네이티브) · 세금계산서 자동화(팝빌/바로빌)

---

## 11. 다른 PC에서 이어가기

1. 작업 브랜치 Push(현재 PC) → 다른 PC에서 Pull/Clone
2. 미실행 마이그레이션 SQL 확인 후 Supabase SQL Editor에서 실행
3. DB·시크릿은 클라우드라 PC 무관 동일. 작업 폴더만 git으로 동기화.
