import type { ComponentType } from 'react';

export type FeatureRegistration = {
  moduleName: string;
  component: ComponentType;
};

declare global {
  // eslint-disable-next-line no-var
  var __RN_FEATURE_REGISTRY__: Record<string, FeatureRegistration> | undefined;
}

export function registerFeature(
  featureId: string,
  moduleName: string,
  component: ComponentType,
) {
  if (!global.__RN_FEATURE_REGISTRY__) {
    global.__RN_FEATURE_REGISTRY__ = {};
  }

  global.__RN_FEATURE_REGISTRY__[featureId] = { moduleName, component };
}

export function getFeatureComponent(featureId: string) {
  return global.__RN_FEATURE_REGISTRY__?.[featureId]?.component ?? null;
}

export function isFeatureLoaded(featureId: string) {
  return Boolean(global.__RN_FEATURE_REGISTRY__?.[featureId]);
}
