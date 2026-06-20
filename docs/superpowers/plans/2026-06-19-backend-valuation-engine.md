# Backend Valuation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python valuation engine + FastAPI service that values tech stocks via blended DCF / multiples / reverse-DCF and serves results as JSON.

**Architecture:** Pure-function valuation methods (no I/O) sit at the core, assembled by a `Valuation` orchestrator. A `MarketDataProvider` interface (yfinance implementation, file cache) feeds it data. FastAPI exposes the engine over HTTP. The frontend (separate plan) consumes the API.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, yfinance, pytest. Typed dataclasses throughout.

---

## File Structure

```
backend/
  pyproject.toml
  quant/
    __init__.py
    models.py              # dataclasses: Assumptions, FinancialData, MethodEstimate, ValuationResult
    methods/
      __init__.py
      dcf.py               # project_fcf, dcf_value_per_share, reverse_dcf_growth
      multiples.py         # multiples_values
    blend.py               # blend_estimates, verdict
    sensitivity.py         # sensitivity_grid
    valuation.py           # Valuation orchestrator
    data/
      __init__.py
      provider.py          # MarketDataProvider protocol + DataError + peer map
      yfinance_provider.py # YFinanceProvider
      cache.py             # FileCache
    api/
      __init__.py
      app.py               # FastAPI app + routes
  tests/
    __init__.py
    fixtures.py            # sample FinancialData + StubProvider
    test_dcf.py
    test_multiples.py
    test_blend.py
    test_sensitivity.py
    test_valuation.py
    test_api.py
```

---

### Task 1: Project scaffold

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/quant/__init__.py` (empty)
- Create: `backend/tests/__init__.py` (empty)

- [ ] **Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "quant-valuation-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110",
    "uvicorn>=0.29",
    "yfinance>=0.2.40",
    "pandas>=2.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Create empty package files**

Create `backend/quant/__init__.py` and `backend/tests/__init__.py` as empty files.

- [ ] **Step 3: Install and verify**

Run (from `backend/`): `pip install -e ".[dev]"`
Expected: installs without error.
Run: `pytest -q`
Expected: "no tests ran" (exit 5) — confirms pytest is wired.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/quant/__init__.py backend/tests/__init__.py
git commit -m "chore: scaffold backend package"
```

---

### Task 2: Domain models

**Files:**
- Create: `backend/quant/models.py`
- Test: `backend/tests/test_valuation.py` (created later; models exercised via other tests)

- [ ] **Step 1: Create `backend/quant/models.py`**

```python
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass(frozen=True)
class Assumptions:
    """DCF inputs that the user can override via sliders."""
    revenue_growth: float      # 5y CAGR, e.g. 0.18
    fcf_margin: float          # free cash flow as % of revenue, e.g. 0.30
    wacc: float                # discount rate, e.g. 0.09
    terminal_growth: float     # perpetuity growth, e.g. 0.03
    projection_years: int = 5

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PeerMultiples:
    ev_sales: float
    ev_ebitda: float
    pe: float
    peg: float


@dataclass(frozen=True)
class FinancialData:
    """Everything the engine needs about one company. Provider-agnostic."""
    ticker: str
    name: str
    exchange: str
    price: float
    revenue: float            # trailing-twelve-month revenue
    ebitda: float
    eps: float                # trailing EPS
    fcf: float                # trailing free cash flow
    shares: float             # diluted shares outstanding
    net_debt: float           # total debt - cash (can be negative)
    earnings_growth: float    # forward growth estimate, for PEG
    default_assumptions: Assumptions
    peers: PeerMultiples


@dataclass(frozen=True)
class MethodEstimate:
    method: str               # "dcf", "ev_sales", ...
    value_per_share: float | None   # None when not computable
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ValuationResult:
    ticker: str
    price: float
    estimates: list[MethodEstimate]
    blended_base: float
    blended_low: float
    blended_high: float
    implied_growth: float | None     # from reverse DCF
    upside_pct: float                # blended_base/price - 1
    verdict: str                     # "Undervalued" | "Fairly valued" | "Overvalued"
    assumptions: Assumptions

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["estimates"] = [e.to_dict() for e in self.estimates]
        return d
```

- [ ] **Step 2: Verify import**

Run (from `backend/`): `python -c "from quant.models import ValuationResult, FinancialData, Assumptions; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add backend/quant/models.py
git commit -m "feat: add domain models"
```

---

### Task 3: DCF and reverse-DCF methods

**Files:**
- Create: `backend/quant/methods/__init__.py` (empty)
- Create: `backend/quant/methods/dcf.py`
- Test: `backend/tests/test_dcf.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_dcf.py`**

