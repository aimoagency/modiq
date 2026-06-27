// ═══════════════════════════════════════════════════════════════
// 영상 임베드 유틸 (Phase 1 — 외부 링크 임베드 / 저장·대역폭 0)
//  - YouTube / Vimeo URL → {provider,id,embed,thumb} 로 정규화.
//  - 자사 호스팅(Bunny/Cloudflare Stream)은 Phase 2에서 같은 VideoRef 형태로 확장.
// ═══════════════════════════════════════════════════════════════
export interface VideoRef {
  provider: "youtube" | "vimeo";
  id: string;
  url: string;    // 원본 입력 URL(기록용)
  embed: string;  // iframe src
  thumb: string;  // 썸네일 URL(없으면 "")
  title?: string;
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
      thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
  }
  // Vimeo: vimeo.com/123456789 (썸네일은 oEmbed로 비동기 조회)
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    const id = vm[1];
    return { provider: "vimeo", id, url,
      embed: `https://player.vimeo.com/video/${id}`, thumb: "" };
  }
  return null;
};

// Vimeo 썸네일/제목은 공개 oEmbed로 1회 조회(실패해도 무시 → 플레이어 자체 포스터 사용).
export const fetchVimeoMeta = async (id: string): Promise<{ thumb: string; title: string }> => {
  try {
    const r = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}`);
    const j = await r.json();
    return { thumb: j?.thumbnail_url || "", title: j?.title || "" };
  } catch { return { thumb: "", title: "" }; }
};
