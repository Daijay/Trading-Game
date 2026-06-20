# Ticker Runner: Trading Game Design Spec

**Date:** 2026-06-20
**Status:** Approved (design), pending implementation plan

## 1. Summary

Ticker Runner is an arcade style day trading game. It replaces the previous
valuation model and Yahoo Finance data entirely. A fully simulated market runs
in the browser, ticking every second into live candlesticks. The player picks
one stock from a small roster to focus and trade, buys and sells shares with a
starting bankroll, and watches gain/loss and net worth move in real time. A
volatility control (1 to 4) scales how wild the market is, where 1 is calm and 4
is IPO day chaos.

This is a client side game. No backend or network is required. The existing
React, Vite, TypeScript, and Lightweight Charts shell and dark theme are reused.
The Python FastAPI backend and valuation engine are retired (kept in git
history, not deleted from history, but removed from the running app).

## 2. Goals and Non-Goals

### Goals
- A simulated market of several stocks, each with its own live price path.
- Player focuses and trades one stock at a time; positions persist across all.
- Buy and sell at the live price, with quantity presets (1, 10, 100, MAX).
- Track shares held, average cost, cash, per position gain/loss, realized P&L,
  and total net worth, updating live and flashing green/red.
- Volatility setting 1 to 4 that visibly changes swing size and jump frequency.
- Two game modes: Endless Sandbox and Timed Challenge (arcade, scored).
- Live candlesticks that form and scroll like a real trading terminal.

### Non-Goals (YAGNI)
- No real market data, valuation, or fundamentals.
- No backend, accounts, or persistence beyond a local best score.
- No short selling, margin, options, or limit orders in v1 (market orders only).
- No multiplayer.

## 3. Simulation Engine (the new model)

The engine is pure TypeScript, deterministic given a seed, and has no DOM or
timer dependencies (the tick loop lives outside it).

### 3.1 Price process
Each stock advances one tick via geometric Brownian motion with occasional
jumps:

- `nextPrice = price * exp((drift - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z) + jump`
- `Z` is a standard normal draw from the seeded RNG.
- `jump` fires with probability `jumpProb`, sized by `jumpScale * price`, sign
  random. Jumps create the gaps and spikes that make high volatility dramatic.
- Price is floored at a small positive value so it never goes to zero or below.

### 3.2 Volatility levels
A lookup maps level 1 to 4 onto `sigma`, `jumpProb`, and `jumpScale`:

| Level | sigma (per tick) | jumpProb | jumpScale | feel |
|-------|------------------|----------|-----------|------|
| 1 | 0.010 | 0.00 | 0.00 | calm |
| 2 | 0.025 | 0.02 | 0.03 | choppy |
| 3 | 0.050 | 0.05 | 0.06 | wild |
| 4 | 0.110 | 0.12 | 0.14 | IPO day |

Drift is a small fixed value per stock (some trend up, some down) so the roster
feels varied. Exact constants are tunable; tests assert ordering, not values.

### 3.3 Seeded RNG
A small deterministic PRNG (mulberry32 or equivalent) seeded per game, so a run
is reproducible in tests. Each stock derives its own stream from the base seed.

### 3.4 Candle building
Ticks are aggregated into candles. A fixed number of ticks per candle (for
example 5). While a candle is forming, its close updates each tick and its high
and low stretch; when the tick count completes, the candle finalizes and a new
one opens at the previous close. The chart keeps a rolling window of recent
candles.

## 4. Market

`Market` owns the roster of stocks and advances them. Responsibilities:

- Hold N stocks (default 6) with fictional tech style tickers (NOVA, QBIT, HELX,
  ZNTH, FLUX, VOLT) so nothing implies real companies or real data.
- On each tick, advance every stock's price and update its forming candle.
- Expose, per stock: current price, day open (session start) for percent change,
  and the rolling candle series.
- Expose the current volatility level; changing it takes effect on the next tick.

The Market is pure logic. The React layer calls `market.tick()` on an interval
and reads state to render.

## 5. Portfolio and Trading

`Portfolio` is pure and fully testable. State:

- `cash: number`
- `positions: Record<ticker, { shares: number; avgCost: number }>`
- `realized: number`

Operations:

- `buy(ticker, qty, price)`: requires `qty*price <= cash`; reduces cash; updates
  shares and recomputes `avgCost` as a weighted average. Returns ok or an error
  reason (insufficient cash, non positive qty).
- `sell(ticker, qty, price)`: requires `qty <= shares`; increases cash; adds
  `(price - avgCost)*qty` to `realized`; reduces shares; clears the position to
  zero shares when fully sold (avgCost reset).
- Derived selectors (pure functions over Portfolio + current prices):
  - `positionValue(ticker, price)`, `unrealized(ticker, price)`,
    `unrealizedPct(ticker, price)`
  - `netWorth(prices)` = cash + sum of position values
  - `totalUnrealized(prices)`, `totalPnl(prices)` = realized + totalUnrealized

Market orders only; fills at the exact current price (no spread or slippage in
v1).

## 6. Game Modes

`GameMode` logic is pure; the React layer supplies the clock via tick counts.

