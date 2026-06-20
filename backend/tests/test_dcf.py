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