```python
import math
import pytest
from quant.methods.dcf import project_fcf, dcf_value_per_share, reverse_dcf_growth


def test_project_fcf_grows_revenue_then_applies_margin():
    fcfs = project_fcf(revenue0=100.0, growth=0.10, fcf_margin=0.20, years=3)
    # rev: 110, 121, 133.1 ; fcf = rev*0.20
    assert fcfs == pytest.approx([22.0, 24.2, 26.62])


def test_dcf_value_per_share_known_case():
    # One year of FCF then terminal value, easy to hand-check.
    # revenue0=1000, growth=0, margin=0.10 -> fcf=100 each year
    # wacc=0.10, g=0.0, years=1
    # pv_fcf = 100/1.1 = 90.909...
    # terminal_fcf = 100*(1+0)=100 ; tv = 100/(0.10-0.0)=1000 ; pv_tv=1000/1.1=909.09
    # EV = 1000.0 ; equity = EV - net_debt(0) = 1000 ; /shares(10) = 100
    val = dcf_value_per_share(
        revenue0=1000.0, growth=0.0, fcf_margin=0.10,
        wacc=0.10, terminal_growth=0.0, shares=10.0, net_debt=0.0, years=1,
    )
    assert val == pytest.approx(100.0, rel=1e-9)


def test_dcf_subtracts_net_debt():
    base = dcf_value_per_share(1000.0, 0.0, 0.10, 0.10, 0.0, 10.0, 0.0, 1)
    with_debt = dcf_value_per_share(1000.0, 0.0, 0.10, 0.10, 0.0, 10.0, 100.0, 1)
    assert with_debt == pytest.approx(base - 10.0)  # 100 debt / 10 shares


def test_dcf_raises_when_wacc_not_above_terminal_growth():
    with pytest.raises(ValueError):
        dcf_value_per_share(1000.0, 0.0, 0.10, 0.03, 0.03, 10.0, 0.0, 5)


def test_reverse_dcf_recovers_growth():
    # Build a price from a known growth, then solve back for it.
    g = 0.12
    price = dcf_value_per_share(1000.0, g, 0.10, 0.10, 0.02, 10.0, 0.0, 5)
    solved = reverse_dcf_growth(
        price=price, revenue0=1000.0, fcf_margin=0.10,
        wacc=0.10, terminal_growth=0.02, shares=10.0, net_debt=0.0, years=5,
    )
    assert solved == pytest.approx(g, abs=1e-4)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_dcf.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.methods.dcf'`.

- [ ] **Step 3: Implement `backend/quant/methods/dcf.py`**

```python
from __future__ import annotations


def project_fcf(revenue0: float, growth: float, fcf_margin: float, years: int) -> list[float]:
    """Compound revenue each year, then take FCF as a margin of revenue."""
    fcfs: list[float] = []
    rev = revenue0
    for _ in range(years):
        rev *= (1.0 + growth)
        fcfs.append(rev * fcf_margin)
    return fcfs


def dcf_value_per_share(
    revenue0: float,
    growth: float,
    fcf_margin: float,
    wacc: float,
    terminal_growth: float,
    shares: float,
    net_debt: float,
    years: int = 5,
) -> float:
    """Intrinsic equity value per share via 5y DCF + Gordon terminal value."""
    if wacc <= terminal_growth:
        raise ValueError("wacc must be greater than terminal_growth")
    if shares <= 0:
        raise ValueError("shares must be positive")

    fcfs = project_fcf(revenue0, growth, fcf_margin, years)
    pv_fcf = sum(fcf / (1.0 + wacc) ** (i + 1) for i, fcf in enumerate(fcfs))

    terminal_fcf = fcfs[-1] * (1.0 + terminal_growth)
    terminal_value = terminal_fcf / (wacc - terminal_growth)
    pv_terminal = terminal_value / (1.0 + wacc) ** years

    enterprise_value = pv_fcf + pv_terminal
    equity_value = enterprise_value - net_debt
    return equity_value / shares


def reverse_dcf_growth(
    price: float,
    revenue0: float,
    fcf_margin: float,
    wacc: float,
    terminal_growth: float,
    shares: float,
    net_debt: float,
    years: int = 5,
    lo: float = -0.50,
    hi: float = 1.00,
    tol: float = 1e-6,
    max_iter: int = 200,
) -> float:
    """Bisection: find the revenue growth implied by the market price."""
    def value_at(g: float) -> float:
        return dcf_value_per_share(
            revenue0, g, fcf_margin, wacc, terminal_growth, shares, net_debt, years
        )

    f_lo = value_at(lo) - price
    f_hi = value_at(hi) - price
    if f_lo == 0:
        return lo
    if f_hi == 0:
        return hi
    if f_lo * f_hi > 0:
        # price not bracketed; return the closer bound
        return lo if abs(f_lo) < abs(f_hi) else hi

    for _ in range(max_iter):
        mid = (lo + hi) / 2.0
        f_mid = value_at(mid) - price
        if abs(f_mid) < tol or (hi - lo) / 2.0 < tol:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2.0
```

Also create empty `backend/quant/methods/__init__.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_dcf.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/quant/methods/__init__.py backend/quant/methods/dcf.py backend/tests/test_dcf.py
git commit -m "feat: add DCF and reverse-DCF methods"
```

---

### Task 4: Multiples method

**Files:**
- Create: `backend/quant/methods/multiples.py`
- Test: `backend/tests/test_multiples.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_multiples.py`**

