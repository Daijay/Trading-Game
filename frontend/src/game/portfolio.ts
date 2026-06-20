export interface Position {
  shares: number; // positive = long, negative = short
  avgCost: number; // entry price of the currently open side (0 when flat)
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

  // Buy covers a short first (if any), then opens or extends a long.
  buy(ticker: string, qty: number, price: number): TradeResult {
    if (qty <= 0) return { ok: false, reason: "quantity must be positive" };
    const cost = qty * price;
    if (cost > this.cash) return { ok: false, reason: "not enough cash" };
    const pos = this.position(ticker);
    const newShares = pos.shares + qty;

    if (pos.shares < 0) {
      // covering a short: realize gain when buy price is below short entry
      const covered = Math.min(qty, -pos.shares);
      this.realized += (pos.avgCost - price) * covered;
      const avgCost = newShares > 0 ? price : newShares === 0 ? 0 : pos.avgCost;
      this.positions[ticker] = { shares: newShares, avgCost };
    } else {
      // flat or long: weighted-average long entry
      const avgCost = (pos.shares * pos.avgCost + cost) / newShares;
      this.positions[ticker] = { shares: newShares, avgCost };
    }
    this.cash -= cost;
    return { ok: true };
  }

  // Sell reduces a long first (if any), then opens or extends a short.
  sell(ticker: string, qty: number, price: number): TradeResult {
    if (qty <= 0) return { ok: false, reason: "quantity must be positive" };
    const pos = this.position(ticker);
    const newShares = pos.shares - qty;

    if (pos.shares > 0) {
      // reducing a long: realize gain when sell price is above long entry
      const reduced = Math.min(qty, pos.shares);
      this.realized += (price - pos.avgCost) * reduced;
      const avgCost = newShares < 0 ? price : newShares === 0 ? 0 : pos.avgCost;
      this.positions[ticker] = { shares: newShares, avgCost };
    } else {
      // flat or short: weighted-average short entry
      const prevShort = -pos.shares;
      const avgCost = (prevShort * pos.avgCost + qty * price) / (prevShort + qty);
      this.positions[ticker] = { shares: newShares, avgCost };
    }
    this.cash += qty * price;
    return { ok: true };
  }

  positionValue(ticker: string, price: number): number {
    return this.position(ticker).shares * price;
  }

  // Works for both long and short: (price - avgCost) * shares.
  unrealized(ticker: string, price: number): number {
    const pos = this.position(ticker);
    return (price - pos.avgCost) * pos.shares;
  }

  unrealizedPct(ticker: string, price: number): number {
    const pos = this.position(ticker);
    if (pos.shares === 0 || pos.avgCost === 0) return 0;
    return this.unrealized(ticker, price) / (pos.avgCost * Math.abs(pos.shares));
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
