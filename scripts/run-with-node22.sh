#!/usr/bin/env bash
# Run OpenClaw with Node 22. Use this if your default Node is < 22.
# Usage: ./scripts/run-with-node22.sh openclaw gateway --port 18789

NODE22_DIR="/tmp/node-v22.12.0-darwin-x64"
if [ ! -d "$NODE22_DIR" ]; then
  echo "Node 22 not found at $NODE22_DIR. Downloading..."
  curl -fsSL "https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-x64.tar.gz" -o /tmp/node22.tar.gz
  tar -xzf /tmp/node22.tar.gz -C /tmp
fi
export PATH="$NODE22_DIR/bin:$PATH"
exec "$@"
