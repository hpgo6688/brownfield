import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import PromoScreen from '../../screens/remote/PromoScreen';

registerFeature('promo', 'PromoScreen', PromoScreen);
AppRegistry.registerComponent('PromoScreen', () => PromoScreen);