```python
import pytest
from quant.models import PeerMultiples
from quant.methods.multiples import multiples_values


def _peers():
    return PeerMultiples(ev_sales=10.0, ev_ebitda=20.0, pe=30.0, peg=2.0)


def test_ev_sales_converts_ev_to_equity_per_share():
    # EV = 10 * revenue(100) = 1000 ; equity = 1000 - net_debt(0) = 1000 ; /shares(10) = 100
    out = multiples_values(
        revenue=100.0, ebitda=50.0, eps=4.0, earnings_growth=0.15,
        shares=10.0, net_debt=0.0, peers=_peers(),
    )
    assert out["ev_sales"] == pytest.approx(100.0)


def test_ev_ebitda_and_net_debt():
    # EV = 20 * 50 = 1000 ; equity = 1000 - 200 = 800 ; /10 = 80
    out = multiples_values(100.0, 50.0, 4.0, 0.15, 10.0, 200.0, _peers())
    assert out["ev_ebitda"] == pytest.approx(80.0)


def test_pe_uses_eps_directly():
    # P/E value = pe(30) * eps(4) = 120
    out = multiples_values(100.0, 50.0, 4.0, 0.15, 10.0, 0.0, _peers())
    assert out["pe"] == pytest.approx(120.0)


def test_peg_value_is_pe_implied_by_growth():
    # fair P/E = peg(2.0) * growth_pct(15) = 30 ; value = 30 * eps(4) = 120
    out = multiples_values(100.0, 50.0, 4.0, 0.15, 10.0, 0.0, _peers())
    assert out["peg"] == pytest.approx(120.0)


def test_negative_ebitda_yields_none():
    out = multiples_values(100.0, -5.0, 4.0, 0.15, 10.0, 0.0, _peers())
    assert out["ev_ebitda"] is None


def test_negative_eps_yields_none_for_pe_and_peg():
    out = multiples_values(100.0, 50.0, -1.0, 0.15, 10.0, 0.0, _peers())
    assert out["pe"] is None
    assert out["peg"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_multiples.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.methods.multiples'`.

- [ ] **Step 3: Implement `backend/quant/methods/multiples.py`**

```python
from __future__ import annotations
from quant.models import PeerMultiples


def multiples_values(
    revenue: float,
    ebitda: float,
    eps: float,
    earnings_growth: float,
    shares: float,
    net_debt: float,
    peers: PeerMultiples,
) -> dict[str, float | None]:
    """Apply peer multiples to the target's metrics. None where not meaningful."""

    def ev_to_per_share(ev: float) -> float:
        return (ev - net_debt) / shares

    ev_sales = ev_to_per_share(peers.ev_sales * revenue) if revenue > 0 else None
    ev_ebitda = ev_to_per_share(peers.ev_ebitda * ebitda) if ebitda > 0 else None
    pe = peers.pe * eps if eps > 0 else None
    # PEG: fair P/E = peg * growth-in-percent-points; value = fair P/E * eps
    if eps > 0 and earnings_growth > 0:
        fair_pe = peers.peg * (earnings_growth * 100.0)
        peg = fair_pe * eps
    else:
        peg = None

    return {"ev_sales": ev_sales, "ev_ebitda": ev_ebitda, "pe": pe, "peg": peg}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_multiples.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/quant/methods/multiples.py backend/tests/test_multiples.py
git commit -m "feat: add relative-multiples method"
```

---

### Task 5: Blending and verdict

**Files:**
- Create: `backend/quant/blend.py`
- Test: `backend/tests/test_blend.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_blend.py`**

```python
import pytest
from quant.models import MethodEstimate
from quant.blend import blend_estimates, verdict, DEFAULT_WEIGHTS


def _est(method, value):
    return MethodEstimate(method=method, value_per_share=value)


def test_blend_is_weight_normalized_over_available_methods():
    # Only dcf (w=0.40) and ev_sales (w=0.20) present -> weights renormalize to 2/3, 1/3
    estimates = [_est("dcf", 120.0), _est("ev_sales", 90.0)]
    base = blend_estimates(estimates, DEFAULT_WEIGHTS)
    assert base == pytest.approx((0.40 * 120 + 0.20 * 90) / (0.40 + 0.20))


def test_blend_skips_none_values():
    estimates = [_est("dcf", 100.0), _est("ev_ebitda", None)]
    base = blend_estimates(estimates, DEFAULT_WEIGHTS)
    assert base == pytest.approx(100.0)


def test_blend_returns_none_when_nothing_available():
    estimates = [_est("dcf", None)]
    assert blend_estimates(estimates, DEFAULT_WEIGHTS) is None


def test_verdict_thresholds():
    assert verdict(upside_pct=0.10)[0] == "Undervalued"
    assert verdict(upside_pct=-0.10)[0] == "Overvalued"
    assert verdict(upside_pct=0.0)[0] == "Fairly valued"
    assert verdict(upside_pct=0.04)[0] == "Fairly valued"   # within +/-5% band
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_blend.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.blend'`.

- [ ] **Step 3: Implement `backend/quant/blend.py`**

```python
from __future__ import annotations
from quant.models import MethodEstimate

# Reverse DCF is diagnostic only; never blended.
DEFAULT_WEIGHTS: dict[str, float] = {
    "dcf": 0.40,
    "ev_sales": 0.20,
    "ev_ebitda": 0.20,
    "pe": 0.10,
    "peg": 0.10,
}

FAIR_BAND = 0.05  # +/-5% counts as fairly valued


def blend_estimates(
    estimates: list[MethodEstimate], weights: dict[str, float]
) -> float | None:
    """Weighted mean over methods that produced a value; weights renormalized."""
    num = 0.0
    denom = 0.0
    for est in estimates:
        if est.value_per_share is None:
            continue
        w = weights.get(est.method, 0.0)
        if w <= 0.0:
            continue
        num += w * est.value_per_share
        denom += w
    if denom == 0.0:
        return None
    return num / denom


def verdict(upside_pct: float) -> tuple[str, str]:
    """Return (label, css_hint)."""
    if upside_pct > FAIR_BAND:
        return ("Undervalued", "positive")
    if upside_pct < -FAIR_BAND:
        return ("Overvalued", "negative")
    return ("Fairly valued", "neutral")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_blend.py -v`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/quant/blend.py backend/tests/test_blend.py
git commit -m "feat: add blending and verdict"
```

---

### Task 6: Sensitivity grid

**Files:**
- Create: `backend/quant/sensitivity.py`
- Test: `backend/tests/test_sensitivity.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_sensitivity.py`**

```python
import pytest
from quant.models import Assumptions
from quant.sensitivity import sensitivity_grid


