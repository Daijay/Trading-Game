export interface Assumptions {
  revenue_growth: number;
  fcf_margin: number;
  wacc: number;
  terminal_growth: number;
  projection_years: number;
}

export interface MethodEstimate {
  method: string;
  value_per_share: number | null;
  note: string;
}

export interface ValuationResult {
  ticker: string;
  price: number;
  estimates: MethodEstimate[];
  blended_base: number;
  blended_low: number;
  blended_high: number;
  implied_growth: number | null;
  upside_pct: number;
  verdict: string;
  assumptions: Assumptions;
}

export interface PricePoint {
  date: string;
  close: number;
  ma50: number | null;
}

export interface Quote {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
}

export interface TickerSummary {
  ticker: string;
  upside_pct: number;
  verdict: string;
}
