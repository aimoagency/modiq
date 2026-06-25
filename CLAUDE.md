# CLAUDE.md — 작업 규칙

## 브랜치 / 머지 워크플로우 (중요)
- 작업은 작업 브랜치(`claude/*`)에서 진행한다.
- **변경을 완료하면 매번 지시받지 않아도 자동으로 운영까지 머지한다:**
  1. typecheck/build 검증
  2. 작업 브랜치에 커밋·푸시
  3. **작업 브랜치 → `feature/package` PR 머지**
  4. **`feature/package` → `master`(운영) PR 머지**  ← 기본값(자동)
- 즉 기본 흐름: `claude/* → feature/package → master` 까지 **자동**.
- 예외: 사용자가 "feature까지만 / master는 보류" 라고 하면 그때만 master 머지를 멈춘다.

## 머지 방식
- 기존 이력과 동일하게 **merge commit** 방식(squash/rebase 아님).
- PR의 `mergeable_state`가 `unstable`이면 보통 배포 프리뷰(Netlify/Vercel) 빌드 중일 뿐이므로(충돌 `dirty` 아님) 머지 가능.

## 업무 처리 절차 (사용자 지정 · 반드시 준수)
- 모든 작업은 **기획 → 설계 → 개발 → 검증(typecheck/build) → 테스트 → 검토** 순서로 진행하고, **검토를 마친 뒤** 결과를 제시한다.
- 제시 전 반드시 **사용자 입장에서 오류·불편이 없는지** 점검한다(입력/포커스, 권한 분기, 빈 상태, 모바일, 에러 메시지, 되돌리기 등).
- 단순 단답이 아니라면, 무엇을 검증·테스트했고 무엇이 사용자 확인이 필요한지 함께 밝힌다.

## 수정 원칙 (사용자 지정 · 반드시 준수)
- **기존 필터/수식은 절대 임의로 수정하지 않는다.** (검색 필터, 정산·세무·매출 계산식 등)
- **수식 수정이 불가피하면**, 수정 전/후 결과가 어떻게 달라지는지 먼저 확인하고, 목적에 부합하는지 검증한 뒤 변경한다.
- **메뉴는 절대 삭제·수정하지 않는다.** 메뉴 변경이 필요하면 먼저 사용자에게 물어본다.
- 기능 개발·수정 시 요청만 보지 말고:
  1) 수정으로 생길 **결과(부작용)를 예측**하고,
  2) **기존 동작/흐름을 먼저 점검**한 뒤 수정하며,
  3) **연관된 코드·화면**을 함께 살핀다.
- **반복되는 요청·합의 사항은 이 MD에 기록**한다.

