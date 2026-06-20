import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AssumptionsPanel from "../src/components/AssumptionsPanel";
import type { Assumptions } from "../src/types";

const base: Assumptions = {
  revenue_growth: 0.18, fcf_margin: 0.3, wacc: 0.09, terminal_growth: 0.03, projection_years: 5,
};

describe("AssumptionsPanel", () => {
  it("renders a slider per assumption with current values", () => {
    render(<AssumptionsPanel assumptions={base} onChange={() => {}} />);
    expect(screen.getByLabelText(/Rev growth/i)).toHaveValue("0.18");
    expect(screen.getByLabelText(/WACC/i)).toHaveValue("0.09");
  });

  it("calls onChange with updated assumptions when a slider moves", () => {
    const onChange = vi.fn();
    render(<AssumptionsPanel assumptions={base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Rev growth/i), { target: { value: "0.25" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ revenue_growth: 0.25, wacc: 0.09 }),
    );
  });
});
