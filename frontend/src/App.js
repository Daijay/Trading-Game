import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from "react";
import { useTerminal } from "./store";
import TopBar from "./components/TopBar";
import Watchlist from "./components/Watchlist";
import ChartPanel from "./components/ChartPanel";
import AssumptionsPanel from "./components/AssumptionsPanel";
import BreakdownBar from "./components/BreakdownBar";
export default function App() {
    const t = useTerminal();
    const debounce = useRef();
    const onAssumptions = (a) => {
        clearTimeout(debounce.current);
        debounce.current = setTimeout(() => t.updateAssumptions(a), 200);
    };
    return (_jsxs("div", { className: "terminal", children: [_jsx(TopBar, { quote: t.quote, result: t.result }), t.error && _jsx("div", { className: "error-banner", children: t.error }), _jsxs("div", { className: "body", children: [_jsx(Watchlist, { items: t.tickers, selected: t.selected, onSelect: t.setSelected, onAdd: t.addTicker }), _jsx(ChartPanel, { prices: t.prices, result: t.result }), t.result && _jsx(AssumptionsPanel, { assumptions: t.result.assumptions, onChange: onAssumptions })] }), t.result && _jsx(BreakdownBar, { result: t.result })] }));
}
