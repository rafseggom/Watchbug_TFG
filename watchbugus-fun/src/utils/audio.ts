/**
 * Audio Utility
 *
 * Background music is a plain HTMLAudioElement: browsers allow it after a user
 * gesture, it streams, and it never trips the "AudioContext was not allowed to
 * start" warning. SFX are synthesised with the Web Audio API, but the
 * AudioContext is created lazily on the first real gesture and never at import
 * time.
 */

export type SfxName =
  | 'generate-start'
  | 'generate-done'
  | 'steve-call'
  | 'wheel-tick'
  | 'wheel-win'
  | 'coupon-expired'
  | 'bug-squash';

interface ToneConfig {
  freq: number;
  type: OscillatorType;
  duration: number;
  volume: number;
  slideTo?: number;
}

const MUSIC_FILE = '/audio/background.mp3';
const MUSIC_VOLUME = 0.32;

class AudioManager {
  private music: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private userActivated = false;
  private musicWanted = false;
  private musicFailed = false;

  private readonly tones: Record<string, ToneConfig> = {
    'generate-start': { freq: 220, type: 'sine', duration: 0.25, volume: 0.22, slideTo: 330 },
    'generate-done': { freq: 660, type: 'triangle', duration: 0.45, volume: 0.25, slideTo: 990 },
    'steve-call': { freq: 440, type: 'square', duration: 0.9, volume: 0.16 },
    'wheel-tick': { freq: 1000, type: 'square', duration: 0.04, volume: 0.18 },
    'wheel-win': { freq: 523, type: 'triangle', duration: 0.7, volume: 0.25, slideTo: 1046 },
    'coupon-expired': { freq: 180, type: 'sawtooth', duration: 0.45, volume: 0.18, slideTo: 90 },
    'bug-squash': { freq: 320, type: 'square', duration: 0.12, volume: 0.25, slideTo: 80 },
  };

  init(): void {
    if (this.music) return;

    this.music = new Audio(MUSIC_FILE);
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = MUSIC_VOLUME;

    // Music ends (or the file is missing) -> reflect that in the UI.
    this.music.addEventListener('ended', () => this.emitMusicState(false));
    this.music.addEventListener('error', () => {
      this.musicFailed = true;
      this.musicWanted = false;
      this.emitMusicState(false);
      console.warn('[watchbug] background music could not be loaded');
    });

    // First real gesture unlocks both the audio element and the Web Audio API.
    const unlock = () => {
      if (this.userActivated) return;
      this.userActivated = true;
      if (this.musicWanted) void this.playMusic();
    };

    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    window.addEventListener('touchstart', unlock, { once: true, capture: true, passive: true });
  }

  /** True once the page has received a real user gesture. */
  get activated(): boolean {
    return this.userActivated;
  }

  get musicPlaying(): boolean {
    return !!this.music && !this.music.paused && !this.music.ended;
  }

  private emitMusicState(playing: boolean): void {
    window.dispatchEvent(new CustomEvent('watchbug:music', { detail: { playing } }));
  }

  private ensureContext(): AudioContext | null {
    // Never build an AudioContext before a gesture: Chrome logs a warning and
    // the context starts suspended anyway.
    if (!this.userActivated) return null;

    if (!this.context) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.context = new Ctor();
        this.buildToneBuffers();
      } catch {
        return null;
      }
    }

    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => undefined);
    }
    return this.context;
  }

  private buildToneBuffers(): void {
    if (!this.context) return;
    for (const [name, config] of Object.entries(this.tones)) {
      this.buffers[name] = this.createToneBuffer(config);
    }
  }

  private createToneBuffer(config: ToneConfig): AudioBuffer {
    const ctx = this.context!;
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * config.duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const progress = i / length;
      const freq = config.slideTo
        ? config.freq + (config.slideTo - config.freq) * progress
        : config.freq;
      phase += (2 * Math.PI * freq) / sampleRate;

      let sample = 0;
      switch (config.type) {
        case 'sine':
          sample = Math.sin(phase);
          break;
        case 'square':
          sample = Math.sin(phase) >= 0 ? 1 : -1;
          break;
        case 'triangle':
          sample = (2 / Math.PI) * Math.asin(Math.sin(phase));
          break;
        case 'sawtooth':
          sample = ((phase / (2 * Math.PI)) % 1) * 2 - 1;
          break;
      }

      const attack = Math.min(1, t / 0.01);
      const release = Math.min(1, (config.duration - t) / (config.duration * 0.55));
      data[i] = sample * Math.max(0, Math.min(attack, release)) * config.volume;
    }

    return buffer;
  }

  /** Fire-and-forget sound effect. Safe to call from timers. */
  async play(name: string): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return; // no gesture yet: stay silent instead of throwing
    const buffer = this.buffers[name];
    if (!buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {
      /* audio is decoration; never break the page over it */
    }
  }

  async playMusic(_name?: string): Promise<void> {
    this.musicWanted = true;
    if (!this.music) this.init();
    if (!this.music || this.musicFailed) {
      this.emitMusicState(false);
      return;
    }
    if (!this.userActivated) {
      // Remember the intent; the gesture handler will start it.
      this.emitMusicState(false);
      return;
    }

    this.music.volume = MUSIC_VOLUME;
    try {
      await this.music.play();
      this.emitMusicState(true);
    } catch {
      this.emitMusicState(false);
    }
  }

  pauseMusic(): void {
    if (this.music && !this.music.paused) {
      this.music.pause();
      this.emitMusicState(false);
    }
  }

  stopMusic(): void {
    this.musicWanted = false;
    if (!this.music) return;
    this.music.pause();
    try {
      this.music.currentTime = 0;
    } catch {
      /* ignore */
    }
    this.emitMusicState(false);
  }

  async toggleMusic(): Promise<boolean> {
    if (this.musicPlaying) {
      this.stopMusic();
      return false;
    }
    await this.playMusic();
    return this.musicPlaying;
  }

  setMusicVolume(volume: number): void {
    if (this.music) {
      this.music.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

export const audio = new AudioManager();
