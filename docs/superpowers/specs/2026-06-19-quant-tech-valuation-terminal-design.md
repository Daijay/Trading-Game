# Quant Tech Valuation Terminal — Design Spec

**Date:** 2026-06-19
**Status:** Approved (design), pending implementation plan

## 1. Summary

A desktop-grade web application that values technology stocks using a blended
quantitative valuation engine and presents the results in a TradingView-style
visualizer. For any tech ticker, the app computes an intrinsic **fair value
range** from multiple methods, compares it to the live market price, and renders
a clean price chart with the fair-value band overlaid plus interactive
assumption controls that recompute the valuation live.

Two distinct subsystems:

1. **Model layer** — Python quant valuation engine (data + math).
2. **Visualizer layer** — React/TypeScript TradingView-style dashboard.

They communicate over a small HTTP/JSON API.

## 2. Goals & Non-Goals

### Goals
- Compute a defensible fair value for a tech stock from several methods and
  blend them into a single estimate with a low/base/high range.
- Show, at a glance, whether a stock is over- or under-valued and by how much.
- Make valuation assumptions transparent and interactive (sliders that
  recompute live), so it is never a black box.
- Present everything in a professional, dark, TradingView-like UI with a price
  line chart, fair-value band, moving average, watchlist, and method breakdown.

### Non-Goals (YAGNI)
- No live trading, order execution, or brokerage integration.
- No intraday/tick streaming — daily price history is sufficient.
- No multi-user accounts, auth, or cloud deployment (local single-user app).
- No price *forecasting* / ML prediction. This is valuation, not prediction.
- No options, fixed income, crypto, or non-tech sectors in v1.

## 3. Valuation Engine

The engine produces, per ticker, a set of method estimates and a blended result.

### 3.1 Methods
1. **Discounted Cash Flow (DCF)**
   - 5-year explicit free-cash-flow projection.
   - Inputs: starting revenue, revenue growth rate, FCF margin, WACC (discount
     rate), terminal growth rate, shares outstanding, net debt.
   - Terminal value via Gordon growth model.
   - Output: intrinsic equity value per share.
2. **Relative Multiples / Comparables**
   - Peer-set median multiples applied to the target's metrics.
   - Multiples: EV/Sales, EV/EBITDA, P/E, PEG.
   - EV/Sales weighted more heavily for low/negative-earnings growth names.
   - Output: implied per-share value per multiple.
3. **Reverse DCF**
   - Inverts the DCF to solve for the revenue growth rate implied by today's
     price (root-find on growth such that DCF value == market price).
   - Output: "implied growth %" — a sanity check on market expectations.

### 3.2 Blended Fair Value
- Weighted composite of DCF + the multiples estimates.
- Default weights (configurable): DCF 40%, EV/Sales 20%, EV/EBITDA 20%,
  P/E·PEG 20%. Reverse DCF is diagnostic only — not blended.
- **Range:** low/base/high derived from a sensitivity sweep (see 3.3); base =
  weighted blend, low/high = blend at conservative/optimistic assumption corners.
- **Verdict:** `(blended_base / market_price - 1)` → % over/under-valued, with a
  label (Undervalued / Fairly valued / Overvalued; fair band default ±5%).

### 3.3 Sensitivity Grid
- 2-D grid of fair value across **WACC × terminal-growth** (and exposed in UI).
- Drives the low/high bounds of the blended range and feeds a heatmap view.

### 3.4 Engine Design (isolation)
- Each method is a pure function: `inputs -> estimate`. Independently testable,
  no I/O. This is the core unit boundary — math is separated from data fetching.
- A `Valuation` orchestrator assembles method inputs from a `FinancialData`
  object, runs each method, blends, and returns a structured `ValuationResult`.

## 4. Data Layer

- **Source:** `yfinance` (Yahoo Finance) — no API key. Provides daily price
  history and the fundamentals needed (revenue, EBITDA, FCF, shares, net debt,
  current multiples) for the target and peers.
- **Provider interface:** a `MarketDataProvider` protocol with methods like
  `price_history(ticker, range)` and `fundamentals(ticker)`. `yfinance` is one
  implementation; a richer paid source (e.g. Financial Modeling Prep) can be
  added later behind the same interface without touching the engine.
- **Caching:** on-disk cache (e.g. parquet/JSON under a cache dir) with a TTL so
  repeated valuations and slider tweaks don't re-hit the network. Fundamentals
  cached longer (hours), prices shorter (minutes).
- **Peer sets:** a small curated mapping of tech sub-industries → peer tickers
  (e.g. semis, mega-cap platforms, software/SaaS) for the comparables method,
  editable in config.

## 5. Backend API (FastAPI)

