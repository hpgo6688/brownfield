import { useSyncExternalStore } from 'react';

/**
 * Runtime Debug toggle: force Remote pages to load from bundle-server OTA
 * instead of the Metro main-bundle fallback.
 *
 * Toggle in-app via OtaModeToggle (top-left on Remote screens).
 */
let forceOtaInDev = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach(listener => listener());
}

export function getForceOtaInDev(): boolean {
  return __DEV__ && forceOtaInDev;
}

export function setForceOtaInDev(value: boolean): void {
  if (!__DEV__ || forceOtaInDev === value) {
    return;
  }

  forceOtaInDev = value;
  emitChange();
}

export function toggleForceOtaInDev(): boolean {
  setForceOtaInDev(!forceOtaInDev);
  return getForceOtaInDev();
}

export function allowsMainBundleFallback(): boolean {
  return !getForceOtaInDev();
}

function subscribeForceOtaInDev(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useForceOtaInDev(): boolean {
  return useSyncExternalStore(
    subscribeForceOtaInDev,
    getForceOtaInDev,
    () => false,
  );
}
