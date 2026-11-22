// 유튜브 플레이어 불러오기 도우미

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allow: boolean): void;
  setVolume(v: number): void;
  setPlaybackRate(r: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  cueVideoById(id: string): void;
  getVideoData(): { title: string; author: string };
  destroy(): void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
export function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function extractYouTubeId(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  const pats = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/,
  ];
  for (const p of pats) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

export async function fetchMeta(id: string): Promise<{ title: string; author: string } | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`);
    if (!r.ok) return null;
    const d = await r.json();
    return { title: d.title || '', author: d.author_name || '' };
  } catch {
    return null;
  }
}

// ---------- 대체 영상 검색 (임베드 차단 시) ----------
// 빌드할 때 VITE_YT_API_KEY 환경변수로 유튜브 Data API v3 키를 심어 둬야 동작한다.
// (Google Cloud Console에서 "YouTube Data API v3"를 켠 다음, HTTP 리퍼러를 내 도메인으로
//  제한한 API 키를 만들어서 쓰면 안전하다. 키가 없으면 이 기능은 조용히 꺼진다.)
export interface AltVideo {
  id: string;
  title: string;
  channel: string;
  thumb: string;
}

export function hasYouTubeApiKey(): boolean {
  return !!(import.meta.env.VITE_YT_API_KEY && String(import.meta.env.VITE_YT_API_KEY).trim());
}

export async function searchAlternatives(query: string, max = 6): Promise<AltVideo[]> {
  const key = import.meta.env.VITE_YT_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true', // 임베드 가능한 영상만 서버에서 걸러서 돌려준다
    maxResults: String(max),
    q: query,
    key: String(key),
  });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!r.ok) throw new Error(`YouTube search failed (${r.status})`);
  const d = await r.json();
  const items: any[] = d.items || [];
  return items
    .filter((it) => it?.id?.videoId)
    .map((it) => ({
      id: it.id.videoId as string,
      title: (it.snippet?.title as string) || '',
      channel: (it.snippet?.channelTitle as string) || '',
      thumb: (it.snippet?.thumbnails?.default?.url as string) || '',
    }));
}
