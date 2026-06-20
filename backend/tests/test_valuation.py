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
