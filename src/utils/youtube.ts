import { CrossfaderCurve, SampleTrack } from '../types';

/**
 * Extracts YouTube Video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // Standard v parameter
  const matchStandard = url.match(/[?&]v=([^&]+)/);
  if (matchStandard && matchStandard[1]) {
    return matchStandard[1].trim();
  }

  // Short URL (youtu.be/ID)
  const matchShort = url.match(/youtu\.be\/([^?&#]+)/);
  if (matchShort && matchShort[1]) {
    return matchShort[1].trim();
  }

  // Embed URL (youtube.com/embed/ID)
  const matchEmbed = url.match(/youtube\.com\/embed\/([^?&#]+)/);
  if (matchEmbed && matchEmbed[1]) {
    return matchEmbed[1].trim();
  }

  // Raw 11 character ID check
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }

  return null;
}

export interface YouTubeVideoMeta {
  title: string;
  author?: string;
  thumbnailUrl?: string;
}

/**
 * Fetch video metadata (title, author, thumbnail) using YouTube oEmbed API
 */
export async function fetchYouTubeVideoMeta(videoId: string): Promise<YouTubeVideoMeta | null> {
  if (!videoId) return null;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || '',
      author: data.author_name || '',
      thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch (e) {
    console.warn('oEmbed fetch error:', e);
    return null;
  }
}

/**
 * Format seconds into MM:SS.ms display
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const padSecs = secs < 10 ? `0${secs}` : `${secs}`;
  const padMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${padMins}:${padSecs}`;
}

/**
 * Calculate volume gain for Left (Deck A) and Right (Deck B) given Crossfader position (-1 to +1 or 0 to 1)
 * crossfaderPos: 0 (100% Left, 0% Right) to 1 (0% Left, 100% Right)
 */
export function calculateCrossfaderGains(
  pos: number, // 0 (Left) to 1 (Right)
  curve: CrossfaderCurve = 'smooth'
): { leftGain: number; rightGain: number } {
  // Ensure bound
  const p = Math.max(0, Math.min(1, pos));

  if (curve === 'sharp') {
    // Sharp DJ Cut curve (ideal for hip hop scratch / quick crossfading)
    const leftGain = p >= 0.9 ? (1 - p) * 10 : 1;
    const rightGain = p <= 0.1 ? p * 10 : 1;
    return {
      leftGain: Math.min(1, Math.max(0, leftGain)),
      rightGain: Math.min(1, Math.max(0, rightGain)),
    };
  } else if (curve === 'linear') {
    // Standard Linear
    return {
      leftGain: 1 - p,
      rightGain: p,
    };
  } else {
    // Smooth Equal Power Curve (cos / sin)
    const leftGain = Math.cos(p * (Math.PI / 2));
    const rightGain = Math.sin(p * (Math.PI / 2));
    return { leftGain, rightGain };
  }
}

/**
 * Curated preset DJ sample tracks for quick testing
 */
export const SAMPLE_TRACKS: SampleTrack[] = [
  {
    id: 'track-1',
    title: 'Funk & Disco Groove Beat 124 BPM',
    artist: 'Royalty Free DJ Beat',
    bpm: 124,
    genre: 'Funk / House',
    youtubeId: 'kJQP7kiw5Fk',
    youtubeUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
  },
  {
    id: 'track-2',
    title: 'Electronic Synthwave Club Mix',
    artist: 'Retrowave Beats',
    bpm: 128,
    genre: 'Synthwave / Dance',
    youtubeId: 'fJ9rUzIMcZQ',
    youtubeUrl: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
  },
  {
    id: 'track-3',
    title: 'Hip Hop Boom Bap Scratch Beat',
    artist: 'Breakbeat DJ Tools',
    bpm: 95,
    genre: 'Hip Hop / Scratch',
    youtubeId: 'L_LUpnjgPso',
    youtubeUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
  },
  {
    id: 'track-4',
    title: 'Lo-Fi Chill Hop Beat for Mixing',
    artist: 'Chillout Sessions',
    bpm: 85,
    genre: 'Lo-Fi / Chill',
    youtubeId: 'jfKfPfyJRdk',
    youtubeUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
  {
    id: 'track-5',
    title: 'Deep House Sunset DJ Set',
    artist: 'EDM Mix Studio',
    bpm: 122,
    genre: 'Deep House',
    youtubeId: '5qap5aO4i9A',
    youtubeUrl: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
  },
];
