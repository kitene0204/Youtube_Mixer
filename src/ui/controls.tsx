import { capture } from './capture';
import { useEffect, useRef, type CSSProperties } from 'react';
import { engine } from '../audio/engine';

/** 돌리는 노브: 위/아래로 끌거나 마우스 휠, 더블클릭하면 원위치 */
export function Knob(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  def?: number;
  bipolar?: boolean;
  size?: number;
  color?: string;
  onChange: (v: number) => void;
  sub?: string;
}) {
  const { label, value, min = -1, max = 1, def = 0, bipolar = true, size = 46, color = '#cfe3ff', onChange, sub } = props;
  const drag = useRef<{ y: number; v: number } | null>(null);
  const norm = (value - min) / (max - min);
  const ang = -135 + norm * 270;
  const r = size / 2 - 4;
  const cx = size / 2;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return [cx + r * Math.cos(rad), cx + r * Math.sin(rad)];
    };
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M${x0} ${y0} A${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
  };
  const from = bipolar ? 0 : -135;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="knob" style={{ width: size + 12 }}>
      <div className="knob-label">{label}</div>
      <svg
        width={size}
        height={size}
        className="knob-svg"
        onPointerDown={(e) => {
          capture(e);
          drag.current = { y: e.clientY, v: value };
          engine.resume();
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const fine = e.shiftKey ? 0.25 : 1;
          const dv = ((drag.current.y - e.clientY) / 160) * (max - min) * fine;
          let v = clamp(drag.current.v + dv);
          if (bipolar && Math.abs(v - def) < (max - min) * 0.02) v = def;
          onChange(v);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => onChange(def)}
        onWheel={(e) => onChange(clamp(value - Math.sign(e.deltaY) * (max - min) * 0.03))}
      >
        <path d={arc(-135, 135)} stroke="#263244" strokeWidth="3" fill="none" strokeLinecap="round" />
        {Math.abs(ang - from) > 1 && (
          <path d={arc(Math.min(from, ang), Math.max(from, ang))} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
        <circle cx={cx} cy={cx} r={r - 5} fill="url(#knobGrad)" stroke="#0b1018" strokeWidth="1" />
        <line
          x1={cx}
          y1={cx - (r - 7)}
          x2={cx}
          y2={cx - (r - 16)}
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          transform={`rotate(${ang} ${cx} ${cx})`}
        />
      </svg>
      {sub && <div className="knob-sub">{sub}</div>}
    </div>
  );
}

/** 밀어 올리는 페이더 (세로/가로) */
export function Fader(props: {
  value: number;
  onChange: (v: number) => void;
  horizontal?: boolean;
  length?: number;
  def?: number;
  invert?: boolean;
  center?: boolean;
  className?: string;
  ticks?: number;
}) {
  const { value, onChange, horizontal, length = 150, def, invert, center, className = '', ticks = 10 } = props;
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<number | null>(null);
  const pos = invert ? 1 - value : value;
  const fromEvent = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    let p = horizontal ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
    p = Math.max(0, Math.min(1, p));
    return invert ? 1 - p : p;
  };
  const style: CSSProperties = horizontal ? { width: length } : { height: length };
  return (
    <div
      ref={ref}
      className={`fader ${horizontal ? 'h' : 'v'} ${className}`}
      style={style}
      onPointerDown={(e) => {
        engine.resume();
        capture(e);
        const v = fromEvent(e);
        grab.current = Math.abs(v - value) < 0.06 ? v - value : 0;
        onChange(Math.max(0, Math.min(1, v - grab.current)));
      }}
      onPointerMove={(e) => {
        if (grab.current == null) return;
        let v = Math.max(0, Math.min(1, fromEvent(e) - grab.current));
        if (center && Math.abs(v - 0.5) < 0.015) v = 0.5;
        onChange(v);
      }}
      onPointerUp={() => (grab.current = null)}
      onDoubleClick={() => def != null && onChange(def)}
    >
      <div className="fader-ticks">
        {Array.from({ length: ticks + 1 }, (_, i) => (
          <i key={i} style={horizontal ? { left: `${(i / ticks) * 100}%` } : { top: `${(i / ticks) * 100}%` }} />
        ))}
      </div>
      <div className="fader-slot" />
      <div
        className="fader-cap"
        style={horizontal ? { left: `${pos * 100}%` } : { top: `${(1 - pos) * 100}%` }}
      />
    </div>
  );
}

/** 레벨 미터 (매 프레임 직접 그림) */
export function Meter({ get, segments = 15 }: { get: () => number; segments?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let hold = 0;
    return engine.onFrame(() => {
      const el = ref.current;
      if (!el) return;
      const v = get();
      const db = 20 * Math.log10(Math.max(v, 1e-5));
      const lit = Math.max(0, Math.min(segments, Math.round(((db + 30) / 30) * segments)));
      hold = lit >= hold ? lit : hold - 0.15;
      const kids = el.children;
      for (let i = 0; i < kids.length; i++) {
        const idx = segments - 1 - i;
        (kids[i] as HTMLElement).classList.toggle('on', idx < lit || idx === Math.floor(hold) - 1);
      }
    });
  }, [get, segments]);
  return (
    <div className="meter" ref={ref}>
      {Array.from({ length: segments }, (_, i) => {
        const idx = segments - 1 - i;
        const cls = idx >= segments - 2 ? 'r' : idx >= segments - 5 ? 'o' : 'g';
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}
