interface Item {
  ticker: string;
  changePct: number;
}

interface Props {
  items: Item[];
  selected: string;
  onSelect: (ticker: string) => void;
}

export default function StockPicker({ items, selected, onSelect }: Props) {
  return (
    <div className="picker">
      {items.map((it) => {
        const tone = it.changePct >= 0 ? "positive" : "negative";
        return (
          <button
            key={it.ticker}
            className={`pick ${it.ticker === selected ? "active" : ""}`}
            onClick={() => onSelect(it.ticker)}
          >
            <b>{it.ticker}</b>{" "}
            <span className={tone}>
              {it.changePct >= 0 ? "+" : ""}{(it.changePct * 100).toFixed(1)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
