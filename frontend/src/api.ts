import type {
  Assumptions, PricePoint, Quote, TickerSummary, ValuationResult,
} from "./types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `request failed: ${res.status}`);
  }
  return res.json();
}

export const getTickers = () => get<TickerSummary[]>("/api/tickers");
export const getQuote = (t: string) => get<Quote>(`/api/quote/${t}`);
export const getPrices = (t: string, range = "1y") =>
  get<PricePoint[]>(`/api/prices/${t}?range=${range}`);
export const getValuation = (t: string) => get<ValuationResult>(`/api/valuation/${t}`);

export async function postValuation(t: string, a: Assumptions): Promise<ValuationResult> {
  const res = await fetch(`/api/valuation/${t}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(a),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `request failed: ${res.status}`);
  }
  return res.json();
}
