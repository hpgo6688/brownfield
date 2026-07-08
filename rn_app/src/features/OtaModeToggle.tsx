/**
 * @deprecated Use native shell toolbar toggle (RemoteReactNativeScreenView).
 * Kept for standalone `npm run ios` debugging without the Swift shell.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setPersistedDevOtaMode } from './devOtaModeStore';
import { reloadFeatureRuntime } from './featureReload';
import {
  getForceOtaInDev,
  setForceOtaInDev,
  useForceOtaInDev,
} from './remoteConfig';

type OtaModeToggleProps = {
  absolute?: boolean;
};

export function OtaModeToggle({ absolute = true }: OtaModeToggleProps) {
  const forceOta = useForceOtaInDev();
  const insets = useSafeAreaInsets();

  if (!__DEV__) {
    return null;
  }

  async function handlePress() {
    const nextOta = !getForceOtaInDev();
    await setPersistedDevOtaMode(nextOta);
    setForceOtaInDev(nextOta);
    reloadFeatureRuntime();
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: forceOta }}
      accessibilityLabel={
        forceOta ? 'OTA 模式，点击切换为 Metro' : 'Metro 模式，点击切换为 OTA'
      }
      onPress={handlePress}
      style={[
        styles.toggle,
        absolute && {
          position: 'absolute',
          top: insets.top + 8,
          left: Math.max(insets.left, 12),
          zIndex: 10,
        },
        forceOta ? styles.toggleOta : styles.toggleMetro,
      ]}>
      <Text style={styles.toggleLabel}>{forceOta ? 'OTA' : 'Metro'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleMetro: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  toggleOta: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
});
