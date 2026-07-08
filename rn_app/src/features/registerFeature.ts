import type { ComponentType } from 'react';
import { normalizeLocalPath } from './bundleCache';

export type FeatureSource = 'main' | 'ota';

export type FeatureRegistration = {
  moduleName: string;
  component: ComponentType;
  source: FeatureSource;
};

type OtaComponentCacheEntry = {
  moduleName: string;
  component: ComponentType;
  version?: string;
  hash?: string;
  localPath?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __RN_FEATURE_REGISTRY__: Record<string, FeatureRegistration> | undefined;
  // eslint-disable-next-line no-var
  var __OTA_COMPONENT_CACHE__: Record<string, OtaComponentCacheEntry> | undefined;
}

function rememberOtaComponent(
  featureId: string,
  moduleName: string,
  component: ComponentType,
) {
  if (!global.__OTA_COMPONENT_CACHE__) {
    global.__OTA_COMPONENT_CACHE__ = {};
  }

  global.__OTA_COMPONENT_CACHE__[featureId] = { moduleName, component };
}

export function registerFeature(
  featureId: string,
  moduleName: string,
  component: ComponentType,
  options?: { source?: FeatureSource },
) {
  if (!global.__RN_FEATURE_REGISTRY__) {
    global.__RN_FEATURE_REGISTRY__ = {};
  }

  const source = options?.source ?? 'ota';

  global.__RN_FEATURE_REGISTRY__[featureId] = {
    moduleName,
    component,
    source,
  };

  if (source === 'ota') {
    rememberOtaComponent(featureId, moduleName, component);
  }
}

export function shouldBustOtaComponentCache(
  featureId: string,
  activeVersion?: string | null,
  activeLocalPath?: string | null,
): boolean {
  const cached = global.__OTA_COMPONENT_CACHE__?.[featureId];
  if (!cached) {
    return false;
  }

  if (cached.version && activeVersion && cached.version !== activeVersion) {
    return true;
  }

  if (
    cached.localPath &&
    activeLocalPath &&
    normalizeLocalPath(cached.localPath) !== normalizeLocalPath(activeLocalPath)
  ) {
    return true;
  }

  return false;
}

export function clearOtaComponentCache(featureId?: string) {
  if (!global.__OTA_COMPONENT_CACHE__) {
    return;
  }

  if (featureId == null) {
    global.__OTA_COMPONENT_CACHE__ = {};
    return;
  }

  delete global.__OTA_COMPONENT_CACHE__[featureId];
}

export function stampOtaComponentCacheVersion(
  featureId: string,
  version: string,
  hash: string,
  localPath?: string,
) {
  const entry = global.__OTA_COMPONENT_CACHE__?.[featureId];
  if (!entry) {
    return;
  }

  entry.version = version;
  entry.hash = hash;
  if (localPath) {
    entry.localPath = localPath;
  }
}

/**
 * Native split segments stay loaded across mode switches, but
 * clearFeatureRegistration() wipes JS registry. Rehydrate from cache when
 * registerSegmentWithId skips re-eval on the second OTA load.
 * Only restores when cache matches the active bundle version on disk.
 */
export function syncOtaRegistrationFromCache(
  featureId: string,
  options?: {
    expectedVersion?: string | null;
    expectedHash?: string | null;
    expectedLocalPath?: string | null;
  },
): boolean {
  const cached = global.__OTA_COMPONENT_CACHE__?.[featureId];
  if (!cached) {
    return false;
  }

  if (
    options?.expectedVersion &&
    cached.version &&
    cached.version !== options.expectedVersion
  ) {
    return false;
  }

  if (
    options?.expectedLocalPath &&
    cached.localPath &&
    normalizeLocalPath(options.expectedLocalPath) !== normalizeLocalPath(cached.localPath)
  ) {
    return false;
  }

  registerFeature(featureId, cached.moduleName, cached.component, {
    source: 'ota',
  });
  return true;
}

export function getFeatureComponent(
  featureId: string,
  options?: { otaOnly?: boolean },
) {
  const registration = global.__RN_FEATURE_REGISTRY__?.[featureId];
  if (!registration) {
    return null;
  }

  if (options?.otaOnly && registration.source !== 'ota') {
    return null;
  }

  return registration.component;
}

export function getFeatureSource(featureId: string): FeatureSource | null {
  return global.__RN_FEATURE_REGISTRY__?.[featureId]?.source ?? null;
}

export function isFeatureLoaded(featureId: string) {
  return Boolean(global.__RN_FEATURE_REGISTRY__?.[featureId]);
}

export function isFeatureLoadedFromOta(featureId: string) {
  return getFeatureSource(featureId) === 'ota';
}

export function clearFeatureRegistration(featureId?: string) {
  if (!global.__RN_FEATURE_REGISTRY__) {
    return;
  }

  if (featureId == null) {
    global.__RN_FEATURE_REGISTRY__ = {};
    return;
  }

  delete global.__RN_FEATURE_REGISTRY__[featureId];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForFeatureComponent(
  featureId: string,
  options?: { otaOnly?: boolean; timeoutMs?: number; intervalMs?: number },
): Promise<ComponentType | null> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const intervalMs = options?.intervalMs ?? 50;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const component = getFeatureComponent(featureId, {
      otaOnly: options?.otaOnly,
    });
    if (component) {
      return component;
    }
    await sleep(intervalMs);
  }

  return null;
}
