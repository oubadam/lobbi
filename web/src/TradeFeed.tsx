import { useState, useCallback, useMemo } from "react";
import type { TradeRecord } from "./api";

interface Props {
  trades: TradeRecord[];
}

type FeedEvent = { type: "buy" | "sell"; trade: TradeRecord; timestamp: string };

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString();
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

  const events = useMemo(() => {
    const list: FeedEvent[] = [];
    for (const t of trades) {
      list.push({ type: "buy", trade: t, timestamp: t.buyTimestamp });
      if (t.sellTimestamp) {
        list.push({ type: "sell", trade: t, timestamp: t.sellTimestamp });
      }
    }
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list;
  }, [trades]);

  if (events.length === 0) {
    return (
      <div className="panel">
        <div className="panel-title">[ TRADE FEED — LIVE ]</div>
        <p className="trade-feed-desc">Every buy and sell appears here as it happens. Refreshes every 3s.</p>
        <div className="trade-feed">
          <p className="trade-feed-empty">No trades yet. When Lobbi buys, a BUY row will appear; when he sells, a SELL row will appear.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">[ TRADE FEED — LIVE ]</div>
      <p className="trade-feed-desc">Every buy and sell in time order. Refreshes every 3s.</p>
      <div className="trade-feed trade-feed-rows">
        {events.map((ev, i) => (
          <div key={ev.type + ev.trade.id + ev.timestamp + i} className={`trade-feed-row trade-feed-row-${ev.type}`}>
            <div className="trade-feed-row-badge">{ev.type === "buy" ? "BUY" : "SELL"}</div>
            <div className="trade-feed-row-main">
              <span className="trade-symbol">{ev.trade.symbol}</span>
              {ev.type === "buy" && ev.trade.mcapUsd != null && (
                <span className="trade-feed-row-mcap"> · Mcap @ buy ${(ev.trade.mcapUsd / 1000).toFixed(1)}k</span>
              )}
              {ev.type === "sell" && ev.trade.mcapAtSellUsd != null && (
                <span className="trade-feed-row-mcap"> · Mcap @ sell ${(ev.trade.mcapAtSellUsd / 1000).toFixed(1)}k</span>
              )}
              <span className="trade-feed-row-sep"> · </span>
              {ev.type === "buy" ? (
                <>
                  <span className="trade-feed-row-sol">{ev.trade.buySol.toFixed(4)} SOL</span>
                  <span className="trade-feed-row-meta">{formatTime(ev.timestamp)}</span>
                </>
              ) : (
                <>
                  <span className="trade-feed-row-sol">{ev.trade.sellSol.toFixed(4)} SOL</span>
                  <span className={`trade-feed-row-pnl ${ev.trade.pnlSol >= 0 ? "positive" : "negative"}`}>
                    {ev.trade.pnlSol >= 0 ? "+" : ""}{ev.trade.pnlSol.toFixed(4)} SOL
                  </span>
                  <span className="trade-feed-row-meta">{formatTime(ev.timestamp)}</span>
                </>
              )}
            </div>
            <button
              type="button"
              className="trade-mint-btn-inline"
              onClick={() => copyMint(ev.trade.mint, ev.trade.id + ev.type)}
              title="Copy contract address"
            >
              CA: {ev.trade.mint.slice(0, 6)}…{ev.trade.mint.slice(-4)}
              {copiedId === ev.trade.id + ev.type && " ✓"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
