#!/bin/zsh
# ── Have I Been Paid? – launcher ──────────────────────────────────────────────
# Double-click this file in Finder to start the app.

# Change to this script's directory so it works from anywhere
cd "$(dirname "$0")"

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Kill any leftover Next.js processes so we always get port 3000
echo "Stopping any previously running instances..."
pkill -f "next dev" 2>/dev/null
sleep 1

# Start Next.js and pipe output through tee so we can watch it live
# and also capture it to detect the actual port
LOGFILE=$(mktemp)
echo "Starting Have I Been Paid?..."
npm run dev 2>&1 | tee "$LOGFILE" &
SERVER_PID=$!

# Wait until Next.js prints the Local URL line, then extract the port
PORT=""
for i in $(seq 1 20); do
  sleep 1
  PORT=$(grep -oE 'localhost:[0-9]+' "$LOGFILE" | head -1 | cut -d: -f2)
  if [[ -n "$PORT" ]]; then
    break
  fi
done

rm -f "$LOGFILE"

if [[ -z "$PORT" ]]; then
  echo "Could not detect port. Check the output above."
else
  echo "Opening http://localhost:$PORT ..."
  open "http://localhost:$PORT"
fi

# Keep the terminal window open so you can see logs / stop with Ctrl+C
wait $SERVER_PID
