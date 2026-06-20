# Ticker Runner Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the valuation app with Ticker Runner, an arcade trading game with a fully simulated live market, buy/sell, gain/loss tracking, volatility levels 1 to 4, and two game modes.

**Architecture:** Pure TypeScript logic (seeded RNG, price engine, candle builder, market, portfolio, game mode) with no DOM or timers, driven by a React layer that runs the tick loop and renders. Charting via TradingView Lightweight Charts. No backend.

**Tech Stack:** React 18, TypeScript, Vite, lightweight-charts, Vitest, React Testing Library. No em dashes anywhere in code, comments, or UI copy.

---

## File Structure

```
frontend/src/
  sim/
    rng.ts          # mulberry32 seeded PRNG + gaussian draw
    engine.ts       # VOLATILITY table, nextPrice (GBM + jumps)
    candles.ts      # Candle type, CandleSeries (tick aggregation)
    market.ts       # ROSTER, Market (advances all stocks, volatility)
  game/
    portfolio.ts    # Portfolio (cash, positions, buy/sell, P&L selectors)
    mode.ts         # TimedGame, best-score localStorage helpers, constants
  components/
    Hud.tsx
    StockPicker.tsx
    CandleChart.tsx
    TradePanel.tsx
    VolatilityBar.tsx
    StartScreen.tsx
    ResultScreen.tsx
  App.tsx           # game loop + screen state + wiring
  theme.css         # game theme
  main.tsx          # unchanged
frontend/test/
  rng.test.ts
  engine.test.ts
  candles.test.ts
  market.test.ts
  portfolio.test.ts
  mode.test.ts
  TradePanel.test.tsx
  VolatilityBar.test.tsx
```

Old valuation files are deleted in Task 1.

---

### Task 1: Remove old valuation frontend

**Files:**
- Delete: `frontend/src/store.ts`, `frontend/src/types.ts`, `frontend/src/api.ts`,
  `frontend/src/components/TopBar.tsx`, `Watchlist.tsx`, `ChartPanel.tsx`,
  `AssumptionsPanel.tsx`, `BreakdownBar.tsx`
- Delete: `frontend/test/api.test.ts`, `BreakdownBar.test.tsx`, `AssumptionsPanel.test.tsx`
- Modify: `frontend/src/App.tsx` (temporary stub so the build stays green)

- [ ] **Step 1: Delete old source and tests**

```bash
cd frontend
rm src/store.ts src/types.ts src/api.ts
rm src/components/TopBar.tsx src/components/Watchlist.tsx src/components/ChartPanel.tsx src/components/AssumptionsPanel.tsx src/components/BreakdownBar.tsx
rm test/api.test.ts test/BreakdownBar.test.tsx test/AssumptionsPanel.test.tsx
```

- [ ] **Step 2: Replace `frontend/src/App.tsx` with a temporary stub**

```tsx
export default function App() {
  return <div className="terminal">Ticker Runner: under construction</div>;
}
```

