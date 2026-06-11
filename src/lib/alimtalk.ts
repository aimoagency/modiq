// ── 카카오 알림톡 (Solapi) ───────────────────────────────────────
// 발신번호: 010-8796-7966
// 실제 발송은 Supabase Edge Function(solapi-send) 경유 — 프론트에 API 키 노출 금지.
// VITE_SOLAPI_FN_URL 미설정 시 콘솔 로그만 남기고 no-op (절대 throw 안 함).

export type AlimtalkType = "CONFIRM" | "CANCEL" | "REMIND" | "CHANGE";

export interface BookingLike {
  booking_type?: string;
  shoot_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  manager?: string; // 담당 멤버 이름
}

const TYPE_LABEL: Record<string, string> = {
  SHOOT: "촬영", MEETING: "실물미팅", FITTING: "피팅", AUDITION: "오디션",
};

export const typeLabel = (t?: string) => TYPE_LABEL[t || ""] || "일정";

// 담당자 이름 → 멤버 연락처. 없으면 대표번호(fallback) → 빈값.
export const resolveManagerPhone = (
  managerName: string | undefined, members: any[], repPhone?: string
): string => {
  const m = members.find((x: any) => x.name === managerName);
  return (m?.phone || repPhone || "").replace(/[^0-9]/g, "");
};

const fmtWhen = (b: BookingLike) => {
  const d = b.shoot_date ? b.shoot_date.replace(/-/g, ".") : "일정 미정";
  const t = b.start_time && b.end_time ? ` ${b.start_time}~${b.end_time}` : "";
  return d + t;
};

export interface AlimtalkArgs {
  modelName: string;
  booking: BookingLike;
  clientName: string;
  managerName: string;
  before?: string; // CHANGE 전용: 변경 전 일시/장소
  after?: string;  // CHANGE 전용: 변경 후 일시/장소
}

// 카카오 승인 템플릿과 1:1 매칭되는 본문(변수 치환 결과)을 생성.
export const buildAlimtalkText = (
  type: AlimtalkType, args: AlimtalkArgs
): { templateCode: string; text: string } => {
  const { modelName, booking, clientName, managerName } = args;
  const ty = typeLabel(booking.booking_type);
  const when = fmtWhen(booking);
  const place = booking.location || "장소 미정";

  switch (type) {
    case "CONFIRM":
      return { templateCode: "MODIQ_CONFIRM_01", text:
`[Modiq] ${ty} 확정 안내
${modelName}님, 아래 일정이 확정되었습니다.

· 유형: ${ty}
· 일시: ${when}
· 장소: ${place}
· 고객사: ${clientName}
· 담당: ${managerName}

변경/문의는 담당자에게 연락 주세요.` };
    case "CANCEL":
      return { templateCode: "MODIQ_CANCEL_01", text:
`[Modiq] ${ty} 취소 안내
${modelName}님, 아래 일정이 취소되었습니다.

· 유형: ${ty}
· 일시: ${when}
· 장소: ${place}
· 고객사: ${clientName}

자세한 내용은 담당자 ${managerName}에게 확인 부탁드립니다.` };
    case "REMIND":
      return { templateCode: "MODIQ_REMIND_01", text:
`[Modiq] 내일 일정 안내
${modelName}님, 내일 일정 리마인드입니다.

· 유형: ${ty}
· 일시: ${when}
· 장소: ${place}
· 고객사: ${clientName}

집결 시간·준비물 확인 부탁드립니다.` };
    case "CHANGE":
    default:
      return { templateCode: "MODIQ_CHANGE_01", text:
`[Modiq] 일정 변경 안내
${modelName}님, 아래와 같이 일정이 변경되었습니다.

· 유형: ${ty}
· 변경 전: ${args.before || "-"}
· 변경 후: ${args.after || "-"}
· 장소: ${place}
· 고객사: ${clientName}

확인 후 담당자 ${managerName}에게 회신 부탁드립니다.` };
  }
};

const SOLAPI_FN_URL: string = (import.meta as any).env?.VITE_SOLAPI_FN_URL || "";
const SENDER = "01087967966"; // 발신번호 010-8796-7966

// 실제 발송. 엣지 함수 경유. 미설정/오류 시에도 throw 하지 않고 결과 객체 반환.
export const sendAlimtalk = async (
  to: string, type: AlimtalkType, args: AlimtalkArgs
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  const phone = (to || "").replace(/[^0-9]/g, "");
  if (!phone) return { ok: false, error: "수신번호 없음" };
  const { templateCode, text } = buildAlimtalkText(type, args);

  if (!SOLAPI_FN_URL) {
    console.info("[알림톡 미발송: VITE_SOLAPI_FN_URL 미설정]", { to: phone, templateCode, text });
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(SOLAPI_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: SENDER, to: phone, templateCode, text }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};
