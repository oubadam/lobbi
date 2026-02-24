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
        <h1>LOBBI</h1>
        <span style={{ fontFamily: "var(--ascii-font)", color: "var(--muted)" }}>
          Clawdbot live
        </span>
      </header>

      {error && (
        <div className="panel" style={{ borderColor: "var(--red)", color: "var(--red)" }}>
          {error} — is the backend running on port 4000?
        </div>
      )}

      <div className="stats-row">
        <div className="panel stat-box">
          <div className="panel-title">[ WALLET ]</div>
          <div className="stat-value">{balance.toFixed(4)} SOL</div>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Claw balance</div>
        </div>
        <div className="panel stat-box">
          <div className="panel-title">[ PNL ]</div>
          <div
            className="stat-value"
            style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}
          >
            {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} SOL
          </div>
          <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Total PnL</div>
        </div>
      </div>

      <LobbiScene state={state} />
      <TradeFeed trades={trades} />

      <footer className="panel" style={{ marginTop: 24, textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
        Lobbi memecoin · Clawdbot trades Solana memecoins · Creator rewards fund the claw
      </footer>
    </div>
  );
}
