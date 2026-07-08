#!/usr/bin/env bash
set -euo pipefail

# Smoke test: create Remote entry → upload bundle → manifest shows new version
# → file persisted under data/bundles/ → GET bundleUrl returns 200.
#
# Prerequisites: bundle-server running on :3001
# Usage: ./scripts/e2e-ota-smoke.sh [path-to-jsbundle]

SERVER="${BUNDLE_SERVER_URL:-http://127.0.0.1:3001}"
FEATURE_ID="order"
VERSION="9.9.9"
BUNDLE_FILE="${1:-../rn_app/dist/bundles/ota_order.0.0.1.ios.jsbundle}"

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
if (!f.bundleUrl) throw new Error('bundleUrl missing');
console.log('OK:', f.id, f.version, f.hash.slice(0, 20) + '...');
console.log('BUNDLE_URL=' + f.bundleUrl);
" "$MANIFEST" | tee /tmp/e2e-manifest-check.txt

BUNDLE_URL=$(grep '^BUNDLE_URL=' /tmp/e2e-manifest-check.txt | cut -d= -f2-)
FILENAME="${BUNDLE_URL##*/}"

echo "→ Verify server persisted file under data/bundles/"
if [[ ! -f "data/bundles/${FILENAME}" ]]; then
  echo "Expected data/bundles/${FILENAME} on disk" >&2
  exit 1
fi
echo "OK: data/bundles/${FILENAME}"

echo "→ Verify GET bundleUrl (simulates client download after restart)"
curl -sf "${BUNDLE_URL}" -o /tmp/e2e-downloaded.jsbundle
if [[ ! -s /tmp/e2e-downloaded.jsbundle ]]; then
  echo "Downloaded bundle is empty" >&2
  exit 1
fi
echo "OK: downloaded $(wc -c </tmp/e2e-downloaded.jsbundle) bytes"

echo "E2E smoke passed."
