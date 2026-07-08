import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import DynamicProfileScreen from '../../screens/dynamic/DynamicProfileScreen';

registerFeature('profile', 'DynamicProfileScreen', DynamicProfileScreen);
AppRegistry.registerComponent('DynamicProfileScreen', () => DynamicProfileScreen);
