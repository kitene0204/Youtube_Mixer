// 앱 안에서 직접 만들어 내는 소리들 (저작권 걱정 없는 데모 비트, 스크래치용 목소리 샘플, 샘플러 효과음)

const SR = 44100;

function noiseBuffer(ctx: BaseAudioContext, secs = 1): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function kick(ctx: BaseAudioContext, out: AudioNode, t: number, v = 1, hard = false) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(hard ? 180 : 150, t);
  o.frequency.exponentialRampToValueAtTime(hard ? 48 : 44, t + 0.12);
  env(g, t, 0.003, 0.95 * v, hard ? 0.45 : 0.38);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.55);
  // 클릭
  const c = ctx.createOscillator();
  const cg = ctx.createGain();
  c.type = 'square';
  c.frequency.value = 1200;
  env(cg, t, 0.001, 0.12 * v, 0.012);
  c.connect(cg).connect(out);
  c.start(t);
  c.stop(t + 0.03);
}

function snare(ctx: BaseAudioContext, out: AudioNode, nb: AudioBuffer, t: number, v = 1, body = 190) {
  const n = ctx.createBufferSource();
  n.buffer = nb;
  const bp = ctx.createBiquadFilter();
  bp.type = 'highpass';
  bp.frequency.value = 1500;
  const g = ctx.createGain();
  env(g, t, 0.002, 0.55 * v, 0.2);
  n.connect(bp).connect(g).connect(out);
  n.start(t, Math.random() * 0.5);
  n.stop(t + 0.3);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(body, t);
  o.frequency.exponentialRampToValueAtTime(body * 0.7, t + 0.1);
  const og = ctx.createGain();
  env(og, t, 0.002, 0.5 * v, 0.12);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.2);
}

function clap(ctx: BaseAudioContext, out: AudioNode, nb: AudioBuffer, t: number, v = 1) {
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1400;
  bp.Q.value = 0.9;
  bp.connect(out);
  [0, 0.011, 0.022, 0.034].forEach((dt, i) => {
    const n = ctx.createBufferSource();
    n.buffer = nb;
    const g = ctx.createGain();
    env(g, t + dt, 0.001, (i === 3 ? 0.9 : 0.6) * v, i === 3 ? 0.18 : 0.02);
    n.connect(g).connect(bp);
    n.start(t + dt, Math.random() * 0.5);
    n.stop(t + dt + 0.25);
  });
}

function hat(ctx: BaseAudioContext, out: AudioNode, nb: AudioBuffer, t: number, v = 1, open = false) {
  const n = ctx.createBufferSource();
  n.buffer = nb;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  const g = ctx.createGain();
  env(g, t, 0.001, 0.28 * v, open ? 0.16 : 0.035);
  n.connect(hp).connect(g).connect(out);
  n.start(t, Math.random() * 0.5);
  n.stop(t + 0.25);
}

function bassNote(ctx: BaseAudioContext, out: AudioNode, t: number, f: number, len: number, v = 1, sine = false) {
  const o = ctx.createOscillator();
  o.type = sine ? 'sine' : 'sawtooth';
  o.frequency.value = f;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(sine ? 800 : 900, t);
  lp.frequency.exponentialRampToValueAtTime(sine ? 400 : 180, t + len);
  lp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4 * v, t + 0.01);
  g.gain.setValueAtTime(0.4 * v, t + len * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.02);
}