def _assumptions():
    return Assumptions(revenue_growth=0.10, fcf_margin=0.20, wacc=0.10, terminal_growth=0.03)


def test_grid_shape_and_axes():
    grid = sensitivity_grid(
        revenue0=1000.0, shares=10.0, net_debt=0.0, assumptions=_assumptions(),
        wacc_steps=3, growth_steps=3, wacc_delta=0.02, growth_delta=0.01,
    )
    assert len(grid["wacc_axis"]) == 3
    assert len(grid["terminal_growth_axis"]) == 3
    assert len(grid["values"]) == 3          # rows = wacc
    assert all(len(row) == 3 for row in grid["values"])


def test_lower_wacc_gives_higher_value():
    grid = sensitivity_grid(
        revenue0=1000.0, shares=10.0, net_debt=0.0, assumptions=_assumptions(),
        wacc_steps=3, growth_steps=1, wacc_delta=0.02, growth_delta=0.0,
    )
    col = [row[0] for row in grid["values"]]
    # wacc_axis ascending; value should be monotonically decreasing as wacc rises
    assert col[0] > col[1] > col[2]


def test_min_and_max_reported():
    grid = sensitivity_grid(
        revenue0=1000.0, shares=10.0, net_debt=0.0, assumptions=_assumptions(),
        wacc_steps=3, growth_steps=3, wacc_delta=0.02, growth_delta=0.01,
    )
    flat = [v for row in grid["values"] for v in row]
    assert grid["min"] == pytest.approx(min(flat))
    assert grid["max"] == pytest.approx(max(flat))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_sensitivity.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.sensitivity'`.

- [ ] **Step 3: Implement `backend/quant/sensitivity.py`**

```python
from __future__ import annotations
from quant.models import Assumptions
from quant.methods.dcf import dcf_value_per_share


def _centered_axis(center: float, steps: int, delta: float) -> list[float]:
    """Ascending axis of `steps` points centered on `center`, spacing `delta`."""
    if steps <= 1:
        return [center]
    start = center - delta * (steps - 1) / 2.0
    return [round(start + i * delta, 6) for i in range(steps)]


def sensitivity_grid(
    revenue0: float,
    shares: float,
    net_debt: float,
    assumptions: Assumptions,
    wacc_steps: int = 5,
    growth_steps: int = 5,
    wacc_delta: float = 0.01,
    growth_delta: float = 0.005,
) -> dict:
    """Fair value across WACC (rows) x terminal-growth (cols)."""
    wacc_axis = _centered_axis(assumptions.wacc, wacc_steps, wacc_delta)
    tg_axis = _centered_axis(assumptions.terminal_growth, growth_steps, growth_delta)

    values: list[list[float]] = []
    for wacc in wacc_axis:
        row: list[float] = []
        for tg in tg_axis:
            if wacc <= tg:
                row.append(float("nan"))
                continue
            row.append(
                dcf_value_per_share(
                    revenue0, assumptions.revenue_growth, assumptions.fcf_margin,
                    wacc, tg, shares, net_debt, assumptions.projection_years,
                )
            )
        values.append(row)

    flat = [v for row in values for v in row if v == v]  # drop nan
    return {
        "wacc_axis": wacc_axis,
        "terminal_growth_axis": tg_axis,
        "values": values,
        "min": min(flat) if flat else None,
        "max": max(flat) if flat else None,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_sensitivity.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/quant/sensitivity.py backend/tests/test_sensitivity.py
git commit -m "feat: add sensitivity grid"
```

---

### Task 7: Valuation orchestrator

**Files:**
- Create: `backend/quant/valuation.py`
- Create: `backend/tests/fixtures.py`
- Test: `backend/tests/test_valuation.py`

- [ ] **Step 1: Create shared fixture — `backend/tests/fixtures.py`**

```python
from quant.models import Assumptions, FinancialData, PeerMultiples


def sample_financials(ticker: str = "TEST") -> FinancialData:
    return FinancialData(
        ticker=ticker,
        name="Test Corp",
        exchange="NASDAQ",
        price=100.0,
        revenue=1000.0,
        ebitda=300.0,
        eps=4.0,
        fcf=200.0,
        shares=100.0,
        net_debt=0.0,
        earnings_growth=0.15,
        default_assumptions=Assumptions(
            revenue_growth=0.12, fcf_margin=0.20, wacc=0.09, terminal_growth=0.03
        ),
        peers=PeerMultiples(ev_sales=8.0, ev_ebitda=18.0, pe=25.0, peg=1.5),
    )
```

- [ ] **Step 2: Write failing tests — `backend/tests/test_valuation.py`**

```python
import pytest
from quant.valuation import Valuation
from quant.models import ValuationResult
from tests.fixtures import sample_financials


def test_value_returns_all_method_estimates():
    result = Valuation().value(sample_financials())
    methods = {e.method for e in result.estimates}
    assert {"dcf", "ev_sales", "ev_ebitda", "pe", "peg"} <= methods
    assert isinstance(result, ValuationResult)


def test_blended_range_orders_low_base_high():
    result = Valuation().value(sample_financials())
    assert result.blended_low <= result.blended_base <= result.blended_high


def test_upside_and_verdict_consistent():
    result = Valuation().value(sample_financials())
    assert result.upside_pct == pytest.approx(result.blended_base / result.price - 1)
    if result.upside_pct > 0.05:
        assert result.verdict == "Undervalued"


def test_override_assumptions_changes_dcf():
    fin = sample_financials()
    base = Valuation().value(fin)
    overridden = Valuation().value(fin, fin.default_assumptions.__class__(
        revenue_growth=0.30, fcf_margin=0.20, wacc=0.09, terminal_growth=0.03
    ))
    base_dcf = next(e.value_per_share for e in base.estimates if e.method == "dcf")
    over_dcf = next(e.value_per_share for e in overridden.estimates if e.method == "dcf")
    assert over_dcf > base_dcf  # higher growth -> higher DCF


def test_implied_growth_present():
    result = Valuation().value(sample_financials())
    assert result.implied_growth is not None
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_valuation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.valuation'`.

