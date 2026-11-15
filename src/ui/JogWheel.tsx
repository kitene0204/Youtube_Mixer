import { capture } from './capture';
import { useEffect, useRef } from 'react';
import { engine } from '../audio/engine';
import { SEC_PER_REV, type Deck } from '../audio/deck';

/**
 * 조그 휠: 윗면을 잡고 돌리면 스크래치, 바깥 테두리를 돌리면 속도 살짝 밀기(피치 벤드)
 */
export function JogWheel({ deck, size }: { deck: Deck; size: number }) {
  const rot = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const g = useRef<{ mode: 'scratch' | 'bend'; a: number; t: number } | null>(null);
  const s = deck.state;

  useEffect(
    () =>
      engine.onFrame(() => {
        if (rot.current) rot.current.style.transform = `rotate(${deck.angle}rad)`;
        root.current?.classList.toggle('touching', deck.touching);
        root.current?.classList.toggle('spinning', deck.state.playing);
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
      <div className="jog-ring" ref={rot}>
        <div className="jog-grip" />
        <div className="jog-top">
          <div className="jog-grooves" />
          <div className="jog-mark" />
          <div className="jog-label" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}>
            {!thumb && <span>{deck.label}</span>}
          </div>
        </div>
      </div>
      <div className="jog-glow" />
    </div>
  );
}
