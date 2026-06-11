// ── 카카오 알림톡 (Solapi) ───────────────────────────────────────
// 발송 주체: Modiq 플랫폼 단일 발신번호(010-8796-7966) — 모든 에이전시 공통.
// 발송 경로: 프론트 → Supabase Edge Function(solapi-send) → Solapi. 프론트에 API 키 없음.
// VITE_SOLAPI_FN_URL 미설정 시 콘솔 로그만 남기고 no-op (절대 throw 안 함).
//
// 본문 [#{발신}] = 에이전시 이름(senderLabel), 문의: #{문의처} = 에이전시 문의 연락처(회사정보에서 관리).
// 수신자(audience): MODEL(모델) / CLIENT(고객사) — 호칭이 달라 템플릿 분리.
// 템플릿 코드 규칙: MODIQ_{TYPE}_{AUDIENCE}

export type AlimtalkType = "CONFIRM" | "CANCEL" | "REMIND" | "CHANGE";
export type Audience = "MODEL" | "CLIENT";

export interface BookingLike {
  booking_type?: string;
  shoot_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  manager?: string;
}

const TYPE_LABEL: Record<string, string> = {
  SHOOT: "촬영", MEETING: "실물미팅", FITTING: "피팅", AUDITION: "오디션",
};
export const typeLabel = (t?: string) => TYPE_LABEL[t || ""] || "일정";

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
  senderLabel?: string;  // 본문 앞 [발신] = 에이전시 이름
  contactPhone?: string; // 문의: 에이전시 문의 연락처
  before?: string;
  after?: string;
}

