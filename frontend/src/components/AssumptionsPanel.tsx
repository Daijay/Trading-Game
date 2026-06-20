import type { Assumptions } from "../types";

interface Props {
  assumptions: Assumptions;
  onChange: (a: Assumptions) => void;
}

const ROWS: { key: keyof Assumptions; label: string; min: number; max: number; step: number; pct: boolean }[] = [
  { key: "revenue_growth", label: "Rev growth (5y)", min: -0.1, max: 0.6, step: 0.01, pct: true },
  { key: "fcf_margin", label: "FCF margin", min: 0.0, max: 0.6, step: 0.01, pct: true },
  { key: "wacc", label: "WACC", min: 0.05, max: 0.18, step: 0.005, pct: true },
  { key: "terminal_growth", label: "Terminal growth", min: 0.0, max: 0.05, step: 0.005, pct: true },
];

export default function AssumptionsPanel({ assumptions, onChange }: Props) {
  return (
    <div className="assumptions">
      <div className="panel-title">DCF ASSUMPTIONS</div>
      {ROWS.map((r) => {
        const value = assumptions[r.key] as number;
        return (
          <div className="slider-row" key={r.key}>
            <label htmlFor={r.key}>
              {r.label}
              <span className="slider-value">{r.pct ? `${(value * 100).toFixed(1)}%` : value}</span>
            </label>
            <input
              id={r.key}
              aria-label={r.label}
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={value}
              onChange={(e) => onChange({ ...assumptions, [r.key]: Number(e.target.value) })}
            />
          </div>
        );
      })}
      <div className="panel-foot">↻ band &amp; verdict recompute live</div>
    </div>
  );
}