## 작업 메모 (반복 확인 사항)
- 등록 모달 폭: 모델 추가·고객사 추가·섭외(단일/프로젝트) 추가는 모두 `Modal ... wide`(maxWidth **680px**)로 통일되어 있다. 폭을 바꿀 땐 네 모달을 함께 동일 값으로 유지.
- 포트폴리오(`studio`)·패키지(`packages`) 메뉴는 데스크탑 `navItems`·모바일 더보기 메뉴·뷰(`ModelStudioView`/`PackagesView`)에 모두 존재한다. (삭제 금지)
- 정산 탭 분류(합의): **정산대기=촬영완료(COMPLETED) & (고객입금·모델지급 둘 다 완료가 아님)** · **정산완료=고객입금 AND 모델지급 둘 다 완료(또는 상태 SETTLED)** · **미입금잔금=고객 미입금**. (정산 금액 계산식과 별개 — 탭 분류 조건만. 임의 변경 금지)
- 매출(RevenueView)은 **확정/완료/정산 상태 + 계약형 + 금액>0 + 촬영일이 선택 기간 내**일 때만 잡힘. 미래월 건은 해당 월/기간을 봐야 보임(버그 아님).
- 정산 발급 서류(합의): **프리랜서·외국인=원천징수 내역서** / **소속사(대대행)=거래명세서**(공급가액+부가세 10%+합계, 세금계산서는 소속 에이전시가 발행). 소속사는 원천징수 대상 아님 → 원천징수세액 0. 계산식(`modelPayout` 소속사=기준액×1.1, `modelWithholding`=0)은 정정하지 말 것(이미 정확). `SettlementStatementModal`에서 모델 세무유형으로 서류 분기.
- 매출 거래명세서/청구(`ClientStatementModal`, 매출 화면 버튼): **고객사 대상**(공급자=당사 / 받는자=고객사), **프로젝트 단위**로 묶어 발급(프로젝트명 없으면 단건). 입금상태=완납/부분입금/미수(고객 입금=완납이면 청구액 전체, 아니면 계약금·잔금 입금분 합산). 매출 인정 필터(REVENUE_STATUSES·계약형·금액>0)와 기존 계산식(`clientCharge`=공급가×1.1)을 그대로 사용 — 신규 계산식 만들지 말 것. 실제 세금계산서는 홈택스 별도 발행.
- 세무 식별번호 입력 위치: **내국인=모델 폼 '세무 신고용 정보'(주민등록번호)** / **외국인=[비자·정산 정보] 모달(주소+외국인등록번호/여권번호)**. 둘 다 `canViewFinance`(대표·정산권한자) 전용이라 권한 없는 계정엔 숨김(정상).
- 🔒 **이메일/캘린더 동기화 보호 영역**: `lib/email.ts`·`lib/calendar.ts`와 Supabase Edge Functions(`email-send`·`cal-feed`·`gcal-oauth`·`gcal-sync`·`solapi-send`)는 **동작하는 발송/동기화 로직**이다. 요청·확인 없이 수정·리팩터 금지. 수정 시 발송 1회 스모크 테스트 필수. ⚠️ 이메일 실패(502 등)는 대개 **코드가 아니라 Resend 도메인 인증/API 키 등 외부 설정** 문제 — 코드부터 고치려 들지 말 것. (Edge Function은 앱과 분리돼 있어 앱 코드 수정으로는 안 바뀜; 직접 재배포해야만 변경됨)
- 📅 **섭외 수락형 흐름(합의)**: SHOOT·MEETING 섭외를 **확정(CONFIRMED)** 하면 모델에게 **초대(수락/거절) 메일**(`sendInviteEmail`)만 발송하고 **캘린더는 생성하지 않는다**. 모델이 메일의 [수락]을 누르면 공개 함수 `booking-respond`가 ① `model_response=accepted` 기록 ② `gcal-sync` 호출(에이전시 구글 캘린더 생성 + 모델 게스트 초대) ③ 수락 페이지에서 .ics·구글추가 제공(모델 메일이 구글이 아니어도 OK). 거절 시 `declined` + 에이전시 알림. ⚠️ **렌더는 Supabase 함수가 아니라 앱 도메인 정적 파일 `public/respond.html` 이 담당**한다(Supabase 함수가 직접 HTML을 주면 일부 모바일 Safari가 `text/plain`으로 받아 `.txt` 다운로드시키는 문제 — 함수 헤더로는 못 고침). 메일 [수락]/[거절] 링크는 **발송 시점 앱 origin** `${origin}/respond.html?id&token&intent=accept|decline`(`email.ts`의 `RESPOND_PAGE`)로 가고, 정적 페이지가 ① `booking-respond?info=1`로 일정 조회·렌더 ② [확정] 버튼 클릭 시 JS `fetch`로 `?do=accept|decline` 호출(스캐너는 JS 미실행 → 자동수락 안 됨) ③ 수락 후 .ics·구글추가 링크를 클라이언트에서 생성. 함수 `booking-respond`는 **HTML 안 줌 — CORS JSON API**(`info`/`do=accept`/`do=decline`)이며, 구버전 메일의 직접 GET 링크는 `${APP_BASE}/respond.html`로 302, 구버전 POST(action=)는 동작 후 303 리다이렉트로 하위호환. 관련: `bookings.model_response/model_responded_at/model_resp_token`, `App.tsx`의 `sendBookingInvite`/`syncBookingToCalendar`(확정=초대 / **미수락·미연동 상태에서 일시·장소 변경=초대 메일 자동 재발송**(`handleSaveBookingEdit`의 `mailFlag`=`whenLocChanged && CONFIRMED`) / **구글 일정이 연동된 건(`gcal_event_id` 존재 — 수락형 수락 또는 수동 "구글 캘린더 등록")은 일시·장소 변경 시 구글 이벤트를 in-place 갱신**(`accepted` 무관·`gcal_event_id`만 보고 판단 — 옛 일정 잔존/중복 방지. `gcal-sync`가 `sendUpdates=all`이라 모델 게스트에게 구글이 변경 통지 메일 자동 발송) / 취소=구글 삭제+취소 메일). ⚠️ 모델이 메일로 수락하면 `gcal_event_id`/`model_response`가 서버에서만 갱신되어 에이전시 세션 로컬값이 옛값(null)일 수 있으므로, `syncBookingToCalendar`는 동작 전 **DB에서 `gcal_event_id`/`model_response`를 재조회**(`liveEventId`/`liveResp`)해 취소 삭제·변경 갱신이 누락되지 않게 한다. 합의: 미수락 변경=재발송, 수락후 변경=현행 유지. ⚠️ 이 흐름은 **메일 발송이 동작해야** 의미가 있다(Resend 도메인 인증 필수). 수동 "일정 보내기" 메뉴(구글 등록/이메일/링크)는 즉시 동작 override로 그대로 유지.
- 📐 **스케줄 충돌/HOLD 규칙(합의 · 순서 의존)**: 같은 모델·같은 날이라도 **시간이 실제로 겹치거나 버퍼 미만일 때만** 충돌/HOLD. **먼저 시작하는 섭외**를 기준으로:
  - **비촬영끼리(미팅/피팅/오디션) 같은 장소** → 시간이 겹쳐도 **충돌 아님**(HOLD 안 함).
  - **비촬영끼리 다른 장소** → **1시간**(이동).
  - **먼저=비촬영 → 다음=촬영** → **1시간**. (예: 11~12 미팅 → 13시 촬영 OK)
  - **먼저=촬영 → 다음(촬영·비촬영 무관)** → **2시간**.
  - ⚠️ "장소 다르면 +1시간"의 **일반 가산은 두지 않는다**(미팅↔미팅 다른장소만 1시간). 촬영이 끼면 장소 무관 위 규칙 그대로.
  - 충돌 시 우선순위 = **비촬영(미팅/피팅/오디션)을 HOLD, 촬영은 유지.** "같은 날 촬영 있으면 시간 무관 무조건 HOLD" 식으로 되돌리지 말 것(간격 기준).
  - 관련: `lib/utils.ts scheduleConflict`(먼저=촬영 ? 120 : 60, 비촬영+같은장소 면제), `App.tsx`의 `blocks`·프로젝트추가·섭외추가·HOLD해제 재검사(모두 `scheduleConflict`에 `location`까지 전달).
