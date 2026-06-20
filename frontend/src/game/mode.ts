export type Mode = "sandbox" | "timed";

export const STARTING_CASH = 10000;
export const TICK_MS = 800;
export const TIMED_SECONDS = 120;
export const TIMED_TICKS = Math.round((TIMED_SECONDS * 1000) / TICK_MS);

const BEST_KEY = "ticker-runner-best";

// Counts down a fixed number of ticks, then flips to over.
export class TimedGame {
  remainingTicks: number;
  over = false;

  constructor(public totalTicks: number) {
    this.remainingTicks = totalTicks;
  }

  tick(): void {
    if (this.over) return;
    this.remainingTicks -= 1;
    if (this.remainingTicks <= 0) {
      this.remainingTicks = 0;
      this.over = true;
    }
  }
}

export function loadBestScore(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function recordScore(score: number): number {
  const best = Math.max(loadBestScore(), score);
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // storage unavailable (private mode): degrade silently
  }
  return best;
}
