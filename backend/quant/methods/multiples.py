from __future__ import annotations
from quant.models import PeerMultiples


def multiples_values(
    revenue: float,
    ebitda: float,
    eps: float,
    earnings_growth: float,
    shares: float,
    net_debt: float,
    peers: PeerMultiples,
) -> dict[str, float | None]:
    """Apply peer multiples to the target's metrics. None where not meaningful."""

    def ev_to_per_share(ev: float) -> float:
        return (ev - net_debt) / shares

    ev_sales = ev_to_per_share(peers.ev_sales * revenue) if revenue > 0 else None
    ev_ebitda = ev_to_per_share(peers.ev_ebitda * ebitda) if ebitda > 0 else None
    pe = peers.pe * eps if eps > 0 else None
    # PEG: fair P/E = peg * growth-in-percent-points; value = fair P/E * eps
    if eps > 0 and earnings_growth > 0:
        fair_pe = peers.peg * (earnings_growth * 100.0)
        peg = fair_pe * eps
    else:
        peg = None

    return {"ev_sales": ev_sales, "ev_ebitda": ev_ebitda, "pe": pe, "peg": peg}
