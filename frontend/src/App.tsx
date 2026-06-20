import { useEffect, useRef, useState } from "react";
import { Market, ROSTER } from "./sim/market";
import type { VolLevel } from "./sim/engine";
import { Portfolio } from "./game/portfolio";
import {
  TimedGame, recordScore, loadBestScore, Mode, STARTING_CASH, TICK_MS, TIMED_TICKS,
} from "./game/mode";
import Hud from "./components/Hud";
import StockPicker from "./components/StockPicker";
import CandleChart from "./components/CandleChart";
import TradePanel from "./components/TradePanel";
import VolatilityBar from "./components/VolatilityBar";
import StartScreen from "./components/StartScreen";
import ResultScreen from "./components/ResultScreen";
import type { TradeResult } from "./game/portfolio";

type Screen = "start" | "playing" | "result";

interface Game {
  market: Market;
  portfolio: Portfolio;
  timed: TimedGame | null;
  mode: Mode;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [game, setGame] = useState<Game | null>(null);
  const [selected, setSelected] = useState<string>(ROSTER[0].ticker);
  const [, setFrame] = useState(0); // forces re-render each tick
  const [bestScore, setBestScore] = useState<number>(loadBestScore());
  const [msg, setMsg] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const start = (mode: Mode, level: VolLevel) => {
    const seed = Date.now() % 1000000;
    setGame({
      market: new Market(seed, level),
      portfolio: new Portfolio(STARTING_CASH),
      timed: mode === "timed" ? new TimedGame(TIMED_TICKS) : null,
      mode,
    });
    setSelected(ROSTER[0].ticker);
    setScreen("playing");
  };

  useEffect(() => {
    if (screen !== "playing" || !game) return;
    intervalRef.current = setInterval(() => {
      game.market.tick();
      if (game.timed) {
        game.timed.tick();
        if (game.timed.over) {
          clearInterval(intervalRef.current);
          const nw = game.portfolio.netWorth(game.market.prices());
          setBestScore(recordScore(nw));
          setScreen("result");
          return;
        }
      }
      setFrame((f) => f + 1);
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }, [screen, game]);

  if (screen === "start" || !game) {
    return <StartScreen bestScore={bestScore} onStart={start} />;
  }

  const prices = game.market.prices();
  const stock = game.market.get(selected);
  const pos = game.portfolio.position(selected);

  if (screen === "result") {
    return (
      <ResultScreen
        netWorth={game.portfolio.netWorth(prices)}
        totalPnl={game.portfolio.totalPnl(prices)}
        bestScore={bestScore}
        onPlayAgain={() => setScreen("start")}
      />
    );
  }

  const flash = (r: TradeResult) => {
    if (!r.ok) { setMsg(r.reason); setTimeout(() => setMsg(""), 1500); }
  };

  // Keyboard shortcuts: B buy 10, S sell 10, 1-4 set volatility.
  useEffect(() => {
    if (screen !== "playing" || !game) return;
    const onKey = (e: KeyboardEvent) => {
      const s = game.market.get(selected);
      if (e.key === "b" || e.key === "B") {
        flash(game.portfolio.buy(selected, 10, s.price));
      } else if (e.key === "s" || e.key === "S") {
        const qty = Math.min(10, game.portfolio.position(selected).shares);
        if (qty > 0) flash(game.portfolio.sell(selected, qty, s.price));
      } else if (e.key >= "1" && e.key <= "4") {
        game.market.setVolatility(Number(e.key) as VolLevel);
        setFrame((f) => f + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, game, selected]);

  return (
    <div className="terminal">
      <Hud
        mode={game.mode}
        remainingSeconds={game.timed ? Math.ceil((game.timed.remainingTicks * TICK_MS) / 1000) : null}
        netWorth={game.portfolio.netWorth(prices)}
        totalPnl={game.portfolio.totalPnl(prices)}
      />
      <StockPicker
        items={game.market.stocks.map((s) => ({ ticker: s.ticker, changePct: game.market.changePct(s.ticker) }))}
        selected={selected}
        onSelect={setSelected}
      />
      {msg && <div className="error-banner">{msg}</div>}
      <div className="body">
        <CandleChart candles={stock.series.candles} avgCost={pos.shares > 0 ? pos.avgCost : null} />
        <TradePanel
          ticker={selected}
          price={stock.price}
          shares={pos.shares}
          avgCost={pos.avgCost}
          unrealized={game.portfolio.unrealized(selected, stock.price)}
          unrealizedPct={game.portfolio.unrealizedPct(selected, stock.price)}
          cash={game.portfolio.cash}
          onBuy={(qty) => flash(game.portfolio.buy(selected, qty, stock.price))}
          onSell={(qty) => flash(game.portfolio.sell(selected, qty, stock.price))}
        />
      </div>
      <VolatilityBar level={game.market.level} onChange={(l) => game.market.setVolatility(l)} />
    </div>
  );
}
