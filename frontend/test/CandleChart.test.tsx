import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { Candle } from "../src/sim/candles";

const h = vi.hoisted(() => ({
  setData: vi.fn(),
  fitContent: vi.fn(),
  createPriceLine: vi.fn(() => ({})),
  removePriceLine: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  LineStyle: { Dashed: 1, Solid: 0 },
  createChart: () => ({
    addCandlestickSeries: () => ({
      setData: h.setData,
      createPriceLine: h.createPriceLine,
      removePriceLine: h.removePriceLine,
    }),
    timeScale: () => ({ fitContent: h.fitContent }),
    remove: () => {},
  }),
}));

import CandleChart from "../src/components/CandleChart";

describe("CandleChart", () => {
  it("re-sends candle data when the in-place mutated array grows", () => {
    const candles: Candle[] = [{ time: 0, open: 100, high: 100, low: 100, close: 100 }];
    const { rerender } = render(<CandleChart candles={candles} avgCost={null} />);
    expect(h.setData).toHaveBeenCalled();
    const lastData = () => h.setData.mock.calls[h.setData.mock.calls.length - 1][0];
    expect(lastData().length).toBe(1);

    // simulate a live tick: SAME array reference, one more candle
    candles.push({ time: 1, open: 100, high: 102, low: 99, close: 101 });
    rerender(<CandleChart candles={candles} avgCost={null} />);

    expect(lastData().length).toBe(2);
    expect(h.fitContent).toHaveBeenCalled();
  });
});
