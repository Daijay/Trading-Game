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
