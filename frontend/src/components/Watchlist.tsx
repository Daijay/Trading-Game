import { useState } from "react";
import type { TickerSummary } from "../types";

interface Props {
  items: TickerSummary[];
  selected: string;
  onSelect: (ticker: string) => void;
  onAdd: (ticker: string) => void;
}

function tone(upside: number): string {
  return upside > 0.05 ? "positive" : upside < -0.05 ? "negative" : "neutral";
}

export default function Watchlist({ items, selected, onSelect, onAdd }: Props) {
  const [draft, setDraft] = useState("");
  return (
    <div className="watchlist">
      <div className="panel-title">WATCHLIST · VALUATION</div>
      {items.map((it) => (
        <div
          key={it.ticker}
          className={`wl-row ${tone(it.upside_pct)} ${it.ticker === selected ? "active" : ""}`}
          onClick={() => onSelect(it.ticker)}
        >
          <span>{it.ticker}</span>
          <span className="wl-pct">
            {it.upside_pct >= 0 ? "+" : ""}{Math.round(it.upside_pct * 100)}%
          </span>
        </div>
      ))}
      <form
        className="wl-add"
        onSubmit={(e) => { e.preventDefault(); if (draft) { onAdd(draft.toUpperCase()); setDraft(""); } }}
      >
        <input value={draft} placeholder="+ add ticker" onChange={(e) => setDraft(e.target.value)} />
      </form>
    </div>
  );
}
