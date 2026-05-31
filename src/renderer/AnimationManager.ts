// ============================================================
// AnimationManager — tween coordinator
// All tweens are managed here; renderer reads from them each frame.
// ============================================================

export interface Tween {
  id: string;
  startTime: number;
  duration: number; // ms
  from: number[];
  to: number[];
  easing: (t: number) => number;
  onUpdate: (values: number[]) => void;
  onComplete?: () => void;
  done: boolean;
}

// Easing functions
export const Easings = {
  linear: (t: number) => t,
  easeInCubic: (t: number) => t * t * t,
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export class AnimationManager {
  private tweens: Map<string, Tween> = new Map();
  private counter = 0;

  /** Add a new tween. Returns the tween id. */
  add(
    from: number[],
    to: number[],
    duration: number,
    easing: (t: number) => number,
    onUpdate: (values: number[]) => void,
    onComplete?: () => void
  ): string {
    const id = `tween_${this.counter++}`;
    const tween: Tween = {
      id,
      startTime: performance.now(),
      duration,
      from: [...from],
      to: [...to],
      easing,
      onUpdate,
      onComplete,
      done: false,
    };
    this.tweens.set(id, tween);
    return id;
  }

  /** Cancel a tween by id */
  cancel(id: string): void {
    this.tweens.delete(id);
  }

  /** Cancel all tweens */
  cancelAll(): void {
    this.tweens.clear();
  }

  /** Must be called each frame (from render loop) */
  update(now: number): void {
    for (const [id, tween] of this.tweens) {
      if (tween.done) { this.tweens.delete(id); continue; }

      const elapsed = now - tween.startTime;
      const rawT = Math.min(elapsed / tween.duration, 1);
      const t = tween.easing(rawT);

      const values = tween.from.map((f, i) => f + (tween.to[i] - f) * t);
      tween.onUpdate(values);

      if (rawT >= 1) {
        tween.done = true;
        tween.onComplete?.();
        this.tweens.delete(id);
      }
    }
  }

  get isActive(): boolean {
    return this.tweens.size > 0;
  }

  /** Wait until all current tweens finish, then resolve */
  waitForAll(): Promise<void> {
    if (!this.isActive) return Promise.resolve();
    return new Promise(resolve => {
      const check = () => {
        if (!this.isActive) resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }
}
