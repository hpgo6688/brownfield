import type { ComponentType } from 'react';
import {
  remoteFeatureMeta,
  type RemoteFeatureId,
} from '../../screens/remote';
import { registerFeature } from './registerFeature';

export async function loadMetroDevFeature(
  featureId: string,
): Promise<ComponentType> {
  const meta = remoteFeatureMeta[featureId as RemoteFeatureId];
  if (!meta) {
    throw new Error(`Metro 模式：未知 feature "${featureId}"`);
  }

  let component: ComponentType;
  switch (featureId as RemoteFeatureId) {
    case 'order': {
      const module = await import('../../screens/remote/OrderScreen');
      component = module.default;
      break;
    }
    case 'promo': {
      const module = await import('../../screens/remote/PromoScreen');
      component = module.default;
      break;
    }
    default:
      throw new Error(`Metro 模式：feature "${featureId}" 未配置 dev 入口`);
  }

  registerFeature(featureId, meta.moduleName, component, { source: 'main' });
  return component;
}
