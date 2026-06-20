# Frontend Valuation Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Prerequisite:** the backend plan (`2026-06-19-backend-valuation-engine.md`) must be implemented and runnable on `http://localhost:8000`.

**Goal:** Build a TradingView-style React dashboard that visualizes the backend's valuation results — price line chart + fair-value band, watchlist, live DCF assumption sliders, and a method breakdown bar.

**Architecture:** Vite + React + TypeScript SPA. A typed API client wraps the backend. A small top-level store holds the selected ticker and current `ValuationResult`. Five focused presentational components render each dashboard region. Charting via TradingView Lightweight Charts.

**Tech Stack:** Vite, React 18, TypeScript, lightweight-charts, Vitest + React Testing Library.

---

## File Structure

```
frontend/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    theme.css
    types.ts              # mirrors backend JSON shapes
    api.ts                # typed fetch client
    store.ts              # useTerminalStore hook (selected ticker + result)
    components/
      TopBar.tsx
      Watchlist.tsx
      ChartPanel.tsx      # lightweight-charts: price line + MA + FV band
      AssumptionsPanel.tsx
      BreakdownBar.tsx
  test/
    api.test.ts
    BreakdownBar.test.tsx
    AssumptionsPanel.test.tsx
```

---

### Task 1: Scaffold Vite React TS app

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "quant-valuation-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "lightweight-charts": "^4.1.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  test: { environment: "jsdom", globals: true, setupFiles: "./test/setup.ts" },
} as any);
```

- [ ] **Step 4: Create `frontend/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quant Valuation Terminal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Install and verify**

