// 데크 하나의 "턴테이블" 역할을 하는 오디오 처리기.
// 음악 파일을 바늘처럼 읽어서, 손으로 판을 밀고 당기면 실제로 그 속도·방향대로 소리가 난다.
// (스크래치 = 진짜 음원을 앞뒤로 긁는 소리)

const SEC_PER_REV = 1.8; // 33⅓ rpm 한 바퀴

class DeckProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null;
    this.len = 0;
    this.srcRate = sampleRate;
    this.ratio = 1; // 원본 샘플레이트 / 출력 샘플레이트
    this.pos = 0; // 원본 샘플 단위 위치
    this.vel = 0; // 출력 1샘플당 원본 몇 샘플 전진하는지
    this.playing = false;
    this.rate = 1;
    this.bend = 0;
    this.touch = false;
    this.target = 0;
    this.loopOn = false;
    this.loopIn = 0;
    this.loopOut = 0;
    this.wrap = false;
    this.spin = 0; // 백스핀 남은 샘플 수
    this.counter = 0;
    this.ended = false;
    this.noiseLP = 0;
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  onMsg(m) {
    switch (m.type) {
      case 'load':
        this.ch = m.channels;
        this.len = this.ch.length ? this.ch[0].length : 0;
        this.srcRate = m.sampleRate;
        this.ratio = this.srcRate / sampleRate;
        this.pos = (m.start || 0) * this.srcRate;
        this.target = this.pos;
        this.vel = 0;
        this.loopOn = false;
        this.spin = 0;
        this.ended = false;
        this.wrap = !!m.wrap;
        break;
      case 'unload':
        this.ch = null;
        this.len = 0;
        break;
      case 'play':
        this.playing = m.on;
        if (m.on) this.ended = false;
        break;
      case 'rate':
        this.rate = m.rate;
        break;
      case 'bend':
        this.bend = m.amount;
        break;
      case 'seek':
        this.pos = Math.max(0, Math.min(this.len - 2, m.time * this.srcRate));
        this.target = this.pos;
        this.ended = false;
        if (m.stop) this.vel = 0;
        break;
      case 'touch':
        this.touch = m.on;
        this.target = this.pos;
        if (m.on) this.spin = 0;
        break;
      case 'scratch':
        this.target += m.delta * this.srcRate;
        break;
      case 'loop':
        this.loopOn = m.on;
        if (m.on) {
          this.loopIn = m.in * this.srcRate;
          this.loopOut = m.out * this.srcRate;
        }
        break;
      case 'backspin':
        this.spin = Math.floor(sampleRate * (m.duration || 1.2));
        this.vel = -(m.speed || 4) * this.ratio;
        break;
    }
  }

  read(c, p) {
    // 4점 에르미트 보간(부드러운 소리)
    const i = Math.floor(p);
    const f = p - i;
    const n = this.len;
    const x0 = c[i > 0 ? i - 1 : 0];
    const x1 = c[i];
    const x2 = c[i + 1 < n ? i + 1 : n - 1];
    const x3 = c[i + 2 < n ? i + 2 : n - 1];
    const c1 = 0.5 * (x2 - x0);
    const c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3;
    const c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
    return ((c3 * f + c2) * f + c1) * f + x1;
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];
    const n = L.length;
    if (!this.ch || this.len < 4) {
      return true;
    }
    const cL = this.ch[0];
    const cR = this.ch[1] || cL;
    const sr = sampleRate;
    const kTouch = 1 / (sr * 0.006);
    const kStart = 1 / (sr * 0.07);
    const kBrake = 1 / (sr * 0.09);
    const kSpin = 1 / (sr * 0.35);
    const follow = sr * 0.012;
    const maxV = 8 * this.ratio;

    for (let i = 0; i < n; i++) {
      if (this.touch) {
        let tv = (this.target - this.pos) / follow;
        if (tv > maxV) tv = maxV;
        else if (tv < -maxV) tv = -maxV;
        this.vel += (tv - this.vel) * kTouch;
      } else if (this.spin > 0) {
        this.spin--;
        const goal = this.playing ? (this.rate + this.bend) * this.ratio : 0;
        this.vel += (goal - this.vel) * kSpin;
      } else {
        const goal = this.playing ? (this.rate + this.bend) * this.ratio : 0;
        this.vel += (goal - this.vel) * (this.playing ? kStart : kBrake);
      }

      let p = this.pos + this.vel;
      if (!this.touch && this.loopOn && this.vel > 0 && p >= this.loopOut) {
        p -= this.loopOut - this.loopIn;
      }
      if (p >= this.len - 2) {
        if (this.wrap) {
          p -= this.len - 2;
        } else {
          p = this.len - 2;
          if (!this.touch) {
            this.vel = 0;
            if (this.playing && !this.ended) {
              this.ended = true;
              this.playing = false;
              this.port.postMessage({ type: 'ended' });
            }
          }
        }
      } else if (p < 0) {
        if (this.wrap) p += this.len - 2;
        else {
          p = 0;
          this.vel = 0;
        }
      }
      if (this.touch) {
        if (this.target < 0) this.target = 0;
        if (this.target > this.len - 2) this.target = this.len - 2;
      }
      this.pos = p;

      let l = this.read(cL, p);
      let r = cR === cL ? l : this.read(cR, p);

      // 손으로 판을 문지를 때 나는 아주 작은 바늘/마찰 소리
      if (this.touch) {
        const sp = Math.min(1, Math.abs(this.vel / this.ratio));
        this.noiseLP += ((Math.random() * 2 - 1) - this.noiseLP) * 0.35;
        const nz = this.noiseLP * 0.006 * sp;
        l += nz;
        r += nz;
      }
      L[i] = l;
      R[i] = r;
    }

    this.counter += n;
    if (this.counter >= 768) {
      this.counter = 0;
      this.port.postMessage({
        type: 'pos',
        t: this.pos / this.srcRate,
        v: this.vel / this.ratio,
        at: currentTime,
      });
    }
    return true;
  }
}

registerProcessor('deck-processor', DeckProcessor);
void SEC_PER_REV;
