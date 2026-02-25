/**
 * Lobbi autonomous sell decision via LLM.
 * Requires ANTHROPIC_API_KEY or OPENAI_API_KEY in env.
 */

export interface PositionQuote {
  unrealizedPnlPercent: number | null;
  unrealizedPnlSol: number | null;
  holdSeconds: number;
  buyPriceUsd: number | null;
  currentPriceUsd: number | null;
}

export async function askLobbiShouldSell(
  symbol: string,
  whyBought: string,
  quote: PositionQuote
): Promise<{ shouldSell: boolean; reason?: string }> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return { shouldSell: false };
  }

  const pnl = quote.unrealizedPnlPercent ?? 0;
  const holdMin = Math.floor((quote.holdSeconds ?? 0) / 60);
  const prompt = `You are Lobbi, an autonomous AI that trades Solana memecoins. You hold ${symbol}.

Why we bought: ${whyBought}

Current: PnL ${pnl.toFixed(1)}%, held ${holdMin}m. No fixed TP/SL—you decide.

Should we SELL now? Reply with exactly "SELL" or "HOLD". If SELL, add one short reason after a comma.`;

  try {
    let text = "";
    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 64,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        console.warn("[Lobbi] Anthropic API error:", res.status);
        return { shouldSell: false };
      }
      const data = (await res.json()) as { content?: { text?: string }[] };
      text = data.content?.[0]?.text ?? "";
    } else if (openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 64,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        console.warn("[Lobbi] OpenAI API error:", res.status);
        return { shouldSell: false };
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      text = data.choices?.[0]?.message?.content ?? "";
    }
    const upper = text.toUpperCase().trim();
    const shouldSell = upper.startsWith("SELL");
    const reason = shouldSell && text.includes(",") ? text.split(",").slice(1).join(",").trim() : undefined;
    return { shouldSell, reason };
  } catch (e) {
    console.warn("[Lobbi] LLM error:", e);
    return { shouldSell: false };
  }
}
