import type { ComponentType } from 'react';

export type FeatureSource = 'main' | 'ota';

export type FeatureRegistration = {
  moduleName: string;
  component: ComponentType;
  source: FeatureSource;
};

declare global {
  // eslint-disable-next-line no-var
  var __RN_FEATURE_REGISTRY__: Record<string, FeatureRegistration> | undefined;
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

  global.__RN_FEATURE_REGISTRY__[featureId] = {
    moduleName,
    component,
    source: options?.source ?? 'ota',
  };
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
