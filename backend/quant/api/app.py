from __future__ import annotations
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from quant.models import Assumptions
from quant.valuation import Valuation
from quant.data.provider import DataError, DEFAULT_WATCHLIST


class AssumptionsBody(BaseModel):
    revenue_growth: float
    fcf_margin: float
    wacc: float
    terminal_growth: float
    projection_years: int = 5


def create_app(provider) -> FastAPI:
    app = FastAPI(title="Quant Valuation API")
    app.add_middleware(
        CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
    )
    engine = Valuation()

    def _fundamentals(ticker: str):
        try:
            return provider.fundamentals(ticker.upper())
        except DataError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    @app.get("/api/tickers")
    def tickers():
        out = []
        for t in DEFAULT_WATCHLIST:
            try:
                fin = provider.fundamentals(t)
                res = engine.value(fin)
                out.append({"ticker": t, "upside_pct": res.upside_pct, "verdict": res.verdict})
            except DataError:
                continue
        return out

    @app.get("/api/quote/{ticker}")
    def quote(ticker: str):
        fin = _fundamentals(ticker)
        return {"ticker": fin.ticker, "name": fin.name, "exchange": fin.exchange, "price": fin.price}

    @app.get("/api/prices/{ticker}")
    def prices(ticker: str, range: str = "1y"):
        try:
            return provider.price_history(ticker.upper(), range)
        except DataError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    @app.get("/api/valuation/{ticker}")
    def valuation(ticker: str):
        fin = _fundamentals(ticker)
        return engine.value(fin).to_dict()

    @app.post("/api/valuation/{ticker}")
    def valuation_override(ticker: str, body: AssumptionsBody):
        fin = _fundamentals(ticker)
        if body.wacc <= body.terminal_growth:
            raise HTTPException(status_code=400, detail="wacc must exceed terminal_growth")
        a = Assumptions(**body.model_dump())
        return engine.value(fin, a).to_dict()

    return app
