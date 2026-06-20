import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import VolatilityBar from "../src/components/VolatilityBar";

describe("VolatilityBar", () => {
  it("renders levels 1 to 4 and labels only 4 as IPO", () => {
    render(<VolatilityBar level={1} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /IPO/ })).toBeInTheDocument();
  });

  it("reports the chosen level", () => {
    const onChange = vi.fn();
    render(<VolatilityBar level={1} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /IPO/ }));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
