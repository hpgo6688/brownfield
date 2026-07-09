import { HeaderBackButton } from '@react-navigation/elements';
import { popToNative } from '../../../src/features/nativeShell';

/** Root Remote route: native-style back control exits to shell menu. */
export function RemoteRootHeaderBack() {
  return (
    <HeaderBackButton
      onPress={popToNative}
      label="菜单"
      tintColor="#007AFF"
    />
  );
}
