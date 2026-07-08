import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OtaUpdateBanner from './OtaUpdateBanner';
import { formatVersionLabel, useFeatureHost } from './useFeatureHost';
import { OTA_RETRY_MAX_ATTEMPTS } from './retryWithBackoff';

type FeatureHostProps = {
  featureId?: string;
  manifestUrl?: string;
  /** Passed from native shell toolbar toggle (DEBUG). */
  devOtaMode?: boolean;
};

export default function FeatureHost({
  featureId,
  manifestUrl,
  devOtaMode,
}: FeatureHostProps) {
  const {
    Screen,
    error,
    loading,
    otaModeActive,
    poll,
    showBanner,
    showDevPollStatus,
  } = useFeatureHost({ featureId, manifestUrl, devOtaMode });

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>页面加载失败</Text>
            <Text style={styles.errorBody}>{error.message}</Text>
            {otaModeActive ? (
              <View style={styles.errorVersionBox}>
                <Text style={styles.errorVersionRow}>
                  服务端版本：{formatVersionLabel(error.remoteVersion)}
                </Text>
                <Text style={styles.errorVersionRow}>
                  本地版本：{formatVersionLabel(error.localVersion)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中…</Text>
          </View>
        ) : Screen ? (
          <View style={styles.screen}>
            <Screen />
            {showBanner ? (
              <OtaUpdateBanner
                pendingUpdate={poll.pendingUpdate!}
                activeVersion={poll.activeVersion}
                applying={poll.applying}
                downloading={poll.downloading}
                onApply={() => {
                  poll.applyUpdate().catch(() => {});
                }}
                onDismiss={() => {
                  poll.dismissPrompt().catch(() => {});
                }}
              />
            ) : null}
            {showDevPollStatus ? (
              <Pressable
                style={styles.devPollStatus}
                onPress={() => {
                  poll.pollNow().catch(() => {});
                }}>
                <Text style={styles.devPollText}>
                  {featureId} · active v{poll.activeVersion ?? '?'} · remote v
                  {poll.remoteVersion ?? '?'}
                  {poll.downloading ? ' · 下载中' : ''}
                  {poll.retryAttempts != null
                    ? ` · retries ${poll.retryAttempts}/${OTA_RETRY_MAX_ATTEMPTS}`
                    : ''}
                  {poll.error ? ` · ${poll.error}` : ''}
                </Text>
                <Text style={styles.devPollHint}>
                  {manifestUrl ?? 'default manifest'} · 点此立即检查 · 每 20s poll
                </Text>
              </Pressable>
            ) : null}
            {poll.error && showBanner ? (
              <Text style={styles.pollError}>{poll.error}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorVersionBox: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignSelf: 'stretch',
    maxWidth: 320,
  },
  errorVersionRow: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  pollError: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    fontSize: 12,
    color: '#B91C1C',
    textAlign: 'center',
    zIndex: 9998,
  },
  devPollStatus: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9998,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
  devPollText: {
    color: '#E2E8F0',
    fontSize: 11,
  },
  devPollHint: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: 10,
  },
});
