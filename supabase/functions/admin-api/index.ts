// Modiq 플랫폼 운영자 어드민 API (Supabase Edge Function)
// 보안: service_role은 이 함수(서버)에만 존재. 호출자 JWT로 본인 확인 → platform_admins 화이트리스트 통과자만 처리.
// 배포: verify_jwt=false (CORS 프리플라이트 + 자체 인증. email-send/cal-feed와 동일 패턴)
// 액션: tenants / orphans / delete_user(고아만) / set_plan(plan 화이트리스트)
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLANS = ["trial", "starter", "standard", "pro"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "no auth header" }, 401);

    // 1) 호출자 식별(로그인한 사용자)
    const userClient = createClient(SB_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user?.email) return json({ error: "unauthorized" }, 401);

    // 2) service_role 클라이언트 + 플랫폼 관리자 화이트리스트 확인
    const admin = createClient(SB_URL, SERVICE);
    const { data: pa } = await admin.from("platform_admins").select("email").eq("email", user.email).maybeSingle();
    if (!pa) return json({ error: "forbidden: not a platform admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "tenants") {
      const { data, error } = await admin.rpc("admin_tenant_stats");
      if (error) return json({ error: error.message }, 500);
      return json({ tenants: data });
    }
    if (action === "orphans") {
      const { data, error } = await admin.rpc("admin_orphan_accounts");
      if (error) return json({ error: error.message }, 500);
      return json({ orphans: data });
    }
    if (action === "delete_user") {
      const id = String(body?.user_id || "");
      if (!id) return json({ error: "user_id required" }, 400);
      // 안전장치: 에이전시/멤버십 없는 '고아' 계정만 삭제 허용
      const { data: orphans } = await admin.rpc("admin_orphan_accounts");
      const isOrphan = (orphans || []).some((o: { user_id: string }) => o.user_id === id);
      if (!isOrphan) return json({ error: "에이전시/멤버십이 있는 계정은 삭제할 수 없습니다(고아 계정만 삭제 가능)." }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "set_plan") {
      const agencyId = String(body?.agency_id || "");
      const plan = String(body?.plan || "");
      if (!agencyId || !PLANS.includes(plan)) return json({ error: "invalid agency_id/plan" }, 400);
      const { error } = await admin.from("agencies").update({ plan }).eq("id", agencyId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    if (action === "delete_tenant") {
      const agencyId = String(body?.agency_id || "");
      if (!agencyId) return json({ error: "agency_id required" }, 400);
      const { data: rows, error } = await admin.rpc("admin_delete_tenant", { p_agency_id: agencyId });
      if (error) return json({ error: error.message }, 500);
      const ids = ((rows as { deleted_user_id: string }[]) || []).map((r) => r.deleted_user_id).filter(Boolean);
      let removed = 0;
      for (const uid of ids) { const { error: de } = await admin.auth.admin.deleteUser(uid); if (!de) removed++; }
      return json({ ok: true, deleted_auth_users: removed });
    }
    if (action === "members") {
      const agencyId = String(body?.agency_id || "");
      if (!agencyId) return json({ error: "agency_id required" }, 400);
      const { data, error } = await admin.rpc("admin_agency_members", { p_agency_id: agencyId });
      if (error) return json({ error: error.message }, 500);
      return json({ members: data });
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
