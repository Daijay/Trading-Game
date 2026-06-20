import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const ROWS = [
    { key: "revenue_growth", label: "Rev growth (5y)", min: -0.1, max: 0.6, step: 0.01, pct: true },
    { key: "fcf_margin", label: "FCF margin", min: 0.0, max: 0.6, step: 0.01, pct: true },
    { key: "wacc", label: "WACC", min: 0.05, max: 0.18, step: 0.005, pct: true },
    { key: "terminal_growth", label: "Terminal growth", min: 0.0, max: 0.05, step: 0.005, pct: true },
];
export default function AssumptionsPanel({ assumptions, onChange }) {
    return (_jsxs("div", { className: "assumptions", children: [_jsx("div", { className: "panel-title", children: "DCF ASSUMPTIONS" }), ROWS.map((r) => {
                const value = assumptions[r.key];
                return (_jsxs("div", { className: "slider-row", children: [_jsxs("label", { htmlFor: r.key, children: [r.label, _jsx("span", { className: "slider-value", children: r.pct ? `${(value * 100).toFixed(1)}%` : value })] }), _jsx("input", { id: r.key, "aria-label": r.label, type: "range", min: r.min, max: r.max, step: r.step, value: value, onChange: (e) => onChange({ ...assumptions, [r.key]: Number(e.target.value) }) })] }, r.key));
            }), _jsx("div", { className: "panel-foot", children: "\u21BB band & verdict recompute live" })] }));
}
