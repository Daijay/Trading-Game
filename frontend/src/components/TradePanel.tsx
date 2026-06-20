import { useState } from "react";
import { Portfolio } from "../game/portfolio";

interface Props {
  ticker: string;
  price: number;
  shares: number;
  avgCost: number;
  unrealized: number;
  unrealizedPct: number;
  cash: number;
  onBuy: (qty: number) => void;
  onSell: (qty: number) => void;
}

const PRESETS = [1, 10, 100] as const;

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

export default function TradePanel(p: Props) {
  const [qtyMode, setQtyMode] = useState<number | "MAX">(10);
  const maxQty = Portfolio.maxBuyable(p.cash, p.price);
  const qty = qtyMode === "MAX" ? maxQty : qtyMode;
  const tone = p.unrealized >= 0 ? "positive" : "negative";

  const buy = () => { if (qty > 0) p.onBuy(qty); };
  const sell = () => { if (qty > 0) p.onSell(qty); };
  const isShort = p.shares < 0;

  return (
    <div className="trade-panel">
      <div className="label">
        YOUR POSITION {p.ticker}{isShort ? <span className="short-tag">SHORT</span> : null}
      </div>
      <div className="row"><span>Shares held</span><b>{p.shares}</b></div>
      <div className="row"><span>Avg cost</span><b>${p.avgCost.toFixed(2)}</b></div>
      <div className="row">
        <span>Position P&amp;L</span>
        <b className={tone}>{money(p.unrealized)} ({(p.unrealizedPct * 100).toFixed(1)}%)</b>
      </div>
      <div className="row"><span>Cash</span><b>${Math.round(p.cash).toLocaleString()}</b></div>

      <div className="label qty-label">QUANTITY</div>
      <div className="qty-row">
        {PRESETS.map((n) => (
          <button
            key={n}
            className={`qty-btn ${qtyMode === n ? "active" : ""}`}
            onClick={() => setQtyMode(n)}
          >
            {n}
          </button>
        ))}
        <button
          className={`qty-btn ${qtyMode === "MAX" ? "active" : ""}`}
          onClick={() => setQtyMode("MAX")}
        >
          MAX
        </button>
      </div>

      <div className="trade-buttons">
        <button className="buy" disabled={maxQty < 1 && !isShort} onClick={buy}>
          {isShort ? "BUY / COVER" : "BUY"}
        </button>
        <button className="sell" onClick={sell}>
          {p.shares > 0 ? "SELL" : "SELL / SHORT"}
        </button>
      </div>
      <div className="order-est">order {qty} @ ${p.price.toFixed(2)}</div>
    </div>
  );
}
