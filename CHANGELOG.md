# modiq 변경 로그

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
