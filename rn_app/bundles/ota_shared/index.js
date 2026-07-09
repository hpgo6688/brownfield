/**
 * Shared OTA split — warms React Navigation + screens + gesture-handler.
 * No registerFeature / AppRegistry (loaded before feature segments).
 *
 * Every module under screens/remote/navigation/ and screens/remote/components/
 * that feature splits import MUST be warmed here — otherwise feature bundles reference main-only ids
 * and fail after DevSettings.reload() (立即更新).
 */
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableScreens } from 'react-native-screens';
import { RemoteScreenShell } from '../../screens/remote/RemoteScreenShell';
import { RemoteRootHeaderBack } from '../../screens/remote/navigation/RemoteRootHeaderBack';
import { remoteStackScreenOptions } from '../../screens/remote/navigation/remoteStackScreenOptions';
import { OrderList, PromoList, RemoteHero } from '../../screens/remote/components';

enableScreens(true);

const Stack = createNativeStackNavigator();

void NavigationContainer;
void Stack;
void RemoteScreenShell;
void RemoteRootHeaderBack;
void remoteStackScreenOptions;
void OrderList;
void PromoList;
void RemoteHero;
