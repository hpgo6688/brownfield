import DynamicHomeScreen from './DynamicHomeScreen';
import DynamicProfileScreen from './DynamicProfileScreen';
import DynamicSettingsScreen from './DynamicSettingsScreen';

export const dynamicFeatures = {
  home: {
    moduleName: 'DynamicHomeScreen',
    component: DynamicHomeScreen,
  },
  profile: {
    moduleName: 'DynamicProfileScreen',
    component: DynamicProfileScreen,
  },
  settings: {
    moduleName: 'DynamicSettingsScreen',
    component: DynamicSettingsScreen,
  },
} as const;

export type DynamicFeatureId = keyof typeof dynamicFeatures;
