#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const outputDir = path.join(projectRoot, '..', 'bundle-server', 'dist', 'bundles');
const isDev = process.argv.includes('--dev');

const bundles = [
  { name: 'main', entry: 'index.js', output: 'main.ios.jsbundle' },
  { name: 'home', entry: 'bundles/home/index.js', output: 'home.ios.jsbundle' },
  {
    name: 'profile',
    entry: 'bundles/profile/index.js',
    output: 'profile.ios.jsbundle',
  },
  {
    name: 'settings',
    entry: 'bundles/settings/index.js',
    output: 'settings.ios.jsbundle',
  },
];

fs.mkdirSync(outputDir, { recursive: true });

console.log(`Building ${bundles.length} iOS bundles (${isDev ? 'dev' : 'release'})…`);

for (const bundle of bundles) {
  const command = [
    'npx react-native bundle',
    `--entry-file ${bundle.entry}`,
    `--bundle-output ${path.join(outputDir, bundle.output)}`,
    '--platform ios',
    `--dev ${isDev}`,
  ].join(' ');

  console.log(`\n→ ${bundle.name}`);
  execSync(command, { cwd: projectRoot, stdio: 'inherit' });
}

console.log(`\nDone. Bundles written to ${outputDir}`);
