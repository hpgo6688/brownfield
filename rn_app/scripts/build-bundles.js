#!/usr/bin/env node

const { createHash } = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const outputDir = path.join(projectRoot, '..', 'bundle-server', 'dist', 'bundles');
const isDev = process.argv.includes('--dev');

function readVersion() {
  const versionFlagIndex = process.argv.indexOf('--version');
  if (versionFlagIndex !== -1 && process.argv[versionFlagIndex + 1]) {
    return process.argv[versionFlagIndex + 1];
  }

  const pkg = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
  );
  return pkg.version ?? '0.0.1';
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}

const releaseVersion = readVersion();

const featureSegments = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'config/feature-segments.json'), 'utf8'),
);

const bundles = [
  { name: 'main', featureId: null, segmentId: null, entry: 'index.js', output: 'main.ios.jsbundle' },
  {
    name: 'order',
    featureId: 'order',
    segmentId: featureSegments.order,
    entry: 'bundles/order/index.js',
    output: `order.${releaseVersion}.ios.jsbundle`,
  },
  {
    name: 'promo',
    featureId: 'promo',
    segmentId: featureSegments.promo,
    entry: 'bundles/promo/index.js',
    output: `promo.${releaseVersion}.ios.jsbundle`,
  },
];

fs.mkdirSync(outputDir, { recursive: true });

console.log(
  `Building ${bundles.length} iOS bundles (${isDev ? 'dev' : 'release'}, version ${releaseVersion})…`,
);

const buildManifest = {
  version: releaseVersion,
  builtAt: new Date().toISOString(),
  bundles: [],
};

for (const bundle of bundles) {
  const outputPath = path.join(outputDir, bundle.output);
  const command = [
    'npx react-native bundle',
    `--entry-file ${bundle.entry}`,
    `--bundle-output ${outputPath}`,
    '--platform ios',
    `--dev ${isDev}`,
  ].join(' ');

  console.log(`\n→ ${bundle.name}`);
  execSync(command, { cwd: projectRoot, stdio: 'inherit' });

  const hash = sha256File(outputPath);
  buildManifest.bundles.push({
    featureId: bundle.featureId,
    segmentId: bundle.segmentId,
    name: bundle.name,
    version: bundle.featureId ? releaseVersion : null,
    file: bundle.output,
    hash,
  });
}

const manifestPath = path.join(outputDir, 'build-manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`);

console.log(`\nDone. Bundles written to ${outputDir}`);
console.log(`Build manifest: ${manifestPath}`);
