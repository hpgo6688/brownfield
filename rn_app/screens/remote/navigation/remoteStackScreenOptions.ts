import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const remoteStackScreenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  animation: 'slide_from_right',
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  headerStyle: {
    backgroundColor: '#FFFFFF',
  },
  headerShadowVisible: true,
  headerTintColor: '#007AFF',
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 17,
  },
  headerBackTitle: '返回',
  headerTitleAlign: 'center',
  contentStyle: {
    backgroundColor: '#F8FAFC',
  },
};
