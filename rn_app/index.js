/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

// Standalone RN app entry (npm run ios)
AppRegistry.registerComponent(appName, () => App);

// Brownfield: one bundle, multiple moduleNames
AppRegistry.registerComponent('HomeScreen', () => HomeScreen);
AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
AppRegistry.registerComponent('SettingsScreen', () => SettingsScreen);
