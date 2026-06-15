// Supabase Edge Function: extract-business-info
// 사업자등록증 이미지/PDF → Claude Vision OCR → 구조화 JSON 반환.
// API 키는 이 함수의 시크릿에만 보관 — 프론트 노출 금지. (email-send와 동일 패턴)
//
// 배포:
//   supabase functions deploy extract-business-info --no-verify-jwt
// 시크릿 설정:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx \
//     FN_SHARED_SECRET=원하는임의문자열(email-send와 같은 값 사용 가능)
//
// 프론트(.env): VITE_OCR_FN_URL=https://<project>.supabase.co/functions/v1/extract-business-info
//               VITE_OCR_FN_SECRET=위 FN_SHARED_SECRET 와 동일

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-fn-secret, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (k: string) => (globalThis as any).Deno?.env.get(k) || "";

// Claude 응답에서 코드펜스나 앞뒤 잡텍스트를 제거하고 JSON만 추출
const parseJsonLoose = (raw: string): any => {
  let s = String(raw || "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(s); } catch { /* fall through */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error("JSON 파싱 실패");
};

(globalThis as any).Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  // 공유 시크릿 검증 (설정된 경우)
  const shared = env("FN_SHARED_SECRET");
  if (shared && req.headers.get("x-fn-secret") !== shared) return json({ success: false, error: "unauthorized" }, 401);

  let p: any;
  try { p = await req.json(); } catch { return json({ success: false, error: "bad json" }, 400); }

  const imageBase64 = String(p?.imageBase64 || "");
  const mediaType = String(p?.mediaType || "");
  if (!imageBase64) return json({ success: false, error: "이미지 데이터 없음" }, 400);

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ success: false, error: "ANTHROPIC_API_KEY 미설정" }, 500);

  // 이미지(image/*)는 image 블록, PDF는 document 블록으로 전달
  const isPdf = mediaType === "application/pdf";
  const sourceBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: imageBase64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 } };

  const prompt = `이 사업자등록증에서 정보를 추출해 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 반환합니다. 값이 없으면 빈 문자열("")을 쓰세요.
{
  "businessNumber": "사업자등록번호 (000-00-00000 형식, 하이픈 포함)",
  "companyName": "상호 또는 법인명",
  "representativeName": "대표자명",
  "openingDate": "개업연월일 (YYYY-MM-DD)",
  "address": "사업장 소재지 전체 주소",
  "businessType": "업태",
  "businessItem": "종목",
  "corporateNumber": "법인등록번호 (없으면 빈 문자열)"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: [sourceBlock, { type: "text", text: prompt }] }],
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.error("[anthropic error]", res.status, errTxt);
      return json({ success: false, error: "사업자등록증 인식 실패 (AI 호출 오류)" }, 502);
    }

    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
      : "";
    const parsed = parseJsonLoose(text);

    return json({ success: true, data: parsed });
  } catch (e: any) {
    console.error("[extract-business-info]", e?.message || e);
    return json({ success: false, error: "사업자등록증을 인식하지 못했습니다." }, 400);
  }
});
