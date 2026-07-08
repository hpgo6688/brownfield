import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import ProfileScreen from '../../screens/ProfileScreen';

registerFeature('profile', 'ProfileScreen', ProfileScreen);
AppRegistry.registerComponent('ProfileScreen', () => ProfileScreen);
