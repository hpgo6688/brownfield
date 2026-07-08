import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import HomeScreen from '../../screens/HomeScreen';

registerFeature('home', 'HomeScreen', HomeScreen);
AppRegistry.registerComponent('HomeScreen', () => HomeScreen);
