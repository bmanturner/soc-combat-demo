// Frame-driven tween clock for the 3D board. Advanced by the render loop, so animations pause
// with requestAnimationFrame (hidden tab) exactly like Phaser's scene clock.

import type { Ease } from '../board/choreography';

export type EaseFn = (t: number) => number;

export const EASE: Record<Ease | 'cubic', EaseFn> = {
  linear: (t) => t,
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  quad: (t) => 1 - (1 - t) * (1 - t),
  cubic: (t) => 1 - (1 - t) ** 3,
  back: (t) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

/** Progress for `legs` alternating forward/back legs (yoyo); returns 0..1 within the current leg. */
export function yoyo(p: number, legs: number): number {
  const leg = Math.min(legs - 1, Math.floor(p * legs));
  const local = p * legs - leg;
  return leg % 2 === 0 ? local : 1 - local;
}

interface Job {
  elapsed: number;
  duration: number;
  update: (p: number) => void;
  done: () => void;
}

export class TweenClock {
  private jobs = new Set<Job>();

  /** Calls `update(progress)` every frame for `ms`, then `done`. Returns a canceller that skips `done`. */
  run(ms: number, update: (p: number) => void, done: () => void): () => void {
    const job: Job = { elapsed: 0, duration: Math.max(1, ms), update, done };
    this.jobs.add(job);
    return () => this.jobs.delete(job);
  }

  tick(dtMs: number): void {
    for (const job of [...this.jobs]) {
      job.elapsed += dtMs;
      const p = Math.min(1, job.elapsed / job.duration);
      job.update(p);
      if (p >= 1 && this.jobs.delete(job)) job.done();
    }
  }
}
