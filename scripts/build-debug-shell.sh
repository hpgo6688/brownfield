#!/usr/bin/env bash
# Build a Debug simulator .app that can be shared with teammates.
# Teammates install this once, then only run `npm start` in rn_app to develop.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RN_APP="$ROOT/rn_app"
NATIVE_APP="$ROOT/ios_native"
OUT="$ROOT/dist/ios_native-debug-simulator.app"

echo "==> Packaging Debug BrownfieldLib (if needed)"
cd "$RN_APP"
npm run brownfield:package:ios:debug

echo "==> Building Debug simulator shell"
cd "$NATIVE_APP"
xcodebuild \
  -project "ios_native.xcodeproj" \
  -scheme "ios_native" \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath "$ROOT/dist/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  build

mkdir -p "$ROOT/dist"
rm -rf "$OUT"
cp -R "$ROOT/dist/DerivedData/Build/Products/Debug-iphonesimulator/ios_native.app" "$OUT"

echo ""
echo "Done. Share this folder with teammates:"
echo "  $OUT"
echo ""
echo "Teammate install (simulator already booted):"
echo "  xcrun simctl install booted \"$OUT\""
echo ""
echo "Teammate dev:"
echo "  cd rn_app && npm install && npm start"
echo "  # then launch ios_native on simulator"
