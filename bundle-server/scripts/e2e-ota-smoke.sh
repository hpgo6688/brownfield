#!/usr/bin/env bash
set -euo pipefail

# Smoke test: create Remote entry → upload bundle → manifest shows new version.
#
# Prerequisites: bundle-server running on :3001
# Usage: ./scripts/e2e-ota-smoke.sh

SERVER="${BUNDLE_SERVER_URL:-http://127.0.0.1:3001}"
FEATURE_ID="order"
VERSION="9.9.9"
BUNDLE_FILE="${1:-dist/bundles/order.0.0.1.ios.jsbundle}"

if ! curl -sf "${SERVER}/health" >/dev/null; then
  echo "bundle-server is not running at ${SERVER}" >&2
  echo "Start it in another terminal: cd bundle-server && npm run dev" >&2
  exit 1
fi

if [[ ! -f "$BUNDLE_FILE" ]]; then
  echo "Bundle file not found: $BUNDLE_FILE" >&2
  echo "Run: cd ../rn_app && npm run build:bundles" >&2
  exit 1
fi

echo "→ Upload ${FEATURE_ID}@${VERSION}"
curl -sf -X POST "${SERVER}/api/bundles/upload" \
  -F "featureId=${FEATURE_ID}" \
  -F "version=${VERSION}" \
  -F "file=@${BUNDLE_FILE}" \
  -o /tmp/upload-result.json

echo "→ Verify manifest"
MANIFEST=$(curl -sf "${SERVER}/api/manifest")
node -e "
const m = JSON.parse(process.argv[1]);
const f = m.features.find(x => x.id === '${FEATURE_ID}');
if (!f) throw new Error('feature ${FEATURE_ID} missing');
if (f.version !== '${VERSION}') throw new Error('expected version ${VERSION}, got ' + f.version);
if (!f.hash || f.hash === 'sha256:unset') throw new Error('hash not set after upload');
console.log('OK:', f.id, f.version, f.hash.slice(0, 20) + '...');
" "$MANIFEST"

echo "E2E smoke passed."