- [ ] **Step 4: Implement `backend/quant/valuation.py`**

```python
from __future__ import annotations
from quant.models import (
    Assumptions, FinancialData, MethodEstimate, ValuationResult,
)
from quant.methods.dcf import dcf_value_per_share, reverse_dcf_growth
from quant.methods.multiples import multiples_values
from quant.blend import blend_estimates, verdict, DEFAULT_WEIGHTS
from quant.sensitivity import sensitivity_grid

_NOTE_SKIPPED = "not computable from available fundamentals"


class Valuation:
    """Assembles method inputs from FinancialData, runs methods, blends."""

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = weights or DEFAULT_WEIGHTS

    def value(
        self, fin: FinancialData, assumptions: Assumptions | None = None
    ) -> ValuationResult:
        a = assumptions or fin.default_assumptions

        # DCF
        try:
            dcf = dcf_value_per_share(
                fin.revenue, a.revenue_growth, a.fcf_margin, a.wacc,
                a.terminal_growth, fin.shares, fin.net_debt, a.projection_years,
            )
            dcf_est = MethodEstimate("dcf", dcf)
        except ValueError as exc:
            dcf_est = MethodEstimate("dcf", None, note=str(exc))

        # Multiples
        mult = multiples_values(
            fin.revenue, fin.ebitda, fin.eps, fin.earnings_growth,
            fin.shares, fin.net_debt, fin.peers,
        )
        estimates = [dcf_est] + [
            MethodEstimate(m, v, "" if v is not None else _NOTE_SKIPPED)
            for m, v in mult.items()
        ]

        # Blend + range from sensitivity sweep
        base = blend_estimates(estimates, self.weights)
        if base is None:
            base = fin.price  # degenerate fallback: assume fair

        grid = sensitivity_grid(
            fin.revenue, fin.shares, fin.net_debt, a,
        )
        # Scale the blended base by how far the DCF moves across the grid.
        if dcf_est.value_per_share and grid["min"] and grid["max"]:
            lo = base * (grid["min"] / dcf_est.value_per_share)
            hi = base * (grid["max"] / dcf_est.value_per_share)
        else:
            lo, hi = base * 0.9, base * 1.1
        low, high = min(lo, hi), max(lo, hi)

        # Reverse DCF (diagnostic)
        try:
            implied = reverse_dcf_growth(
                fin.price, fin.revenue, a.fcf_margin, a.wacc,
                a.terminal_growth, fin.shares, fin.net_debt, a.projection_years,
            )
        except ValueError:
            implied = None

        upside = base / fin.price - 1.0
        label, _ = verdict(upside)

        return ValuationResult(
            ticker=fin.ticker,
            price=fin.price,
            estimates=estimates,
            blended_base=base,
            blended_low=low,
            blended_high=high,
            implied_growth=implied,
            upside_pct=upside,
            verdict=label,
            assumptions=a,
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_valuation.py -v`
Expected: PASS (5 passed).

- [ ] **Step 6: Run full suite**

Run: `pytest -q`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/quant/valuation.py backend/tests/fixtures.py backend/tests/test_valuation.py
git commit -m "feat: add valuation orchestrator"
```

---

### Task 8: Data provider interface + file cache

**Files:**
- Create: `backend/quant/data/__init__.py` (empty)
- Create: `backend/quant/data/provider.py`
- Create: `backend/quant/data/cache.py`
- Test: `backend/tests/test_cache.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_cache.py`**

```python
import time
from quant.data.cache import FileCache


def test_cache_round_trips_json(tmp_path):
    cache = FileCache(tmp_path, ttl_seconds=60)
    cache.set("k", {"a": 1})
    assert cache.get("k") == {"a": 1}


def test_cache_expires(tmp_path):
    cache = FileCache(tmp_path, ttl_seconds=0)
    cache.set("k", {"a": 1})
    time.sleep(0.01)
    assert cache.get("k") is None


def test_cache_miss_returns_none(tmp_path):
    cache = FileCache(tmp_path, ttl_seconds=60)
    assert cache.get("absent") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_cache.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.data.cache'`.

- [ ] **Step 3: Implement `backend/quant/data/cache.py`**

```python
from __future__ import annotations
import json
import time
from pathlib import Path
from typing import Any


class FileCache:
    """Tiny JSON file cache with TTL. Keys are hashed to filenames."""

    def __init__(self, directory: str | Path, ttl_seconds: int) -> None:
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl_seconds

    def _path(self, key: str) -> Path:
        safe = "".join(c if c.isalnum() else "_" for c in key)
        return self.dir / f"{safe}.json"

    def get(self, key: str) -> Any | None:
        p = self._path(key)
        if not p.exists():
            return None
        try:
            payload = json.loads(p.read_text())
        except (json.JSONDecodeError, OSError):
            return None
        if time.time() - payload["_ts"] > self.ttl:
            return None
        return payload["value"]

    def set(self, key: str, value: Any) -> None:
        p = self._path(key)
        p.write_text(json.dumps({"_ts": time.time(), "value": value}))
```

