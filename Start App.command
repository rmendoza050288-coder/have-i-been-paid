#!/bin/zsh
# ── Have I Been Paid? – launcher ──────────────────────────────────────────────
# Double-click this file in Finder to start the app.

# Change to this script's directory so it works from anywhere
cd "$(dirname "$0")"

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Kill any leftover Next.js processes so we always get port 3000
# (Your invoices/timecards/etc. live in the browser's localStorage, which is
# scoped per-origin — localhost:3000 and localhost:3001 are DIFFERENT origins
# with separate storage. If port 3000 isn't fully free before we start the
# new server, Next.js silently falls back to 3001+, and the app looks like
# it "lost" all your data even though it's still safely sitting on the old
# port's origin. So we actively wait for port 3000 to be free instead of
# guessing with a fixed sleep.)
echo "Stopping any previously running instances..."
pkill -f "next dev" 2>/dev/null

echo "Waiting for port 3000 to be free..."
for i in $(seq 1 15); do
  if ! lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
# If something is still stubbornly holding port 3000 after ~15s, force it.
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3000 still in use — force killing leftover process..."
  lsof -ti :3000 -sTCP:LISTEN | xargs kill -9 2>/dev/null
  sleep 1
fi

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
