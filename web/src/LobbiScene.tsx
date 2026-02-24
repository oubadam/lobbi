import type { LobbiState } from "./api";

interface Props {
  state: LobbiState | null;
}

export function LobbiScene({ state }: Props) {
  const kind = state?.kind ?? "idle";
  const message = state?.message ?? "";

  return (
    <div className="panel lobbi-scene">
      <div className="panel-title">[ LIVE CLAW ]</div>

      {(kind === "thinking" || kind === "choosing") && (
        <div className="thought-bubble">
          <span className="blink">...</span> {kind === "choosing" ? "selecting coin ..." : "scanning pump.fun ..."}
        </div>
      )}

      <div className="screens-row screens-row-single">
        <div className={`ascii-screen ${kind === "bought" || kind === "sold" ? "selected" : ""}`}>
          <div className="screen-frame">
            <div className="screen-title">[ CLAW ]</div>
            <div className="screen-content">
              {kind === "idle" && <div className="screen-empty">Next trade in ~3 min</div>}
              {(kind === "thinking" || kind === "choosing") && <div className="screen-empty">Scanning...</div>}
              {(kind === "bought" || kind === "sold") && (
                <div className="screen-single">
                  <div className="screen-symbol">{state?.chosenSymbol ?? "—"}</div>
                  <div className="screen-message">{kind === "bought" ? "Position opened" : message || "Position closed"}</div>
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
        {kind === "idle" && "Lobbi is resting. Next trade in ~3 min."}
        {(kind === "thinking" || kind === "choosing") && "Selecting a coin..."}
        {kind === "bought" && (message ? `Bought ${state?.chosenSymbol ?? ""}` : "Bought!")}
        {kind === "sold" && (message || "Sold!")}
      </div>
    </div>
  );
}
