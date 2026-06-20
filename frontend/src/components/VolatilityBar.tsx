import type { VolLevel } from "../sim/engine";

interface Props {
  level: VolLevel;
  onChange: (level: VolLevel) => void;
}

const LEVELS: { value: VolLevel; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4 · 🚀 IPO" },
];

export default function VolatilityBar({ level, onChange }: Props) {
  return (
    <div className="volbar">
      <span className="label">VOLATILITY</span>
      <div className="vol-options">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            className={`vol-btn ${l.value === level ? "active" : ""}`}
            onClick={() => onChange(l.value)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
