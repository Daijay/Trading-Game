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
