import type { LobbiState } from "./api";

interface Props {
  state: LobbiState | null;
}

export function LobbiScene({ state }: Props) {
  const kind = state?.kind ?? "idle";
  const message = state?.message ?? "";

  const hasPosition = kind === "bought";
  const searching = kind === "idle" || kind === "thinking" || kind === "choosing";
  const showSelecting = searching || kind === "sold";

  return (
    <div className="panel lobbi-scene">
      <div className="panel-title">[ LIVE CLAW ]</div>
      <div className="lobbi-status-bar">
        {(searching || kind === "sold") && (
          <span className="lobbi-status">
            {kind === "sold" ? "Position closed · Selecting next coin…" : "No position · Selecting next coin…"}
          </span>
        )}
        {hasPosition && <span className="lobbi-status lobbi-status-position">In position: {state?.chosenSymbol ?? "—"}</span>}
      </div>

      {(kind === "thinking" || kind === "choosing") && (
        <div className="thought-bubble">
          <span className="blink">...</span> {kind === "choosing" ? "selecting coin ..." : "scanning pump.fun (≤1h old, mcap, vol) ..."}
        </div>
      )}

      <div className="screens-row screens-row-single">
        <div className={`ascii-screen ${kind === "bought" ? "selected" : ""}`}>
          <div className="screen-frame">
            <div className="screen-title">[ CLAW ]</div>
            <div className="screen-content">
              {showSelecting && (
                <div className="screen-empty">
                  {kind === "sold" ? "Selecting next coin…" : kind === "idle" ? "Selecting next coin… (filters: ≤1h, mcap, vol)" : "Searching for coins…"}
                </div>
              )}
              {kind === "bought" && (
                <div className="screen-single">
                  <div className="screen-symbol">{state?.chosenSymbol ?? "—"}</div>
                  <div className="screen-message">{message || "Position opened"}</div>
                  {(state?.chosenMcapUsd != null || state?.chosenHolderCount != null) && (
                    <div className="screen-metrics">
                      {state?.chosenMcapUsd != null && (
                        <span>Mcap @ entry ${(state.chosenMcapUsd / 1000).toFixed(1)}k</span>
                      )}
                      {state?.chosenHolderCount != null && (
                        <span> · Holders: {state.chosenHolderCount}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lobbi-walk-container lobbi-center" aria-hidden>
        <img
          src="/lobbi.png"
          alt="Lobbi"
          className={`lobbi-sprite ${kind}`}
        />
      </div>

      <div className="lobbi-message">
        {kind === "idle" && "Selecting next coin (filters: ≤1h old, mcap, vol)."}
        {(kind === "thinking" || kind === "choosing") && "Searching for coins…"}
        {kind === "bought" && (message ? `Bought ${state?.chosenSymbol ?? ""}` : "Bought!")}
        {kind === "sold" && (message ? `${message} — selecting next…` : "Sold — selecting next…")}
      </div>
    </div>
  );
}
