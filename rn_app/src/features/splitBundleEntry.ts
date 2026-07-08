import {
  cachedBundleFileExists,
  isCachedBundleUsable,
  normalizeLocalPath,
} from './bundleCache';

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

/**
 * Re-run split bundle entry so registerFeature() executes again after
 * clearFeatureRegistration(). Native registerSegmentWithId may skip re-eval
 * when the segment was already registered in this runtime.
 */
export async function executeSplitBundleEntry(bundlePath: string): Promise<boolean> {
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

  // Segment module ids are scoped — re-eval the bundle file when possible.
  if (typeof global.globalEvalWithSourceUrl === 'function') {
    try {
      global.globalEvalWithSourceUrl(code, path);
      return true;
    } catch (error) {
      if (__DEV__) {
        console.warn('[bundleLoader] globalEvalWithSourceUrl failed', error);
      }
    }
  }

  if (typeof global.__r === 'function') {
    try {
      global.__r(entryModuleId);
      return true;
    } catch (error) {
      if (__DEV__) {
        console.warn(`[bundleLoader] __r(${entryModuleId}) failed`, error);
      }
    }
  }

  return false;
}
