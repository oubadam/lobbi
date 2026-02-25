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
import DelicateAsciiDots from "./components/ui/delicate-ascii-dots";
import CursorDitherTrail from "./components/ui/cursor-dither-trail";
import { CAButton } from "./components/CAButton";
import { SocialLinks } from "./components/SocialLinks";

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
    <div className="app-wrap">
      <div style={{ opacity: 0.4, position: "fixed", inset: 0, zIndex: 0 }}>
        <DelicateAsciiDots
          backgroundColor="#f8f9fa"
          textColor="108, 117, 125"
          gridSize={80}
          removeWaveLine
          animationSpeed={0.75}
        />
      </div>
      <CursorDitherTrail
        trailColor="#e85d04"
        dotSize={6}
        fadeDuration={1000}
        className="app-cursor-trail"
      />
      <div className="app">
      <header className="header">
        <img src="/lobbi.png" alt="lobbi" />
        <div className="header-titles">
          <h1>lobbi</h1>
          <span className="header-sub">
            lobbi · powered by openclaw · one position at a time · ai decides when to buy/sell
          </span>
        </div>
        <div className="header-right">
          <CAButton variant="header" />
          <span className="live-dot" title="data refreshes every 3s">live</span>
        </div>
      </header>

      {error && (
        <div className="panel panel-error" role="alert">
          {error}
          <p className="panel-error-hint">check console for details. is the backend running on port 4000?</p>
        </div>
      )}

      <section className="about-section" aria-label="about lobbi">
        <h2 className="section-label">about</h2>
        <div className="panel about-panel">
          <p>
            <strong>lobbi</strong> is an autonomous trading agent that trades solana memecoins on pump.fun. no prompts, no manual triggers—it runs 24/7, finds coins, buys, and decides when to sell using ai analysis. powered by{" "}
            <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer">openclaw</a>. you just watch.
          </p>
          <p>
            <strong>it starts with 1 SOL and trades it up, as long as it can.</strong>
          </p>
          <p>
            <strong>how it works:</strong> lobbi scans pump.fun for coins, picks based on narrative and holder quality, then buys. for sells, it uses ai to judge price action and momentum—when to take profits, when to cut losses—with no fixed tp/sl. one position at a time, flips in minutes.
          </p>
          <p>
            the bot wallet trades in real time. every buy and sell shows in the feed below, with exact pnl per trade. creator rewards from the wallet fund the claw and keep it running.
          </p>
          <p>
            the X account is automated—it posts about what lobbi is thinking, current wallet balance, and the trades it took.
          </p>
        </div>
      </section>

      <section className="stats-section" aria-label="balance and pnl">
        <h2 className="section-label">bot wallet</h2>
        <div className="stats-row">
          <div className="panel stat-box">
            <div className="panel-title">balance</div>
            <div className="stat-value">{balance.toFixed(4)} SOL</div>
            <p className="stat-desc">current wallet (start 1 SOL + pnl)</p>
          </div>
          <div className="panel stat-box">
            <div className="panel-title">total pnl</div>
            <div
              className="stat-value"
              style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} SOL
            </div>
            <p className="stat-desc">sum of all trade pnl</p>
          </div>
        </div>
      </section>

      <section className="claw-section" aria-label="live claw">
        <h2 className="section-label">live claw</h2>
        <p className="section-desc">
          lobbi scans candidates, picks based on narrative + holder quality, and decides when to buy/sell. no fixed tp/sl—lobbi analyses metrics in real time. powered by openclaw.
        </p>
        <LobbiScene state={state} trades={trades} />
      </section>

      <section className="feed-section" aria-label="live trade feed">
        <h2 className="section-label">live trade feed</h2>
        <p className="section-desc">every buy and sell from the autonomous bot, in time order. hover the chart below to see wallet balance at each point.</p>
        <TradeFeed trades={trades} />
      </section>

      <section className="balance-chart-section" aria-label="wallet balance over time">
        <h2 className="section-label">wallet balance chart</h2>
        <div className="panel balance-chart-panel">
          <div className="panel-title">[ bot wallet balance over time ]</div>
          <WalletBalanceChart points={balanceChartPoints} />
        </div>
      </section>

      <footer className="footer">
        <div className="footer-main">
          <CAButton variant="footer" />
          <SocialLinks />
        </div>
        <p className="footer-text">
          lobbi memecoin · lobbi trades solana memecoins (powered by openclaw) · creator rewards fund the claw
        </p>
      </footer>
      </div>
    </div>
  );
}
