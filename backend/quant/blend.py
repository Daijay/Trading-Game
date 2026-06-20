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
