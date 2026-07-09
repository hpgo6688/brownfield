import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, DevSettings, type AppStateStatus } from 'react-native';
import type { PendingFeatureMetadata } from './bundleCache';
import { clearStalePendingRelease } from './bundleCache';
import {
  applyPendingFeature,
  checkRemoteFeature,
  downloadPendingFeature,
  getPendingUpdate,
  markPendingDeferredApply,
  matchesRemoteRelease,
} from './bundleUpdater';
import { bumpOtaBundleRevision, getForceOtaInDev, OTA_POLL_INTERVAL_MS } from './remoteConfig';
import { ensureSharedBundleCached, clearLoadedSharedBundles } from './sharedBundleUpdater';
import { clearSharedBundleSessionMark } from './otaSessionLoad';
import { FetchRetryError, OTA_RETRY_MAX_ATTEMPTS } from './retryWithBackoff';

export type OtaPollState = {
  pendingUpdate: PendingFeatureMetadata | null;
  activeVersion: string | null;
  remoteVersion: string | null;
  downloading: boolean;
  applying: boolean;
  error: string | null;
  retryAttempts: number | null;
  lastCheckedAt: string | null;
};

type UseOtaUpdatePollerOptions = {
  featureId: string;
  manifestUrl?: string;
  enabled: boolean;
  pollNowToken?: number;
  /** Delay first poll cycle (e.g. after instant OTA re-entry). Interval polling unchanged. */
  deferInitialPollMs?: number;
};

export function useOtaUpdatePoller({
  featureId,
  manifestUrl,
  enabled,
  pollNowToken = 0,
  deferInitialPollMs = 0,
}: UseOtaUpdatePollerOptions) {
  const [pendingUpdate, setPendingUpdate] = useState<PendingFeatureMetadata | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState<number | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshPending = useCallback(async () => {
    const pending = await getPendingUpdate(featureId);
    setPendingUpdate(pending);
    return pending;
  }, [featureId]);

  const runPollCycle = useCallback(async () => {
    if (!enabled || inFlightRef.current || appStateRef.current !== 'active') {
      return;
    }

    inFlightRef.current = true;
    setError(null);
    setRetryAttempts(null);

    try {
      const check = await checkRemoteFeature(featureId, { manifestUrl });
      setActiveVersion(check.activeVersion);
      setRemoteVersion(check.remoteFeature.version);
      setLastCheckedAt(new Date().toISOString());

      if (__DEV__) {
        console.log(
          `[OTA poll] ${featureId} active=${check.activeVersion ?? 'none'} remote=${check.remoteFeature.version} update=${check.updateAvailable}`,
        );
      }

      const existingPending = await getPendingUpdate(featureId);
      if (existingPending) {
        if (matchesRemoteRelease(existingPending, check.remoteFeature)) {
          setPendingUpdate(existingPending);
          return;
        }

        await clearStalePendingRelease(featureId, existingPending);
      }

      if (!check.updateAvailable || check.remoteFeature.hash === 'sha256:unset') {
        setPendingUpdate(null);
        return;
      }

      setDownloading(true);
      const pending = await downloadPendingFeature(check.remoteFeature);
      setPendingUpdate(pending);

      if (__DEV__) {
        console.log(`[OTA poll] ${featureId} pending download ready v${pending.version}`);
      }
    } catch (pollError) {
      let message =
        pollError instanceof Error ? pollError.message : 'OTA poll failed';
      if (pollError instanceof FetchRetryError) {
        setRetryAttempts(pollError.attempts);
        message = `${message} (retries: ${pollError.attempts}/${OTA_RETRY_MAX_ATTEMPTS})`;
      } else {
        setRetryAttempts(null);
      }
      setError(message);
      if (__DEV__) {
        console.warn(`[OTA poll] ${featureId} failed:`, message);
      }
    } finally {
      setDownloading(false);
      inFlightRef.current = false;
    }
  }, [enabled, featureId, manifestUrl]);

  const pollNow = useCallback(async () => {
    await runPollCycle();
  }, [runPollCycle]);

  const dismissPrompt = useCallback(async () => {
    await markPendingDeferredApply(featureId);
    const pending = await refreshPending();
    if (pending) {
      setPendingUpdate({ ...pending, deferredApply: true });
    }
  }, [featureId, refreshPending]);

  const applyUpdate = useCallback(async () => {
    if (applying) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const active = await applyPendingFeature(featureId);
      if (!active) {
        await refreshPending();
        return;
      }

      setPendingUpdate(null);
      setActiveVersion(active.version);

      if (__DEV__ && getForceOtaInDev()) {
        clearSharedBundleSessionMark();
        clearLoadedSharedBundles();
        await ensureSharedBundleCached({ manifestUrl });
        DevSettings.reload();
        return;
      }

      bumpOtaBundleRevision();
    } catch (applyError) {
      const message =
        applyError instanceof Error ? applyError.message : 'Apply update failed';
      setError(message);
    } finally {
      setApplying(false);
    }
  }, [applying, featureId, refreshPending]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    refreshPending().catch(() => {});

    let deferTimer: ReturnType<typeof setTimeout> | undefined;
    if (deferInitialPollMs > 0) {
      deferTimer = setTimeout(() => {
        runPollCycle().catch(() => {});
      }, deferInitialPollMs);
    } else {
      runPollCycle().catch(() => {});
    }

    const intervalId = setInterval(() => {
      runPollCycle().catch(() => {});
    }, OTA_POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', nextState => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        runPollCycle().catch(() => {});
      }
    });

    return () => {
      if (deferTimer) {
        clearTimeout(deferTimer);
      }
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [deferInitialPollMs, enabled, featureId, refreshPending, runPollCycle]);

  useEffect(() => {
    if (!enabled) {
      setPendingUpdate(null);
      setError(null);
      setRetryAttempts(null);
      return;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || pollNowToken === 0) {
      return;
    }

    runPollCycle().catch(() => {});
  }, [enabled, pollNowToken, runPollCycle]);

  return {
    pendingUpdate,
    activeVersion,
    remoteVersion,
    downloading,
    applying,
    error,
    retryAttempts,
    lastCheckedAt,
    pollNow,
    applyUpdate,
    dismissPrompt,
  };
}
