import { AppRegistry } from 'react-native';
import { registerFeature } from '../../src/features/registerFeature';
import OrderScreen from '../../screens/remote/OrderScreen';

registerFeature('order', 'OrderScreen', OrderScreen);
AppRegistry.registerComponent('OrderScreen', () => OrderScreen);
