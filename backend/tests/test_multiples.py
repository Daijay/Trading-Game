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
