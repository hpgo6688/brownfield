import { NativeModules, Platform } from 'react-native';

type NativeShellNavigationModule = {
  popToNative: () => void;
};

const NativeShellNavigation =
  NativeModules.NativeShellNavigation as NativeShellNavigationModule | undefined;

/** Dismiss the current Remote RN screen and return to the native shell menu. */
export function popToNative(): void {
  if (Platform.OS !== 'ios') {
    return;
  }

  NativeShellNavigation?.popToNative?.();
}
