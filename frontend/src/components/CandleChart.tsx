import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, LineStyle, IPriceLine } from "lightweight-charts";
import type { Candle } from "../sim/candles";

interface Props {
  candles: Candle[];
  avgCost: number | null;
}

export default function CandleChart({ candles, avgCost }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineRef = useRef<IPriceLine | null>(null);

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
    seriesRef.current = chart.addCandlestickSeries({
      upColor: "#26a69a", downColor: "#ef5350", borderVisible: false,
      wickUpColor: "#26a69a", wickDownColor: "#ef5350",
    });
    chartRef.current = chart;
    return () => chart.remove();
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(
      candles.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })),
    );
  }, [candles]);

  useEffect(() => {
    const s = seriesRef.current;
    if (!s) return;
    if (lineRef.current) { s.removePriceLine(lineRef.current); lineRef.current = null; }
    if (avgCost && avgCost > 0) {
      lineRef.current = s.createPriceLine({
        price: avgCost, color: "#2962ff", lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "avg cost",
      });
    }
  }, [avgCost, candles]);

  return <div className="chart" ref={ref} />;
}
