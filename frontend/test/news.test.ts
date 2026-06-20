import { describe, it, expect } from "vitest";
import { mulberry32 } from "../src/sim/rng";
import { pickNews, NEWS_PROB } from "../src/game/news";

const TICKERS = ["NOVA", "QBIT", "HELX"];

describe("pickNews", () => {
  it("never fires at level 1", () => {
    expect(NEWS_PROB[1]).toBe(0);
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) expect(pickNews(rng, TICKERS, 1)).toBeNull();
  });

  it("is deterministic for a seed", () => {
    const a = pickNews(mulberry32(5), TICKERS, 4);
    const b = pickNews(mulberry32(5), TICKERS, 4);
    expect(a).toEqual(b);
  });

  it("produces an event whose headline names a roster ticker", () => {
    const rng = mulberry32(3);
    let evt = null;
    for (let i = 0; i < 500 && !evt; i++) evt = pickNews(rng, TICKERS, 4);
    expect(evt).not.toBeNull();
    expect(TICKERS).toContain(evt!.ticker);
    expect(evt!.headline).toContain(evt!.ticker);
    expect(Math.abs(evt!.shockPct)).toBeGreaterThan(0);
  });
});
