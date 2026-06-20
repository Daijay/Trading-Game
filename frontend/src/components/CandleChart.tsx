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

export default function CandleChart({ candles, avgCost }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<IPriceLine | null>(null);

  // Create the chart once.
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: "#0b0e14" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#161b27" }, horzLines: { color: "#161b27" } },
      leftPriceScale: { visible: true, borderColor: "#232838" },
      rightPriceScale: { visible: false },
      timeScale: { visible: false, borderColor: "#232838" },
      autoSize: true,
    });
    // Put the series on the LEFT scale so the candles share the visible axis.
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
  // tick, so its reference is stable; gating this on a [candles] dep would make
  // the effect run only once and the chart would never update.
  useEffect(() => {
    const s = seriesRef.current;
    const chart = chartRef.current;
    if (!s || !chart) return;
    s.setData(
      candles.map((c) => ({
        time: (BASE_TIME + c.time) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    chart.timeScale().fitContent();
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
