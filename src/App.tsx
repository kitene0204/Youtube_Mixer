import { useEffect, useState, useSyncExternalStore } from 'react';
import { engine } from './audio/engine';
import { DeckPanel } from './ui/DeckPanel';
import { Mixer } from './ui/Mixer';
import { ZoomWave } from './ui/Waveform';
import { Help } from './ui/Help';

function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const f = () => setW(document.documentElement.clientWidth || window.innerWidth);
    f();
    const ro = new ResizeObserver(f);
    ro.observe(document.documentElement);
    window.addEventListener('resize', f);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', f);
    };
  }, []);
  return w;
}

export default function App() {
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  const [help, setHelp] = useState(false);
  const [shiftKey, setShiftKey] = useState(false);
  const w = useWidth();
  const wide = w >= 1180;
  // 넓은 화면: [데크1] [가운데: 파형 + 믹서] [데크2]
  const appW = Math.min(w, 1500) - 32;
  const centerW = Math.round(Math.max(400, Math.min(500, appW * 0.32)));
  const deckW = (appW - centerW - 24 - 24) / 2;
  const jog = wide ? Math.round(Math.min(310, Math.max(200, deckW - 24 - 70 - 10))) : Math.min(300, w - 130);

  useEffect(() => {
    engine.init();
    const wake = () => engine.resume();
    window.addEventListener('pointerdown', wake);
    return () => window.removeEventListener('pointerdown', wake);
  }, []);

  // ---------- 키보드 ----------
  useEffect(() => {
    const [A, B] = engine.decks;
    const held = new Set<string>();
    let xfDir = 0;
    const stopFrame = engine.onFrame(() => {
      if (xfDir) engine.setXf(engine.xf + xfDir * 0.035);
    });
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    };
    const scratchKey = (d: typeof A, dir: number, down: boolean) => {
      if (down) {
        if (!d.touching) d.touchStart();
        d.keyDir = dir;
      } else if (d.keyDir === dir) {
        d.keyDir = 0;
        d.touchEnd();
      }
    };
    const vol = (i: number, dv: number) => engine.setChannel(i, { fader: Math.max(0, Math.min(1, engine.decks[i].state.fader + dv)) });

    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftKey(true);
      if (typing(e)) return;
      engine.resume();
      if (e.code === 'ControlLeft') {
        e.preventDefault();
        xfDir = -1;
        return;
      }
      if (e.code === 'ControlRight') {
        e.preventDefault();
        xfDir = 1;
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const code = e.code;
      if (held.has(code)) {
        e.preventDefault();
        return;
      }
      held.add(code);
      const sh = e.shiftKey;
      const map: Record<string, () => void> = {
        KeyA: () => scratchKey(A, -1, true),
        KeyF: () => scratchKey(A, 1, true),
        KeyE: () => vol(0, 0.05),
        KeyD: () => vol(0, -0.05),
        KeyS: () => A.togglePlay(),
        KeyQ: () => A.cueDown(),
        KeyW: () => A.sync(),
        Digit1: () => A.hotcue(0, sh),
        Digit2: () => A.hotcue(1, sh),
        Digit3: () => A.hotcue(2, sh),
        Digit4: () => A.hotcue(3, sh),
        ArrowLeft: () => scratchKey(B, -1, true),
        ArrowRight: () => scratchKey(B, 1, true),
        ArrowUp: () => vol(1, 0.05),
        ArrowDown: () => vol(1, -0.05),
        End: () => B.togglePlay(),
        PageDown: () => B.cueDown(),
        Enter: () => B.sync(),
        Insert: () => B.hotcue(0, sh),
        Home: () => B.hotcue(1, sh),
        PageUp: () => B.hotcue(2, sh),
        Delete: () => B.hotcue(3, sh),
        Space: () => engine.setXf(0.5),
      };
      const f = map[code];
      if (f) {
        e.preventDefault();
        f();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftKey(false);
      held.delete(e.code);
      if (e.code === 'ControlLeft' && xfDir < 0) xfDir = 0;
      if (e.code === 'ControlRight' && xfDir > 0) xfDir = 0;
      if (e.code === 'KeyA') scratchKey(A, -1, false);
      if (e.code === 'KeyF') scratchKey(A, 1, false);
      if (e.code === 'ArrowLeft') scratchKey(B, -1, false);
      if (e.code === 'ArrowRight') scratchKey(B, 1, false);
      if (e.code === 'KeyQ') A.cueUp();
      if (e.code === 'PageDown') B.cueUp();
    };
    const blur = () => {
      xfDir = 0;
      held.clear();
      setShiftKey(false);
      [A, B].forEach((d) => {
        d.keyDir = 0;
        d.touchEnd();
      });
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      stopFrame();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const [A, B] = engine.decks;
  const waves = (
    <div className="waves">
      <div className="wave-row">
        <span className="wave-tag">1</span>
        <ZoomWave deck={A} accent="#ffffff" />
      </div>
      <div className="wave-row">
        <span className="wave-tag">2</span>
        <ZoomWave deck={B} accent="#ffffff" />
      </div>
    </div>
  );
  return (
    <div className="app">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="knobGrad" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#3a4a60" />
            <stop offset="60%" stopColor="#1e2836" />
            <stop offset="100%" stopColor="#121923" />
          </radialGradient>
        </defs>
      </svg>
      <header className="top">
        <div className="brand">
          <div className="logo-disc" />
          <div>
            <h1>
              YOUTUBE<span>MIXER</span>
            </h1>
            <p>2-CHANNEL WEB DJ CONTROLLER</p>
          </div>
        </div>
        <div className="top-right">
          {engine.status === 'loading' && <span className="status">소리 준비 중…</span>}
          {engine.status === 'error' && <span className="status bad">이 브라우저에서는 소리 엔진을 켤 수 없어요 (크롬을 써 주세요)</span>}
          <button className="btn help" onClick={() => setHelp(true)}>
            사용법 · 단축키
          </button>
        </div>
      </header>

      {!wide && waves}

      <main className={`console ${wide ? 'wide' : 'stack'}`}>
        <DeckPanel deck={A} jog={jog} shiftKey={shiftKey} side="L" />
        {wide ? (
          <div className="center-col" style={{ width: centerW }}>
            {waves}
            <Mixer faderLen={150} />
          </div>
        ) : (
          <Mixer faderLen={130} />
        )}
        <DeckPanel deck={B} jog={jog} shiftKey={shiftKey} side="R" />
      </main>

      <footer className="foot">
        휠 윗면을 잡고 앞뒤로 문지르면 스크래치 · 바깥 테두리를 돌리면 속도 살짝 밀기 · 파일을 데크에 끌어다 놓아도 돼요
      </footer>
      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}
