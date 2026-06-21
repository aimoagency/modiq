// ── 에러 바운더리 ──────────────────────────────────────────────
// 페이지(주로 lazy 뷰) 렌더 중 에러가 나도 앱 전체가 언마운트(검은 화면)되지 않도록
// 콘텐츠 영역만 안전한 폴백(새로고침 카드)으로 대체한다. 메뉴/헤더는 바운더리 밖이라 유지됨.
import { Component, type ReactNode, type ErrorInfo } from "react";
import { C } from "../theme";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 진단용 로그(운영에서도 콘솔로 확인 가능)
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>화면을 불러오지 못했습니다</p>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 18px", lineHeight: 1.6 }}>일시적인 문제일 수 있어요.<br />새로고침하면 정상으로 돌아옵니다.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: C.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
