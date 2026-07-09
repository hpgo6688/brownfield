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

const FEATURE_SIZE_WARN_BYTES = 600 * 1024;

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

function formatBytes(sizeBytes) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function isSharedOwnedBySplit(modulePath) {
  return (
    /\/bundles\/ota_shared\//.test(modulePath) ||
    /\/screens\/remote\/RemoteScreenShell\.tsx$/.test(modulePath) ||
    /\/screens\/remote\/components\//.test(modulePath) ||
    /\/screens\/remote\/navigation\//.test(modulePath) ||
    /\/node_modules\/@react-navigation\//.test(modulePath) ||
    /\/node_modules\/react-native-screens\//.test(modulePath) ||
    /\/node_modules\/react-native-gesture-handler\//.test(modulePath) ||
    /\/node_modules\/react-native-safe-area-context\//.test(modulePath)
  );
}

function isFeatureOwnedBySplit(modulePath, featureId) {
  if (featureId === 'shared') {
    return isSharedOwnedBySplit(modulePath);
  }

  if (featureId === 'order') {
    return (
      /\/bundles\/ota_order\//.test(modulePath) ||
      /\/screens\/remote\/order\//.test(modulePath)
    );
  }

  if (featureId === 'promo') {
    return (
      /\/bundles\/ota_promo\//.test(modulePath) ||
      /\/screens\/remote\/PromoNavigator/.test(modulePath) ||
      /\/screens\/remote\/promo\//.test(modulePath)
    );
  }

  return false;
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

function shouldExcludeFromSplitModule(
  module,
  mainModulePaths,
  splitModulePaths,
  splitTarget,
) {
  const modulePath = module.path;

  if (isFeatureOwnedBySplit(modulePath, splitTarget)) {
    return false;
  }

  if (splitTarget !== 'shared' && isSharedOwnedBySplit(modulePath)) {
    return true;
  }

  if (isCoreHostModule(modulePath)) {
    return true;
  }

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
      .filter(
        modulePath =>
          !isSharedOwnedBySplit(modulePath) &&
          !isFeatureOwnedBySplit(modulePath, 'order') &&
          !isFeatureOwnedBySplit(modulePath, 'promo'),
      ),
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

function collectDefinedModuleIds(code) {
  return new Set([...code.matchAll(/},(\d+),\[/g)].map(match => match[1]));
}

function auditSplitExternalDeps(bundlePath, mainBundlePath, sharedBundlePath) {
  const splitCode = fs.readFileSync(bundlePath, 'utf8');
  const mainCode = fs.readFileSync(mainBundlePath, 'utf8');
  const splitDefined = collectDefinedModuleIds(splitCode);
  const mainDefined = collectDefinedModuleIds(mainCode);
  const sharedDefined = sharedBundlePath
    ? collectDefinedModuleIds(fs.readFileSync(sharedBundlePath, 'utf8'))
    : new Set();

  const externalMainOnly = new Set();
  const externalShared = new Set();

  const modulePattern = /__d\(function[^]*?\},(\d+),\[([^\]]*)\]/g;
  let match;
  while ((match = modulePattern.exec(splitCode)) !== null) {
    const deps = match[2]
      .split(',')
      .map(dep => dep.trim())
      .filter(Boolean);
    for (const dep of deps) {
      if (splitDefined.has(dep)) {
        continue;
      }
      if (sharedDefined.has(dep)) {
        externalShared.add(dep);
        continue;
      }
      if (mainDefined.has(dep)) {
        externalMainOnly.add(dep);
      }
    }
  }

  return {
    mainOnly: [...externalMainOnly],
    shared: [...externalShared],
  };
}

async function createSplitMetroServer(
  baseConfig,
  mainModulePaths,
  splitEntry,
  splitTarget,
) {
  const splitModulePaths = await collectSplitModulePaths(baseConfig, splitEntry);
  console.log(`Split module count (${splitEntry}): ${splitModulePaths.size}`);

  const splitConfig = mergeConfig(baseConfig, {
    serializer: {
      ...baseConfig.serializer,
      getModulesRunBeforeMainModule: () => [],
      processModuleFilter: module => {
        return !shouldExcludeFromSplitModule(
          module,
          mainModulePaths,
          splitModulePaths,
          splitTarget,
        );
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
    splitTarget: null,
  },
  {
    name: 'ota_shared',
    featureId: 'shared',
    segmentId: featureSegments.shared,
    entry: 'bundles/ota_shared/index.js',
    output: `ota_shared.${releaseVersion}.ios.jsbundle`,
    split: true,
    splitTarget: 'shared',
  },
  {
    name: 'ota_order',
    featureId: 'order',
    segmentId: featureSegments.order,
    entry: 'bundles/ota_order/index.js',
    output: `ota_order.${releaseVersion}.ios.jsbundle`,
    split: true,
    splitTarget: 'order',
  },
  {
    name: 'ota_promo',
    featureId: 'promo',
    segmentId: featureSegments.promo,
    entry: 'bundles/ota_promo/index.js',
    output: `ota_promo.${releaseVersion}.ios.jsbundle`,
    split: true,
    splitTarget: 'promo',
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
    sharedBundle: null,
    bundles: [],
  };

  const mainMetroServer = await runMetro(baseConfig, { watch: false });
  const sizeReport = [];

  try {
    for (const bundle of bundles) {
      const outputPath = path.join(outputDir, bundle.output);
      console.log(`\n→ ${bundle.name}${bundle.split ? ' (split/modulesOnly)' : ''}`);

      const metroServer = bundle.split
        ? await createSplitMetroServer(
            baseConfig,
            mainModulePaths,
            bundle.entry,
            bundle.splitTarget,
          )
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
          const sharedBundlePath = path.join(
            outputDir,
            `ota_shared.${releaseVersion}.ios.jsbundle`,
          );
          if (fs.existsSync(mainBundlePath)) {
            const audit = auditSplitExternalDeps(
              outputPath,
              mainBundlePath,
              bundle.splitTarget === 'shared' ? null : sharedBundlePath,
            );
            if (audit.mainOnly.length > 0) {
              console.warn(
                `[split-audit] ${bundle.name} still references ${audit.mainOnly.length} main-only module id(s): ${audit.mainOnly.slice(0, 8).join(', ')}${audit.mainOnly.length > 8 ? '…' : ''}`,
              );
            } else if (bundle.splitTarget !== 'shared' && audit.shared.length > 0) {
              console.log(
                `[split-audit] ${bundle.name} references ${audit.shared.length} shared-segment module id(s) (expected)`,
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
      const sizeBytes = fs.statSync(outputPath).size;
      const entry = {
        featureId: bundle.featureId,
        segmentId: bundle.segmentId,
        name: bundle.name,
        version: bundle.featureId ? releaseVersion : null,
        file: bundle.output,
        hash,
        sizeBytes,
      };

      if (bundle.featureId === 'shared') {
        buildManifest.sharedBundle = {
          version: releaseVersion,
          hash,
          segmentId: bundle.segmentId,
          file: bundle.output,
          sizeBytes,
        };
      } else {
        buildManifest.bundles.push(entry);
      }

      sizeReport.push({ name: bundle.name, sizeBytes });
      console.log(`[size] ${bundle.name}: ${formatBytes(sizeBytes)} (${sizeBytes} bytes)`);

      if (
        (bundle.name === 'ota_order' || bundle.name === 'ota_promo') &&
        sizeBytes > FEATURE_SIZE_WARN_BYTES
      ) {
        console.warn(
          `[size] ${bundle.name} exceeds ${formatBytes(FEATURE_SIZE_WARN_BYTES)} target — consider moving more deps to ota_shared`,
        );
      }
    }
  } finally {
    await mainMetroServer.end();
  }

  const manifestPath = path.join(outputDir, 'build-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`);

  console.log('\n[size] Summary:');
  for (const row of sizeReport) {
    console.log(`  ${row.name}: ${formatBytes(row.sizeBytes)}`);
  }

  console.log(`\nDone. Bundles written to ${outputDir}`);
  console.log(`Build manifest: ${manifestPath}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
