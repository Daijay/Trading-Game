from __future__ import annotations


def project_fcf(revenue0: float, growth: float, fcf_margin: float, years: int) -> list[float]:
    """Compound revenue each year, then take FCF as a margin of revenue."""
    fcfs: list[float] = []
    rev = revenue0
    for _ in range(years):
        rev *= (1.0 + growth)
        fcfs.append(rev * fcf_margin)
    return fcfs


def dcf_value_per_share(
    revenue0: float,
    growth: float,
    fcf_margin: float,
    wacc: float,
    terminal_growth: float,
    shares: float,
    net_debt: float,
    years: int = 5,
) -> float:
    """Intrinsic equity value per share via 5y DCF + Gordon terminal value."""
    if wacc <= terminal_growth:
        raise ValueError("wacc must be greater than terminal_growth")
    if shares <= 0:
        raise ValueError("shares must be positive")

    fcfs = project_fcf(revenue0, growth, fcf_margin, years)
    pv_fcf = sum(fcf / (1.0 + wacc) ** (i + 1) for i, fcf in enumerate(fcfs))

    terminal_fcf = fcfs[-1] * (1.0 + terminal_growth)
    terminal_value = terminal_fcf / (wacc - terminal_growth)
    pv_terminal = terminal_value / (1.0 + wacc) ** years

    enterprise_value = pv_fcf + pv_terminal
    equity_value = enterprise_value - net_debt
    return equity_value / shares


def reverse_dcf_growth(
    price: float,
    revenue0: float,
    fcf_margin: float,
    wacc: float,
    terminal_growth: float,
    shares: float,
    net_debt: float,
    years: int = 5,
    lo: float = -0.50,
    hi: float = 1.00,
    tol: float = 1e-6,
    max_iter: int = 200,
) -> float:
    """Bisection: find the revenue growth implied by the market price."""
    def value_at(g: float) -> float:
        return dcf_value_per_share(
            revenue0, g, fcf_margin, wacc, terminal_growth, shares, net_debt, years
        )

    f_lo = value_at(lo) - price
    f_hi = value_at(hi) - price
    if f_lo == 0:
        return lo
    if f_hi == 0:
        return hi
    if f_lo * f_hi > 0:
        # price not bracketed; return the closer bound
        return lo if abs(f_lo) < abs(f_hi) else hi

    for _ in range(max_iter):
        mid = (lo + hi) / 2.0
        f_mid = value_at(mid) - price
        if abs(f_mid) < tol or (hi - lo) / 2.0 < tol:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2.0
