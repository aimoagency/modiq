// ── 구글 캘린더 연동 (OAuth 시작 + 동기화 호출) ──────────────────
// 에이전시가 자기 구글 캘린더를 연동 → 섭외 확정 시 일정 생성 + 모델을 게스트로 초대.
// 토큰 교환·일정 동기화는 Edge Function(gcal-oauth, gcal-sync)에서 처리. 프론트엔 client_secret 없음.

const SUPA_HOST = "fijtpyrmqzjefucsqfos.supabase.co";
const CLIENT_ID = "124687859215-13vjk3ci7gbv3oifek6g6pfvni5lvjl8.apps.googleusercontent.com";
const REDIRECT_URI = `https://${SUPA_HOST}/functions/v1/gcal-oauth`;
const SYNC_FN_URL = `https://${SUPA_HOST}/functions/v1/gcal-sync`;
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

// 구글 동의 화면 열기 (state = agency_id → 콜백에서 어느 에이전시인지 식별)
//  iframe(미리보기) 안에서는 구글이 표시를 거부하므로 새 탭으로 연다.
export const startGoogleConnect = (agencyId: string) => {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",     // refresh_token 받기
    prompt: "consent",          // 매번 동의 → refresh_token 보장
    state: agencyId,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
  const w = window.open(url, "_blank", "noopener");
  if (!w) {
    // 팝업 차단 시: 최상위 창에서 이동 시도, 안 되면 현재 창
    try { (window.top || window).location.href = url; }
    catch { window.location.href = url; }
  }
};

export type GcalAction = "create" | "update" | "delete";
export interface GcalSyncInput {
  action: GcalAction;
  agency_id: string;
  event_id?: string;          // update/delete 시 구글 이벤트 ID
  summary?: string;
  description?: string;
  location?: string;
  start?: string;             // ISO (예: 2026-07-01T17:00:00)
  end?: string;
  all_day?: boolean;
  date?: string;              // 종일이면 YYYY-MM-DD
  attendee_email?: string;    // 모델 이메일 (게스트 초대)
}

// 일정 동기화 호출. 미설정/실패 시 throw 안 함(앱 흐름 방해 X).
export const gcalSync = async (input: GcalSyncInput): Promise<{ ok: boolean; event_id?: string; skipped?: boolean; error?: string }> => {
  try {
    const res = await fetch(SYNC_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` };
    if (data?.skipped) return { ok: false, skipped: true };
    return { ok: true, event_id: data?.event_id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
};