Thin JSON layer over the engine. Endpoints:

- `GET /api/tickers` — watchlist with cached verdict % per ticker.
- `GET /api/quote/{ticker}` — name, exchange, last price, day change.
- `GET /api/prices/{ticker}?range=1Y` — daily close series + 50-day MA.
- `GET /api/valuation/{ticker}` — full `ValuationResult` with default
  assumptions (method estimates, blended value+range, verdict, implied growth).
- `POST /api/valuation/{ticker}` — body = overridden assumptions
  (growth, FCF margin, WACC, terminal growth); returns recomputed result.
  This powers the live sliders.
- `GET /api/sensitivity/{ticker}` — WACC × terminal-growth grid.
- `POST /api/watchlist` / `DELETE /api/watchlist/{ticker}` — add/remove tickers.

Watchlist persisted to a local JSON file.

## 6. Frontend (React + TypeScript)

Single-page dark dashboard. Charting via **TradingView Lightweight Charts**
(open source). Approved layout:

- **Top bar:** ticker symbol, name/exchange, last price + day change, and a
  prominent **blended fair-value verdict badge** (e.g. "$142 · +9.7%
  UNDERVALUED", green/red/grey by verdict).
- **Left — Watchlist:** tech tickers, each with a colored left border and a
  valuation % (green undervalued / red overvalued / grey fair). "+ add ticker".
- **Center — Chart:** blue price **line** with gradient area fill, a gold
  **50-day moving average** line, and the **fair-value band** as horizontal
  reference lines (green = high, grey dashed = base, red = low) with a shaded
  undervalued region. Right-edge price-axis labels for the FV levels.
- **Right — DCF Assumptions:** sliders for revenue growth, FCF margin, WACC,
  terminal growth. Changing one POSTs to the valuation endpoint and updates the
  band, badge, and breakdown live (debounced).
- **Bottom — Valuation Breakdown:** one cell per method (DCF, EV/Sales,
  EV/EBITDA, P/E·PEG, Reverse-DCF implied growth) plus a highlighted **Blended
  Fair Value** cell showing base and (low–high) range.

### Component boundaries
- `ChartPanel` (price/MA/FV band), `Watchlist`, `AssumptionsPanel`,
  `BreakdownBar`, `TopBar`. Each owns one region, takes typed props, no shared
  mutable state beyond a top-level app store (selected ticker + current result).

## 7. Data Flow

1. User selects ticker → frontend calls `/quote`, `/prices`, `/valuation`.
2. Backend pulls (cached) data via provider, runs engine, returns result.
3. Chart renders price + MA + FV band; badge + breakdown render verdict.
4. User drags an assumption slider → debounced `POST /valuation` with overrides
   → engine recomputes → band/badge/breakdown update without reloading prices.

## 8. Error Handling

- **Data fetch failures** (network, unknown ticker, missing fundamentals):
  provider returns a typed error; API responds with a clear message; UI shows an
  inline non-blocking error state on the affected panel.
- **Insufficient fundamentals** (e.g. negative/unavailable EBITDA): the affected
  method is skipped and excluded from the blend, with a note in the breakdown
  cell rather than crashing.
- **Invalid assumptions** (e.g. WACC ≤ terminal growth, which breaks Gordon
  growth): validated server-side; return a 400 with explanation; sliders are
  range-constrained client-side to prevent most cases.
- **Cache corruption:** treat as cache miss and refetch.

## 9. Testing Strategy

- **Engine unit tests (primary):** each method is a pure function — test against
  hand-computed expected values (a known DCF, known multiples). Test blending
  weights, verdict thresholds, reverse-DCF root-finding convergence, and
  edge cases (skipped methods, WACC≤g guard).
- **Provider tests:** against recorded/fixture fundamentals (no live network in
  tests) to keep them deterministic.
- **API tests:** FastAPI endpoints with a stub provider.
- **Frontend:** component tests for `AssumptionsPanel` (debounce, POST payload)
  and rendering of the breakdown/verdict from a sample `ValuationResult`.

## 10. Tech Stack Summary

| Layer | Choice |
|-------|--------|
| Valuation engine | Python (pure functions, typed dataclasses) |
| Data | yfinance behind a `MarketDataProvider` interface, on-disk cache |
| API | FastAPI |
| Frontend | React + TypeScript (Vite) |
| Charting | TradingView Lightweight Charts |
| Persistence | Local JSON (watchlist), file cache (market data) |

## 11. Open Questions / Future (not in v1)
- Optional paid data provider for higher-quality fundamentals.
- Add Bollinger bands / volume strip / multi-ticker overlay to the chart.
- Historical fair-value line (compute FV at each past date) instead of flat band.
- Export valuation report (PDF/CSV).
