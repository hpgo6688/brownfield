import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import PromoScreen from '../../screens/ota/PromoScreen';

registerFeature('promo', 'ota_PromoScreen', PromoScreen, { source: 'ota' });
AppRegistry.registerComponent('ota_PromoScreen', () => PromoScreen);
