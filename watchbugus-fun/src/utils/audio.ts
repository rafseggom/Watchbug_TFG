/**
 * Audio Utility (Web Audio API) - Generates tones for SFX, loads MP3 for music
 */

interface AudioBufferMap {
  [key: string]: AudioBuffer;
}

class AudioManager {
  private context: AudioContext | null = null;
  private buffers: AudioBufferMap = {};
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  // Tone definitions for SFX: { frequency, type, duration, volume }
  private readonly tones: Record<string, { freq: number; type: OscillatorType; duration: number; volume: number }> = {
    'generate-start': { freq: 220, type: 'sine', duration: 0.3, volume: 0.3 },
    'generate-done': { freq: 880, type: 'sine', duration: 0.5, volume: 0.3 },
    'steve-call': { freq: 440, type: 'square', duration: 1.0, volume: 0.2 },
    'wheel-tick': { freq: 1000, type: 'square', duration: 0.05, volume: 0.4 },
    'wheel-win': { freq: 660, type: 'triangle', duration: 0.8, volume: 0.3 },
    'coupon-expired': { freq: 150, type: 'sawtooth', duration: 0.6, volume: 0.3 },
  };

  // External music file
  private readonly musicFile = '/audio/background.mp3';

  init(): void {
    if (this.loadPromise) return;
    this.loadPromise = this.loadAll();
  }

  private async loadAll(): Promise<void> {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.2;
      this.musicGain.connect(this.context.destination);

      // Generate SFX tones
      Object.entries(this.tones).forEach(([name, config]) => {
        this.buffers[name] = this.createToneBuffer(config);
      });

      // Load background music
      try {
        const response = await fetch(this.musicFile);
        const arrayBuffer = await response.arrayBuffer();
        this.buffers['shop-bossa-loop'] = await this.context!.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.warn('Failed to load background music, using generated tone:', err);
        // Fallback to generated tone
        this.buffers['shop-bossa-loop'] = this.createToneBuffer({
          freq: 220, type: 'sine', duration: 2.0, volume: 0.15
        });
      }

      this.loaded = true;
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
        // Generate tones
        Object.entries(this.tones).forEach(([name, config]) => {
          this.buffers[name] = this.createToneBuffer(config);
        });
        // Load music in background
        this.loadMusicFile();
      } catch {
        return null;
      }
    }
    return this.context;
  }

  private async loadMusicFile(): Promise<void> {
    if (!this.context || this.buffers['shop-bossa-loop']) return;
    try {
      const response = await fetch(this.musicFile);
      const arrayBuffer = await response.arrayBuffer();
      this.buffers['shop-bossa-loop'] = await this.context.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.warn('Failed to load background music:', err);
      this.buffers['shop-bossa-loop'] = this.createToneBuffer({
        freq: 220, type: 'sine', duration: 2.0, volume: 0.15
      });
    }
  }

  async play(name: string, options: { volume?: number; loop?: boolean } = {}): Promise<void> {
    if (!this.loaded) await this.loadPromise;
    const ctx = this.ensureContext();
    if (!ctx || !this.buffers[name]) return;

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
      setTimeout(resolve, (this.buffers[name].duration + 0.1) * 1000);
    });
  }

  async playMusic(name: string): Promise<void> {
    if (!this.loaded) await this.loadPromise;
    const ctx = this.ensureContext();
    if (!ctx || !this.buffers[name]) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.stopMusic();

    this.musicSource = ctx.createBufferSource();
    this.musicSource.buffer = this.buffers[name];
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain!);
    this.musicSource.start(0);
  }

  pauseMusic(): void {
    if (this.musicSource) {
      this.musicSource.stop(0);
      this.musicSource = null;
    }
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