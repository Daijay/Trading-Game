import { useRef } from "react";
import { useTerminal } from "./store";
import TopBar from "./components/TopBar";
import Watchlist from "./components/Watchlist";
import ChartPanel from "./components/ChartPanel";
import AssumptionsPanel from "./components/AssumptionsPanel";
import BreakdownBar from "./components/BreakdownBar";
import type { Assumptions } from "./types";

export default function App() {
  const t = useTerminal();
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const onAssumptions = (a: Assumptions) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => t.updateAssumptions(a), 200);
  };

  return (
    <div className="terminal">
      <TopBar quote={t.quote} result={t.result} />
      {t.error && <div className="error-banner">{t.error}</div>}
      <div className="body">
        <Watchlist items={t.tickers} selected={t.selected} onSelect={t.setSelected} onAdd={t.addTicker} />
        <ChartPanel prices={t.prices} result={t.result} />
        {t.result && <AssumptionsPanel assumptions={t.result.assumptions} onChange={onAssumptions} />}
      </div>
      {t.result && <BreakdownBar result={t.result} />}
    </div>
  );
}