Run (from `frontend/`): `npm install`
Expected: installs without error.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src/main.tsx frontend/test/setup.ts
git commit -m "chore: scaffold frontend app"
```

---

### Task 2: Types and API client

**Files:**
- Create: `frontend/src/types.ts`, `frontend/src/api.ts`
- Test: `frontend/test/api.test.ts`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```ts
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
```

- [ ] **Step 2: Write failing test — `frontend/test/api.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getValuation, postValuation } from "../src/api";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("api client", () => {
  it("getValuation hits the right URL", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ticker: "NVDA" }) });
    const res = await getValuation("NVDA");
    expect(fetch).toHaveBeenCalledWith("/api/valuation/NVDA");
    expect(res.ticker).toBe("NVDA");
  });

  it("postValuation sends assumptions as JSON body", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ticker: "NVDA" }) });
    const a = { revenue_growth: 0.2, fcf_margin: 0.3, wacc: 0.09, terminal_growth: 0.03, projection_years: 5 };
    await postValuation("NVDA", a);
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/valuation/NVDA");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({ revenue_growth: 0.2 });
  });

  it("throws on non-ok response", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: "no data" }) });
    await expect(getValuation("BAD")).rejects.toThrow(/no data/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run (from `frontend/`): `npm test -- api.test`
Expected: FAIL — cannot find `../src/api`.

- [ ] **Step 4: Create `frontend/src/api.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- api.test`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/api.ts frontend/test/api.test.ts
git commit -m "feat: add types and API client"
```

---

### Task 3: BreakdownBar component

**Files:**
- Create: `frontend/src/components/BreakdownBar.tsx`
- Test: `frontend/test/BreakdownBar.test.tsx`

- [ ] **Step 1: Write failing test — `frontend/test/BreakdownBar.test.tsx`**

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- BreakdownBar`
Expected: FAIL — cannot find component.

- [ ] **Step 3: Create `frontend/src/components/BreakdownBar.tsx`**

```tsx
import type { ValuationResult } from "../types";

const LABELS: Record<string, string> = {
  dcf: "DCF", ev_sales: "EV/Sales", ev_ebitda: "EV/EBITDA", pe: "P/E", peg: "PEG",
};

function fmt(v: number | null): string {
  return v === null ? "—" : `$${Math.round(v)}`;
}

export default function BreakdownBar({ result }: { result: ValuationResult }) {
  return (
    <div className="breakdown">
      {result.estimates.map((e) => (
        <div className="cell" key={e.method}>
          <div className="cell-label">{LABELS[e.method] ?? e.method}</div>
          <div className="cell-value">{fmt(e.value_per_share)}</div>
        </div>
      ))}
      <div className="cell">
        <div className="cell-label">Reverse DCF</div>
        <div className="cell-value implied">
          {result.implied_growth === null ? "—" : `${Math.round(result.implied_growth * 100)}% implied`}
        </div>
      </div>
      <div className="cell blended">
        <div className="cell-label">Blended Fair Value</div>
        <div className="cell-value">
          ${Math.round(result.blended_base)}{" "}
          <span className="range">
            ({Math.round(result.blended_low)}–{Math.round(result.blended_high)})
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- BreakdownBar`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BreakdownBar.tsx frontend/test/BreakdownBar.test.tsx
git commit -m "feat: add BreakdownBar component"
```

---

### Task 4: AssumptionsPanel component (live sliders)

**Files:**
- Create: `frontend/src/components/AssumptionsPanel.tsx`
- Test: `frontend/test/AssumptionsPanel.test.tsx`

- [ ] **Step 1: Write failing test — `frontend/test/AssumptionsPanel.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AssumptionsPanel from "../src/components/AssumptionsPanel";
import type { Assumptions } from "../src/types";

const base: Assumptions = {
  revenue_growth: 0.18, fcf_margin: 0.3, wacc: 0.09, terminal_growth: 0.03, projection_years: 5,
};

describe("AssumptionsPanel", () => {
  it("renders a slider per assumption with current values", () => {
    render(<AssumptionsPanel assumptions={base} onChange={() => {}} />);
    expect(screen.getByLabelText(/Rev growth/i)).toHaveValue("0.18");
    expect(screen.getByLabelText(/WACC/i)).toHaveValue("0.09");
  });

  it("calls onChange with updated assumptions when a slider moves", () => {
    const onChange = vi.fn();
    render(<AssumptionsPanel assumptions={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Rev growth/i), { target: { value: "0.25" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ revenue_growth: 0.25, wacc: 0.09 }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AssumptionsPanel`
Expected: FAIL — cannot find component.

- [ ] **Step 3: Create `frontend/src/components/AssumptionsPanel.tsx`**

```tsx
import type { Assumptions } from "../types";

interface Props {
  assumptions: Assumptions;
  onChange: (a: Assumptions) => void;
}

const ROWS: { key: keyof Assumptions; label: string; min: number; max: number; step: number; pct: boolean }[] = [
  { key: "revenue_growth", label: "Rev growth (5y)", min: -0.1, max: 0.6, step: 0.01, pct: true },
  { key: "fcf_margin", label: "FCF margin", min: 0.0, max: 0.6, step: 0.01, pct: true },
  { key: "wacc", label: "WACC", min: 0.05, max: 0.18, step: 0.005, pct: true },
  { key: "terminal_growth", label: "Terminal growth", min: 0.0, max: 0.05, step: 0.005, pct: true },
];

export default function AssumptionsPanel({ assumptions, onChange }: Props) {
  return (
    <div className="assumptions">
      <div className="panel-title">DCF ASSUMPTIONS</div>
      {ROWS.map((r) => {
        const value = assumptions[r.key] as number;
        return (
          <div className="slider-row" key={r.key}>
            <label htmlFor={r.key}>
              {r.label}
              <span className="slider-value">{r.pct ? `${(value * 100).toFixed(1)}%` : value}</span>
            </label>
            <input
              id={r.key}
              aria-label={r.label}
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={value}
              onChange={(e) => onChange({ ...assumptions, [r.key]: Number(e.target.value) })}
            />
          </div>
        );
      })}
      <div className="panel-foot">↻ band &amp; verdict recompute live</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AssumptionsPanel`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AssumptionsPanel.tsx frontend/test/AssumptionsPanel.test.tsx
git commit -m "feat: add AssumptionsPanel with sliders"
```

---

### Task 5: TopBar and Watchlist components

**Files:**
- Create: `frontend/src/components/TopBar.tsx`, `frontend/src/components/Watchlist.tsx`

> These are simple presentational components; verified via the App smoke run in Task 8. No separate unit test required (rendering is trivial prop mapping).

- [ ] **Step 1: Create `frontend/src/components/TopBar.tsx`**

```tsx
import type { Quote, ValuationResult } from "../types";

interface Props {
  quote: Quote | null;
  result: ValuationResult | null;
}

export default function TopBar({ quote, result }: Props) {
  const tone =
    result === null ? "neutral"
    : result.upside_pct > 0.05 ? "positive"
    : result.upside_pct < -0.05 ? "negative" : "neutral";

  return (
    <div className="topbar">
      <strong className="symbol">{quote?.ticker ?? "—"}</strong>
      <span className="muted">{quote?.name} · {quote?.exchange}</span>
      <span className="price">{quote ? `$${quote.price.toFixed(2)}` : ""}</span>
      <span className="spacer" />
      {result && (
        <span className={`verdict-badge ${tone}`}>
          ${Math.round(result.blended_base)} · {result.upside_pct >= 0 ? "+" : ""}
          {(result.upside_pct * 100).toFixed(1)}% {result.verdict.toUpperCase()}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/Watchlist.tsx`**

```tsx
import { useState } from "react";
import type { TickerSummary } from "../types";

interface Props {
  items: TickerSummary[];
  selected: string;
  onSelect: (ticker: string) => void;
  onAdd: (ticker: string) => void;
}

function tone(upside: number): string {
  return upside > 0.05 ? "positive" : upside < -0.05 ? "negative" : "neutral";
}

export default function Watchlist({ items, selected, onSelect, onAdd }: Props) {
  const [draft, setDraft] = useState("");
  return (
    <div className="watchlist">
      <div className="panel-title">WATCHLIST · VALUATION</div>
      {items.map((it) => (
        <div
          key={it.ticker}
          className={`wl-row ${tone(it.upside_pct)} ${it.ticker === selected ? "active" : ""}`}
          onClick={() => onSelect(it.ticker)}
        >
          <span>{it.ticker}</span>
          <span className="wl-pct">
            {it.upside_pct >= 0 ? "+" : ""}{Math.round(it.upside_pct * 100)}%
          </span>
        </div>
      ))}
      <form
        className="wl-add"
        onSubmit={(e) => { e.preventDefault(); if (draft) { onAdd(draft.toUpperCase()); setDraft(""); } }}
      >
        <input value={draft} placeholder="+ add ticker" onChange={(e) => setDraft(e.target.value)} />
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TopBar.tsx frontend/src/components/Watchlist.tsx
git commit -m "feat: add TopBar and Watchlist components"
```

---

### Task 6: ChartPanel (Lightweight Charts)

**Files:**
- Create: `frontend/src/components/ChartPanel.tsx`

> Lightweight Charts manipulates the real DOM/canvas and is awkward to unit-test in jsdom; verified via the App smoke run in Task 8. Keep the component a thin, declarative wrapper so there is little logic to test.

- [ ] **Step 1: Create `frontend/src/components/ChartPanel.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { createChart, IChartApi, LineStyle, ISeriesApi } from "lightweight-charts";
import type { PricePoint, ValuationResult } from "../types";

interface Props {
  prices: PricePoint[];
  result: ValuationResult | null;
}

export default function ChartPanel({ prices, result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceRef = useRef<ISeriesApi<"Area"> | null>(null);
  const maRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Create chart once.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "#0e1015" }, textColor: "#6b7280" },
      grid: { vertLines: { color: "#1a1e2a" }, horzLines: { color: "#1a1e2a" } },
      rightPriceScale: { borderColor: "#232838" },
      timeScale: { borderColor: "#232838" },
      autoSize: true,
    });
    priceRef.current = chart.addAreaSeries({
      lineColor: "#2962ff", topColor: "rgba(41,98,255,0.28)", bottomColor: "rgba(41,98,255,0)", lineWidth: 2,
    });
    maRef.current = chart.addLineSeries({ color: "#f0b90b", lineWidth: 1 });
    chartRef.current = chart;
    return () => chart.remove();
  }, []);

  // Update price + MA data.
  useEffect(() => {
    priceRef.current?.setData(prices.map((p) => ({ time: p.date, value: p.close })));
    maRef.current?.setData(
      prices.filter((p) => p.ma50 !== null).map((p) => ({ time: p.date, value: p.ma50! })),
    );
  }, [prices]);

  // Draw fair-value band as price lines whenever the valuation changes.
  useEffect(() => {
    const series = priceRef.current;
    if (!series || !result) return;
    const lines = [
      { price: result.blended_high, color: "#26a69a", title: "FV high" },
      { price: result.blended_base, color: "#b2b5be", title: "FV base", dashed: true },
      { price: result.blended_low, color: "#ef5350", title: "FV low" },
    ];
    const handles = lines.map((l) =>
      series.createPriceLine({
        price: l.price, color: l.color, lineWidth: 1,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true, title: l.title,
      }),
    );
    return () => handles.forEach((h) => series.removePriceLine(h));
  }, [result]);

  return <div className="chart" ref={containerRef} />;
}
```

- [ ] **Step 2: Type-check**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChartPanel.tsx
git commit -m "feat: add ChartPanel with price/MA/FV band"
```

---

### Task 7: Store and App assembly

**Files:**
- Create: `frontend/src/store.ts`, `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/store.ts`**

```ts
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
```

- [ ] **Step 2: Create `frontend/src/App.tsx`**

```tsx
import { useRef } from "react";
import { useTerminal } from "./store";
import TopBar from "./components/TopBar";
import Watchlist from "./components/Watchlist";
import ChartPanel from "./components/ChartPanel";
import AssumptionsPanel from "./components/AssumptionsPanel";
import BreakdownBar from "./components/BreakdownBar";
import type { Assumptions } from "./types";

export default function App() {
  const t = useTerminal();
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const onAssumptions = (a: Assumptions) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => t.updateAssumptions(a), 200);
  };

  return (
    <div className="terminal">
      <TopBar quote={t.quote} result={t.result} />
      {t.error && <div className="error-banner">{t.error}</div>}
      <div className="body">
        <Watchlist items={t.tickers} selected={t.selected} onSelect={t.setSelected} onAdd={t.addTicker} />
        <ChartPanel prices={t.prices} result={t.result} />
        {t.result && <AssumptionsPanel assumptions={t.result.assumptions} onChange={onAssumptions} />}
      </div>
      {t.result && <BreakdownBar result={t.result} />}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store.ts frontend/src/App.tsx
git commit -m "feat: add store and app assembly"
```

---

### Task 8: Theme CSS and end-to-end smoke

**Files:**
- Create: `frontend/src/theme.css`

- [ ] **Step 1: Create `frontend/src/theme.css`**

```css
:root {
  --bg: #0e1015; --panel: #11141d; --line: #232838; --muted: #6b7280;
  --text: #d1d4dc; --pos: #26a69a; --neg: #ef5350; --accent: #2962ff;
  font-family: Inter, system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-size: 13px; }
.terminal { display: flex; flex-direction: column; height: 100vh; }
.topbar { display: flex; align-items: center; gap: 14px; padding: 10px 14px;
  background: #161a25; border-bottom: 1px solid var(--line); }
.symbol { color: #fff; font-size: 15px; } .muted { color: var(--muted); }
.spacer { margin-left: auto; }
.verdict-badge { padding: 3px 11px; border-radius: 4px; font-weight: 700; }
.verdict-badge.positive { background: linear-gradient(90deg,#1b5e4f,#26a69a); color: #eafff7; }
.verdict-badge.negative { background: linear-gradient(90deg,#5e1b1b,#ef5350); color: #fff; }
.verdict-badge.neutral { background: #2a2e39; color: #d1d4dc; }
.body { display: flex; flex: 1; min-height: 0; }
.watchlist, .assumptions { width: 170px; background: var(--panel); padding: 10px; }
.watchlist { border-right: 1px solid var(--line); }
.assumptions { border-left: 1px solid var(--line); }
.panel-title { color: var(--muted); font-size: 10px; letter-spacing: .08em; margin-bottom: 10px; }
.wl-row { display: flex; justify-content: space-between; padding: 6px; cursor: pointer;
  border-left: 2px solid var(--muted); }
.wl-row.positive { border-color: var(--pos); } .wl-row.negative { border-color: var(--neg); }
.wl-row.active { background: #1b2030; } .wl-pct.positive { color: var(--pos); }
.wl-row.positive .wl-pct { color: var(--pos); } .wl-row.negative .wl-pct { color: var(--neg); }
.wl-add input { width: 100%; margin-top: 8px; background: transparent; border: none;
  color: var(--accent); padding: 6px 4px; }
.chart { flex: 1; min-width: 0; }
.slider-row { margin-bottom: 14px; } .slider-row label { display: block; }
.slider-value { float: right; color: #fff; font-weight: 600; }
.slider-row input[type=range] { width: 100%; margin-top: 6px; accent-color: var(--accent); }
.panel-foot { color: var(--muted); font-size: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
.breakdown { display: flex; gap: 1px; background: var(--line); border-top: 1px solid var(--line); }
.cell { flex: 1; background: var(--panel); padding: 8px 12px; }
.cell.blended { flex: 1.5; background: #13241e; }
.cell-label { color: var(--muted); font-size: 9px; letter-spacing: .05em; }
.cell-value { color: #fff; font-size: 14px; margin-top: 2px; }
.cell.blended .cell-value { color: var(--pos); font-weight: 700; }
.cell-value.implied { color: #facc15; } .range { color: var(--muted); font-weight: 400; }
.error-banner { background: #5e1b1b; color: #fff; padding: 6px 14px; }
```

- [ ] **Step 2: Run unit tests + type-check**

Run (from `frontend/`): `npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 3: End-to-end smoke (manual)**

1. Start backend (from `backend/`): `uvicorn quant.api.main:app --port 8000`
2. Start frontend (from `frontend/`): `npm run dev`
3. Open the printed Vite URL. Verify:
   - Watchlist loads with colored % values.
   - Selecting a ticker updates the chart, badge, and breakdown.
   - The price line, gold 50-day MA, and three FV band lines render.
   - Dragging a DCF slider updates the badge/band/breakdown within ~200ms.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme.css
git commit -m "feat: add theme and complete dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** watchlist with verdict colors (Task 5), top-bar verdict
  badge (Task 5), price line + 50-day MA + FV band chart (Task 6), live DCF
  assumption sliders with debounce (Tasks 4, 7), method breakdown bar incl.
  reverse-DCF implied growth and blended range (Task 3) — matches approved v4
  layout. Error states surfaced via `error-banner` (Task 7/8).
- **Type consistency:** `types.ts` mirrors the backend `to_dict()` shapes
  exactly (`ValuationResult`, `MethodEstimate`, `Assumptions`, `PricePoint`,
  `Quote`, `TickerSummary`); component props reference these unchanged.
- **Test strategy:** logic-bearing units (api client, BreakdownBar formatting,
  AssumptionsPanel onChange) have unit tests; canvas/DOM-heavy ChartPanel and
  trivial presentational components are covered by the manual smoke run.
- **Prerequisite:** assumes backend endpoints from Plan 1 are live on :8000.
