import type { TradeRecord } from "./api";

interface Props {
  trades: TradeRecord[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString();
}

function formatHold(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

const SOLSCAN = "https://solscan.io/token/";

export function TradeFeed({ trades }: Props) {
  if (trades.length === 0) {
    return (
      <div className="panel">
        <div className="panel-title">[ TRADE FEED ]</div>
        <div className="trade-feed">
          <p style={{ color: "var(--muted)" }}>No trades yet. Lobbi will appear here when he trades.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">[ TRADE FEED ]</div>
      <div className="trade-feed">
        {trades.map((t) => (
          <div key={t.id} className="trade-item">
            <div>
              <span className="trade-symbol">{t.symbol}</span>
              {" — "}
              {formatTime(t.sellTimestamp)}
            </div>
            <a
              href={`${SOLSCAN}${t.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="trade-mint"
            >
              {t.mint.slice(0, 8)}…{t.mint.slice(-8)}
            </a>
            <div className="trade-why">Why: {t.why}</div>
            <div>
              Buy: {t.buySol.toFixed(4)} SOL → Sell: {t.sellSol.toFixed(4)} SOL · Hold: {formatHold(t.holdSeconds)}
            </div>
            <div className={`trade-pnl ${t.pnlSol >= 0 ? "positive" : "negative"}`}>
              PnL: {t.pnlSol >= 0 ? "+" : ""}{t.pnlSol.toFixed(4)} SOL
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
