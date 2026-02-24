import { useState, useCallback } from "react";
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyMint = useCallback((mint: string, id: string) => {
    navigator.clipboard.writeText(mint).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

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
            <div className="trade-item-header">
              <span className="trade-symbol">{t.symbol}</span>
              {" — "}
              {formatTime(t.sellTimestamp)}
              {" · Hold: "}
              {formatHold(t.holdSeconds)}
            </div>
            <div className="trade-ca-row">
              <span className="trade-ca-label">CA: </span>
              <button
                type="button"
                className="trade-mint-btn"
                onClick={() => copyMint(t.mint, t.id)}
                title="Copy contract address"
              >
                {t.mint.slice(0, 8)}…{t.mint.slice(-8)}
                {copiedId === t.id && <span className="trade-copied"> Copied!</span>}
              </button>
              <a href={`${SOLSCAN}${t.mint}`} target="_blank" rel="noopener noreferrer" className="trade-mint-link">Open in Solscan</a>
            </div>
            <div className="trade-why">Why: {t.why}</div>
            <div className="trade-boxes">
              <div className="trade-box trade-box-buy">
                <div className="trade-box-label">BUY</div>
                <div className="trade-box-value">{t.buySol.toFixed(4)} SOL</div>
                <div className="trade-box-meta">{formatTime(t.buyTimestamp)}</div>
              </div>
              <div className="trade-hold-pill">
                Hold {formatHold(t.holdSeconds)}
              </div>
              <div className="trade-box trade-box-sell">
                <div className="trade-box-label">SELL</div>
                <div className="trade-box-value">{t.sellSol.toFixed(4)} SOL</div>
                <div className="trade-box-meta">{formatTime(t.sellTimestamp)}</div>
                <div className={`trade-pnl ${t.pnlSol >= 0 ? "positive" : "negative"}`}>
                  PnL: {t.pnlSol >= 0 ? "+" : ""}{t.pnlSol.toFixed(4)} SOL
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