- 🛠 **어드민 콘솔 배포(중요·자동 아님)**: 운영자 어드민은 `admin/index.html`(단일 정적 파일, anon key + `admin@modiq.kr`/`platform_admins` 로그인 + `admin-api` 검증으로 보호)이며 **`admin.modiq.kr`** 에 뜬다 — **별도 Vercel 프로젝트 `modiq-admin`**(repo `aimoagency/modiq`, Root Directory `admin/`). ⚠️ **이 프로젝트는 master push 자동배포가 아니다.** `admin/index.html`을 고쳐 master에 머지해도 admin.modiq.kr은 그대로다 → 반드시 **Vercel `modiq-admin` → Settings → Git → Deploy Hooks**의 `admin`(branch `master`) 훅을 한 번 호출(**Copy → 브라우저 주소창 붙여넣기 Enter**, 응답 `{"job":{...,"state":"PENDING"}}` 뜨면 성공)하거나 `Deployments → ⋯ → Redeploy` 해야 반영된다. 그 뒤 admin.modiq.kr 강력 새로고침. (고객 앱 `modiq.kr`은 master 자동배포라 혼동 주의 — 어드민만 수동 훅.) ⚠️ **추가확인(2026-06): modiq-admin의 master 배포가 `Production`이 아니라 `Preview`로만 나가고 있어**(= 프로젝트 Production Branch가 master가 아님) admin.modiq.kr이 옛 Production(#241)에 멈춰 있었다. 근본수정 = modiq-admin `Settings → Git → Production Branch`를 `master`로 설정(또는 최신 Ready 배포를 `⋯ → Promote to Production`). 즉 **올바른 해결 = modiq-admin Production Branch를 `master`로 설정**(한 번만, 영구)하면 그 뒤 master 푸시가 곧 admin.modiq.kr Production 배포가 된다(modiq-admin은 `admin/index.html`을 그대로 서빙하므로 빌드 문제 없음 — 가장 깨끗·확실). ⚠️ **시도했다 버린 우회로**: 고객앱 빌드에 `cp admin/index.html dist/admin.html`로 `modiq.kr/admin.html` 띄우기 — Vercel modiq 프로젝트가 `npm run build`가 아니라 `vite build`만 돌려 cp가 실행 안 돼 404. 게다가 admin/CLAUDE.md가 "어드민은 고객 앱 번들과 절대 섞지 말라"고 명시 → 채택 안 함. (어드민은 반드시 별도 배포 admin.modiq.kr 사용)
- ⚠️ 임시 컨테이너라 **커밋·푸시 안 한 수정은 세션 종료 시 유실**된다. 화면 수정은 반드시 커밋·푸시까지 완료할 것.

## 대시보드 로딩 / 첫 화면 (🔒 보호 영역 — 임의 수정·되돌리기 금지)
> 아래는 사용자가 반복 제기한 문제와 그 해결 구조다. **이 5개 기둥은 서로 맞물려 깜빡임을 막으므로 하나라도 풀면 재발한다.** 성능/로딩 관련 수정이 필요하면 먼저 이 기둥들을 깨지 않는지 확인하고, 콜드스타트·캐시·로그인·새로고침 4가지 흐름을 모두 점검한 뒤 진행한다.

**제기된 증상(재발 방지 대상)**
1. 대시보드 숫자가 모두 **0이었다가 바뀜**(0 깜빡임).
2. **로그인 직후** 로딩 중 글자가 전부 안 보임(화면 전체 스켈레톤).
3. 사이트를 **열자마자 흰 화면**이 한 번 깜빡임.

**해결 구조(5개 기둥 · 위치)**
1. **캐시 동기 주입** — `App.tsx`: `_cachedData`를 첫 렌더에 동기 주입하고 `models/customers/bookings/projects/members` 초기값을 캐시로 둔다. `syncing` 초기값 = `!!_savedSession`.
2. **loadData 일괄 반영** — `App.tsx loadData`: 필수 4종(models·customers·bookings·projects)을 `Promise.all`로 받아 **한 번에 set + `setSyncing(false)` 동시 반영**(부분 0 방지). `agency_members` 등 비필수는 그 뒤 점진 로딩.
3. **스켈레톤 가드 = `&&`** — `DashboardView`: `loading && bookings·models·customers가 모두 빈 경우`에만 스켈레톤. (`||` 금지) 또한 스켈레톤도 **제목·라벨은 실제 텍스트로 노출**하고 숫자/목록 값 자리만 shimmer.
4. **로그인 캐시 복원** — `App.tsx handleLogin`(대표/멤버 분기 모두): `loadData` 직전에 `restoreDataCache(agencyData.id)` 호출(세션복원 effect와 동일하게).
5. **부팅 스플래시 + 즉시 배경** — `index.html`: `<head>` 인라인 `<style>`로 배경색을 첫 페인트부터 적용, 인라인 `<script>`로 저장 테마를 번들 전에 적용, `#root` 안에 modiq 부팅 스플래시. (React `createRoot`가 마운트 시 자동 교체)

**절대 금지 안티패턴**
- 스켈레톤 가드를 `||`로 바꾸기(내용→빈화면 깜빡임 재발).
- `loadData`에서 필수 4종을 **따로따로** set 하기(부분 0 깜빡임).
- 스켈레톤을 라벨까지 포함한 **전체 shimmer**로 되돌리기.
- `index.html`의 인라인 배경/테마 스크립트/부팅 스플래시 제거.
- `handleLogin`의 `restoreDataCache` 호출 제거.

## 프로젝트 개요
- React + Vite + TypeScript SPA, Supabase(REST + RLS + 엣지함수) 백엔드.
- 배포: Vercel(웹) + Netlify(모바일), 운영 브랜치 = `master`.
- Supabase 프로젝트: `fijtpyrmqzjefucsqfos` (리전 ap-south-1).
