#!/usr/bin/env bash
set -euo pipefail

# Example CI upload script for Scheme 2 OTA bundles.
#
# Usage:
#   ./scripts/upload-bundle.sh shared 1.0.0 dist/bundles/ota_shared.1.0.0.ios.jsbundle
#   ./scripts/upload-bundle.sh order 1.0.0 dist/bundles/ota_order.1.0.0.ios.jsbundle
#
# Env:
#   BUNDLE_SERVER_URL  default http://127.0.0.1:3001

FEATURE_ID="${1:?featureId required}"
VERSION="${2:?version required}"
FILE_PATH="${3:?bundle file path required}"
SERVER="${BUNDLE_SERVER_URL:-http://127.0.0.1:3001}"

if [[ ! -f "$FILE_PATH" ]]; then
  echo "File not found: $FILE_PATH" >&2
  exit 1
fi

curl -sf -X POST "${SERVER}/api/bundles/upload" \
  -F "featureId=${FEATURE_ID}" \
  -F "version=${VERSION}" \
  -F "file=@${FILE_PATH}" \
  | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); console.log(JSON.stringify({ release: j.release, featureCount: j.manifest?.features?.length }, null, 2));"

echo "Uploaded ${FEATURE_ID}@${VERSION}"