function chord(ctx: BaseAudioContext, out: AudioNode, t: number, notes: number[], len: number, v = 1, keys = false) {
  notes.forEach((f) => {
    [1, keys ? 2 : 1.006].forEach((mul, k) => {
      const o = ctx.createOscillator();
      o.type = keys ? 'sine' : k ? 'sawtooth' : 'square';
      o.frequency.value = f * mul;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(keys ? 3000 : 2400, t);
      lp.frequency.exponentialRampToValueAtTime(keys ? 900 : 500, t + len);
      const g = ctx.createGain();
      env(g, t, keys ? 0.004 : 0.005, (keys ? (k ? 0.03 : 0.07) : 0.035) * v, len);
      o.connect(lp).connect(g).connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  });
}

const note = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** 124 BPM 하우스 데모 (8마디) */
export async function renderHouseDemo(): Promise<AudioBuffer> {
  const bpm = 124;
  const beat = 60 / bpm;
  const bars = 8;
  const len = bars * 4 * beat;
  const ctx = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
  const nb = noiseBuffer(ctx);
  const bus = ctx.createDynamicsCompressor();
  bus.threshold.value = -10;
  bus.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  bus.connect(master).connect(ctx.destination);
  const roots = [57, 57, 53, 55]; // A F G
  for (let b = 0; b < bars; b++) {
    for (let q = 0; q < 4; q++) {
      const t = (b * 4 + q) * beat;
      kick(ctx, bus, t);
      hat(ctx, bus, nb, t + beat / 2, 1, true);
      hat(ctx, bus, nb, t + beat / 4, 0.4);
      hat(ctx, bus, nb, t + (beat * 3) / 4, 0.4);
      if (q === 1 || q === 3) clap(ctx, bus, nb, t, 0.9);
      const r = roots[Math.floor(b / 2) % 4];
      bassNote(ctx, bus, t + beat / 2, note(r - 24), beat * 0.42);
    }
    const r = roots[Math.floor(b / 2) % 4];
    const st = b * 4 * beat;
    chord(ctx, bus, st + beat * 1.5, [note(r), note(r + 3), note(r + 7), note(r + 10)], beat * 0.4);
    chord(ctx, bus, st + beat * 3.5, [note(r), note(r + 3), note(r + 7), note(r + 10)], beat * 0.3, 0.7);
  }
  return ctx.startRendering();
}

/** 92 BPM 붐뱁(힙합) 데모 (8마디) — 스크래치 연습용 */
export async function renderBoomBapDemo(): Promise<AudioBuffer> {
  const bpm = 92;
  const beat = 60 / bpm;
  const bars = 8;
  const len = bars * 4 * beat;
  const ctx = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
  const nb = noiseBuffer(ctx);
  const bus = ctx.createDynamicsCompressor();
  bus.threshold.value = -12;
  bus.ratio.value = 5;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  bus.connect(master).connect(ctx.destination);
  const prog = [
    [62, 65, 69, 72], // Dm7
    [55, 59, 62, 65], // G7
    [60, 64, 67, 71], // Cmaj7
    [57, 60, 64, 67], // Am7
  ];
  const swing = beat * 0.08;
  for (let b = 0; b < bars; b++) {
    const st = b * 4 * beat;
    // 킥: 1, 2&, 3(조금 뒤), 4&
    kick(ctx, bus, st, 1, true);
    kick(ctx, bus, st + beat * 1.5 + swing, 0.8, true);
    kick(ctx, bus, st + beat * 2.25 + swing, 0.7, true);
    if (b % 2 === 1) kick(ctx, bus, st + beat * 3.5 + swing, 0.7, true);
    snare(ctx, bus, nb, st + beat, 1, 200);
    snare(ctx, bus, nb, st + beat * 3, 1, 200);
    for (let e = 0; e < 8; e++) {
      hat(ctx, bus, nb, st + (e * beat) / 2 + (e % 2 ? swing : 0), e % 2 ? 0.45 : 0.8);
    }
    const c = prog[b % 4];
    chord(ctx, bus, st, c.map(note), beat * 1.8, 1, true);
    chord(ctx, bus, st + beat * 2.5 + swing, c.map(note), beat * 1.2, 0.8, true);
    bassNote(ctx, bus, st, note(c[0] - 24), beat * 1.4, 1.2, true);
    bassNote(ctx, bus, st + beat * 2.5 + swing, note(c[0] - 24), beat * 1.2, 1.1, true);
  }
  return ctx.startRendering();
}

/**
 * 스크래치용 목소리 샘플: "아~(Ahh)" 와 "프레쉬(Fresh)".
 * 사람 목소리처럼 성대 떨림(톱니파) + 입 모양 울림(포먼트 필터)으로 만든다.
 * 판을 앞뒤로 긁으면 진짜 스크래치처럼 들린다.
 */
export async function renderScratchVoice(): Promise<AudioBuffer> {
  const len = 2.6;
  const ctx = new OfflineAudioContext(1, Math.ceil(len * SR), SR);
  const out = ctx.createGain();
  out.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  out.connect(comp).connect(ctx.destination);
  const nb = noiseBuffer(ctx, 3);

  const vowel = (t0: number, t1: number, f0a: number, f0b: number, formants: [number, number, number][]) => {
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0a, t0);
    src.frequency.linearRampToValueAtTime(f0b, t1);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = 3;
    vib.connect(vg).connect(src.frequency);
    const breath = ctx.createBufferSource();
    breath.buffer = nb;
    const bg = ctx.createGain();
    bg.gain.value = 0.08;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(1, t0 + 0.03);
    amp.gain.setValueAtTime(1, t1 - 0.12);
    amp.gain.exponentialRampToValueAtTime(0.0001, t1);
    const pre = ctx.createGain();
    src.connect(pre);
    breath.connect(bg).connect(pre);
    formants.forEach(([f, q, g]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const fg = ctx.createGain();
      fg.gain.value = g;
      pre.connect(bp).connect(fg).connect(amp);
    });
    amp.connect(out);
    src.start(t0);
    vib.start(t0);
    breath.start(t0);
    src.stop(t1);
    vib.stop(t1);
    breath.stop(t1);
  };
  const fric = (t0: number, t1: number, f: number, q: number, g: number) => {
    const n = ctx.createBufferSource();
    n.buffer = nb;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.exponentialRampToValueAtTime(g, t0 + 0.02);
    a.gain.setValueAtTime(g, t1 - 0.03);
    a.gain.exponentialRampToValueAtTime(0.0001, t1);
    n.connect(bp).connect(a).connect(out);
    n.start(t0, 0.3);
    n.stop(t1);
  };

  // "아~~" (0.05 ~ 1.05초): 가장 많이 쓰는 스크래치 소리
  vowel(0.05, 1.05, 175, 150, [
    [800, 6, 1.0],
    [1150, 7, 0.55],
    [2900, 9, 0.25],
    [3300, 10, 0.12],
  ]);
  // "프레쉬" (1.35 ~ 2.1초)
  fric(1.35, 1.45, 2200, 0.8, 0.35);
  vowel(1.44, 1.78, 190, 165, [
    [560, 6, 1.0],
    [1850, 8, 0.6],
    [2600, 9, 0.3],
  ]);
  fric(1.74, 2.1, 3600, 1.2, 0.45);
  return ctx.startRendering();
}

export type SampleName = 'horn' | 'siren' | 'laser' | 'kick' | 'snare' | 'clap' | 'rewind' | 'drop';

export const SAMPLE_LABELS: Record<SampleName, string> = {
  horn: 'AIR HORN',
  siren: 'SIREN',
  laser: 'LASER',
  drop: 'BASS DROP',
  kick: 'KICK',
  snare: 'SNARE',
  clap: 'CLAP',
  rewind: 'BACKSPIN',
};

async function renderOne(len: number, fn: (ctx: OfflineAudioContext, out: AudioNode, nb: AudioBuffer) => void) {
  const ctx = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
  const out = ctx.createGain();
  out.gain.value = 0.8;
  out.connect(ctx.destination);
  fn(ctx, out, noiseBuffer(ctx, 2));
  return ctx.startRendering();
}

export async function renderSamples(): Promise<Partial<Record<SampleName, AudioBuffer>>> {
  const horn = renderOne(1.6, (ctx, out) => {
    const hits: [number, number][] = [
      [0, 0.16],
      [0.2, 0.16],
      [0.4, 0.9],
    ];
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512 - 1) * 3;
      curve[i] = Math.tanh(x);
    }
    sh.curve = curve;
    const g0 = ctx.createGain();
    g0.gain.value = 0.35;
    sh.connect(g0).connect(out);
    hits.forEach(([t, d]) => {
      [440, 443, 554, 659].forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 1.03, t);
        o.frequency.linearRampToValueAtTime(f, t + 0.05);
        o.frequency.linearRampToValueAtTime(f * 0.97, t + d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.015);
        g.gain.setValueAtTime(0.25, t + d - 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(sh);
        o.start(t);
        o.stop(t + d);
      });
    });
  });
  const siren = renderOne(2.2, (ctx, out) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.2;
    const lg = ctx.createGain();
    lg.gain.value = 350;
    o.frequency.value = 900;
    lfo.connect(lg).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(0.25, 0.05);
    g.gain.setValueAtTime(0.25, 1.9);
    g.gain.exponentialRampToValueAtTime(0.0001, 2.15);
    o.connect(lp).connect(g).connect(out);
    o.start(0);
    lfo.start(0);
    o.stop(2.2);
    lfo.stop(2.2);
  });
  const laser = renderOne(1.0, (ctx, out) => {
    [0, 0.18, 0.36].forEach((t) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(2600, t);
      o.frequency.exponentialRampToValueAtTime(120, t + 0.22);
      const g = ctx.createGain();
      env(g, t, 0.002, 0.3, 0.22);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.3);
    });
  });
  const drop = renderOne(2.2, (ctx, out) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(220, 0);
    o.frequency.exponentialRampToValueAtTime(32, 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 0);
    g.gain.exponentialRampToValueAtTime(1, 0.02);
    g.gain.setValueAtTime(1, 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, 2.1);
    o.connect(g).connect(out);
    o.start(0);
    o.stop(2.2);
  });
  const k = renderOne(0.6, (ctx, out) => kick(ctx, out, 0, 1.1, true));
  const s = renderOne(0.5, (ctx, out, nb) => snare(ctx, out, nb, 0, 1.2));
  const c = renderOne(0.5, (ctx, out, nb) => clap(ctx, out, nb, 0, 1.2));
  const [a, b, l, d, kk, ss, cc] = await Promise.all([horn, siren, laser, drop, k, s, c]);
  return { horn: a, siren: b, laser: l, drop: d, kick: kk, snare: ss, clap: cc };
}
