import { Deck } from './deck';
import { renderBoomBapDemo, renderHouseDemo, renderSamples, renderScratchVoice, type SampleName } from './synth';

export type XfCurve = 'smooth' | 'cut';

export class Engine {
  ctx: AudioContext;
  masterIn: GainNode;
  private masterG: GainNode;
  masterAnalyser: AnalyserNode;
  decks: Deck[];
  xf = 0.5;
  curve: XfCurve = 'smooth';
  masterLevel = 0.8;
  status: 'loading' | 'ready' | 'error' = 'loading';
  scratchVoice: AudioBuffer | null = null;
  samples: Partial<Record<SampleName, AudioBuffer>> = {};
  version = 0;
  private listeners = new Set<() => void>();
  private frameCbs = new Set<(now: number) => void>();
  private last = performance.now();
  private mBuf = new Float32Array(1024);
  masterMeter = 0;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.masterIn = this.ctx.createGain();
    this.masterG = this.ctx.createGain();
    const lim = this.ctx.createDynamicsCompressor();
    lim.threshold.value = -2;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.002;
    lim.release.value = 0.1;
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.masterIn.connect(this.masterG).connect(lim).connect(this.masterAnalyser).connect(this.ctx.destination);
    this.decks = [new Deck(this, 0), new Deck(this, 1)];
    this.applyMix();
    requestAnimationFrame(this.loop);
  }

  async init() {
    try {
      await this.ctx.audioWorklet.addModule(import.meta.env.BASE_URL + 'deck-processor.js');
      this.decks.forEach((d) => d.attachWorklet());
      const [house, boom, voice, samples] = await Promise.all([
        renderHouseDemo(),
        renderBoomBapDemo(),
        renderScratchVoice(),
        renderSamples(),
      ]);
      this.scratchVoice = voice;
      this.samples = samples;
      this.decks[0].loadDemo(house, 'DEMO · House Groove', 124);
      this.decks[1].loadDemo(boom, 'DEMO · Boom Bap Break', 92);
      this.status = 'ready';
    } catch (e) {
      console.error(e);
      this.status = 'error';
    }
    this.emit();
  }

  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  onFrame(cb: (now: number) => void) {
    this.frameCbs.add(cb);
    return () => {
      this.frameCbs.delete(cb);
    };
  }

  xfGains(): [number, number] {
    const x = this.xf;
    if (this.curve === 'cut') {
      return [x > 0.96 ? Math.max(0, (1 - x) / 0.04) : 1, x < 0.04 ? x / 0.04 : 1];
    }
    // 가운데에서 두 곡 모두 크게, 끝으로 갈수록 부드럽게 줄어듦
    return [Math.min(1, Math.cos((x * Math.PI) / 2) * Math.SQRT2), Math.min(1, Math.sin((x * Math.PI) / 2) * Math.SQRT2)];
  }

  applyMix() {
    const g = Math.pow(this.masterLevel / 0.8, 2);
    this.masterG.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015);
    const [a, b] = this.xfGains();
    this.decks[0]?.applyMix(a, g);
    this.decks[1]?.applyMix(b, g);
  }

  setXf(x: number) {
    this.xf = Math.max(0, Math.min(1, x));
    this.applyMix();
    this.emit();
  }
  setCurve(c: XfCurve) {
    this.curve = c;
    this.applyMix();
    this.emit();
  }
  setMaster(v: number) {
    this.masterLevel = v;
    this.applyMix();
    this.emit();
  }
  setChannel(i: number, p: Partial<Pick<Deck['state'], 'trim' | 'hi' | 'mid' | 'lo' | 'cfx' | 'fader'>>) {
    this.decks[i].set(p);
    this.applyMix();
  }

  playSample(name: SampleName) {
    const b = this.samples[name];
    if (!b) return;
    this.resume();
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.masterIn);
    s.start();
  }

  private loop = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.decks.forEach((d) => d.tick(now, dt));
    this.masterAnalyser.getFloatTimeDomainData(this.mBuf);
    let pk = 0;
    for (let i = 0; i < this.mBuf.length; i++) pk = Math.max(pk, Math.abs(this.mBuf[i]));
    this.masterMeter = pk > this.masterMeter ? pk : this.masterMeter * 0.9;
    this.frameCbs.forEach((cb) => cb(now));
    requestAnimationFrame(this.loop);
  };
}

export const engine = new Engine();
if (import.meta.env.DEV) (window as any).engine = engine;
