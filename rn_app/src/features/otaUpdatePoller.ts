import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { PendingFeatureMetadata } from './bundleCache';
import {
  applyPendingFeature,
  checkRemoteFeature,
  downloadPendingFeature,
  getPendingUpdate,
} from './bundleUpdater';
import { bumpOtaBundleRevision, OTA_POLL_INTERVAL_MS } from './remoteConfig';

export type OtaPollState = {
  pendingUpdate: PendingFeatureMetadata | null;
  activeVersion: string | null;
  remoteVersion: string | null;
  downloading: boolean;
  applying: boolean;
  dismissed: boolean;
  error: string | null;
  lastCheckedAt: string | null;
};

type UseOtaUpdatePollerOptions = {
  featureId: string;
  manifestUrl?: string;
  enabled: boolean;
  pollNowToken?: number;
};

export function useOtaUpdatePoller({
  featureId,
  manifestUrl,
  enabled,
  pollNowToken = 0,
}: UseOtaUpdatePollerOptions) {
  const [pendingUpdate, setPendingUpdate] = useState<PendingFeatureMetadata | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const refreshPending = useCallback(async () => {
    const pending = await getPendingUpdate(featureId);
    setPendingUpdate(pending);
    if (pending) {
      setDismissed(false);
    }
    return pending;
  }, [featureId]);

  const runPollCycle = useCallback(async () => {
    if (!enabled || inFlightRef.current || appStateRef.current !== 'active') {
      return;
    }

    inFlightRef.current = true;
    setError(null);

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
        setPendingUpdate(existingPending);
        setDismissed(false);
        return;
      }

      if (!check.updateAvailable || check.remoteFeature.hash === 'sha256:unset') {
        setPendingUpdate(null);
        return;
      }

      setDownloading(true);
      const pending = await downloadPendingFeature(check.remoteFeature);
      setPendingUpdate(pending);
      setDismissed(false);

      if (__DEV__) {
        console.log(`[OTA poll] ${featureId} pending download ready v${pending.version}`);
      }
    } catch (pollError) {
      const message =
        pollError instanceof Error ? pollError.message : 'OTA poll failed';
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

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
  }, []);

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
      setDismissed(false);
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
    runPollCycle().catch(() => {});

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
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [enabled, featureId, refreshPending, runPollCycle]);

  useEffect(() => {
    if (!enabled) {
      setPendingUpdate(null);
      setError(null);
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
    dismissed,
    error,
    lastCheckedAt,
    pollNow,
    applyUpdate,
    dismissPrompt,
  };
}
