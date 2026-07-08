import { StyleSheet, Text, View } from 'react-native';
import { DynamicScreenShell } from './DynamicScreenShell';

export default function DynamicHomeScreen() {
  return (
    <DynamicScreenShell>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>动态 Bundle</Text>
          <Text style={styles.title}>首页</Text>
          <Text style={styles.subtitle}>由服务端 manifest 下发的独立页面</Text>
        </View>
      </View>
    </DynamicScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  hero: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
