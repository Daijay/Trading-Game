from __future__ import annotations
from statistics import median
import yfinance as yf

from quant.models import Assumptions, FinancialData, PeerMultiples
from quant.data.provider import (
    DataError, MarketDataProvider, PEER_SETS, TICKER_INDUSTRY,
)
from quant.data.cache import FileCache


def moving_average(closes: list[float], window: int) -> list[float | None]:
    """Simple trailing MA; None until the window is filled."""
    out: list[float | None] = []
    for i in range(len(closes)):
        if i + 1 < window:
            out.append(None)
        else:
            out.append(sum(closes[i + 1 - window : i + 1]) / window)
    return out


def peer_multiples_from(rows: list[dict]) -> PeerMultiples:
    """Median of each multiple across peers, ignoring None/non-positive."""
    def med(key: str, default: float) -> float:
        vals = [r[key] for r in rows if r.get(key) is not None and r[key] > 0]
        return median(vals) if vals else default

    return PeerMultiples(
        ev_sales=med("ev_sales", 5.0),
        ev_ebitda=med("ev_ebitda", 15.0),
        pe=med("pe", 20.0),
        peg=med("peg", 1.5),
    )


class YFinanceProvider:
    """MarketDataProvider backed by Yahoo Finance, with on-disk caching."""

    def __init__(self, cache: FileCache, price_cache: FileCache) -> None:
        self.cache = cache
        self.price_cache = price_cache

    def _multiples_row(self, info: dict) -> dict:
        return {
            "ev_sales": info.get("enterpriseToRevenue"),
            "ev_ebitda": info.get("enterpriseToEbitda"),
            "pe": info.get("trailingPE"),
            "peg": info.get("trailingPegRatio"),
        }

    def fundamentals(self, ticker: str) -> FinancialData:
        cached = self.cache.get(ticker)
        if cached is not None:
            return _financials_from_cache(cached)
        try:
            info = yf.Ticker(ticker).info
        except Exception as exc:  # noqa: BLE001 - yfinance raises broad errors
            raise DataError(f"could not fetch {ticker}: {exc}") from exc
        if not info or info.get("regularMarketPrice") is None:
            raise DataError(f"no data for {ticker}")

        industry = TICKER_INDUSTRY.get(ticker, "platforms")
        peer_rows = []
        for peer in PEER_SETS[industry]:
            if peer == ticker:
                continue
            try:
                peer_rows.append(self._multiples_row(yf.Ticker(peer).info))
            except Exception:  # noqa: BLE001
                continue
        peers = peer_multiples_from(peer_rows)

        fin = FinancialData(
            ticker=ticker,
            name=info.get("shortName", ticker),
            exchange=info.get("fullExchangeName", ""),
            price=float(info["regularMarketPrice"]),
            revenue=float(info.get("totalRevenue") or 0.0),
            ebitda=float(info.get("ebitda") or 0.0),
            eps=float(info.get("trailingEps") or 0.0),
            fcf=float(info.get("freeCashflow") or 0.0),
            shares=float(info.get("sharesOutstanding") or 1.0),
            net_debt=float((info.get("totalDebt") or 0.0) - (info.get("totalCash") or 0.0)),
            earnings_growth=float(info.get("earningsGrowth") or 0.10),
            default_assumptions=_default_assumptions(info),
            peers=peers,
        )
        self.cache.set(ticker, _financials_to_cache(fin))
        return fin

    def price_history(self, ticker: str, range_: str = "1y") -> list[dict]:
        cached = self.price_cache.get(f"{ticker}_{range_}")
        if cached is not None:
            return cached
        try:
            hist = yf.Ticker(ticker).history(period=range_)
        except Exception as exc:  # noqa: BLE001
            raise DataError(f"could not fetch prices for {ticker}: {exc}") from exc
        closes = [round(float(c), 4) for c in hist["Close"].tolist()]
        dates = [d.strftime("%Y-%m-%d") for d in hist.index]
        ma50 = moving_average(closes, 50)
        series = [
            {"date": d, "close": c, "ma50": m}
            for d, c, m in zip(dates, closes, ma50)
        ]
        self.price_cache.set(f"{ticker}_{range_}", series)
        return series


def _default_assumptions(info: dict) -> Assumptions:
    growth = info.get("revenueGrowth")
    fcf = info.get("freeCashflow") or 0.0
    rev = info.get("totalRevenue") or 1.0
    return Assumptions(
        revenue_growth=float(growth) if growth else 0.12,
        fcf_margin=max(0.05, min(0.45, fcf / rev)) if rev else 0.20,
        wacc=0.09,
        terminal_growth=0.03,
    )


def _financials_to_cache(fin: FinancialData) -> dict:
    d = {k: getattr(fin, k) for k in (
        "ticker", "name", "exchange", "price", "revenue", "ebitda", "eps",
        "fcf", "shares", "net_debt", "earnings_growth",
    )}
    d["default_assumptions"] = fin.default_assumptions.to_dict()
    d["peers"] = {
        "ev_sales": fin.peers.ev_sales, "ev_ebitda": fin.peers.ev_ebitda,
        "pe": fin.peers.pe, "peg": fin.peers.peg,
    }
    return d


def _financials_from_cache(d: dict) -> FinancialData:
    return FinancialData(
        default_assumptions=Assumptions(**d["default_assumptions"]),
        peers=PeerMultiples(**d["peers"]),
        **{k: d[k] for k in (
            "ticker", "name", "exchange", "price", "revenue", "ebitda", "eps",
            "fcf", "shares", "net_debt", "earnings_growth",
        )},
    )


_ = MarketDataProvider  # interface conformance is structural
