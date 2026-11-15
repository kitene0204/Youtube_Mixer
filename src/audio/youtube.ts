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
