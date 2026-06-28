# 📘 modiq 문서 허브 (Notion 임포트용 마스터)

> **버전 v1.3.0 · 갱신일 2026-06-28**
> 이 문서 하나가 모딕 전체 문서의 **목차·요약·진입점**입니다. Notion에 그대로 임포트해 최상위 페이지로 쓰세요.
> (모든 하위 문서는 표준 Markdown이라 Notion `가져오기 → Markdown & CSV`로 폴더째 올리면 페이지로 변환됩니다.)

---

## 🧭 나는 누구? → 어디부터 읽나
| 상황 / 역할 | 추천 문서 | 비고 |
|---|---|---|
| 모딕을 **처음 셋업**한다 | [단계별 가이드](USER_GUIDE_STEP_BY_STEP.md) | 회사정보→담당자→모델→고객→섭외→발송→정산→매출 순서 |
| 내 **역할(대표/매니저/재무)** 기준으로 본다 | [페르소나 가이드](USER_GUIDE_PERSONA.md) | "나는 누구?" 라우팅 표 포함 |
| 특정 화면/기능 **사용법**이 궁금 | [운영 매뉴얼](MANUAL.md) | 0~9 기능별 |
| **막히거나 헷갈릴 때** | [Q&A / FAQ](FAQ.md) | 계정·모델·섭외·정산·캘린더·영상·발송·요금제 |
| **개발/유지보수** | [개발 문서](DEVELOPMENT.md) · [리스트 정렬 규칙](LIST_ALIGNMENT.md) | 아키텍처·DB·Edge Functions·정렬 고정 규칙 |
| **무엇이 바뀌었나** | [변경 로그](../CHANGELOG.md) | 버전별 릴리스 노트 |

---

## 📚 문서 목록 & 요약

### 1. 사용자 매뉴얼
- **[단계별 가이드 `USER_GUIDE_STEP_BY_STEP.md`](USER_GUIDE_STEP_BY_STEP.md)** — 신규 에이전시가 0부터 셋업하는 순서. 8단계 한눈에 보기 표 + 각 단계(목적/위치/할 일/권한·주의/완료 기준/다음 단계). 예상 30분.
- **[페르소나 가이드 `USER_GUIDE_PERSONA.md`](USER_GUIDE_PERSONA.md)** — 역할별(김대표 오너 · 이매니저 섭외 · 박정산 재무 · 대대행 발송 A/B) 워크플로우와 권한 매트릭스.
- **[운영 매뉴얼 `MANUAL.md`](MANUAL.md)** — 화면·기능별 상세(대시보드/모델·포트폴리오/패키지/섭외/정산·매출/캘린더/알림톡/권한·요금제/체크리스트).

### 2. Q&A
- **[FAQ `FAQ.md`](FAQ.md)** — 자주 묻는 질문. 영상·발송 대대행·요금제 v3.0·디자인·리스트 정렬·"메일/캘린더가 안 와요(외부 설정)" 포함.

### 3. 개발 문서
- **[개발 문서 `DEVELOPMENT.md`](DEVELOPMENT.md)** — 스택·디렉터리·데이터 모델·정산 로직·Edge Functions·Material 3 토큰·영상·발송 V4 스키마·요금제·리스트 정렬 아키텍처·마이그레이션 SQL.
- **[리스트 정렬 규칙 `LIST_ALIGNMENT.md`](LIST_ALIGNMENT.md)** — 🔒 엑셀형 표 고정 규칙(공용 BookingsList·별개 grid 함정·헤더 정렬·빈칸·금액 무잘림).
- **[변경 로그 `CHANGELOG.md`](../CHANGELOG.md)** — 버전별 릴리스 노트.

---

## ✨ v1.3.0 헤드라인 (이번 릴리스)
| 영역 | 요약 |
|---|---|
| 🎨 **Material 3 디자인** | primary=딥블루, 라임 액센트, pill 버튼·둥근 입력, 모바일 M3 하단 탭(알약), 라이트 모드 가독성 |
| 🎬 **영상 첨부** | 포트폴리오·패키지에 유튜브·비메오·인스타·틱톡 임베드(9:16 세로·라이트박스). 임베드라 호스팅 부담 0 |
| 🤝 **발송 V4 — 대대행** | A가 보낸 모델을 B가 '내 모델로 등록' → 소속사 10% 고정 편입, A 업체정보 자동 입력, 출처 배지·필터 |
| 💳 **요금제 v3.0** | Starter 78,000 / Pro 118,000 / **Team 158,000(BEST)** / Enterprise 228,000 (월·VAT 포함) |
| 📊 **리스트 정렬 통일** | 섭외·대시보드·매출·정산 동일 엑셀형 정렬. 금액/상태 제목과 셀 정합, 금액 무잘림 |

---

## ⚙️ 배포 전 필수 — Supabase SQL (운영자 실행)
> 코드 배포만으로는 안 되고, 아래 SQL을 [SQL Editor](https://supabase.com/dashboard/project/fijtpyrmqzjefucsqfos/sql/new)에서 실행해야 합니다.

1. **발송 V4 + 영상 컬럼**(스키마 · 안전·재실행 가능 · **필수**): `supabase/talent_distribution_v4_subagency.sql` + `alter table public.models add column if not exists videos jsonb;`
2. **요금제 v3.0 — 전체 trial 리셋**(선택): `update public.agencies set plan='trial', trial_ends_at=now()+interval '14 days';` ⚠️ 유료 포함 전부 초기화.

상세는 [개발 문서 §마이그레이션](DEVELOPMENT.md) 참고.

---

## 📥 Notion 임포트 방법
1. Notion 좌측 하단 **설정 → 가져오기**(또는 페이지에서 `/import`) → **Markdown & CSV**.
2. `docs/` 폴더의 `.md` 파일들과 루트 `CHANGELOG.md`를 함께 업로드(드래그).
3. 이 `NOTION_INDEX.md`를 **최상위 페이지**로 두고, 위 링크들이 가져온 페이지를 가리키도록 정리.
4. 상대 링크(`USER_GUIDE_*.md` 등)는 Notion이 자동으로 페이지 링크로 변환하지만, 일부는 임포트 후 수동 연결이 필요할 수 있습니다.

> 표·체크리스트·콜아웃(>)·코드블록은 Notion에서 그대로 렌더됩니다. 이미지가 필요하면 각 화면 캡처를 해당 페이지에 추가하세요(현재 문서는 텍스트 기준).
