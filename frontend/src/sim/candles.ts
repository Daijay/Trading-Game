export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const TICKS_PER_CANDLE = 9;
// Keep a generous history so the chart can use incremental updates without the
// oldest bars being dropped mid-session (which would misalign update()).
const MAX_CANDLES = 100000;

// Aggregates a stream of tick prices into OHLC candles.
export class CandleSeries {
  candles: Candle[];
  private ticks = 0;

  constructor(startPrice: number, private ticksPerCandle = TICKS_PER_CANDLE) {
    this.candles = [
      { time: 0, open: startPrice, high: startPrice, low: startPrice, close: startPrice },
    ];
  }

  push(price: number): void {
    const c = this.candles[this.candles.length - 1];
    c.close = price;
    if (price > c.high) c.high = price;
    if (price < c.low) c.low = price;
    this.ticks += 1;
    if (this.ticks >= this.ticksPerCandle) {
      this.ticks = 0;
      this.candles.push({ time: c.time + 1, open: price, high: price, low: price, close: price });
      if (this.candles.length > MAX_CANDLES) this.candles.shift();
    }
  }
}
