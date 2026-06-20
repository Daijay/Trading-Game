import { gaussian } from "./rng";

export type VolLevel = 1 | 2 | 3 | 4;

export interface VolParams {
  sigma: number;
  jumpProb: number;
  jumpScale: number;
}

// Per-tick volatility. Higher level means bigger swings and more frequent jumps.
export const VOLATILITY: Record<VolLevel, VolParams> = {
  1: { sigma: 0.010, jumpProb: 0.00, jumpScale: 0.00 },
  2: { sigma: 0.025, jumpProb: 0.02, jumpScale: 0.03 },
  3: { sigma: 0.050, jumpProb: 0.05, jumpScale: 0.06 },
  4: { sigma: 0.110, jumpProb: 0.12, jumpScale: 0.14 },
};

export const MIN_PRICE = 1;

// Advance one tick: geometric Brownian motion plus an occasional jump.
export function nextPrice(
  price: number,
  level: VolLevel,
  rng: () => number,
  drift = 0,
): number {
  const { sigma, jumpProb, jumpScale } = VOLATILITY[level];
  const z = gaussian(rng);
  let next = price * Math.exp((drift - 0.5 * sigma * sigma) + sigma * z);
  if (rng() < jumpProb) {
    const sign = rng() < 0.5 ? -1 : 1;
    next += sign * jumpScale * price;
  }
  return Math.max(MIN_PRICE, next);
}
