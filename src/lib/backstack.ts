// ════════════════════════════════════════════════════════════════
// 브라우저 뒤로가기 ↔ 오버레이 닫기 연동
//  · 자식 컴포넌트의 전체화면 오버레이(미리보기·라이트박스·모달)는
//    App의 중앙 popstate 핸들러가 알지 못해, 뒤로가기 시 닫히지 않고
//    페이지가 이탈하는 문제가 있었다.
//  · 오버레이가 열릴 때 자기 닫기 함수를 이 스택에 등록하면,
//    App의 popstate 핸들러가 topBack()부터(LIFO) 닫는다.
//  · 히스토리는 App 핸들러가 기존 "모달 흡수" 패턴으로 유지하므로
//    여기서 pushState 하지 않는다(이중 push 방지).
// ════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";

type CloseFn = () => void;
const stack: CloseFn[] = [];

export const topBack = (): CloseFn | undefined => stack[stack.length - 1];

// 열린 오버레이 등록 — 가장 최근에 열린 것이 먼저 닫힌다.
export function useBackClose(isOpen: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const fn: CloseFn = () => ref.current();
    stack.push(fn);
    return () => {
      const i = stack.lastIndexOf(fn);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [isOpen]);
}
