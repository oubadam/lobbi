import { useEffect, useState } from "react";
import {
  fetchLatestTrades,
  fetchBalance,
  fetchPnl,
  fetchLobbiState,
  type TradeRecord,
  type LobbiState,
} from "./api";
import { LobbiScene } from "./LobbiScene";
import { TradeFeed } from "./TradeFeed";

const POLL_MS = 3000;

export default function App() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [pnl, setPnl] = useState<number>(0);
  const [state, setState] = useState<LobbiState | null>(null);
  const [error, setError] = useState<string | null>(null);

  function poll() {
    Promise.all([
      fetchLatestTrades(20),
      fetchBalance(),
      fetchPnl(),
      fetchLobbiState(),
    ])
      .then(([t, b, p, s]) => {
        setTrades(t);
        setBalance(b);
        setPnl(p.totalPnlSol);
        setState(s);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? "Failed to fetch"));
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
          <span className="header-sub">Clawdbot · one position at a time · 3 min between trades · hold 2–10 min · TP +50% / SL -30%</span>
        </div>
        <span className="live-dot" title="Data refreshes every 3s">LIVE</span>
      </header>

      {error && (
        <div className="panel panel-error">
          {error} — is the backend running on port 4000?
        </div>
      )}

      <section className="stats-section" aria-label="Balance and PnL">
        <h2 className="section-label">Balance & PnL</h2>
        <div className="stats-row">
          <div className="panel stat-box">
            <div className="panel-title">Wallet balance</div>
            <div className="stat-value">{balance.toFixed(4)} SOL</div>
            <p className="stat-desc">Claw wallet (start 1 SOL + PnL)</p>
          </div>
          <div className="panel stat-box">
            <div className="panel-title">Total PnL</div>
            <div
              className="stat-value"
              style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} SOL
            </div>
            <p className="stat-desc">Sum of all trade PnL (real prices)</p>
          </div>
        </div>
      </section>

      <section className="claw-section" aria-label="Live claw">
        <h2 className="section-label">Live claw</h2>
        <p className="section-desc">Bot picks one coin, holds at least 2 min, then sells. Waits 3 min before next buy.</p>
        <LobbiScene state={state} />
      </section>

      <section className="feed-section" aria-label="Trade feed">
        <TradeFeed trades={trades} />
      </section>

      <footer className="footer">
        Lobbi memecoin · Clawdbot trades Solana memecoins · Creator rewards fund the claw
      </footer>
    </div>
  );
}
