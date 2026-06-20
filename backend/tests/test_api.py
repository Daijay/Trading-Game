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
