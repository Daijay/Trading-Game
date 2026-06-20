import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { Candle } from "../src/sim/candles";

const h = vi.hoisted(() => ({
  setData: vi.fn(),
  update: vi.fn(),
  createPriceLine: vi.fn(() => ({})),
  removePriceLine: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  LineStyle: { Dashed: 1, Solid: 0 },
  createChart: () => ({
    addCandlestickSeries: () => ({
      setData: h.setData,
      update: h.update,
      createPriceLine: h.createPriceLine,
      removePriceLine: h.removePriceLine,
    }),
    remove: () => {},
  }),
}));

import CandleChart from "../src/components/CandleChart";

function candle(time: number, close: number): Candle {
  return { time, open: close, high: close, low: close, close };
}

describe("CandleChart", () => {
  it("uses update() for live ticks (preserving zoom) and setData() only on stock switch", () => {
    const a: Candle[] = [candle(0, 100)];
    const { rerender } = render(<CandleChart candles={a} avgCost={null} />);
    expect(h.setData).toHaveBeenCalledTimes(1);

    // live tick: SAME array reference, one more candle -> update(), not setData()
    a.push(candle(1, 101));
    rerender(<CandleChart candles={a} avgCost={null} />);
    expect(h.setData).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalled();
    const lastUpdate = h.update.mock.calls[h.update.mock.calls.length - 1][0];
    expect(lastUpdate.close).toBe(101);

    // stock switch: NEW array reference -> full setData()
    const b: Candle[] = [candle(0, 50), candle(1, 51)];
    rerender(<CandleChart candles={b} avgCost={null} />);
    expect(h.setData).toHaveBeenCalledTimes(2);
  });
});
