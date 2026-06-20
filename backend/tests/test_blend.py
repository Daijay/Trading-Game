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
