#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# build-installer.sh — Builds a macOS DMG for "Have I Been Paid?"
#
# Usage: bash build-installer.sh
#
# Output: dist/Have I Been Paid-<version>-arm64.dmg   (Apple Silicon)
#         dist/Have I Been Paid-<version>-x64.dmg     (Intel)
#
# Requirements:
#   • Node.js (only needed on the BUILD machine, not the end user's machine)
#   • npm
#
# Note on code signing:
#   If you have an Apple Developer certificate installed, electron-builder
#   will sign the app automatically. Without a certificate, the app will
#   still work but macOS Gatekeeper will show a warning on first open.
#   Right-click → Open on the first launch to bypass that warning.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

echo ""
echo "══════════════════════════════════════════"
echo "  Have I Been Paid? — DMG Builder"
echo "══════════════════════════════════════════"
echo ""

# 1. Install / update dependencies (includes electron + electron-builder)
echo "▶ Installing dependencies…"
npm install
echo ""

# 2. Build the Next.js app with standalone output
echo "▶ Building Next.js app (this may take a minute)…"
npm run build
echo ""

# 3. Copy static assets into the standalone folder
#    (Next.js standalone doesn't include .next/static automatically)
echo "▶ Copying static assets into standalone build…"
cp -r .next/static .next/standalone/.next/static

# Copy public/ if it exists
if [ -d "public" ]; then
  cp -r public .next/standalone/public
fi
echo ""

# 4. Build the Electron DMG
echo "▶ Building DMG installer…"
npx electron-builder --mac dmg --universal
echo ""

echo "══════════════════════════════════════════"
echo "  ✓ Done!  Find your DMG in: dist/"
echo "══════════════════════════════════════════"
echo ""
echo "Distribute the .dmg file to your users."
echo "On first launch, the app will prompt for Google credentials."
echo ""
