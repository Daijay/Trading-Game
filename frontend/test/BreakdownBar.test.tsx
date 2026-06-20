import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BreakdownBar from "../src/components/BreakdownBar";
import type { ValuationResult } from "../src/types";

const result: ValuationResult = {
  ticker: "NVDA", price: 100, blended_base: 142, blended_low: 128, blended_high: 158,
  implied_growth: 0.22, upside_pct: 0.42, verdict: "Undervalued",
  assumptions: { revenue_growth: 0.18, fcf_margin: 0.3, wacc: 0.09, terminal_growth: 0.03, projection_years: 5 },
  estimates: [
    { method: "dcf", value_per_share: 148, note: "" },
    { method: "ev_sales", value_per_share: 138, note: "" },
    { method: "ev_ebitda", value_per_share: null, note: "skipped" },
  ],
};

describe("BreakdownBar", () => {
  it("renders each method value and the blended range", () => {
    render(<BreakdownBar result={result} />);
    expect(screen.getByText("DCF")).toBeInTheDocument();
    expect(screen.getByText("$148")).toBeInTheDocument();
    expect(screen.getByText(/142/)).toBeInTheDocument();
    expect(screen.getByText(/128.*158/)).toBeInTheDocument();
  });

  it("shows a dash for skipped methods", () => {
    render(<BreakdownBar result={result} />);
    expect(screen.getByText("EV/EBITDA").closest(".cell")).toHaveTextContent("—");
  });
});
