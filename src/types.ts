export type DeckId = 'left' | 'right';

export interface HotCue {
  id: number;
  time: number; // in seconds
  active: boolean;
  color: string;
}

export interface LoopState {
  active: boolean;
  lengthBeats: number; // e.g. 1, 2, 4, 8, 16
  startTime: number | null;
  endTime: number | null;
}

export interface DeckState {
  id: DeckId;
  url: string;
  videoId: string | null;
  title: string;
  artist: string;
  thumbnail: string;
  isPlaying: boolean;
  volume: number; // 0 to 100
  muted: boolean;
  playbackRate: number; // 0.5 to 1.5
  currentTime: number;
  duration: number;
  bpm: number;
  isScratching: boolean;
  scratchDirection: 'forward' | 'backward' | null;
  hotCues: HotCue[];
  loop: LoopState;
  vinylMode: boolean; // True for scratch mode, False for pitch bend mode
  slipMode: boolean;
  filterValue: number; // -100 (LPF) to 0 (Flat) to +100 (HPF)
  eqLow: number; // -12 to +12 dB
  eqMid: number; // -12 to +12 dB
  eqHigh: number; // -12 to +12 dB
  gain: number; // 0 to 100
}

export interface SampleTrack {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  youtubeId: string;
  youtubeUrl: string;
  genre: string;
}

export type CrossfaderCurve = 'smooth' | 'linear' | 'sharp';
