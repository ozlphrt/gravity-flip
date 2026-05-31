import type { Color } from '../core/types';
import { COLOR_PHYSICS } from '../renderer/CubeRenderer';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private muted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    // Resume suspended context (required by browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  async loadAll(): Promise<void> {
    // If no real audio files are available, we generate tones procedurally
    // This works offline and requires no file assets for the prototype
    const ctx = this.getCtx();
    this.buffers.set('slide', this.generateSlide(ctx));
    this.buffers.set('impact', this.generateImpact(ctx));
    this.buffers.set('lock', this.generateLock(ctx));
    this.buffers.set('pop', this.generatePop(ctx));
  }

  play(name: 'slide' | 'impact' | 'lock' | 'pop', color?: Color): void {
    if (this.muted) return;
    const ctx = this.getCtx();
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (name === 'impact' && color) {
      const phys = COLOR_PHYSICS[color] ?? { pitchOffset: 1.0, volume: 0.18 };
      source.playbackRate.value = phys.pitchOffset;

      const gainNode = ctx.createGain();
      gainNode.gain.value = phys.volume;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }

    source.start(0);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  get isMuted(): boolean { return this.muted; }

  // ── Procedural sound generators ───────────────────────
  private generateSlide(ctx: AudioContext): AudioBuffer {
    const duration = 0.22;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 15) * (1 - Math.exp(-t * 45));
      // Soft, very quiet low-pass filtered noise swish
      data[i] = env * (Math.random() * 2 - 1) * 0.045;
    }
    return buf;
  }

  private generateImpact(ctx: AudioContext): AudioBuffer {
    const duration = 0.03;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 220); // rapid decay
      // High-pitched subtle mechanical click
      data[i] = env * Math.sin(2 * Math.PI * 1800 * (t + 0.002 * Math.random())) * 0.18;
    }
    return buf;
  }

  private generateLock(ctx: AudioContext): AudioBuffer {
    const duration = 0.4;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    // Pleasant chime: two harmonics
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 6);
      data[i] = env * (
        Math.sin(2 * Math.PI * 880 * t) * 0.4
      + Math.sin(2 * Math.PI * 1320 * t) * 0.2
      + Math.sin(2 * Math.PI * 1760 * t) * 0.1
      );
    }
    return buf;
  }

  private generatePop(ctx: AudioContext): AudioBuffer {
    const duration = 0.35;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * duration, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const env = Math.exp(-t * 12);
      const freq = 1200 + t * 2400;
      data[i] = env * Math.sin(2 * Math.PI * freq * t) * 0.16;
    }
    return buf;
  }
}
