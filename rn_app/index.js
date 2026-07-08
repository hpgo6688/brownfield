/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import FeatureHost from './src/features/FeatureHost';
import { registerFeature } from './src/features/registerFeature';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import { dynamicFeatures } from './screens/dynamic';

// Standalone RN app entry (npm run ios)
AppRegistry.registerComponent(appName, () => App);

// 方案 1: single bundle, multiple moduleNames
AppRegistry.registerComponent('HomeScreen', () => HomeScreen);
AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
AppRegistry.registerComponent('SettingsScreen', () => SettingsScreen);

// 方案 2: dynamic bundle features (separate screens from scheme 1)
Object.entries(dynamicFeatures).forEach(([featureId, feature]) => {
  registerFeature(featureId, feature.moduleName, feature.component);
});

AppRegistry.registerComponent('FeatureHost', () => FeatureHost);
