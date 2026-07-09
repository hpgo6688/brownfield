const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  detectNativeReason,
  inspectNativePackages,
  loadPolicyConfig,
  verifyNativeDependencyPolicy,
} = require('../../../scripts/lib/native-dep-policy');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeTempProject(structure) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-dep-policy-'));

  for (const [relativePath, content] of Object.entries(structure.files ?? {})) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    if (typeof content === 'string') {
      fs.writeFileSync(fullPath, content);
    } else {
      writeJson(fullPath, content);
    }
  }

  return root;
}

describe('detectNativeReason', () => {
  it('detects codegenConfig', () => {
    const root = makeTempProject({
      files: {
        'node_modules/demo/package.json': {
          name: 'demo',
          version: '1.0.0',
          codegenConfig: { name: 'DemoSpec' },
        },
      },
    });

    const dir = path.join(root, 'node_modules/demo');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(detectNativeReason(dir, pkg)).toBe('codegenConfig');
  });

  it('detects ios podspec', () => {
    const root = makeTempProject({
      files: {
        'node_modules/demo/package.json': { name: 'demo', version: '1.0.0' },
        'node_modules/demo/ios/Demo.podspec': 'Pod::Spec.new',
      },
    });

    const dir = path.join(root, 'node_modules/demo');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(detectNativeReason(dir, pkg)).toBe('ios/*.podspec');
  });

  it('returns null for pure JS package', () => {
    const root = makeTempProject({
      files: {
        'node_modules/pure-js/package.json': { name: 'pure-js', version: '1.0.0', main: 'index.js' },
        'node_modules/pure-js/index.js': 'module.exports = {};',
      },
    });

    const dir = path.join(root, 'node_modules/pure-js');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    expect(detectNativeReason(dir, pkg)).toBeNull();
  });
});

describe('verifyNativeDependencyPolicy', () => {
  it('passes when native package is approved', () => {
    const root = makeTempProject({
      files: {
        'config/approved-native-deps.json': {
          platformPackages: ['react', 'react-native'],
          approvedNativePackages: ['native-demo'],
        },
        'node_modules/native-demo/package.json': {
          name: 'native-demo',
          version: '1.0.0',
          codegenConfig: { name: 'NativeDemoSpec' },
        },
      },
    });

    const result = verifyNativeDependencyPolicy(root, {
      dependencyNames: new Set(['native-demo', 'semver']),
    });

    expect(result.ok).toBe(true);
    expect(result.unsupported).toHaveLength(0);
  });

  it('fails when native package is not approved', () => {
    const root = makeTempProject({
      files: {
        'config/approved-native-deps.json': {
          platformPackages: ['react', 'react-native'],
          approvedNativePackages: [],
        },
        'node_modules/react-native-camera/package.json': {
          name: 'react-native-camera',
          version: '1.0.0',
        },
        'node_modules/react-native-camera/ios/RNCamera.podspec': 'Pod::Spec.new',
      },
    });

    const result = verifyNativeDependencyPolicy(root, {
      dependencyNames: new Set(['react-native-camera']),
    });

    expect(result.ok).toBe(false);
    expect(result.unsupported.map(entry => entry.name)).toEqual(['react-native-camera']);
  });

  it('allows pure JS packages without allowlist entry', () => {
    const root = makeTempProject({
      files: {
        'config/approved-native-deps.json': {
          platformPackages: ['react-native'],
          approvedNativePackages: [],
        },
        'node_modules/semver/package.json': {
          name: 'semver',
          version: '7.0.0',
          main: 'index.js',
        },
        'node_modules/semver/index.js': 'module.exports = {};',
      },
    });

    const result = verifyNativeDependencyPolicy(root, {
      dependencyNames: new Set(['semver']),
    });

    expect(result.ok).toBe(true);
    expect(result.nativePackages).toHaveLength(0);
  });
});

describe('inspectNativePackages', () => {
  it('marks missing packages without failing inspection', () => {
    const root = makeTempProject({
      files: {
        'config/approved-native-deps.json': {
          platformPackages: [],
          approvedNativePackages: [],
        },
      },
    });

    const inspected = inspectNativePackages(root, new Set(['missing-package']));
    expect(inspected[0]).toMatchObject({
      name: 'missing-package',
      missing: true,
      isNative: false,
    });
  });
});

describe('loadPolicyConfig', () => {
  it('merges platform and approved native sets', () => {
    const root = makeTempProject({
      files: {
        'config/approved-native-deps.json': {
          platformPackages: ['react-native'],
          approvedNativePackages: ['react-native-fs'],
        },
      },
    });

    const policy = loadPolicyConfig(root);
    expect(policy.allowedNative.has('react-native')).toBe(true);
    expect(policy.allowedNative.has('react-native-fs')).toBe(true);
    expect(policy.allowedNative.has('react-native-camera')).toBe(false);
  });
});
