import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const LABELS = {
    dcf: "DCF", ev_sales: "EV/Sales", ev_ebitda: "EV/EBITDA", pe: "P/E", peg: "PEG",
};
function fmt(v) {
    return v === null ? "—" : `$${Math.round(v)}`;
}
export default function BreakdownBar({ result }) {
    return (_jsxs("div", { className: "breakdown", children: [result.estimates.map((e) => (_jsxs("div", { className: "cell", children: [_jsx("div", { className: "cell-label", children: LABELS[e.method] ?? e.method }), _jsx("div", { className: "cell-value", children: fmt(e.value_per_share) })] }, e.method))), _jsxs("div", { className: "cell", children: [_jsx("div", { className: "cell-label", children: "Reverse DCF" }), _jsx("div", { className: "cell-value implied", children: result.implied_growth === null ? "—" : `${Math.round(result.implied_growth * 100)}% implied` })] }), _jsxs("div", { className: "cell blended", children: [_jsx("div", { className: "cell-label", children: "Blended Fair Value" }), _jsxs("div", { className: "cell-value", children: ["$", Math.round(result.blended_base), " ", _jsxs("span", { className: "range", children: ["(", Math.round(result.blended_low), "\u2013", Math.round(result.blended_high), ")"] })] })] })] }));
}
