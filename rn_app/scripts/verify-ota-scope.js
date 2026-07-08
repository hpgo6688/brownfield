#!/usr/bin/env node

const path = require('path');
const { loadConfig } = require('metro-config');
const { buildGraph } = require('metro');

const projectRoot = path.join(__dirname, '..');
const entry = path.join(projectRoot, 'index.js');

const FORBIDDEN_PATTERNS = [
  /[/\\]bundles[/\\]ota_/,
  /[/\\]screens[/\\]ota[/\\]/,
];

async function main() {
  const config = await loadConfig({ projectRoot });
  const graph = await buildGraph(config, {
    entries: [entry],
    platform: 'ios',
    dev: true,
  });

  const violations = [];
  for (const module of graph.dependencies.values()) {
    const modulePath = module.path;
    if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(modulePath))) {
      violations.push(modulePath);
    }
  }

  if (violations.length > 0) {
    console.error(
      'OTA scope verification failed: main bundle graph must not include OTA-only paths.',
    );
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log('OTA scope OK: main bundle graph excludes bundles/ota_* and screens/ota/.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
