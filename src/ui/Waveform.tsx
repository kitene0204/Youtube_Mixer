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
        if (s.baseBpm && deck.hasGrid) {
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
        } else if (s.kind === 'youtube') {
          x.fillStyle = 'rgba(255,255,255,0.28)';
          x.font = `${11 * dpr}px "JetBrains Mono", monospace`;
          x.textAlign = 'center';
          x.fillText('YOUTUBE · 파형 표시 없음', w / 2, mid + 4 * dpr);
          // 지나가는 눈금
          for (let k = Math.floor(t0); k < t0 + span; k++) {
            const px = (k - t0) * pxPerSec;
            x.fillStyle = 'rgba(255,255,255,0.12)';
            x.fillRect(px, h - 8 * dpr, dpr, 8 * dpr);
          }
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
        const key = `${w}x${h}:${String(deck.peaks?.amp.length)}:${s.title}`;
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
