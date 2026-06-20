import { useEffect, useRef, useState } from "react";

interface Props {
  mode: "sandbox" | "timed";
  remainingSeconds: number | null;
  netWorth: number;
  totalPnl: number;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Briefly applies an "up" or "down" class when the value moves, for a flash.
function useFlash(value: number): string {
  const prev = useRef(value);
  const [cls, setCls] = useState("");
  useEffect(() => {
    if (value > prev.current) setCls("flash-up");
    else if (value < prev.current) setCls("flash-down");
    prev.current = value;
    const t = setTimeout(() => setCls(""), 350);
    return () => clearTimeout(t);
  }, [value]);
  return cls;
}

export default function Hud({ mode, remainingSeconds, netWorth, totalPnl }: Props) {
  const tone = totalPnl >= 0 ? "positive" : "negative";
  const sign = totalPnl >= 0 ? "+" : "-";
  const netFlash = useFlash(netWorth);
  const pnlFlash = useFlash(totalPnl);
  return (
    <div className="hud">
      <span className="brand">⚡ TICKER RUNNER</span>
      <span className="pill">MODE: <b>{mode.toUpperCase()}</b></span>
      {mode === "timed" && remainingSeconds !== null && (
        <span className="pill">⏱ <b>{clock(remainingSeconds)}</b></span>
      )}
      <span className="hud-right">
        <span className="hud-stat">
          <span className="cap">NET WORTH</span>
          <b className={netFlash}>${Math.round(netWorth).toLocaleString()}</b>
        </span>
        <span className="hud-stat">
          <span className="cap">TOTAL P&amp;L</span>
          <b className={`${tone} ${pnlFlash}`}>{sign}${Math.abs(Math.round(totalPnl)).toLocaleString()}</b>
        </span>
      </span>
    </div>
  );
}
