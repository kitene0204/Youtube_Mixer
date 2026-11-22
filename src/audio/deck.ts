import { computePeaks, detectBpm, type Peaks } from './analysis';
import { extractYouTubeId, fetchMeta, hasYouTubeApiKey, loadYouTubeApi, searchAlternatives, type AltVideo, type YTPlayer } from './youtube';
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
  errorCode: number | null;
  altLoading: boolean;
  alternatives: AltVideo[] | null;
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
  errorCode: null,
  altLoading: false,
  alternatives: null,
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
  private ytCatchupAt = 0;
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
      return
