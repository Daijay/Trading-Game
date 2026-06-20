import { useState } from "react";
import type { VolLevel } from "../sim/engine";
import type { Mode } from "../game/mode";

interface Props {
  bestScore: number;
  onStart: (mode: Mode, level: VolLevel) => void;
}

export default function StartScreen({ bestScore, onStart }: Props) {
  const [mode, setMode] = useState<Mode>("timed");
  const [level, setLevel] = useState<VolLevel>(2);
  const levels: VolLevel[] = [1, 2, 3, 4];

  return (
    <div className="screen">
      <h1 className="title">⚡ TICKER RUNNER</h1>
      <p className="sub">Buy low, sell high, beat the clock.</p>
      <div className="best">Best score: ${Math.round(bestScore).toLocaleString()}</div>

      <div className="choice">
        <div className="cap">MODE</div>
        <div className="choice-row">
          <button className={mode === "timed" ? "active" : ""} onClick={() => setMode("timed")}>Timed Challenge</button>
          <button className={mode === "sandbox" ? "active" : ""} onClick={() => setMode("sandbox")}>Endless Sandbox</button>
        </div>
      </div>

      <div className="choice">
        <div className="cap">STARTING VOLATILITY</div>
        <div className="choice-row">
          {levels.map((l) => (
            <button key={l} className={level === l ? "active" : ""} onClick={() => setLevel(l)}>
              {l === 4 ? "4 🚀" : l}
            </button>
          ))}
        </div>
      </div>

      <button className="start" onClick={() => onStart(mode, level)}>START</button>
    </div>
  );
}
