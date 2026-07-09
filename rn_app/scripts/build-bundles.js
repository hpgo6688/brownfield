#!/usr/bin/env node

const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadConfig, mergeConfig } = require('metro-config');
const { buildGraph, runMetro } = require('metro');
const outputBundle = require('metro/private/shared/output/bundle');

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

function isFeatureOwnedBySplit(modulePath) {
  return (
    /\/bundles\/ota_(order|promo)\//.test(modulePath) ||
    /\/screens\/remote\/RemoteScreenShell\.tsx$/.test(modulePath) ||
    /\/screens\/remote\/components\//.test(modulePath) ||
    /\/screens\/remote\/order\//.test(modulePath) ||
    /\/node_modules\/@react-navigation\//.test(modulePath) ||
    /\/node_modules\/react-native-screens\//.test(modulePath) ||
    /\/node_modules\/react-native-gesture-handler\//.test(modulePath)
  );
}

function isCoreHostModule(modulePath) {
  if (
    modulePath.includes('__prelude__') ||
    modulePath.includes('/node_modules/metro-runtime/src/polyfills/require.js') ||
    modulePath.includes('/node_modules/react-native/Libraries/polyfills/') ||
    modulePath.includes('/node_modules/react-native/Libraries/Core/InitializeCore.js')
  ) {
    return true;
  }

  if (/\/node_modules\/react\//.test(modulePath)) {
    return true;
  }

  if (
    /\/node_modules\/react-native\//.test(modulePath) &&
    !/\/node_modules\/react-native-screens\//.test(modulePath) &&
    !/\/node_modules\/react-native-gesture-handler\//.test(modulePath)
  ) {
    return true;
  }

  return false;
}

function shouldExcludeFromSplitModule(module, mainModulePaths, splitModulePaths) {
  const modulePath = module.path;

  if (isFeatureOwnedBySplit(modulePath)) {
    return false;
  }

  if (isCoreHostModule(modulePath)) {
    return true;
  }

  // Host-only modules (FeatureHost graph) stay out of split. Shared deps that
  // the split entry also needs (e.g. use-latest-callback for React Navigation)
  // must remain in the split — Metro dev lazy main may not register them yet.
  if (mainModulePaths.has(modulePath) && !splitModulePaths.has(modulePath)) {
    return true;
  }

  return false;
}

async function collectSplitModulePaths(config, entryFile) {
  const graph = await buildGraph(config, {
    entries: [path.join(projectRoot, entryFile)],
    platform: 'ios',
    dev: isDev,
  });

  return new Set([...graph.dependencies.values()].map(module => module.path));
}

async function collectMainModulePaths(config) {
  const graph = await buildGraph(config, {
    entries: [path.join(projectRoot, 'index.js')],
    platform: 'ios',
    dev: isDev,
  });

  return new Set(
    [...graph.dependencies.values()]
      .map(module => module.path)
      .filter(modulePath => !isFeatureOwnedBySplit(modulePath)),
  );
}

function finalizeSplitBundle(bundlePath, entryFile) {
  let code = fs.readFileSync(bundlePath, 'utf8');
  const entryLabel = entryFile.replace(/\\/g, '/');
  const entryPattern = new RegExp(
    `},(\\d+),\\[[^\\]]*\\],"${entryLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\)`,
  );
  let entryModuleId = code.match(entryPattern)?.[1] ?? null;

  if (!entryModuleId) {
    const fallbackPattern = new RegExp(
      `},(\\d+),\\[[^\\]]*\\],"[^"]*${path.basename(entryLabel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\)`,
    );
    entryModuleId = code.match(fallbackPattern)?.[1] ?? null;
  }

  if (!entryModuleId) {
    const trailingEntry = [...code.matchAll(/__r\((\d+)\);/g)].pop();
    entryModuleId = trailingEntry?.[1] ?? null;
  }

  if (!entryModuleId) {
    console.warn(`Could not locate entry module id for ${entryLabel} in ${bundlePath}`);
    return;
  }

  code = code.replace(/\n__r\(\d+\);/g, '');
  code = `${code.trim()}\n__r(${entryModuleId});\n`;
  fs.writeFileSync(bundlePath, code);
  console.log(`Finalized split bundle entry __r(${entryModuleId})`);
}

async function buildBundle(metroServer, options) {
  const bundle = await outputBundle.build(metroServer, options);
  await outputBundle.save(
    bundle,
    {
      bundleOutput: options.out,
      bundleEncoding: 'utf8',
      sourcemapOutput: options.sourceMapOut,
    },
    message => console.log(message),
  );
}

