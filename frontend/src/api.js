async function get(url) {
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `request failed: ${res.status}`);
    }
    return res.json();
}
export const getTickers = () => get("/api/tickers");
export const getQuote = (t) => get(`/api/quote/${t}`);
export const getPrices = (t, range = "1y") => get(`/api/prices/${t}?range=${range}`);
export const getValuation = (t) => get(`/api/valuation/${t}`);
export async function postValuation(t, a) {
    const res = await fetch(`/api/valuation/${t}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `request failed: ${res.status}`);
    }
    return res.json();
}
