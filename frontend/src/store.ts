import { useCallback, useEffect, useState } from "react";
import * as api from "./api";
import type { Assumptions, PricePoint, Quote, TickerSummary, ValuationResult } from "./types";

export function useTerminal() {
  const [tickers, setTickers] = useState<TickerSummary[]>([]);
  const [selected, setSelected] = useState<string>("NVDA");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getTickers().then(setTickers).catch((e) => setError(e.message)); }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([api.getQuote(selected), api.getPrices(selected), api.getValuation(selected)])
      .then(([q, p, r]) => { if (!cancelled) { setQuote(q); setPrices(p); setResult(r); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [selected]);

  const updateAssumptions = useCallback((a: Assumptions) => {
    setResult((prev) => (prev ? { ...prev, assumptions: a } : prev)); // optimistic
    api.postValuation(selected, a).then(setResult).catch((e) => setError(e.message));
  }, [selected]);

  const addTicker = useCallback((t: string) => {
    setTickers((prev) => prev.some((x) => x.ticker === t) ? prev : [...prev, { ticker: t, upside_pct: 0, verdict: "" }]);
    setSelected(t);
  }, []);

  return { tickers, selected, setSelected, quote, prices, result, error, updateAssumptions, addTicker };
}
