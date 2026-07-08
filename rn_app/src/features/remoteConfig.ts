import { useSyncExternalStore } from 'react';

/**
 * Runtime Debug toggle: force Remote pages to load from bundle-server OTA
 * instead of the Metro main-bundle fallback.
 *
 * Toggle in native shell navigation bar (RemoteReactNativeScreenView, DEBUG only).
 *
 * Metro dev: FeatureHost loads screens/remote/ (OrderScreen, PromoScreen).
 * OTA dev/release: screens/ota/ (ota_OrderScreen, ota_PromoScreen) via bundles/ota_*.
 * Shared preference: Documents/dev-ota-mode.pref
 */
let forceOtaInDev = false;
let otaBundleRevision = 0;
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

export function bumpOtaBundleRevision(): void {
  otaBundleRevision += 1;
  emitChange();
}

function getOtaBundleRevision(): number {
  return otaBundleRevision;
}

export function useOtaBundleRevision(): number {
  return useSyncExternalStore(
    subscribeForceOtaInDev,
    getOtaBundleRevision,
    () => 0,
  );
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