- **Endless Sandbox:** starting cash (default 10,000), no timer, no end. Player
  trades freely; net worth and P&L update forever.
- **Timed Challenge:** starting cash 10,000 and a fixed duration (default 120
  seconds, measured in ticks). When time expires the game ends, trading is
  locked, and a final score equal to net worth is shown. Best score is persisted
  in `localStorage` and displayed on the result screen and start screen.

A start screen lets the player choose mode and starting volatility. A result
screen (Timed) shows final net worth, P&L, best score, and a "play again" action.

## 7. Frontend Components

Reuse the React + Vite + TypeScript + Lightweight Charts + dark theme shell.
Approved layout (top to bottom): HUD, stock picker, chart + trade panel, then
the volatility bar.

- `App`: owns the game loop (interval calling `market.tick()`), current screen
  (start, playing, result), selected ticker, and wiring between Market,
  Portfolio, and GameMode.
- `Hud`: title, mode, timer (Timed only), net worth, total P&L (flash on change).
- `StockPicker`: roster row; each shows ticker and percent change; click selects
  the focused stock.
- `CandleChart`: Lightweight Charts candlestick series for the focused stock,
  updated each tick; an average cost price line for the held position. Price
  scale on the left.
- `TradePanel`: shares held, average cost, position P&L, cash; quantity presets
  (1, 10, 100, MAX); BUY and SELL buttons; estimated order cost.
- `VolatilityBar`: segmented control 1, 2, 3, 4 (only 4 labeled IPO); changes the
  market's volatility live.
- `StartScreen` and `ResultScreen`: mode and volatility selection; final score.

Component boundaries: each renders one region from typed props and calls back to
`App`. Game state lives in `App` (or a small store hook), not in children.

## 8. Data Flow

1. Start screen: player picks mode and volatility; `App` constructs `Market`,
   `Portfolio`, and `GameMode`, seeds the RNG, and starts the interval.
2. Each interval tick: `market.tick()` advances prices and candles; if Timed,
   `GameMode` decrements remaining ticks; React re-renders HUD, picker, chart,
   and trade panel from the new state.
3. Player clicks a roster item: `App` sets the focused ticker; chart and trade
   panel switch to it (positions are unaffected).
4. Player clicks BUY or SELL: `App` calls `portfolio.buy/sell` at the focused
   stock's current price; on error, shows a brief inline message; on success,
   the panel and HUD update next render.
5. Player changes volatility: `App` sets `market` volatility; effect appears on
   the next tick.
6. Timed mode reaches zero ticks: `App` stops the interval, locks trading, shows
   the result screen, and updates best score in `localStorage`.

## 9. Error Handling

- Invalid trades (insufficient cash, selling more than held, non positive qty)
  are rejected by `Portfolio` with a reason; the UI shows a short non blocking
  message and does not mutate state.
- MAX buy computes the largest affordable whole share quantity at the current
  price; if cash is too low for even one share, BUY is disabled.
- `localStorage` access is wrapped so a failure (private mode) degrades to no
  persisted best score rather than crashing.
- The interval is always cleared on unmount and on game end to avoid leaks.

## 10. Testing Strategy

Pure logic is unit tested with Vitest; the chart and interval loop are verified
by running the game.

- **Engine:** seeded RNG is deterministic (same seed gives same sequence); higher
  volatility level yields larger average absolute tick return over many ticks
  (assert ordering 1 < 2 < 3 < 4); price never drops to zero or below; candle
  builder opens the next candle at the previous close and finalizes after the
  fixed tick count.
- **Portfolio:** buy reduces cash and sets weighted average cost; sell increases
  cash and accumulates realized P&L correctly; over-buy and over-sell are
  rejected; net worth equals cash plus position values; unrealized math matches
  hand computed values; MAX quantity is the largest affordable whole shares.
- **Game modes:** Timed ends after the configured ticks and locks trading; final
  score equals net worth; best score updates only when beaten.
- **Components:** TradePanel renders shares, P&L, and disabled BUY when broke;
  VolatilityBar reports the selected level; StockPicker reports selection.

## 11. Tech Stack

| Layer | Choice |
|-------|--------|
| Simulation engine | TypeScript pure modules, seeded PRNG |
| Game state | React state / small store hook |
| Charting | TradingView Lightweight Charts (candlesticks) |
| Build / test | Vite, Vitest, React Testing Library |
| Persistence | localStorage (best score only) |

## 12. Migration Notes

- Remove the valuation focused frontend (`store.ts`, valuation `types`, the old
  `api.ts`, `TopBar`, `Watchlist`, `BreakdownBar`, `AssumptionsPanel`,
  valuation `ChartPanel`) and replace with the game components above. Keep
  `index.html`, Vite config, the dark theme (extended), and the Lightweight
  Charts dependency.
- The Python `backend/` directory is no longer used by the app. Leave it in the
  repository history; the running game does not depend on it.

## 13. Future (not in v1)
- Short selling and leverage; limit orders.
- News events that spike a single stock.
- Per stock volatility overrides; difficulty curves.
- Sound effects and richer animations on fills.
