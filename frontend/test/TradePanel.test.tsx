import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TradePanel from "../src/components/TradePanel";

const base = {
  ticker: "NOVA",
  price: 120,
  shares: 5,
  avgCost: 100,
  unrealized: 100,
  unrealizedPct: 0.2,
  cash: 500,
  onBuy: () => {},
  onSell: () => {},
};

describe("TradePanel", () => {
  it("shows shares held and position P&L", () => {
    render(<TradePanel {...base} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/\+\$100/)).toBeInTheDocument();
  });

  it("buys the selected quantity at the current price", () => {
    const onBuy = vi.fn();
    render(<TradePanel {...base} onBuy={onBuy} />);
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: "BUY" }));
    expect(onBuy).toHaveBeenCalledWith(10);
  });

  it("disables BUY when one share is unaffordable", () => {
    render(<TradePanel {...base} cash={10} price={120} />);
    expect(screen.getByRole("button", { name: "BUY" })).toBeDisabled();
  });
});
