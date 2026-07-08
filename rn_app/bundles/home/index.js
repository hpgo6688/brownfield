import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import DynamicHomeScreen from '../../screens/dynamic/DynamicHomeScreen';

registerFeature('home', 'DynamicHomeScreen', DynamicHomeScreen);
AppRegistry.registerComponent('DynamicHomeScreen', () => DynamicHomeScreen);
