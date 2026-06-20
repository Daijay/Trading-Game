export interface Position {
  shares: number;
  avgCost: number;
}

export type TradeResult = { ok: true } | { ok: false; reason: string };

export class Portfolio {
  cash: number;
  realized = 0;
  positions: Record<string, Position> = {};

  constructor(startingCash: number) {
    this.cash = startingCash;
  }

  position(ticker: string): Position {
    return this.positions[ticker] ?? { shares: 0, avgCost: 0 };
  }

  buy(ticker: string, qty: number, price: number): TradeResult {
    if (qty <= 0) return { ok: false, reason: "quantity must be positive" };
    const cost = qty * price;
    if (cost > this.cash) return { ok: false, reason: "not enough cash" };
    const pos = this.position(ticker);
    const newShares = pos.shares + qty;
    this.positions[ticker] = {
      shares: newShares,
      avgCost: (pos.shares * pos.avgCost + cost) / newShares,
    };
    this.cash -= cost;
    return { ok: true };
  }

  sell(ticker: string, qty: number, price: number): TradeResult {
    if (qty <= 0) return { ok: false, reason: "quantity must be positive" };
    const pos = this.position(ticker);
    if (qty > pos.shares) return { ok: false, reason: "not enough shares" };
    this.realized += (price - pos.avgCost) * qty;
    this.cash += qty * price;
    const remaining = pos.shares - qty;
    this.positions[ticker] = {
      shares: remaining,
      avgCost: remaining === 0 ? 0 : pos.avgCost,
    };
    return { ok: true };
  }

  positionValue(ticker: string, price: number): number {
    return this.position(ticker).shares * price;
  }

  unrealized(ticker: string, price: number): number {
    const pos = this.position(ticker);
    return (price - pos.avgCost) * pos.shares;
  }

  unrealizedPct(ticker: string, price: number): number {
    const pos = this.position(ticker);
    if (pos.shares === 0 || pos.avgCost === 0) return 0;
    return price / pos.avgCost - 1;
  }

  netWorth(prices: Record<string, number>): number {
    let total = this.cash;
    for (const [ticker, pos] of Object.entries(this.positions)) {
      total += pos.shares * (prices[ticker] ?? 0);
    }
    return total;
  }

  totalUnrealized(prices: Record<string, number>): number {
    let total = 0;
    for (const [ticker, pos] of Object.entries(this.positions)) {
      total += ((prices[ticker] ?? 0) - pos.avgCost) * pos.shares;
    }
    return total;
  }

  totalPnl(prices: Record<string, number>): number {
    return this.realized + this.totalUnrealized(prices);
  }

  static maxBuyable(cash: number, price: number): number {
    if (price <= 0) return 0;
    return Math.floor(cash / price);
  }
}
