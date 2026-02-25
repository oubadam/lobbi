import { useEffect, useState } from "react";
import {
  fetchLatestTrades,
  fetchBalance,
  fetchPnl,
  fetchLobbiState,
  fetchFilters,
  type TradeRecord,
  type LobbiState,
  type FiltersConfig,
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
  const [filters, setFilters] = useState<FiltersConfig | null>(null);

  function poll() {
    Promise.all([
      fetchLatestTrades(20),
      fetchBalance(),
      fetchPnl(),
      fetchLobbiState(),
      fetchFilters().catch(() => null),
    ])
      .then(([t, b, p, s, f]) => {
        setTrades(t);
        setBalance(b);
        setPnl(p.totalPnlSol);
        setState(s);
        if (f != null) setFilters(f);
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
            Clawdbot · one position at a time · 3 min between trades
            {filters != null && (
              <> · hold {((filters.holdMinSeconds ?? 120) / 60)}–{((filters.holdMaxSeconds ?? 600) / 60)} min · TP +{filters.takeProfitPercent ?? 70}% / SL {filters.stopLossPercent ?? -30}% · min {(filters.minGlobalFeesPaidSol ?? 0.8)} SOL fees</>
            )}
            {filters == null && <> · hold 2–10 min · TP +70% / SL -30% · min 0.8 SOL fees</>}
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
            <p className="stat-desc">Sum of all trade PnL. With a linked wallet: real SOL in/out. In demo: simulated from prices.</p>
          </div>
        </div>
      </section>

      <section className="claw-section" aria-label="Live claw">
        <h2 className="section-label">Live claw</h2>
        <p className="section-desc">
          {filters != null ? (
            <>Bot selects one coin (filters: ≤{filters.maxAgeMinutes ?? 60} min old, mcap ${((filters.minMcapUsd ?? 10000) / 1000).toFixed(0)}k–${((filters.maxMcapUsd ?? 31400) / 1000).toFixed(1)}k, min vol ${((filters.minVolumeUsd ?? 12000) / 1000).toFixed(0)}k, min {(filters.minGlobalFeesPaidSol ?? 0.8)} SOL fees, hold {(filters.holdMinSeconds ?? 120) / 60}–{(filters.holdMaxSeconds ?? 600) / 60} min, 3 min between). TP +{filters.takeProfitPercent ?? 70}% / SL {filters.stopLossPercent ?? -30}%.</>
          ) : (
            "Bot selects one coin (filters: ≤1h old, mcap $10k–$31.4k, min vol $12k, min 0.8 SOL fees, hold 2–10 min, 3 min between). TP +70% / SL -30%."
          )}
        </p>
        {filters != null && (
          <div className="panel filters-verify" aria-label="Bot settings for verification">
            <div className="panel-title">Bot settings (verify)</div>
            <div className="filters-grid">
              <span>Take profit: +{filters.takeProfitPercent ?? 70}%</span>
              <span>Stop loss: {filters.stopLossPercent ?? -30}%</span>
              <span>Min fees: {(filters.minGlobalFeesPaidSol ?? 0.8)} SOL</span>
              <span>Hold: {(filters.holdMinSeconds ?? 120) / 60}–{(filters.holdMaxSeconds ?? 600) / 60} min</span>
              <span>Mcap: ${((filters.minMcapUsd ?? 10000) / 1000).toFixed(0)}k–${((filters.maxMcapUsd ?? 31400) / 1000).toFixed(1)}k</span>
              <span>Min volume: ${((filters.minVolumeUsd ?? 12000) / 1000).toFixed(0)}k</span>
              <span>Max age: {filters.maxAgeMinutes ?? 60} min</span>
            </div>
          </div>
        )}
        <LobbiScene state={state} trades={trades} />
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
