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
