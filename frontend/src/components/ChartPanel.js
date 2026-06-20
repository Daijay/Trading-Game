import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { createChart, LineStyle } from "lightweight-charts";
export default function ChartPanel({ prices, result }) {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const priceRef = useRef(null);
    const maRef = useRef(null);
    // Create chart once.
    useEffect(() => {
        if (!containerRef.current)
            return;
        const chart = createChart(containerRef.current, {
            layout: { background: { color: "#0e1015" }, textColor: "#6b7280" },
            grid: { vertLines: { color: "#1a1e2a" }, horzLines: { color: "#1a1e2a" } },
            rightPriceScale: { borderColor: "#232838" },
            timeScale: { borderColor: "#232838" },
            autoSize: true,
        });
        priceRef.current = chart.addAreaSeries({
            lineColor: "#2962ff", topColor: "rgba(41,98,255,0.28)", bottomColor: "rgba(41,98,255,0)", lineWidth: 2,
        });
        maRef.current = chart.addLineSeries({ color: "#f0b90b", lineWidth: 1 });
        chartRef.current = chart;
        return () => chart.remove();
    }, []);
    // Update price + MA data.
    useEffect(() => {
        priceRef.current?.setData(prices.map((p) => ({ time: p.date, value: p.close })));
        maRef.current?.setData(prices.filter((p) => p.ma50 !== null).map((p) => ({ time: p.date, value: p.ma50 })));
    }, [prices]);
    // Draw fair-value band as price lines whenever the valuation changes.
    useEffect(() => {
        const series = priceRef.current;
        if (!series || !result)
            return;
        const lines = [
            { price: result.blended_high, color: "#26a69a", title: "FV high" },
            { price: result.blended_base, color: "#b2b5be", title: "FV base", dashed: true },
            { price: result.blended_low, color: "#ef5350", title: "FV low" },
        ];
        const handles = lines.map((l) => series.createPriceLine({
            price: l.price, color: l.color, lineWidth: 1,
            lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
            axisLabelVisible: true, title: l.title,
        }));
        return () => handles.forEach((h) => series.removePriceLine(h));
    }, [result]);
    return _jsx("div", { className: "chart", ref: containerRef });
}
