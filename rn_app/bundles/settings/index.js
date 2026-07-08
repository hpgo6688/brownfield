import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import SettingsScreen from '../../screens/SettingsScreen';

registerFeature('settings', 'SettingsScreen', SettingsScreen);
AppRegistry.registerComponent('SettingsScreen', () => SettingsScreen);
