import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  PromoContentScreen,
  type PromoContentScreenProps,
} from './PromoContentScreen';
import { RemoteRootHeaderBack } from './navigation/RemoteRootHeaderBack';
import { remoteStackScreenOptions } from './navigation/remoteStackScreenOptions';

export type PromoStackParamList = {
  PromoRoot: undefined;
};

const Stack = createNativeStackNavigator<PromoStackParamList>();

type PromoNavigatorProps = {
  contentProps?: PromoContentScreenProps;
};

export function PromoNavigator({ contentProps }: PromoNavigatorProps = {}) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={remoteStackScreenOptions}>
        <Stack.Screen
          name="PromoRoot"
          options={{
            title: '活动',
            headerBackVisible: false,
            headerLeft: () => <RemoteRootHeaderBack />,
            gestureEnabled: false,
            fullScreenGestureEnabled: false,
          }}>
          {() => <PromoContentScreen {...contentProps} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
