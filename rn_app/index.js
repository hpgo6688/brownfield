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
import { remoteFeatures } from './screens/remote';

// Standalone RN app entry (npm run ios)
AppRegistry.registerComponent(appName, () => App);

// Scheme 1: core RN — local fixed moduleNames (no manifest / OTA)
AppRegistry.registerComponent('HomeScreen', () => HomeScreen);
AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
AppRegistry.registerComponent('SettingsScreen', () => SettingsScreen);

// Remote business block — fallback registry for offline / first launch
Object.entries(remoteFeatures).forEach(([featureId, feature]) => {
  registerFeature(featureId, feature.moduleName, feature.component);
});

AppRegistry.registerComponent('FeatureHost', () => FeatureHost);
