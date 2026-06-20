from quant.models import Assumptions, FinancialData, PeerMultiples


def sample_financials(ticker: str = "TEST") -> FinancialData:
    return FinancialData(
        ticker=ticker,
        name="Test Corp",
        exchange="NASDAQ",
        price=100.0,
        revenue=1000.0,
        ebitda=300.0,
        eps=4.0,
        fcf=200.0,
        shares=100.0,
        net_debt=0.0,
        earnings_growth=0.15,
        default_assumptions=Assumptions(
            revenue_growth=0.12, fcf_margin=0.20, wacc=0.09, terminal_growth=0.03
        ),
        peers=PeerMultiples(ev_sales=8.0, ev_ebitda=18.0, pe=25.0, peg=1.5),
    )