- [ ] **Step 3: Verify build and tests still pass (no tests yet)**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm test`
Expected: "no test files found" or 0 tests (exit ok).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove valuation frontend to make room for the game"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `frontend/src/sim/rng.ts`
- Test: `frontend/test/rng.test.ts`

- [ ] **Step 1: Write failing test `frontend/test/rng.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { mulberry32, gaussian } from "../src/sim/rng";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("gaussian has roughly zero mean over many draws", () => {
    const r = mulberry32(123);
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += gaussian(r);
    expect(Math.abs(sum / n)).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- rng`
Expected: FAIL, cannot find `../src/sim/rng`.

- [ ] **Step 3: Implement `frontend/src/sim/rng.ts`**

```ts
// mulberry32: small fast deterministic PRNG. Returns a function giving [0, 1).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draw via Box-Muller using the supplied uniform generator.
export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- rng`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src/sim/rng.ts test/rng.test.ts
git commit -m "feat: add seeded RNG"
```

---

### Task 3: Price engine

**Files:**
- Create: `frontend/src/sim/engine.ts`
- Test: `frontend/test/engine.test.ts`

- [ ] **Step 1: Write failing test `frontend/test/engine.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/sim/rng";
import { nextPrice, VOLATILITY, MIN_PRICE, VolLevel } from "../src/sim/engine";

function avgAbsReturn(level: VolLevel, seed = 1): number {
  const rng = mulberry32(seed);
  let price = 100;
  let total = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) {
    const next = nextPrice(price, level, rng, 0);
    total += Math.abs(next / price - 1);
    price = next;
  }
  return total / n;
}

describe("engine", () => {
  it("is deterministic for a seed", () => {
    const r1 = mulberry32(5);
    const r2 = mulberry32(5);
    expect(nextPrice(100, 2, r1, 0)).toEqual(nextPrice(100, 2, r2, 0));
  });

  it("average absolute return increases with volatility level", () => {
    const a = avgAbsReturn(1);
    const b = avgAbsReturn(2);
    const c = avgAbsReturn(3);
    const d = avgAbsReturn(4);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThan(d);
  });

  it("never returns a price at or below the floor breach", () => {
    const rng = mulberry32(99);
    let price = 2;
    for (let i = 0; i < 2000; i++) {
      price = nextPrice(price, 4, rng, -0.05);
      expect(price).toBeGreaterThanOrEqual(MIN_PRICE);
    }
  });

  it("exposes a volatility entry for each level", () => {
    expect(Object.keys(VOLATILITY)).toEqual(["1", "2", "3", "4"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- engine`
Expected: FAIL, cannot find `../src/sim/engine`.

- [ ] **Step 3: Implement `frontend/src/sim/engine.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- engine`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts test/engine.test.ts
git commit -m "feat: add price engine with volatility levels"
```

---

### Task 4: Candle builder

**Files:**
- Create: `frontend/src/sim/candles.ts`
- Test: `frontend/test/candles.test.ts`

- [ ] **Step 1: Write failing test `frontend/test/candles.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { CandleSeries, TICKS_PER_CANDLE } from "../src/sim/candles";

describe("CandleSeries", () => {
  it("starts with one candle at the start price", () => {
    const s = new CandleSeries(100);
    expect(s.candles.length).toBe(1);
    expect(s.candles[0]).toMatchObject({ open: 100, high: 100, low: 100, close: 100 });
  });

  it("stretches high and low and moves close as prices push", () => {
    const s = new CandleSeries(100, 10);
    s.push(105);
    s.push(98);
    const c = s.candles[s.candles.length - 1];
    expect(c.high).toBe(105);
    expect(c.low).toBe(98);
    expect(c.close).toBe(98);
  });

  it("opens a new candle at the previous close after the tick count", () => {
    const s = new CandleSeries(100, 3);
    s.push(101);
    s.push(102);
    s.push(103); // third push finalizes candle 1, opens candle 2 at 103
    expect(s.candles.length).toBe(2);
    expect(s.candles[1]).toMatchObject({ open: 103, high: 103, low: 103, close: 103 });
  });

  it("uses a default ticks-per-candle constant", () => {
    expect(TICKS_PER_CANDLE).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- candles`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement `frontend/src/sim/candles.ts`**

```ts
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const TICKS_PER_CANDLE = 4;
const MAX_CANDLES = 80;

// Aggregates a stream of tick prices into OHLC candles.
export class CandleSeries {
  candles: Candle[];
  private ticks = 0;

  constructor(startPrice: number, private ticksPerCandle = TICKS_PER_CANDLE) {
    this.candles = [
      { time: 0, open: startPrice, high: startPrice, low: startPrice, close: startPrice },
    ];
  }

  push(price: number): void {
    const c = this.candles[this.candles.length - 1];
    c.close = price;
    if (price > c.high) c.high = price;
    if (price < c.low) c.low = price;
    this.ticks += 1;
    if (this.ticks >= this.ticksPerCandle) {
      this.ticks = 0;
      this.candles.push({ time: c.time + 1, open: price, high: price, low: price, close: price });
      if (this.candles.length > MAX_CANDLES) this.candles.shift();
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- candles`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/sim/candles.ts test/candles.test.ts
git commit -m "feat: add candle builder"
```

---

### Task 5: Market

**Files:**
- Create: `frontend/src/sim/market.ts`
- Test: `frontend/test/market.test.ts`

- [ ] **Step 1: Write failing test `frontend/test/market.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { Market, ROSTER } from "../src/sim/market";

describe("Market", () => {
  it("builds one state per roster stock", () => {
    const m = new Market(1, 2);
    expect(m.stocks.length).toBe(ROSTER.length);
    expect(m.get(ROSTER[0].ticker).ticker).toBe(ROSTER[0].ticker);
  });

  it("is deterministic for a seed", () => {
    const a = new Market(7, 3);
    const b = new Market(7, 3);
    a.tick();
    b.tick();
    expect(a.prices()).toEqual(b.prices());
  });

  it("advances prices and grows candle series on tick", () => {
    const m = new Market(2, 4);
    const before = m.get(ROSTER[0].ticker).series.candles.length;
    for (let i = 0; i < 20; i++) m.tick();
    const after = m.get(ROSTER[0].ticker).series.candles.length;
    expect(after).toBeGreaterThan(before);
  });

  it("reports percent change against the session open", () => {
    const m = new Market(3, 1);
    const t = ROSTER[0].ticker;
    const open = m.get(t).sessionOpen;
    m.get(t).price = open * 1.1;
    expect(m.changePct(t)).toBeCloseTo(0.1, 5);
  });

  it("changes volatility level", () => {
    const m = new Market(3, 1);
    m.setVolatility(4);
    expect(m.level).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- market`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement `frontend/src/sim/market.ts`**

```ts
import { mulberry32 } from "./rng";
import { nextPrice, VolLevel } from "./engine";
import { CandleSeries } from "./candles";

export interface StockDef {
  ticker: string;
  start: number;
  drift: number;
}

// Fictional tech-style tickers so nothing implies real companies or real data.
export const ROSTER: StockDef[] = [
  { ticker: "NOVA", start: 120, drift: 0.0008 },
  { ticker: "QBIT", start: 64, drift: -0.0006 },
  { ticker: "HELX", start: 210, drift: 0.0012 },
  { ticker: "ZNTH", start: 38, drift: -0.0010 },
  { ticker: "FLUX", start: 95, drift: 0.0003 },
  { ticker: "VOLT", start: 150, drift: 0.0015 },
];

export interface StockState {
  ticker: string;
  drift: number;
  price: number;
  sessionOpen: number;
  series: CandleSeries;
}

export class Market {
  level: VolLevel;
  stocks: StockState[];
  private rngs: (() => number)[];

  constructor(seed: number, level: VolLevel, roster: StockDef[] = ROSTER) {
    this.level = level;
    this.rngs = roster.map((_, i) => mulberry32(seed + i * 1013));
    this.stocks = roster.map((d) => ({
      ticker: d.ticker,
      drift: d.drift,
      price: d.start,
      sessionOpen: d.start,
      series: new CandleSeries(d.start),
    }));
  }

  tick(): void {
    this.stocks.forEach((s, i) => {
      s.price = nextPrice(s.price, this.level, this.rngs[i], s.drift);
      s.series.push(s.price);
    });
  }

  setVolatility(level: VolLevel): void {
    this.level = level;
  }

  get(ticker: string): StockState {
    const s = this.stocks.find((x) => x.ticker === ticker);
    if (!s) throw new Error(`unknown ticker ${ticker}`);
    return s;
  }

  changePct(ticker: string): number {
    const s = this.get(ticker);
    return s.price / s.sessionOpen - 1;
  }

  prices(): Record<string, number> {
    const out: Record<string, number> = {};
    this.stocks.forEach((s) => (out[s.ticker] = s.price));
    return out;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- market`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/sim/market.ts test/market.test.ts
git commit -m "feat: add market"
```

---

### Task 6: Portfolio

**Files:**
- Create: `frontend/src/game/portfolio.ts`
- Test: `frontend/test/portfolio.test.ts`

- [ ] **Step 1: Write failing test `frontend/test/portfolio.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { Portfolio } from "../src/game/portfolio";

describe("Portfolio", () => {
  it("buy reduces cash and sets weighted average cost", () => {
    const p = new Portfolio(1000);
    expect(p.buy("NOVA", 5, 100).ok).toBe(true); // spend 500
    expect(p.cash).toBe(500);
    expect(p.position("NOVA").shares).toBe(5);
    expect(p.position("NOVA").avgCost).toBe(100);
    p.buy("NOVA", 5, 200); // 5 more at 200, avg = (500+1000)/10 = 150
    expect(p.position("NOVA").avgCost).toBe(150);
  });

  it("rejects a buy that exceeds cash", () => {
    const p = new Portfolio(100);
    const r = p.buy("NOVA", 2, 100);
    expect(r.ok).toBe(false);
    expect(p.cash).toBe(100);
  });

  it("rejects non-positive quantities", () => {
    const p = new Portfolio(100);
    expect(p.buy("NOVA", 0, 10).ok).toBe(false);
    expect(p.sell("NOVA", -1, 10).ok).toBe(false);
  });

  it("sell adds cash and accumulates realized P&L", () => {
    const p = new Portfolio(1000);
    p.buy("NOVA", 10, 100); // avg 100, cash 0
    const r = p.sell("NOVA", 4, 130); // realized (130-100)*4 = 120
    expect(r.ok).toBe(true);
    expect(p.realized).toBe(120);
    expect(p.cash).toBe(520);
    expect(p.position("NOVA").shares).toBe(6);
  });

  it("rejects selling more than held", () => {
    const p = new Portfolio(1000);
    p.buy("NOVA", 2, 100);
    expect(p.sell("NOVA", 5, 100).ok).toBe(false);
  });

  it("net worth equals cash plus position values", () => {
    const p = new Portfolio(1000);
    p.buy("NOVA", 5, 100); // cash 500, 5 shares
    expect(p.netWorth({ NOVA: 120 })).toBe(500 + 5 * 120);
  });

  it("unrealized reflects price minus average cost", () => {
    const p = new Portfolio(1000);
    p.buy("NOVA", 5, 100);
    expect(p.unrealized("NOVA", 120)).toBe(100); // (120-100)*5
    expect(p.unrealizedPct("NOVA", 120)).toBeCloseTo(0.2, 5);
  });

  it("maxBuyable is the largest affordable whole share count", () => {
    expect(Portfolio.maxBuyable(1000, 130)).toBe(7);
    expect(Portfolio.maxBuyable(50, 130)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- portfolio`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement `frontend/src/game/portfolio.ts`**

```ts
export interface Position {
  shares: number;
  avgCost: number;
}

export type TradeResult = { ok: true } | { ok: false; reason: string };

export class Portfolio {
  cash: number;
  realized = 0;
  positions: Record<string, Position> = {};

  constructor(startingCash: number) {
    this.cash = startingCash;
  }

  position(ticker: string): Position {
    return this.positions[ticker] ?? { shares: 0, avgCost: 0 };
  }

  buy(ticker: string, qty: number, price: number): TradeResult {
    if (qty <= 0) return { ok: false, reason: "quantity must be positive" };
    const cost = qty * price;
    if (cost > this.cash) return { ok: false, reason: "not enough cash" };
    const pos = this.position(ticker);
    const newShares = pos.shares + qty;
    this.positions[ticker] = {
      shares: newShares,
      avgCost: (pos.shares * pos.avgCost + cost) / newShares,
    };
    this.cash -= cost;
    return { ok: true };
  }

  sell(ticker: string, qty: number, price: number): TradeResult {
    if (qty <= 0) return { ok: false, reason: "quantity must be positive" };
    const pos = this.position(ticker);
    if (qty > pos.shares) return { ok: false, reason: "not enough shares" };
    this.realized += (price - pos.avgCost) * qty;
    this.cash += qty * price;
    const remaining = pos.shares - qty;
    this.positions[ticker] = {
      shares: remaining,
      avgCost: remaining === 0 ? 0 : pos.avgCost,
    };
    return { ok: true };
  }

  positionValue(ticker: string, price: number): number {
    return this.position(ticker).shares * price;
  }

  unrealized(ticker: string, price: number): number {
    const pos = this.position(ticker);
    return (price - pos.avgCost) * pos.shares;
  }

  unrealizedPct(ticker: string, price: number): number {
    const pos = this.position(ticker);
    if (pos.shares === 0 || pos.avgCost === 0) return 0;
    return price / pos.avgCost - 1;
  }

  netWorth(prices: Record<string, number>): number {
    let total = this.cash;
    for (const [ticker, pos] of Object.entries(this.positions)) {
      total += pos.shares * (prices[ticker] ?? 0);
    }
    return total;
  }

  totalUnrealized(prices: Record<string, number>): number {
    let total = 0;
    for (const [ticker, pos] of Object.entries(this.positions)) {
      total += (prices[ticker] ?? 0 - pos.avgCost) * 0; // placeholder removed below
      total += (((prices[ticker] ?? 0)) - pos.avgCost) * pos.shares;
    }
    return total;
  }

  totalPnl(prices: Record<string, number>): number {
    return this.realized + this.totalUnrealized(prices);
  }

  static maxBuyable(cash: number, price: number): number {
    if (price <= 0) return 0;
    return Math.floor(cash / price);
  }
}
```

> Note for implementer: delete the placeholder line in `totalUnrealized` (the
> one ending `* 0;`). It is shown struck out here to flag a common copy error;
> the correct body is a single accumulation: `total += ((prices[ticker] ?? 0) - pos.avgCost) * pos.shares;`

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- portfolio`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add src/game/portfolio.ts test/portfolio.test.ts
git commit -m "feat: add portfolio"
```

---

### Task 7: Game mode and best score

**Files:**
- Create: `frontend/src/game/mode.ts`
- Test: `frontend/test/mode.test.ts`

- [ ] **Step 1: Write failing test `frontend/test/mode.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { TimedGame, loadBestScore, recordScore, STARTING_CASH } from "../src/game/mode";

describe("TimedGame", () => {
  it("ends after the configured number of ticks", () => {
    const g = new TimedGame(3);
    expect(g.over).toBe(false);
    g.tick(); g.tick();
    expect(g.over).toBe(false);
    g.tick();
    expect(g.over).toBe(true);
    expect(g.remainingTicks).toBe(0);
  });

  it("does not go negative once over", () => {
    const g = new TimedGame(1);
    g.tick(); g.tick(); g.tick();
    expect(g.remainingTicks).toBe(0);
    expect(g.over).toBe(true);
  });

  it("exposes a starting cash constant", () => {
    expect(STARTING_CASH).toBeGreaterThan(0);
  });
});

describe("best score", () => {
  beforeEach(() => localStorage.clear());

  it("records the max score and persists it", () => {
    expect(loadBestScore()).toBe(0);
    expect(recordScore(1500)).toBe(1500);
    expect(recordScore(900)).toBe(1500); // lower does not lower the best
    expect(loadBestScore()).toBe(1500);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- mode`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement `frontend/src/game/mode.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- mode`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/game/mode.ts test/mode.test.ts
git commit -m "feat: add game mode and best score"
```

---

### Task 8: Presentational components

**Files:**
- Create: `frontend/src/components/Hud.tsx`, `StockPicker.tsx`, `VolatilityBar.tsx`,
  `TradePanel.tsx`, `CandleChart.tsx`, `StartScreen.tsx`, `ResultScreen.tsx`
- Test: `frontend/test/TradePanel.test.tsx`, `frontend/test/VolatilityBar.test.tsx`

- [ ] **Step 1: Write failing tests**

`frontend/test/VolatilityBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import VolatilityBar from "../src/components/VolatilityBar";

describe("VolatilityBar", () => {
  it("renders levels 1 to 4 and labels only 4 as IPO", () => {
    render(<VolatilityBar level={1} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /IPO/ })).toBeInTheDocument();
  });

  it("reports the chosen level", () => {
    const onChange = vi.fn();
    render(<VolatilityBar level={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /IPO/ }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
```

`frontend/test/TradePanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TradePanel from "../src/components/TradePanel";

const base = {
  ticker: "NOVA",
  price: 120,
  shares: 5,
  avgCost: 100,
  unrealized: 100,
  unrealizedPct: 0.2,
  cash: 500,
  onBuy: () => {},
  onSell: () => {},
};

describe("TradePanel", () => {
  it("shows shares held and position P&L", () => {
    render(<TradePanel {...base} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/\+\$100/)).toBeInTheDocument();
  });

  it("buys the selected quantity at the current price", () => {
    const onBuy = vi.fn();
    render(<TradePanel {...base} onBuy={onBuy} />);
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "BUY" }));
    expect(onBuy).toHaveBeenCalledWith(10);
  });

  it("disables BUY when one share is unaffordable", () => {
    render(<TradePanel {...base} cash={10} price={120} />);
    expect(screen.getByRole("button", { name: "BUY" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- VolatilityBar TradePanel`
Expected: FAIL, cannot find components.

- [ ] **Step 3: Implement the components**

`frontend/src/components/VolatilityBar.tsx`:

```tsx
import type { VolLevel } from "../sim/engine";

interface Props {
  level: VolLevel;
  onChange: (level: VolLevel) => void;
}

const LEVELS: { value: VolLevel; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4 · 🚀 IPO" },
];

export default function VolatilityBar({ level, onChange }: Props) {
  return (
    <div className="volbar">
      <span className="label">VOLATILITY</span>
      <div className="vol-options">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            className={`vol-btn ${l.value === level ? "active" : ""}`}
            onClick={() => onChange(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

`frontend/src/components/TradePanel.tsx`:

```tsx
import { useState } from "react";
import { Portfolio } from "../game/portfolio";

interface Props {
  ticker: string;
  price: number;
  shares: number;
  avgCost: number;
  unrealized: number;
  unrealizedPct: number;
  cash: number;
  onBuy: (qty: number) => void;
  onSell: (qty: number) => void;
}

const PRESETS = [1, 10, 100] as const;

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

export default function TradePanel(p: Props) {
  const [qtyMode, setQtyMode] = useState<number | "MAX">(10);
  const maxQty = Portfolio.maxBuyable(p.cash, p.price);
  const qty = qtyMode === "MAX" ? maxQty : qtyMode;
  const tone = p.unrealized >= 0 ? "positive" : "negative";

  return (
    <div className="trade-panel">
      <div className="label">YOUR POSITION {p.ticker}</div>
      <div className="row"><span>Shares held</span><b>{p.shares}</b></div>
      <div className="row"><span>Avg cost</span><b>${p.avgCost.toFixed(2)}</b></div>
      <div className="row">
        <span>Position P&amp;L</span>
        <b className={tone}>{money(p.unrealized)} ({(p.unrealizedPct * 100).toFixed(1)}%)</b>
      </div>
      <div className="row"><span>Cash</span><b>${Math.round(p.cash).toLocaleString()}</b></div>

      <div className="label qty-label">QUANTITY</div>
      <div className="qty-row">
        {PRESETS.map((n) => (
          <button
            key={n}
            className={`qty-btn ${qtyMode === n ? "active" : ""}`}
            onClick={() => setQtyMode(n)}
          >
            {n}
          </button>
        ))}
        <button
          className={`qty-btn ${qtyMode === "MAX" ? "active" : ""}`}
          onClick={() => setQtyMode("MAX")}
        >
          MAX
        </button>
      </div>

      <div className="trade-buttons">
        <button className="buy" disabled={maxQty < 1} onClick={() => onBuyClick(p, qty)}>BUY</button>
        <button className="sell" disabled={p.shares < 1} onClick={() => onSellClick(p, qty)}>SELL</button>
      </div>
      <div className="order-est">order {qty} @ ${p.price.toFixed(2)}</div>
    </div>
  );
}

function onBuyClick(p: Props, qty: number) {
  if (qty > 0) p.onBuy(qty);
}
function onSellClick(p: Props, qty: number) {
  const q = Math.min(qty, p.shares);
  if (q > 0) p.onSell(q);
}
```

`frontend/src/components/Hud.tsx`:

```tsx
interface Props {
  mode: "sandbox" | "timed";
  remainingSeconds: number | null;
  netWorth: number;
  totalPnl: number;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Hud({ mode, remainingSeconds, netWorth, totalPnl }: Props) {
  const tone = totalPnl >= 0 ? "positive" : "negative";
  const sign = totalPnl >= 0 ? "+" : "-";
  return (
    <div className="hud">
      <span className="brand">⚡ TICKER RUNNER</span>
      <span className="pill">MODE: <b>{mode.toUpperCase()}</b></span>
      {mode === "timed" && remainingSeconds !== null && (
        <span className="pill">⏱ <b>{clock(remainingSeconds)}</b></span>
      )}
      <span className="hud-right">
        <span className="hud-stat">
          <span className="cap">NET WORTH</span>
          <b>${Math.round(netWorth).toLocaleString()}</b>
        </span>
        <span className="hud-stat">
          <span className="cap">TOTAL P&amp;L</span>
          <b className={tone}>{sign}${Math.abs(Math.round(totalPnl)).toLocaleString()}</b>
        </span>
      </span>
    </div>
  );
}
```

`frontend/src/components/StockPicker.tsx`:

```tsx
interface Item {
  ticker: string;
  changePct: number;
}

interface Props {
  items: Item[];
  selected: string;
  onSelect: (ticker: string) => void;
}

export default function StockPicker({ items, selected, onSelect }: Props) {
  return (
    <div className="picker">
      {items.map((it) => {
        const tone = it.changePct >= 0 ? "positive" : "negative";
        return (
          <button
            key={it.ticker}
            className={`pick ${it.ticker === selected ? "active" : ""}`}
            onClick={() => onSelect(it.ticker)}
          >
            <b>{it.ticker}</b>{" "}
            <span className={tone}>
              {it.changePct >= 0 ? "+" : ""}{(it.changePct * 100).toFixed(1)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

`frontend/src/components/CandleChart.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle } from "lightweight-charts";
import type { Candle } from "../sim/candles";

interface Props {
  candles: Candle[];
  avgCost: number | null;
}

export default function CandleChart({ candles, avgCost }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: "#0b0e14" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#161b27" }, horzLines: { color: "#161b27" } },
      leftPriceScale: { visible: true, borderColor: "#232838" },
      rightPriceScale: { visible: false },
      timeScale: { visible: false, borderColor: "#232838" },
      autoSize: true,
    });
    seriesRef.current = chart.addCandlestickSeries({
      upColor: "#26a69a", downColor: "#ef5350", borderVisible: false,
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
    });
    chartRef.current = chart;
    return () => chart.remove();
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(
      candles.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
  }, [candles]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (lineRef.current) { s.removePriceLine(lineRef.current); lineRef.current = null; }
    if (avgCost && avgCost > 0) {
      lineRef.current = s.createPriceLine({
        price: avgCost, color: "#2962ff", lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "avg cost",
      });
    }
  }, [avgCost, candles]);

  return <div className="chart" ref={ref} />;
}
```

`frontend/src/components/StartScreen.tsx`:

```tsx
import { useState } from "react";
import type { VolLevel } from "../sim/engine";
import type { Mode } from "../game/mode";

interface Props {
  bestScore: number;
  onStart: (mode: Mode, level: VolLevel) => void;
}

export default function StartScreen({ bestScore, onStart }: Props) {
  const [mode, setMode] = useState<Mode>("timed");
  const [level, setLevel] = useState<VolLevel>(2);
  const levels: VolLevel[] = [1, 2, 3, 4];

  return (
    <div className="screen">
      <h1 className="title">⚡ TICKER RUNNER</h1>
      <p className="sub">Buy low, sell high, beat the clock.</p>
      <div className="best">Best score: ${Math.round(bestScore).toLocaleString()}</div>

      <div className="choice">
        <div className="cap">MODE</div>
        <div className="choice-row">
          <button className={mode === "timed" ? "active" : ""} onClick={() => setMode("timed")}>Timed Challenge</button>
          <button className={mode === "sandbox" ? "active" : ""} onClick={() => setMode("sandbox")}>Endless Sandbox</button>
        </div>
      </div>

      <div className="choice">
        <div className="cap">STARTING VOLATILITY</div>
        <div className="choice-row">
          {levels.map((l) => (
            <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>
              {l === 4 ? "4 🚀" : l}
            </button>
          ))}
        </div>
      </div>

      <button className="start" onClick={() => onStart(mode, level)}>START</button>
    </div>
  );
}
```

`frontend/src/components/ResultScreen.tsx`:

```tsx
interface Props {
  netWorth: number;
  totalPnl: number;
  bestScore: number;
  onPlayAgain: () => void;
}

export default function ResultScreen({ netWorth, totalPnl, bestScore, onPlayAgain }: Props) {
  const tone = totalPnl >= 0 ? "positive" : "negative";
  const sign = totalPnl >= 0 ? "+" : "-";
  return (
    <div className="screen">
      <h1 className="title">TIME!</h1>
      <div className="final">${Math.round(netWorth).toLocaleString()}</div>
      <div className={`final-pnl ${tone}`}>
        {sign}${Math.abs(Math.round(totalPnl)).toLocaleString()}
      </div>
      <div className="best">Best score: ${Math.round(bestScore).toLocaleString()}</div>
      <button className="start" onClick={onPlayAgain}>PLAY AGAIN</button>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify component tests pass**

Run: `npm test -- VolatilityBar TradePanel`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add src/components test/VolatilityBar.test.tsx test/TradePanel.test.tsx
git commit -m "feat: add game components"
```

---

### Task 9: App wiring, theme, and smoke

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/theme.css` (replace existing contents)

- [ ] **Step 1: Replace `frontend/src/App.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { Market, ROSTER } from "./sim/market";
import type { VolLevel } from "./sim/engine";
import { Portfolio } from "./game/portfolio";
import { TimedGame, recordScore, loadBestScore, Mode, STARTING_CASH, TICK_MS, TIMED_TICKS } from "./game/mode";
import Hud from "./components/Hud";
import StockPicker from "./components/StockPicker";
import CandleChart from "./components/CandleChart";
import TradePanel from "./components/TradePanel";
import VolatilityBar from "./components/VolatilityBar";
import StartScreen from "./components/StartScreen";
import ResultScreen from "./components/ResultScreen";

type Screen = "start" | "playing" | "result";

interface Game {
  market: Market;
  portfolio: Portfolio;
  timed: TimedGame | null;
  mode: Mode;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [game, setGame] = useState<Game | null>(null);
  const [selected, setSelected] = useState<string>(ROSTER[0].ticker);
  const [, setFrame] = useState(0); // forces re-render each tick
  const [bestScore, setBestScore] = useState<number>(loadBestScore());
  const [msg, setMsg] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const start = (mode: Mode, level: VolLevel) => {
    const seed = Date.now() % 1000000;
    setGame({
      market: new Market(seed, level),
      portfolio: new Portfolio(STARTING_CASH),
      timed: mode === "timed" ? new TimedGame(TIMED_TICKS) : null,
      mode,
    });
    setSelected(ROSTER[0].ticker);
    setScreen("playing");
  };

  useEffect(() => {
    if (screen !== "playing" || !game) return;
    intervalRef.current = setInterval(() => {
      game.market.tick();
      if (game.timed) {
        game.timed.tick();
        if (game.timed.over) {
          clearInterval(intervalRef.current);
          const nw = game.portfolio.netWorth(game.market.prices());
          setBestScore(recordScore(nw));
          setScreen("result");
          return;
        }
      }
      setFrame((f) => f + 1);
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [screen, game]);

  if (screen === "start" || !game) {
    return <StartScreen bestScore={bestScore} onStart={start} />;
  }

  const prices = game.market.prices();
  const stock = game.market.get(selected);
  const pos = game.portfolio.position(selected);

  if (screen === "result") {
    return (
      <ResultScreen
        netWorth={game.portfolio.netWorth(prices)}
        totalPnl={game.portfolio.totalPnl(prices)}
        bestScore={bestScore}
        onPlayAgain={() => setScreen("start")}
      />
    );
  }

  const flash = (r: { ok: boolean; reason?: string }) => {
    if (!r.ok && r.reason) { setMsg(r.reason); setTimeout(() => setMsg(""), 1500); }
  };

  return (
    <div className="terminal">
      <Hud
        mode={game.mode}
        remainingSeconds={game.timed ? Math.ceil((game.timed.remainingTicks * TICK_MS) / 1000) : null}
        netWorth={game.portfolio.netWorth(prices)}
        totalPnl={game.portfolio.totalPnl(prices)}
      />
      <StockPicker
        items={game.market.stocks.map((s) => ({ ticker: s.ticker, changePct: game.market.changePct(s.ticker) }))}
        selected={selected}
        onSelect={setSelected}
      />
      {msg && <div className="error-banner">{msg}</div>}
      <div className="body">
        <CandleChart candles={stock.series.candles} avgCost={pos.shares > 0 ? pos.avgCost : null} />
        <TradePanel
          ticker={selected}
          price={stock.price}
          shares={pos.shares}
          avgCost={pos.avgCost}
          unrealized={game.portfolio.unrealized(selected, stock.price)}
          unrealizedPct={game.portfolio.unrealizedPct(selected, stock.price)}
          cash={game.portfolio.cash}
          onBuy={(qty) => flash(game.portfolio.buy(selected, qty, stock.price))}
          onSell={(qty) => flash(game.portfolio.sell(selected, qty, stock.price))}
        />
      </div>
      <VolatilityBar level={game.market.level} onChange={(l) => game.market.setVolatility(l)} />
    </div>
  );
}
```

- [ ] **Step 2: Replace `frontend/src/theme.css`**

```css
:root {
  --bg: #0b0e14; --panel: #10151f; --line: #232838; --muted: #6b7280;
  --text: #d1d4dc; --pos: #26a69a; --neg: #ef5350; --accent: #2962ff; --gold: #facc15;
  font-family: Inter, system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-size: 13px; }
.positive { color: var(--pos); } .negative { color: var(--neg); }
.label, .cap { color: var(--muted); font-size: 10px; letter-spacing: .07em; }
.terminal { display: flex; flex-direction: column; height: 100vh; }

.hud { display: flex; align-items: center; gap: 16px; padding: 10px 14px;
  background: linear-gradient(90deg,#10151f,#161c2b); border-bottom: 1px solid var(--line); }
.brand { font-weight: 800; letter-spacing: .06em; color: var(--gold); }
.pill { background: #1e2536; padding: 3px 9px; border-radius: 4px; }
.hud-right { margin-left: auto; display: flex; gap: 20px; }
.hud-stat { text-align: right; } .hud-stat b { font-size: 18px; }
.hud-stat .cap { display: block; }

.picker { display: flex; gap: 6px; padding: 8px 14px; background: #0e131d;
  border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.pick { background: #141a26; color: var(--text); border: 1px solid transparent;
  border-radius: 5px; padding: 5px 10px; cursor: pointer; }
.pick.active { background: #1b2433; border-color: var(--accent); }

.body { display: flex; flex: 1; min-height: 0; }
.chart { flex: 1; min-width: 0; }
.trade-panel { width: 210px; background: var(--panel); border-left: 1px solid var(--line); padding: 12px; }
.trade-panel .row { display: flex; justify-content: space-between; margin-top: 6px; }
.trade-panel .row span { color: var(--muted); }
.qty-label { display: block; margin-top: 14px; }
.qty-row { display: flex; gap: 5px; margin-top: 6px; }
.qty-btn { flex: 1; background: #1b2433; color: var(--text); border: none; border-radius: 4px;
  padding: 6px 0; cursor: pointer; }
.qty-btn.active { background: var(--accent); color: #fff; }
.trade-buttons { display: flex; gap: 8px; margin-top: 12px; }
.trade-buttons button { flex: 1; border: none; border-radius: 6px; padding: 12px; font-weight: 800;
  font-size: 15px; cursor: pointer; }
.trade-buttons .buy { background: var(--pos); color: #062; }
.trade-buttons .sell { background: var(--neg); color: #400; }
.trade-buttons button:disabled { opacity: .4; cursor: not-allowed; }
.order-est { text-align: center; color: var(--muted); font-size: 10px; margin-top: 8px; }

.volbar { display: flex; align-items: center; gap: 12px; padding: 10px 14px;
  background: #0e131d; border-top: 1px solid var(--line); }
.vol-options { display: flex; gap: 6px; }
.vol-btn { background: #141a26; color: var(--text); border: 1px solid transparent; border-radius: 5px;
  padding: 6px 16px; font-weight: 700; cursor: pointer; }
.vol-btn.active { background: #3a2a10; border-color: var(--gold); color: var(--gold); }

.error-banner { background: #5e1b1b; color: #fff; padding: 6px 14px; text-align: center; }

.screen { height: 100vh; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 14px; }
.title { color: var(--gold); letter-spacing: .08em; margin: 0; }
.sub { color: var(--muted); margin: 0; }
.best { color: var(--text); }
.final { font-size: 48px; font-weight: 800; color: #fff; }
.final-pnl { font-size: 22px; font-weight: 800; }
.choice { text-align: center; } .choice .cap { display: block; margin-bottom: 6px; }
.choice-row { display: flex; gap: 8px; }
.choice-row button, .start { background: #1b2433; color: var(--text); border: 1px solid var(--line);
  border-radius: 6px; padding: 10px 16px; cursor: pointer; }
.choice-row button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.start { background: var(--gold); color: #1a1400; font-weight: 800; padding: 12px 40px; margin-top: 8px; }
```

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm test`
Expected: all tests pass (rng, engine, candles, market, portfolio, mode, VolatilityBar, TradePanel).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`, open the Vite URL. Verify:
- Start screen: pick Timed + volatility, click START.
- Candles tick and scroll; picking a different stock switches the chart.
- BUY/SELL change shares, cash, position P&L, and net worth; BUY disables when broke.
- Volatility 4 visibly produces much larger swings than 1.
- Timed mode ends, shows result with net worth and best score; PLAY AGAIN returns to start.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/theme.css
git commit -m "feat: wire up Ticker Runner game and theme"
```

---

## Self-Review Notes

- **Spec coverage:** simulated market + volatility 1-4 (Tasks 3, 5); live candles
  (Tasks 4, 8 CandleChart); roster + focus one stock (Task 5, StockPicker, App);
  buy/sell + shares + gain/loss + net worth (Tasks 6, 8 TradePanel, Hud);
  sandbox + timed modes + best score (Tasks 7, 9, Start/Result screens);
  error handling for bad trades and storage (Tasks 6, 7, App `flash`/`msg`);
  retire backend, reuse shell (Task 1). All spec sections covered.
- **Type consistency:** `VolLevel` (engine) used by Market, VolatilityBar,
  StartScreen, App; `Candle` (candles) used by CandleSeries, Market, CandleChart;
  `Portfolio` method names (`buy`, `sell`, `position`, `netWorth`, `unrealized`,
  `unrealizedPct`, `totalPnl`, static `maxBuyable`) match across tests, TradePanel,
  and App; `Mode`, `TimedGame`, `STARTING_CASH`, `TICK_MS`, `TIMED_TICKS`,
  `recordScore`, `loadBestScore` from mode used consistently in App.
- **Placeholder note:** the one intentional struck-out line in `Portfolio.totalUnrealized`
  is called out in a note for the implementer to delete; final body is a single
  accumulation. No other placeholders.
