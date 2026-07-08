#!/usr/bin/env bash
set -euo pipefail

# Build and upload OTA bundles for order + promo across semver versions.
#
# Usage:
#   ./scripts/publish-ota-versions.sh 0.0.1 0.0.2 0.0.3 0.0.4 0.0.5
#   ./scripts/publish-ota-versions.sh          # defaults to 0.0.1–0.0.5
#
# Prerequisites: bundle-server running on :3001

SERVER="${BUNDLE_SERVER_URL:-http://127.0.0.1:3001}"
RN_APP="../rn_app"
DIST="../bundle-server/dist/bundles"

if [[ $# -gt 0 ]]; then
  VERSIONS=("$@")
else
  VERSIONS=(0.0.1 0.0.2 0.0.3 0.0.4 0.0.5)
fi

if ! curl -sf "${SERVER}/health" >/dev/null; then
  echo "bundle-server is not running at ${SERVER}" >&2
  echo "Start it: cd bundle-server && npm run dev" >&2
  exit 1
fi

for VERSION in "${VERSIONS[@]}"; do
  echo ""
  echo "========== Build ${VERSION} =========="
  (cd "${RN_APP}" && npm run build:bundles -- --version "${VERSION}")

  ORDER_FILE="${DIST}/ota_order.${VERSION}.ios.jsbundle"
  PROMO_FILE="${DIST}/ota_promo.${VERSION}.ios.jsbundle"

  for FEATURE in order promo; do
    FILE="${DIST}/ota_${FEATURE}.${VERSION}.ios.jsbundle"
    if [[ ! -f "${FILE}" ]]; then
      echo "Missing bundle: ${FILE}" >&2
      exit 1
    fi
    echo "→ Upload ${FEATURE}@${VERSION}"
    ./scripts/upload-bundle.sh "${FEATURE}" "${VERSION}" "${FILE}"
  done
done

echo ""
LAST="${VERSIONS[${#VERSIONS[@]}-1]}"
echo "Done. Published ${#VERSIONS[@]} version(s); latest active: ${LAST}"
