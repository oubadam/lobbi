import { useEffect, useState } from "react";
import type { LobbiState, CandidateCoin } from "./api";

interface Props {
  state: LobbiState | null;
}

const SCREEN_COUNT = 3;

export function LobbiScene({ state }: Props) {
  const kind = state?.kind ?? "idle";
  const message = state?.message ?? "";
  const rawCandidates = state?.candidateCoins ?? [];
  const candidates: CandidateCoin[] = rawCandidates.slice(0, SCREEN_COUNT);
  const chosenMint = state?.chosenMint;

  const [walkPosition, setWalkPosition] = useState<number>(0);
  const [selectedScreen, setSelectedScreen] = useState<number | null>(null);

  const screenPositions = [20, 50, 80];

  useEffect(() => {
    if (kind === "choosing" && candidates.length > 0) {
      setSelectedScreen(null);
      let step = 0;
      const totalSteps = 8;
      const interval = setInterval(() => {
        step++;
        setWalkPosition(Math.min(step, SCREEN_COUNT));
        if (step >= totalSteps) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
    if (kind === "bought" || kind === "sold") {
      const idx = chosenMint ? candidates.findIndex((c) => c.mint === chosenMint) : 0;
      setSelectedScreen(idx >= 0 ? idx : null);
      setWalkPosition(idx >= 0 ? idx : 0);
    }
    if (kind === "idle" || kind === "thinking") {
      setWalkPosition(0);
      setSelectedScreen(null);
    }
  }, [kind, candidates.length, chosenMint, candidates]);

  const lobbiLeft =
    kind === "choosing" || kind === "bought" || kind === "sold"
      ? `${screenPositions[Math.min(walkPosition, SCREEN_COUNT - 1)] ?? 50}%`
      : "50%";

  return (
    <div className="panel lobbi-scene">
      <div className="panel-title">[ LIVE CLAW ]</div>

      {kind === "thinking" && (
        <div className="thought-bubble">
          <span className="blink">...</span> scanning pump.fun ...
        </div>
      )}

      <div className="screens-row">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`ascii-screen ${selectedScreen === i ? "selected" : ""} ${candidates[i] ? "has-coin" : "empty"}`}
          >
            <div className="screen-frame">
              <div className="screen-title">[ COIN {i + 1} ]</div>
              <div className="screen-content">
                {candidates[i] ? (
                  <>
                    <div className="screen-symbol">{candidates[i].symbol}</div>
                    <div className="screen-name">{candidates[i].name}</div>
                    <div className="screen-mint">{candidates[i].mint.slice(0, 6)}...{candidates[i].mint.slice(-4)}</div>
                    <div className="screen-reason">{candidates[i].reason}</div>
                  </>
                ) : (
                  <div className="screen-empty">—</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="lobbi-walk-container"
        style={{ left: lobbiLeft }}
        aria-hidden
      >
        <img
          src="/lobbi.jpg"
          alt="Lobbi"
          className={`lobbi-sprite ${kind} ${selectedScreen !== null ? "selected" : ""}`}
        />
      </div>

      <div className="lobbi-message">
        {kind === "idle" && "Lobbi is resting. Next trade soon..."}
        {kind === "thinking" && "Scanning pump.fun..."}
        {kind === "choosing" && (selectedScreen !== null ? `Selected ${candidates[selectedScreen]?.symbol ?? "?"}` : "Choosing a coin...")}
        {kind === "bought" && (message ? `Bought ${state?.chosenSymbol ?? ""}` : "Bought!")}
        {kind === "sold" && (message || "Sold!")}
      </div>
    </div>
  );
}
