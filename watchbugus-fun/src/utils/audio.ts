/**
 * Audio Utility (Web Audio API) - Generates tones programmatically
 * No external audio files needed!
 */

interface AudioBufferMap {
  [key: string]: AudioBuffer;
}

class AudioManager {
  private context: AudioContext | null = null;
  private buffers: AudioBufferMap = {};
  private musicOscillators: OscillatorNode[] = [];
  private musicGain: GainNode | null = null;
  private loaded = false;

  // Tone definitions: { frequency, type, duration, volume }
  private readonly tones: Record<string, { freq: number; type: OscillatorType; duration: number; volume: number }> = {
    'generate-start': { freq: 220, type: 'sine', duration: 0.3, volume: 0.3 },      // Low A3
    'generate-done': { freq: 880, type: 'sine', duration: 0.5, volume: 0.3 },       // High A5
    'steve-call': { freq: 440, type: 'square', duration: 1.0, volume: 0.2 },       // Ring tone A4
    'wheel-tick': { freq: 1000, type: 'square', duration: 0.05, volume: 0.4 },     // Tick
    'wheel-win': { freq: 660, type: 'triangle', duration: 0.8, volume: 0.3 },      // Win E5
    'coupon-expired': { freq: 150, type: 'sawtooth', duration: 0.6, volume: 0.3 }, // Sad trombone-ish
    'shop-bossa-loop': { freq: 220, type: 'sine', duration: 2.0, volume: 0.15 }    // Music loop base
  };

  init(): void {
    if (this.loaded) return;
    this.generateTones();
    this.loaded = true;
  }

  private generateTones(): void {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.2;
      this.musicGain.connect(this.context.destination);

      // Generate all tone buffers
      Object.entries(this.tones).forEach(([name, config]) => {
        this.buffers[name] = this.createToneBuffer(config);
      });
    } catch (err) {
      console.warn('Web Audio API not available', err);
    }
  }

  private createToneBuffer(config: { freq: number; type: OscillatorType; duration: number; volume: number }): AudioBuffer {
    if (!this.context) return this.context!.createBuffer(1, 1, 44100);

    const sampleRate = this.context.sampleRate;
    const length = sampleRate * config.duration;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      switch (config.type) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * config.freq * t);
          break;
        case 'square':
          sample = Math.sin(2 * Math.PI * config.freq * t) > 0 ? 1 : -1;
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * (t * config.freq - Math.floor(t * config.freq + 0.5))) - 1;
          break;
        case 'sawtooth':
          sample = 2 * (t * config.freq - Math.floor(t * config.freq + 0.5));
          break;
      }

      // Apply envelope (attack/decay)
      const attackTime = 0.01;
      const decayTime = config.duration * 0.8;
      let envelope = 1;
      if (t < attackTime) {
        envelope = t / attackTime;
      } else if (t > config.duration - decayTime) {
        envelope = (config.duration - t) / decayTime;
      }

      data[i] = sample * envelope * config.volume;
    }

    return buffer;
  }

  private ensureContext(): AudioContext | null {
    if (!this.context) {
      try {
        this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.musicGain = this.context.createGain();
        this.musicGain.gain.value = 0.2;
        this.musicGain.connect(this.context.destination);
        this.generateTones();
      } catch {
        return null;
      }
    }
    return this.context;
  }

  async play(name: string, options: { volume?: number; loop?: boolean } = {}): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.buffers[name]) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = this.buffers[name];
    source.loop = options.loop || false;

    const gain = ctx.createGain();
    gain.gain.value = options.volume ?? 1;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);

    return new Promise(resolve => {
      source.onended = () => resolve();
      // Safety timeout
      setTimeout(resolve, (this.buffers[name].duration + 0.1) * 1000);
    });
  }

  async playMusic(_name: string): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Stop current music
    this.stopMusic();

    // Create a simple bossa-nova-ish loop using multiple oscillators
    // This is a very simple approximation - just a repeating pattern
    const playLoop = () => {
      if (!this.musicGain) return;

      // Bass note
      const bass = ctx.createOscillator();
      bass.type = 'sine';
      bass.frequency.value = 110; // A2
      const bassGain = ctx.createGain();
      bassGain.gain.value = 0.1;
      bass.connect(bassGain);
      bassGain.connect(this.musicGain);
      bass.start(ctx.currentTime);
      bass.stop(ctx.currentTime + 2);
      this.musicOscillators.push(bass);

      // Chord
      const chordFreqs = [220, 277, 330]; // A3, C#4, E4
      chordFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(this.musicGain!);
        const delay = i * 0.1;
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + 2);
        this.musicOscillators.push(osc);
      });

      // Schedule next loop
      setTimeout(playLoop, 2000);
    };

    playLoop();
  }

  pauseMusic(): void {
    this.musicOscillators.forEach(osc => {
      try { osc.stop(0); } catch {}
    });
    this.musicOscillators = [];
  }

  stopMusic(): void {
    this.pauseMusic();
  }

  setMusicVolume(volume: number): void {
    if (this.musicGain) {
      this.musicGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
}

export const audio = new AudioManager();