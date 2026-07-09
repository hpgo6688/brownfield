#!/usr/bin/env node

const path = require('path');
const {
  inspectNativePackages,
  verifyNativeDependencyPolicy,
} = require('./lib/native-dep-policy');

const projectRoot = path.join(__dirname, '..');

function printAudit(result) {
  console.log('Native packages in production dependency tree:\n');
  for (const entry of result.nativePackages) {
    const allowed = result.policy.allowedNative.has(entry.name) ? 'allowed' : 'UNSUPPORTED';
    console.log(`  ${entry.name}  [${entry.reason}]  (${allowed})`);
  }
  console.log(
    `\nTotal: ${result.nativePackages.length} native / ${result.inspected.length} packages scanned.`,
  );
}

function printExplain(packageName) {
  const inspected = inspectNativePackages(projectRoot);
  const entry = inspected.find(item => item.name === packageName);
  if (!entry) {
    console.error(`Package not found in production tree: ${packageName}`);
    process.exit(1);
  }

  console.log(`Package: ${entry.name}`);
  console.log(`Path: ${entry.packageDir ?? '(not resolved)'}`);
  console.log(`Native: ${entry.isNative ? 'yes' : 'no'}`);
  if (entry.reason) {
    console.log(`Reason: ${entry.reason}`);
  }
}

function printFailure(result) {
  console.error(
    'Native dependency policy failed: unsupported native package(s) in production tree.',
  );
  console.error('');
  console.error(
    'These packages require native code linked in the iOS shell (L2/L3 dependency).',
  );
  console.error('Business developers must not add them without shell maintainer approval.');
  console.error('');
  console.error('  File a Capability Request: docs/collaboration.md');
  console.error(
    '  Shell maintainer: add to rn_app/config/approved-native-deps.json and release a new Shell.',
  );
  console.error('');

  for (const entry of result.unsupported) {
    console.error(`  - ${entry.name} (${entry.reason})`);
  }

  console.error('');
  console.error(`Policy file: ${result.policy.configPath}`);
}

function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--explain' && args[1]) {
    printExplain(args[1]);
    return;
  }

  const result = verifyNativeDependencyPolicy(projectRoot);

  if (args.includes('--audit')) {
    printAudit(result);
    if (!result.ok) {
      process.exit(1);
    }
    return;
  }

  if (result.ok) {
    console.log(
      `Native dependency policy OK: ${result.nativePackages.length} native package(s) approved.`,
    );
    return;
  }

  printFailure(result);
  process.exit(1);
}

main();
