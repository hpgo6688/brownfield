/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import FeatureHost from './src/features/FeatureHost';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

// Standalone RN app entry (npm run ios)
AppRegistry.registerComponent(appName, () => App);

// 方案 1: single bundle, multiple moduleNames (embedded in main.jsbundle / Metro)
AppRegistry.registerComponent('HomeScreen', () => HomeScreen);
AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
AppRegistry.registerComponent('SettingsScreen', () => SettingsScreen);

// 方案 2: dynamic feature bundles loaded from server manifest
AppRegistry.registerComponent('FeatureHost', () => FeatureHost);
