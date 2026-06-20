# modiq 변경 로그

## v1.1.0 — 2026.06.20 · 세무·원천징수 🧾

모델 식별번호(주민·외국인등록·여권)를 암호화 저장하고, 원천징수 내역서 발송과 세무사 제출용 지급명세 export까지 정산 흐름을 세무 신고와 연결했다. 타입체크/빌드 통과.

### 세무 신고용 정보 (모델 폼 · 대표·정산권한자 전용)
- 모델 폼에 **'세무 신고용 정보'** 섹션 추가: 주소 + 식별번호(주민/외국인등록/여권).
- 식별번호는 **pgcrypto(`pgp_sym_encrypt`) + Supabase Vault 키**로 암호화 저장 — 평문은 DB/코드/클라이언트 어디에도 없음. 화면엔 **마스킹값만** 표시.
- 입출력은 **SECURITY DEFINER RPC**로만(`set_model_national_id`/`get_model_national_id`), 직접 SELECT는 RLS·권한 회수로 전면 차단.
- 입력 UX: 내국인은 **앞 6자리 자동(생년월일) + 뒷 7자리만** 입력, 외국인은 비자 유형에 따라 외국인등록증/여권 분기.
- 외국인 원천징수율은 **비자 유형으로 잠금**(E-6 3.3% / C-4·기타 20% 등) — 임의 변경 방지.

### 원천징수 내역서 (정산 내역서 → 모델 선택)
- 정산 내역서에서 모델을 특정하면 **🧾 원천징수 내역서** 버튼 노출.
- 원천징수의무자(에이전시)·소득자(모델, 주민번호 **마스킹**)·기간별 지급/원천징수/실지급 + 합계를 담은 내역서 생성.
- **인쇄/PDF 저장**(브라우저 인쇄, 무설치) + **이메일 발송**(Resend `email-send`, 발신=에이전시명·답장=대표 이메일).

### 세무사 제출용 지급명세 (정산 내역서)
- **🔒 세무사용 (주민번호 포함)** 엑셀 다운로드 — **대표·정산권한자만** 노출.
- 건별 지급명세에 **식별번호 종류·전체번호·주소** 컬럼 포함(전체번호는 `get_model_national_id` RPC로 복호화).
- 복호화는 owner/정산권한자만 허용(서버 강제), **호출마다 `secure_id_access_log`에 'reveal' 감사 기록**. 다운로드 전 경고 confirm.

### 문서
- `docs/MANUAL.md`·`docs/FAQ.md`에 세무(식별번호 입력·원천징수 내역서·세무사용 export) 안내 추가, Notion 동기화.

---

## v1.0.0 — 2026.06.17 · MVP 최종 🎉

첫 안정 릴리스(MVP 확정). 버전 표기를 `1.0.0`으로 통일(package.json · constants.ts · README · 앱 내 표시).

### 성능
- 포트폴리오/검색 목록의 모델 썸네일이 원본(1200px)이 아닌 작은 썸네일(`_thumb`)을 받도록 변경 → 동시 연결 포화 해소, 모델 클릭 시 우측 갤러리 로딩 체감 속도 개선 (`ModelBrowser.tsx`, `ModelSearchView.tsx`에 `thumbUrl()` + `loading="lazy"` + 원본 폴백 적용)

### 문서
- `docs/DEVELOPMENT.md`(개발 문서), `docs/MANUAL.md`(운영 매뉴얼), `docs/FAQ.md`(Q&A) 신규 작성 및 Notion 동기화

---

## 2026.06 — feature/package (컴카드·정산·캘린더 동기화)

타입체크/빌드 통과. 노션 정리본: app.notion.com/p/37e8f77dfecc813ba5caf947bd1d5ee8

### 컴카드 · 패키지
- 캐스팅(제안) 카드 반응형 그리드: 최대 6열, 카드 최대폭 320px, 모델 적으면 크게·왼쪽 정렬
- 공개 패키지 카드 대표 1컷만 표시, 클릭 시 갤러리
- 모델별 컴카드 미리보기 → 다운로드 흐름
- 컴카드 A4 가로(좌 1 + 우 2×2 + 하단 정보 한 줄), PDF 이미지 눌림 수정(background-size)
- 컴카드 슬롯 지정 저장(models.compcard), 공유하기, 하단 버튼 알약형
- 스튜디오 패키징 탭 제거, 패키지 추가 시 모델 갤러리·신체정보 자동 반영
- 패키지 메뉴 아이콘 CardStack, 요금제는 CreditCard로 분리

### 정산
- 필터를 날짜 / 모델 / 고객사 3개로 정리
- 건별/모델별/고객사별 토글 제거 → 건별 리스트 기본

### 매출 현황
- 순위에서 모델/고객사 선택 → 해당 매출만 필터(요약 카드 연동)
- 엑셀(.xlsx) 다운로드(합계 포함)
- 건별 내역에 고객사 입금/미입금 읽기전용 표시

### 모델 상세 · 쌍방향 연결
- 모델 헤더 배지(성별·비자) 가로 정렬
- 고객사 상세 섭외 이력 클릭 → 섭외상세 이동(프로젝트명) → 모델↔고객사 양방향 추적

### 모델 휴무(기간)
- model_offs 테이블, 캘린더에서 기간 휴무 등록
- 모델별 음영 / 전체 캘린더 "휴무 N" 표식 + 안내 메시지
- 섭외 추가·수정 시 휴무 충돌 경고 후 강행 허용

### 모델 캘린더 공유 · 동기화
- 일회성: 섭외 확정 시 캘린더 링크 / 모델 이메일(.ics + 구글 추가 링크)
- 이메일 발송: Resend + Supabase Edge Function `email-send`
- 구독형 피드(자동 동기화): `cal-feed` Edge Function + models.cal_token, 모델 1회 구독 → 확정 일정 자동 반영

### 후속 설정(운영)
- Supabase SQL: models.compcard, models.cal_token, bookings.usage_region/usage_period/shoot_types/usage_scope, model_offs 테이블
- Edge Functions(Via Editor, Verify JWT OFF): email-send(시크릿 RESEND_API_KEY/EMAIL_FROM/FN_SHARED_SECRET), cal-feed(기본 SERVICE_ROLE)
- .env(선택, 기본값 내장): VITE_EMAIL_FN_URL, VITE_EMAIL_FN_SECRET

### 안드로이드 캘린더 구독
- ICSx⁵ 앱 설치 → URL 구독(webcal/https) → 새로고침 주기 설정(권장)
- 또는 PC 구글 캘린더 → 다른 캘린더 → URL로 추가(https), 갱신은 느림
