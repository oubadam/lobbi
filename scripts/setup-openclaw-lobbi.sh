#!/usr/bin/env bash
# Setup OpenClaw + LOBBI so the OpenClaw AI agent can control LOBBI trading.
# Prereq: Node >= 22.12.0 (run: nvm install 22 && nvm use 22, or install from nodejs.org)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOBBI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_SKILLS="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}/skills"

echo "==> LOBBI root: $LOBBI_ROOT"

# Check Node
NODE_VER=$(node -v 2>/dev/null || echo "none")
if [[ ! "$NODE_VER" =~ ^v2[2-9] ]] && [[ ! "$NODE_VER" =~ ^v3 ]]; then
  echo "ERROR: OpenClaw requires Node >= 22.12.0. You have: $NODE_VER"
  echo "Upgrade: nvm install 22 && nvm use 22   OR   https://nodejs.org"
  exit 1
fi

# Ensure OpenClaw is installed
if ! command -v openclaw &>/dev/null; then
  echo "==> Installing OpenClaw..."
  npm install -g openclaw@latest
fi

# Create workspace/skills dir
mkdir -p "$OPENCLAW_SKILLS"

# Install LOBBI skill
echo "==> Installing LOBBI trading skill..."
if [ -d "$OPENCLAW_SKILLS/lobbi-trading" ]; then
  rm -rf "$OPENCLAW_SKILLS/lobbi-trading"
fi
cp -r "$LOBBI_ROOT/openclaw-skill" "$OPENCLAW_SKILLS/lobbi-trading"
echo "    Skill installed at $OPENCLAW_SKILLS/lobbi-trading"

# Build LOBBI
echo "==> Building LOBBI..."
cd "$LOBBI_ROOT"
npm run build 2>/dev/null || true

echo ""
echo "==> Done. Next steps:"
echo ""
echo "1. Run OpenClaw onboarding (first-time only, interactive):"
echo "   openclaw onboard --install-daemon"
echo "   (You'll need API keys: Anthropic, OpenAI, or another model provider)"
echo ""
echo "2. Start LOBBI backend (in one terminal):"
echo "   cd $LOBBI_ROOT"
echo "   DATA_DIR=./data node backend/dist/index.js"
echo ""
echo "3. Start OpenClaw gateway (in another terminal):"
echo "   openclaw gateway --port 18789"
echo ""
echo "4. Open the dashboard and chat:"
echo "   openclaw dashboard"
echo "   Then ask: 'What can LOBBI buy?' or 'Buy a LOBBI coin'"
echo ""
echo "IMPORTANT: Do NOT run 'npm run dev:bot' — only OpenClaw should drive trades."
echo ""
