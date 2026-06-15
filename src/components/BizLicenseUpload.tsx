import { useRef, useState } from "react";
import { C } from "../theme";
import { Camera, CheckCircle2, AlertTriangle } from "./icons";
import { extractBusinessInfo, type BizLicenseInfo } from "../lib/ocr";

// 사업자등록증 업로드 → OCR → onExtracted 콜백으로 폼에 자동 입력.
// 고객사 추가/수정 모달 상단에 공용으로 삽입한다. (앱 테마 재사용)
export default function BizLicenseUpload({ onExtracted }: { onExtracted: (info: BizLicenseInfo) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const handleFile = async (file?: File) => {
    if (!file) return;
    setStatus("loading"); setMsg("");
    const r = await extractBusinessInfo(file);
    if (r.ok) {
      onExtracted(r.data);
      setStatus("done"); setMsg("자동 입력 완료 — 값 확인 후 저장하세요");
    } else {
      setStatus("error"); setMsg(r.error || "사업자등록증을 인식하지 못했습니다.");
    }
    if (ref.current) ref.current.value = ""; // 같은 파일 재업로드 가능
  };

  const tone =
    status === "done" ? C.green : status === "error" ? C.red : status === "loading" ? C.blue : C.border;

  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: "flex", alignItems: "center", gap: 10, cursor: status === "loading" ? "default" : "pointer",
          border: `1px dashed ${tone}`, borderRadius: 8, padding: "11px 14px",
          background: status === "idle" ? C.card2 : tone + "14",
        }}
      >
        {status === "loading" ? (
          <span style={{ display: "inline-block", width: 16, height: 16, border: `2px solid ${C.blue}`, borderTopColor: "transparent", borderRadius: "50%", animation: "modiq-spin 0.7s linear infinite", flexShrink: 0 }} />
        ) : status === "done" ? (
          <CheckCircle2 size={16} style={{ color: C.green, flexShrink: 0 }} />
        ) : status === "error" ? (
          <AlertTriangle size={16} style={{ color: C.red, flexShrink: 0 }} />
        ) : (
          <Camera size={16} style={{ color: C.purple, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: status === "idle" ? C.text : tone }}>
            {status === "loading" ? "사업자등록증 분석 중..."
              : status === "done" ? "자동 입력 완료"
              : status === "error" ? "인식 실패"
              : "사업자등록증 업로드 → 자동 입력"}
          </span>
          <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1 }}>
            {status === "idle" ? "JPG · PNG · PDF / 최대 5MB" : (msg || "다시 업로드하려면 클릭")}
          </span>
        </span>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: "none" }}
          disabled={status === "loading"}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </label>
      <style>{`@keyframes modiq-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
