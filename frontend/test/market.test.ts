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

  it("never generates news at level 1", () => {
    const m = new Market(4, 1);
    for (let i = 0; i < 300; i++) expect(m.generateNews()).toBeNull();
  });

  it("applies a news shock to the named stock's price", () => {
    const m = new Market(4, 4);
    let evt = null;
    for (let i = 0; i < 500 && !evt; i++) {
      const before = { ...m.prices() };
      evt = m.generateNews();
      if (evt) {
        const expected = before[evt.ticker] * (1 + evt.shockPct);
        expect(m.get(evt.ticker).price).toBeCloseTo(Math.max(1, expected), 4);
      }
    }
    expect(evt).not.toBeNull();
  });
});
