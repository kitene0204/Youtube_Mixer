import { useCallback } from 'react';
import { engine } from '../audio/engine';
import { eqDb, trimDb } from '../audio/deck';
import { Fader, Knob, Meter } from './controls';

const dbText = (db: number) => (db <= -25.9 ? 'KILL' : `${db > 0 ? '+' : ''}${db.toFixed(1)}dB`);

function Channel({ i }: { i: number }) {
  const d = engine.decks[i];
  const s = d.state;
  const set = (p: Parameters<typeof engine.setChannel>[1]) => engine.setChannel(i, p);
  return (
    <div className="ch">
      <Knob label="TRIM" value={s.trim} onChange={(v) => set({ trim: v })} sub={dbText(trimDb(s.trim))} size={40} />
      <div className="eq-group">
        <Knob label="HI" value={s.hi} onChange={(v) => set({ hi: v })} sub={dbText(eqDb(s.hi))} />
        <Knob label="MID" value={s.mid} onChange={(v) => set({ mid: v })} sub={dbText(eqDb(s.mid))} />
        <Knob label="LOW" value={s.lo} onChange={(v) => set({ lo: v })} sub={dbText(eqDb(s.lo))} />
      </div>
      <Knob
        label="CFX"
        value={s.cfx}
        onChange={(v) => set({ cfx: v })}
        color={s.cfx < -0.03 ? '#0a84ff' : s.cfx > 0.03 ? '#ff9f0a' : '#e8e8ea'}
        sub={s.cfx < -0.03 ? 'LOW PASS' : s.cfx > 0.03 ? 'HIGH PASS' : 'FILTER'}
      />
    </div>
  );
}

export function Mixer({ faderLen }: { faderLen: number }) {
  const m0 = useCallback(() => engine.decks[0].meter, []);
  const m1 = useCallback(() => engine.decks[1].meter, []);
  const mm = useCallback(() => engine.masterMeter, []);
  const d0 = engine.decks[0].state;
  const d1 = engine.decks[1].state;
  return (
    <section className="mixer">
      <div className="mixer-top">
        <Knob label="MASTER" value={engine.masterLevel} min={0} max={1} def={0.8} bipolar={false} onChange={(v) => engine.setMaster(v)} size={42} />
        <div className="master-meter">
          <Meter get={mm} segments={12} />
          <span>MASTER</span>
        </div>
        <div className="curve">
          <span>X-FADER</span>
          <div className="seg">
            <button className={engine.curve === 'smooth' ? 'on' : ''} onClick={() => engine.setCurve('smooth')} title="부드럽게 섞기">
              MIX
            </button>
            <button className={engine.curve === 'cut' ? 'on' : ''} onClick={() => engine.setCurve('cut')} title="스크래치용: 살짝만 밀어도 소리가 확 켜지고 꺼짐">
              SCRATCH
            </button>
          </div>
        </div>
      </div>
      <div className="channels">
        <Channel i={0} />
        <div className="ch-meters">
          <Meter get={m0} />
          <Meter get={m1} />
        </div>
        <Channel i={1} />
      </div>
      <div className="faders">
        <div className="fader-col">
          <Fader value={d0.fader} onChange={(v) => engine.setChannel(0, { fader: v })} length={faderLen} />
          <span>CH 1</span>
        </div>
        <div className="fader-col">
          <Fader value={d1.fader} onChange={(v) => engine.setChannel(1, { fader: v })} length={faderLen} />
          <span>CH 2</span>
        </div>
      </div>
      <div className="xf">
        <span className="xl">1</span>
        <Fader value={engine.xf} onChange={(v) => engine.setXf(v)} horizontal length={190} def={0.5} center className="xfader" ticks={8} />
        <span className="xl">2</span>
      </div>
    </section>
  );
}
