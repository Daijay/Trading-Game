import pytest
from quant.models import Assumptions
from quant.sensitivity import sensitivity_grid


def _assumptions():
    return Assumptions(revenue_growth=0.10, fcf_margin=0.20, wacc=0.10, terminal_growth=0.03)


def test_grid_shape_and_axes():
    grid = sensitivity_grid(
        revenue0=1000.0, shares=10.0, net_debt=0.0, assumptions=_assumptions(),
        wacc_steps=3, growth_steps=3, wacc_delta=0.02, growth_delta=0.01,
    )
    assert len(grid["wacc_axis"]) == 3
    assert len(grid["terminal_growth_axis"]) == 3
    assert len(grid["values"]) == 3          # rows = wacc
    assert all(len(row) == 3 for row in grid["values"])


def test_lower_wacc_gives_higher_value():
    grid = sensitivity_grid(
        revenue0=1000.0, shares=10.0, net_debt=0.0, assumptions=_assumptions(),
        wacc_steps=3, growth_steps=1, wacc_delta=0.02, growth_delta=0.0,
    )
    col = [row[0] for row in grid["values"]]
    # wacc_axis ascending; value should be monotonically decreasing as wacc rises
    assert col[0] > col[1] > col[2]


def test_min_and_max_reported():
    grid = sensitivity_grid(
        revenue0=1000.0, shares=10.0, net_debt=0.0, assumptions=_assumptions(),
        wacc_steps=3, growth_steps=3, wacc_delta=0.02, growth_delta=0.01,
    )
    flat = [v for row in grid["values"] for v in row]
    assert grid["min"] == pytest.approx(min(flat))
    assert grid["max"] == pytest.approx(max(flat))
