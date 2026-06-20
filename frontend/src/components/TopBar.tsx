import type { Quote, ValuationResult } from "../types";

interface Props {
  quote: Quote | null;
  result: ValuationResult | null;
}

export default function TopBar({ quote, result }: Props) {
  const tone =
    result === null ? "neutral"
    : result.upside_pct > 0.05 ? "positive"
    : result.upside_pct < -0.05 ? "negative" : "neutral";

  return (
    <div className="topbar">
      <strong className="symbol">{quote?.ticker ?? "—"}</strong>
      <span className="muted">{quote?.name} · {quote?.exchange}</span>
      <span className="price">{quote ? `$${quote.price.toFixed(2)}` : ""}</span>
      <span className="spacer" />
      {result && (
        <span className={`verdict-badge ${tone}`}>
          ${Math.round(result.blended_base)} · {result.upside_pct >= 0 ? "+" : ""}
          {(result.upside_pct * 100).toFixed(1)}% {result.verdict.toUpperCase()}
        </span>
      )}
    </div>
  );
}
