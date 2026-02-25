import { useEffect, useState } from "react";
import {
  fetchLatestTrades,
  fetchBalance,
  fetchPnl,
  fetchBalanceChart,
  fetchLobbiState,
  type TradeRecord,
  type LobbiState,
  type BalanceChartPoint,
} from "./api";
import { LobbiScene } from "./LobbiScene";
import { TradeFeed } from "./TradeFeed";
import { WalletBalanceChart } from "./WalletBalanceChart";

const POLL_MS = 3000;

export default function App() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [pnl, setPnl] = useState<number>(0);
  const [balanceChartPoints, setBalanceChartPoints] = useState<BalanceChartPoint[]>([]);
  const [state, setState] = useState<LobbiState | null>(null);
  const [error, setError] = useState<string | null>(null);

  function poll() {
    Promise.all([
      fetchLatestTrades(50),
      fetchBalance(),
      fetchPnl(),
      fetchBalanceChart(),
      fetchLobbiState(),
    ])
      .then(([t, b, p, chart, s]) => {
        setTrades(t);
        setBalance(b);
        setPnl(p.totalPnlSol);
        setBalanceChartPoints(chart.points ?? []);
        setState(s);
        setError(null);
      })
      .catch((e) => {
        const msg = e?.message ?? String(e) ?? "Failed to fetch";
        setError(msg);
        console.error("[Lobbi] API error:", msg, e);
      });
  }

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <img src="/lobbi.png" alt="Lobbi" />
        <div className="header-titles">
          <h1>LOBBI</h1>
          <span className="header-sub">
            Lobbi · powered by OpenClaw · one position at a time · AI decides when to buy/sell
          </span>
        </div>
        <span className="live-dot" title="Data refreshes every 3s">LIVE</span>
      </header>

      {error && (
        <div className="panel panel-error" role="alert">
          {error}
          <p className="panel-error-hint">Check console for details. Is the backend running on port 4000?</p>
        </div>
      )}

      <section className="about-section" aria-label="About Lobbi">
        <h2 className="section-label">About</h2>
        <div className="panel about-panel">
          <p>
            <strong>Lobbi</strong> is an autonomous AI that trades Solana memecoins on Pump.fun. Powered by{" "}
            <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer">OpenClaw</a>. Lobbi runs 24/7—no one asks it anything. You just watch.
          </p>
          <p>
            <strong>How it works:</strong> Run backend + web + bot. Lobbi discovers candidates, picks based on narrative and holder quality, buys, then decides when to sell using its own analysis—no fixed take-profit or stop-loss. Requires <code>ANTHROPIC_API_KEY</code> or <code>OPENAI_API_KEY</code> for autonomous sell decisions.
          </p>
        </div>
      </section>

      <section className="stats-section" aria-label="Balance and PnL">
        <h2 className="section-label">Bot wallet</h2>
        <div className="stats-row">
          <div className="panel stat-box">
            <div className="panel-title">Balance</div>
            <div className="stat-value">{balance.toFixed(4)} SOL</div>
            <p className="stat-desc">Current wallet (start 1 SOL + PnL)</p>
          </div>
          <div className="panel stat-box">
            <div className="panel-title">Total PnL</div>
            <div
              className="stat-value"
              style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} SOL
            </div>
            <p className="stat-desc">Sum of all trade PnL</p>
          </div>
        </div>
      </section>

      <section className="claw-section" aria-label="Live claw">
        <h2 className="section-label">Live claw</h2>
        <p className="section-desc">
          Lobbi scans candidates, picks based on narrative + holder quality, and decides when to buy/sell. No fixed TP/SL—Lobbi analyses metrics in real time. Powered by OpenClaw.
        </p>
        <LobbiScene state={state} trades={trades} />
      </section>

      <section className="feed-section" aria-label="Live trade feed">
        <h2 className="section-label">Live trade feed</h2>
        <p className="section-desc">Every buy and sell. Hover chart at bottom for balance at each point.</p>
        <TradeFeed trades={trades} />
      </section>

      <section className="balance-chart-section" aria-label="Wallet balance over time">
        <h2 className="section-label">Wallet balance chart</h2>
        <div className="panel balance-chart-panel">
          <div className="panel-title">[ BOT WALLET BALANCE OVER TIME ]</div>
          <WalletBalanceChart points={balanceChartPoints} />
        </div>
      </section>

      <footer className="footer">
        Lobbi memecoin · Lobbi trades Solana memecoins (powered by OpenClaw) · Creator rewards fund the claw
      </footer>
    </div>
  );
}
