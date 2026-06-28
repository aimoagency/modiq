// ═══════════════════════════════════════════════════════════════
// 영상 임베드 유틸 (Phase 1 — 외부 링크 임베드 / 저장·대역폭 0)
//  - YouTube / Vimeo URL → {provider,id,embed,thumb} 로 정규화.
//  - 자사 호스팅(Bunny/Cloudflare Stream)은 Phase 2에서 같은 VideoRef 형태로 확장.
// ═══════════════════════════════════════════════════════════════
export type VideoProvider = "youtube" | "vimeo" | "instagram" | "tiktok";
export const VIDEO_LABEL: Record<VideoProvider, string> = {
  youtube: "YouTube", vimeo: "Vimeo", instagram: "Instagram", tiktok: "TikTok",
};

export interface VideoRef {
  provider: VideoProvider;
  id: string;
  url: string;    // 원본 입력 URL(기록용)
  embed: string;  // iframe src
  thumb: string;  // 썸네일 URL(없으면 "")
  title?: string;
  vertical?: boolean; // 9:16 세로형(쇼츠·릴스·틱톡). 자동 감지 + 수동 토글 가능
}

// URL 파싱 — 인식 못 하면 null.
export const parseVideoUrl = (raw: string): VideoRef | null => {
  const url = (raw || "").trim();
  if (!url) return null;
  // YouTube: watch?v= / youtu.be/ / shorts/ / embed/ / live/
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    return { provider: "youtube", id, url,
      embed: `https://www.youtube.com/embed/${id}`,
      thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      vertical: /youtube\.com\/shorts\//.test(url) }; // 쇼츠 = 세로 자동
  }
  // Vimeo: vimeo.com/123456789 (썸네일·비율은 oEmbed로 비동기 조회)
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    const id = vm[1];
    return { provider: "vimeo", id, url,
      embed: `https://player.vimeo.com/video/${id}`, thumb: "", vertical: false };
  }
  // TikTok: .../@user/video/1234567890 (전체 URL 필요 — vm.tiktok.com 단축링크는 불가). 항상 세로.
  const tk = url.match(/tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|embed\/v2\/|player\/v1\/)(\d+)/);
  if (tk) {
    const id = tk[1];
    return { provider: "tiktok", id, url,
      embed: `https://www.tiktok.com/player/v1/${id}`, thumb: "", vertical: true };
  }
  // Instagram: /reel|reels|p|tv/{shortcode}. 릴스는 세로 기본.
  const ig = url.match(/instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (ig) {
    const kind = ig[1] === "reels" ? "reel" : ig[1];
    const code = ig[2];
    return { provider: "instagram", id: `${kind}:${code}`, url,
      embed: `https://www.instagram.com/${kind}/${code}/embed`, thumb: "", vertical: kind === "reel" };
  }
  return null;
};

// 제공자별 메타(썸네일/제목/비율) 보강 — 공개 oEmbed 1회 조회(실패·CORS 시 원본 유지).
// Vimeo·TikTok만 공개 oEmbed 지원(인스타는 토큰 필요 → 임베드 카드가 자체 표시).
export const enrichVideo = async (v: VideoRef): Promise<VideoRef> => {
  try {
    if (v.provider === "vimeo") {
      const j = await (await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${v.id}`)).json();
      const w = Number(j?.width) || 0, h = Number(j?.height) || 0;
      return { ...v, thumb: j?.thumbnail_url || "", title: j?.title || "", vertical: w > 0 && h > 0 ? h > w : v.vertical };
    }
    if (v.provider === "tiktok") {
      const j = await (await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(v.url)}`)).json();
      return { ...v, thumb: j?.thumbnail_url || "", title: j?.title || "" };
    }
  } catch { /* CORS/네트워크 실패 → 썸네일 없이 진행(임베드 재생은 정상) */ }
  return v;
};
