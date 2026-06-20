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

  it("never returns a price below the floor", () => {
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
