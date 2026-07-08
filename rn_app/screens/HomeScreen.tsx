import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from './ScreenShell';

export default function HomeScreen() {
  return (
    <ScreenShell>
      <View style={styles.content}>
        <Text style={styles.icon}>🏠</Text>
        <Text style={styles.title}>首页</Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});
