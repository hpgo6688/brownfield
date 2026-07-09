import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useOtaUpdatePoller } from '../otaUpdatePoller';
import { checkRemoteFeature } from '../bundleUpdater';

jest.mock('../bundleUpdater', () => ({
  checkRemoteFeature: jest.fn(),
  getPendingUpdate: jest.fn().mockResolvedValue(null),
  downloadPendingFeature: jest.fn(),
  applyPendingFeature: jest.fn(),
  markPendingDeferredApply: jest.fn(),
  matchesRemoteRelease: jest.fn(),
}));

jest.mock('../bundleCache', () => ({
  clearStalePendingRelease: jest.fn(),
}));

jest.mock('../remoteConfig', () => ({
  bumpOtaBundleRevision: jest.fn(),
  getForceOtaInDev: jest.fn(() => false),
  OTA_POLL_INTERVAL_MS: 20_000,
}));

const mockCheckRemoteFeature = checkRemoteFeature as jest.MockedFunction<
  typeof checkRemoteFeature
>;

function PollerProbe({
  deferInitialPollMs,
}: {
  deferInitialPollMs?: number;
}) {
  useOtaUpdatePoller({
    featureId: 'order',
    enabled: true,
    deferInitialPollMs,
  });
  return null;
}

describe('useOtaUpdatePoller deferInitialPollMs', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCheckRemoteFeature.mockResolvedValue({
      featureId: 'order',
      remoteFeature: {
        id: 'order',
        title: 'order',
        icon: '',
        moduleName: '',
        bundleUrl: '',
        version: '0.0.7',
        hash: 'sha256:abc',
        minAppVersion: '0.0.0',
      },
      updateAvailable: false,
      activeVersion: '0.0.7',
      pendingVersion: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defers first runPollCycle until deferInitialPollMs elapses', async () => {
    await act(async () => {
      TestRenderer.create(React.createElement(PollerProbe, { deferInitialPollMs: 1500 }));
    });

    expect(mockCheckRemoteFeature).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1499);
    });
    expect(mockCheckRemoteFeature).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockCheckRemoteFeature).toHaveBeenCalledTimes(1);
  });

  it('runs first poll immediately when deferInitialPollMs is zero', async () => {
    await act(async () => {
      TestRenderer.create(React.createElement(PollerProbe, { deferInitialPollMs: 0 }));
    });

    expect(mockCheckRemoteFeature).toHaveBeenCalledTimes(1);
  });
});
