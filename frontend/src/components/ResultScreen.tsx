interface Props {
  netWorth: number;
  totalPnl: number;
  bestScore: number;
  onPlayAgain: () => void;
}

export default function ResultScreen({ netWorth, totalPnl, bestScore, onPlayAgain }: Props) {
  const tone = totalPnl >= 0 ? "positive" : "negative";
  const sign = totalPnl >= 0 ? "+" : "-";
  return (
    <div className="screen">
      <h1 className="title">TIME!</h1>
      <div className="final">${Math.round(netWorth).toLocaleString()}</div>
      <div className={`final-pnl ${tone}`}>
        {sign}${Math.abs(Math.round(totalPnl)).toLocaleString()}
      </div>
      <div className="best">Best score: ${Math.round(bestScore).toLocaleString()}</div>
      <button className="start" onClick={onPlayAgain}>PLAY AGAIN</button>
    </div>
  );
}
