# Keeping secrets safe (never commit to GitHub)

## Where to put secrets

| Secret | Where | Gitignored |
|--------|-------|------------|
| LOBBI: `SOLANA_RPC_URL`, `WALLET_PRIVATE_KEY` | `lobbi/.env` or `lobbi/clawdbot/.env` | ✅ Yes |
| OpenClaw: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | `~/.openclaw/.env` or shell | ✅ Lives outside repo |

**Rule:** Never put real keys in any file that gets committed. `.env` is in `.gitignore`.

## You must obtain API keys yourself

- **Anthropic:** https://console.anthropic.com/ → API keys
- **OpenAI:** https://platform.openai.com/api-keys
- **Solana RPC:** Helius, QuickNode, or public endpoint
- **Wallet key:** Export from Phantom/Solflare (never share; use a dedicated bot wallet)

I (the AI) cannot create or retrieve these for you. Only you can sign in and generate them.

## Quick setup

```bash
# 1. Copy template (no real values)
cp .env.example .env

# 2. Edit .env with your real keys (they stay local, never pushed)
# 3. For OpenClaw, add keys to ~/.openclaw/.env or run:
export ANTHROPIC_API_KEY="sk-ant-..."
openclaw onboard --install-daemon
```

Before pushing to GitHub, run `git status` and ensure no `.env` or secret files are staged.
