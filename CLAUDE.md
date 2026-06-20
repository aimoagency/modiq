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

## 프로젝트 개요
- React + Vite + TypeScript SPA, Supabase(REST + RLS + 엣지함수) 백엔드.
- 배포: Vercel(웹) + Netlify(모바일), 운영 브랜치 = `master`.
- Supabase 프로젝트: `fijtpyrmqzjefucsqfos` (리전 ap-south-1).
