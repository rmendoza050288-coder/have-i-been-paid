#!/bin/zsh
# ── Have I Been Paid? – launcher ──────────────────────────────────────────────
# Double-click this file in Finder to start the app.

cd "$(dirname "$0")" || exit 1
PROJECT_DIR="$PWD"
PORT=3000

# Load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install it from https://nodejs.org and try again."
  read -r "?Press Enter to close..."
  exit 1
fi

# Your data lives in the browser's localStorage, which is scoped per-origin:
# localhost:3000 and localhost:3001 are DIFFERENT origins. The app must always
# run on port 3000, so we free it (only if a leftover copy of this app holds
# it) and refuse to start anywhere else.
PIDS=$(lsof -ti :$PORT -sTCP:LISTEN 2>/dev/null)
if [[ -n "$PIDS" ]]; then
  for pid in ${(f)PIDS}; do
    # Only stop processes that were started from this project folder
    if [[ "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null)" == *"n$PROJECT_DIR"* ]]; then
      echo "Stopping previous instance (pid $pid)..."
      kill "$pid" 2>/dev/null
    else
      echo "Port $PORT is in use by another program (pid $pid):"
      ps -p "$pid" -o command= 2>/dev/null
      echo "Quit it (for example the desktop app) and run this again."
      read -r "?Press Enter to close..."
      exit 1
    fi
  done
  for i in $(seq 1 15); do
    lsof -ti :$PORT -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 1
  done
  if lsof -ti :$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is still busy. Please close the other instance and try again."
    read -r "?Press Enter to close..."
    exit 1
  fi
fi

# Install dependencies on first run or when package files changed
if [[ ! -d node_modules || package.json -nt node_modules || package-lock.json -nt node_modules ]]; then
  echo "Installing dependencies..."
  npm install || { read -r "?npm install failed. Press Enter to close..."; exit 1; }
  touch node_modules
fi

# Run the optimized production build (much faster than `next dev`).
# Rebuild only when the source is newer than the last build.
NEEDS_BUILD=0
if [[ ! -f .next/BUILD_ID ]]; then
  NEEDS_BUILD=1
elif [[ -n "$(find app public package.json package-lock.json next.config.js tailwind.config.js postcss.config.js -type f -newer .next/BUILD_ID 2>/dev/null | head -1)" ]]; then
  NEEDS_BUILD=1
fi
if [[ $NEEDS_BUILD -eq 1 ]]; then
  echo "Building the app (only needed after updates)..."
  npm run build || { read -r "?Build failed. Press Enter to close..."; exit 1; }
fi

echo "Starting Have I Been Paid?..."
# Run in the background so we can open the browser once it responds.
npx next start -p $PORT &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

for i in $(seq 1 30); do
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "The server stopped unexpectedly. Check the output above."
    read -r "?Press Enter to close..."
    exit 1
  fi
  if curl -s -o /dev/null "http://localhost:$PORT"; then
    echo "Opening http://localhost:$PORT ..."
    open "http://localhost:$PORT"
    break
  fi
  sleep 1
done

# Keep the terminal open so you can see logs / stop with Ctrl+C
wait $SERVER_PID
