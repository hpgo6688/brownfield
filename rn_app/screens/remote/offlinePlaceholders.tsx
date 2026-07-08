import { StyleSheet, Text, View } from 'react-native';

export function createOfflinePlaceholder(title: string) {
  return function OfflinePlaceholder() {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>
          离线占位页。请打开 OTA 模式并检查 Remote 更新后查看完整内容。
        </Text>
      </View>
    );
  };
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  hint: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
