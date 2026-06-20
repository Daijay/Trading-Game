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