function auditSplitExternalDeps(bundlePath, mainBundlePath) {
  const splitCode = fs.readFileSync(bundlePath, 'utf8');
  const mainCode = fs.readFileSync(mainBundlePath, 'utf8');
  const defined = code =>
    new Set([...code.matchAll(/},(\d+),\[/g)].map(match => match[1]));
  const splitDefined = defined(splitCode);
  const mainDefined = defined(mainCode);
  const external = new Set();

  const modulePattern = /__d\(function[^]*?\},(\d+),\[([^\]]*)\]/g;
  let match;
  while ((match = modulePattern.exec(splitCode)) !== null) {
    const deps = match[2]
      .split(',')
      .map(dep => dep.trim())
      .filter(Boolean);
    for (const dep of deps) {
      if (!splitDefined.has(dep) && mainDefined.has(dep)) {
        external.add(dep);
      }
    }
  }

  return [...external];
}

async function createSplitMetroServer(baseConfig, mainModulePaths, splitEntry) {
  const splitModulePaths = await collectSplitModulePaths(baseConfig, splitEntry);
  console.log(`Split module count (${splitEntry}): ${splitModulePaths.size}`);

  const splitConfig = mergeConfig(baseConfig, {
    serializer: {
      ...baseConfig.serializer,
      getModulesRunBeforeMainModule: () => [],
      processModuleFilter: module => {
        return !shouldExcludeFromSplitModule(module, mainModulePaths, splitModulePaths);
      },
    },
  });

  return runMetro(splitConfig, { watch: false });
}

const releaseVersion = readVersion();

const otaReleaseVersionPath = path.join(projectRoot, 'bundles', 'otaReleaseVersion.ts');
fs.writeFileSync(
  otaReleaseVersionPath,
  `// AUTO-GENERATED by scripts/build-bundles.js — do not edit by hand.\nexport const OTA_RELEASE_VERSION = '${releaseVersion}';\n`,
);
console.log(`OTA release version: ${releaseVersion} → bundles/otaReleaseVersion.ts`);

const featureSegments = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'config/feature-segments.json'), 'utf8'),
);

const bundles = [
  {
    name: 'main',
    featureId: null,
    segmentId: null,
    entry: 'index.js',
    output: 'main.ios.jsbundle',
    split: false,
  },
  {
    name: 'ota_order',
    featureId: 'order',
    segmentId: featureSegments.order,
    entry: 'bundles/ota_order/index.js',
    output: `ota_order.${releaseVersion}.ios.jsbundle`,
    split: true,
  },
  {
    name: 'ota_promo',
    featureId: 'promo',
    segmentId: featureSegments.promo,
    entry: 'bundles/ota_promo/index.js',
    output: `ota_promo.${releaseVersion}.ios.jsbundle`,
    split: true,
  },
];

async function main() {
  process.env.METRO_BUNDLE_BUILD = '1';

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(
    `Building ${bundles.length} iOS bundles (${isDev ? 'dev' : 'release'}, version ${releaseVersion})…`,
  );

  const baseConfig = await loadConfig({ projectRoot });
  const mainModulePaths = await collectMainModulePaths(baseConfig);
  console.log(`Main bundle module count: ${mainModulePaths.size}`);

  const buildManifest = {
    version: releaseVersion,
    builtAt: new Date().toISOString(),
    bundles: [],
  };

  const mainMetroServer = await runMetro(baseConfig, { watch: false });

  try {
    for (const bundle of bundles) {
      const outputPath = path.join(outputDir, bundle.output);
      console.log(`\n→ ${bundle.name}${bundle.split ? ' (split/modulesOnly)' : ''}`);

      const metroServer = bundle.split
        ? await createSplitMetroServer(baseConfig, mainModulePaths, bundle.entry)
        : mainMetroServer;

      try {
        await buildBundle(metroServer, {
          entryFile: bundle.entry,
          dev: isDev,
          platform: 'ios',
          minify: !isDev,
          modulesOnly: bundle.split,
          runModule: true,
          out: outputPath,
        });

        if (bundle.split) {
          finalizeSplitBundle(outputPath, bundle.entry);
          const mainBundlePath = path.join(outputDir, 'main.ios.jsbundle');
          if (fs.existsSync(mainBundlePath)) {
            const external = auditSplitExternalDeps(outputPath, mainBundlePath);
            if (external.length > 0) {
              console.warn(
                `[split-audit] ${bundle.name} still references ${external.length} main-only module id(s): ${external.slice(0, 8).join(', ')}${external.length > 8 ? '…' : ''}`,
              );
            } else {
              console.log(`[split-audit] ${bundle.name} has no main-only external deps`);
            }
          }
        }
      } finally {
        if (bundle.split) {
          await metroServer.end();
        }
      }

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
  } finally {
    await mainMetroServer.end();
  }

  const manifestPath = path.join(outputDir, 'build-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`);

  console.log(`\nDone. Bundles written to ${outputDir}`);
  console.log(`Build manifest: ${manifestPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
