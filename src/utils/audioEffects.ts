class AudioFXEngine {
  private ctx: AudioContext | null = null;
  private customForwardBuffers: Record<'left' | 'right', AudioBuffer | null> = {
    left: null,
    right: null,
  };
  private customBackwardBuffers: Record<'left' | 'right', AudioBuffer | null> = {
    left: null,
    right: null,
  };
  private customFileNames: Record<'left' | 'right', string | null> = {
    left: null,
    right: null,
  };
  private customStartOffsets: Record<'left' | 'right', number> = {
    left: 0,
    right: 0,
  };
  private customSlicePositions: Record<'left' | 'right', number> = {
    left: 0,
    right: 0,
  };

  private customAirhornBuffer: AudioBuffer | null = null;
  private customAirhornFileName: string | null = null;

  private customBrakeBuffer: AudioBuffer | null = null;
  private customBrakeFileName: string | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      const unlockAudio = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { capture: true });
      window.addEventListener('keydown', unlockAudio, { capture: true });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Trims leading silence from AudioBuffer by scanning for non-silent audio frames
   */
  private calculateAudioStartOffset(buffer: AudioBuffer): number {
    const threshold = 0.003;
    const numChannels = buffer.numberOfChannels;
    let minFrame = buffer.length;

    for (let c = 0; c < numChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        if (Math.abs(data[i]) > threshold) {
          if (i < minFrame) minFrame = i;
          break;
        }
      }
    }

    if (minFrame >= buffer.length) return 0;
    return minFrame / buffer.sampleRate;
  }

  /**
   * Loads a custom audio file (MP3/WAV/OGG/M4A) for deck-specific scratch sound.
   * Generates both forward and reversed buffer for realistic scratching.
   */
  public async loadCustomScratchSound(deckId: 'left' | 'right', file: File): Promise<string> {
    this.initCtx();
    if (!this.ctx) throw new Error('AudioContext not initialized');

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const arrayBuffer = await file.arrayBuffer();

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        this.ctx!.decodeAudioData(
          arrayBuffer.slice(0),
          (buf) => resolve(buf),
          (err) => reject(err)
        );
      });
    }

    // Forward buffer
    this.customForwardBuffers[deckId] = audioBuffer;

    // Reversed buffer for backward scratch
    const reversedBuffer = this.ctx.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const forwardData = audioBuffer.getChannelData(channel);
      const reversedData = reversedBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        reversedData[i] = forwardData[audioBuffer.length - 1 - i];
      }
    }

    this.customBackwardBuffers[deckId] = reversedBuffer;
    this.customFileNames[deckId] = file.name;

    const startOffset = this.calculateAudioStartOffset(audioBuffer);
    this.customStartOffsets[deckId] = startOffset;
    this.customSlicePositions[deckId] = startOffset;

    // Play instant audio test feedback so user confirms sound is working
    setTimeout(() => {
      this.playTestCustomScratch(deckId);
    }, 50);

    return file.name;
  }

  /**
   * Removes custom scratch sound for deck and resets to default synthesis
   */
  public removeCustomScratchSound(deckId: 'left' | 'right') {
    this.customForwardBuffers[deckId] = null;
    this.customBackwardBuffers[deckId] = null;
    this.customFileNames[deckId] = null;
    this.customStartOffsets[deckId] = 0;
    this.customSlicePositions[deckId] = 0;
  }

  /**
   * Returns current uploaded scratch file name or null
   */
  public getCustomScratchFileName(deckId: 'left' | 'right'): string | null {
    return this.customFileNames[deckId];
  }

  /**
   * Plays a loud test preview of the custom scratch sound
   */
  public playTestCustomScratch(deckId: 'left' | 'right') {
    try {
      this.initCtx();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const customBuffer = this.customForwardBuffers[deckId];
      if (!customBuffer) {
        this.playScratchSound(deckId, 'forward', 1.0);
        return;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = customBuffer;

      const gainNode = this.ctx.createGain();
      const startOffset = this.customStartOffsets[deckId] || 0;
      const playDuration = Math.min(2.0, Math.max(0.6, customBuffer.duration - startOffset));

      const now = this.ctx.currentTime;
      gainNode.gain.setValueAtTime(1.0, now);
      const fadeStart = Math.max(now, now + playDuration - 0.1);
      gainNode.gain.setValueAtTime(1.0, fadeStart);
      gainNode.gain.linearRampToValueAtTime(0.001, now + playDuration);

      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      source.start(now, startOffset, playDuration);
    } catch (e) {
      console.warn('Error playing test scratch:', e);
    }
  }

  /**
   * Plays deck-specific vinyl scratch audio sound effect
   * @param deckId 'left' or 'right'
   * @param direction 'forward' or 'backward'
   * @param speed speed factor
   */
  public playScratchSound(
    deckId: 'left' | 'right' = 'left',
    direction: 'forward' | 'backward' = 'forward',
    speed: number = 1.0
  ) {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const customBuffer = direction === 'forward'
        ? this.customForwardBuffers[deckId]
        : this.customBackwardBuffers[deckId];

      if (customBuffer) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume();
        }

        const source = this.ctx.createBufferSource();
        source.buffer = customBuffer;

        const baseRate = Math.min(Math.max(speed, 0.7), 2.2);
        source.playbackRate.value = baseRate;

        const gainNode = this.ctx.createGain();
        const startOffset = this.customStartOffsets[deckId] || 0;

        let offset = startOffset;
        let playDuration = 0.5;

        if (customBuffer.duration - startOffset <= 1.2) {
          offset = startOffset;
          playDuration = Math.max(0.2, customBuffer.duration - startOffset);
        } else {
          let pos = this.customSlicePositions[deckId];
          if (pos >= customBuffer.duration - 0.3) {
            pos = startOffset;
          }
          offset = pos;
          playDuration = Math.min(0.5, customBuffer.duration - offset);
          this.customSlicePositions[deckId] = offset + 0.2;
        }

        const now = this.ctx.currentTime;
        gainNode.gain.setValueAtTime(1.0, now);
        const fadeStart = Math.max(now, now + playDuration - 0.05);
        gainNode.gain.setValueAtTime(1.0, fadeStart);
        gainNode.gain.linearRampToValueAtTime(0.001, now + playDuration);

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        source.start(now, offset, playDuration);
        return;
      }

      // Default synth scratch sound generator
      const now = this.ctx.currentTime;
      const duration = 0.12 / speed;

      // Create noise buffer for vinyl friction texture
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      // Filter to simulate needle friction and vinyl groove tone
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';

      const freqMultiplier = deckId === 'left' ? 1.0 : 1.35;
      const startFreq = (direction === 'forward' ? 300 : 1800) * freqMultiplier;
      const endFreq = (direction === 'forward' ? 2400 : 400) * freqMultiplier;

      filter.frequency.setValueAtTime(startFreq, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(100, endFreq), now + duration);
      filter.Q.value = deckId === 'left' ? 4.0 : 6.0;

      // Main Oscillator tone for pitch glide
      const osc = this.ctx.createOscillator();
      osc.type = deckId === 'left' ? 'sawtooth' : 'triangle';

      const pitchStart = (direction === 'forward' ? 120 : 450) * freqMultiplier;
      const pitchEnd = (direction === 'forward' ? 520 : 90) * freqMultiplier;

      osc.frequency.setValueAtTime(pitchStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, pitchEnd), now + duration);

      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.15, now);
      oscGain.gain.linearRampToValueAtTime(0.25, now + duration * 0.5);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      // Connect
      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);

      whiteNoise.start(now);
      osc.start(now);

      whiteNoise.stop(now + duration);
      osc.stop(now + duration);
    } catch {
      // Ignore audio context errors if blocked by browser policy before user interaction
    }
  }

  /**
   * Loads custom audio file for AIRHORN or BRAKE sound FX
   */
  public async loadCustomEffect(effectType: 'airhorn' | 'brake', file: File): Promise<string> {
    this.initCtx();
    if (!this.ctx) throw new Error('AudioContext not initialized');

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const arrayBuffer = await file.arrayBuffer();
    let audioBuffer: AudioBuffer;

    try {
      audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        this.ctx!.decodeAudioData(
          arrayBuffer.slice(0),
          (buf) => resolve(buf),
          (err) => reject(err)
        );
      });
    }

    if (effectType === 'airhorn') {
      this.customAirhornBuffer = audioBuffer;
      this.customAirhornFileName = file.name;
      setTimeout(() => this.playAirhorn(), 50);
    } else {
      this.customBrakeBuffer = audioBuffer;
      this.customBrakeFileName = file.name;
      setTimeout(() => this.playVinylBrake(), 50);
    }

    return file.name;
  }

  /**
   * Removes custom audio file for AIRHORN or BRAKE, resetting to default synth
   */
  public removeCustomEffect(effectType: 'airhorn' | 'brake') {
    if (effectType === 'airhorn') {
      this.customAirhornBuffer = null;
      this.customAirhornFileName = null;
    } else {
      this.customBrakeBuffer = null;
      this.customBrakeFileName = null;
    }
  }

  /**
   * Returns current uploaded file name for AIRHORN or BRAKE or null
   */
  public getCustomEffectFileName(effectType: 'airhorn' | 'brake'): string | null {
    return effectType === 'airhorn' ? this.customAirhornFileName : this.customBrakeFileName;
  }

  /**
   * Pioneer Airhorn Sound Effect
   */
  public playAirhorn() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // If user uploaded custom airhorn file, play it!
      if (this.customAirhornBuffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.customAirhornBuffer;

        const gainNode = this.ctx.createGain();
        const now = this.ctx.currentTime;
        gainNode.gain.setValueAtTime(1.0, now);

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(now);
        return;
      }

      // Default synth Airhorn
      const now = this.ctx.currentTime;
      const blastCount = 3;

      for (let b = 0; b < blastCount; b++) {
        const blastStart = now + b * 0.12;
        const duration = 0.1;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';

        osc1.frequency.setValueAtTime(370, blastStart); // F#4
        osc2.frequency.setValueAtTime(466.16, blastStart); // A#4

        gain.gain.setValueAtTime(0.25, blastStart);
        gain.gain.exponentialRampToValueAtTime(0.001, blastStart + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(blastStart);
        osc2.start(blastStart);
        osc1.stop(blastStart + duration);
        osc2.stop(blastStart + duration);
      }
    } catch {
      // Audio fallback
    }
  }

  /**
   * Pioneer Vinyl Brake (Turntable Stop) sound
   */
  public playVinylBrake() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // If user uploaded custom vinyl brake file, play it!
      if (this.customBrakeBuffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = this.customBrakeBuffer;

        const gainNode = this.ctx.createGain();
        const now = this.ctx.currentTime;
        gainNode.gain.setValueAtTime(1.0, now);

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(now);
        return;
      }

      // Default synth Vinyl Brake
      const now = this.ctx.currentTime;
      const duration = 0.8;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + duration);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio fallback
    }
  }

  /**
   * Pioneer Cue Click Sound
   */
  public playCueClick() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Audio fallback
    }
  }
}

export const audioFX = new AudioFXEngine();
