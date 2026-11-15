import { computePeaks, detectBpm, type Peaks } from './analysis';
import { extractYouTubeId, fetchMeta, loadYouTubeApi, type YTPlayer } from './youtube';
import type { Engine } from './engine';

export const SEC_PER_REV = 1.8; // 33⅓ rpm 판이 한 바퀴 도는 시간
export type SourceKind = 'none' | 'file' | 'demo' | 'youtube';
export type PadMode = 'hotcue' | 'loop' | 'jump' | 'sampler';
export const HOTCUE_COLORS = ['#ff2d55', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#ff6ac1'];
export const TEMPO_RANGES = [0.06, 0.1, 0.16, 0.5];

export interface DeckState {
  kind: SourceKind;
  title: string;
  artist: string;
  loading: boolean;
  error: string;
  ytId: string | null;
  playing: boolean;
  baseBpm: number | null;
  tempo: number; // -range..+range (0.02 = +2%)
  range: number;
  duration: number;
  cue: number;
  hotcues: (number | null)[];
  loop: { in: number | null; out: number | null; on: boolean; beats: number | null };
  padMode: PadMode;
  vinyl: boolean;
  remain: boolean;
  scratchName: string;
  // 믹서 채널
  trim: number; // -1..1
  hi: number;
  mid: number;
  lo: number;
  cfx: number;
  fader: number; // 0..1
}

const initial = (): DeckState => ({
  kind: 'none',
  title: '',
  artist: '',
  loading: false,
  error: '',
  ytId: null,
  playing: false,
  baseBpm: null,
  tempo: 0,
  range: 0.1,
  duration: 0,
  cue: 0,
  hotcues: Array(8).fill(null),
  loop: { in: null, out: null, on: false, beats: null },
  padMode: 'hotcue',
  vinyl: true,
  remain: false,
  scratchName: '아~ / 프레쉬 (기본)',
  trim: 0,
  hi: 0,
  mid: 0,
  lo: 0,
  cfx: 0,
  fader: 0.85,
});

function ytErrorText(code: number) {
  if (code === 101 || code === 150)
    return `저작권자가 이 영상을 다른 사이트에서 못 틀게 막아 두었어요 (오류 ${code}). 공식 음원·'Topic' 채널 영상에 많아요. 다른 업로드 영상을 쓰거나, 음악 파일로 받아 '파일' 버튼으로 넣어 주세요.`;
  if (code === 100) return '없거나 비공개인 영상이에요 (오류 100).';
  if (code === 2) return '유튜브 주소가 올바르지 않아요 (오류 2).';
  return `유튜브 재생 중 문제가 생겼어요 (오류 ${code ?? '?'}). 새로고침 후 다시 해 보세요.`;
}

const dbToLin =(db: number) => Math.pow(10, db / 20);
export const eqDb = (k: number) => (k < 0 ? k * 26 : k * 6);
export const trimDb = (k: number) => (k < 0 ? k * 24 : k * 9);

export class Deck {
  state: DeckState = initial();
  readonly index: number;
  readonly label: string;
  private engine: Engine;
  private ctx: AudioContext;
  node: AudioWorkletNode | null = null;
  private trimG: GainNode;
  private loF: BiquadFilterNode;
  private midF: BiquadFilterNode;
  private hiF: BiquadFilterNode;
  private hpf: BiquadFilterNode;
  private lpf: BiquadFilterNode;
  private faderG: GainNode;
  private xfG: GainNode;
  readonly analyser: AnalyserNode;
  private meterBuf = new Float32Array(1024);

  buffer: AudioBuffer | null = null;
  peaks: Peaks | null = null;
  firstBeat = 0;
  scratchBuf: AudioBuffer | null = null;

  // 재생 위치 추적
  private wpos = 0;
  private wvel = 0;
  private wat = 0;
  // 유튜브
  yt: YTPlayer | null = null;
  private ytReady = false;
  private ytHostEl: HTMLElement | null = null;
  private ytTime = 0;
  private ytStamp = 0;
  private ytPoll = 0;
  private ytState = -1;
  // 스크래치
  touching = false;
  angle = 0; // 판 회전 각도(라디안)
  private ytScratchAngle = 0;
  private ytNet = 0;
  private lastScratchEnd = 0;
  keyDir = 0;
  private bendTimer = 0;
  private cueHeld = false;
  private tapTimes: number[] = [];
  meter = 0;

  constructor(engine: Engine, index: number) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.index = index;
    this.label = index === 0 ? '1' : '2';
    const c = this.ctx;
    this.trimG = c.createGain();
    this.loF = c.createBiquadFilter();
    this.loF.type = 'lowshelf';
    this.loF.frequency.value = 220;
    this.midF = c.createBiquadFilter();
    this.midF.type = 'peaking';
    this.midF.frequency.value = 1000;
    this.midF.Q.value = 0.7;
    this.hiF = c.createBiquadFilter();
    this.hiF.type = 'highshelf';
    this.hiF.frequency.value = 2800;
    this.hpf = c.createBiquadFilter();
    this.hpf.type = 'highpass';
    this.hpf.frequency.value = 10;
    this.hpf.Q.value = 1.6;
    this.lpf = c.createBiquadFilter();
    this.lpf.type = 'lowpass';
    this.lpf.frequency.value = 22000;
    this.lpf.Q.value = 1.6;
    this.faderG = c.createGain();
    this.xfG = c.createGain();
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 1024;
    this.trimG.connect(this.loF).connect(this.midF).connect(this.hiF).connect(this.hpf).connect(this.lpf);
    this.lpf.connect(this.analyser);
    this.lpf.connect(this.faderG).connect(this.xfG).connect(engine.masterIn);
  }

  attachWorklet() {
    this.node = new AudioWorkletNode(this.ctx, 'deck-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    this.node.connect(this.trimG);
    this.node.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'pos') {
        this.wpos = m.t;
        this.wvel = m.v;
        this.wat = this.ctx.currentTime;
      } else if (m.type === 'ended') {
        this.set({ playing: false });
      }
    };
  }

  private post(m: any, transfer?: Transferable[]) {
    this.node?.port.postMessage(m, transfer || []);
  }

  set(p: Partial<DeckState>) {
    this.state = { ...this.state, ...p };
    this.engine.emit();
  }

  get isYT() {
    return this.state.kind === 'youtube';
  }
  get hasGrid() {
    return (this.state.kind === 'file' || this.state.kind === 'demo') && !!this.state.baseBpm;
  }
  get rate() {
    return 1 + this.state.tempo;
  }
  get bpm(): number | null {
    return this.state.baseBpm ? this.state.baseBpm * this.rate : null;
  }

  /** 현재 재생 시간(초) */
  get time(): number {
    if (this.isYT) {
      if (!this.ytReady) return 0;
      const playingNow = this.ytState === 1;
      return this.ytTime + (playingNow ? ((performance.now() - this.ytStamp) / 1000) * this.rate : 0);
    }
    const dt = this.ctx.currentTime - this.wat;
    return Math.max(0, this.wpos + this.wvel * Math.min(dt, 0.1));
  }

  // ---------- 불러오기 ----------
  private resetForLoad(kind: SourceKind, title: string, artist = '') {
    if (this.yt && kind !== 'youtube') {
      try {
        this.yt.pauseVideo();
      } catch {}
    }
    this.post({ type: 'play', on: false });
    this.post({ type: 'loop', on: false });
    this.touching = false;
    this.wpos = 0;
    this.wvel = 0;
    this.set({
      kind,
      title,
      artist,
      error: '',
      loading: true,
      playing: false,
      hotcues: Array(8).fill(null),
      loop: { in: null, out: null, on: false, beats: null },
      cue: 0,
      tempo: 0,
      ytId: null,
      duration: 0,
    });
  }

  private sendBuffer(buf: AudioBuffer, wrap = false) {
    const chans: Float32Array[] = [];
    for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c).slice());
    this.post(
      { type: 'load', channels: chans, sampleRate: buf.sampleRate, wrap },
      chans.map((c) => c.buffer as ArrayBuffer),
    );
    this.post({ type: 'rate', rate: this.rate });
  }

  loadDemo(buf: AudioBuffer, title: string, bpm: number) {
    this.resetForLoad('demo', title, '앱에 들어있는 연습용 비트');
    this.buffer = buf;
    this.peaks = computePeaks(buf);
    this.firstBeat = 0;
    this.sendBuffer(buf, true);
    this.set({ loading: false, baseBpm: bpm, duration: buf.duration });
    this.engine.applyMix();
  }

  async loadFile(file: File) {
    this.resetForLoad('file', file.name.replace(/\.[^.]+$/, ''), '내 컴퓨터 파일');
    try {
      const ab = await file.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(ab);
      this.buffer = buf;
      this.peaks = computePeaks(buf);
      this.firstBeat = this.peaks.firstBeat;
      const bpm = detectBpm(buf);
      this.sendBuffer(buf, false);
      this.set({ loading: false, baseBpm: bpm, duration: buf.duration });
      this.engine.applyMix();
    } catch (e) {
      console.error(e);
      this.set({ loading: false, kind: 'none', error: '이 파일은 열 수 없어요 (mp3, m4a, wav, webm 파일을 써 주세요)' });
    }
  }

  attachYouTubeHost(el: HTMLElement | null) {
    this.ytHostEl = el;
  }

  async loadYouTube(input: string) {
    const id = extractYouTubeId(input);
    if (!id) {
      this.set({ error: '유튜브 주소를 확인해 주세요' });
      return false;
    }
    this.resetForLoad('youtube', '유튜브 불러오는 중…', '');
    this.firstBeat = 0;
    this.set({ ytId: id, baseBpm: null });
    this.buffer = null;
    this.peaks = null;
    // 스크래치용 목소리 샘플을 턴테이블에 올려둔다
    const sb = this.scratchBuf || this.engine.scratchVoice;
    if (sb) this.sendBuffer(sb, false);
    this.post({ type: 'seek', time: 0.05, stop: true });
    fetchMeta(id).then((m) => {
      if (m && this.state.ytId === id) this.set({ title: m.title, artist: m.author });
    });
    await loadYouTubeApi();
    this.ytReady = false;
    this.ytTime = 0;
    if (this.yt) {
      this.yt.cueVideoById(id);
      this.ytReady = true;
      this.set({ loading: false });
      this.engine.applyMix();
      return true;
    }
    if (!this.ytHostEl) return false;
    const holder = document.createElement('div');
    this.ytHostEl.innerHTML = '';
    this.ytHostEl.appendChild(holder);
    await new Promise<void>((resolve) => {
      this.yt = new window.YT.Player(holder, {
        width: '100%',
        height: '100%',
        videoId: id,
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => {
            this.ytReady = true;
            this.set({ loading: false, duration: this.yt?.getDuration() || 0 });
            this.yt?.setPlaybackRate(this.rate);
            this.engine.applyMix();
            resolve();
          },
          onStateChange: (e: any) => {
            this.ytState = e.data;
            this.syncYtTime();
            if (e.data === 1) {
              this.yt?.setPlaybackRate(this.rate);
              if (!this.state.playing) this.set({ playing: true });
            } else if (e.data === 2 || e.data === 0) {
              if (this.state.playing && !this.touching) this.set({ playing: false });
            }
            const d = this.yt?.getDuration() || 0;
            if (d && d !== this.state.duration) this.set({ duration: d });
          },
          onError: (e: any) => {
            this.ytReady = true;
            this.set({ loading: false, error: ytErrorText(e?.data) });
            resolve();
          },
        },
      });
    });
    return true;
  }

  async loadScratchSample(file: File) {
    try {
      const buf = await this.ctx.decodeAudioData(await file.arrayBuffer());
      this.scratchBuf = buf;
      this.set({ scratchName: file.name });
      if (this.isYT) {
        this.sendBuffer(buf, false);
        this.post({ type: 'seek', time: 0, stop: true });
      }
    } catch {
      this.set({ error: '스크래치 샘플 파일을 열 수 없어요' });
    }
  }

  private syncYtTime() {
    if (!this.yt || !this.ytReady) return;
    try {
      this.ytTime = this.yt.getCurrentTime() || 0;
      this.ytStamp = performance.now();
    } catch {}
  }

  // ---------- 재생 ----------
  play() {
    if (this.state.kind === 'none') return;
    this.engine.resume();
    if (this.isYT) this.yt?.playVideo();
    else this.post({ type: 'play', on: true });
    this.set({ playing: true });
  }
  pause() {
    if (this.isYT) this.yt?.pauseVideo();
    else this.post({ type: 'play', on: false });
    this.set({ playing: false });
  }
  togglePlay() {
    this.cueHeld = false;
    if (this.state.playing) this.pause();
    else this.play();
  }

  seek(t: number) {
    t = Math.max(0, Math.min(t, (this.state.duration || 1) - 0.05));
    if (this.isYT) {
      this.yt?.seekTo(t, true);
      this.ytTime = t;
      this.ytStamp = performance.now();
    } else {
      this.post({ type: 'seek', time: t });
      this.wpos = t;
      this.wat = this.ctx.currentTime;
    }
  }

  /** CUE 버튼: 파이오니어 방식 */
  cueDown() {
    this.engine.resume();
    const t = this.time;
    if (this.state.playing && !this.cueHeld) {
      this.seek(this.state.cue);
      this.pause();
    } else if (Math.abs(t - this.state.cue) > 0.03) {
      this.set({ cue: t });
    } else {
      this.cueHeld = true;
      this.play();
    }
  }
  cueUp() {
    if (this.cueHeld) {
      this.cueHeld = false;
      this.pause();
      this.seek(this.state.cue);
    }
  }

  // ---------- 핫큐 / 루프 / 비트점프 ----------
  hotcue(i: number, shift: boolean) {
    const hc = [...this.state.hotcues];
    if (shift) {
      hc[i] = null;
      this.set({ hotcues: hc });
      return;
    }
    if (hc[i] == null) {
      hc[i] = this.time;
      this.set({ hotcues: hc });
    } else {
      this.seek(hc[i]!);
      if (!this.state.playing) this.play();
    }
  }

  private beatLen() {
    return 60 / (this.state.baseBpm || 120);
  }

  loopIn() {
    const t = this.time;
    this.set({ loop: { in: t, out: null, on: false, beats: null } });
  }
  loopOut() {
    const l = this.state.loop;
    if (l.in == null) return;
    const t = this.time;
    if (t <= l.in + 0.05) return;
    this.setLoop(l.in, t, null);
  }
  loopToggle() {
    const l = this.state.loop;
    if (l.on) {
      this.post({ type: 'loop', on: false });
      this.set({ loop: { ...l, on: false } });
    } else if (l.in != null && l.out != null) {
      this.setLoop(l.in, l.out, l.beats);
      this.seek(l.in);
    }
  }
  beatLoop(beats: number) {
    const l = this.state.loop;
    if (l.on && l.beats === beats) {
      this.loopToggle();
      return;
    }
    let start = this.time;
    if (this.hasGrid) {
      const b = this.beatLen();
      const n = Math.floor((start - this.firstBeat) / b + 0.02);
      start = this.firstBeat + n * b;
      if (beats < 1) start += Math.floor((this.time - start) / (b * beats)) * b * beats;
    }
    this.setLoop(start, start + beats * this.beatLen(), beats);
  }
  loopResize(f: number) {
    const l = this.state.loop;
    if (l.in == null || l.out == null) {
      this.beatLoop(4);
      return;
    }
    const len = (l.out - l.in) * f;
    if (len < 0.03) return;
    this.setLoop(l.in, l.in + len, l.beats ? l.beats * f : null);
  }
  private setLoop(a: number, b: number, beats: number | null) {
    this.post({ type: 'loop', on: true, in: a, out: b });
    this.set({ loop: { in: a, out: b, on: true, beats } });
  }
  beatJump(beats: number) {
    const d = beats * this.beatLen();
    const l = this.state.loop;
    if (l.on && l.in != null && l.out != null) this.setLoop(l.in + d, l.out + d, l.beats);
    this.seek(this.time + d);
  }

  // ---------- 템포 / 싱크 ----------
  setTempo(t: number) {
    const r = this.state.range;
    t = Math.max(-r, Math.min(r, t));
    this.set({ tempo: t });
    this.post({ type: 'rate', rate: 1 + t });
    if (this.isYT && this.yt) {
      try {
        this.yt.setPlaybackRate(1 + t);
      } catch {}
    }
  }
  cycleRange() {
    const i = TEMPO_RANGES.indexOf(this.state.range);
    const range = TEMPO_RANGES[(i + 1) % TEMPO_RANGES.length];
    this.set({ range });
    this.setTempo(this.state.tempo);
  }
  sync() {
    const other = this.engine.decks[1 - this.index];
    const ob = other.bpm;
    const mb = this.state.baseBpm;
    if (!ob || !mb) {
      this.set({ error: 'SYNC 하려면 두 곡의 BPM이 필요해요 (TAP으로 박자를 두드려 주세요)' });
      return;
    }
    let target = ob;
    for (const m of [0.5, 2]) if (Math.abs(ob * m - mb) < Math.abs(target - mb)) target = ob * m;
    let t = target / mb - 1;
    let range = this.state.range;
    while (Math.abs(t) > range && range < 0.5) range = TEMPO_RANGES[TEMPO_RANGES.indexOf(range) + 1];
    this.set({ range });
    this.setTempo(t);
    // 박자 위치(위상)까지 맞추기
    if (this.hasGrid && other.hasGrid && this.state.playing) {
      const bo = 60 / other.state.baseBpm!;
      const po = ((((other.time - other.firstBeat) / bo) % 1) + 1) % 1;
      const bt = this.beatLen();
      const pt = ((((this.time - this.firstBeat) / bt) % 1) + 1) % 1;
      let d = po - pt;
      if (d > 0.5) d -= 1;
      if (d < -0.5) d += 1;
      this.seek(this.time + d * bt);
    }
  }
  tap() {
    const now = performance.now();
    this.tapTimes = this.tapTimes.filter((t) => now - t < 3000);
    this.tapTimes.push(now);
    if (this.tapTimes.length >= 4) {
      const ts = this.tapTimes;
      const avg = (ts[ts.length - 1] - ts[0]) / (ts.length - 1);
      if (this.isYT) this.firstBeat = this.time; // 마지막으로 두드린 곳을 박자 시작점으로
      this.set({ baseBpm: Math.round((60000 / avg) * 10) / 10 });
    }
  }

  // ---------- 조그 (스크래치 / 피치 벤드) ----------
  touchStart() {
    if (this.state.kind === 'none') return;
    this.engine.resume();
    this.touching = true;
    if (this.isYT) {
      if (performance.now() - this.lastScratchEnd > 1500) this.post({ type: 'seek', time: 0.05, stop: true });
      this.ytNet = 0;
      this.engine.applyMix();
    }
    this.post({ type: 'touch', on: true });
  }
  scratchMove(deltaSec: number) {
    if (!this.touching) return;
    this.post({ type: 'scratch', delta: deltaSec });
    if (this.isYT) {
      this.ytScratchAngle += (deltaSec / SEC_PER_REV) * Math.PI * 2;
      this.ytNet += deltaSec;
    }
  }
  touchEnd() {
    if (!this.touching) return;
    this.touching = false;
    this.post({ type: 'touch', on: false });
    if (this.isYT) {
      this.lastScratchEnd = performance.now();
      if (Math.abs(this.ytNet) > 0.6) this.seek(this.time + this.ytNet);
      this.engine.applyMix();
    }
  }
  bend(amount: number) {
    const a = Math.max(-0.6, Math.min(0.6, amount));
    this.post({ type: 'bend', amount: a });
    if (this.isYT && this.yt && this.state.playing) {
      try {
        this.yt.setPlaybackRate(Math.max(0.25, this.rate * (1 + a)));
      } catch {}
    }
    clearTimeout(this.bendTimer);
    this.bendTimer = window.setTimeout(() => {
      this.post({ type: 'bend', amount: 0 });
      if (this.isYT && this.yt) {
        try {
          this.yt.setPlaybackRate(this.rate);
        } catch {}
      }
    }, 90);
  }
  backspin() {
    if (this.isYT || this.state.kind === 'none') return;
    this.post({ type: 'backspin', speed: 4, duration: 1.1 });
  }

  // ---------- 믹서 ----------
  applyMix(xf: number, master: number) {
    const s = this.state;
    const t = this.ctx.currentTime;
    const st = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, 0.012);
    const trim = dbToLin(trimDb(s.trim));
    st(this.trimG.gain, trim);
    st(this.loF.gain, eqDb(s.lo));
    st(this.midF.gain, eqDb(s.mid));
    st(this.hiF.gain, eqDb(s.hi));
    const c = s.cfx;
    if (c < -0.03) {
      st(this.lpf.frequency, 20000 * Math.pow(90 / 20000, -c));
      st(this.hpf.frequency, 10);
    } else if (c > 0.03) {
      st(this.hpf.frequency, 20 * Math.pow(9000 / 20, c));
      st(this.lpf.frequency, 22000);
    } else {
      st(this.lpf.frequency, 22000);
      st(this.hpf.frequency, 10);
    }
    const fader = s.fader * s.fader;
    st(this.faderG.gain, fader);
    st(this.xfG.gain, xf);
    if (this.yt && this.ytReady) {
      // 유튜브 소리는 브라우저가 직접 건드릴 수 없어서 볼륨으로 비슷하게 흉내낸다
      const eq = (dbToLin(eqDb(s.lo)) * 0.45 + dbToLin(eqDb(s.mid)) * 0.35 + dbToLin(eqDb(s.hi)) * 0.2);
      const filt = Math.abs(c) > 0.03 ? 1 - Math.abs(c) * 0.75 : 1;
      let v = trim * Math.min(1.3, eq) * filt * fader * xf * master;
      if (this.touching || !this.isYT) v = 0;
      try {
        this.yt.setVolume(Math.max(0, Math.min(100, Math.round(v * 100))));
      } catch {}
    }
  }

  // ---------- 매 프레임 ----------
  tick(now: number, dt: number) {
    if (this.keyDir !== 0) this.scratchMove(this.keyDir * dt * 1.15);
    if (this.isYT && this.yt && this.ytReady) {
      if (now - this.ytPoll > 250) {
        this.ytPoll = now;
        this.syncYtTime();
        try {
          this.ytState = this.yt.getPlayerState();
        } catch {}
      }
      const l = this.state.loop;
      if (l.on && l.in != null && l.out != null && this.time >= l.out) this.seek(l.in);
      this.angle = (this.time / SEC_PER_REV) * Math.PI * 2 + this.ytScratchAngle;
      // 유튜브는 실제 레벨을 읽을 수 없어서 대략적인 미터
      const vol = this.state.playing && !this.touching ? dbToLin(trimDb(this.state.trim)) * 0.75 : 0;
      const target = vol * (0.75 + Math.random() * 0.25);
      this.meter += (target - this.meter) * 0.3;
      if (this.touching) this.meterFromAnalyser();
    } else {
      this.angle = (this.time / SEC_PER_REV) * Math.PI * 2;
      this.meterFromAnalyser();
    }
  }
  private meterFromAnalyser() {
    this.analyser.getFloatTimeDomainData(this.meterBuf);
    let pk = 0;
    for (let i = 0; i < this.meterBuf.length; i++) {
      const a = Math.abs(this.meterBuf[i]);
      if (a > pk) pk = a;
    }
    this.meter = pk > this.meter ? pk : this.meter * 0.9;
  }
}
