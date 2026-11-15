import { capture } from './capture';
import { useEffect, useRef } from 'react';
import { engine } from '../audio/engine';
import { PEAKS_PER_SEC } from '../audio/analysis';
import { HOTCUE_COLORS, type Deck } from '../audio/deck';

function fit(c: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(c.clientWidth * dpr);
  const h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return { w, h, dpr };
}

// 데크마다 색: 1번 = 주황(저음)+하늘(고음), 2번 = 파랑(저음)+청록(고음)
const PAL = [
  { lo: [255, 168, 38], hi: [190, 220, 255] },
  { lo: [30, 120, 255], hi: [90, 235, 255] },
];
function waveColor(low: number, a: number, deck = 0) {
  const p = PAL[deck] || PAL[0];
  const m = Math.min(1, low * 1.4);
  const c = (i: number) => Math.round(p.hi[i] + (p.lo[i] - p.hi[i]) * m);
  return `rgba(${c(0)},${c(1)},${c(2)},${a})`;
}

// ---------- 유튜브용 "박자 모양" 파형 ----------
// 유튜브 소리는 브라우저가 읽을 수 없어서, BPM(박자)과 영상 번호로 모양만 그린다 (실제 소리 아님)
function hash(n: number) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}
function seedOf(id: string) {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h;
}
function fakeAt(seed: number, t: number, bpm: number, fb: number, dur: number) {
  if (t < 0 || (dur && t > dur)) return { a: 0, lo: 0 };
  const beat = 60 / bpm;
  const b = (t - fb) / beat;
  const ph = ((b % 1) + 1) % 1;
  const kick = Math.exp(-ph * 9);
  const hp = (((b * 2) % 1) + 1) % 1;
  const hat = Math.exp(-hp * 14) * 0.35;
  const sec = Math.floor(b / 16);
  const energy = 0.55 + 0.45 * hash(seed + sec * 7919);
  const fade = Math.max(0, Math.min(1, t / 4, dur ? (dur - t) / 4 : 1));
  const n = hash(seed + Math.floor(t * 60));
  return { a: fade * energy * Math.min(1, 0.22 + 0.55 * kick + hat + 0.2 * n), lo: 0.15 + 0.85 * kick };
}

