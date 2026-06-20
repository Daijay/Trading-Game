import type { ValuationResult } from "../types";

const LABELS: Record<string, string> = {
  dcf: "DCF", ev_sales: "EV/Sales", ev_ebitda: "EV/EBITDA", pe: "P/E", peg: "PEG",
};

function fmt(v: number | null): string {
  return v === null ? "—" : `$${Math.round(v)}`;
}

export default function BreakdownBar({ result }: { result: ValuationResult }) {
  return (
    <div className="breakdown">
      {result.estimates.map((e) => (
        <div className="cell" key={e.method}>
          <div className="cell-label">{LABELS[e.method] ?? e.method}</div>
          <div className="cell-value">{fmt(e.value_per_share)}</div>
        </div>
      ))}
      <div className="cell">
        <div className="cell-label">Reverse DCF</div>
        <div className="cell-value implied">
          {result.implied_growth === null ? "—" : `${Math.round(result.implied_growth * 100)}% implied`}
        </div>
      </div>
      <div className="cell blended">
        <div className="cell-label">Blended Fair Value</div>
        <div className="cell-value">
          ${Math.round(result.blended_base)}{" "}
          <span className="range">
            ({Math.round(result.blended_low)}–{Math.round(result.blended_high)})
          </span>
        </div>
      </div>
    </div>
  );
}
