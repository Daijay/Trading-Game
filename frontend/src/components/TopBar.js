import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function TopBar({ quote, result }) {
    const tone = result === null ? "neutral"
        : result.upside_pct > 0.05 ? "positive"
            : result.upside_pct < -0.05 ? "negative" : "neutral";
    return (_jsxs("div", { className: "topbar", children: [_jsx("strong", { className: "symbol", children: quote?.ticker ?? "—" }), _jsxs("span", { className: "muted", children: [quote?.name, " \u00B7 ", quote?.exchange] }), _jsx("span", { className: "price", children: quote ? `$${quote.price.toFixed(2)}` : "" }), _jsx("span", { className: "spacer" }), result && (_jsxs("span", { className: `verdict-badge ${tone}`, children: ["$", Math.round(result.blended_base), " \u00B7 ", result.upside_pct >= 0 ? "+" : "", (result.upside_pct * 100).toFixed(1), "% ", result.verdict.toUpperCase()] }))] }));
}
