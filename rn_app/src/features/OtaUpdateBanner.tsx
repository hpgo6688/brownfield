import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PendingFeatureMetadata } from './bundleCache';

type OtaUpdateBannerProps = {
  pendingUpdate: PendingFeatureMetadata;
  activeVersion: string | null;
  applying: boolean;
  downloading: boolean;
  onApply: () => void;
  onDismiss: () => void;
};

export default function OtaUpdateBanner({
  pendingUpdate,
  activeVersion,
  applying,
  downloading,
  onApply,
  onDismiss,
}: OtaUpdateBannerProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>发现远程版本 v{pendingUpdate.version}</Text>
        <Text style={styles.subtitle}>
          {activeVersion
            ? `当前 v${activeVersion} · 点击立即更新切换至远程版本`
            : '远程版本已下载 · 点击立即更新'}
          {downloading ? ' · 下载中…' : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.dismissButton} onPress={onDismiss} disabled={applying}>
          <Text style={styles.dismissText}>稍后</Text>
        </Pressable>
        <Pressable
          style={[styles.applyButton, applying && styles.applyButtonDisabled]}
          onPress={onApply}
          disabled={applying || downloading}>
          {applying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.applyText}>立即更新</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dismissButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dismissText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  applyButton: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  applyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