- [ ] **Step 4: Implement `backend/quant/data/provider.py`**

```python
from __future__ import annotations
from typing import Protocol
from quant.models import FinancialData


class DataError(Exception):
    """Raised when market data cannot be obtained for a ticker."""


# Curated peer sets by tech sub-industry (used to derive peer multiples).
PEER_SETS: dict[str, list[str]] = {
    "semis": ["NVDA", "AMD", "AVGO", "QCOM", "TXN"],
    "platforms": ["AAPL", "MSFT", "GOOGL", "AMZN", "META"],
    "software": ["CRM", "ADBE", "NOW", "ORCL", "SNOW"],
}

TICKER_INDUSTRY: dict[str, str] = {
    "NVDA": "semis", "AMD": "semis", "AVGO": "semis", "QCOM": "semis", "TXN": "semis",
    "AAPL": "platforms", "MSFT": "platforms", "GOOGL": "platforms",
    "AMZN": "platforms", "META": "platforms",
    "CRM": "software", "ADBE": "software", "NOW": "software",
    "ORCL": "software", "SNOW": "software",
}

DEFAULT_WATCHLIST = ["NVDA", "AAPL", "MSFT", "META", "GOOGL", "AMZN", "AVGO"]


class MarketDataProvider(Protocol):
    def fundamentals(self, ticker: str) -> FinancialData: ...
    def price_history(self, ticker: str, range_: str) -> list[dict]: ...
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_cache.py -v`
Expected: PASS (3 passed). Also create empty `backend/quant/data/__init__.py`.

- [ ] **Step 6: Commit**

```bash
git add backend/quant/data/__init__.py backend/quant/data/provider.py backend/quant/data/cache.py backend/tests/test_cache.py
git commit -m "feat: add data provider interface and file cache"
```

---

### Task 9: yfinance provider

**Files:**
- Create: `backend/quant/data/yfinance_provider.py`
- Test: `backend/tests/test_yfinance_provider.py`

> Note: tests must not hit the network. We test the pure transform
> (`build_financials`, `moving_average`) with synthetic inputs; the live
> `yfinance` calls are thin glue exercised manually.

- [ ] **Step 1: Write failing tests — `backend/tests/test_yfinance_provider.py`**

```python
import pytest
from quant.data.yfinance_provider import moving_average, peer_multiples_from


def test_moving_average_window():
    closes = [10, 12, 14, 16, 18]
    ma = moving_average(closes, window=2)
    assert ma[0] is None                       # not enough history yet
    assert ma[1] == pytest.approx(11.0)
    assert ma[4] == pytest.approx(17.0)


def test_peer_multiples_from_takes_medians():
    rows = [
        {"ev_sales": 8.0, "ev_ebitda": 18.0, "pe": 20.0, "peg": 1.0},
        {"ev_sales": 10.0, "ev_ebitda": 22.0, "pe": 30.0, "peg": 2.0},
        {"ev_sales": 12.0, "ev_ebitda": 20.0, "pe": 25.0, "peg": 1.5},
    ]
    peers = peer_multiples_from(rows)
    assert peers.ev_sales == pytest.approx(10.0)   # median
    assert peers.pe == pytest.approx(25.0)


def test_peer_multiples_ignores_none_and_nonpositive():
    rows = [
        {"ev_sales": None, "ev_ebitda": -5.0, "pe": 20.0, "peg": 1.0},
        {"ev_sales": 10.0, "ev_ebitda": 22.0, "pe": 30.0, "peg": 2.0},
    ]
    peers = peer_multiples_from(rows)
    assert peers.ev_sales == pytest.approx(10.0)
    assert peers.ev_ebitda == pytest.approx(22.0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_yfinance_provider.py -v`
Expected: FAIL — `ModuleNotFoundError`.

- [ ] **Step 3: Implement `backend/quant/data/yfinance_provider.py`**

