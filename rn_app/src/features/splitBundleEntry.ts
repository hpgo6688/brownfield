import { normalizeLocalPath } from './bundleCache';
import { isFeatureLoadedFromOta } from './registerFeature';

declare const global: {
  __r?: (moduleId: number) => unknown;
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

function runEntryModule(entryModuleId: number): void {
  if (typeof global.__r !== 'function') {
    throw new Error('Split bundle runtime unavailable (__r missing)');
  }

  global.__r(entryModuleId);
}

/**
 * Re-run split bundle entry so registerFeature() executes again after
 * clearFeatureRegistration(). Must run AFTER SplitBundleLoader.load() so
 * segment module ids exist in the runtime.
 */
export async function executeSplitBundleEntry(
  bundlePath: string,
  options?: { featureId?: string; requireRegistration?: boolean },
): Promise<boolean> {
  const path = normalizeLocalPath(bundlePath);
  const code = await readBundleCode(path);
  if (!code) {
    const message = `cannot read split bundle: ${path}`;
    if (options?.requireRegistration) {
      throw new Error(message);
    }
    if (__DEV__) {
      console.warn(`[bundleLoader] ${message}`);
    }
    return false;
  }

  const entryModuleId = parseSplitBundleEntryModuleId(code);
  if (entryModuleId == null) {
    const message = `split bundle missing entry __r(): ${path}`;
    if (options?.requireRegistration) {
      throw new Error(message);
    }
    if (__DEV__) {
      console.warn(`[bundleLoader] ${message}`);
    }
    return false;
  }

  const featureId = options?.featureId;

  try {
    runEntryModule(entryModuleId);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    const message = `split bundle entry __r(${entryModuleId}) failed: ${cause}`;
    if (options?.requireRegistration) {
      throw new Error(message);
    }
    if (__DEV__) {
      console.warn(`[bundleLoader] ${message}`);
    }
    return false;
  }

  if (featureId && isFeatureLoadedFromOta(featureId)) {
    return true;
  }

  try {
    runEntryModule(entryModuleId);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    const message = `split bundle entry retry __r(${entryModuleId}) failed: ${cause}`;
    if (options?.requireRegistration) {
      throw new Error(message);
    }
    if (__DEV__) {
      console.warn(`[bundleLoader] ${message}`);
    }
    return false;
  }

  const registered = featureId ? isFeatureLoadedFromOta(featureId) : true;
  if (!registered && options?.requireRegistration) {
    throw new Error(`split bundle entry did not register feature "${featureId}"`);
  }

  return registered;
}
