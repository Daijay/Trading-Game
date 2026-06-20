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
