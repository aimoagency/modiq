import { useEffect, useRef, useState } from "react";

// 점진 렌더(무한 스크롤) — 대량 목록을 한 번에 다 그리지 않고 step개씩 보여주고,
// 끝의 센티넬이 보이면 늘린다. 의존성 라이브러리 없이 1000명+에서도 DOM/렌더 부담을 낮춘다.
// items 식별자가 바뀌면(검색/필터 변경 → useMemo 새 배열) 처음(step)으로 리셋한다.
export function useVisibleCount<T>(items: T[], step = 60) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const total = items.length;

  // 목록(필터 결과)이 바뀌면 처음부터
  useEffect(() => { setCount(step); }, [items, step]);

  // 센티넬이 뷰포트(또는 스크롤 컨테이너)에 들어오면 더 로드. count를 의존성에 넣어
  // 한 번 늘린 뒤에도 여전히 보이면 채워질 때까지 이어서 로드.
  useEffect(() => {
    if (count >= total) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) setCount(c => Math.min(total, c + step)); },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, total, step]);

  return { visible: items.slice(0, count), hasMore: count < total, sentinelRef };
}
