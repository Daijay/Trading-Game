import { describe, it, expect } from "vitest";
import { Portfolio } from "../src/game/portfolio";

describe("Portfolio", () => {
  it("buy reduces cash and sets weighted average cost", () => {
    const p = new Portfolio(2000);
    expect(p.buy("NOVA", 5, 100).ok).toBe(true); // spend 500, cash 1500
    expect(p.cash).toBe(1500);
    expect(p.position("NOVA").shares).toBe(5);
    expect(p.position("NOVA").avgCost).toBe(100);
    p.buy("NOVA", 5, 200); // 5 more at 200 (spend 1000), avg = (500+1000)/10 = 150
    expect(p.position("NOVA").avgCost).toBe(150);
    expect(p.cash).toBe(500);
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