```python
from __future__ import annotations
from statistics import median
import yfinance as yf

from quant.models import Assumptions, FinancialData, PeerMultiples
from quant.data.provider import (
    DataError, MarketDataProvider, PEER_SETS, TICKER_INDUSTRY,
)
from quant.data.cache import FileCache


def moving_average(closes: list[float], window: int) -> list[float | None]:
    """Simple trailing MA; None until the window is filled."""
    out: list[float | None] = []
    for i in range(len(closes)):
        if i + 1 < window:
            out.append(None)
        else:
            out.append(sum(closes[i + 1 - window : i + 1]) / window)
    return out


def peer_multiples_from(rows: list[dict]) -> PeerMultiples:
    """Median of each multiple across peers, ignoring None/non-positive."""
    def med(key: str, default: float) -> float:
        vals = [r[key] for r in rows if r.get(key) is not None and r[key] > 0]
        return median(vals) if vals else default

    return PeerMultiples(
        ev_sales=med("ev_sales", 5.0),
        ev_ebitda=med("ev_ebitda", 15.0),
        pe=med("pe", 20.0),
        peg=med("peg", 1.5),
    )


class YFinanceProvider:
    """MarketDataProvider backed by Yahoo Finance, with on-disk caching."""

    def __init__(self, cache: FileCache, price_cache: FileCache) -> None:
        self.cache = cache
        self.price_cache = price_cache

    def _multiples_row(self, info: dict) -> dict:
        return {
            "ev_sales": info.get("enterpriseToRevenue"),
            "ev_ebitda": info.get("enterpriseToEbitda"),
            "pe": info.get("trailingPE"),
            "peg": info.get("trailingPegRatio"),
        }

    def fundamentals(self, ticker: str) -> FinancialData:
        cached = self.cache.get(ticker)
        if cached is not None:
            return _financials_from_cache(cached)
        try:
            info = yf.Ticker(ticker).info
        except Exception as exc:  # noqa: BLE001 - yfinance raises broad errors
            raise DataError(f"could not fetch {ticker}: {exc}") from exc
        if not info or info.get("regularMarketPrice") is None:
            raise DataError(f"no data for {ticker}")

        industry = TICKER_INDUSTRY.get(ticker, "platforms")
        peer_rows = []
        for peer in PEER_SETS[industry]:
            if peer == ticker:
                continue
            try:
                peer_rows.append(self._multiples_row(yf.Ticker(peer).info))
            except Exception:  # noqa: BLE001
                continue
        peers = peer_multiples_from(peer_rows)

        fin = FinancialData(
            ticker=ticker,
            name=info.get("shortName", ticker),
            exchange=info.get("fullExchangeName", ""),
            price=float(info["regularMarketPrice"]),
            revenue=float(info.get("totalRevenue") or 0.0),
            ebitda=float(info.get("ebitda") or 0.0),
            eps=float(info.get("trailingEps") or 0.0),
            fcf=float(info.get("freeCashflow") or 0.0),
            shares=float(info.get("sharesOutstanding") or 1.0),
            net_debt=float((info.get("totalDebt") or 0.0) - (info.get("totalCash") or 0.0)),
            earnings_growth=float(info.get("earningsGrowth") or 0.10),
            default_assumptions=_default_assumptions(info),
            peers=peers,
        )
        self.cache.set(ticker, _financials_to_cache(fin))
        return fin

    def price_history(self, ticker: str, range_: str = "1y") -> list[dict]:
        cached = self.price_cache.get(f"{ticker}_{range_}")
        if cached is not None:
            return cached
        try:
            hist = yf.Ticker(ticker).history(period=range_)
        except Exception as exc:  # noqa: BLE001
            raise DataError(f"could not fetch prices for {ticker}: {exc}") from exc
        closes = [round(float(c), 4) for c in hist["Close"].tolist()]
        dates = [d.strftime("%Y-%m-%d") for d in hist.index]
        ma50 = moving_average(closes, 50)
        series = [
            {"date": d, "close": c, "ma50": m}
            for d, c, m in zip(dates, closes, ma50)
        ]
        self.price_cache.set(f"{ticker}_{range_}", series)
        return series


def _default_assumptions(info: dict) -> Assumptions:
    growth = info.get("revenueGrowth")
    fcf = info.get("freeCashflow") or 0.0
    rev = info.get("totalRevenue") or 1.0
    return Assumptions(
        revenue_growth=float(growth) if growth else 0.12,
        fcf_margin=max(0.05, min(0.45, fcf / rev)) if rev else 0.20,
        wacc=0.09,
        terminal_growth=0.03,
    )


def _financials_to_cache(fin: FinancialData) -> dict:
    d = {k: getattr(fin, k) for k in (
        "ticker", "name", "exchange", "price", "revenue", "ebitda", "eps",
        "fcf", "shares", "net_debt", "earnings_growth",
    )}
    d["default_assumptions"] = fin.default_assumptions.to_dict()
    d["peers"] = {
        "ev_sales": fin.peers.ev_sales, "ev_ebitda": fin.peers.ev_ebitda,
        "pe": fin.peers.pe, "peg": fin.peers.peg,
    }
    return d


def _financials_from_cache(d: dict) -> FinancialData:
    return FinancialData(
        default_assumptions=Assumptions(**d["default_assumptions"]),
        peers=PeerMultiples(**d["peers"]),
        **{k: d[k] for k in (
            "ticker", "name", "exchange", "price", "revenue", "ebitda", "eps",
            "fcf", "shares", "net_debt", "earnings_growth",
        )},
    )


_ = MarketDataProvider  # interface conformance is structural
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_yfinance_provider.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Manual smoke (network — optional, not in CI)**

Run:
```bash
python -c "from quant.data.cache import FileCache; from quant.data.yfinance_provider import YFinanceProvider; p=YFinanceProvider(FileCache('.cache/fund',3600), FileCache('.cache/px',300)); f=p.fundamentals('AAPL'); print(f.name, f.price)"
```
Expected: prints Apple's name and a price (requires internet).

- [ ] **Step 6: Commit**

```bash
git add backend/quant/data/yfinance_provider.py backend/tests/test_yfinance_provider.py
git commit -m "feat: add yfinance provider with caching"
```

---

### Task 10: FastAPI app

**Files:**
- Create: `backend/quant/api/__init__.py` (empty)
- Create: `backend/quant/api/app.py`
- Test: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing tests — `backend/tests/test_api.py`**

```python
import pytest
from fastapi.testclient import TestClient
from quant.api.app import create_app
from quant.data.provider import DataError
from tests.fixtures import sample_financials


class StubProvider:
    def __init__(self):
        self.fin = sample_financials("NVDA")

    def fundamentals(self, ticker):
        if ticker == "BAD":
            raise DataError("no data for BAD")
        return self.fin

    def price_history(self, ticker, range_="1y"):
        return [
            {"date": "2026-01-01", "close": 90.0, "ma50": None},
            {"date": "2026-01-02", "close": 100.0, "ma50": 95.0},
        ]


@pytest.fixture
def client():
    return TestClient(create_app(provider=StubProvider()))


