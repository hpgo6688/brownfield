declare global {
  // eslint-disable-next-line no-var
  var __OTA_LOADED_THIS_SESSION__: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __METRO_LOADED_THIS_SESSION__: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __SHARED_BUNDLE_LOADED_THIS_SESSION__: string | undefined;
}

function loadedSet(): Set<string> {
  if (!global.__OTA_LOADED_THIS_SESSION__) {
    global.__OTA_LOADED_THIS_SESSION__ = new Set();
  }
  return global.__OTA_LOADED_THIS_SESSION__;
}

function metroLoadedSet(): Set<string> {
  if (!global.__METRO_LOADED_THIS_SESSION__) {
    global.__METRO_LOADED_THIS_SESSION__ = new Set();
  }
  return global.__METRO_LOADED_THIS_SESSION__;
}

/** True after this feature successfully rendered once in the current JS runtime. */
export function wasOtaFeatureLoadedThisSession(featureId: string): boolean {
  return loadedSet().has(featureId);
}

export function markOtaFeatureLoadedThisSession(featureId: string): void {
  loadedSet().add(featureId);
}

export function clearOtaFeatureSessionMark(featureId: string): void {
  loadedSet().delete(featureId);
}

/** True after Metro dev load for this feature in the current JS runtime. */
export function wasMetroFeatureLoadedThisSession(featureId: string): boolean {
  return metroLoadedSet().has(featureId);
}

export function markMetroFeatureLoadedThisSession(featureId: string): void {
  metroLoadedSet().add(featureId);
}

export function clearMetroFeatureSessionMark(featureId: string): void {
  metroLoadedSet().delete(featureId);
}

export function clearAllFeatureSessionMarks(featureId: string): void {
  clearOtaFeatureSessionMark(featureId);
  clearMetroFeatureSessionMark(featureId);
}

/** Shared OTA segment loaded in this JS runtime (version string). */
export function wasSharedBundleLoadedThisSession(version: string): boolean {
  return global.__SHARED_BUNDLE_LOADED_THIS_SESSION__ === version;
}

export function markSharedBundleLoadedThisSession(version: string): void {
  global.__SHARED_BUNDLE_LOADED_THIS_SESSION__ = version;
}

export function clearSharedBundleSessionMark(): void {
  global.__SHARED_BUNDLE_LOADED_THIS_SESSION__ = undefined;
}
