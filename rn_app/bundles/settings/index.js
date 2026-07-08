import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import DynamicSettingsScreen from '../../screens/dynamic/DynamicSettingsScreen';

registerFeature('settings', 'DynamicSettingsScreen', DynamicSettingsScreen);
AppRegistry.registerComponent('DynamicSettingsScreen', () => DynamicSettingsScreen);
