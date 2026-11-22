import { capture } from './capture';
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { HOTCUE_COLORS, type Deck, type PadMode } from '../audio/deck';
import { SAMPLE_LABELS, type SampleName } from '../audio/synth';
import { JogWheel } from './JogWheel';
import { Fader } from './controls';
import { Overview } from './Waveform';

const fmt = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${cs}`;
};

const LOOP_BEATS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
const JUMP_BEATS = [-1, 1, -2, 2, -4, 4, -8, 8];
const SAMPLE_ORDER: SampleName[] = ['horn', 'siren', 'laser', 'drop', 'kick', 'snare', 'clap', 'rewind'];
const beatLabel = (b: number) => (b === 0.25 ? '1/4' : b === 0.5 ? '1/2' : String(b));

const RECENT_KEY = 'ytmixer.recent';
function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}
function pushRecent(u: string) {
  try {
    const r = [u, ...loadRecent().filter((x) => x !== u)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(r));
  } catch {}
}

export function DeckPanel({ deck, jog, shiftKey, side }: { deck: Deck; jog: number; shiftKey: boolean; side: 'L' | 'R' }) {
  const s = deck.state;
  const [url, setUrl] = useState('');
  const [shiftBtn, setShiftBtn] = useState(false);
  const [drag, setDrag] = useState(false);
  const shift = shiftKey || shiftBtn;
  const timeRef = useRef<HTMLSpanElement>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const smpRef = useRef<HTMLInputElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);

  useEffect(() => deck.attachYouTubeHost(ytHost.current), [deck]);
  useEffect(
    () =>
      engine.onFrame((now) => {
        const t = deck.time;
        if (timeRef.current) {
          const d = deck.state.duration;
          timeRef.current.textContent = deck.state.remain && d ? '-' + fmt(d - t) : fmt(t);
        }
        // 일시정지 상태에서 PLAY 버튼이 깜빡임 (실제 장비처럼)
        if (playRef.current) playRef.current.classList.toggle('blink', !deck.state.playing && deck.state.kind !== 'none' && Math.floor(now / 500) % 2 === 0);
      }),
    [deck],
  );

  const loadUrl = async () => {
    engine.resume();
    const ok = await deck.loadYouTube(url);
    if (ok) {
      pushRecent(url.trim());
      setUrl('');
    }
  };

  const onPad = (i: number) => {
    engine.resume();
    switch (s.padMode) {
      case 'hotcue':
        deck.hotcue(i, shift);
        break;
      case 'loop':
        deck.beatLoop(LOOP_BEATS[i]);
        break;
      case 'jump':
        deck.beatJump(JUMP_BEATS[i]);
        break;
      case 'sampler': {
        const n = SAMPLE_ORDER[i];
        if (n === 'rewind') deck.backspin();
        else engine.playSample(n);
        break;
      }
    }
  };

  const padInfo = (i: number): { label: string; color: string | null; sub?: string } => {
    switch (s.padMode) {
      case 'hotcue': {
        const hc = s.hotcues[i];
        return { label: String(i + 1), color: hc != null ? HOTCUE_COLORS[i] : null, sub: hc != null ? fmt(hc).slice(0, 5) : '' };
      }
      case 'loop': {
        const b = LOOP_BEATS[i];
        return { label: beatLabel(b), color: s.loop.on && s.loop.beats === b ? '#30d158' : '#1d4d2a', sub: 'BEAT' };
      }
      case 'jump': {
        const b = JUMP_BEATS[i];
        return { label: (b < 0 ? '◀ ' : '') + Math.abs(b) + (b > 0 ? ' ▶' : ''), color: '#3a2a6b', sub: 'JUMP' };
      }
      case 'sampler': {
        const n = SAMPLE_ORDER[i];
        return { label: SAMPLE_LABELS[n], color: n === 'rewind' ? '#7a1f2b' : '#5a3a12' };
      }
    }
  };

  const modes: [PadMode, string][] = [
    ['hotcue', 'HOT CUE'],
    ['loop', 'BEAT LOOP'],
    ['jump', 'BEAT JUMP'],
    ['sampler', 'SAMPLER'],
  ];
  const bpm = deck.bpm;
  const tempoCol = (
    <div className="tempo-col">
      <button className="btn tiny" onClick={() => deck.cycleRange()} title="템포 범위 바꾸기">
        ±{Math.round(s.range * 100)}%
      </button>
      <div className="tempo-wrap">
        <span className="tlabel top">−</span>
        <Fader
          value={(s.tempo / s.range + 1) / 2}
          onChange={(v) => deck.setTempo((v * 2 - 1) * s.range)}
          invert
          def={0.5}
          center
          length={Math.max(130, jog * 0.62)}
          className="tempo"
          ticks={8}
        />
        <span className="tlabel bot">+</span>
      </div>
      <div className="tlabel">TEMPO</div>
      <button className={`btn sync ${s.kind !== 'none' && Math.abs((engine.decks[1 - deck.index].bpm || 0) - (bpm || -1)) < 0.05 ? 'lit' : ''}`} onClick={() => deck.sync()}>
        BEAT
        <br />
        SYNC
      </button>
      <button className="btn tiny" onClick={() => deck.tap()} title="박자에 맞춰 4번 이상 누르면 BPM이 정해져요">
        TAP
      </button>
    </div>
  );

  return (
    <section
      className={`deck deck-${side} ${drag ? 'drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) deck.loadFile(f);
        else {
          const t = e.dataTransfer.getData('text');
          if (t) deck.loadYouTube(t);
        }
      }}
    >
      {/* 화면 */}
      <div className="screen">
        <div className="screen-head">
          <div className="deck-no">
            DECK<b>{deck.label}</b>
          </div>
          <div className="track">
            <div className="ttl">{s.loading ? '불러오는 중…' : s.title || '곡을 불러와 주세요'}</div>
            <div className="art">
              <span className={`src src-${s.kind}`}>{s.kind === 'youtube' ? 'YOUTUBE' : s.kind === 'file' ? 'FILE' : s.kind === 'demo' ? 'DEMO' : '—'}</span>
              {s.artist}
            </div>
          </div>
          <div className="bpm" title="BPM (곡의 빠르기)">
            <b>{bpm ? bpm.toFixed(1) : '---.-'}</b>
            <span>BPM</span>
          </div>
        </div>
        <div className="screen-mid">
          <div className={`yt-box ${s.kind === 'youtube' ? 'show' : ''}`}>
            <div ref={ytHost} className="yt-host" />
          </div>
          <div className="screen-info">
            <div className="row">
              <span className="time" ref={timeRef} onClick={() => deck.set({ remain: !s.remain })} title="눌러서 남은시간/지난시간 바꾸기">
                00:00.0
              </span>
              <span className={`tempo-val ${s.tempo ? 'on' : ''}`}>
                {s.tempo >= 0 ? '+' : ''}
                {(s.tempo * 100).toFixed(2)}%
              </span>
            </div>
            <div className="row chips">
              {s.loop.on && <span className="chip loop">LOOP {s.loop.beats ? beatLabel(s.loop.beats) : ''}</span>}
              {!s.vinyl && <span className="chip">CDJ</span>}
              {s.remain && <span className="chip">REMAIN</span>}
              {s.kind === 'youtube' && <span className="chip dim" title={s.scratchName}>SCRATCH: {s.scratchName}</span>}
            </div>
          </div>
        </div>
        <Overview deck={deck} />
        {s.error && (
          <div className="err" onClick={() => deck.set({ error: '' })}>
            {s.error} <b>✕</b>
          </div>
        )}
        {(s.errorCode === 101 || s.errorCode === 150) && !s.altLoading && !s.alternatives && (
          <button className="btn tiny alt-find" onClick={() => deck.findAlternatives()}>
            🔍 비슷한 영상 찾기
          </button>
        )}
        {s.altLoading && <div className="alt-loading">대체 영상 찾는 중…</div>}
        {s.alternatives && (
          <div className="alt-list">
            {s.alternatives.length === 0 && <div className="alt-empty">비슷한 영상을 찾지 못했어요</div>}
            {s.alternatives.map((a) => (
              <button key={a.id} className="alt-item" onClick={() => deck.chooseAlternative(a.id)} title={a.channel}>
                {a.thumb ? <img src={a.thumb} alt="" /> : <span className="alt-thumb-ph" />}
                <span className="alt-txt">
                  <span className="alt-title">{a.title}</span>
                  <span className="alt-channel">{a.channel}</span>
                </span>
              </button>
            ))}
            <button className="btn tiny alt-close" onClick={() => deck.set({ alternatives: null })}>
              닫기
            </button>
          </div>
        )}
      </div>

      {/* 불러오기 */}
      <div className="loadbar">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUrl()}
          placeholder="유튜브 주소 붙여넣기"
          list={`recent-${deck.index}`}
        />
        <datalist id={`recent-${deck.index}`}>
          {loadRecent().map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <button className="btn load" onClick={loadUrl}>
          LOAD
        </button>
        <button className="btn load file" onClick={() => fileRef.current?.click()} title="내 컴퓨터의 음악 파일 (진짜 스크래치·EQ 가능)">
          파일
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.opus,.flac"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) deck.loadFile(f);
            e.target.value = '';
          }}
        />
        <input
          ref={smpRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) deck.loadScratchSample(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* 본체 */}
      <div className="deck-body">

        <div className="jog-area">
          <div className="loop-row">
            <button className={`btn led ${s.loop.in != null && !s.loop.on ? 'lit-o' : ''}`} onClick={() => (shift ? deck.beatLoop(4) : deck.loopIn())}>
              {shift ? '4 BEAT' : 'IN'}
            </button>
            <button className={`btn led ${s.loop.on ? 'lit-o' : ''}`} onClick={() => (shift || s.loop.on ? deck.loopToggle() : deck.loopOut())}>
              {shift || s.loop.on ? 'EXIT' : 'OUT'}
            </button>
            <button className="btn" onClick={() => deck.loopResize(0.5)}>
              ½X
            </button>
            <button className="btn" onClick={() => deck.loopResize(2)}>
              2X
            </button>
            <button className={`btn ${s.vinyl ? 'lit-w' : ''}`} onClick={() => deck.set({ vinyl: !s.vinyl })} title="VINYL 켜짐: 휠 윗면으로 스크래치 / 꺼짐: 휠로 속도만 밀기">
              VINYL
            </button>
          </div>
          <JogWheel deck={deck} size={jog} />
        </div>
        {tempoCol}
      </div>

      {/* 아래: 트랜스포트 + 패드 */}
      <div className="deck-bottom">
        <div className="transport">
          <button
            className={`btn shift ${shift ? 'lit-w' : ''}`}
            onPointerDown={() => setShiftBtn(true)}
            onPointerUp={() => setShiftBtn(false)}
            onPointerLeave={() => setShiftBtn(false)}
          >
            SHIFT
          </button>
          <button
            className="round cue"
            onPointerDown={(e) => {
              capture(e);
              deck.cueDown();
            }}
            onPointerUp={() => deck.cueUp()}
          >
            <span>CUE</span>
          </button>
          <button ref={playRef} className={`round play ${s.playing ? 'on' : ''}`} onClick={() => deck.togglePlay()}>
            <span>▶/❚❚</span>
          </button>
        </div>
        <div className="pad-area">
          <div className="modes">
            {modes.map(([m, l]) => (
              <button key={m} className={`btn mode ${s.padMode === m ? 'lit-w' : ''}`} onClick={() => deck.set({ padMode: m })}>
                {l}
              </button>
            ))}
          </div>
          <div className="pads">
            {Array.from({ length: 8 }, (_, i) => {
              const p = padInfo(i);
              return (
                <button
                  key={i}
                  className={`pad ${p.color ? 'lit' : ''}`}
                  style={p.color ? ({ '--pc': p.color } as React.CSSProperties) : undefined}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    onPad(i);
                  }}
                >
                  <b>{p.label}</b>
                  {p.sub ? <small>{p.sub}</small> : null}
                </button>
              );
            })}
          </div>
          <div className="pad-hint">
            {s.padMode === 'hotcue' && (shift ? 'SHIFT+패드: 핫큐 지우기' : '빈 패드: 핫큐 저장 · 불 켜진 패드: 그 자리로 점프')}
            {s.padMode === 'loop' && '누른 박자 길이만큼 반복 · 한 번 더 누르면 해제'}
            {s.padMode === 'jump' && '박자 단위로 앞(▶)/뒤(◀)로 건너뛰기'}
            {s.padMode === 'sampler' && (
              <>
                효과음 · BACKSPIN은 파일/데모 곡에서만{' '}
                {s.kind === 'youtube' && (
                  <a onClick={() => smpRef.current?.click()} className="link">
                    스크래치 샘플 바꾸기
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {drag && <div className="drop-hint">여기에 음악 파일을 놓으세요</div>}
    </section>
  );
}
