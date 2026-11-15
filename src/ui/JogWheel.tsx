import { capture } from './capture';
import { useEffect, useRef } from 'react';
import { engine } from '../audio/engine';
import { SEC_PER_REV, type Deck } from '../audio/deck';

const R_PROG = 92;
const C_PROG = 2 * Math.PI * R_PROG;

const fmtShort = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * 조그 휠: 윗면을 잡고 돌리면 스크래치, 바깥 테두리를 돌리면 속도 살짝 밀기(피치 벤드)
 * 가운데 화면에는 남은 시간 · BPM · 상태가 나온다 (터치 DJ 앱 스타일)
 */
export function JogWheel({ deck, size }: { deck: Deck; size: number }) {
  const rot = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const prog = useRef<SVGCircleElement>(null);
  const tRef = useRef<HTMLDivElement>(null);
  const stRef = useRef<HTMLDivElement>(null);
  const g = useRef<{ mode: 'scratch' | 'bend'; a: number; t: number } | null>(null);
  const s = deck.state;

  useEffect(
    () =>
      engine.onFrame(() => {
        const st = deck.state;
        if (rot.current) rot.current.style.transform = `rotate(${deck.angle}rad)`;
        root.current?.classList.toggle('touching', deck.touching);
        root.current?.classList.toggle('playing', st.playing);
        const t = deck.time;
        const d = st.duration;
        if (prog.current) prog.current.style.strokeDashoffset = String(C_PROG * (1 - (d ? Math.min(1, t / d) : 0)));
        if (tRef.current) tRef.current.textContent = st.kind === 'none' ? '-:--' : d ? '-' + fmtShort(d - t) : fmtShort(t);
        if (stRef.current) {
          const label = deck.touching ? 'SCRATCH' : st.loading ? 'LOADING' : st.kind === 'none' ? 'NO TRACK' : st.playing ? 'PLAYING' : 'PAUSED';
          if (stRef.current.textContent !== label) stRef.current.textContent = label;
        }
      }),
    [deck],
  );

  const angleOf = (e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    return { a: Math.atan2(y, x), d: Math.hypot(x, y) / (r.width / 2) };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    capture(e);
    const { a, d } = angleOf(e);
    const mode = d < 0.8 && deck.state.vinyl ? 'scratch' : 'bend';
    g.current = { mode, a, t: performance.now() };
    if (mode === 'scratch') deck.touchStart();
  };
  const move = (e: React.PointerEvent) => {
    const cur = g.current;
    if (!cur) return;
    const { a } = angleOf(e);
    let da = a - cur.a;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    const now = performance.now();
    const dt = Math.max(1, now - cur.t) / 1000;
    cur.a = a;
    cur.t = now;
    const revs = da / (Math.PI * 2);
    if (cur.mode === 'scratch') deck.scratchMove(revs * SEC_PER_REV);
    else deck.bend((revs / dt) * 0.35);
  };
  const up = () => {
    if (g.current?.mode === 'scratch') deck.touchEnd();
    g.current = null;
  };

  const thumb = s.kind === 'youtube' && s.ytId ? `https://i.ytimg.com/vi/${s.ytId}/hqdefault.jpg` : null;
  const bpm = deck.bpm;

  return (
    <div
      ref={root}
      className="jog"
      style={{ width: size, height: size }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <svg className="jog-svg" viewBox="0 0 200 200">
        <circle className="jog-ticks" cx="100" cy="100" r="97" />
        <circle className="jog-track" cx="100" cy="100" r={R_PROG} />
        <circle
          ref={prog}
          className="jog-prog"
          cx="100"
          cy="100"
          r={R_PROG}
          strokeDasharray={C_PROG}
          strokeDashoffset={C_PROG}
          transform="rotate(-90 100 100)"
        />
      </svg>
      <div className="jog-platter" ref={rot}>
        <div className="jog-mark" />
      </div>
      <div className="jog-center" style={thumb ? ({ '--thumb': `url(${thumb})` } as React.CSSProperties) : undefined}>
        <div className="jc-deck">DECK {deck.label}</div>
        <div className="jc-time" ref={tRef}>
          -:--
        </div>
        <div className="jc-bpm">{bpm ? `${bpm.toFixed(1)} BPM` : '--- BPM'}</div>
        <div className="jc-state" ref={stRef}>
          PAUSED
        </div>
      </div>
    </div>
  );
}
