import { normalizeLocalPath } from './bundleCache';
import { isFeatureLoadedFromOta } from './registerFeature';

declare const global: {
  __r?: (moduleId: number) => unknown;
  globalEvalWithSourceUrl?: (source: string, sourceUrl: string) => unknown;
};

type RNFSModule = {
  readFile: (path: string, encoding: 'utf8') => Promise<string>;
};

function getRNFS(): RNFSModule | null {
  try {
    const loaded = require('react-native-fs') as RNFSModule & { default?: RNFSModule };
    return loaded.default ?? loaded;
  } catch {
    return null;
  }
}

export function parseSplitBundleEntryModuleId(bundleCode: string): number | null {
  const matches = [...bundleCode.matchAll(/__r\((\d+)\);/g)];
  if (matches.length === 0) {
    return null;
  }

  const last = matches[matches.length - 1][1];
  return Number(last);
}

async function readBundleCode(bundlePath: string): Promise<string | null> {
  const RNFS = getRNFS();
  if (!RNFS) {
    return null;
  }

  return RNFS.readFile(normalizeLocalPath(bundlePath), 'utf8');
}

function runFullBundleEval(code: string, path: string): boolean {
  if (typeof global.globalEvalWithSourceUrl !== 'function') {
    return false;
  }

  try {
    global.globalEvalWithSourceUrl(code, path);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[bundleLoader] globalEvalWithSourceUrl failed', error);
    }
    return false;
  }
}

function runEntryModule(entryModuleId: number): boolean {
  if (typeof global.__r !== 'function') {
    return false;
  }

  try {
    global.__r(entryModuleId);
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn(`[bundleLoader] __r(${entryModuleId}) failed`, error);
    }
    return false;
  }
}

/**
 * Re-run split bundle entry so registerFeature() executes again after
 * clearFeatureRegistration(). Must run AFTER SplitBundleLoader.load() so
 * segment module ids exist in the runtime.
 */
export async function executeSplitBundleEntry(
  bundlePath: string,
  options?: { featureId?: string },
): Promise<boolean> {
  const path = normalizeLocalPath(bundlePath);
  const code = await readBundleCode(path);
  if (!code) {
    if (__DEV__) {
      console.warn(`[bundleLoader] cannot read split bundle: ${path}`);
    }
    return false;
  }

  const entryModuleId = parseSplitBundleEntryModuleId(code);
  if (entryModuleId == null) {
    if (__DEV__) {
      console.warn(`[bundleLoader] split bundle missing entry __r(): ${path}`);
    }
    return false;
  }

  const featureId = options?.featureId;

  runEntryModule(entryModuleId);
  if (featureId && isFeatureLoadedFromOta(featureId)) {
    return true;
  }

  runFullBundleEval(code, path);
  if (featureId && isFeatureLoadedFromOta(featureId)) {
    return true;
  }

  runEntryModule(entryModuleId);
  return featureId ? isFeatureLoadedFromOta(featureId) : true;
}
