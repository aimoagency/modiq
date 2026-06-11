# Modiq 알림톡 실발송 — 등록·배포 가이드

> 발송 주체: **Modiq 플랫폼 단일 발신번호 010-8796-7966** (모든 에이전시 공통)
> 경로: 프론트 → Supabase Edge Function `solapi-send` → Solapi
> 코드는 모두 준비됨. 아래 외부 등록 + 배포 + env만 채우면 발송이 켜진다.

순서: ①카카오 채널 → ②템플릿 8종 승인 → ③엣지 함수 배포 + 시크릿 → ④프론트 env.

---

## 발신·표기 구조 (중요)

- **발송 주체는 Modiq 플랫폼 채널/번호 하나.** 에이전시는 각자 카카오 채널을 만들 필요 없이 가입만 하면 Modiq가 대신 보낸다.
- 본문 맨 앞 `[#{발신}]` = **에이전시 이름**(`agency.name`) → 예: `[아이모] 촬영 확정 안내`.
- 본문 `문의: #{문의처}` = **에이전시 문의 연락처**(`agency.contact_phone`, 회사정보 메뉴에서 관리). 모델·고객사가 회신할 번호.
- 수신자가 보는 채널명은 Modiq 채널. 완전 화이트라벨(에이전시 채널 발송)은 v2(에이전시별 pfId).

`agency.contact_phone` 컬럼 SQL (회사정보 기능과 공용):
```sql
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '';
```

---

## ① 카카오 비즈니스 채널

1. 카카오톡 채널 개설(Modiq 플랫폼 명의) + 사업자 정보 등록
2. Solapi 콘솔 → 카카오 채널 연동 → 발신프로필 `pfId` 확보
3. 발신번호 **010-8796-7966** 등록·인증

---

## ② 알림톡 템플릿 8종 등록 (카카오 심사 1~2영업일)

모델용 4 + 고객사용 4. `#{...}` 변수 유지, 광고 문구 금지. 승인 후 각 **templateId** 확보.
본문 원문은 `src/lib/alimtalk.ts`의 `buildAlimtalkText`와 1:1 — 아래와 동일하게 등록할 것.

### 모델용 (MODEL)

**MODIQ_CONFIRM_MODEL** — 발신, 유형, 모델명, 일시, 장소, 고객사, 담당자, 문의처
```
[#{발신}] #{유형} 확정 안내
#{모델명}님, 아래 일정이 확정되었습니다.

· 유형: #{유형}
· 일시: #{일시}
· 장소: #{장소}
· 고객사: #{고객사}
· 담당: #{담당자}

문의: #{문의처}
```

**MODIQ_CANCEL_MODEL** — 발신, 유형, 모델명, 일시, 장소, 고객사, 문의처
```
[#{발신}] #{유형} 취소 안내
#{모델명}님, 아래 일정이 취소되었습니다.

· 유형: #{유형}
· 일시: #{일시}
· 장소: #{장소}
· 고객사: #{고객사}

문의: #{문의처}
```

**MODIQ_REMIND_MODEL** — 발신, 유형, 모델명, 일시, 장소, 고객사, 문의처
```
[#{발신}] 내일 일정 안내
#{모델명}님, 내일 일정 리마인드입니다.

· 유형: #{유형}
· 일시: #{일시}
· 장소: #{장소}
· 고객사: #{고객사}

집결 시간·준비물 확인 부탁드립니다.
문의: #{문의처}
```

**MODIQ_CHANGE_MODEL** — 발신, 유형, 모델명, 변경전, 변경후, 장소, 고객사, 문의처
```
[#{발신}] 일정 변경 안내
#{모델명}님, 아래와 같이 일정이 변경되었습니다.

· 유형: #{유형}
· 변경 전: #{변경전}
· 변경 후: #{변경후}
· 장소: #{장소}
· 고객사: #{고객사}

문의: #{문의처}
```

### 고객사용 (CLIENT)

**MODIQ_CONFIRM_CLIENT** — 발신, 고객사, 모델명, 유형, 일시, 장소, 담당자, 문의처
```
[#{발신}] 섭외 확정 안내
#{고객사}님, 요청하신 섭외가 확정되었습니다.

· 모델: #{모델명}
· 유형: #{유형}
· 일시: #{일시}
· 장소: #{장소}
· 담당: #{담당자}

문의: #{문의처}
```