def test_quote_endpoint(client):
    r = client.get("/api/quote/NVDA")
    assert r.status_code == 200
    assert r.json()["price"] == 100.0


def test_prices_endpoint(client):
    r = client.get("/api/prices/NVDA?range=1y")
    assert r.status_code == 200
    assert r.json()[1]["ma50"] == 95.0


def test_valuation_endpoint_default(client):
    r = client.get("/api/valuation/NVDA")
    assert r.status_code == 200
    body = r.json()
    assert "blended_base" in body
    assert {e["method"] for e in body["estimates"]} >= {"dcf", "ev_sales"}


def test_valuation_post_overrides_assumptions(client):
    payload = {"revenue_growth": 0.30, "fcf_margin": 0.20, "wacc": 0.09, "terminal_growth": 0.03}
    r = client.post("/api/valuation/NVDA", json=payload)
    assert r.status_code == 200
    assert r.json()["assumptions"]["revenue_growth"] == 0.30


def test_unknown_ticker_returns_404(client):
    r = client.get("/api/valuation/BAD")
    assert r.status_code == 404


def test_invalid_assumptions_returns_400(client):
    payload = {"revenue_growth": 0.10, "fcf_margin": 0.20, "wacc": 0.03, "terminal_growth": 0.05}
    r = client.post("/api/valuation/NVDA", json=payload)
    assert r.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quant.api.app'`.

- [ ] **Step 3: Implement `backend/quant/api/app.py`**

```python
from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from quant.models import Assumptions
from quant.valuation import Valuation
from quant.data.provider import DataError, DEFAULT_WATCHLIST


class AssumptionsBody(BaseModel):
    revenue_growth: float
    fcf_margin: float
    wacc: float
    terminal_growth: float
    projection_years: int = 5


def create_app(provider) -> FastAPI:
    app = FastAPI(title="Quant Valuation API")
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
    )
    engine = Valuation()

    def _fundamentals(ticker: str):
        try:
            return provider.fundamentals(ticker.upper())
        except DataError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    @app.get("/api/tickers")
    def tickers():
        out = []
        for t in DEFAULT_WATCHLIST:
            try:
                fin = provider.fundamentals(t)
                res = engine.value(fin)
                out.append({"ticker": t, "upside_pct": res.upside_pct, "verdict": res.verdict})
            except DataError:
                continue
        return out

    @app.get("/api/quote/{ticker}")
    def quote(ticker: str):
        fin = _fundamentals(ticker)
        return {"ticker": fin.ticker, "name": fin.name, "exchange": fin.exchange, "price": fin.price}

    @app.get("/api/prices/{ticker}")
    def prices(ticker: str, range: str = "1y"):
        try:
            return provider.price_history(ticker.upper(), range)
        except DataError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    @app.get("/api/valuation/{ticker}")
    def valuation(ticker: str):
        fin = _fundamentals(ticker)
        return engine.value(fin).to_dict()

    @app.post("/api/valuation/{ticker}")
    def valuation_override(ticker: str, body: AssumptionsBody):
        fin = _fundamentals(ticker)
        if body.wacc <= body.terminal_growth:
            raise HTTPException(status_code=400, detail="wacc must exceed terminal_growth")
        a = Assumptions(**body.model_dump())
        return engine.value(fin, a).to_dict()

    return app
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_api.py -v`
Expected: PASS (6 passed). Also create empty `backend/quant/api/__init__.py`.

- [ ] **Step 5: Run full suite**

Run: `pytest -q`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/quant/api/__init__.py backend/quant/api/app.py backend/tests/test_api.py
git commit -m "feat: add FastAPI app"
```

---

### Task 11: Runnable server entrypoint

**Files:**
- Create: `backend/quant/api/main.py`

- [ ] **Step 1: Implement `backend/quant/api/main.py`**

```python
from __future__ import annotations
from quant.api.app import create_app
from quant.data.cache import FileCache
from quant.data.yfinance_provider import YFinanceProvider

provider = YFinanceProvider(
    cache=FileCache(".cache/fundamentals", ttl_seconds=6 * 3600),
    price_cache=FileCache(".cache/prices", ttl_seconds=300),
)
app = create_app(provider=provider)
```

- [ ] **Step 2: Smoke-run the server (manual, requires internet)**

Run (from `backend/`): `uvicorn quant.api.main:app --port 8000`
Then in another shell: `curl http://localhost:8000/api/quote/AAPL`
Expected: JSON with Apple's price. Stop the server with Ctrl-C.

- [ ] **Step 3: Commit**

```bash
git add backend/quant/api/main.py
git commit -m "feat: add server entrypoint"
```

---

## Self-Review Notes

- **Spec coverage:** DCF (Task 3), multiples (Task 4), reverse-DCF (Task 3),
  blend + verdict (Task 5), sensitivity grid (Task 6), orchestrator (Task 7),
  data provider + cache + peer sets (Tasks 8-9), all API endpoints incl.
  POST-override sliders and watchlist (Task 10) — all spec sections covered.
- **Frontend** (chart, watchlist UI, sliders, breakdown bar) is Plan 2.
- **Type consistency:** `Assumptions`, `FinancialData`, `PeerMultiples`,
  `MethodEstimate`, `ValuationResult` defined in Task 2 and used unchanged
  thereafter; method names ("dcf", "ev_sales", "ev_ebitda", "pe", "peg")
  consistent across multiples, blend weights, and tests.
- **No network in tests:** all suites use pure functions or `StubProvider`;
  live yfinance paths are exercised only via manual smoke steps.
