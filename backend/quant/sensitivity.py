from __future__ import annotations
from quant.models import Assumptions
from quant.methods.dcf import dcf_value_per_share


def _centered_axis(center: float, steps: int, delta: float) -> list[float]:
    """Ascending axis of `steps` points centered on `center`, spacing `delta`."""
    if steps <= 1:
        return [center]
    start = center - delta * (steps - 1) / 2.0
    return [round(start + i * delta, 6) for i in range(steps)]


def sensitivity_grid(
    revenue0: float,
    shares: float,
    net_debt: float,
    assumptions: Assumptions,
    wacc_steps: int = 5,
    growth_steps: int = 5,
    wacc_delta: float = 0.01,
    growth_delta: float = 0.005,
) -> dict:
    """Fair value across WACC (rows) x terminal-growth (cols)."""
    wacc_axis = _centered_axis(assumptions.wacc, wacc_steps, wacc_delta)
    tg_axis = _centered_axis(assumptions.terminal_growth, growth_steps, growth_delta)

    values: list[list[float]] = []
    for wacc in wacc_axis:
        row: list[float] = []
        for tg in tg_axis:
            if wacc <= tg:
                row.append(float("nan"))
                continue
            row.append(
                dcf_value_per_share(
                    revenue0, assumptions.revenue_growth, assumptions.fcf_margin,
                    wacc, tg, shares, net_debt, assumptions.projection_years,
                )
            )
        values.append(row)

    flat = [v for row in values for v in row if v == v]  # drop nan
    return {
        "wacc_axis": wacc_axis,
        "terminal_growth_axis": tg_axis,
        "values": values,
        "min": min(flat) if flat else None,
        "max": max(flat) if flat else None,
    }
