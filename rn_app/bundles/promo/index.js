import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import PromoScreen from './screens/PromoScreen';

registerFeature('promo', 'PromoScreen', PromoScreen, { source: 'ota' });
AppRegistry.registerComponent('PromoScreen', () => PromoScreen);
