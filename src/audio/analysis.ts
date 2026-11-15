// 파형(소리 모양 그림)과 BPM(빠르기) 계산

export const PEAKS_PER_SEC = 150;

export interface Peaks {
  amp: Float32Array; // 0..1 소리 크기
  low: Float32Array; // 0..1 저음 비율 (색깔용)
  firstBeat: number; // 첫 박 위치(초)
}

export function computePeaks(buf: AudioBuffer): Peaks {
  const sr = buf.sampleRate;
  const a = buf.getChannelData(0);
  const b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
  const hop = Math.max(1, Math.floor(sr / PEAKS_PER_SEC));
  const n = Math.floor(a.length / hop);
  const amp = new Float32Array(n);
  const low = new Float32Array(n);
  const k = 1 - Math.exp((-2 * Math.PI * 180) / sr);
  let lp = 0;
  let max = 0.0001;
  for (let i = 0; i < n; i++) {
    let pk = 0;
    let le = 0;
    let te = 0;
    const s = i * hop;
    for (let j = 0; j < hop; j++) {
      const x = (a[s + j] + b[s + j]) * 0.5;
      lp += (x - lp) * k;
      const ax = Math.abs(x);
      if (ax > pk) pk = ax;
      le += lp * lp;
      te += x * x;
    }
    amp[i] = pk;
    low[i] = te > 0 ? Math.min(1, le / te) : 0;
    if (pk > max) max = pk;
  }
  for (let i = 0; i < n; i++) amp[i] /= max;
  // 첫 박: 처음으로 크게 튀는 지점
  let firstBeat = 0;
  for (let i = 1; i < n; i++) {
    if (amp[i] > 0.5 && low[i] > 0.3) {
      firstBeat = i / PEAKS_PER_SEC;
      break;
    }
  }
  return { amp, low, firstBeat };
}

/** 간단한 BPM 추정: 소리가 커지는 순간들의 반복 간격을 찾는다 */
export function detectBpm(buf: AudioBuffer): number {
  const sr = buf.sampleRate;
  const a = buf.getChannelData(0);
  const start = Math.floor(Math.min(a.length * 0.2, sr * 20));
  const end = Math.min(a.length, start + sr * 40);
  const hop = 512;
  const frames = Math.floor((end - start) / hop);
  if (frames < 200) return 120;
  const k = 1 - Math.exp((-2 * Math.PI * 150) / sr);
  let lp = 0;
  const e = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const o = start + f * hop;
    for (let j = 0; j < hop; j++) {
      lp += (a[o + j] - lp) * k;
      s += lp * lp + a[o + j] * a[o + j] * 0.25;
    }
    e[f] = Math.sqrt(s / hop);
  }
  const on = new Float32Array(frames);
  for (let f = 1; f < frames; f++) on[f] = Math.max(0, e[f] - e[f - 1]);
  const fps = sr / hop;
  let best = 120;
  let bestScore = -1;
  for (let bpm = 70; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let score = 0;
    for (const mul of [1, 2, 4]) {
      const L = lag * mul;
      const li = Math.floor(L);
      const fr = L - li;
      let s = 0;
      for (let f = 0; f + li + 1 < frames; f++) {
        s += on[f] * (on[f + li] * (1 - fr) + on[f + li + 1] * fr);
      }
      score += s / mul;
    }
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  while (best < 85) best *= 2;
  while (best > 175) best /= 2;
  return Math.round(best * 10) / 10;
}
