import { C } from "../theme";

// 공통 닫기(X) 버튼 — 모달/오버레이 우측 상단에 배치
// fixed=true → 오버레이(화면) 기준 고정, false → 부모(position:relative) 기준
export default function CloseButton({ onClose, fixed = false, big = false, label = "닫기" }: {
  onClose: () => void;
  fixed?: boolean;
  big?: boolean;
  label?: string;
}) {
  const sz = big ? 40 : 32;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: fixed ? "fixed" : "absolute",
        top: fixed ? 16 : 10,
        right: fixed ? 16 : 10,
        width: sz, height: sz,
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "50%",
        border: `1px solid ${C.border}`,
        background: C.card2,
        color: C.text,
        fontSize: big ? 22 : 18,
        lineHeight: 1, cursor: "pointer", zIndex: 60, padding: 0,
      }}
    >
      ✕
    </button>
  );
}
