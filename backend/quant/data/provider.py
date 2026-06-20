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
