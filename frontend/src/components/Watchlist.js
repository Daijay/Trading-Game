import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
function tone(upside) {
    return upside > 0.05 ? "positive" : upside < -0.05 ? "negative" : "neutral";
}
export default function Watchlist({ items, selected, onSelect, onAdd }) {
    const [draft, setDraft] = useState("");
    return (_jsxs("div", { className: "watchlist", children: [_jsx("div", { className: "panel-title", children: "WATCHLIST \u00B7 VALUATION" }), items.map((it) => (_jsxs("div", { className: `wl-row ${tone(it.upside_pct)} ${it.ticker === selected ? "active" : ""}`, onClick: () => onSelect(it.ticker), children: [_jsx("span", { children: it.ticker }), _jsxs("span", { className: "wl-pct", children: [it.upside_pct >= 0 ? "+" : "", Math.round(it.upside_pct * 100), "%"] })] }, it.ticker))), _jsx("form", { className: "wl-add", onSubmit: (e) => { e.preventDefault(); if (draft) {
                    onAdd(draft.toUpperCase());
                    setDraft("");
                } }, children: _jsx("input", { value: draft, placeholder: "+ add ticker", onChange: (e) => setDraft(e.target.value) }) })] }));
}
