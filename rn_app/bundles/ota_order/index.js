import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import OrderScreen from './screens/OrderScreen';

registerFeature('order', 'ota_OrderScreen', OrderScreen, { source: 'ota' });
AppRegistry.registerComponent('ota_OrderScreen', () => OrderScreen);
