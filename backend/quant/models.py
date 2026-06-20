from __future__ import annotations
from dataclasses import dataclass, asdict
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
