import type { LogEntry } from "./api";

interface Props {
  logs: LogEntry[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString();
}

function typeLabel(type: string): string {
  const m: Record<string, string> = {
    idle: "idle",
    thinking: "scan",
    candidates: "found",
    chosen: "chose",
    bought: "buy",
    hold: "hold",
    sell: "sell",
    skip: "skip",
    error: "err",
  };
  return m[type] ?? type;
}

function typeClass(type: string): string {
  if (type === "buy" || type === "chose") return "log-buy";
  if (type === "sell") return "log-sell";
  if (type === "hold") return "log-hold";
  if (type === "error") return "log-error";
  return "log-default";
}

export function LogsPanel({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="panel logs-panel">
        <div className="panel-title">[ ai logs — live ]</div>
        <p className="logs-empty">no logs yet. when lobbi runs, decision logs will appear here.</p>
      </div>
    );
  }

  return (
    <div className="panel logs-panel">
      <div className="panel-title">[ ai logs — live ]</div>
      <p className="logs-desc">lobbi&apos;s internal reasoning—scanning, choosing, holding, selling.</p>
      <div className="logs-list">
        {logs.map((log) => (
          <div key={log.id} className={`logs-row ${typeClass(log.type)}`}>
            <span className="logs-badge">{typeLabel(log.type)}</span>
            <span className="logs-time">{formatTime(log.timestamp)}</span>
            <span className="logs-msg">{log.message}</span>
            {log.pnlPercent != null && (
              <span className={`logs-pnl ${(log.pnlPercent ?? 0) >= 0 ? "positive" : "negative"}`}>
                {log.pnlPercent >= 0 ? "+" : ""}{log.pnlPercent.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
