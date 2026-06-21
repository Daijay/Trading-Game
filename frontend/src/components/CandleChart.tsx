import { useEffect, useRef } from "react";
import { createChart, LineStyle } from "lightweight-charts";
import type { IChartApi, ISeriesApi, IPriceLine, UTCTimestamp } from "lightweight-charts";
import type { Candle } from "../sim/candles";

interface Props {
  candles: Candle[];
  avgCost: number | null;
}

// Map logical candle indices onto real timestamps so the time scale stays valid.
const BASE_TIME = 1_700_000_000;
// Initial zoom: show this many bar slots so the first candle sits on the left
// with room to grow rightward (not zoomed in on one giant candle).
const VISIBLE_BARS = 50;

export default function CandleChart({ candles, avgCost }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<IPriceLine | null>(null);
  const prevCandles = useRef<Candle[] | null>(null);
  const prevLen = useRef(0);

  // Create the chart once.
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: "#0b0e14" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#161b27" }, horzLines: { color: "#161b27" } },
      leftPriceScale: { visible: true, borderColor: "#232838" },
      rightPriceScale: { visible: false },
      timeScale: { visible: false, borderColor: "#232838", barSpacing: 7, rightOffset: 6 },
      autoSize: true,
    });
    // Put the series on the LEFT scale so candles share the visible axis.
    seriesRef.current = chart.addCandlestickSeries({
      priceScaleId: "left",
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    chartRef.current = chart;
    return () => chart.remove();
  }, []);

  // Sync candle data on every render. The candles array is mutated in place each
  // tick (stable reference), so we cannot gate this on a [candles] dep. We use
  // setData only when the array identity changes (a different stock); for live
  // ticks we use update(), which preserves the user's zoom and pan.
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    const toBar = (c: Candle) => ({
      time: (BASE_TIME + c.time) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    });

    if (prevCandles.current !== candles) {
      s.setData(candles.map(toBar));
      prevCandles.current = candles;
      prevLen.current = candles.length;
      // Anchor the initial view: first candle on the left, room to the right.
      // Set only here (not on ticks) so manual zoom/pan is never reset.
      const chart = chartRef.current;
      if (chart) {
        const from = Math.max(0, candles.length - VISIBLE_BARS);
        chart.timeScale().setVisibleLogicalRange({ from, to: from + VISIBLE_BARS });
      }
      return;
    }
    if (candles.length === 0) return;
    // A new candle opened since last render: flush the just-finalized bar first.
    if (candles.length > prevLen.current) {
      s.update(toBar(candles[candles.length - 2]));
    }
    s.update(toBar(candles[candles.length - 1]));
    prevLen.current = candles.length;
  });

  // Average-cost reference line, refreshed when the position entry changes.
  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (lineRef.current) {
      s.removePriceLine(lineRef.current);
      lineRef.current = null;
    }
    if (avgCost && avgCost > 0) {
      lineRef.current = s.createPriceLine({
        price: avgCost,
        color: "#2962ff",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "avg cost",
      });
    }
  }, [avgCost]);

  return <div className="chart" ref={ref} />;
}