/** 위쪽 확대 파형 (렉서박스처럼 가운데 선이 지금 위치) */
export function ZoomWave({ deck, accent }: { deck: Deck; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(
    () =>
      engine.onFrame(() => {
        const c = ref.current;
        if (!c) return;
        const { w, h, dpr } = fit(c);
        const x = c.getContext('2d')!;
        x.clearRect(0, 0, w, h);
        const s = deck.state;
        const t = deck.time;
        const span = 7; // 화면에 보이는 초
        const pxPerSec = w / span;
        const t0 = t - span / 2;
        const mid = h / 2;
        // 박자 선
        if (s.baseBpm && (deck.hasGrid || s.kind === 'youtube')) {
          const b = 60 / s.baseBpm;
          let n = Math.ceil((t0 - deck.firstBeat) / b);
          for (; ; n++) {
            const bt = deck.firstBeat + n * b;
            if (bt > t0 + span) break;
            const px = (bt - t0) * pxPerSec;
            const bar = ((n % 4) + 4) % 4 === 0;
            x.fillStyle = bar ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
            x.fillRect(px, 0, bar ? 1.5 * dpr : dpr, h);
          }
        }
        // 루프 구간
        const l = s.loop;
        if (l.in != null) {
          const a = (l.in - t0) * pxPerSec;
          const bb = l.out != null ? (l.out - t0) * pxPerSec : a + 2 * dpr;
          x.fillStyle = l.on ? 'rgba(255,159,10,0.22)' : 'rgba(255,255,255,0.08)';
          x.fillRect(a, 0, bb - a, h);
        }
        const p = deck.peaks;
        if (p && deck.buffer) {
          const step = Math.max(1, Math.floor(dpr));
          for (let px = 0; px < w; px += step) {
            const tt = t0 + px / pxPerSec;
            if (tt < 0 || tt > s.duration) continue;
            const i = Math.floor(tt * PEAKS_PER_SEC);
            const a = p.amp[i] || 0;
            const lo = p.low[i] || 0;
            const hh = a * (h * 0.46);
            x.fillStyle = waveColor(lo, px < w / 2 ? 0.5 : 1, deck.index);
            x.fillRect(px, mid - hh, step, hh * 2);
          }
        } else if (s.kind === 'youtube' && s.ytId) {
          const seed = seedOf(s.ytId);
          const bpm = s.baseBpm || 120;
          const step = Math.max(1, Math.floor(dpr));
          for (let px = 0; px < w; px += step) {
            const tt = t0 + px / pxPerSec;
            const f = fakeAt(seed, tt, bpm, deck.firstBeat, s.duration);
            const hh = f.a * (h * 0.42);
            x.fillStyle = waveColor(f.lo, px < w / 2 ? 0.35 : 0.75, deck.index);
            x.fillRect(px, mid - hh, step, hh * 2);
          }
          x.fillStyle = 'rgba(255,255,255,0.4)';
          x.font = `${9 * dpr}px "Noto Sans KR", sans-serif`;
          x.textAlign = 'left';
          x.fillText(s.baseBpm ? 'YOUTUBE · 박자 모양 파형' : 'YOUTUBE · 박자 모양 파형 (TAP으로 박자 맞추기)', 6 * dpr, 12 * dpr);
        }
        // 큐 표시
        const mark = (time: number, col: string) => {
          const px = (time - t0) * pxPerSec;
          if (px < -10 || px > w + 10) return;
          x.fillStyle = col;
          x.beginPath();
          x.moveTo(px - 5 * dpr, 0);
          x.lineTo(px + 5 * dpr, 0);
          x.lineTo(px, 7 * dpr);
          x.fill();
          x.fillRect(px - 0.5 * dpr, 0, dpr, h);
        };
        if (s.kind !== 'none') mark(s.cue, '#ff9f0a');
        s.hotcues.forEach((hc, i) => hc != null && mark(hc, HOTCUE_COLORS[i]));
        // 재생 위치 선
        x.fillStyle = accent;
        x.fillRect(w / 2 - dpr, 0, 2 * dpr, h);
      }),
    [deck, accent],
  );
  return <canvas ref={ref} className="zoomwave" />;
}

/** 곡 전체 미리보기 파형 — 누르거나 끌면 그 위치로 이동 */
export function Overview({ deck }: { deck: Deck }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cache = useRef<{ key: unknown; img: HTMLCanvasElement | null }>({ key: null, img: null });
  useEffect(
    () =>
      engine.onFrame(() => {
        const c = ref.current;
        if (!c) return;
        const { w, h, dpr } = fit(c);
        const x = c.getContext('2d')!;
        const s = deck.state;
        const key = `${w}x${h}:${String(deck.peaks?.amp.length)}:${s.title}:${s.ytId}:${s.duration}:${s.baseBpm}`;
        if (cache.current.key !== key) {
          const off = document.createElement('canvas');
          off.width = w;
          off.height = h;
          const o = off.getContext('2d')!;
          const p = deck.peaks;
          if (p) {
            const n = p.amp.length;
            for (let px = 0; px < w; px++) {
              const i0 = Math.floor((px / w) * n);
              const i1 = Math.max(i0 + 1, Math.floor(((px + 1) / w) * n));
              let a = 0;
              let lo = 0;
              for (let i = i0; i < i1; i++) {
                if (p.amp[i] > a) a = p.amp[i];
                lo += p.low[i];
              }
              lo /= i1 - i0;
              const hh = a * h * 0.48;
              o.fillStyle = waveColor(lo, 0.9, deck.index);
              o.fillRect(px, h / 2 - hh, 1, hh * 2);
            }
          } else if (s.kind === 'youtube' && s.ytId && s.duration) {
            const seed = seedOf(s.ytId);
            for (let px = 0; px < w; px++) {
              let a = 0;
              let lo = 0;
              for (let k = 0; k < 6; k++) {
                const f = fakeAt(seed, ((px + k / 6) / w) * s.duration, s.baseBpm || 120, deck.firstBeat, s.duration);
                if (f.a > a) a = f.a;
                lo += f.lo / 6;
              }
              const hh = a * h * 0.45;
              o.fillStyle = waveColor(lo, 0.6, deck.index);
              o.fillRect(px, h / 2 - hh, 1, hh * 2);
            }
          } else {
            o.fillStyle = 'rgba(255,255,255,0.1)';
            o.fillRect(0, h / 2 - dpr, w, 2 * dpr);
          }
          cache.current = { key, img: off };
        }
        x.clearRect(0, 0, w, h);
        if (cache.current.img) x.drawImage(cache.current.img, 0, 0);
        const d = s.duration || 1;
        const px = (deck.time / d) * w;
        x.fillStyle = 'rgba(0,0,0,0.5)';
        x.fillRect(0, 0, px, h);
        s.hotcues.forEach((hc, i) => {
          if (hc == null) return;
          x.fillStyle = HOTCUE_COLORS[i];
          x.fillRect((hc / d) * w - dpr, 0, 2 * dpr, h);
        });
        x.fillStyle = '#ff3b30';
        x.fillRect(px - dpr, 0, 2 * dpr, h);
      }),
    [deck],
  );
  const seek = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    deck.seek(f * (deck.state.duration || 0));
  };
  return (
    <canvas
      ref={ref}
      className="overview"
      onPointerDown={(e) => {
        capture(e);
        seek(e);
      }}
      onPointerMove={(e) => e.buttons && seek(e)}
    />
  );
}
