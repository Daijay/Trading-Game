import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock lightweight-charts so the chart does not need a real canvas in jsdom.
vi.mock("lightweight-charts", () => ({
  LineStyle: { Dashed: 1, Solid: 0 },
  createChart: () => ({
    addCandlestickSeries: () => ({
      setData: () => {},
      update: () => {},
      createPriceLine: () => ({}),
      removePriceLine: () => {},
    }),
    timeScale: () => ({ fitContent: () => {} }),
    remove: () => {},
  }),
}));

import App from "../src/App";

describe("App", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the playing screen after pressing START without crashing", () => {
    render(<App />);
    // start screen is up
    const startBtn = screen.getByRole("button", { name: "START" });
    fireEvent.click(startBtn);
    // playing screen: HUD brand and a BUY button must be present (no crash)
    expect(screen.getByText(/TICKER RUNNER/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /BUY/ })).toBeInTheDocument();
  });
});