// 템플릿 본문(SMS fallback용) + Solapi 변수맵(#{} 키) 생성.
export const buildAlimtalkText = (
  type: AlimtalkType, audience: Audience, args: AlimtalkArgs
): { templateCode: string; text: string; variables: Record<string, string> } => {
  const { modelName, booking, clientName, managerName } = args;
  const sender = args.senderLabel || "에이전시";
  const contact = args.contactPhone || "담당자에게 문의";
  const ty = typeLabel(booking.booking_type);
  const when = fmtWhen(booking);
  const place = booking.location || "장소 미정";
  const before = args.before || "-";
  const after = args.after || "-";
  const code = `MODIQ_${type}_${audience}`;

  if (audience === "MODEL") {
    switch (type) {
      case "CONFIRM": return { templateCode: code,
        variables: { "#{발신}": sender, "#{유형}": ty, "#{모델명}": modelName, "#{일시}": when, "#{장소}": place, "#{고객사}": clientName, "#{담당자}": managerName, "#{문의처}": contact },
        text: `[${sender}] ${ty} 확정 안내\n${modelName}님, 아래 일정이 확정되었습니다.\n\n· 유형: ${ty}\n· 일시: ${when}\n· 장소: ${place}\n· 고객사: ${clientName}\n· 담당: ${managerName}\n\n문의: ${contact}` };
      case "CANCEL": return { templateCode: code,
        variables: { "#{발신}": sender, "#{유형}": ty, "#{모델명}": modelName, "#{일시}": when, "#{장소}": place, "#{고객사}": clientName, "#{문의처}": contact },
        text: `[${sender}] ${ty} 취소 안내\n${modelName}님, 아래 일정이 취소되었습니다.\n\n· 유형: ${ty}\n· 일시: ${when}\n· 장소: ${place}\n· 고객사: ${clientName}\n\n문의: ${contact}` };
      case "REMIND": return { templateCode: code,
        variables: { "#{발신}": sender, "#{유형}": ty, "#{모델명}": modelName, "#{일시}": when, "#{장소}": place, "#{고객사}": clientName, "#{문의처}": contact },
        text: `[${sender}] 내일 일정 안내\n${modelName}님, 내일 일정 리마인드입니다.\n\n· 유형: ${ty}\n· 일시: ${when}\n· 장소: ${place}\n· 고객사: ${clientName}\n\n집결 시간·준비물 확인 부탁드립니다.\n문의: ${contact}` };
      case "CHANGE": default: return { templateCode: code,
        variables: { "#{발신}": sender, "#{유형}": ty, "#{모델명}": modelName, "#{변경전}": before, "#{변경후}": after, "#{장소}": place, "#{고객사}": clientName, "#{문의처}": contact },
        text: `[${sender}] 일정 변경 안내\n${modelName}님, 아래와 같이 일정이 변경되었습니다.\n\n· 유형: ${ty}\n· 변경 전: ${before}\n· 변경 후: ${after}\n· 장소: ${place}\n· 고객사: ${clientName}\n\n문의: ${contact}` };
    }
  } else {
    switch (type) {
      case "CONFIRM": return { templateCode: code,
        variables: { "#{발신}": sender, "#{고객사}": clientName, "#{모델명}": modelName, "#{유형}": ty, "#{일시}": when, "#{장소}": place, "#{담당자}": managerName, "#{문의처}": contact },
        text: `[${sender}] 섭외 확정 안내\n${clientName}님, 요청하신 섭외가 확정되었습니다.\n\n· 모델: ${modelName}\n· 유형: ${ty}\n· 일시: ${when}\n· 장소: ${place}\n· 담당: ${managerName}\n\n문의: ${contact}` };
      case "CANCEL": return { templateCode: code,
        variables: { "#{발신}": sender, "#{고객사}": clientName, "#{모델명}": modelName, "#{유형}": ty, "#{일시}": when, "#{장소}": place, "#{문의처}": contact },
        text: `[${sender}] 섭외 취소 안내\n${clientName}님, 아래 섭외가 취소되었습니다.\n\n· 모델: ${modelName}\n· 유형: ${ty}\n· 일시: ${when}\n· 장소: ${place}\n\n문의: ${contact}` };
      case "REMIND": return { templateCode: code,
        variables: { "#{발신}": sender, "#{고객사}": clientName, "#{모델명}": modelName, "#{유형}": ty, "#{일시}": when, "#{장소}": place, "#{문의처}": contact },
        text: `[${sender}] 내일 촬영 안내\n${clientName}님, 내일 섭외 일정 안내드립니다.\n\n· 모델: ${modelName}\n· 유형: ${ty}\n· 일시: ${when}\n· 장소: ${place}\n\n준비 사항 확인 부탁드립니다.\n문의: ${contact}` };
      case "CHANGE": default: return { templateCode: code,
        variables: { "#{발신}": sender, "#{고객사}": clientName, "#{모델명}": modelName, "#{유형}": ty, "#{변경전}": before, "#{변경후}": after, "#{장소}": place, "#{문의처}": contact },
        text: `[${sender}] 일정 변경 안내\n${clientName}님, 아래 섭외 일정이 변경되었습니다.\n\n· 모델: ${modelName}\n· 유형: ${ty}\n· 변경 전: ${before}\n· 변경 후: ${after}\n· 장소: ${place}\n\n문의: ${contact}` };
    }
  }
};

const SOLAPI_FN_URL: string = (import.meta as any).env?.VITE_SOLAPI_FN_URL || "";

// 단건 발송. 엣지 함수 경유. 미설정/오류 시에도 throw 하지 않음.
export const sendAlimtalk = async (
  to: string, type: AlimtalkType, audience: Audience, args: AlimtalkArgs
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  const phone = (to || "").replace(/[^0-9]/g, "");
  if (!phone) return { ok: false, error: "수신번호 없음" };
  const { templateCode, text, variables } = buildAlimtalkText(type, audience, args);

  if (!SOLAPI_FN_URL) {
    console.info("[알림톡 미발송: VITE_SOLAPI_FN_URL 미설정]", { to: phone, type, audience, templateCode, text });
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(SOLAPI_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, type, audience, templateCode, variables, fallbackText: text }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};

// 모델 + 고객사 양쪽 발송 (빈 번호는 자동 skip).
export const sendAlimtalkBoth = (
  modelPhone: string, clientPhone: string, type: AlimtalkType, args: AlimtalkArgs
): void => {
  void sendAlimtalk(modelPhone, type, "MODEL", args);
  void sendAlimtalk(clientPhone, type, "CLIENT", args);
};
