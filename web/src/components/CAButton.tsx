import { useState, useCallback } from "react";
import { LOBBI_CA } from "../site-config";

interface Props {
  variant?: "header" | "footer";
}

export function CAButton({ variant = "header" }: Props) {
  const [copied, setCopied] = useState(false);
  const ca = LOBBI_CA && LOBBI_CA !== "YOUR_CONTRACT_ADDRESS_HERE" ? LOBBI_CA : "...";

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(ca).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [ca]);

  const short = ca.length > 10 ? ca.slice(0, 6) + "…" + ca.slice(-4) : ca;
  const isCompact = variant === "header";

  return (
    <button
      type="button"
      className={`ca-button ca-button-${variant}`}
      onClick={copyAddress}
      title="copy contract address"
    >
      <span className="ca-label">ca:</span>{" "}
      <span className="ca-address">{isCompact ? short : ca}</span>
      {copied && <span className="ca-copied"> ✓</span>}
    </button>
  );
}
