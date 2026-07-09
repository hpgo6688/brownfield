const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_RELATIVE = 'config/approved-native-deps.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadPolicyConfig(projectRoot, configRelativePath = DEFAULT_CONFIG_RELATIVE) {
  const configPath = path.join(projectRoot, configRelativePath);
  const config = readJson(configPath);

  const platform = new Set(config.platformPackages ?? []);
  const approved = new Set(config.approvedNativePackages ?? []);

  return {
    configPath,
    config,
    allowedNative: new Set([...platform, ...approved]),
    platform,
    approved,
  };
}

function detectNativeReason(packageDir, pkgJson) {
  if (!fs.existsSync(packageDir)) {
    return null;
  }

  if (pkgJson.codegenConfig) {
    return 'codegenConfig';
  }

  if (fs.existsSync(path.join(packageDir, 'react-native.config.js'))) {
    return 'react-native.config.js';
  }

  const iosDir = path.join(packageDir, 'ios');
  if (fs.existsSync(iosDir)) {
    const iosEntries = fs.readdirSync(iosDir);
    if (iosEntries.some(entry => entry.endsWith('.podspec'))) {
      return 'ios/*.podspec';
    }
  }

  const rootEntries = fs.readdirSync(packageDir);
  if (rootEntries.some(entry => entry.endsWith('.podspec'))) {
    return '*.podspec';
  }

  if (fs.existsSync(path.join(packageDir, 'android', 'build.gradle'))) {
    return 'android/build.gradle';
  }

  if (fs.existsSync(path.join(packageDir, 'android', 'src'))) {
    return 'android/src';
  }

  return null;
}

function resolvePackageDir(packageName, projectRoot) {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [projectRoot],
    });
    return path.dirname(packageJsonPath);
  } catch {
    return null;
  }
}

function loadProductionDependencyTree(projectRoot) {
  let treeJson;
  try {
    treeJson = JSON.parse(
      execSync('npm ls --json --omit=dev --all', {
        cwd: projectRoot,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      }),
    );
  } catch (error) {
    if (error.stdout) {
      treeJson = JSON.parse(error.stdout);
    } else {
      throw new Error(
        `Failed to read production dependency tree. Run npm install in rn_app first.\n${error.message}`,
      );
    }
  }

  const names = new Set();
  function walk(deps) {
    if (!deps) {
      return;
    }

    for (const [name, node] of Object.entries(deps)) {
      names.add(name);
      walk(node.dependencies);
    }
  }

  walk(treeJson.dependencies);
  return names;
}

function inspectNativePackages(projectRoot, dependencyNames) {
  const names =
    dependencyNames ?? loadProductionDependencyTree(projectRoot);
  const inspected = [];

  for (const name of [...names].sort()) {
    const packageDir = resolvePackageDir(name, projectRoot);
    if (!packageDir) {
      inspected.push({
        name,
        packageDir: null,
        isNative: false,
        reason: null,
        missing: true,
      });
      continue;
    }

    const pkgJson = readJson(path.join(packageDir, 'package.json'));
    const reason = detectNativeReason(packageDir, pkgJson);
    inspected.push({
      name,
      packageDir,
      isNative: reason !== null,
      reason,
      missing: false,
    });
  }

  return inspected;
}

function verifyNativeDependencyPolicy(projectRoot, options = {}) {
  const policy = loadPolicyConfig(projectRoot, options.configRelativePath);
  const inspected = inspectNativePackages(
    projectRoot,
    options.dependencyNames,
  );
  const nativePackages = inspected.filter(entry => entry.isNative);

  const unsupported = nativePackages.filter(
    entry => !policy.allowedNative.has(entry.name),
  );

  return {
    policy,
    inspected,
    nativePackages,
    unsupported,
    ok: unsupported.length === 0,
  };
}

module.exports = {
  DEFAULT_CONFIG_RELATIVE,
  detectNativeReason,
  loadPolicyConfig,
  loadProductionDependencyTree,
  inspectNativePackages,
  verifyNativeDependencyPolicy,
};
