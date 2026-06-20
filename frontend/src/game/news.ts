import type { VolLevel } from "../sim/engine";

export interface NewsEvent {
  ticker: string;
  headline: string;
  shockPct: number; // signed price shock, e.g. +0.08 or -0.06
}

const POSITIVE = [
  "{T} lands a megadeal",
  "{T} crushes earnings",
  "{T} unveils a breakthrough chip",
  "Analysts upgrade {T}",
  "{T} announces a buyback",
];

const NEGATIVE = [
  "{T} hit with a lawsuit",
  "{T} misses guidance",
  "Regulators open a probe into {T}",
  "{T} CEO steps down",
  "{T} recalls a product",
];

// Chance per tick that a news event fires, by volatility level.
export const NEWS_PROB: Record<VolLevel, number> = {
  1: 0.00,
  2: 0.03,
  3: 0.07,
  4: 0.15,
};

// Base shock magnitude by level (a positive fraction).
export const NEWS_SHOCK: Record<VolLevel, number> = {
  1: 0.00,
  2: 0.05,
  3: 0.10,
  4: 0.20,
};

// Pure: decide whether news fires this tick and build the event. No side effects.
export function pickNews(
  rng: () => number,
  tickers: string[],
  level: VolLevel,
): NewsEvent | null {
  if (rng() >= NEWS_PROB[level]) return null;
  const ticker = tickers[Math.floor(rng() * tickers.length)];
  const positive = rng() < 0.5;
  const magnitude = NEWS_SHOCK[level] * (0.6 + rng() * 0.8); // 0.6x to 1.4x of base
  const shockPct = positive ? magnitude : -magnitude;
  const list = positive ? POSITIVE : NEGATIVE;
  const headline = list[Math.floor(rng() * list.length)].replace("{T}", ticker);
  return { ticker, headline, shockPct };
}