**MODIQ_CANCEL_CLIENT** — 발신, 고객사, 모델명, 유형, 일시, 장소, 문의처
```
[#{발신}] 섭외 취소 안내
#{고객사}님, 아래 섭외가 취소되었습니다.

· 모델: #{모델명}
· 유형: #{유형}
· 일시: #{일시}
· 장소: #{장소}

문의: #{문의처}
```

**MODIQ_REMIND_CLIENT** — 발신, 고객사, 모델명, 유형, 일시, 장소, 문의처
```
[#{발신}] 내일 촬영 안내
#{고객사}님, 내일 섭외 일정 안내드립니다.

· 모델: #{모델명}
· 유형: #{유형}
· 일시: #{일시}
· 장소: #{장소}

준비 사항 확인 부탁드립니다.
문의: #{문의처}
```

**MODIQ_CHANGE_CLIENT** — 발신, 고객사, 모델명, 유형, 변경전, 변경후, 장소, 문의처
```
[#{발신}] 일정 변경 안내
#{고객사}님, 아래 섭외 일정이 변경되었습니다.

· 모델: #{모델명}
· 유형: #{유형}
· 변경 전: #{변경전}
· 변경 후: #{변경후}
· 장소: #{장소}

문의: #{문의처}
```

---

## ③ 엣지 함수 배포 + 시크릿

파일: `supabase/functions/solapi-send/index.ts`. 템플릿 env 키: `SOLAPI_TPL_{TYPE}_{AUDIENCE}`.

```bash
supabase functions deploy solapi-send --no-verify-jwt

supabase secrets set \
  SOLAPI_API_KEY=발급키  SOLAPI_API_SECRET=발급시크릿 \
  SOLAPI_PFID=발신프로필ID  SOLAPI_SENDER=01087967966 \
  FN_SHARED_SECRET=임의의긴문자열 \
  SOLAPI_TPL_CONFIRM_MODEL=...  SOLAPI_TPL_CONFIRM_CLIENT=... \
  SOLAPI_TPL_CANCEL_MODEL=...   SOLAPI_TPL_CANCEL_CLIENT=... \
  SOLAPI_TPL_REMIND_MODEL=...   SOLAPI_TPL_REMIND_CLIENT=... \
  SOLAPI_TPL_CHANGE_MODEL=...   SOLAPI_TPL_CHANGE_CLIENT=...
```

알림톡 실패 시 `fallbackText`로 SMS/LMS 자동 대체.

---

## ④ 프론트 환경변수 (.env)

```
VITE_SOLAPI_FN_URL=https://<프로젝트>.supabase.co/functions/v1/solapi-send
```

> 비어 있으면 콘솔 로그만 남기고 발송 안 함(no-op). ①~④ 끝나기 전까지 앱 안전.

---

## 트리거 (이미 코드 연결됨)

| 동작 | 함수 | 발송(모델+고객사) |
|---|---|---|
| 상태→확정/취소 | `handleChangeStatus` | CONFIRM / CANCEL |
| 수정 저장 시 확정/취소 전환 | `handleSaveBookingEdit` | CONFIRM / CANCEL |
| 수정 저장 시 일시·장소 변경 | `handleSaveBookingEdit` | CHANGE |
| 촬영 전날 리마인드 | (미연결) | REMIND — 별도 Cron 엣지 함수 |

- 발신명 `[#{발신}]` = `agency.name`, 문의처 `#{문의처}` = `agency.contact_phone`(없으면 rep_phone).
- 수신자: 모델 phone + 고객사 phone. 빈 번호 자동 skip.

REMIND는 매일 도는 Cron이 필요해 별도 — 원하면 `alimtalk-remind` 함수를 추가로 만들어 줄게.

---

## 적용 체크리스트

- [ ] `agencies.contact_phone` 컬럼 SQL 실행
- [ ] 카카오 채널 + pfId + 발신번호 인증
- [ ] 템플릿 8종 등록 → 승인 → templateId 8개
- [ ] `supabase functions deploy solapi-send --no-verify-jwt`
- [ ] `supabase secrets set ...` (키·pfId·sender·템플릿ID 8개·공유시크릿)
- [ ] 프론트 `.env`에 `VITE_SOLAPI_FN_URL`
- [ ] 회사정보에서 상호·문의 연락처 입력
- [ ] 테스트: 섭외 확정 → 모델·고객사 양쪽 수신 확인
