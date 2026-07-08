#!/usr/bin/env node

/**
 * Smoke test: GET /api/manifest returns v2 shape with OTA fields per feature.
 */

const baseUrl = process.env.MANIFEST_URL ?? 'http://127.0.0.1:3001/api/manifest';

async function main() {
  const response = await fetch(baseUrl);
  if (!response.ok) {
    throw new Error(`Manifest request failed (${response.status})`);
  }

  const manifest = await response.json();

  if (manifest.version !== 2) {
    throw new Error(`Expected manifest.version === 2, got ${manifest.version}`);
  }

  if (!Array.isArray(manifest.features) || manifest.features.length === 0) {
    throw new Error('Expected non-empty features array');
  }

  for (const feature of manifest.features) {
    for (const key of [
      'id',
      'title',
      'moduleName',
      'version',
      'hash',
      'bundleUrl',
      'minAppVersion',
    ]) {
      if (feature[key] == null || feature[key] === '') {
        throw new Error(`Feature "${feature.id}" missing field "${key}"`);
      }
    }
  }

  console.log(`OK: manifest v2 with ${manifest.features.length} features`);
}

main().catch(error => {
  console.error(error.message ?? error);
  process.exit(1);
});
