# Modiq (v1.1.0 · MVP 완료)

탤런트(모델) 관리 OS — 에이전시 운영 SaaS. React + TypeScript + Vite, 백엔드는 Supabase.

> 📕 운영 매뉴얼 · 개발 문서 · Q&A는 [`docs/`](docs/) 폴더 참고 ([개발 문서](docs/DEVELOPMENT.md) · [운영 매뉴얼](docs/MANUAL.md) · [Q&A](docs/FAQ.md))

## 빠른 시작

```bash
npm install      # 최초 1회 (의존성 설치)
npm run dev      # 개발 서버 → http://localhost:5173
```

## 명령어

| 명령 | 설명 |
|------|------|
| `npm run dev`       | 개발 서버 실행 (핫리로드) |
| `npm run build`     | 타입체크 + 프로덕션 빌드 → `dist/` |
| `npm run typecheck` | 타입 오류만 검사 (빌드 X) |
| `npm run preview`   | 빌드 결과물 로컬 미리보기 |

## 프로젝트 구조

```
.
├── index.html            # 진입 HTML
├── src/
│   ├── main.tsx          # React 마운트 지점
│   └── App.tsx           # 앱 전체 (단일 파일, 2700줄)
├── .versions/            # 버전 스냅샷 백업 (복원용)
├── package.json
├── vite.config.ts
└── tsconfig*.json
```

## 복원 방법 (코드 날아갔을 때)

이 폴더는 그대로 완결된 프로젝트라 어떤 환경에서도 복원 가능:

1. 이 폴더를 통째로 복사
2. `npm install`
3. `npm run dev`

WebContainer(StackBlitz/bolt)에 의존하지 않음. `.versions/` 폴더에 원본 스냅샷이 보존돼 있어,
`src/App.tsx`가 망가지면 거기서 되살릴 수 있음.

## 백엔드 (Supabase)

- URL/Key는 현재 `src/App.tsx` 상단에 하드코딩돼 있음 (publishable key)
- ⚠️ 실고객 데이터 투입 전 반드시 **RLS(Row Level Security)** 설정 점검 필요
- 다음 단계 권장: 키를 `.env`로 분리 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`)

## DB 테이블

`agencies`, `agency_members`, `models`, `customers`, `bookings`, `projects`

## 휴무일 기능 (holidays 테이블)

수동 휴무일 저장을 쓰려면 Supabase SQL Editor에서 1회 실행:

```sql
create table if not exists holidays (
  id text primary key,
  agency_id text,
  date text not null,
  label text default '휴무일'
);
-- 기존 테이블들과 동일한 접근 정책 적용 (RLS 사용 시 정책 추가 필요)
```
