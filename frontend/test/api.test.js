import { describe, it, expect, vi, beforeEach } from "vitest";
import { getValuation, postValuation } from "../src/api";
beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
});
describe("api client", () => {
    it("getValuation hits the right URL", async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ ticker: "NVDA" }) });
        const res = await getValuation("NVDA");
        expect(fetch).toHaveBeenCalledWith("/api/valuation/NVDA");
        expect(res.ticker).toBe("NVDA");
    });
    it("postValuation sends assumptions as JSON body", async () => {
        fetch.mockResolvedValue({ ok: true, json: async () => ({ ticker: "NVDA" }) });
        const a = { revenue_growth: 0.2, fcf_margin: 0.3, wacc: 0.09, terminal_growth: 0.03, projection_years: 5 };
        await postValuation("NVDA", a);
        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe("/api/valuation/NVDA");
        expect(opts.method).toBe("POST");
        expect(JSON.parse(opts.body)).toMatchObject({ revenue_growth: 0.2 });
    });
    it("throws on non-ok response", async () => {
        fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: "no data" }) });
        await expect(getValuation("BAD")).rejects.toThrow(/no data/);
    });
});
