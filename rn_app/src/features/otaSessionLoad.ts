declare global {
  // eslint-disable-next-line no-var
  var __OTA_LOADED_THIS_SESSION__: Set<string> | undefined;
}

function loadedSet(): Set<string> {
  if (!global.__OTA_LOADED_THIS_SESSION__) {
    global.__OTA_LOADED_THIS_SESSION__ = new Set();
  }
  return global.__OTA_LOADED_THIS_SESSION__;
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
