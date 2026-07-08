import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import OrderScreen from './screens/OrderScreen';

registerFeature('order', 'OrderScreen', OrderScreen, { source: 'ota' });
AppRegistry.registerComponent('OrderScreen', () => OrderScreen);
