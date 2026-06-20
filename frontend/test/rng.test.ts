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
